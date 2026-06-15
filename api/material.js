const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const TABLE = 'itne_material_index';

async function supabaseRequest(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${res.status}: ${body}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-proxy-secret');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const secret = req.headers['x-proxy-secret'];
  const validSecrets = [process.env.PROXY_SECRET, process.env.PROXY_SECRET_WEB].filter(Boolean);
  if (!secret || !validSecrets.includes(secret)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(503).json({ error: 'Shared DB not configured' });
  }

  try {
    if (req.method === 'GET') {
      const q = (req.query.q || '').trim().toLowerCase();
      if (!q) return res.status(400).json({ error: 'Missing q' });

      const rows = await supabaseRequest(
        `${TABLE}?keyword=eq.${encodeURIComponent(q)}&select=*`,
        { method: 'GET', headers: { 'Prefer': '' } },
      );
      return res.status(200).json(rows || []);
    }

    if (req.method === 'POST') {
      const items = req.body?.items;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Missing items array' });
      }

      const rows = items.map(item => ({
        keyword: (item.keyword || '').toLowerCase().trim(),
        category: item.category || 'ETC',
        primary_label: item.primaryLabel || '',
        secondary_label: item.secondaryLabel || null,
        state_tags: item.stateTags || [],
        aliases: item.aliases || [],
        description: item.description || null,
      })).filter(r => r.keyword);

      await supabaseRequest(TABLE, {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows),
      });
      return res.status(200).json({ saved: rows.length });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
