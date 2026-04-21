import type { VercelRequest, VercelResponse } from '@vercel/node';

interface RecipeInput {
  id: string;
  name: string;
  ingredients: Array<{ name: string }>;
  directions: string[];
}

interface CookTimeEstimate {
  id: string;
  cookTime: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  const { recipes } = req.body as { recipes: RecipeInput[] };
  if (!recipes?.length) {
    return res.status(400).json({ error: 'Missing recipes' });
  }

  const recipeList = recipes.map(r => {
    const ingredients = r.ingredients.map(i => i.name).join(', ');
    const steps = r.directions.length;
    return `id:${r.id} | name:${r.name} | ingredients:${ingredients} | steps:${steps}`;
  }).join('\n');

  const systemPrompt = `You are a cooking expert. Estimate the total cook time (prep + cooking) in minutes for each recipe based on its name, ingredients, and number of steps. Return ONLY a JSON array of objects with "id" and "cookTime" (integer minutes). Be realistic — a simple salad might be 10 min, a roast might be 120 min.`;

  const userPrompt = `Estimate cook times for these recipes:\n${recipeList}\n\nReturn JSON array: [{"id":"...","cookTime":30},...]`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      return res.status(500).json({ error: 'OpenAI request failed' });
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content ?? '';
    const clean = content.replace(/```json\n?|\n?```/g, '').trim();
    const estimates: CookTimeEstimate[] = JSON.parse(clean);

    return res.status(200).json({ estimates });
  } catch (error) {
    console.error('Error estimating cook times:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
