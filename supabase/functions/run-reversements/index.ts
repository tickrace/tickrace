// supabase/functions/run-reversements/index.ts
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

/* ------------------------------ ENV ------------------------------ */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

// ✅ Resend
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "TickRace <support@tickrace.com>";
const TICKRACE_BASE_URL = Deno.env.get("TICKRACE_BASE_URL") || "https://www.tickrace.com";

/* --------------------------- Clients ----------------------------- */
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/* ------------------------------ CORS ----------------------------- */
function cors(h = new Headers()) {
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "content-type, authorization, apikey, x-client-info");
  h.set("content-type", "application/json; charset=utf-8");
  return h;
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors() });

/* ----------------------------- Stripe ---------------------------- */
const STRIPE_API = "https://api.stripe.com/v1";
async function stripePost(
  path: string,
  params: Record<string, string>,
  opts?: { idempotencyKey?: string },
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (opts?.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;

  const resp = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers,
    body: new URLSearchParams(params),
  });

  const txt = await resp.text();
  let parsed: any = null;
  try {
    parsed = JSON.parse(txt);
  } catch {
    // ignore
  }

  if (!resp.ok) {
    console.error("STRIPE_POST_ERROR", path, resp.status, txt);
    throw new Error(`Stripe POST failed: ${path}`);
  }
  return parsed;
}

/* ---------------------------- Helpers ---------------------------- */
function eurFromCents(c: number) {
  const v = Number(c || 0) / 100;
  return v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

// Monday 00:00 UTC for given date
function startOfWeekMondayUtc(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
  const day = x.getUTCDay(); // 0=Sun ... 1=Mon
  const diff = (day + 6) % 7; // Mon=0, Tue=1 ... Sun=6
  x.setUTCDate(x.getUTCDate() - diff);
  return x;
}

function isoDateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function computeNetTotalForPaiement(paiementId: string): Promise<number> {
  const { data, error } = await supabase
    .from("organisateur_ledger")
    .select("net_org_cents")
    .eq("source_table", "paiements")
    .eq("source_id", paiementId)
    .eq("status", "confirmed")
    .limit(2000);

  if (error) throw error;
  return (data || []).reduce((s, r) => s + Number((r as any).net_org_cents || 0), 0);
}

/**
 * ✅ Option B blindée :
 * déjàVersé = somme de tous les reversements "paid" pour ce paiement
 * (inclut les reversements manuels si tu les mets dans organisateur_reversements)
 */
async function computeAlreadyPaidForPaiement(paiementId: string): Promise<number> {
  const { data, error } = await supabase
    .from("organisateur_reversements")
    .select("amount_cents")
    .eq("paiement_id", paiementId)
    .eq("status", "paid")
    .limit(2000);

  if (error) throw error;
  return (data || []).reduce((s, r) => s + Number((r as any).amount_cents || 0), 0);
}

async function markStatus(id: string, patch: any) {
  const { error } = await supabase
    .from("organisateur_reversements")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/* ---------------------------- Resend ----------------------------- */
async function resendSendEmail(payload: { to: string; subject: string; text: string; html?: string }) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY manquant");

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [payload.to],
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    }),
  });

  const out = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    console.error("RESEND_ERROR", resp.status, out);
    throw new Error((out as any)?.message || "Resend send failed");
  }
  return out; // { id: "..." }
}

async function getOrganisateurEmailAndName(organisateur_id: string) {
  const { data: prof, error } = await supabase
    .from("profils_utilisateurs")
    .select("email, orga_email_facturation, organisation_nom, prenom, nom")
    .eq("user_id", organisateur_id)
    .maybeSingle();
  if (error) throw error;

  const to = (prof as any)?.orga_email_facturation || (prof as any)?.email || null;

  const orgName =
    (prof as any)?.organisation_nom ||
    [((prof as any)?.prenom || "").trim(), ((prof as any)?.nom || "").trim()].filter(Boolean).join(" ") ||
    "Organisateur";

  return { to, orgName };
}

async function getCourseName(course_id: string | null) {
  if (!course_id) return "—";
  const { data, error } = await supabase.from("courses").select("nom").eq("id", course_id).maybeSingle();
  if (error) throw error;
  return (data as any)?.nom || "—";
}

/**
 * ✅ Email FINAL (Tranche 2) — version PRO + anti-doublon via ledger.source_key unique
 * (idempotence par reversement_id)
 */
async function sendFinalPayoutEmailOnce(params: {
  organisateur_id: string;
  course_id: string | null;
  reversement_id: string;
  tranche: number; // ici = 2
  amount_cents: number;
  stripe_transfer_id: string;
  paiement_id: string;
}) {
  if (!RESEND_API_KEY) return { skipped: true, reason: "missing_resend_key" };

  const lockKey = `reversements:${params.reversement_id}:payout_email_final`;

  // lock
  const { error: lockErr } = await supabase.from("organisateur_ledger").insert({
    organisateur_id: params.organisateur_id,
    course_id: params.course_id,
    source_table: "organisateur_reversements",
    source_id: params.reversement_id,
    source_event: "payout_email_final",
    source_key: lockKey,
    occurred_at: new Date().toISOString(),
    gross_cents: 0,
    tickrace_fee_cents: 0,
    stripe_fee_cents: 0,
    net_org_cents: 0,
    currency: "eur",
    status: "pending",
    label: `Email reversement final (tranche ${params.tranche})`,
    metadata: {
      paiement_id: params.paiement_id,
      transfer_id: params.stripe_transfer_id,
      tranche: params.tranche,
      amount_cents: params.amount_cents,
      email_status: "pending",
    },
  });

  if (lockErr) {
    const code = (lockErr as any)?.code || "";
    if (code === "23505") return { skipped: true, reason: "already_sent" };
    console.error("EMAIL_LOCK_INSERT_ERROR", lockErr);
    return { skipped: true, reason: "lock_insert_failed" };
  }

  const { to, orgName } = await getOrganisateurEmailAndName(params.organisateur_id);
  if (!to) {
    await supabase
      .from("organisateur_ledger")
      .update({
        status: "void",
        metadata: { ...{}, email_status: "failed", error: "no_recipient_email" },
      })
      .eq("source_key", lockKey);
    return { skipped: true, reason: "no_recipient_email" };
  }

  const courseName = await getCourseName(params.course_id);
  const amountTxt = eurFromCents(params.amount_cents);
  const comptaUrl = `${TICKRACE_BASE_URL}/organisateur/compta`;

  const subject = `TickRace — Reversement final effectué (${amountTxt})`;

  const text = [
    `Bonjour ${orgName},`,
    "",
    `Votre reversement final TickRace a bien été effectué sur votre compte Stripe.`,
    "",
    `Détails :`,
    `- Course : ${courseName}`,
    `- Tranche : ${params.tranche}`,
    `- Montant : ${amountTxt}`,
    `- Transfer Stripe : ${params.stripe_transfer_id}`,
    "",
    `Consulter vos reversements : ${comptaUrl}`,
    "",
    `Besoin d’aide ? support@tickrace.com`,
    `— TickRace`,
  ].join("\n");

  const preheader = `Reversement final : ${amountTxt} — ${courseName}`;
  const brand = "TickRace";
  const accent = "#f97316";
  const bg = "#f5f5f5";
  const card = "#ffffff";
  const textColor = "#111827";
  const muted = "#6b7280";
  const border = "#e5e7eb";
  const safe = (v: any) => String(v ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const html = `<!doctype html>
<html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${brand} — Reversement</title></head>
  <body style="margin:0;padding:0;background:${bg};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safe(preheader)}</div>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${bg};padding:24px 0;">
      <tr><td align="center" style="padding:0 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;width:100%;">

          <tr><td style="padding:0 0 14px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="left" style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;color:${textColor};">
                  <div style="font-size:18px;font-weight:800;letter-spacing:-0.02em;">
                    <span style="color:${accent};">●</span> ${brand}
                  </div>
                  <div style="font-size:12px;color:${muted};margin-top:4px;">Reversement organisateur</div>
                </td>
                <td align="right" style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;color:${muted};font-size:12px;">
                  ${new Date().toLocaleDateString("fr-FR")}
                </td>
              </tr>
            </table>
          </td></tr>

          <tr><td style="background:${card};border:1px solid ${border};border-radius:16px;overflow:hidden;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:18px 18px 8px 18px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;color:${textColor};">
                <div style="font-size:18px;font-weight:800;letter-spacing:-0.02em;">Reversement final effectué ✅</div>
                <div style="margin-top:6px;font-size:14px;color:${muted};">
                  Bonjour <b>${safe(orgName)}</b>, votre reversement final a bien été envoyé vers votre compte Stripe.
                </div>
              </td></tr>

              <tr><td style="padding:0 18px 14px 18px;">
                <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;padding:14px;">
                  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;color:${muted};font-size:12px;">Montant versé</div>
                  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;color:${textColor};font-size:26px;font-weight:900;letter-spacing:-0.02em;margin-top:4px;">
                    ${safe(amountTxt)}
                  </div>
                </div>
              </td></tr>

              <tr><td style="padding:0 18px 18px 18px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0 10px;">
                  <tr><td style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;font-size:13px;color:${muted};width:140px;">Course</td>
                      <td style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;font-size:13px;color:${textColor};font-weight:600;">${safe(courseName)}</td></tr>
                  <tr><td style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;font-size:13px;color:${muted};">Tranche</td>
                      <td style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;font-size:13px;color:${textColor};font-weight:600;">${safe(String(params.tranche))}</td></tr>
                  <tr><td style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;font-size:13px;color:${muted};">Transfer Stripe</td>
                      <td style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;font-size:12px;color:${textColor};">${safe(params.stripe_transfer_id)}</td></tr>
                  <tr><td style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;font-size:13px;color:${muted};">Paiement</td>
                      <td style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;font-size:12px;color:${textColor};">${safe(params.paiement_id)}</td></tr>
                </table>

                <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:8px;">
                  <tr><td align="left">
                    <a href="${safe(comptaUrl)}" target="_blank" rel="noopener noreferrer"
                       style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;
                              font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;font-size:14px;font-weight:700;
                              padding:12px 16px;border-radius:12px;">
                      Voir ma compta organisateur
                    </a>
                  </td></tr>
                </table>

                <div style="margin-top:12px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;color:${muted};font-size:12px;line-height:1.4;">
                  Une question ? <a href="mailto:support@tickrace.com" style="color:${accent};text-decoration:none;font-weight:700;">support@tickrace.com</a>
                </div>
              </td></tr>
            </table>
          </td></tr>

          <tr><td style="padding:14px 4px 0 4px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;color:${muted};font-size:12px;line-height:1.5;">
            <div style="text-align:center;">— ${brand} • <a href="${safe(TICKRACE_BASE_URL)}" style="color:${muted};text-decoration:underline;">${safe(
    TICKRACE_BASE_URL,
  )}</a></div>
            <div style="text-align:center;margin-top:6px;color:${muted};">Ceci est un email automatique. Merci de ne pas répondre.</div>
          </td></tr>

        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  try {
    const out = await resendSendEmail({ to, subject, text, html });

    await supabase
      .from("organisateur_ledger")
      .update({
        status: "confirmed",
        metadata: {
          paiement_id: params.paiement_id,
          transfer_id: params.stripe_transfer_id,
          tranche: params.tranche,
          amount_cents: params.amount_cents,
          email_status: "sent",
          resend_id: (out as any)?.id || null,
          sent_to: to,
          sent_at: new Date().toISOString(),
        },
      })
      .eq("source_key", lockKey);

    return { ok: true };
  } catch (e: any) {
    console.error("RESEND_SEND_FAILED", e);
    await supabase
      .from("organisateur_ledger")
      .update({
        status: "void",
        metadata: { email_status: "failed", error: String(e?.message ?? e) },
      })
      .eq("source_key", lockKey);
    return { ok: false };
  }
}

/**
 * ✅ Digest hebdo Tranche 1 (1 seul email / orga / semaine précédente)
 * - Fenêtre: [prevMonday, thisMonday)
 * - Idempotence: source_key unique = reversements:{orga}:t1_weekly:{prevMonday}
 * - Contenu: total + lignes par course + nb reversements
 */
async function sendWeeklyTranche1DigestPreviousWeek(): Promise<{ sent: number; skipped: number }> {
  if (!RESEND_API_KEY) return { sent: 0, skipped: 0 };

  const now = new Date();
  const thisMon = startOfWeekMondayUtc(now);
  const prevMon = new Date(thisMon.getTime() - 7 * 24 * 60 * 60 * 1000);

  const fromIso = prevMon.toISOString();
  const toIso = thisMon.toISOString();

  // récupérer tous les reversements tranche 1 payés sur la semaine précédente
  const { data: rows, error } = await supabase
    .from("organisateur_reversements")
    .select("id, organisateur_id, course_id, paiement_id, tranche, amount_cents, stripe_transfer_id, executed_at, status")
    .eq("status", "paid")
    .eq("tranche", 1)
    .gte("executed_at", fromIso)
    .lt("executed_at", toIso)
    .limit(5000);

  if (error) {
    console.error("WEEKLY_T1_QUERY_ERROR", error);
    return { sent: 0, skipped: 0 };
  }
  if (!rows?.length) return { sent: 0, skipped: 0 };

  // group by orga
  const byOrga = new Map<string, any[]>();
  for (const r of rows) {
    const k = String((r as any).organisateur_id || "");
    if (!k) continue;
    const arr = byOrga.get(k) || [];
    arr.push(r);
    byOrga.set(k, arr);
  }

  // cache course names (bulk)
  const courseIds = Array.from(
    new Set(
      rows
        .map((r: any) => r.course_id)
        .filter(Boolean)
        .map(String),
    ),
  );

  const courseNameMap = new Map<string, string>();
  if (courseIds.length) {
    const { data: cs, error: ce } = await supabase.from("courses").select("id, nom").in("id", courseIds).limit(5000);
    if (ce) console.warn("WEEKLY_T1_COURSES_WARN", ce);
    for (const c of cs || []) {
      courseNameMap.set(String((c as any).id), String((c as any).nom || "—"));
    }
  }

  let sent = 0;
  let skipped = 0;

  for (const [organisateur_id, list] of byOrga.entries()) {
    const lockKey = `reversements:${organisateur_id}:t1_weekly:${isoDateOnly(prevMon)}`;

    // lock unique dans ledger
    const { error: lockErr } = await supabase.from("organisateur_ledger").insert({
      organisateur_id,
      course_id: null,
      source_table: "organisateur_reversements",
      source_id: list[0].id, // anchor arbitraire
      source_event: "payout_email_weekly_t1",
      source_key: lockKey,
      occurred_at: new Date().toISOString(),
      gross_cents: 0,
      tickrace_fee_cents: 0,
      stripe_fee_cents: 0,
      net_org_cents: 0,
      currency: "eur",
      status: "pending",
      label: `Email hebdo tranche 1 (${isoDateOnly(prevMon)} → ${isoDateOnly(thisMon)})`,
      metadata: {
        period_from: fromIso,
        period_to: toIso,
        reversements_count: list.length,
        email_status: "pending",
      },
    });

    if (lockErr) {
      const code = (lockErr as any)?.code || "";
      if (code === "23505") {
        skipped++;
        continue;
      }
      console.error("WEEKLY_T1_LOCK_ERROR", organisateur_id, lockErr);
      skipped++;
      continue;
    }

    try {
      const { to, orgName } = await getOrganisateurEmailAndName(organisateur_id);
      if (!to) {
        await supabase
          .from("organisateur_ledger")
          .update({ status: "void", metadata: { email_status: "failed", error: "no_recipient_email" } })
          .eq("source_key", lockKey);
        skipped++;
        continue;
      }

      // agrégations
      const total = list.reduce((s: number, r: any) => s + Number(r.amount_cents || 0), 0);

      const perCourse = new Map<string, { course_id: string; course_nom: string; total: number; count: number }>();
      for (const r of list) {
        const cid = String(r.course_id || "");
        const name = cid ? courseNameMap.get(cid) || "—" : "—";
        const prev = perCourse.get(cid) || { course_id: cid, course_nom: name, total: 0, count: 0 };
        prev.total += Number(r.amount_cents || 0);
        prev.count += 1;
        prev.course_nom = name;
        perCourse.set(cid, prev);
      }

      const items = Array.from(perCourse.values()).sort((a, b) => b.total - a.total);

      const comptaUrl = `${TICKRACE_BASE_URL}/organisateur/compta`;
      const periodLabel = `${isoDateOnly(prevMon)} → ${isoDateOnly(thisMon)}`;
      const subject = `TickRace — Récap hebdo reversements (tranche 1) — ${eurFromCents(total)}`;

      const textLines = [
        `Bonjour ${orgName},`,
        "",
        `Voici votre récapitulatif hebdomadaire des reversements tranche 1.`,
        `Période : ${periodLabel}`,
        "",
        `Total versé (tranche 1) : ${eurFromCents(total)}`,
        `Nombre de reversements : ${list.length}`,
        "",
        `Détail par course :`,
        ...items.map((x) => `- ${x.course_nom} : ${eurFromCents(x.total)} (${x.count} reversement(s))`),
        "",
        `Consulter votre compta : ${comptaUrl}`,
        "",
        `Besoin d’aide ? support@tickrace.com`,
        `— TickRace`,
      ];

      const safe = (v: any) => String(v ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const html = `<!doctype html>
<html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>TickRace — Récap hebdo</title></head>
  <body style="margin:0;padding:0;background:#f5f5f5;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Récap hebdo reversements tranche 1 — ${safe(eurFromCents(total))}
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f5f5f5;padding:24px 0;">
      <tr><td align="center" style="padding:0 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;width:100%;">
          <tr><td style="padding:0 0 14px 0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;color:#111827;">
            <div style="font-size:18px;font-weight:800;letter-spacing:-0.02em;"><span style="color:#f97316;">●</span> TickRace</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px;">Récap hebdomadaire reversements tranche 1</div>
          </td></tr>

          <tr><td style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:18px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;color:#111827;">
                <div style="font-size:18px;font-weight:800;letter-spacing:-0.02em;">Récap hebdo — Tranche 1</div>
                <div style="margin-top:6px;font-size:14px;color:#6b7280;">Bonjour <b>${safe(orgName)}</b>, voici le récapitulatif de la semaine précédente.</div>

                <div style="margin-top:14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;padding:14px;">
                  <div style="font-size:12px;color:#6b7280;">Total versé (période ${safe(periodLabel)})</div>
                  <div style="font-size:26px;font-weight:900;letter-spacing:-0.02em;margin-top:4px;">${safe(
        eurFromCents(total),
      )}</div>
                  <div style="margin-top:6px;font-size:12px;color:#6b7280;">${safe(
                    String(list.length),
                  )} reversement(s) tranche 1</div>
                </div>

                <div style="margin-top:14px;font-size:13px;color:#111827;font-weight:800;">Détail par course</div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;border-collapse:separate;border-spacing:0 8px;">
                  ${items
                    .map(
                      (x) => `
                    <tr>
                      <td style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;font-size:13px;color:#111827;">${safe(
                        x.course_nom,
                      )}</td>
                      <td align="right" style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;font-size:13px;color:#111827;font-weight:700;">${safe(
                        eurFromCents(x.total),
                      )}</td>
                      <td align="right" style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;font-size:12px;color:#6b7280;padding-left:10px;">(${safe(
                        String(x.count),
                      )})</td>
                    </tr>`,
                    )
                    .join("")}
                </table>

                <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:14px;">
                  <tr><td align="left">
                    <a href="${safe(comptaUrl)}" target="_blank" rel="noopener noreferrer"
                      style="display:inline-block;background:#f97316;color:#ffffff;text-decoration:none;
                              font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;font-size:14px;font-weight:700;
                              padding:12px 16px;border-radius:12px;">
                      Ouvrir ma compta organisateur
                    </a>
                  </td></tr>
                </table>

                <div style="margin-top:12px;font-size:12px;color:#6b7280;">
                  Besoin d’aide ? <a href="mailto:support@tickrace.com" style="color:#f97316;text-decoration:none;font-weight:700;">support@tickrace.com</a>
                </div>
              </td></tr>
            </table>
          </td></tr>

          <tr><td style="padding:14px 4px 0 4px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;color:#6b7280;font-size:12px;line-height:1.5;text-align:center;">
            — TickRace • <a href="${safe(TICKRACE_BASE_URL)}" style="color:#6b7280;text-decoration:underline;">${safe(
        TICKRACE_BASE_URL,
      )}</a><br/>
            Ceci est un email automatique. Merci de ne pas répondre.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

      const out = await resendSendEmail({
        to,
        subject,
        text: textLines.join("\n"),
        html,
      });

      await supabase
        .from("organisateur_ledger")
        .update({
          status: "confirmed",
          metadata: {
            period_from: fromIso,
            period_to: toIso,
            total_cents: total,
            reversements_count: list.length,
            email_status: "sent",
            resend_id: (out as any)?.id || null,
            sent_to: to,
            sent_at: new Date().toISOString(),
          },
        })
        .eq("source_key", lockKey);

      sent++;
    } catch (e: any) {
      console.error("WEEKLY_T1_SEND_FAILED", organisateur_id, e?.message ?? e);
      await supabase
        .from("organisateur_ledger")
        .update({ status: "void", metadata: { email_status: "failed", error: String(e?.message ?? e) } })
        .eq("source_key", lockKey);
      skipped++;
    }
  }

  return { sent, skipped };
}

/* ------------------------------ Handler -------------------------- */
serve(async (req) => {
  const headers = cors();
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const now = new Date();
    const nowIso = now.toISOString();

    // ✅ requeue des reversements bloqués en processing depuis 30min
    {
      const cutoff = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
      const { error: requeueErr } = await supabase
        .from("organisateur_reversements")
        .update({
          status: "scheduled",
          error: "processing_timeout_requeued",
          updated_at: nowIso,
        })
        .eq("status", "processing")
        .lte("updated_at", cutoff);

      if (requeueErr) console.warn("REQUEUE_PROCESSING_TIMEOUT_WARN", requeueErr);
    }

    // 1) lot de reversements dus
    const { data: due, error: dueErr } = await supabase
      .from("organisateur_reversements")
      .select("id, organisateur_id, course_id, paiement_id, tranche, due_at, currency, status")
      .eq("status", "scheduled")
      .lte("due_at", nowIso)
      .order("due_at", { ascending: true })
      .limit(30);

    if (dueErr) throw dueErr;
    if (!due?.length) {
      // même si aucun reversement, on peut quand même tenter le digest hebdo (non bloquant)
      try {
        await sendWeeklyTranche1DigestPreviousWeek();
      } catch (e) {
        console.warn("WEEKLY_T1_DIGEST_NON_BLOCKING_ERROR", (e as any)?.message ?? e);
      }
      return json({ ok: true, processed: 0 });
    }

    let processed = 0;

    for (const r of due) {
      // 2) lock scheduled -> processing
      const { data: locked, error: lockErr } = await supabase
        .from("organisateur_reversements")
        .update({ status: "processing", updated_at: nowIso })
        .eq("id", r.id)
        .eq("status", "scheduled")
        .select("id")
        .maybeSingle();

      if (lockErr) {
        console.error("LOCK_ERROR", r.id, lockErr);
        continue;
      }
      if (!locked?.id) continue;

      try {
        // 3) garde-fous Stripe orga
        const { data: prof, error: pErr } = await supabase
          .from("profils_utilisateurs")
          .select("stripe_account_id, stripe_payouts_enabled")
          .eq("user_id", r.organisateur_id)
          .maybeSingle();
        if (pErr) throw pErr;

        const dest = (prof as any)?.stripe_account_id || null;
        const payoutsEnabled = !!(prof as any)?.stripe_payouts_enabled;

        if (!dest || !payoutsEnabled) {
          await markStatus(r.id, {
            status: "blocked",
            error: !dest ? "stripe_account_id manquant" : "stripe_payouts_enabled=false",
          });
          continue;
        }

        // 4) net réel via ledger
        const netTotal = await computeNetTotalForPaiement(r.paiement_id);

        if (netTotal <= 0) {
          await markStatus(r.id, {
            status: "skipped",
            amount_cents: 0,
            executed_at: new Date().toISOString(),
            error: "net_total<=0",
          });
          continue;
        }

        // ✅ Option B : déjà payé = somme(reversements paid)
        const alreadyPaid = await computeAlreadyPaidForPaiement(r.paiement_id);

        // 5) cibles
        const tranche1Target = Math.floor(netTotal * 0.5);
        const target = Number(r.tranche) === 1 ? tranche1Target : netTotal;

        // montant = cible - déjàVersé
        const amount = Math.max(0, target - alreadyPaid);

        if (amount <= 0) {
          await markStatus(r.id, {
            status: "skipped",
            amount_cents: 0,
            executed_at: new Date().toISOString(),
            error: "reste=0",
          });
          continue;
        }

        // 6) Stripe Transfer (idempotent par reversement_id)
        const tr = await stripePost(
          "/transfers",
          {
            amount: String(amount),
            currency: (r.currency || "eur").toLowerCase(),
            destination: dest,
            description: `TickRace reversement (tranche ${r.tranche})`,
            "metadata[organisateur_id]": String(r.organisateur_id),
            "metadata[course_id]": String(r.course_id),
            "metadata[paiement_id]": String(r.paiement_id),
            "metadata[tranche]": String(r.tranche),
            transfer_group: `tickrace_course_${r.course_id}`,
          },
          { idempotencyKey: `tickrace_reversement_${r.id}` },
        );

        const transferId = (tr as any)?.id as string | undefined;
        if (!transferId) throw new Error("Stripe transfer sans id");

        // 7) reversement paid
        await markStatus(r.id, {
          status: "paid",
          amount_cents: amount,
          stripe_transfer_id: transferId,
          executed_at: new Date().toISOString(),
          error: null,
        });

        // 8) ledger (IMPORTANT: reversement = SORTIE => négatif)
        await supabase.from("organisateur_ledger").insert({
          organisateur_id: r.organisateur_id,
          course_id: r.course_id,
          source_table: "organisateur_reversements",
          source_id: r.id,
          source_event: "transfer_created",
          source_key: `reversements:${r.id}:transfer_created:${transferId}`,
          occurred_at: new Date().toISOString(),
          gross_cents: 0,
          tickrace_fee_cents: 0,
          stripe_fee_cents: 0,
          net_org_cents: -amount,
          currency: "eur",
          status: "confirmed",
          label: `Reversement tranche ${r.tranche}`,
          metadata: { transfer_id: transferId, paiement_id: r.paiement_id },
        });

        // 9) EMAILS :
        // - tranche 1 : PAS d’email immédiat (digest hebdo envoyé à part)
        // - tranche 2 : email final immédiat (non bloquant)
        if (Number(r.tranche) === 2) {
          try {
            await sendFinalPayoutEmailOnce({
              organisateur_id: r.organisateur_id,
              course_id: r.course_id ?? null,
              reversement_id: r.id,
              tranche: 2,
              amount_cents: amount,
              stripe_transfer_id: transferId,
              paiement_id: r.paiement_id,
            });
          } catch (e: any) {
            console.error("FINAL_PAYOUT_EMAIL_NON_BLOCKING_ERROR", r.id, e?.message ?? e);
          }
        }

        processed++;
      } catch (e: any) {
        console.error("RUN_REVERSEMENTS_ONE_FAILED", r.id, e);
        await markStatus(r.id, { status: "failed", error: String(e?.message ?? e) });
      }
    }

    // ✅ Digest hebdo Tranche 1 (semaine précédente) — non bloquant
    try {
      await sendWeeklyTranche1DigestPreviousWeek();
    } catch (e) {
      console.warn("WEEKLY_T1_DIGEST_NON_BLOCKING_ERROR", (e as any)?.message ?? e);
    }

    return json({ ok: true, processed }, 200);
  } catch (e: any) {
    console.error("RUN_REVERSEMENTS_FATAL", e);
    return json({ error: "failed", details: String(e?.message ?? e) }, 500);
  }
});
