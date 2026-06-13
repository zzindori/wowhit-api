export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = req.headers['x-proxy-secret'];
  if (!secret || secret !== process.env.PROXY_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const appId = (req.headers['x-app-id'] || '').toUpperCase();
  const userApiKey = req.body?.userApiKey;
  const apiKey = userApiKey || process.env[`GEMINI_API_KEY_${appId}`] || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ error: `No API key for app: ${appId}` });
  }

  // Strip userApiKey from body before forwarding to Gemini
  if (userApiKey && req.body) {
    delete req.body.userApiKey;
  }

  const model = req.headers['x-model'] || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Proxy error', message: error.message });
  }
}
