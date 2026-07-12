import crypto from 'crypto';

// 코드 형식: IGMY-{serial:4}-{checksum:6}
// 예: IGMY-0001-ABCDEF → 항상 100크레딧
const CREDITS_PER_CODE = 100;
const VM_URL = process.env.VM_URL || 'http://152.67.208.156:3000';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: '코드를 입력해주세요' });

  const secret = process.env.IGOMOYA_CODE_SECRET;
  if (!secret) return res.status(500).json({ error: '서버 설정 오류' });

  const normalized = code.trim().toUpperCase().replace(/[-\s]/g, '');
  const match = normalized.match(/^IGMY(\d{4})([A-F0-9]{6})$/);
  if (!match) return res.status(400).json({ error: '유효하지 않은 코드 형식입니다' });

  const [, serial, checksum] = match;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`IGMY:${serial}`)
    .digest('hex')
    .slice(0, 6)
    .toUpperCase();

  if (expected !== checksum) {
    return res.status(400).json({ error: '유효하지 않은 코드입니다' });
  }

  try {
    const vmRes = await fetch(`${VM_URL}/igomoya/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-vm-secret': process.env.VM_SECRET },
      body: JSON.stringify({ code: normalized, credits: CREDITS_PER_CODE }),
    });
    const data = await vmRes.json();
    if (!vmRes.ok) return res.status(400).json({ error: data.error || '이미 사용된 코드입니다' });
    return res.status(200).json({ success: true, token: data.token, credits: data.credits });
  } catch (e) {
    return res.status(500).json({ error: '서버 오류: ' + e.message });
  }
}
