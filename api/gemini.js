const VM_URL = 'http://152.67.208.156:3000';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-proxy-secret, x-app-id, x-model, x-codid-token');
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

  // CODI:D 앱은 반드시 크레딧 토큰 필요 (무료 사용 없음)
  if (appId === 'CODID') {
    const codidToken = req.headers['x-codid-token'];
    if (!codidToken) {
      return res.status(402).json({ error: '크레딧이 필요합니다', code: 'NO_TOKEN' });
    }
    try {
      const vmRes = await fetch(`${VM_URL}/codid/use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-vm-secret': process.env.VM_SECRET },
        body: JSON.stringify({ token: codidToken }),
      });
      const vmData = await vmRes.json();
      if (!vmRes.ok) {
        const status = vmRes.status === 402 ? 402 : 403;
        return res.status(status).json({ error: vmData.error || '크레딧 부족', credits: vmData.credits ?? 0, code: 'NO_CREDITS' });
      }
      // 응답 헤더에 남은 크레딧 포함
      res.setHeader('x-codid-credits-remaining', vmData.credits);
    } catch (e) {
      return res.status(500).json({ error: '크레딧 서버 오류: ' + e.message });
    }
  }

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
