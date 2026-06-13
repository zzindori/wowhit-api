export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = req.headers['x-proxy-secret'];
  if (!secret || secret !== process.env.PROXY_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const appId = (req.headers['x-app-id'] || '').toUpperCase();
  const apiKey = process.env[`GEMINI_API_KEY_${appId}`] || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ error: `No API key for app: ${appId}` });
  }

  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

  return res.status(200).json({ apiKey, model });
}
