import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ── Firebase Admin init ──────────────────────────────────────────────────────
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

// ── Types ────────────────────────────────────────────────────────────────────
interface WhatsAppConfig {
  instanceId: string;
  apiToken: string;
  chatId: string;
  chatName: string;
  messageCount: number;
}

interface GreenApiMessage {
  typeMessage: string;
  textMessage?: string;
  caption?: string;
  timestamp: number;
  senderName: string;
  senderId: string;
}

// ── Green API helper ─────────────────────────────────────────────────────────
async function fetchMessages(
  instanceId: string,
  apiToken: string,
  chatId: string,
  count: number
): Promise<GreenApiMessage[]> {
  const url = `https://api.green-api.com/waInstance${instanceId}/getChatHistory/${apiToken}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, count }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Green API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<GreenApiMessage[]>;
}

// ── OpenAI helper ────────────────────────────────────────────────────────────
async function summarizeMessages(messages: GreenApiMessage[], chatName: string): Promise<string> {
  const lines = messages
    .filter((m) => m.typeMessage === 'textMessage' || m.typeMessage === 'extendedTextMessage')
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((m) => {
      const name = m.senderName || m.senderId;
      const text = m.textMessage ?? m.caption ?? '';
      return `${name}: ${text}`;
    })
    .join('\n');

  const prompt = `You are summarizing a WhatsApp group chat called "${chatName}".
Below are the most recent messages. Write a concise bullet-point summary covering:
- Main topics discussed
- Any decisions made or action items
- Any important announcements or links shared
- Overall tone/vibe of the conversation

Keep it under 300 words. Use plain text bullet points (start each with "• ").

Messages:
${lines}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${text}`);
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0]?.message?.content?.trim() ?? '';
}

// ── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.body as { userId?: string };
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  // Load user config from Firestore
  const configSnap = await db.doc(`users/${userId}/whatsappConfig/settings`).get();
  if (!configSnap.exists) {
    return res.status(400).json({ error: 'WhatsApp not configured. Please add your Green API credentials.' });
  }

  const config = configSnap.data() as WhatsAppConfig;

  // Use env-var credentials if set (recommended), fall back to stored config
  const instanceId = process.env.GREEN_API_INSTANCE_ID ?? config.instanceId;
  const apiToken = process.env.GREEN_API_TOKEN ?? config.apiToken;

  if (!instanceId || !apiToken) {
    return res.status(500).json({ error: 'Green API credentials not configured on the server.' });
  }

  try {
    const messages = await fetchMessages(instanceId, apiToken, config.chatId, config.messageCount ?? 200);

    if (messages.length === 0) {
      return res.status(200).json({ summary: 'No messages found in the selected period.' });
    }

    const summary = await summarizeMessages(messages, config.chatName || config.chatId);

    return res.status(200).json({ summary, messageCount: messages.length });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return res.status(500).json({ error: message });
  }
}
