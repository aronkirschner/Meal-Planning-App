import { useMemo, useState } from 'react';
import type { Recipe, WeekPlan } from '../types';
import { DAYS_OF_WEEK } from '../types';

interface ShoppingListProps {
  recipes: Recipe[];
  weekPlan: WeekPlan | null;
}

interface AggregatedIngredient {
  name: string;
  amounts: string[];
}

export function ShoppingList({ recipes, weekPlan }: ShoppingListProps) {
  const [copied, setCopied] = useState(false);

  const recipeMap = useMemo(() => {
    const map = new Map<string, Recipe>();
    recipes.forEach((r) => map.set(r.id, r));
    return map;
  }, [recipes]);

  const { ingredients, usedRecipes } = useMemo(() => {
    if (!weekPlan) {
      return { ingredients: [], usedRecipes: [] };
    }

    const ingredientMap = new Map<string, AggregatedIngredient>();
    const usedRecipeIds = new Set<string>();

    DAYS_OF_WEEK.forEach((day) => {
      const dayMeals = weekPlan.days[day];
      const mealTypes: (keyof typeof dayMeals)[] = ['main', 'vegetable', 'grain'];

      mealTypes.forEach((mealType) => {
        const recipeId = dayMeals[mealType];
        if (recipeId) {
          usedRecipeIds.add(recipeId);
          const recipe = recipeMap.get(recipeId);
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
      });
    });

    const sortedIngredients = Array.from(ingredientMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    const usedRecipesList = Array.from(usedRecipeIds)
      .map((id) => recipeMap.get(id))
      .filter((r): r is Recipe => r !== undefined)
      .sort((a, b) => a.name.localeCompare(b.name));

    return { ingredients: sortedIngredients, usedRecipes: usedRecipesList };
  }, [weekPlan, recipeMap]);

  const formatForTodoist = (): string => {
    if (ingredients.length === 0) {
      return '';
    }

    const lines = ingredients.map((ing) => {
      if (ing.amounts.length > 0) {
        return `- ${ing.name} (${ing.amounts.join(' + ')})`;
      }
      return `- ${ing.name}`;
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

  if (!weekPlan) {
    return (
      <div className="shopping-list">
        <h3>Shopping List</h3>
        <p className="no-plan">
          No week plan saved yet. Create and save a week plan to generate a
          shopping list.
        </p>
      </div>
    );
  }

  if (ingredients.length === 0) {
    return (
      <div className="shopping-list">
        <h3>Shopping List</h3>
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

      <div className="recipes-used">
        <h4>Recipes for this week:</h4>
        <ul>
          {usedRecipes.map((recipe) => (
            <li key={recipe.id}>
              <a href={recipe.url} target="_blank" rel="noopener noreferrer">
                {recipe.name}
              </a>
            </li>
          ))}
        </ul>
      </div>

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
    </div>
  );
}
