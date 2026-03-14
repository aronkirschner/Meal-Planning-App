const API_KEY = import.meta.env.VITE_SPOONACULAR_API_KEY as string;
const BASE_URL = 'https://api.spoonacular.com';

if (!API_KEY) {
  console.error('VITE_SPOONACULAR_API_KEY is not set. Recipe URL extraction will not work.');
}

export interface ExtractedRecipe {
  title: string;
  sourceUrl: string;
  extendedIngredients: Array<{
    original: string;
    name: string;
    amount: number;
    unit: string;
  }>;
  instructions: string;
  analyzedInstructions: Array<{
    steps: Array<{
      number: number;
      step: string;
    }>;
  }>;
}

export async function extractRecipeFromUrl(url: string): Promise<ExtractedRecipe> {
  const response = await fetch(
    `${BASE_URL}/recipes/extract?url=${encodeURIComponent(url)}&apiKey=${API_KEY}`
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('API Error:', response.status, errorData);

    if (response.status === 401) {
      throw new Error('Invalid API key. Please check your Spoonacular API key.');
    } else if (response.status === 402) {
      throw new Error('API quota exceeded. Daily limit reached.');
    } else {
      throw new Error(`API Error (${response.status}): ${errorData.message || 'Please check the URL and try again.'}`);
    }
  }

  const data = await response.json();

  if (!data.title) {
    throw new Error('Could not find recipe information at this URL.');
  }

  return data;
}
