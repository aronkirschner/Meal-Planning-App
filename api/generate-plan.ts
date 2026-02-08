import type { VercelRequest, VercelResponse } from '@vercel/node';

interface Recipe {
  id: string;
  name: string;
  category: 'main' | 'vegetable' | 'grain' | 'other';
}

interface MealPlanRequest {
  prompt: string;
  recipes: Recipe[];
}

interface DayMeal {
  main?: string;
  vegetable?: string;
  grain?: string;
  other?: string;
}

interface GeneratedPlan {
  monday: DayMeal;
  tuesday: DayMeal;
  wednesday: DayMeal;
  thursday: DayMeal;
  friday: DayMeal;
  saturday: DayMeal;
  sunday: DayMeal;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  try {
    const { prompt, recipes } = req.body as MealPlanRequest;

    if (!prompt || !recipes) {
      return res.status(400).json({ error: 'Missing prompt or recipes' });
    }

    // Build recipe list for the prompt
    const recipesByCategory = {
      main: recipes.filter(r => r.category === 'main'),
      vegetable: recipes.filter(r => r.category === 'vegetable'),
      grain: recipes.filter(r => r.category === 'grain'),
      other: recipes.filter(r => r.category === 'other'),
    };

    const systemPrompt = `You are a meal planning assistant. The user will give you instructions for planning their weekly meals.

Available recipes:
MAIN DISHES: ${recipesByCategory.main.map(r => `"${r.name}" (id: ${r.id})`).join(', ') || 'None'}
VEGETABLES: ${recipesByCategory.vegetable.map(r => `"${r.name}" (id: ${r.id})`).join(', ') || 'None'}
GRAINS: ${recipesByCategory.grain.map(r => `"${r.name}" (id: ${r.id})`).join(', ') || 'None'}
OTHER: ${recipesByCategory.other.map(r => `"${r.name}" (id: ${r.id})`).join(', ') || 'None'}

Your task:
1. Parse the user's meal planning request
2. Match their requests to available recipes using fuzzy matching (e.g., "chicken" matches any chicken dish)
3. Fill ALL days with recipes from the available list

Return a JSON object with this exact structure:
{
  "monday": { "main": "recipe-id", "vegetable": "recipe-id", "grain": "recipe-id", "other": "recipe-id" },
  "tuesday": { ... },
  "wednesday": { ... },
  "thursday": { ... },
  "friday": { ... },
  "saturday": { ... },
  "sunday": { ... }
}

Rules:
- ALWAYS fill in main, vegetable, and grain for ALL 7 days of the week - never leave these empty
- ONLY use recipe IDs from the available recipes list - never create custom entries
- Do fuzzy matching: if user says "chicken", match any chicken recipe; "fish" matches salmon, tilapia, etc.
- If the user mentions specific meals, use those. For unspecified days, create a balanced variety from available recipes
- Try not to repeat the same recipe too many times in a week unless necessary
- The "other" field is optional and can be left empty if not specified
- Only return the JSON object, no other text`;

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
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      return res.status(500).json({ error: 'Failed to generate meal plan' });
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      return res.status(500).json({ error: 'No response from OpenAI' });
    }

    // Parse the JSON response
    let plan: GeneratedPlan;
    try {
      // Remove markdown code blocks if present
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      plan = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', content);
      return res.status(500).json({ error: 'Failed to parse meal plan response' });
    }

    return res.status(200).json({ plan });
  } catch (error) {
    console.error('Error generating meal plan:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
