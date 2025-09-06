// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { Resend } from "https://esm.sh/resend@3.2.0";

/** ENV requis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const resend = new Resend(RESEND_API_KEY);
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

/* CORS (prod + localhost + *.vercel.app) */
function okOrigin(origin: string | null) {
  if (!origin) return false;
  try {
    const { host } = new URL(origin);
    const h = host.toLowerCase();
    return h === "tickrace.com" || h === "www.tickrace.com" || h.endsWith(".vercel.app") || h.startsWith("localhost:") || h.startsWith("127.0.0.1:");
  } catch { return false; }
}
function corsHeaders(origin: string | null) {
  const allow = okOrigin(origin) ? origin! : "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, prefer",
  };
}
function json(obj: any, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } });
}

/* Helpers */
function esc(s: string){return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
function toHtml(text: string){const safe=esc(text);const parts=safe.split(/\n{2,}/g).map(p=>p.replace(/\n/g,"<br/>"));return parts.map(p=>`<p>${p}</p>`).join("");}
function renderTpl(tpl: string, ctx: Record<string,string>){return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g,(_,k)=>ctx[k] ?? "");}
function chunk<T>(arr:T[],size:number){const out:T[][]=[];for(let i=0;i<arr.length;i+=size)out.push(arr.slice(i,i+size));return out;}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });

  try {
    // Auth JWT côté code (laisse passer OPTIONS)
    const auth = req.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return json({ error: "Missing Authorization Bearer token" }, 401, origin);
    const { data: ures, error: uerr } = await admin.auth.getUser(token);
    if (uerr || !ures?.user) return json({ error: "Invalid token" }, 401, origin);
    const userId = ures.user.id;

    const body = await req.json();
    const { inscription_ids, subject, message, include_statut, dry_run=false } = body ?? {};
    if (!Array.isArray(inscription_ids) || !inscription_ids.length) return json({ error: "inscription_ids requis (array non vide)" }, 400, origin);
    if (!subject || !message) return json({ error: "subject et message sont requis" }, 400, origin);

    // 1) inscriptions (schema: nom, prenom, email, dossard dans la table)
    const { data: rows, error: rowsErr } = await admin
      .from("inscriptions")
      .select("id, statut, dossard, nom, prenom, email, format_id")
      .in("id", inscription_ids);
    if (rowsErr) return json({ error: "DB error (inscriptions)" }, 500, origin);

    const base = Array.isArray(include_statut) && include_statut.length
      ? (rows || []).filter(r => include_statut.includes(r.statut))
      : (rows || []);

    // 2) formats -> course_id + nom
    const formatIds = Array.from(new Set(base.map(r => r.format_id).filter(Boolean)));
    const { data: formats, error: fmtErr } = await admin
      .from("formats").select("id, nom, course_id").in("id", formatIds);
    if (fmtErr) return json({ error: "DB error (formats)" }, 500, origin);
    const fmtMap = new Map((formats||[]).map(f => [f.id, f]));

    // 3) courses -> autorisation + nom/lieu
    const courseIds = Array.from(new Set((formats||[]).map(f => f.course_id).filter(Boolean)));
    const { data: courses, error: cErr } = await admin
      .from("courses").select("id, nom, lieu, organisateur_id").in("id", courseIds);
    if (cErr) return json({ error: "DB error (courses)" }, 500, origin);
    const courseMap = new Map((courses||[]).map(c => [c.id, c]));

    // 4) autorisation: course.organisateur_id === userId
    const permitted = base.filter((r) => {
      const f = fmtMap.get(r.format_id);
      const c = f ? courseMap.get(f.course_id) : null;
      return c && c.organisateur_id === userId;
    });

    // 5) cibles
    type Target = { inscription_id:string; email:string; prenom:string; nom:string; course:string; format:string; lieu:string; dossard:string; };
    const targets: Target[] = [];
    for (const r of permitted) {
      const f = fmtMap.get(r.format_id);
      const c = f ? courseMap.get(f.course_id) : null;
      const email = r?.email?.trim();
      if (!email || !f || !c) continue;
      targets.push({
        inscription_id: r.id,
        email,
        prenom: String(r.prenom ?? "").trim(),
        nom: String(r.nom ?? "").trim(),
        course: String(c.nom ?? "").trim(),
        format: String(f.nom ?? "").trim(),
        lieu: String(c.lieu ?? "").trim(),
        dossard: r?.dossard ? String(r.dossard) : "",
      });
    }

    // 6) dédupe (email + course + format)
    const uniq = new Map<string, Target>();
    for (const t of targets) {
      const key = `${t.email.toLowerCase()}::${t.course}::${t.format}`;
      if (!uniq.has(key)) uniq.set(key, t);
    }
    const finalTargets = Array.from(uniq.values());

    if (dry_run) {
      return json({
        ok: true,
        dry_run: true,
        requested: inscription_ids.length,
        permitted: permitted.length,
        permitted_after_filters: permitted.length,
        will_send_to: finalTargets.length,
        sample: finalTargets.slice(0, 5),
      }, 200, origin);
    }

    // 7) envoi Resend (expéditeur garanti)
    const FROM = "Tickrace <onboarding@resend.dev>"; // <- garanti par Resend
    const REPLY_TO = "contact@tickrace.com";         // ajuste si besoin

    const MAX_CONCURRENCY = 10;
    let sent = 0, failed = 0;
    const errors: Array<{email:string; error:string}> = [];

    for (const part of chunk(finalTargets, MAX_CONCURRENCY)) {
      const results = await Promise.allSettled(part.map(async (t) => {
        const ctx = t as Record<string,string>;
        const subj = renderTpl(subject, ctx);
        const text = renderTpl(message, ctx);
        const html = toHtml(text);
        try {
          await resend.emails.send({
            from: FROM,
            to: t.email,
            subject: subj,
            html,
            text,
            reply_to: REPLY_TO,
            tags: [
              { name: "context", value: "runners-bulk" },
              { name: "course", value: t.course },
              { name: "format", value: t.format },
            ],
          });
          sent++;
        } catch (e) {
          failed++;
          const msg = typeof e === "object" && e && "message" in e ? (e as any).message : String(e);
          errors.push({ email: t.email, error: msg });
        }
      }));
      void results;
    }

    return json({ ok:true, requested:inscription_ids.length, permitted:permitted.length, permitted_after_filters:permitted.length, attempted:finalTargets.length, sent, failed, errors }, 200, origin);

  } catch (e) {
    console.error("Function error:", e);
    return json({ error: "Bad Request", details: String(e) }, 400, origin);
  }
});
