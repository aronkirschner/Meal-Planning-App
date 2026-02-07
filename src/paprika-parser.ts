import type { Recipe, Ingredient, RecipeCategory } from './types';
import { generateId } from './firestore-storage';

interface ParsedPaprikaRecipe {
  name: string;
  url: string;
  ingredients: Ingredient[];
  directions: string[];
  notes: string;
  prepTime: string;
  cookTime: string;
  servings: string;
  imageUrl: string;
}

export function parsePaprikaHtml(html: string): ParsedPaprikaRecipe | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Get recipe name
    const nameEl = doc.querySelector('h1[itemprop="name"]');
    const name = nameEl?.textContent?.trim() || '';

    if (!name) {
      console.warn('No recipe name found');
      return null;
    }

    // Get source URL
    const urlEl = doc.querySelector('a[itemprop="url"]');
    const url = urlEl?.getAttribute('href') || '';

    // Get prep time, cook time, servings
    const prepTimeEl = doc.querySelector('span[itemprop="prepTime"]');
    const cookTimeEl = doc.querySelector('span[itemprop="cookTime"]');
    const servingsEl = doc.querySelector('span[itemprop="recipeYield"]');

    const prepTime = prepTimeEl?.textContent?.trim() || '';
    const cookTime = cookTimeEl?.textContent?.trim() || '';
    const servings = servingsEl?.textContent?.trim() || '';

    // Get image URL
    const imageEl = doc.querySelector('img[itemprop="image"]');
    const imageUrl = imageEl?.getAttribute('src') || '';

    // Parse ingredients
    const ingredientEls = doc.querySelectorAll('p[itemprop="recipeIngredient"]');
    const ingredients: Ingredient[] = [];

    ingredientEls.forEach((el) => {
      const text = el.textContent?.trim() || '';
      if (text) {
        // Try to parse amount and unit from ingredient text
        // Common patterns: "6 ounces (170g) elbow macaroni" or "1/2 cup flour"
        const parsed = parseIngredientText(text);
        ingredients.push(parsed);
      }
    });

    // Parse directions
    const directionsEl = doc.querySelector('div[itemprop="recipeInstructions"]');
    const directionLines = directionsEl?.querySelectorAll('p.line') || [];
    const directions: string[] = [];

    directionLines.forEach((el) => {
      const text = el.textContent?.trim() || '';
      if (text) {
        directions.push(text);
      }
    });

    // Parse notes
    const notesEl = doc.querySelector('div[itemprop="comment"]');
    const notes = notesEl?.textContent?.trim() || '';

    return {
      name,
      url,
      ingredients,
      directions,
      notes,
      prepTime,
      cookTime,
      servings,
      imageUrl,
    };
  } catch (error) {
    console.error('Error parsing Paprika HTML:', error);
    return null;
  }
}

function parseIngredientText(text: string): Ingredient {
  // Try to extract amount, unit, and name from ingredient text
  // Patterns like: "6 ounces (170g) elbow macaroni", "1/2 cup flour", "Salt"

  // First, try to match a pattern with amount and unit
  const match = text.match(/^([\d./\s]+)?\s*(\w+)?\s*(?:\([^)]+\))?\s*(.*)$/);

  if (match) {
    const possibleAmount = (match[1] || '').trim();
    const possibleUnit = (match[2] || '').trim().toLowerCase();
    const rest = (match[3] || '').trim();

    // Common units
    const units = ['ounce', 'ounces', 'oz', 'cup', 'cups', 'tablespoon', 'tablespoons',
                   'tbsp', 'teaspoon', 'teaspoons', 'tsp', 'pound', 'pounds', 'lb', 'lbs',
                   'gram', 'grams', 'g', 'kg', 'ml', 'liter', 'liters', 'pinch', 'dash',
                   'can', 'cans', 'package', 'packages', 'pkg', 'slice', 'slices',
                   'piece', 'pieces', 'clove', 'cloves', 'bunch', 'bunches', 'head', 'heads'];

    if (possibleAmount && units.includes(possibleUnit)) {
      return {
        amount: possibleAmount,
        unit: possibleUnit,
        name: rest || possibleUnit,
      };
    }
  }

  // If no pattern matched, just use the whole text as the name
  return {
    amount: '',
    unit: '',
    name: text,
  };
}

export function paprikaToRecipe(parsed: ParsedPaprikaRecipe, category: RecipeCategory = 'main'): Recipe {
  // Build notes string with prep/cook time info if available
  let notesText = parsed.notes;
  const timeInfo: string[] = [];
  if (parsed.prepTime) timeInfo.push(`Prep: ${parsed.prepTime}`);
  if (parsed.cookTime) timeInfo.push(`Cook: ${parsed.cookTime}`);
  if (parsed.servings) timeInfo.push(`Servings: ${parsed.servings}`);

  if (timeInfo.length > 0) {
    notesText = timeInfo.join(' | ') + (notesText ? '\n\n' + notesText : '');
  }

  return {
    id: generateId(),
    name: parsed.name,
    url: parsed.url,
    category,
    ingredients: parsed.ingredients,
    directions: parsed.directions,
    notes: notesText || undefined,
    createdAt: new Date().toISOString(),
  };
}
