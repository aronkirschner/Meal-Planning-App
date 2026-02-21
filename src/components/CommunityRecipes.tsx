import { useState, useEffect, useMemo } from 'react';
import type { Recipe, RecipeCategory, DayMeal } from '../types';
import {
  getCommunityRecipes,
  getCommunityWeekPlans,
  getFamily,
  addRecipe,
  generateId,
} from '../firestore-storage';

interface CommunityRecipesProps {
  familyId: string;
  onRecipeAdded: () => void;
}

interface CommunityRecipe {
  recipe: Recipe;
  familyName: string;
}

interface PopularRecipe {
  recipe: Recipe;
  count: number;
  familyName: string;
}

const CATEGORY_LABELS: Record<RecipeCategory, string> = {
  main: 'Main Dishes',
  vegetable: 'Vegetables',
  grain: 'Grains',
  other: 'Other',
};

export function CommunityRecipes({
  familyId,
  onRecipeAdded,
}: CommunityRecipesProps) {
  const [recipes, setRecipes] = useState<CommunityRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<
    RecipeCategory | 'all'
  >('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [popularRecipes, setPopularRecipes] = useState<PopularRecipe[]>([]);

  useEffect(() => {
    loadCommunityRecipes();
  }, [familyId]);

  const loadCommunityRecipes = async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await getCommunityRecipes(familyId);

      // Get unique family IDs and fetch family names
      const familyIds = [...new Set(results.map((r) => r.familyId))];
      const familyNames: Record<string, string> = {};
      await Promise.all(
        familyIds.map(async (fid) => {
          const family = await getFamily(fid);
          familyNames[fid] = family?.name || 'Unknown Family';
        })
      );

      const communityRecipes = results.map((r) => ({
        recipe: r.recipe,
        familyName: familyNames[r.familyId],
      }));

      setRecipes(communityRecipes);

      // Build popular meals from community week plans
      try {
        const communityPlans = await getCommunityWeekPlans();
        const otherFamilyPlans = communityPlans.filter(
          (p) => p.familyId !== familyId
        );

        // Count recipe usage across all community week plans
        const recipeCountMap = new Map<string, number>();
        for (const { plan } of otherFamilyPlans) {
          for (const dayMeals of Object.values(plan.days)) {
            const meal = dayMeals as DayMeal;
            for (const key of ['main', 'vegetable', 'grain', 'other'] as const) {
              const value = meal[key];
              if (value && !value.startsWith('custom:')) {
                recipeCountMap.set(value, (recipeCountMap.get(value) || 0) + 1);
              }
            }
          }
        }

        // Map recipe IDs to recipe objects with counts
        const recipeById = new Map(
          communityRecipes.map((cr) => [cr.recipe.id, cr])
        );
        const popular: PopularRecipe[] = [];
        recipeCountMap.forEach((count, recipeId) => {
          const cr = recipeById.get(recipeId);
          if (cr) {
            popular.push({
              recipe: cr.recipe,
              count,
              familyName: cr.familyName,
            });
          }
        });

        popular.sort((a, b) => b.count - a.count);
        setPopularRecipes(popular.slice(0, 10));
      } catch (err) {
        console.error('Error loading community popular meals:', err);
      }
    } catch (err) {
      console.error('Error loading community recipes:', err);
      setError('Failed to load community recipes');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRecipe = async (recipe: Recipe) => {
    setAddingId(recipe.id);
    try {
      const newRecipe: Recipe = {
        ...recipe,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      await addRecipe(familyId, newRecipe);
      setAddedIds((prev) => new Set(prev).add(recipe.id));
      onRecipeAdded();
    } catch (err) {
      console.error('Error adding recipe:', err);
      alert('Failed to add recipe');
    } finally {
      setAddingId(null);
    }
  };

  const filteredRecipes = recipes.filter((cr) => {
    const matchesCategory =
      filterCategory === 'all' || cr.recipe.category === filterCategory;
    const matchesSearch = cr.recipe.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const groupedRecipes = filteredRecipes.reduce(
    (acc, cr) => {
      if (!acc[cr.recipe.category]) {
        acc[cr.recipe.category] = [];
      }
      acc[cr.recipe.category].push(cr);
      return acc;
    },
    {} as Record<RecipeCategory, CommunityRecipe[]>
  );

  if (loading) {
    return <div className="loading">Loading community recipes...</div>;
  }

  if (error) {
    return (
      <div className="community-error">
        <p>{error}</p>
        <button onClick={loadCommunityRecipes} className="btn-primary">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="community-recipes">
      <p className="community-hint">
        Browse recipes from other families and add ones you like to your
        collection.
      </p>

      {popularRecipes.length > 0 && (
        <div className="popular-meals-section">
          <h3>Most Cooked by Other Families</h3>
          <div className="popular-meals-list">
            {popularRecipes.map((pr, index) => (
              <div key={pr.recipe.id} className="popular-meal-item">
                <span className="popular-rank">#{index + 1}</span>
                <div className="popular-meal-info">
                  <span className="popular-meal-name">{pr.recipe.name}</span>
                  <span className="popular-meal-meta">
                    {pr.count} {pr.count === 1 ? 'time' : 'times'} &middot;{' '}
                    {pr.familyName}
                  </span>
                </div>
                {addedIds.has(pr.recipe.id) ? (
                  <button className="btn-added btn-sm" disabled>
                    Added!
                  </button>
                ) : (
                  <button
                    onClick={() => handleAddRecipe(pr.recipe)}
                    className="btn-primary btn-sm"
                    disabled={addingId === pr.recipe.id}
                  >
                    {addingId === pr.recipe.id ? 'Adding...' : '+ Add'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <h3>All Community Recipes</h3>

      <div className="recipe-filters">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search community recipes..."
          className="search-input"
        />
        <select
          value={filterCategory}
          onChange={(e) =>
            setFilterCategory(e.target.value as RecipeCategory | 'all')
          }
        >
          <option value="all">All Categories</option>
          <option value="main">Main Dishes</option>
          <option value="vegetable">Vegetables</option>
          <option value="grain">Grains</option>
          <option value="other">Other</option>
        </select>
      </div>

      {filteredRecipes.length === 0 ? (
        <p className="no-recipes">
          {recipes.length === 0
            ? 'No community recipes available yet. Other families\u2019 recipes will appear here.'
            : 'No recipes match your search.'}
        </p>
      ) : (
        (['main', 'vegetable', 'grain', 'other'] as RecipeCategory[]).map(
          (category) =>
            groupedRecipes[category]?.length > 0 ? (
              <div key={category} className="recipe-category-group">
                <h3>{CATEGORY_LABELS[category]}</h3>
                <div className="recipe-grid">
                  {groupedRecipes[category].map((cr) => (
                    <div
                      key={cr.recipe.id}
                      className={`recipe-card ${expandedId === cr.recipe.id ? 'expanded' : ''}`}
                    >
                      <h4>{cr.recipe.name}</h4>
                      <span className="community-family-badge">
                        From: {cr.familyName}
                      </span>

                      {cr.recipe.url && (
                        <a
                          href={cr.recipe.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="recipe-link"
                        >
                          View Original Recipe
                        </a>
                      )}

                      {expandedId === cr.recipe.id ? (
                        <>
                          {cr.recipe.ingredients.length > 0 && (
                            <div className="recipe-section">
                              <strong>Ingredients:</strong>
                              <ul className="recipe-ingredients-full">
                                {cr.recipe.ingredients.map((ing, i) => (
                                  <li key={i}>
                                    {ing.amount} {ing.unit} {ing.name}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {cr.recipe.directions &&
                            cr.recipe.directions.length > 0 && (
                              <div className="recipe-section">
                                <strong>Directions:</strong>
                                <ol className="recipe-directions-full">
                                  {cr.recipe.directions.map((step, i) => (
                                    <li key={i}>{step}</li>
                                  ))}
                                </ol>
                              </div>
                            )}

                          {cr.recipe.notes && (
                            <div className="recipe-section">
                              <strong>Notes:</strong>
                              <p className="recipe-notes">{cr.recipe.notes}</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {cr.recipe.ingredients.length > 0 && (
                            <div className="recipe-ingredients-preview">
                              <strong>Ingredients:</strong>
                              <ul>
                                {cr.recipe.ingredients.slice(0, 3).map((ing, i) => (
                                  <li key={i}>
                                    {ing.amount} {ing.unit} {ing.name}
                                  </li>
                                ))}
                                {cr.recipe.ingredients.length > 3 && (
                                  <li className="more-items">
                                    ...and {cr.recipe.ingredients.length - 3}{' '}
                                    more
                                  </li>
                                )}
                              </ul>
                            </div>
                          )}
                        </>
                      )}

                      <div className="recipe-actions">
                        <button
                          onClick={() =>
                            setExpandedId(
                              expandedId === cr.recipe.id
                                ? null
                                : cr.recipe.id
                            )
                          }
                          className="btn-secondary btn-sm"
                        >
                          {expandedId === cr.recipe.id
                            ? 'Collapse'
                            : 'Expand'}
                        </button>
                        {addedIds.has(cr.recipe.id) ? (
                          <button className="btn-added btn-sm" disabled>
                            Added!
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAddRecipe(cr.recipe)}
                            className="btn-primary btn-sm"
                            disabled={addingId === cr.recipe.id}
                          >
                            {addingId === cr.recipe.id
                              ? 'Adding...'
                              : '+ Add to My Recipes'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null
        )
      )}
    </div>
  );
}
