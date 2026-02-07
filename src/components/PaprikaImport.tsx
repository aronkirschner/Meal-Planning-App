import { useState, useRef } from 'react';
import type { Recipe, RecipeCategory } from '../types';
import { parsePaprikaHtml, paprikaToRecipe } from '../paprika-parser';

interface PaprikaImportProps {
  onImport: (recipes: Recipe[]) => Promise<void>;
  onClose: () => void;
}

interface ParsedRecipePreview {
  name: string;
  ingredientCount: number;
  directionCount: number;
  category: RecipeCategory;
  recipe: Recipe;
}

export function PaprikaImport({ onImport, onClose }: PaprikaImportProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [parsedRecipes, setParsedRecipes] = useState<ParsedRecipePreview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    // Filter to only HTML files
    const htmlFiles = selectedFiles.filter(
      (f) => f.name.endsWith('.html') && f.name !== 'index.html'
    );

    if (htmlFiles.length === 0) {
      setError('No recipe HTML files found. Make sure to select the recipe files (not index.html).');
      return;
    }

    setFiles(htmlFiles);
    setError(null);
    setIsLoading(true);
    setParsedRecipes([]);

    try {
      const parsed: ParsedRecipePreview[] = [];

      for (const file of htmlFiles) {
        const text = await file.text();
        const result = parsePaprikaHtml(text);

        if (result) {
          const recipe = paprikaToRecipe(result);
          parsed.push({
            name: result.name,
            ingredientCount: result.ingredients.length,
            directionCount: result.directions.length,
            category: guessCategory(result.name),
            recipe,
          });
        }
      }

      setParsedRecipes(parsed);

      if (parsed.length === 0) {
        setError('Could not parse any recipes from the selected files.');
      }
    } catch (err) {
      console.error('Error parsing files:', err);
      setError('Error reading files. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const guessCategory = (name: string): RecipeCategory => {
    const lowerName = name.toLowerCase();

    // Vegetables/sides
    if (
      lowerName.includes('asparagus') ||
      lowerName.includes('broccoli') ||
      lowerName.includes('brussels') ||
      lowerName.includes('spinach') ||
      lowerName.includes('green beans') ||
      lowerName.includes('salad') ||
      lowerName.includes('vegetable')
    ) {
      return 'vegetable';
    }

    // Grains/starches
    if (
      lowerName.includes('rice') ||
      lowerName.includes('risotto') ||
      lowerName.includes('pasta') ||
      lowerName.includes('potato') ||
      lowerName.includes('noodle') ||
      lowerName.includes('bread') ||
      lowerName.includes('cornbread')
    ) {
      return 'grain';
    }

    // Cocktails/drinks/desserts -> other
    if (
      lowerName.includes('cocktail') ||
      lowerName.includes('negroni') ||
      lowerName.includes('manhattan') ||
      lowerName.includes('old fashioned') ||
      lowerName.includes('margarita') ||
      lowerName.includes('martini') ||
      lowerName.includes('cookie') ||
      lowerName.includes('ice cream') ||
      lowerName.includes('popsicle') ||
      lowerName.includes('gravy') ||
      lowerName.includes('sauce') ||
      lowerName.includes('dressing')
    ) {
      return 'other';
    }

    // Default to main dish
    return 'main';
  };

  const handleCategoryChange = (index: number, category: RecipeCategory) => {
    setParsedRecipes((prev) =>
      prev.map((p, i) =>
        i === index
          ? { ...p, category, recipe: { ...p.recipe, category } }
          : p
      )
    );
  };

  const handleImport = async () => {
    setIsImporting(true);
    setError(null);

    try {
      const recipesToImport = parsedRecipes.map((p) => ({
        ...p.recipe,
        category: p.category,
      }));

      await onImport(recipesToImport);
      setImportResult({ success: recipesToImport.length, failed: 0 });
    } catch (err) {
      console.error('Error importing recipes:', err);
      setError('Failed to import some recipes. Please try again.');
      setImportResult({ success: 0, failed: parsedRecipes.length });
    } finally {
      setIsImporting(false);
    }
  };

  const handleRemoveRecipe = (index: number) => {
    setParsedRecipes((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content paprika-import-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Import from Paprika</h3>
          <button onClick={onClose} className="modal-close">&times;</button>
        </div>

        <div className="paprika-import-body">
          {!importResult ? (
            <>
              <div className="import-instructions">
                <p>Select your Paprika recipe HTML files to import them.</p>
                <p className="hint">
                  Navigate to your <code>My Recipes.paprikarecipes/Recipes</code> folder
                  and select all the HTML files (you can use Cmd+A to select all).
                </p>
              </div>

              <div className="file-select-section">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".html"
                  multiple
                  style={{ display: 'none' }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-primary"
                  disabled={isLoading}
                >
                  {isLoading ? 'Reading files...' : 'Select HTML Files'}
                </button>
                {files.length > 0 && (
                  <span className="file-count">{files.length} files selected</span>
                )}
              </div>

              {error && <div className="import-error">{error}</div>}

              {parsedRecipes.length > 0 && (
                <>
                  <div className="parsed-recipes-header">
                    <h4>Recipes to Import ({parsedRecipes.length})</h4>
                    <p className="hint">Review categories and remove any you don't want to import.</p>
                  </div>

                  <div className="parsed-recipes-list">
                    {parsedRecipes.map((recipe, index) => (
                      <div key={index} className="parsed-recipe-item">
                        <div className="recipe-info">
                          <span className="recipe-name">{recipe.name}</span>
                          <span className="recipe-meta">
                            {recipe.ingredientCount} ingredients, {recipe.directionCount} steps
                          </span>
                        </div>
                        <select
                          value={recipe.category}
                          onChange={(e) =>
                            handleCategoryChange(index, e.target.value as RecipeCategory)
                          }
                          className="category-select"
                        >
                          <option value="main">Main</option>
                          <option value="vegetable">Vegetable</option>
                          <option value="grain">Grain</option>
                          <option value="other">Other</option>
                        </select>
                        <button
                          onClick={() => handleRemoveRecipe(index)}
                          className="btn-remove-small"
                          title="Remove from import"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="import-actions">
                    <button onClick={onClose} className="btn-secondary">
                      Cancel
                    </button>
                    <button
                      onClick={handleImport}
                      className="btn-primary"
                      disabled={isImporting || parsedRecipes.length === 0}
                    >
                      {isImporting
                        ? 'Importing...'
                        : `Import ${parsedRecipes.length} Recipes`}
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="import-result">
              <div className="result-icon">
                {importResult.success > 0 ? '✓' : '✗'}
              </div>
              <h4>
                {importResult.success > 0
                  ? `Successfully imported ${importResult.success} recipes!`
                  : 'Import failed'}
              </h4>
              {importResult.failed > 0 && (
                <p className="failed-count">{importResult.failed} recipes failed to import</p>
              )}
              <button onClick={onClose} className="btn-primary">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
