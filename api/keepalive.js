// 모든 Supabase 프로젝트 자동 정지 방지 (3일마다 실행)
// careWay / shotWay+farmGuide / pingWay / itNe(SUPABASE_URL)
const TARGETS = [
  {
    name: 'careWay',
    url: 'https://dnnidnqwkjmbssxixpjg.supabase.co',
    key: process.env.SUPABASE_KEY_CAREWAY,
    table: 'careway_keepalive',
  },
  {
    name: 'shotWay/farmGuide',
    url: 'https://desxkxfhoyoslnmjrtoj.supabase.co',
    key: process.env.SUPABASE_KEY_SHOTWAY,
    table: 'shotway_keepalive',
  },
  {
    name: 'pingWay',
    url: 'https://xxkqyoduesuzvhuqxvnl.supabase.co',
    key: process.env.SUPABASE_KEY_PINGWAY,
    table: 'pingway_keepalive',
  },
  {
    name: 'itNe(shared)',
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_ANON_KEY,
    table: 'itne_material_index',
  },
];

async function ping(target) {
  if (!target.url || !target.key) return { name: target.name, ok: false, error: 'Not configured' };
  try {
    const r = await fetch(
      `${target.url}/rest/v1/${target.table}?select=*&limit=1`,
      { headers: { apikey: target.key, Authorization: `Bearer ${target.key}` } }
    );
    return { name: target.name, ok: r.status < 500, status: r.status };
  } catch (e) {
    return { name: target.name, ok: false, error: e.message };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const results = await Promise.all(TARGETS.map(ping));
  const allOk = results.every(r => r.ok);
  return res.status(allOk ? 200 : 207).json({ results, ts: new Date().toISOString() });
}
