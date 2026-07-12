const VM_URL = process.env.VM_URL || 'http://152.67.208.156:3000';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const token = req.query.token;
  if (!token) return res.status(400).json({ error: '토큰 없음' });

  try {
    const vmRes = await fetch(`${VM_URL}/menuwayall/balance?token=${encodeURIComponent(token)}`);
    const data = await vmRes.json();
    return res.status(vmRes.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: '서버 오류: ' + e.message });
  }
}
