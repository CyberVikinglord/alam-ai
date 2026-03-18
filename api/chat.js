// api/chat.js — Vercel Serverless Function (Node.js)
// Connects your frontend to the Anthropic Claude API securely.

export default async function handler(req, res) {

  // ── CORS Headers ──
  // Allow your GitHub Pages site to call this endpoint.
  // Replace '*' with your exact GitHub Pages URL for stricter security,
  // e.g. 'https://yourusername.github.io'
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle browser preflight check
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  // ── Read incoming message ──
  const { message, history = [] } = req.body;

  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ error: 'No message provided.' });
  }

  // ── API Key (from Vercel Environment Variable) ──
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is not set in environment variables.');
    return res.status(500).json({ error: 'Server configuration error: API key missing.' });
  }

  // ── Build conversation history for Claude ──
  // We pass previous messages so Claude remembers the conversation.
  const claudeMessages = [
    // Inject prior conversation turns (already formatted as {role, content})
    ...history.map(turn => ({
      role: turn.role === 'assistant' ? 'assistant' : 'user',
      content: turn.content
    })),
    // Add the new user message
    { role: 'user', content: message.trim() }
  ];

  try {
    // ── Call Anthropic Claude API ──
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':         'application/json',
        'x-api-key':            apiKey,
        'anthropic-version':    '2023-06-01'
      },
      body: JSON.stringify({
        model:      'claude-opus-4-5',   // Use the latest Claude model
        max_tokens: 2048,
        system:     'You are Alam AI, a helpful, intelligent, and friendly AI assistant. Respond clearly and concisely. You were created by Alam.',
        messages:   claudeMessages
      })
    });

    if (!anthropicRes.ok) {
      const errData = await anthropicRes.json().catch(() => ({}));
      console.error('Anthropic API error:', errData);
      return res.status(anthropicRes.status).json({
        error: errData?.error?.message || 'Anthropic API returned an error.'
      });
    }

    const data = await anthropicRes.json();

    // Extract the reply text
    const reply = data?.content?.[0]?.text ?? 'I could not generate a response.';

    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Unexpected server error:', err);
    return res.status(500).json({ error: 'An unexpected error occurred on the server.' });
  }
}
