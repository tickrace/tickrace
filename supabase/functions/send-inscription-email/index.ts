import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req) => {
  // 🔁 Réponse à la requête OPTIONS (pré-vol CORS)
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const { email, prenom, nom, format_nom, course_nom, date } = await req.json();

    const { data, error } = await resend.emails.send({
      from: "Tickrace <no-reply@tickrace.com>",
      to: [email],
      subject: `Confirmation d'inscription à ${course_nom}`,
      html: `
        <p>Bonjour ${prenom} ${nom},</p>
        <p>Merci pour votre inscription à <strong>${course_nom}</strong> sur le format <strong>${format_nom}</strong>.</p>
        <p>Date de l'épreuve : <strong>${date}</strong></p>
        <p>Sportivement,<br>L'équipe Tickrace</p>
      `,
    });

    if (error) {
      console.error("Erreur Resend :", error);
      return new Response("Erreur lors de l'envoi d'email", {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    console.error("Erreur fonction:", e);
    return new Response("Erreur serveur", {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
