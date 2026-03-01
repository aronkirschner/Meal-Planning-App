import { useState } from 'react';
import readXlsxFile from 'read-excel-file/browser';
import type { Recipe, RecipeCategory, CuisineType, ProteinType } from '../types';
import { CUISINE_TYPES, PROTEIN_TYPES } from '../types';
import { generateId } from '../firestore-storage';

interface XLSRecipeImportProps {
  existingRecipes: Recipe[];
  onImport: (recipes: Recipe[]) => Promise<void>;
  onClose: () => void;
}

interface ParsedRow {
  name: string;
  category: RecipeCategory;
  cuisineType: CuisineType;
  proteinType: ProteinType | undefined;
  // warnings for values that couldn't be cleanly mapped
  warnings: string[];
  // whether a recipe with this name already exists
  duplicate: boolean;
}

const CATEGORY_MAP: Record<string, RecipeCategory> = {
  main: 'main',
  'main dish': 'main',
  'main course': 'main',
  mains: 'main',
  entree: 'main',
  entrée: 'main',
  dinner: 'main',
  vegetable: 'vegetable',
  vegetables: 'vegetable',
  veg: 'vegetable',
  veggie: 'vegetable',
  veggies: 'vegetable',
  side: 'vegetable',
  'side dish': 'vegetable',
  salad: 'vegetable',
  grain: 'grain',
  grains: 'grain',
  starch: 'grain',
  rice: 'grain',
  bread: 'grain',
  pasta: 'grain',
  other: 'other',
  snack: 'other',
  dessert: 'other',
  drink: 'other',
  soup: 'other',
  beverage: 'other',
};

const CATEGORY_LABELS: Record<RecipeCategory, string> = {
  main: 'Main',
  vegetable: 'Vegetable',
  grain: 'Grain',
  other: 'Other',
};

function normalizeCategory(raw: string): { category: RecipeCategory; warn: boolean } {
  const key = raw.trim().toLowerCase();
  const mapped = CATEGORY_MAP[key];
  if (mapped) return { category: mapped, warn: false };
  return { category: 'other', warn: true };
}

function normalizeCuisine(raw: string): { cuisine: CuisineType; warn: boolean } {
  const key = raw.trim().toLowerCase();
  const match = CUISINE_TYPES.find((c) => c.toLowerCase() === key);
  if (match) return { cuisine: match, warn: false };
  return { cuisine: 'Other', warn: !!raw.trim() };
}

function normalizeProtein(raw: string, category: RecipeCategory): { protein: ProteinType | undefined; warn: boolean } {
  if (category !== 'main') return { protein: undefined, warn: false };
  if (!raw.trim()) return { protein: undefined, warn: false };
  const key = raw.trim().toLowerCase();
  const match = PROTEIN_TYPES.find((p) => p.toLowerCase() === key);
  if (match) return { protein: match, warn: false };
  return { protein: undefined, warn: true };
}

async function parseFile(file: File, existingNames: Set<string>): Promise<ParsedRow[]> {
  const rows = await readXlsxFile(file);
  if (rows.length < 2) throw new Error('File must have a header row and at least one data row');

  // Case-insensitive header matching
  const headers = rows[0].map((h) => String(h ?? '').trim().toLowerCase());
  const col = (name: string) => headers.indexOf(name.toLowerCase());

  const foodItemIdx = col('food item');
  const itemTypeIdx = col('item type');
  const cuisineIdx = col('cuisine');
  const proteinIdx = col('protein type');

  if (foodItemIdx === -1) throw new Error('Missing required column: "Food Item"');

  const results: ParsedRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const get = (idx: number) => (idx !== -1 ? String(row[idx] ?? '').trim() : '');

    const name = get(foodItemIdx);
    if (!name) continue;

    const itemTypeRaw = get(itemTypeIdx);
    const cuisineRaw = get(cuisineIdx);
    const proteinRaw = get(proteinIdx);

    const warnings: string[] = [];

    const { category, warn: categoryWarn } = normalizeCategory(itemTypeRaw);
    if (categoryWarn) warnings.push(`Unknown item type "${itemTypeRaw}" — defaulting to Other`);

    const { cuisine, warn: cuisineWarn } = normalizeCuisine(cuisineRaw);
    if (cuisineWarn) warnings.push(`Unknown cuisine "${cuisineRaw}" — defaulting to Other`);

    const { protein, warn: proteinWarn } = normalizeProtein(proteinRaw, category);
    if (proteinWarn) warnings.push(`Unknown protein type "${proteinRaw}" — skipping`);

    results.push({
      name,
      category,
      cuisineType: cuisine,
      proteinType: protein,
      warnings,
      duplicate: existingNames.has(name.toLowerCase()),
    });
  }

  return results;
}

export function XLSRecipeImport({ existingRecipes, onImport, onClose }: XLSRecipeImportProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [parseError, setParseError] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);

  const existingNames = new Set(existingRecipes.map((r) => r.name.toLowerCase()));

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);

    try {
      const parsed = await parseFile(file, existingNames);
      if (parsed.length === 0) throw new Error('No valid rows found. Make sure the file has a "Food Item" column.');
      setRows(parsed);
      setStep('preview');
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse file');
    }

    e.target.value = '';
  };

  const handleImport = async () => {
    setStep('importing');
    setImportError(null);

    const toCreate = rows
      .filter((r) => !r.duplicate)
      .map<Recipe>((r) => ({
        id: generateId(),
        name: r.name,
        url: '',
        category: r.category,
        cuisineType: r.cuisineType,
        proteinType: r.proteinType,
        ingredients: [],
        directions: [],
        createdAt: new Date().toISOString(),
      }));

    try {
      await onImport(toCreate);
      setImportedCount(toCreate.length);
      setStep('done');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
      setStep('preview');
    }
  };

  const newCount = rows.filter((r) => !r.duplicate).length;
  const skipCount = rows.filter((r) => r.duplicate).length;
  const warnCount = rows.filter((r) => r.warnings.length > 0).length;

  if (step === 'upload') {
    return (
      <div className="csv-import-overlay">
        <div className="csv-import-modal">
          <div className="csv-import-header">
            <h3>Import Recipes from XLS</h3>
            <button className="modal-close" onClick={onClose}>&times;</button>
          </div>
          <div className="csv-import-body">
            <div className="csv-import-instructions">
              <p>Upload an XLS or XLSX file with the following columns:</p>
              <table className="csv-format-table">
                <thead>
                  <tr>
                    <th>Food Item</th>
                    <th>Item Type</th>
                    <th>Cuisine</th>
                    <th>Protein Type</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Chicken Tikka Masala</td>
                    <td>Main</td>
                    <td>Indian</td>
                    <td>Chicken</td>
                  </tr>
                  <tr>
                    <td>Roasted Broccoli</td>
                    <td>Vegetable</td>
                    <td>Other</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td>Jasmine Rice</td>
                    <td>Grain</td>
                    <td>Asian</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
              <p className="csv-import-hint">
                Item Type can be: Main, Vegetable, Grain, or Other.<br />
                Cuisine and Protein Type are optional. Protein Type is only used for mains.
              </p>
            </div>

            {parseError && <div className="import-result import-error">{parseError}</div>}

            <div className="csv-import-actions">
              <label className="btn btn-primary csv-file-label">
                Choose XLS / XLSX File
                <input
                  type="file"
                  accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
              </label>
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
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
            <button className="modal-close" onClick={onClose}>&times;</button>
          </div>
          <div className="csv-import-body csv-import-done">
            <div className="import-done-stats">
              <div className="stat-card">
                <span className="stat-value">{importedCount}</span>
                <span className="stat-label">Recipes Added</span>
              </div>
              {skipCount > 0 && (
                <div className="stat-card">
                  <span className="stat-value">{skipCount}</span>
                  <span className="stat-label">Skipped (duplicates)</span>
                </div>
              )}
            </div>
            <button className="btn btn-primary" onClick={onClose} style={{ marginTop: '1.5rem' }}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Preview step (also used when importing fails)
  return (
    <div className="csv-import-overlay">
      <div className="csv-import-modal xls-import-preview-modal">
        <div className="csv-import-header">
          <h3>Review Recipes</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="csv-import-summary">
          <span className="match-stat match-exact">{newCount} to import</span>
          {skipCount > 0 && (
            <span className="match-stat match-excluded">{skipCount} duplicate{skipCount !== 1 ? 's' : ''} (will skip)</span>
          )}
          {warnCount > 0 && (
            <span className="match-stat match-unmatched">{warnCount} with warnings</span>
          )}
        </div>

        <div className="csv-import-body xls-preview-table-wrapper">
          <table className="xls-preview-table">
            <thead>
              <tr>
                <th>Food Item</th>
                <th>Category</th>
                <th>Cuisine</th>
                <th>Protein</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className={
                    row.duplicate
                      ? 'xls-row-duplicate'
                      : row.warnings.length > 0
                      ? 'xls-row-warn'
                      : ''
                  }
                >
                  <td className="xls-cell-name">{row.name}</td>
                  <td>{CATEGORY_LABELS[row.category]}</td>
                  <td>{row.cuisineType}</td>
                  <td>{row.proteinType ?? (row.category === 'main' ? '—' : '')}</td>
                  <td className="xls-cell-status">
                    {row.duplicate ? (
                      <span className="xls-badge xls-badge-skip">skip</span>
                    ) : row.warnings.length > 0 ? (
                      <span className="xls-badge xls-badge-warn" title={row.warnings.join('\n')}>
                        warn
                      </span>
                    ) : (
                      <span className="xls-badge xls-badge-new">new</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {importError && (
          <div className="import-result import-error" style={{ margin: '0 1.5rem 1rem' }}>
            {importError}
          </div>
        )}

        <div className="csv-import-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleImport}
            disabled={newCount === 0 || step === 'importing'}
          >
            {step === 'importing' ? 'Importing…' : `Import ${newCount} Recipe${newCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
