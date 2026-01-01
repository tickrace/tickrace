// supabase/functions/send-inscription-email/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = Deno.env.get("TICKRACE_FROM_EMAIL") ?? "Tickrace <no-reply@tickrace.com>";
const TICKRACE_BASE_URL = Deno.env.get("TICKRACE_BASE_URL") ?? "https://www.tickrace.com";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type EmailPayload = { inscription_id: string };

function cors(h = new Headers()) {
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "content-type, authorization, apikey");
  h.set("content-type", "application/json; charset=utf-8");
  return h;
}

function normalizeEmail(v: any): string | null {
  if (typeof v === "string") {
    const s = v.trim();
    return s.length ? s : null;
  }
  // parfois on se retrouve avec des trucs inattendus
  if (Array.isArray(v) && v.length && typeof v[0] === "string") return v[0].trim() || null;
  if (v && typeof v === "object" && typeof v.email === "string") return v.email.trim() || null;
  if (v && typeof v === "object" && typeof v.address === "string") return v.address.trim() || null;
  return null;
}

async function sendWithResend(opts: { to: string; subject: string; html: string; text: string }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: String(opts.to), // ✅ force string
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("Erreur Resend:", res.status, txt);
    throw new Error("Resend email failed");
  }
}

async function resolveRecipientEmail(inscription: any): Promise<string | null> {
  // 1) email directement sur l'inscription
  const direct = normalizeEmail(inscription?.email);
  if (direct) return direct;

  // 2) fallback via auth user (coureur_id)
  const uid = inscription?.coureur_id ? String(inscription.coureur_id) : null;
  if (!uid) return null;

  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(uid);
    if (error) {
      console.error("AUTH_GET_USER_ERROR", uid, error);
      return null;
    }
    const authEmail = normalizeEmail(data?.user?.email);
    return authEmail;
  } catch (e) {
    console.error("AUTH_GET_USER_FATAL", uid, e);
    return null;
  }
}

async function handleSendEmail(inscriptionId: string) {
  // 1) inscription
  const { data: inscription, error: insError } = await supabaseAdmin
    .from("inscriptions")
    .select("*")
    .eq("id", inscriptionId)
    .maybeSingle();

  if (insError || !inscription) {
    console.error("❌ Impossible de récupérer l'inscription", inscriptionId, insError);
    throw insError ?? new Error("Inscription not found");
  }

  const prenom = (inscription.prenom as string) ?? "";
  const nom = (inscription.nom as string) ?? "";
  const formatId = (inscription.format_id as string | null) ?? null;

  // ✅ email robuste
  const toEmail = await resolveRecipientEmail(inscription);

  // Si pas d'email => on ne casse pas le webhook, on log et on sort
  if (!toEmail) {
    console.warn("SEND_INSCRIPTION_EMAIL_SKIP_NO_EMAIL", {
      inscription_id: inscriptionId,
      coureur_id: inscription?.coureur_id ?? null,
      inscription_email: inscription?.email ?? null,
    });
    return;
  }

  // 2) format
  let formatName = "Format";
  let courseId: string | null = null;

  if (formatId) {
    const { data: format, error: formatError } = await supabaseAdmin
      .from("formats")
      .select("id, nom, course_id")
      .eq("id", formatId)
      .maybeSingle();

    if (formatError) console.error("⚠️ Impossible de récupérer le format", formatId, formatError);
    if (format) {
      formatName = (format.nom as string) ?? "Format";
      courseId = (format.course_id as string) ?? null;
    }
  }

  // 3) course
  let courseName = "Course";
  if (courseId) {
    const { data: course, error: courseError } = await supabaseAdmin
      .from("courses")
      .select("id, nom")
      .eq("id", courseId)
      .maybeSingle();

    if (courseError) console.error("⚠️ Impossible de récupérer la course", courseId, courseError);
    if (course) courseName = (course.nom as string) ?? "Course";
  }

  // 4) paiement lié
  let paiement: any = null;

  // a) paiement direct
  {
    const { data, error } = await supabaseAdmin
      .from("paiements")
      .select("id, montant_total, total_amount_cents, devise, inscription_id, inscription_ids, created_at")
      .eq("inscription_id", inscriptionId)
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (error) console.error("⚠️ Paiement direct lookup error", error);
    if (data) paiement = data;
  }

  // b) via inscription_ids array
  if (!paiement) {
    const { data, error } = await supabaseAdmin
      .from("paiements")
      .select("id, montant_total, total_amount_cents, devise, inscription_id, inscription_ids, created_at")
      .contains("inscription_ids", [inscriptionId])
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (error) console.error("⚠️ Paiement via inscription_ids lookup error", error);
    if (data) paiement = data;
  }

  // 5) montant
  let montantTotal = 0;
  let devise = "EUR";

  if (paiement) {
    const rawMontant = paiement.montant_total;
    if (rawMontant !== null && rawMontant !== undefined) {
      const parsed = typeof rawMontant === "number" ? rawMontant : parseFloat(String(rawMontant));
      if (!Number.isNaN(parsed)) montantTotal = parsed;
    } else if (paiement.total_amount_cents != null) {
      montantTotal = Number(paiement.total_amount_cents) / 100;
    }

    if (paiement.devise) devise = String(paiement.devise).toUpperCase();
  } else {
    const rawInsMontant = inscription.montant_total;
    if (rawInsMontant !== null && rawInsMontant !== undefined) {
      const parsed = typeof rawInsMontant === "number" ? rawInsMontant : parseFloat(String(rawInsMontant));
      if (!Number.isNaN(parsed)) montantTotal = parsed;
    }
  }

  const displayName = prenom || nom ? [prenom, nom].filter(Boolean).join(" ") : "coureur/coureuse";

  const montantStr = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: devise,
  }).format(montantTotal || 0);

  const subject = `✅ Tickrace – Confirmation d’inscription à ${courseName}`;

  const mesInscriptionsUrl = `${TICKRACE_BASE_URL}/mesinscriptions`;

  const html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 16px; color: #111827; line-height: 1.5;">
      <p>Bonjour ${displayName},</p>

      <p>
        Ton inscription à <strong>${courseName}</strong> – <strong>${formatName}</strong> est bien confirmée ✅
      </p>

      <p>
        <strong>Montant total payé :</strong> ${montantStr}<br/>
        <span style="color:#6B7280; font-size: 14px;">
          (inscription + options le cas échéant)
        </span>
      </p>

      <p>
        Tu peux retrouver le récapitulatif complet de cette inscription, ainsi que toutes tes autres courses, depuis ton espace Tickrace :
      </p>

      <p style="margin: 16px 0;">
        <a href="${mesInscriptionsUrl}" style="display:inline-block; padding:10px 18px; border-radius:999px; background:#111827; color:#F9FAFB; text-decoration:none; font-weight:600;">
          Gérer mes inscriptions
        </a>
      </p>

      <p style="font-size: 14px; color:#6B7280;">
        Pense à te connecter avec l’adresse email utilisée lors de l’inscription pour y accéder.
      </p>

      <p style="margin-top: 24px;">
        Sportivement,<br/>
        <strong>L’équipe Tickrace</strong>
      </p>

      <hr style="margin-top: 24px; border:none; border-top:1px solid #e5e7eb"/>

      <p style="font-size: 12px; color:#9CA3AF;">
        Cet email a été envoyé automatiquement par Tickrace après validation de ton paiement.
      </p>
    </div>
  `;

  const text = `
Bonjour ${displayName},

Ton inscription à "${courseName}" – "${formatName}" est bien confirmée ✅

Montant total payé : ${montantStr}
(inscription + options le cas échéant)

Gérer mes inscriptions : ${mesInscriptionsUrl}

Sportivement,
L’équipe Tickrace
  `.trim();

  await sendWithResend({ to: toEmail, subject, html, text });
}

serve(async (req: Request): Promise<Response> => {
  const headers = cors();
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers });

  try {
    const body = (await req.json().catch(() => null)) as EmailPayload | null;
    if (!body?.inscription_id) return new Response(JSON.stringify({ error: "missing_inscription_id" }), { status: 400, headers });

    await handleSendEmail(body.inscription_id);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (err) {
    console.error("❌ Erreur send-inscription-email:", err);
    return new Response(JSON.stringify({ error: "internal_server_error" }), { status: 500, headers });
  }
});
