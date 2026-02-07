import { useState } from 'react';
import type { Recipe, RecipeCategory, Ingredient } from '../types';
import { generateId } from '../storage';

interface RecipeFormProps {
  onSave: (recipe: Recipe) => void;
  editRecipe?: Recipe;
  onCancel?: () => void;
}

export function RecipeForm({ onSave, editRecipe, onCancel }: RecipeFormProps) {
  const [name, setName] = useState(editRecipe?.name || '');
  const [url, setUrl] = useState(editRecipe?.url || '');
  const [category, setCategory] = useState<RecipeCategory>(
    editRecipe?.category || 'main'
  );
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    editRecipe?.ingredients || [{ name: '', amount: '', unit: '' }]
  );
  const [notes, setNotes] = useState(editRecipe?.notes || '');

  const handleAddIngredient = () => {
    setIngredients([...ingredients, { name: '', amount: '', unit: '' }]);
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleIngredientChange = (
    index: number,
    field: keyof Ingredient,
    value: string
  ) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

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
      setName('');
      setUrl('');
      setCategory('main');
      setIngredients([{ name: '', amount: '', unit: '' }]);
      setNotes('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="recipe-form">
      <h3>{editRecipe ? 'Edit Recipe' : 'Add New Recipe'}</h3>

      <div className="form-group">
        <label htmlFor="name">Recipe Name</label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Grilled Chicken"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="url">Recipe URL</label>
        <input
          id="url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/recipe"
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
        <label>Ingredients</label>
        <div className="ingredients-list">
          {ingredients.map((ingredient, index) => (
            <div key={index} className="ingredient-row">
              <input
                type="text"
                value={ingredient.amount}
                onChange={(e) =>
                  handleIngredientChange(index, 'amount', e.target.value)
                }
                placeholder="Amount"
                className="ingredient-amount"
              />
              <input
                type="text"
                value={ingredient.unit}
                onChange={(e) =>
                  handleIngredientChange(index, 'unit', e.target.value)
                }
                placeholder="Unit"
                className="ingredient-unit"
              />
              <input
                type="text"
                value={ingredient.name}
                onChange={(e) =>
                  handleIngredientChange(index, 'name', e.target.value)
                }
                placeholder="Ingredient name"
                className="ingredient-name"
              />
              {ingredients.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveIngredient(index)}
                  className="btn-remove"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={handleAddIngredient}
          className="btn-secondary"
        >
          + Add Ingredient
        </button>
      </div>

      <div className="form-group">
        <label htmlFor="notes">Notes (optional)</label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any additional notes..."
          rows={3}
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="btn-primary">
          {editRecipe ? 'Update Recipe' : 'Add Recipe'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
