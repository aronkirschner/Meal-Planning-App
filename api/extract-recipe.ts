import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.SPOONACULAR_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Spoonacular API key not configured' });
  }

  const { url } = req.body as { url: string };
  if (!url) {
    return res.status(400).json({ error: 'Missing url' });
  }

  const response = await fetch(
    `https://api.spoonacular.com/recipes/extract?url=${encodeURIComponent(url)}&apiKey=${apiKey}`
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (response.status === 401) {
      return res.status(401).json({ error: 'Invalid API key. Please check your Spoonacular API key.' });
    } else if (response.status === 402) {
      return res.status(402).json({ error: 'API quota exceeded. Daily limit reached.' });
    }
    return res.status(response.status).json({ error: errorData.message || 'Please check the URL and try again.' });
  }

  const data = await response.json();

  if (!data.title) {
    return res.status(422).json({ error: 'Could not find recipe information at this URL.' });
  }

  return res.status(200).json(data);
}
