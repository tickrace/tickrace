// supabase/functions/send-inscription-email/index.ts

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = Deno.env.get("TICKRACE_FROM_EMAIL") ?? "no-reply@tickrace.com";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface EmailPayload {
  inscription_id: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = (await req.json()) as EmailPayload;

    if (!body.inscription_id) {
      return new Response("Missing inscription_id", { status: 400 });
    }

    await handleSendEmail(body.inscription_id);
    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("❌ Erreur send-inscription-email:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
});

async function handleSendEmail(inscriptionId: string) {
  // 1) Récupération de l’inscription
  const { data: inscription, error: insError } = await supabaseAdmin
    .from("inscriptions")
    .select("*")
    .eq("id", inscriptionId)
    .single();

  if (insError || !inscription) {
    console.error("❌ Impossible de récupérer l'inscription", inscriptionId, insError);
    throw insError ?? new Error("Inscription not found");
  }

  const email = inscription.email as string;
  const prenom = (inscription.prenom as string) ?? "";
  const nom = (inscription.nom as string) ?? "";
  const montantTotal = Number(inscription.montant_total ?? 0); // en euros (inscription + options)
  const formatId = inscription.format_id as string | null;

  // 2) Récupération du format
  let formatName = "Format";
  let courseId: string | null = null;

  if (formatId) {
    const { data: format, error: formatError } = await supabaseAdmin
      .from("formats")
      .select("id, nom, course_id")
      .eq("id", formatId)
      .single();

    if (formatError) {
      console.error("⚠️ Impossible de récupérer le format", formatId, formatError);
    } else if (format) {
      formatName = (format.nom as string) ?? "Format";
      courseId = (format.course_id as string) ?? null;
    }
  }

  // 3) Récupération de la course
  let courseName = "Course";

  if (courseId) {
    const { data: course, error: courseError } = await supabaseAdmin
      .from("courses")
      .select("id, nom")
      .eq("id", courseId)
      .single();

    if (courseError) {
      console.error("⚠️ Impossible de récupérer la course", courseId, courseError);
    } else if (course) {
      courseName = (course.nom as string) ?? "Course";
    }
  }

  const displayName =
    prenom || nom ? [prenom, nom].filter(Boolean).join(" ") : "coureur/coureuse";

  const montantStr = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(montantTotal || 0);

  const subject = `✅ Confirmation d'inscription – ${courseName}`;

  // Lien vers les inscriptions + lien direct vers cette inscription
  const baseUrl = "https://www.tickrace.com";
  const mesInscriptionsUrl = `${baseUrl}/mes-inscriptions`;
  const monInscriptionUrl = `${baseUrl}/mon-inscription/${inscriptionId}`;

  const html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 16px; color: #111827;">
      <p>Bonjour ${displayName},</p>

      <p>Ton paiement a été confirmé 🎉</p>

      <p>
        <strong>Course :</strong> ${courseName}<br/>
        <strong>Format :</strong> ${formatName}<br/>
        <strong>Montant total payé :</strong> ${montantStr}
        <span style="color:#6B7280;">(inscription + options le cas échéant)</span>
      </p>

      <p>
        Tu peux consulter le détail de cette inscription ici :<br/>
        <a href="${monInscriptionUrl}" style="color:#2563EB;">Voir le détail de mon inscription</a>
      </p>

      <p>
        Et retrouver toutes tes inscriptions depuis ton espace :<br/>
        <a href="${mesInscriptionsUrl}" style="color:#2563EB;">Mes inscriptions</a>
      </p>

      <p style="margin-top: 24px;">
        Sportivement,<br/>
        <strong>L'équipe Tickrace</strong>
      </p>

      <hr style="margin-top: 24px; border:none; border-top:1px solid #e5e7eb"/>

      <p style="font-size: 12px; color:#9CA3AF;">
        Cet email a été envoyé automatiquement par Tickrace après validation de ton paiement.
      </p>
    </div>
  `;

  const text = `
Bonjour ${displayName},

Ton paiement a été confirmé.

Course : ${courseName}
Format : ${formatName}
Montant total payé : ${montantStr} (inscription + options le cas échéant)

Détail de cette inscription :
${monInscriptionUrl}

Toutes tes inscriptions :
${mesInscriptionsUrl}

Sportivement,
L'équipe Tickrace
  `.trim();

  await sendWithResend({
    to: email,
    subject,
    html,
    text,
  });
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
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error("Erreur Resend:", res.status, txt);
    throw new Error("Resend email failed");
  }
}
