export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-proxy-secret');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 썸네일 프록시: 공개 이미지라 인증 불필요, 인증 체크 전에 처리
  const { q, maxResults = '10', thumb } = req.query;

  if (thumb) {
    const decoded = decodeURIComponent(thumb);
    if (!decoded.startsWith('https://i.ytimg.com/')) {
      return res.status(400).json({ error: 'Invalid thumbnail host' });
    }
    try {
      const thumbRes = await fetch(decoded);
      const contentType = thumbRes.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      const buf = await thumbRes.arrayBuffer();
      return res.status(200).send(Buffer.from(buf));
    } catch (error) {
      return res.status(502).json({ error: 'Thumbnail fetch failed' });
    }
  }

  const secret = req.headers['x-proxy-secret'];
  const validSecrets = [process.env.PROXY_SECRET, process.env.PROXY_SECRET_WEB].filter(Boolean);
  if (!secret || !validSecrets.includes(secret)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ error: 'No YouTube API key configured' });
  }

  if (!q) {
    return res.status(400).json({ error: 'Missing query parameter q' });
  }

  const youtubeUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&maxResults=${maxResults}&type=video&relevanceLanguage=ko&regionCode=KR&key=${apiKey}`;

  try {
    const response = await fetch(youtubeUrl);
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Proxy error', message: error.message });
  }
}
