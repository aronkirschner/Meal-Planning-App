const API_KEY = 'cac21a82596f96a4837069aad44b25a93dbc84f6';
const BASE_URL = 'https://api.spoonacular.com';

export interface ExtractedRecipe {
  title: string;
  sourceUrl: string;
  extendedIngredients: Array<{
    original: string;
    name: string;
    amount: number;
    unit: string;
  }>;
}

export async function extractRecipeFromUrl(url: string): Promise<ExtractedRecipe> {
  const response = await fetch(
    `${BASE_URL}/recipes/extract?url=${encodeURIComponent(url)}&apiKey=${API_KEY}`
  );

  if (!response.ok) {
    throw new Error('Failed to extract recipe. Please check the URL and try again.');
  }

  const data = await response.json();

  if (!data.title) {
    throw new Error('Could not find recipe information at this URL.');
  }

  return data;
}
