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
  // 1) Récupération de l’inscription + format + course
  const { data: insc, error } = await supabaseAdmin
    .from("inscriptions")
    .select(`
      id,
      email,
      prenom,
      nom,
      montant_total,
      -- adapte ces colonnes si les noms sont différents dans ta BDD
      formats!inscriptions_format_id_fkey (
        id,
        nom,
        courses!formats_course_id_fkey (
          id,
          nom
        )
      )
    `)
    .eq("id", inscriptionId)
    .single();

  if (error || !insc) {
    console.error("❌ Impossible de récupérer l'inscription", inscriptionId, error);
    throw error ?? new Error("Inscription not found");
  }

  // On sécurise un peu les accès
  const email = insc.email as string;
  const prenom = (insc.prenom as string) ?? "";
  const nom = (insc.nom as string) ?? "";
  const montantTotal = Number(insc.montant_total ?? 0); // en euros (montant + options)
  const format = insc.formats ?? {};
  const course = (format.courses as any) ?? {};

  const formatName = (format.nom as string) ?? "Format";
  const courseName = (course.nom as string) ?? "Course";

  const displayName =
    prenom || nom ? [prenom, nom].filter(Boolean).join(" ") : "coureur/coureuse";

  const montantStr = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(montantTotal || 0);

  const subject = `✅ Confirmation d'inscription – ${courseName}`;

  const html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 16px; color: #111827;">
      <p>Bonjour ${displayName},</p>

      <p>Ta (ou votre) inscription à <strong>${courseName}</strong> est bien confirmée ✅</p>

      <p>
        <strong>Format :</strong> ${formatName}<br/>
        <strong>Montant total payé :</strong> ${montantStr} <span style="color:#6B7280;">(options incluses le cas échéant)</span>
      </p>

      <p>Tu recevras de nouvelles informations pratiques (horaires, accès, retrait des dossards) de la part de l'organisation si nécessaire.</p>

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

Ta (ou votre) inscription à ${courseName} est bien confirmée.

Format : ${formatName}
Montant total payé : ${montantStr} (options incluses le cas échéant)

Tu recevras de nouvelles informations pratiques (horaires, accès, retrait des dossards) de la part de l'organisation si nécessaire.

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
