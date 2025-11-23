// supabase/functions/refund-inscription/index.ts
import { serve } from "https://deno.land/std@0.202.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.18.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY"); // à configurer dans Supabase
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: authHeader ? { headers: { Authorization: authHeader } } : {},
    });

    const { inscription_id } = await req.json();
    if (!inscription_id) {
      return new Response(
        JSON.stringify({ error: "Missing inscription_id" }),
        { status: 400 }
      );
    }

    /** 1. Récupérer l'utilisateur connecté **/
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Utilisateur non authentifié" }),
        { status: 401 }
      );
    }

    /** 2. Récupérer l'inscription et vérifier qu'elle appartient à l'utilisateur **/
    const { data: inscription, error: errIns } = await supabase
      .from("inscriptions")
      .select("*")
      .eq("id", inscription_id)
      .single();

    if (errIns || !inscription) {
      return new Response(
        JSON.stringify({ error: "Inscription introuvable" }),
        { status: 404 }
      );
    }

    if (inscription.coureur_id && inscription.coureur_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Non autorisé pour cette inscription" }),
        { status: 403 }
      );
    }

    /** 3. Récupérer le crédit d'annulation calculé précédemment **/
    const { data: credit, error: errCredit } = await supabase
      .from("credits_annulation")
      .select("*")
      .eq("inscription_id", inscription_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (errCredit || !credit) {
      return new Response(
        JSON.stringify({
          error:
            "Crédit d'annulation introuvable. Veuillez d'abord lancer l'annulation.",
        }),
        { status: 400 }
      );
    }

    const montantRemboursableCents = Math.round(
      Number(credit.montant_total || 0) * 100
    );
    if (!Number.isFinite(montantRemboursableCents) || montantRemboursableCents <= 0) {
      return new Response(
        JSON.stringify({ error: "Aucun montant à rembourser" }),
        { status: 400 }
      );
    }

    /** 4. Trouver le paiement Stripe associé **/
    const { data: paiement, error: errPay } = await supabase
      .from("paiements")
      .select("*")
      .or(
        `inscription_id.eq.${inscription_id},inscription_ids.cs.{${inscription_id}}`
      )
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (errPay || !paiement) {
      return new Response(
        JSON.stringify({
          error: "Paiement introuvable pour cette inscription",
        }),
        { status: 404 }
      );
    }

    const paymentIntentId =
      paiement.stripe_payment_intent_id ||
      paiement.stripe_payment_intent ||
      null;

    if (!paymentIntentId) {
      return new Response(
        JSON.stringify({
          error: "Paiement Stripe non lié à cette inscription",
        }),
        { status: 400 }
      );
    }

    /** 5. Remboursement Stripe **/
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: montantRemboursableCents,
    });

    /** 6. Mise à jour du paiement **/
    const { error: errUpd } = await supabase
      .from("paiements")
      .update({
        refunded_total_cents:
          (paiement.refunded_total_cents || 0) + montantRemboursableCents,
        status: "refunded",
        updated_at: new Date().toISOString(),
      })
      .eq("id", paiement.id);

    if (errUpd) {
      console.error("Erreur mise à jour paiement :", errUpd);
    }

    /** 7. Récupérer info course / format pour le mail (optionnel mais sympa) **/
    const [courseRes, formatRes] = await Promise.all([
      supabase
        .from("courses")
        .select("id, nom, lieu, departement")
        .eq("id", inscription.course_id)
        .maybeSingle(),
      supabase
        .from("formats")
        .select("id, nom, date, distance_km, denivele_dplus")
        .eq("id", inscription.format_id)
        .maybeSingle(),
    ]);

    const course = courseRes.data || null;
    const format = formatRes.data || null;

    /** 8. Envoi de l’email de confirmation d’annulation (via Resend) **/
    if (RESEND_API_KEY && inscription.email) {
      try {
        const montantEur = (montantRemboursableCents / 100)
          .toFixed(2)
          .replace(".", ",");

        const courseName = course?.nom || "votre épreuve";
        const formatName = format?.nom || "";
        const dateTexte = format?.date
          ? new Date(format.date).toLocaleDateString("fr-FR")
          : "";

        const subject = `Confirmation d’annulation – ${courseName}`;
        const to = inscription.email;

        const html = `
          <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#111827;">
            <h1 style="font-size:20px; font-weight:700; margin-bottom:8px;">
              Annulation confirmée – ${courseName}
            </h1>
            <p style="font-size:14px; line-height:1.6;">
              Bonjour ${inscription.prenom || ""} ${inscription.nom || ""},<br/>
              <br/>
              Nous confirmons l’annulation de votre inscription sur Tickrace.
            </p>
            <div style="margin:16px 0; padding:12px 16px; border-radius:12px; border:1px solid #e5e7eb; background:#f9fafb;">
              <p style="font-size:14px; margin:0 0 4px 0;">
                <strong>Épreuve :</strong> ${courseName}
              </p>
              ${
                formatName
                  ? `<p style="font-size:14px; margin:0 0 4px 0;">
                       <strong>Format :</strong> ${formatName}
                     </p>`
                  : ""
              }
              ${
                dateTexte
                  ? `<p style="font-size:14px; margin:0 0 4px 0;">
                       <strong>Date :</strong> ${dateTexte}
                     </p>`
                  : ""
              }
              <p style="font-size:14px; margin:0;">
                <strong>Montant remboursé :</strong> ${montantEur} €
              </p>
            </div>
            <p style="font-size:14px; line-height:1.6;">
              Le remboursement a été initié sur votre moyen de paiement utilisé lors de l’inscription.
              Selon votre banque, le délai d’apparition sur votre relevé peut varier de quelques jours.
            </p>
            <p style="font-size:14px; line-height:1.6; margin-top:16px;">
              Vous pouvez consulter le détail de votre inscription ici :<br/>
              <a href="https://www.tickrace.com/mon-inscription/${inscription_id}" 
                 style="color:#ea580c; text-decoration:none;">
                Voir mon inscription sur Tickrace
              </a>
            </p>
            <p style="font-size:12px; color:#6b7280; margin-top:24px;">
              Cet email a été envoyé automatiquement par Tickrace. Si vous pensez qu’il s’agit d’une erreur,
              merci de contacter l’organisation de l’épreuve ou le support Tickrace.
            </p>
          </div>
        `;

        const text = `
Annulation confirmée – ${courseName}

Bonjour ${inscription.prenom || ""} ${inscription.nom || ""},

Nous confirmons l’annulation de votre inscription sur Tickrace.

Épreuve : ${courseName}
${formatName ? `Format : ${formatName}\n` : ""}${
          dateTexte ? `Date : ${dateTexte}\n` : ""
        }Montant remboursé : ${montantEur} €

Le remboursement a été initié sur votre moyen de paiement utilisé lors de l’inscription.
Selon votre banque, le délai peut varier de quelques jours.

Détail de votre inscription :
https://www.tickrace.com/mon-inscription/${inscription_id}

—
Tickrace
        `.trim();

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Tickrace <noreply@tickrace.com>",
            to: [to],
            subject,
            html,
            text,
          }),
        });

        if (!res.ok) {
          const body = await res.text();
          console.error("Erreur envoi email annulation :", res.status, body);
        }
      } catch (e) {
        console.error("Erreur interne lors de l’envoi email annulation :", e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        refunded_cents: montantRemboursableCents,
        refund_id: refund.id,
      }),
      { status: 200 }
    );
  } catch (e) {
    console.error("Erreur refund-inscription :", e);
    return new Response(
      JSON.stringify({ error: "Erreur interne", details: e.message }),
      { status: 500 }
    );
  }
});
