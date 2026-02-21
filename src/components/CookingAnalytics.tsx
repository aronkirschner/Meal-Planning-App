import { useState, useEffect, useMemo } from 'react';
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
}

function getWeeksAgoDate(weeks: number): string {
  const d = new Date();
  d.setDate(d.getDate() - weeks * 7);
  return d.toISOString().split('T')[0];
}

function countRecipesInPlans(
  plans: WeekPlan[]
): Map<string, { count: number; lastPlanned: string }> {
  const counts = new Map<string, { count: number; lastPlanned: string }>();

  for (const plan of plans) {
    const days = plan.days;
    for (const dayMeals of Object.values(days)) {
      const meal = dayMeals as DayMeal;
      for (const key of ['main', 'vegetable', 'grain', 'other'] as const) {
        const value = meal[key];
        if (value && !value.startsWith(CUSTOM_PREFIX)) {
          const existing = counts.get(value);
          if (existing) {
            existing.count++;
            if (plan.weekStart > existing.lastPlanned) {
              existing.lastPlanned = plan.weekStart;
            }
          } else {
            counts.set(value, { count: 1, lastPlanned: plan.weekStart });
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
    const DAY_LABELS: Record<DayOfWeek, string> = {
      sunday: 'Sunday',
      monday: 'Monday',
      tuesday: 'Tuesday',
      wednesday: 'Wednesday',
      thursday: 'Thursday',
      friday: 'Friday',
      saturday: 'Saturday',
    };
    const SLOTS = ['main', 'vegetable', 'grain', 'other'] as const;

    const rows: string[] = ['week_start,day,meal,category'];

    const sortedPlans = [...weekPlans].sort((a, b) => a.weekStart.localeCompare(b.weekStart));

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
    link.download = `meal-history-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredPlans = useMemo(() => {
    if (timeFilter === 'all') return weekPlans;

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

    return weekPlans.filter((p) => p.weekStart >= cutoff);
  }, [weekPlans, timeFilter]);

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
                  {rankedByCategory[category].map((item, index) => (
                    <tr key={item.recipe.id}>
                      <td className="rank-cell">{index + 1}</td>
                      <td>{item.recipe.name}</td>
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
                  ))}
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
