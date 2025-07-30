// supabase/functions/send-inscription-email/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend";

const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);

serve(async (req) => {
  try {
    const body = await req.json();
    const {
      to,
      prenom,
      nom,
      nomCourse,
      nomFormat,
      lieu,
      departement,
      pays,
      date,
      heure,
      distance,
      denivele,
      numeroInscription,
      club,
      adresse,
      email,
      telephone,
      justificatif,
      nbRepas,
      prixRepas,
      totalPayé,
      urlMonInscription,
      urlCourse,
    } = body;

    const htmlContent = `
      <div style="font-family:Arial,sans-serif;font-size:16px;color:#333;background:#f7f7f7;padding:20px">
        <div style="max-width:600px;margin:auto;background:#fff;padding:30px;border-radius:8px">
          <h1 style="color:#10b981">✅ Confirmation d'inscription</h1>
          <p>Bonjour <strong>${prenom} ${nom}</strong>,</p>
          <p>Nous confirmons votre inscription à :</p>
          <p><strong>${nomCourse} – ${nomFormat}</strong></p>
          <p>📍 ${lieu}, ${departement}, ${pays}</p>
          <p>📅 ${date} – ⏰ ${heure}</p>
          <p>📏 ${distance} km – D+ ${denivele} m</p>
          <p>🧾 Numéro d'inscription : <strong>${numeroInscription}</strong></p>

          <h2 style="margin-top:30px;font-size:18px;border-bottom:1px solid #eee">Vos informations</h2>
          <p><strong>Club :</strong> ${club || "—"}</p>
          <p><strong>Adresse :</strong> ${adresse}</p>
          <p><strong>Email :</strong> ${email}</p>
          <p><strong>Téléphone :</strong> ${telephone}</p>
          <p><strong>Justificatif :</strong> ${justificatif}</p>
          <p><strong>Repas réservés :</strong> ${nbRepas} × ${prixRepas} €</p>

          <h2 style="margin-top:30px;font-size:18px;border-bottom:1px solid #eee">Paiement</h2>
          <p><strong>Total payé :</strong> ${totalPayé} €</p>

          <a href="${urlMonInscription}" style="display:inline-block;margin-top:20px;padding:12px 20px;background:#2563eb;color:white;text-decoration:none;border-radius:5px">Voir / Modifier mon inscription</a>

          <h2 style="margin-top:30px;font-size:18px;border-bottom:1px solid #eee">Conditions d'annulation</h2>
          <ul>
            <li>✅ Repas remboursés intégralement</li>
            <li>💸 5 % de frais sur l’inscription</li>
            <li>🗓 100% remboursé > 14 jours ; 50% entre 4 et 14 jours ; 0% < 4 jours</li>
          </ul>

          <a href="${urlCourse}" style="display:inline-block;margin-top:10px;padding:12px 20px;background:#10b981;color:white;text-decoration:none;border-radius:5px">Voir la page de l'épreuve</a>

          <p style="font-size:12px;margin-top:40px;color:#777;text-align:center">
            Merci pour votre confiance 💪 – L’équipe Tickrace
          </p>
        </div>
      </div>
    `;

    const { error } = await resend.emails.send({
      from: "Tickrace <no-reply@tickrace.com>",
      to: [to],
      subject: "Confirmation de votre inscription à la course",
      html: htmlContent,
    });

    if (error) {
      console.error("Erreur Resend:", error);
      return new Response("Erreur d'envoi email", { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Erreur Edge Function:", err);
    return new Response("Erreur serveur", { status: 500 });
  }
});
