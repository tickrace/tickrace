import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from 'npm:resend';

serve(async (req) => {
  const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

  const { email, prenom, nom, course_nom, format_nom, date } = await req.json();

  try {
    const { data, error } = await resend.emails.send({
      from: "Tickrace <contact@tickrace.com>",
      to: [email],
      subject: `Confirmation d'inscription à ${course_nom}`,
      html: `
        <p>Bonjour ${prenom} ${nom},</p>
        <p>Votre inscription au format <strong>${format_nom}</strong> de l’épreuve <strong>${course_nom}</strong> est bien enregistrée pour le <strong>${date}</strong>.</p>
        <p>Merci de votre participation et à bientôt sur la ligne de départ !</p>
        <p>L'équipe Tickrace</p>
      `,
    });

    if (error) {
      return new Response(JSON.stringify({ error }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }));
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
