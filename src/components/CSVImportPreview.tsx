import { useState, useMemo } from 'react';
import type { Recipe, WeekPlan, DayOfWeek, DayMeal } from '../types';
import { saveWeekPlan, generateId } from '../firestore-storage';

interface CSVImportPreviewProps {
  recipes: Recipe[];
  existingPlans: WeekPlan[];
  familyId: string;
  onImportComplete: () => void;
  onCancel: () => void;
}

interface ParsedMealRow {
  weekStart: string;
  day: DayOfWeek;
  mealName: string;
  category: string;
}

type MatchStatus = 'exact' | 'fuzzy' | 'unmatched';

interface MealMapping {
  csvName: string;
  status: MatchStatus;
  matchedRecipeId: string | null;
  matchedRecipeName: string | null;
  fuzzySuggestions: { id: string; name: string; score: number }[];
  userChoice: 'recipe' | 'custom' | 'exclude';
  userSelectedRecipeId: string | null;
}

const CUSTOM_PREFIX = 'custom:';

const DAY_NAME_MAP: Record<string, DayOfWeek> = {
  sunday: 'sunday',
  monday: 'monday',
  tuesday: 'tuesday',
  wednesday: 'wednesday',
  thursday: 'thursday',
  friday: 'friday',
  saturday: 'saturday',
  sun: 'sunday',
  mon: 'monday',
  tue: 'tuesday',
  wed: 'wednesday',
  thu: 'thursday',
  fri: 'friday',
  sat: 'saturday',
};

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

function getSundayOfWeek(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const dayOfWeek = date.getDay();
  date.setDate(date.getDate() - dayOfWeek);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Levenshtein distance for fuzzy matching
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

function fuzzyScore(query: string, candidate: string): number {
  const q = query.toLowerCase();
  const c = candidate.toLowerCase();

  if (q === c) return 1;

  if (c.includes(q) || q.includes(c)) {
    return 0.8;
  }

  const maxLen = Math.max(q.length, c.length);
  if (maxLen === 0) return 0;
  const dist = levenshtein(q, c);
  const similarity = 1 - dist / maxLen;

  const qWords = new Set(q.split(/\s+/));
  const cWords = new Set(c.split(/\s+/));
  let overlap = 0;
  for (const w of qWords) {
    if (cWords.has(w)) overlap++;
  }
  const wordBonus = qWords.size > 0 ? (overlap / qWords.size) * 0.3 : 0;

  return Math.min(1, similarity + wordBonus);
}

function findFuzzyMatches(
  mealName: string,
  recipes: Recipe[],
  limit: number = 3
): { id: string; name: string; score: number }[] {
  return recipes
    .map((r) => ({ id: r.id, name: r.name, score: fuzzyScore(mealName, r.name) }))
    .filter((r) => r.score >= 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function parseCSVRows(csvText: string): ParsedMealRow[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV must have a header row and at least one data row');
  }

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const weekStartIdx = header.indexOf('week_start');
  const dayIdx = header.indexOf('day');
  const mealIdx = header.indexOf('meal');
  const categoryIdx = header.indexOf('category');

  if (weekStartIdx === -1 || dayIdx === -1 || mealIdx === -1) {
    throw new Error('CSV must have columns: week_start, day, meal');
  }

  const rows: ParsedMealRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCSVLine(line);
    if (fields.length <= Math.max(weekStartIdx, dayIdx, mealIdx)) continue;

    const weekStartRaw = fields[weekStartIdx].trim();
    const dayRaw = fields[dayIdx].trim().toLowerCase();
    const mealName = fields[mealIdx].trim();
    const category = categoryIdx !== -1 && fields[categoryIdx]
      ? fields[categoryIdx].trim().toLowerCase()
      : 'main';

    if (!weekStartRaw || !dayRaw || !mealName) continue;

    const dayOfWeek = DAY_NAME_MAP[dayRaw];
    if (!dayOfWeek) continue;

    rows.push({
      weekStart: getSundayOfWeek(weekStartRaw),
      day: dayOfWeek,
      mealName,
      category,
    });
  }

  return rows;
}

export function CSVImportPreview({
  recipes,
  existingPlans,
  familyId,
  onImportComplete,
  onCancel,
}: CSVImportPreviewProps) {
  const [parseError, setParseError] = useState<string | null>(null);
  const [mappings, setMappings] = useState<Map<string, MealMapping>>(new Map());
  const [parsedRows, setParsedRows] = useState<ParsedMealRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [importStats, setImportStats] = useState<{
    weeks: number;
    meals: number;
    matched: number;
    custom: number;
  } | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError(null);

    try {
      const text = await file.text();
      const rows = parseCSVRows(text);

      if (rows.length === 0) {
        throw new Error('No valid meal rows found in CSV');
      }

      setParsedRows(rows);

      // Build unique meal name mappings with fuzzy matching
      const uniqueMeals = new Set(rows.map((r) => r.mealName));
      const nameToId = new Map<string, string>();
      for (const r of recipes) {
        nameToId.set(r.name.trim().toLowerCase(), r.id);
      }

      const newMappings = new Map<string, MealMapping>();
      for (const mealName of uniqueMeals) {
        const exactMatch = nameToId.get(mealName.toLowerCase());
        if (exactMatch) {
          const recipe = recipes.find((r) => r.id === exactMatch);
          newMappings.set(mealName, {
            csvName: mealName,
            status: 'exact',
            matchedRecipeId: exactMatch,
            matchedRecipeName: recipe?.name || mealName,
            fuzzySuggestions: [],
            userChoice: 'recipe',
            userSelectedRecipeId: exactMatch,
          });
        } else {
          const fuzzy = findFuzzyMatches(mealName, recipes);
          const bestFuzzy = fuzzy.length > 0 && fuzzy[0].score >= 0.5 ? fuzzy[0] : null;
          newMappings.set(mealName, {
            csvName: mealName,
            status: bestFuzzy ? 'fuzzy' : 'unmatched',
            matchedRecipeId: bestFuzzy?.id || null,
            matchedRecipeName: bestFuzzy?.name || null,
            fuzzySuggestions: fuzzy,
            userChoice: bestFuzzy ? 'recipe' : 'custom',
            userSelectedRecipeId: bestFuzzy?.id || null,
          });
        }
      }

      setMappings(newMappings);
      setStep('preview');
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse CSV');
    }

    e.target.value = '';
  };

  const updateMapping = (csvName: string, choice: string) => {
    setMappings((prev) => {
      const next = new Map(prev);
      const current = next.get(csvName);
      if (current) {
        if (choice === '__exclude__') {
          next.set(csvName, { ...current, userChoice: 'exclude', userSelectedRecipeId: null });
        } else if (choice === '__custom__') {
          next.set(csvName, { ...current, userChoice: 'custom', userSelectedRecipeId: null });
        } else {
          const recipe = recipes.find((r) => r.id === choice);
          next.set(csvName, {
            ...current,
            userChoice: 'recipe',
            userSelectedRecipeId: choice,
            matchedRecipeName: recipe?.name || null,
          });
        }
      }
      return next;
    });
  };

  const stats = useMemo(() => {
    let exact = 0;
    let fuzzy = 0;
    let custom = 0;
    let excluded = 0;
    mappings.forEach((m) => {
      if (m.userChoice === 'exclude') excluded++;
      else if (m.status === 'exact') exact++;
      else if (m.userChoice === 'recipe' && m.userSelectedRecipeId) fuzzy++;
      else custom++;
    });
    return { exact, fuzzy, custom, excluded, total: mappings.size };
  }, [mappings]);

  const handleImport = async () => {
    setImporting(true);
    setImportError(null);

    try {
      const existingByWeek = new Map<string, WeekPlan>();
      for (const p of existingPlans) {
        existingByWeek.set(p.weekStart, p);
      }

      const weekMeals = new Map<string, { day: DayOfWeek; mealValue: string; category: string }[]>();
      let matchedCount = 0;
      let customCount = 0;

      for (const row of parsedRows) {
        const mapping = mappings.get(row.mealName);

        // Skip excluded meals
        if (mapping && mapping.userChoice === 'exclude') continue;

        let mealValue: string;

        if (mapping && mapping.userChoice === 'recipe' && mapping.userSelectedRecipeId) {
          mealValue = mapping.userSelectedRecipeId;
          matchedCount++;
        } else {
          mealValue = CUSTOM_PREFIX + row.mealName;
          customCount++;
        }

        if (!weekMeals.has(row.weekStart)) {
          weekMeals.set(row.weekStart, []);
        }
        weekMeals.get(row.weekStart)!.push({ day: row.day, mealValue, category: row.category });
      }

      const plansToSave: WeekPlan[] = [];

      weekMeals.forEach((meals, sunday) => {
        const existing = existingByWeek.get(sunday);
        const plan: WeekPlan = existing
          ? { ...existing, days: { ...existing.days } }
          : {
              id: generateId(),
              weekStart: sunday,
              days: {
                sunday: {},
                monday: {},
                tuesday: {},
                wednesday: {},
                thursday: {},
                friday: {},
                saturday: {},
              },
            };

        for (const { day, mealValue, category } of meals) {
          const slot = (['main', 'vegetable', 'grain', 'other'].includes(category)
            ? category
            : 'main') as keyof DayMeal;
          plan.days[day] = { ...plan.days[day], [slot]: mealValue };
        }

        plansToSave.push(plan);
      });

      for (const plan of plansToSave) {
        await saveWeekPlan(familyId, plan);
      }

      setImportStats({
        weeks: plansToSave.length,
        meals: matchedCount + customCount,
        matched: matchedCount,
        custom: customCount,
      });
      setStep('done');
    } catch (err) {
      console.error('Import error:', err);
      setImportError(err instanceof Error ? err.message : 'Failed to import');
    } finally {
      setImporting(false);
    }
  };

  if (step === 'upload') {
    return (
      <div className="csv-import-overlay">
        <div className="csv-import-modal">
          <div className="csv-import-header">
            <h3>Import Meal History</h3>
            <button className="modal-close" onClick={onCancel}>&times;</button>
          </div>
          <div className="csv-import-body">
            <div className="csv-import-instructions">
              <p>Upload a CSV file with your meal history. Required columns:</p>
              <table className="csv-format-table">
                <thead>
                  <tr>
                    <th>week_start</th>
                    <th>day</th>
                    <th>meal</th>
                    <th>category <span className="optional-label">(optional)</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>2025-01-06</td>
                    <td>Monday</td>
                    <td>Chicken Tikka Masala</td>
                    <td>main</td>
                  </tr>
                  <tr>
                    <td>2025-01-06</td>
                    <td>Monday</td>
                    <td>Rice</td>
                    <td>grain</td>
                  </tr>
                  <tr>
                    <td>2025-01-06</td>
                    <td>Tuesday</td>
                    <td>Tacos</td>
                    <td>main</td>
                  </tr>
                </tbody>
              </table>
              <p className="csv-import-hint">
                Category can be: main, vegetable, grain, or other. Defaults to "main" if omitted.
              </p>
            </div>

            {parseError && (
              <div className="import-result import-error">{parseError}</div>
            )}

            <div className="csv-import-actions">
              <label className="btn btn-primary csv-file-label">
                Choose CSV File
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
              </label>
              <button className="btn btn-secondary" onClick={onCancel}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="csv-import-overlay">
        <div className="csv-import-modal">
          <div className="csv-import-header">
            <h3>Import Complete</h3>
            <button className="modal-close" onClick={() => { onImportComplete(); }}>&times;</button>
          </div>
          <div className="csv-import-body csv-import-done">
            <div className="import-done-stats">
              <div className="stat-card">
                <span className="stat-value">{importStats?.weeks}</span>
                <span className="stat-label">Weeks</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{importStats?.meals}</span>
                <span className="stat-label">Total Meals</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{importStats?.matched}</span>
                <span className="stat-label">Matched</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{importStats?.custom}</span>
                <span className="stat-label">Custom</span>
              </div>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => { onImportComplete(); }}
              style={{ marginTop: '1.5rem' }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Preview step
  const sortedMappings = Array.from(mappings.values()).sort((a, b) => {
    const order: Record<MatchStatus, number> = { unmatched: 0, fuzzy: 1, exact: 2 };
    return order[a.status] - order[b.status];
  });

  return (
    <div className="csv-import-overlay">
      <div className="csv-import-modal csv-import-preview-modal">
        <div className="csv-import-header">
          <h3>Review Meal Matches</h3>
          <button className="modal-close" onClick={onCancel}>&times;</button>
        </div>

        <div className="csv-import-summary">
          <span className="match-stat match-exact">{stats.exact} exact</span>
          <span className="match-stat match-fuzzy">{stats.fuzzy} fuzzy</span>
          <span className="match-stat match-unmatched">{stats.custom} unmatched</span>
          {stats.excluded > 0 && <span className="match-stat match-excluded">{stats.excluded} excluded</span>}
          <span className="match-stat match-total">{parsedRows.length} meals across {new Set(parsedRows.map(r => r.weekStart)).size} weeks</span>
        </div>

        <div className="csv-import-body csv-import-mappings">
          {sortedMappings.map((mapping) => (
            <div
              key={mapping.csvName}
              className={`mapping-row mapping-${mapping.userChoice === 'exclude' ? 'excluded' : mapping.status}`}
            >
              <div className="mapping-csv-name">
                <span className={`match-indicator match-indicator-${mapping.userChoice === 'exclude' ? 'excluded' : mapping.status}`}>
                  {mapping.userChoice === 'exclude' ? 'x' : mapping.status === 'exact' ? '~' : mapping.status === 'fuzzy' ? '?' : '!'}
                </span>
                <span className={`mapping-name${mapping.userChoice === 'exclude' ? ' mapping-name-excluded' : ''}`}>{mapping.csvName}</span>
                <span className="mapping-count">
                  ({parsedRows.filter((r) => r.mealName === mapping.csvName).length}x)
                </span>
              </div>

              <div className="mapping-action">
                {mapping.status === 'exact' && mapping.userChoice !== 'exclude' ? (
                  <div className="mapping-exact-row">
                    <span className="mapping-matched-to">
                      Matched to <strong>{mapping.matchedRecipeName}</strong>
                    </span>
                    <button
                      className="btn-exclude-small"
                      onClick={() => updateMapping(mapping.csvName, mapping.userChoice === 'exclude' ? mapping.matchedRecipeId || '__custom__' : '__exclude__')}
                      title="Exclude from import"
                    >
                      Exclude
                    </button>
                  </div>
                ) : mapping.status === 'exact' && mapping.userChoice === 'exclude' ? (
                  <button
                    className="btn-include-small"
                    onClick={() => updateMapping(mapping.csvName, mapping.matchedRecipeId || '__custom__')}
                  >
                    Include
                  </button>
                ) : (
                  <div className="mapping-select-group">
                    <select
                      value={
                        mapping.userChoice === 'exclude'
                          ? '__exclude__'
                          : mapping.userChoice === 'custom'
                            ? '__custom__'
                            : mapping.userSelectedRecipeId || '__custom__'
                      }
                      onChange={(e) => updateMapping(mapping.csvName, e.target.value)}
                    >
                      <option value="__custom__">Keep as custom meal</option>
                      <option value="__exclude__">Exclude from import</option>
                      {mapping.fuzzySuggestions.length > 0 && (
                        <optgroup label="Suggestions">
                          {mapping.fuzzySuggestions.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({Math.round(s.score * 100)}% match)
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="All recipes">
                        {recipes
                          .slice()
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                      </optgroup>
                    </select>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {importError && (
          <div className="import-result import-error" style={{ margin: '0 1.5rem 1rem' }}>
            {importError}
          </div>
        )}

        <div className="csv-import-footer">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleImport}
            disabled={importing}
          >
            {importing ? 'Importing...' : `Import ${parsedRows.length - parsedRows.filter(r => mappings.get(r.mealName)?.userChoice === 'exclude').length} Meals`}
          </button>
        </div>
      </div>
    </div>
  );
}
