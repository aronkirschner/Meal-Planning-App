import { useMemo, useState, useCallback } from 'react';
import type { Recipe, WeekPlan } from '../types';
import { DAYS_OF_WEEK } from '../types';

interface ShoppingListProps {
  recipes: Recipe[];
  weekPlan: WeekPlan | null;
  onLoadWeekPlan?: (weekStart: string) => Promise<WeekPlan | undefined>;
}

interface AggregatedIngredient {
  name: string;
  amounts: string[];
}

const CUSTOM_PREFIX = 'custom:';

function getSunday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ShoppingList({ recipes, weekPlan, onLoadWeekPlan }: ShoppingListProps) {
  const [copied, setCopied] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => getSunday(new Date()));
  const [displayedPlan, setDisplayedPlan] = useState<WeekPlan | null>(weekPlan);
  const [loadingWeek, setLoadingWeek] = useState(false);

  // Keep displayedPlan in sync when weekPlan prop changes (initial load)
  const currentWeekString = formatDate(getSunday(new Date()));
  if (weekPlan && !displayedPlan && formatDate(currentWeekStart) === currentWeekString) {
    setDisplayedPlan(weekPlan);
  }

  const navigateToWeek = useCallback(async (date: Date) => {
    setCurrentWeekStart(date);
    const weekStart = formatDate(date);

    // If navigating to current week, use the prop
    if (weekStart === currentWeekString && weekPlan) {
      setDisplayedPlan(weekPlan);
      return;
    }

    if (onLoadWeekPlan) {
      setLoadingWeek(true);
      try {
        const loaded = await onLoadWeekPlan(weekStart);
        setDisplayedPlan(loaded || null);
      } catch (err) {
        console.error('Failed to load week plan:', err);
        setDisplayedPlan(null);
      } finally {
        setLoadingWeek(false);
      }
    } else {
      setDisplayedPlan(null);
    }
  }, [onLoadWeekPlan, weekPlan, currentWeekString]);

  const handlePrevWeek = () => navigateToWeek(addDays(currentWeekStart, -7));
  const handleNextWeek = () => navigateToWeek(addDays(currentWeekStart, 7));
  const handleCurrentWeek = () => navigateToWeek(getSunday(new Date()));

  const activePlan = displayedPlan;

  const recipeMap = useMemo(() => {
    const map = new Map<string, Recipe>();
    recipes.forEach((r) => map.set(r.id, r));
    return map;
  }, [recipes]);

  const { ingredients, usedRecipes, customItems } = useMemo(() => {
    if (!activePlan) {
      return { ingredients: [], usedRecipes: [], customItems: [] };
    }

    const ingredientMap = new Map<string, AggregatedIngredient>();
    const usedRecipeIds = new Set<string>();
    const customItemsSet = new Set<string>();

    DAYS_OF_WEEK.forEach((day) => {
      const dayMeals = activePlan.days[day];
      const mealTypes: (keyof typeof dayMeals)[] = ['main', 'vegetable', 'grain', 'other'];

      mealTypes.forEach((mealType) => {
        const value = dayMeals[mealType];
        if (value) {
          if (value.startsWith(CUSTOM_PREFIX)) {
            const customText = value.slice(CUSTOM_PREFIX.length).trim();
            if (customText) {
              customItemsSet.add(customText);
            }
          } else {
            usedRecipeIds.add(value);
            const recipe = recipeMap.get(value);
            if (recipe) {
              recipe.ingredients.forEach((ing) => {
                const key = ing.name.toLowerCase().trim();
                const amountStr = `${ing.amount} ${ing.unit}`.trim();

                if (ingredientMap.has(key)) {
                  const existing = ingredientMap.get(key)!;
                  if (amountStr && !existing.amounts.includes(amountStr)) {
                    existing.amounts.push(amountStr);
                  }
                } else {
                  ingredientMap.set(key, {
                    name: ing.name,
                    amounts: amountStr ? [amountStr] : [],
                  });
                }
              });
            }
          }
        }
      });
    });

    const sortedIngredients = Array.from(ingredientMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    const usedRecipesList = Array.from(usedRecipeIds)
      .map((id) => recipeMap.get(id))
      .filter((r): r is Recipe => r !== undefined)
      .sort((a, b) => a.name.localeCompare(b.name));

    const customItemsList = Array.from(customItemsSet).sort();

    return { ingredients: sortedIngredients, usedRecipes: usedRecipesList, customItems: customItemsList };
  }, [activePlan, recipeMap]);

  const formatForTodoist = (): string => {
    const lines: string[] = [];

    ingredients.forEach((ing) => {
      if (ing.amounts.length > 0) {
        lines.push(`- ${ing.name} (${ing.amounts.join(' + ')})`);
      } else {
        lines.push(`- ${ing.name}`);
      }
    });

    return lines.join('\n');
  };

  const handleCopy = async () => {
    const text = formatForTodoist();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const weekEnd = addDays(currentWeekStart, 6);
  const isCurrentWeek = formatDate(currentWeekStart) === currentWeekString;

  const weekNav = (
    <div className="week-navigation">
      <button onClick={handlePrevWeek} className="btn-secondary">
        &larr; Previous Week
      </button>
      <div className="week-display">
        <span className="week-dates">
          {formatDisplayDate(currentWeekStart)} -{' '}
          {formatDisplayDate(weekEnd)}
        </span>
        {!isCurrentWeek && (
          <button onClick={handleCurrentWeek} className="btn-link">
            Go to Current Week
          </button>
        )}
      </div>
      <button onClick={handleNextWeek} className="btn-secondary">
        Next Week &rarr;
      </button>
    </div>
  );

  if (loadingWeek) {
    return (
      <div className="shopping-list">
        <h3>Shopping List</h3>
        {weekNav}
        <p className="no-plan">Loading week plan...</p>
      </div>
    );
  }

  if (!activePlan) {
    return (
      <div className="shopping-list">
        <h3>Shopping List</h3>
        {weekNav}
        <p className="no-plan">
          No week plan saved for this week. Create and save a week plan to generate a
          shopping list.
        </p>
      </div>
    );
  }

  const hasContent = ingredients.length > 0 || usedRecipes.length > 0 || customItems.length > 0;

  if (!hasContent) {
    return (
      <div className="shopping-list">
        <h3>Shopping List</h3>
        {weekNav}
        <p className="no-plan">
          No meals selected for this week. Select some meals in the week planner
          to generate a shopping list.
        </p>
      </div>
    );
  }

  return (
    <div className="shopping-list">
      <h3>Shopping List</h3>
      {weekNav}

      {(usedRecipes.length > 0 || customItems.length > 0) && (
        <div className="recipes-used">
          <h4>Meals for this week:</h4>
          <ul>
            {usedRecipes.map((recipe) => (
              <li key={recipe.id}>
                <a href={recipe.url} target="_blank" rel="noopener noreferrer">
                  {recipe.name}
                </a>
              </li>
            ))}
            {customItems.map((item, index) => (
              <li key={`custom-${index}`} className="custom-item">
                {item} <span className="custom-badge">(custom)</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ingredients.length > 0 && (
        <>
          <div className="ingredients-section">
            <h4>Ingredients:</h4>
            <ul className="ingredient-list">
              {ingredients.map((ing, index) => (
                <li key={index}>
                  <strong>{ing.name}</strong>
                  {ing.amounts.length > 0 && (
                    <span className="amounts"> ({ing.amounts.join(' + ')})</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="todoist-section">
            <h4>Copy for Todoist:</h4>
            <div className="todoist-preview">
              <pre>{formatForTodoist()}</pre>
            </div>
            <button onClick={handleCopy} className="btn-primary">
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
