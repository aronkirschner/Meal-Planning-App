import { useState } from 'react';
import type { Recipe, RecipeCategory, CuisineType, Ingredient } from '../types';
import { CUISINE_TYPES, inferCuisineType } from '../types';
import { generateId } from '../firestore-storage';
import { extractRecipeFromUrl } from '../api';

interface RecipeFormProps {
  onSave: (recipe: Recipe) => void;
  editRecipe?: Recipe;
  onCancel?: () => void;
}

type EntryMode = 'url' | 'manual';

export function RecipeForm({ onSave, editRecipe, onCancel }: RecipeFormProps) {
  const [entryMode, setEntryMode] = useState<EntryMode>('url');
  const [url, setUrl] = useState(editRecipe?.url || '');
  const [name, setName] = useState(editRecipe?.name || '');
  const [category, setCategory] = useState<RecipeCategory>(
    editRecipe?.category || 'main'
  );
  const [cuisineType, setCuisineType] = useState<CuisineType>(
    editRecipe?.cuisineType || 'Other'
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

  // Manual entry state
  const [manualIngredients, setManualIngredients] = useState('');
  const [manualDirections, setManualDirections] = useState('');

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

      // Auto-infer cuisine type from extracted name + ingredients
      const extractedIngredients = data.extendedIngredients.map((ing) => ({
        name: ing.name,
        amount: ing.amount.toString(),
        unit: ing.unit,
      }));
      const tempRecipe = {
        id: '',
        name: data.title,
        url: url.trim(),
        category: 'main' as RecipeCategory,
        ingredients: extractedIngredients,
        directions: extractedDirections,
        createdAt: '',
      };
      setCuisineType(inferCuisineType(tempRecipe));

      setIsExtracted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract recipe');
    } finally {
      setIsLoading(false);
    }
  };

  const parseManualIngredients = (text: string): Ingredient[] => {
    // Parse ingredients from text, one per line
    // Try to extract amount, unit, and name from each line
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        // Try to match patterns like "2 cups flour" or "1/2 tsp salt"
        const match = line.match(/^([\d./\s]+)?\s*([a-zA-Z]+)?\s*(.+)$/);
        if (match) {
          return {
            amount: (match[1] || '').trim(),
            unit: (match[2] || '').trim(),
            name: (match[3] || line).trim(),
          };
        }
        return { amount: '', unit: '', name: line };
      });
  };

  const parseManualDirections = (text: string): string[] => {
    // Parse directions from text, one per line or split by numbered steps
    return text
      .split(/\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        // Remove leading numbers like "1." or "1)"
        return line.replace(/^\d+[.)]\s*/, '');
      });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (entryMode === 'url' && !isExtracted && !editRecipe) {
      setError('Please extract the recipe first');
      return;
    }

    if (entryMode === 'manual' && !name.trim()) {
      setError('Please enter a recipe name');
      return;
    }

    // For manual mode, parse the text inputs
    let finalIngredients = ingredients;
    let finalDirections = directions;

    if (entryMode === 'manual' && !editRecipe) {
      finalIngredients = parseManualIngredients(manualIngredients);
      finalDirections = parseManualDirections(manualDirections);
    }

    const recipe: Recipe = {
      id: editRecipe?.id || generateId(),
      name: name.trim(),
      url: url.trim(),
      category,
      cuisineType,
      ingredients: finalIngredients.filter((i) => i.name.trim() !== ''),
      directions: finalDirections,
      notes: notes.trim() || undefined,
      createdAt: editRecipe?.createdAt || new Date().toISOString(),
    };

    onSave(recipe);

    if (!editRecipe) {
      setUrl('');
      setName('');
      setCategory('main');
      setCuisineType('Other');
      setIngredients([]);
      setDirections([]);
      setManualIngredients('');
      setManualDirections('');
      setNotes('');
      setIsExtracted(false);
    }
  };

  const showForm = entryMode === 'manual' || isExtracted || editRecipe;

  return (
    <form onSubmit={handleSubmit} className="recipe-form">
      <h3>{editRecipe ? 'Edit Recipe' : 'Add New Recipe'}</h3>

      {error && <div className="form-error">{error}</div>}

      {!editRecipe && (
        <div className="entry-mode-toggle">
          <button
            type="button"
            className={`mode-btn ${entryMode === 'url' ? 'active' : ''}`}
            onClick={() => {
              setEntryMode('url');
              setError(null);
            }}
          >
            From URL
          </button>
          <button
            type="button"
            className={`mode-btn ${entryMode === 'manual' ? 'active' : ''}`}
            onClick={() => {
              setEntryMode('manual');
              setError(null);
            }}
          >
            Manual Entry
          </button>
        </div>
      )}

      {entryMode === 'url' && (
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
              required={entryMode === 'url' && !editRecipe}
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
      )}

      {showForm && (
        <>
          <div className="form-group">
            <label htmlFor="name">Recipe Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter recipe name"
              required
            />
          </div>

          {entryMode === 'manual' && !editRecipe && (
            <div className="form-group">
              <label htmlFor="manualUrl">Recipe URL (optional)</label>
              <input
                id="manualUrl"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/recipe"
              />
            </div>
          )}

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
            <label htmlFor="cuisineType">Cuisine Type</label>
            <select
              id="cuisineType"
              value={cuisineType}
              onChange={(e) => setCuisineType(e.target.value as CuisineType)}
            >
              {CUISINE_TYPES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {entryMode === 'url' || editRecipe ? (
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
          ) : (
            <div className="form-group">
              <label htmlFor="manualIngredients">Ingredients (one per line)</label>
              <textarea
                id="manualIngredients"
                value={manualIngredients}
                onChange={(e) => setManualIngredients(e.target.value)}
                placeholder="2 cups flour&#10;1 tsp salt&#10;1/2 cup butter&#10;..."
                rows={6}
              />
            </div>
          )}

          {entryMode === 'url' || editRecipe ? (
            directions.length > 0 && (
              <div className="form-group">
                <label>Directions ({directions.length} steps)</label>
                <ol className="extracted-directions">
                  {directions.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ol>
              </div>
            )
          ) : (
            <div className="form-group">
              <label htmlFor="manualDirections">Directions (one step per line)</label>
              <textarea
                id="manualDirections"
                value={manualDirections}
                onChange={(e) => setManualDirections(e.target.value)}
                placeholder="Preheat oven to 350F&#10;Mix dry ingredients&#10;Add wet ingredients&#10;..."
                rows={6}
              />
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

      {entryMode === 'url' && !isExtracted && !editRecipe && (
        <p className="extract-hint">
          Paste a recipe URL and click Extract to automatically import the recipe
        </p>
      )}
    </form>
  );
}
