export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-proxy-secret, x-app-id, x-model, x-codid-token, x-menuwayall-token, x-igomoya-token, x-skip-credit');
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

  // 크레딧 기반 앱: CODI:D는 항상 토큰 필요, menuWayAll은 무료 사용분 동안은 토큰 없이 통과
  const CREDIT_APPS = {
    CODID: { reqHeader: 'x-codid-token', resHeader: 'x-codid-credits-remaining', vmPath: 'codid', required: true },
    MENUWAYALL: { reqHeader: 'x-menuwayall-token', resHeader: 'x-menuwayall-credits-remaining', vmPath: 'menuwayall', required: false },
    IGOMOYA: { reqHeader: 'x-igomoya-token', resHeader: 'x-igomoya-credits-remaining', vmPath: 'igomoya', required: false },
  };
  const creditApp = CREDIT_APPS[appId];

  if (creditApp && !userApiKey) {
    const creditToken = req.headers[creditApp.reqHeader];
    if (!creditToken) {
      if (creditApp.required) {
        return res.status(402).json({ error: 'NO_TOKEN', message: 'API 키 또는 크레딧이 필요합니다' });
      }
      // 크레딧 토큰이 필수가 아닌 앱(menuWayAll 무료 사용분)은 게이팅 없이 통과
    } else {
      const vmUrl = process.env.VM_URL || 'http://152.67.208.156:3000';
      const vmSecret = process.env.VM_SECRET;
      const skipCredit = req.headers['x-skip-credit'] === '1';
      try {
        if (skipCredit) {
          // 같은 액션의 추가 호출: 차감 없이 토큰 유효성만 검증
          const validateResp = await fetch(`${vmUrl}/${creditApp.vmPath}/balance?token=${encodeURIComponent(creditToken)}`);
          if (!validateResp.ok) {
            return res.status(402).json({ error: 'INVALID_TOKEN', message: '유효하지 않은 크레딧입니다' });
          }
          const validateData = await validateResp.json();
          res.setHeader(creditApp.resHeader, validateData.credits ?? 0);
        } else {
          // 액션 첫 호출: 크레딧 차감
          const deductResp = await fetch(`${vmUrl}/${creditApp.vmPath}/use`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-vm-secret': vmSecret },
            body: JSON.stringify({ token: creditToken }),
          });
          const deductData = await deductResp.json();
          if (!deductResp.ok) {
            return res.status(deductResp.status).json(deductData);
          }
          res.setHeader(creditApp.resHeader, deductData.credits ?? 0);
        }
      } catch (e) {
        return res.status(503).json({ error: 'CREDIT_SERVER_ERROR', message: e.message });
      }
    }
  }

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

  // 이미지 생성 모델은 thinkingConfig를 지원하지 않으므로 제외.
  // 텍스트/비전 모델은 호출측이 명시적으로 thinkingConfig를 지정하지 않는 한
  // 기본적으로 thinking을 꺼서 불필요한 thinking 토큰 과금을 막는다.
  // (버전 문자열 매칭 방식은 모델명이 바뀌면 조용히 무력화되므로 기본값 방식으로 변경)
  if (!isImageGen && !body.generationConfig?.thinkingConfig) {
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
