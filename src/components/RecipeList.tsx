import { useState, useMemo } from 'react';
import type { Recipe, RecipeCategory } from '../types';
import { RecipeForm } from './RecipeForm';

type SortOption = 'az' | 'rating' | 'cooked';

interface RecipeListProps {
  recipes: Recipe[];
  onUpdate: (recipe: Recipe) => void;
  onDelete: (id: string) => void;
  cookCounts?: Map<string, number>;
}

function StarRating({ rating, onRate }: { rating: number | undefined; onRate: (rating: number) => void }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const display = hovered ?? (rating || 0);

  return (
    <div className="star-rating" onMouseLeave={() => setHovered(null)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          className={`star-btn ${star <= display ? 'star-filled' : 'star-empty'}`}
          onMouseEnter={() => setHovered(star)}
          onClick={(e) => {
            e.stopPropagation();
            // Click same rating to clear it
            onRate(rating === star ? 0 : star);
          }}
          title={rating === star ? 'Clear rating' : `Rate ${star} star${star > 1 ? 's' : ''}`}
        >
          {star <= display ? '\u2605' : '\u2606'}
        </button>
      ))}
    </div>
  );
}

const CATEGORY_LABELS: Record<RecipeCategory, string> = {
  main: 'Main Dishes',
  vegetable: 'Vegetables',
  grain: 'Grains',
  other: 'Other',
};

export function RecipeList({ recipes, onUpdate, onDelete, cookCounts }: RecipeListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<RecipeCategory | 'all'>(
    'all'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('az');

  const filteredRecipes = recipes.filter((recipe) => {
    const matchesCategory =
      filterCategory === 'all' || recipe.category === filterCategory;
    const matchesSearch = recipe.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const sortedRecipes = useMemo(() => {
    const sorted = [...filteredRecipes];
    switch (sortBy) {
      case 'az':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'rating':
        sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0) || a.name.localeCompare(b.name));
        break;
      case 'cooked':
        sorted.sort((a, b) => (cookCounts?.get(b.id) || 0) - (cookCounts?.get(a.id) || 0) || a.name.localeCompare(b.name));
        break;
    }
    return sorted;
  }, [filteredRecipes, sortBy, cookCounts]);

  const groupedRecipes = sortedRecipes.reduce(
    (acc, recipe) => {
      if (!acc[recipe.category]) {
        acc[recipe.category] = [];
      }
      acc[recipe.category].push(recipe);
      return acc;
    },
    {} as Record<RecipeCategory, Recipe[]>
  );

  const handleUpdate = (recipe: Recipe) => {
    onUpdate(recipe);
    setEditingId(null);
  };

  const toggleExpanded = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="recipe-list">
      <div className="recipe-filters">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search recipes..."
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
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="sort-select"
        >
          <option value="az">Sort: A-Z</option>
          <option value="rating">Sort: Rating</option>
          <option value="cooked">Sort: Times Cooked</option>
        </select>
      </div>

      {filteredRecipes.length === 0 ? (
        <p className="no-recipes">
          No recipes found. Add some recipes to get started!
        </p>
      ) : (
        (['main', 'vegetable', 'grain', 'other'] as RecipeCategory[]).map((category) =>
          groupedRecipes[category]?.length > 0 ? (
            <div key={category} className="recipe-category-group">
              <h3>{CATEGORY_LABELS[category]}</h3>
              <div className="recipe-grid">
                {groupedRecipes[category].map((recipe) =>
                  editingId === recipe.id ? (
                    <div key={recipe.id} className="recipe-card editing">
                      <RecipeForm
                        editRecipe={recipe}
                        onSave={handleUpdate}
                        onCancel={() => setEditingId(null)}
                      />
                    </div>
                  ) : (
                    <div key={recipe.id} className={`recipe-card ${expandedId === recipe.id ? 'expanded' : ''}`}>
                      <h4>{recipe.name}</h4>
                      <div className="recipe-meta">
                        <StarRating
                          rating={recipe.rating}
                          onRate={(r) => onUpdate({ ...recipe, rating: r || undefined })}
                        />
                        <span className="cook-count" title="Times cooked">
                          {cookCounts?.get(recipe.id) || 0}x cooked
                        </span>
                      </div>
                      <a
                        href={recipe.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="recipe-link"
                      >
                        View Original Recipe
                      </a>

                      {expandedId === recipe.id ? (
                        <>
                          {recipe.ingredients.length > 0 && (
                            <div className="recipe-section">
                              <strong>Ingredients:</strong>
                              <ul className="recipe-ingredients-full">
                                {recipe.ingredients.map((ing, i) => (
                                  <li key={i}>
                                    {ing.amount} {ing.unit} {ing.name}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {recipe.directions && recipe.directions.length > 0 && (
                            <div className="recipe-section">
                              <strong>Directions:</strong>
                              <ol className="recipe-directions-full">
                                {recipe.directions.map((step, i) => (
                                  <li key={i}>{step}</li>
                                ))}
                              </ol>
                            </div>
                          )}

                          {recipe.notes && (
                            <div className="recipe-section">
                              <strong>Notes:</strong>
                              <p className="recipe-notes">{recipe.notes}</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {recipe.ingredients.length > 0 && (
                            <div className="recipe-ingredients-preview">
                              <strong>Ingredients:</strong>
                              <ul>
                                {recipe.ingredients.slice(0, 3).map((ing, i) => (
                                  <li key={i}>
                                    {ing.amount} {ing.unit} {ing.name}
                                  </li>
                                ))}
                                {recipe.ingredients.length > 3 && (
                                  <li className="more-items">...and {recipe.ingredients.length - 3} more</li>
                                )}
                              </ul>
                            </div>
                          )}

                          {recipe.directions && recipe.directions.length > 0 && (
                            <div className="recipe-directions-preview">
                              <strong>Directions:</strong> {recipe.directions.length} steps
                            </div>
                          )}
                        </>
                      )}

                      <div className="recipe-actions">
                        <button
                          onClick={() => toggleExpanded(recipe.id)}
                          className="btn-secondary btn-sm"
                        >
                          {expandedId === recipe.id ? 'Collapse' : 'Expand'}
                        </button>
                        <button
                          onClick={() => setEditingId(recipe.id)}
                          className="btn-secondary btn-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            if (
                              window.confirm(
                                'Are you sure you want to delete this recipe?'
                              )
                            ) {
                              onDelete(recipe.id);
                            }
                          }}
                          className="btn-danger btn-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : null
        )
      )}
    </div>
  );
}
