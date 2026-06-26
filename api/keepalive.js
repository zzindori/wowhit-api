// Supabase 무료 티어 자동 정지 방지용 keep-alive
// vercel.json cron으로 3일마다 실행
export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(503).json({ ok: false, error: 'Not configured' });
  }

  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/itne_material_index?select=keyword&limit=1`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    return res.status(200).json({ ok: true, status: r.status, ts: new Date().toISOString() });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
