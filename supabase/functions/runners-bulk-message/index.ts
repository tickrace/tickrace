// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { Resend } from "https://esm.sh/resend@3.2.0";

/** ENV requis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY
 *  Optionnel diag: TEST_KEY (clé secrète pour le self-test)
 */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const TEST_KEY = Deno.env.get("TEST_KEY") || "";

const resend = new Resend(RESEND_API_KEY);
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info, prefer, x-test-key",
  };
}
function json(obj: any, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });

  const t0 = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    console.log("[runners-bulk] start", { ts: new Date().toISOString() });

    /* ====== MODE SELF-TEST (bypass DB/JWT) ======
       Pour isoler Resend uniquement. Il faut header x-test-key = TEST_KEY.
       Body minimal :
       { "__self_test": true, "test_to": "ton@email" }
    */
    if (body?.__self_test === true) {
      const hdrKey = req.headers.get("x-test-key") || "";
      if (!TEST_KEY || hdrKey !== TEST_KEY) {
        console.error("[self-test] invalid x-test-key");
        return json({ error: "Forbidden self-test" }, 403, origin);
      }
      const to = (body?.test_to || "").trim();
      if (!to) return json({ error: "test_to requis" }, 400, origin);

      console.log("[self-test] sending via Resend to", to);
      try {
        const r = await resend.emails.send({
          from: "Tickrace <onboarding@resend.dev>",
          to,
          subject: "Tickrace self-test OK",
          text: "Si tu lis ceci, la function atteint bien Resend 👍",
        });
        console.log("[self-test] resend response", r?.id || r);
        return json({ ok: true, mode: "self-test", resend_id: r?.id ?? null }, 200, origin);
      } catch (e) {
        console.error("[self-test] resend error", e);
        return json({ error: "Resend error", details: String(e) }, 500, origin);
      }
    }

    /* ====== MODE NORMAL ====== */
    // 1) Auth (JWT dans Authorization)
    const auth = req.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return json({ error: "Missing Authorization Bearer token" }, 401, origin);
    const { data: ures, error: uerr } = await admin.auth.getUser(token);
    if (uerr || !ures?.user) return json({ error: "Invalid token" }, 401, origin);
    const userId = ures.user.id;

    const { inscription_ids, subject, message, include_statut, dry_run = false } = body ?? {};
    if (!Array.isArray(inscription_ids) || !inscription_ids.length)
      return json({ error: "inscription_ids requis (array non vide)" }, 400, origin);
    if (!subject || !message)
      return json({ error: "subject et message sont requis" }, 400, origin);

    console.log("[runners-bulk] step: load inscriptions");
    const { data: rows, error: rowsErr } = await admin
      .from("inscriptions")
      .select("id, statut, dossard, nom, prenom, email, format_id")
      .in("id", inscription_ids);
    if (rowsErr) {
      console.error("[db] inscriptions error", rowsErr);
      return json({ error: "DB error (inscriptions)" }, 500, origin);
    }

    const base = Array.isArray(include_statut) && include_statut.length
      ? (rows || []).filter((r) => include_statut.includes(r.statut))
      : (rows || []);

    console.log("[runners-bulk] step: load formats");
    const formatIds = Array.from(new Set(base.map((r) => r.format_id).filter(Boolean)));
    const { data: formats, error: fmtErr } = await admin
      .from("formats")
      .select("id, nom, course_id")
      .in("id", formatIds);
    if (fmtErr) {
      console.error("[db] formats error", fmtErr);
      return json({ error: "DB error (formats)" }, 500, origin);
    }
    const fmtMap = new Map((formats || []).map((f) => [f.id, f]));

    console.log("[runners-bulk] step: load courses");
    const courseIds = Array.from(new Set((formats || []).map((f) => f.course_id).filter(Boolean)));
    const { data: courses, error: cErr } = await admin
      .from("courses")
      .select("id, nom, lieu, organisateur_id")
      .in("id", courseIds);
    if (cErr) {
      console.error("[db] courses error", cErr);
      return json({ error: "DB error (courses)" }, 500, origin);
    }
    const courseMap = new Map((courses || []).map((c) => [c.id, c]));

    console.log("[runners-bulk] step: build targets");
    type Target = { email: string; prenom: string; nom: string; course: string; format: string; lieu: string; dossard: string; };
    const targets: Target[] = [];
    for (const r of base) {
      const f = fmtMap.get(r.format_id);
      const c = f ? courseMap.get(f.course_id) : null;
      const email = r?.email?.trim();
      if (!email || !f || !c) continue;
      if (c.organisateur_id !== userId) continue; // autorisation
      targets.push({
        email,
        prenom: String(r.prenom ?? "").trim(),
        nom: String(r.nom ?? "").trim(),
        course: String(c.nom ?? "").trim(),
        format: String(f.nom ?? "").trim(),
        lieu: String(c.lieu ?? "").trim(),
        dossard: r?.dossard ? String(r.dossard) : "",
      });
    }

    // dédupe
    const uniq = new Map<string, Target>();
    for (const t of targets) {
      const key = `${t.email.toLowerCase()}::${t.course}::${t.format}`;
      if (!uniq.has(key)) uniq.set(key, t);
    }
    const finalTargets = Array.from(uniq.values());

    if (dry_run) {
      console.log("[runners-bulk] DRY-RUN", { requested: inscription_ids.length, permitted: finalTargets.length });
      return json({
        ok: true,
        dry_run: true,
        requested: inscription_ids.length,
        permitted: finalTargets.length,
        will_send_to: finalTargets.length,
        sample: finalTargets.slice(0, 5),
      }, 200, origin);
    }

    console.log("[runners-bulk] step: send", { count: finalTargets.length });
    let sent = 0, failed = 0;
    const errors: Array<{ email: string; error: string }> = [];

    for (const t of finalTargets) {
      const ctx = t as Record<string, string>;
      const subj = (subject || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => ctx[k] ?? "");
      const text = (message || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => ctx[k] ?? "");
      try {
        await resend.emails.send({
          from: "Tickrace <onboarding@resend.dev>",
          to: t.email,
          subject: subj || "Tickrace",
          html: text.replace(/\n/g, "<br/>"),
          text,
        });
        sent++;
      } catch (e) {
        failed++;
        const msg = typeof e === "object" && e && "message" in e ? (e as any).message : String(e);
        console.error("[resend] send error", { email: t.email, msg });
        errors.push({ email: t.email, error: msg });
      }
    }

    console.log("[runners-bulk] done", { ms: Date.now() - t0, sent, failed });
    return json({ ok: true, sent, failed, attempted: finalTargets.length, errors }, 200, origin);

  } catch (e) {
    console.error("[runners-bulk] fatal", e);
    return json({ error: "Bad Request", details: String(e) }, 400, origin);
  }
});
