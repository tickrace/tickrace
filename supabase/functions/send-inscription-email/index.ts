// supabase/functions/send-inscription-email/index.ts

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL =
  Deno.env.get("TICKRACE_FROM_EMAIL") ?? "no-reply@tickrace.com";

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
    console.error(
      "❌ Impossible de récupérer l'inscription",
      inscriptionId,
      insError,
    );
    throw insError ?? new Error("Inscription not found");
  }

  const email = inscription.email as string;
  const prenom = (inscription.prenom as string) ?? "";
  const nom = (inscription.nom as string) ?? "";
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

  // 4) Récupération du paiement lié à cette inscription
  let paiement: any = null;

  // a) paiement direct (colonne inscription_id)
  {
    const { data, error } = await supabaseAdmin
      .from("paiements")
      .select(
        "id, montant_total, total_amount_cents, devise, inscription_id, inscription_ids, created_at",
      )
      .eq("inscription_id", inscriptionId)
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (error) {
      console.error("⚠️ Paiement direct non trouvé (inscription_id)", error);
    } else if (data) {
      paiement = data;
    }
  }

  // b) via inscription_ids (array)
  if (!paiement) {
    const { data, error } = await supabaseAdmin
      .from("paiements")
      .select(
        "id, montant_total, total_amount_cents, devise, inscription_id, inscription_ids, created_at",
      )
      .contains("inscription_ids", [inscriptionId])
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (error) {
      console.error("⚠️ Paiement via inscription_ids non trouvé", error);
    } else if (data) {
      paiement = data;
    }
  }

  // 5) Montant total payé
  let montantTotal = 0;
  let devise = "EUR";

  if (paiement) {
    const rawMontant = paiement.montant_total;
    if (rawMontant !== null && rawMontant !== undefined) {
      if (typeof rawMontant === "number") {
        montantTotal = rawMontant;
      } else {
        const parsed = parseFloat(String(rawMontant));
        if (!Number.isNaN(parsed)) montantTotal = parsed;
      }
    } else if (paiement.total_amount_cents != null) {
      montantTotal = Number(paiement.total_amount_cents) / 100;
    }

    if (paiement.devise) {
      devise = String(paiement.devise).toUpperCase();
    }
  } else {
    // Fallback inscriptions.montant_total
    const rawInsMontant = inscription.montant_total;
    if (rawInsMontant !== null && rawInsMontant !== undefined) {
      if (typeof rawInsMontant === "number") {
        montantTotal = rawInsMontant;
      } else {
        const parsed = parseFloat(String(rawInsMontant));
        if (!Number.isNaN(parsed)) montantTotal = parsed;
      }
    }
  }

  const displayName =
    prenom || nom ? [prenom, nom].filter(Boolean).join(" ") : "coureur/coureuse";

  const montantStr = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: devise,
  }).format(montantTotal || 0);

  const subject = `✅ Tickrace – Confirmation d’inscription à ${courseName}`;

  const baseUrl = "https://www.tickrace.com";
  const mesInscriptionsUrl = `${baseUrl}/mesinscriptions`;

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
        Tu recevras un nouvel email si l’organisateur publie des informations importantes
        (horaires, accès, retrait des dossards, etc.).
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

Tu peux retrouver le récapitulatif complet de cette inscription, ainsi que toutes tes autres courses, depuis ton espace Tickrace :

Gérer mes inscriptions : ${mesInscriptionsUrl}

Pense à te connecter avec l’adresse email utilisée lors de l’inscription pour y accéder.

Tu recevras un nouvel email si l’organisateur publie des informations importantes (horaires, accès, retrait des dossards, etc.).

Sportivement,
L’équipe Tickrace
  `.trim();

  await sendWithResend({
    to: email,
    subject,
    html,
    text,
  });
}

async function sendWithResend(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
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
