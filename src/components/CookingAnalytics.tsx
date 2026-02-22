import React, { useState, useEffect, useMemo } from 'react';
import type { Recipe, WeekPlan, RecipeCategory, DayMeal, DayOfWeek } from '../types';
import { getWeekPlans } from '../firestore-storage';
import { CSVImportPreview } from './CSVImportPreview';
import { DAYS_OF_WEEK } from '../types';

interface CookingAnalyticsProps {
  recipes: Recipe[];
  familyId: string;
}

type TimeFilter = 'all' | '4weeks' | '3months' | '6months';

const CUSTOM_PREFIX = 'custom:';

const CATEGORY_LABELS: Record<RecipeCategory, string> = {
  main: 'Main Dishes',
  vegetable: 'Vegetables',
  grain: 'Grains',
  other: 'Other',
};

interface RecipeCount {
  recipe: Recipe;
  count: number;
  lastPlanned: string | null;
  dates: { weekStart: string; day: DayOfWeek; slot: string }[];
}

const DAY_LABELS: Record<DayOfWeek, string> = {
  sunday: 'Sunday',
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
};

const DAY_OFFSETS: Record<DayOfWeek, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

function getWeeksAgoDate(weeks: number): string {
  const d = new Date();
  d.setDate(d.getDate() - weeks * 7);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Deduplicate week plans — keep only one per weekStart (prefer the one with the most meals filled in)
function deduplicatePlans(plans: WeekPlan[]): WeekPlan[] {
  const byWeek = new Map<string, WeekPlan>();
  for (const plan of plans) {
    const existing = byWeek.get(plan.weekStart);
    if (!existing) {
      byWeek.set(plan.weekStart, plan);
    } else {
      // Keep the plan with more meals filled in
      const countMeals = (p: WeekPlan) => {
        let n = 0;
        for (const day of Object.values(p.days)) {
          const m = day as DayMeal;
          if (m.main) n++;
          if (m.vegetable) n++;
          if (m.grain) n++;
          if (m.other) n++;
        }
        return n;
      };
      if (countMeals(plan) > countMeals(existing)) {
        byWeek.set(plan.weekStart, plan);
      }
    }
  }
  return Array.from(byWeek.values());
}

function countRecipesInPlans(
  plans: WeekPlan[]
): Map<string, { count: number; lastPlanned: string; dates: { weekStart: string; day: DayOfWeek; slot: string }[] }> {
  const dedupedPlans = deduplicatePlans(plans);
  const counts = new Map<string, { count: number; lastPlanned: string; dates: { weekStart: string; day: DayOfWeek; slot: string }[] }>();

  for (const plan of dedupedPlans) {
    // Track which recipes we've already counted for each day in this plan
    // so we don't double-count a recipe that appears in multiple slots on the same day
    const dayCounted = new Map<string, Set<string>>(); // day -> Set of recipeIds already counted

    for (const dayKey of DAYS_OF_WEEK) {
      const meal = plan.days[dayKey] as DayMeal;
      for (const slot of ['main', 'vegetable', 'grain', 'other'] as const) {
        const value = meal[slot];
        if (value && !value.startsWith(CUSTOM_PREFIX)) {
          const daySet = dayCounted.get(dayKey) || new Set();
          if (daySet.has(value)) continue; // already counted this recipe for this day
          daySet.add(value);
          dayCounted.set(dayKey, daySet);

          const existing = counts.get(value);
          const entry = { weekStart: plan.weekStart, day: dayKey, slot };
          if (existing) {
            existing.count++;
            existing.dates.push(entry);
            if (plan.weekStart > existing.lastPlanned) {
              existing.lastPlanned = plan.weekStart;
            }
          } else {
            counts.set(value, { count: 1, lastPlanned: plan.weekStart, dates: [entry] });
          }
        }
      }
    }
  }

  return counts;
}

export function CookingAnalytics({ recipes, familyId }: CookingAnalyticsProps) {
  const [weekPlans, setWeekPlans] = useState<WeekPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [showImport, setShowImport] = useState(false);
  const [expandedRecipeId, setExpandedRecipeId] = useState<string | null>(null);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const plans = await getWeekPlans(familyId);
      setWeekPlans(plans);
    } catch (err) {
      console.error('Error loading week plans:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, [familyId]);

  const handleImportComplete = async () => {
    setShowImport(false);
    await loadPlans();
  };

  const handleExportCSV = () => {
    const recipeMap = new Map(recipes.map((r) => [r.id, r]));
    const SLOTS = ['main', 'vegetable', 'grain', 'other'] as const;

    const rows: string[] = ['week_start,day,meal,category'];

    const sortedPlans = [...dedupedPlans].sort((a, b) => a.weekStart.localeCompare(b.weekStart));

    for (const plan of sortedPlans) {
      for (const day of DAYS_OF_WEEK) {
        const dayMeal = plan.days[day] as DayMeal;
        for (const slot of SLOTS) {
          const value = dayMeal[slot];
          if (!value) continue;

          let mealName: string;
          if (value.startsWith(CUSTOM_PREFIX)) {
            mealName = value.slice(CUSTOM_PREFIX.length);
          } else {
            const recipe = recipeMap.get(value);
            mealName = recipe ? recipe.name : value;
          }

          // Escape commas and quotes in meal name
          const escapedName = mealName.includes(',') || mealName.includes('"')
            ? `"${mealName.replace(/"/g, '""')}"`
            : mealName;

          rows.push(`${plan.weekStart},${DAY_LABELS[day]},${escapedName},${slot}`);
        }
      }
    }

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    link.download = `meal-history-${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const dedupedPlans = useMemo(() => deduplicatePlans(weekPlans), [weekPlans]);

  const filteredPlans = useMemo(() => {
    if (timeFilter === 'all') return dedupedPlans;

    let cutoff: string;
    switch (timeFilter) {
      case '4weeks':
        cutoff = getWeeksAgoDate(4);
        break;
      case '3months':
        cutoff = getWeeksAgoDate(13);
        break;
      case '6months':
        cutoff = getWeeksAgoDate(26);
        break;
    }

    return dedupedPlans.filter((p) => p.weekStart >= cutoff);
  }, [dedupedPlans, timeFilter]);

const recipeCounts = useMemo(
  () => countRecipesInPlans(filteredPlans),
  [filteredPlans]
);

  const rankedRecipes = useMemo((): RecipeCount[] => {
    const recipeMap = new Map(recipes.map((r) => [r.id, r]));
    const ranked: RecipeCount[] = [];

    recipeCounts.forEach((data, recipeId) => {
      const recipe = recipeMap.get(recipeId);
      if (recipe) {
        ranked.push({
          recipe,
          count: data.count,
          lastPlanned: data.lastPlanned,
          dates: data.dates.sort((a, b) => b.weekStart.localeCompare(a.weekStart)),
        });
      }
    });

    return ranked.sort((a, b) => b.count - a.count);
  }, [recipeCounts, recipes]);

  const rankedByCategory = useMemo(() => {
    const grouped: Record<RecipeCategory, RecipeCount[]> = {
      main: [],
      vegetable: [],
      grain: [],
      other: [],
    };

    for (const item of rankedRecipes) {
      grouped[item.recipe.category].push(item);
    }

    return grouped;
  }, [rankedRecipes]);

  const neverCooked = useMemo(
    () => recipes.filter((r) => !recipeCounts.has(r.id)),
    [recipes, recipeCounts]
  );

  const totalMealsPlanned = useMemo(
    () => Array.from(recipeCounts.values()).reduce((sum, d) => sum + d.count, 0),
    [recipeCounts]
  );

  if (loading) {
    return <div className="loading">Loading cooking analytics...</div>;
  }

  return (
    <div className="cooking-analytics">
      {showImport && (
        <CSVImportPreview
          recipes={recipes}
          existingPlans={weekPlans}
          familyId={familyId}
          onImportComplete={handleImportComplete}
          onCancel={() => setShowImport(false)}
        />
      )}

      <div className="import-section">
        <button
          className="btn btn-secondary import-btn"
          onClick={() => setShowImport(true)}
        >
          Import Meal History (CSV)
        </button>
        <button
          className="btn btn-secondary import-btn"
          onClick={handleExportCSV}
          disabled={weekPlans.length === 0}
        >
          Export Meal History (CSV)
        </button>
        <span className="import-hint">
          Import or export meal plans as CSV
        </span>
      </div>

      <div className="analytics-filter">
        <label>Time range:</label>
        <select
          value={timeFilter}
          onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
        >
          <option value="all">All Time</option>
          <option value="4weeks">Last 4 Weeks</option>
          <option value="3months">Last 3 Months</option>
          <option value="6months">Last 6 Months</option>
        </select>
      </div>

      <div className="analytics-summary">
        <div className="stat-card">
          <span className="stat-value">{filteredPlans.length}</span>
          <span className="stat-label">Weeks Planned</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{totalMealsPlanned}</span>
          <span className="stat-label">Total Meals</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{recipeCounts.size}</span>
          <span className="stat-label">Unique Recipes Used</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{neverCooked.length}</span>
          <span className="stat-label">Never Planned</span>
        </div>
      </div>

      {(['main', 'vegetable', 'grain', 'other'] as RecipeCategory[]).map(
        (category) =>
          rankedByCategory[category].length > 0 ? (
            <div key={category} className="analytics-category">
              <h3>{CATEGORY_LABELS[category]}</h3>
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Recipe</th>
                    <th>Times Planned</th>
                    <th>Last Planned</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedByCategory[category].map((item, index) => {
                    const isExpanded = expandedRecipeId === item.recipe.id;
                    return (
                      <React.Fragment key={item.recipe.id}>
                        <tr
                          className="analytics-row-clickable"
                          onClick={() => setExpandedRecipeId(isExpanded ? null : item.recipe.id)}
                        >
                          <td className="rank-cell">{index + 1}</td>
                          <td>
                            <span className="recipe-name-expand">
                              {item.recipe.name}
                              <span className="expand-arrow">{isExpanded ? '\u25B2' : '\u25BC'}</span>
                            </span>
                          </td>
                          <td className="count-cell">
                            <span className="count-bar-container">
                              <span
                                className="count-bar"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    (item.count /
                                      rankedByCategory[category][0].count) *
                                      100
                                  )}%`,
                                }}
                              />
                              <span className="count-number">{item.count}</span>
                            </span>
                          </td>
                          <td className="date-cell">
                            {item.lastPlanned
                              ? new Date(
                                  item.lastPlanned + 'T00:00:00'
                                ).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : '-'}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="analytics-detail-row">
                            <td colSpan={4}>
                              <div className="recipe-date-list">
                                {item.dates.map((d, i) => {
                                  const [y, mo, da] = d.weekStart.split('-').map(Number);
                                  const baseDate = new Date(y, mo - 1, da);
                                  baseDate.setDate(baseDate.getDate() + DAY_OFFSETS[d.day]);
                                  const dateLabel = baseDate.toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  });
                                  return (
                                    <span key={i} className="recipe-date-chip">
                                      {dateLabel}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null
      )}

      {neverCooked.length > 0 && (
        <div className="analytics-category">
          <h3>Never Planned</h3>
          <p className="analytics-hint">
            These recipes are in your collection but haven't been planned yet.
          </p>
          <div className="never-cooked-list">
            {neverCooked.map((recipe) => (
              <span key={recipe.id} className="never-cooked-chip">
                {recipe.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
