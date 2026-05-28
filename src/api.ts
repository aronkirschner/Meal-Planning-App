export interface ExtractedRecipe {
  title: string;
  sourceUrl: string;
  readyInMinutes?: number;
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
  const response = await fetch('/api/extract-recipe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `API Error (${response.status}): Please check the URL and try again.`);
  }

  return data;
}
