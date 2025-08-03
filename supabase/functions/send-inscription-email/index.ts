import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const body = await req.json();

    const {
      to, // ✅ Assure-toi que tu passes bien 'to' en string côté front
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
        <div style="max-width:600px;margin:auto;background:#fff;padding:30px;border-radius:8px;border:1px solid #eee">
          <h1 style="color:#10b981">✅ Confirmation d'inscription</h1>
          <p>Bonjour <strong>${prenom} ${nom}</strong>,</p>
          <p>Votre inscription à l'événement suivant a bien été enregistrée :</p>
          <h2 style="margin-top:20px">${nomCourse} – ${nomFormat}</h2>
          <p>📍 <strong>${lieu}, ${departement}, ${pays}</strong></p>
          <p>📅 <strong>${date}</strong> – ⏰ <strong>${heure}</strong></p>
          <p>📏 <strong>${distance} km</strong> – D+ <strong>${denivele} m</strong></p>
          <p>🧾 <strong>Numéro d’inscription :</strong> ${numeroInscription}</p>
          <h3 style="margin-top:30px">Vos informations</h3>
          <ul>
            <li><strong>Club :</strong> ${club || "—"}</li>
            <li><strong>Adresse :</strong> ${adresse}</li>
            <li><strong>Email :</strong> ${email}</li>
            <li><strong>Téléphone :</strong> ${telephone}</li>
            <li><strong>Justificatif :</strong> ${justificatif}</li>
            <li><strong>Repas réservés :</strong> ${nbRepas} repas (${prixRepas} €)</li>
          </ul>
          <h3 style="margin-top:30px">Paiement</h3>
          <p><strong>Total payé :</strong> ${totalPayé} €</p>
          <a href="${urlMonInscription}" style="display:inline-block;margin-top:20px;padding:12px 20px;background:#2563eb;color:white;text-decoration:none;border-radius:5px">Voir / Modifier mon inscription</a>
          <h3 style="margin-top:30px">Annulation</h3>
          <ul>
            <li>✅ Repas toujours remboursés</li>
            <li>💸 5 % de frais sur l’inscription</li>
            <li>🗓 Crédit de 100% si annulation > 14j</li>
            <li>⏱ 50% de crédit si annulation entre 4 et 14j</li>
            <li>❌ Aucun remboursement si annulation < 4j</li>
          </ul>
          <a href="${urlCourse}" style="display:inline-block;margin-top:10px;padding:12px 20px;background:#10b981;color:white;text-decoration:none;border-radius:5px">Voir la fiche de la course</a>
          <p style="font-size:12px;margin-top:40px;color:#777;text-align:center">
            Merci pour votre inscription 🏃‍♂️<br/>L’équipe Tickrace
          </p>
        </div>
      </div>`;

    const { error } = await resend.emails.send({
      from: "Tickrace <no-reply@tickrace.com>",
      to,
      subject: `🎟 Confirmation d'inscription – ${nomCourse}`,
      html: htmlContent,
    });

    if (error) {
      console.error("Erreur Resend:", error);
      return new Response("Erreur envoi email", {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("Erreur serveur:", err);
    return new Response("Erreur serveur", {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }
});
