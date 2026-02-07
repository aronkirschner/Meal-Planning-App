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
  const [directions, setDirections] = useState<string[]>(
    editRecipe?.directions || []
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

      // Extract directions from analyzedInstructions or plain instructions
      let extractedDirections: string[] = [];
      if (data.analyzedInstructions && data.analyzedInstructions.length > 0) {
        extractedDirections = data.analyzedInstructions[0].steps.map(
          (step) => step.step
        );
      } else if (data.instructions) {
        // Split plain instructions by sentences or line breaks
        extractedDirections = data.instructions
          .split(/(?:\r?\n)+|(?<=\.)\s+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
      }
      setDirections(extractedDirections);

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
      directions,
      notes: notes.trim() || undefined,
      createdAt: editRecipe?.createdAt || new Date().toISOString(),
    };

    onSave(recipe);

    if (!editRecipe) {
      setUrl('');
      setName('');
      setCategory('main');
      setIngredients([]);
      setDirections([]);
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
              <option value="other">Other</option>
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

          {directions.length > 0 && (
            <div className="form-group">
              <label>Directions ({directions.length} steps)</label>
              <ol className="extracted-directions">
                {directions.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </div>
          )}

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
