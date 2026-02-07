import { useState } from 'react';
import type { Recipe, RecipeCategory } from '../types';
import { RecipeForm } from './RecipeForm';

interface RecipeListProps {
  recipes: Recipe[];
  onUpdate: (recipe: Recipe) => void;
  onDelete: (id: string) => void;
}

const CATEGORY_LABELS: Record<RecipeCategory, string> = {
  main: 'Main Dishes',
  vegetable: 'Vegetables',
  grain: 'Grains',
  other: 'Other',
};

export function RecipeList({ recipes, onUpdate, onDelete }: RecipeListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<RecipeCategory | 'all'>(
    'all'
  );
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRecipes = recipes.filter((recipe) => {
    const matchesCategory =
      filterCategory === 'all' || recipe.category === filterCategory;
    const matchesSearch = recipe.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const groupedRecipes = filteredRecipes.reduce(
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
                    <div key={recipe.id} className="recipe-card">
                      <h4>{recipe.name}</h4>
                      <a
                        href={recipe.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="recipe-link"
                      >
                        View Recipe
                      </a>
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
                              <li>...and {recipe.ingredients.length - 3} more</li>
                            )}
                          </ul>
                        </div>
                      )}
                      {recipe.notes && (
                        <p className="recipe-notes">{recipe.notes}</p>
                      )}
                      <div className="recipe-actions">
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
