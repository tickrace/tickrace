// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1?target=deno&deno-std=0.192.0
import { Resend } from "https://esm.sh/resend@3.2.0?target=deno&deno-std=0.192.0

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const resend = new Resend(RESEND_API_KEY);
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Ajoute ici tes domaines autorisÃ©s (dev + prod)
const ALLOWED_ORIGINS = [
  "https://www.tickrace.com",
  "https://tickrace.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function corsHeaders(origin: string | null) {
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info, prefer",
  };
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }

  try {
    const body = await req.json();
    const {
      course_id,
      nom,
      prenom,
      email,
      telephone,
      message,
      website, // honeypot
    } = body ?? {};

    // Honeypot : si rempli â†’ on rÃ©pond OK sans rien faire
    if (website && String(website).trim().length > 0) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    // Validations
    if (!course_id || !nom || !prenom || !email || !telephone) {
      return new Response(
        JSON.stringify({ error: "Champs obligatoires manquants." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        }
      );
    }

    // VÃ©rifier que la course existe et rÃ©cupÃ©rer l'organisateur
    const { data: course, error: courseErr } = await admin
      .from("courses")
      .select("id, nom, lieu, organisateur_id")
      .eq("id", course_id)
      .maybeSingle();

    if (courseErr || !course) {
      return new Response(JSON.stringify({ error: "Course introuvable." }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    // Upsert bÃ©nÃ©vole par email
    const { data: bene, error: upsertErr } = await admin
      .from("benevoles")
      .upsert(
        [{ email, nom, prenom, telephone }],
        { onConflict: "email" }
      )
      .select("id, email, nom, prenom, telephone")
      .single();

    if (upsertErr || !bene) {
      return new Response(
        JSON.stringify({ error: "Impossible dâ€™enregistrer le bÃ©nÃ©vole." }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        }
      );
    }

    // Inscription (ignorer si dÃ©jÃ  existante)
    const { data: exist } = await admin
      .from("benevoles_inscriptions")
      .select("id")
      .eq("benevole_id", bene.id)
      .eq("course_id", course_id)
      .maybeSingle();

    let inscriptionId: string | null = exist?.id ?? null;

    if (!inscriptionId) {
      const { data: ins, error: insErr } = await admin
        .from("benevoles_inscriptions")
        .insert([{ benevole_id: bene.id, course_id, message, statut: "nouveau" }])
        .select("id")
        .single();
      if (insErr || !ins) {
        return new Response(
          JSON.stringify({ error: "Impossible dâ€™enregistrer lâ€™inscription." }),
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
          }
        );
      }
      inscriptionId = ins.id;
    }

    // Email bÃ©nÃ©vole (confirmation)
    try {
      await resend.emails.send({
        from: "Tickrace <noreply@tickrace.com>",
        to: email,
        subject: `Merci pour votre aide bÃ©nÃ©vole â€” ${course.nom}`,
        html: `
          <p>Bonjour ${escapeHtml(prenom)} ${escapeHtml(nom)},</p>
          <p>Merci pour votre proposition d'aide sur <strong>${escapeHtml(
            course.nom
          )}</strong> (${escapeHtml(course.lieu)}).</p>
          <p>Un organisateur vous recontactera sous peu.</p>
          <p>Message transmis : ${
            message ? `<em>${escapeHtml(String(message))}</em>` : "(aucun)"
          }</p>
          <p>Sportivement,<br/>L'Ã©quipe Tickrace</p>
        `,
      });
    } catch {
      // non bloquant
    }

    // Email organisateur (notification)
    try {
      if (course.organisateur_id) {
        const { data: u } = await admin.auth.admin.getUserById(
          course.organisateur_id
        );
        const orgaEmail = u?.user?.email;
        if (orgaEmail) {
          await resend.emails.send({
            from: "Tickrace <noreply@tickrace.com>",
            to: orgaEmail,
            subject: `Nouveau bÃ©nÃ©vole â€” ${course.nom}`,
            html: `
              <p>Nouvelle demande bÃ©nÃ©vole pour <strong>${escapeHtml(
                course.nom
              )}</strong> (${escapeHtml(course.lieu)}).</p>
              <ul>
                <li>Nom : ${escapeHtml(prenom)} ${escapeHtml(nom)}</li>
                <li>Email : ${escapeHtml(email)}</li>
                <li>TÃ©lÃ©phone : ${escapeHtml(telephone)}</li>
                <li>Message : ${
                  message ? `<em>${escapeHtml(String(message))}</em>` : "(aucun)"
                }</li>
              </ul>
              <p>GÃ©rez les bÃ©nÃ©voles depuis votre espace organisateur.</p>
            `,
          });
        }
      }
    } catch {
      // non bloquant
    }

    return new Response(
      JSON.stringify({ ok: true, inscription_id: inscriptionId }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Bad Request", details: String(e) }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      }
    );
  }
});

// petite fonction d'Ã©chappement HTML pour les emails
function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// hard guard
try { (globalThis | Out-Null) } catch {} // keep file non-empty
