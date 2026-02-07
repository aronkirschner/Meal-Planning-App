import { useState } from 'react';
import type { Recipe, RecipeCategory, Ingredient } from '../types';
import { generateId } from '../storage';
import { extractRecipeFromUrl } from '../api';

interface RecipeFormProps {
  onSave: (recipe: Recipe) => void;
  editRecipe?: Recipe;
  onCancel?: () => void;
}

export function RecipeForm({ onSave, editRecipe, onCancel }: RecipeFormProps) {
  const [url, setUrl] = useState(editRecipe?.url || '');
  const [name, setName] = useState(editRecipe?.name || '');
  const [category, setCategory] = useState<RecipeCategory>(
    editRecipe?.category || 'main'
  );
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    editRecipe?.ingredients || []
  );
  const [notes, setNotes] = useState(editRecipe?.notes || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExtracted, setIsExtracted] = useState(!!editRecipe);

  const handleExtract = async () => {
    if (!url.trim()) {
      setError('Please enter a recipe URL');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await extractRecipeFromUrl(url.trim());

      setName(data.title);
      setIngredients(
        data.extendedIngredients.map((ing) => ({
          name: ing.name,
          amount: ing.amount.toString(),
          unit: ing.unit,
        }))
      );
      setIsExtracted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract recipe');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isExtracted && !editRecipe) {
      setError('Please extract the recipe first');
      return;
    }

    const recipe: Recipe = {
      id: editRecipe?.id || generateId(),
      name: name.trim(),
      url: url.trim(),
      category,
      ingredients: ingredients.filter((i) => i.name.trim() !== ''),
      notes: notes.trim() || undefined,
      createdAt: editRecipe?.createdAt || new Date().toISOString(),
    };

    onSave(recipe);

    if (!editRecipe) {
      setUrl('');
      setName('');
      setCategory('main');
      setIngredients([]);
      setNotes('');
      setIsExtracted(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="recipe-form">
      <h3>{editRecipe ? 'Edit Recipe' : 'Add New Recipe'}</h3>

      {error && <div className="form-error">{error}</div>}

      <div className="form-group">
        <label htmlFor="url">Recipe URL</label>
        <div className="url-input-group">
          <input
            id="url"
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (!editRecipe) setIsExtracted(false);
            }}
            placeholder="https://example.com/recipe"
            required
            disabled={isLoading}
          />
          {!editRecipe && (
            <button
              type="button"
              onClick={handleExtract}
              className="btn-primary"
              disabled={isLoading || !url.trim()}
            >
              {isLoading ? 'Extracting...' : 'Extract'}
            </button>
          )}
        </div>
      </div>

      {isExtracted && (
        <>
          <div className="form-group">
            <label htmlFor="name">Recipe Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as RecipeCategory)}
            >
              <option value="main">Main Dish</option>
              <option value="vegetable">Vegetable</option>
              <option value="grain">Grain</option>
            </select>
          </div>

          <div className="form-group">
            <label>Ingredients ({ingredients.length} found)</label>
            <ul className="extracted-ingredients">
              {ingredients.map((ing, index) => (
                <li key={index}>
                  {ing.amount} {ing.unit} {ing.name}
                </li>
              ))}
            </ul>
          </div>

          <div className="form-group">
            <label htmlFor="notes">Notes (optional)</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary">
              {editRecipe ? 'Update Recipe' : 'Save Recipe'}
            </button>
            {onCancel && (
              <button type="button" onClick={onCancel} className="btn-secondary">
                Cancel
              </button>
            )}
          </div>
        </>
      )}

      {!isExtracted && !editRecipe && (
        <p className="extract-hint">
          Paste a recipe URL and click Extract to automatically import the recipe
        </p>
      )}
    </form>
  );
}
