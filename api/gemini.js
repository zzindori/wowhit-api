export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-proxy-secret, x-app-id, x-model');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = req.headers['x-proxy-secret'];
  const validSecrets = [process.env.PROXY_SECRET, process.env.PROXY_SECRET_WEB].filter(Boolean);
  if (!secret || !validSecrets.includes(secret)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const appId = (req.headers['x-app-id'] || '').toUpperCase();
  const userApiKey = req.body?.userApiKey;
  const apiKey = userApiKey || process.env[`GEMINI_API_KEY_${appId}`] || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ error: `No API key for app: ${appId}` });
  }

  const body = { ...req.body };
  delete body.userApiKey;

  const modalities = body.generationConfig?.responseModalities || [];
  const isImageGen = Array.isArray(modalities) && modalities.includes('IMAGE');

  const model = req.headers['x-model'] ||
    (isImageGen
      ? (process.env.GEMINI_IMAGE_MODEL || process.env.GEMINI_MODEL || 'gemini-3.1-flash-image')
      : (process.env.GEMINI_MODEL || 'gemini-2.5-flash'));

  if (model.includes('2.5') || model.includes('think')) {
    body.generationConfig = {
      ...(body.generationConfig || {}),
      thinkingConfig: { thinkingBudget: 0 },
    };
  }

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Proxy error', message: error.message });
  }
}
