// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const UNSUBSCRIBE_SECRET = Deno.env.get("UNSUBSCRIBE_SECRET")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

// ---- utils token HMAC (base64url) ----
const te = new TextEncoder();
const key = await crypto.subtle.importKey(
  "raw",
  te.encode(UNSUBSCRIBE_SECRET),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"],
);

function b64url(bytes: Uint8Array) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}
function b64urlToBytes(s: string) {
  s = s.replaceAll("-", "+").replaceAll("_", "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function verifyToken(t: string): Promise<{ email: string; course_id: string } | null> {
  const [p, s] = t.split(".");
  if (!p || !s) return null;
  const sig = b64urlToBytes(s);
  const ok = await crypto.subtle.verify("HMAC", key, sig, te.encode(p));
  if (!ok) return null;
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
  if (!payload?.email || !payload?.course_id) return null;
  if (payload.exp && Date.now() / 1000 > payload.exp) return null;
  return { email: String(payload.email), course_id: String(payload.course_id) };
}

function html(title: string, message: string) {
  return `<!doctype html><html lang="fr"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
<style>
  body{font-family: ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial; background:#f6f6f6; color:#111}
  .card{max-width:640px;margin:56px auto;padding:24px;border-radius:16px;background:#fff;box-shadow:0 6px 24px rgba(0,0,0,.08)}
  .title{font-size:20px;font-weight:700}
  .msg{margin-top:8px; color:#444; line-height:1.5}
  .note{margin-top:16px; font-size:12px; color:#666}
  a.btn{display:inline-block;margin-top:16px;padding:10px 14px;background:#111;color:#fff;border-radius:10px;text-decoration:none}
</style>
</head><body><div class="card">
  <div class="title">${title}</div>
  <div class="msg">${message}</div>
  <div class="note">Vous pourrez vous réinscrire plus tard en contactant l’organisateur.</div>
</div></body></html>`;
}

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const t = url.searchParams.get("t");
    if (!t) return new Response(html("Lien invalide", "Le lien est manquant."), { headers: { "Content-Type": "text/html" }, status: 400 });

    const data = await verifyToken(t);
    if (!data) return new Response(html("Lien invalide", "Le lien a expiré ou n’est pas valide."), { headers: { "Content-Type": "text/html" }, status: 400 });

    // Upsert suppression (idempotent via unique index)
    await admin.from("email_unsubscribes").upsert(
      { email: data.email, course_id: data.course_id },
      { onConflict: "email,course_id" },
    );

    return new Response(
      html("Désinscription confirmée", `L’adresse <b>${data.email}</b> ne recevra plus d’emails bénévoles pour cet événement.`),
      { headers: { "Content-Type": "text/html" } },
    );
  } catch (e) {
    return new Response(html("Erreur", "Une erreur est survenue."), { headers: { "Content-Type": "text/html" }, status: 500 });
  }
});
