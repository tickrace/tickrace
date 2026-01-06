const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (!SUPABASE_URL || !KEY) return res.status(500).json({ error: "missing env" });

  const url = `${SUPABASE_URL}/rest/v1/courses?select=id,nom&limit=3&order=created_at.desc`;
  const r = await fetch(url, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: "application/json" },
  });

  const txt = await r.text();
  res.status(r.status).setHeader("content-type", "application/json").send(txt);
}
