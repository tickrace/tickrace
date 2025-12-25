// supabase/functions/volunteer-signup/index.ts
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1?target=deno";
import { Resend } from "https://esm.sh/resend@3.2.0?target=deno";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const resend = new Resend(RESEND_API_KEY);
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Ajoute ici tes domaines autorisés (dev + prod)
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
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, prefer",
  };
}

function normalizeEmail(s: string) {
  return (s || "").toString().trim().toLowerCase();
}
function clean(s: any) {
  return (s ?? "").toString().trim();
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }

  try {
    const body = await req.json().catch(() => ({}));

    const {
      course_id,
      nom,
      prenom,
      email,
      telephone,
      website, // honeypot
    } = body ?? {};

    // Honeypot : si rempli → on répond OK sans rien faire
    if (website && String(website).trim().length > 0) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    const courseId = clean(course_id);
    const Nom = clean(nom);
    const Prenom = clean(prenom);
    const Email = normalizeEmail(email);
    const Telephone = clean(telephone);

    // Validations
    if (!courseId || !Nom || !Prenom || !Email || !Telephone) {
      return new Response(JSON.stringify({ error: "Champs obligatoires manquants." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    // Vérifier que la course existe et récupérer l'organisateur
    const { data: course, error: courseErr } = await admin
      .from("courses")
      .select("id, nom, lieu, organisateur_id")
      .eq("id", courseId)
      .maybeSingle();

    if (courseErr || !course) {
      return new Response(JSON.stringify({ error: "Course introuvable." }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    // Upsert bénévole par (course_id, email)
    // Ne touche pas invited_at/last_invite_at/invite_count
    const { data: bene, error: upsertErr } = await admin
      .from("benevoles")
      .upsert(
        [
          {
            course_id: courseId,
            email: Email,
            nom: Nom,
            prenom: Prenom,
            telephone: Telephone,
            status: "registered",
          },
        ],
        { onConflict: "course_id,email" }
      )
      .select("id, course_id, email, nom, prenom, telephone, status, created_at")
      .maybeSingle();

    if (upsertErr || !bene) {
      console.error("upsert benevoles error:", upsertErr);
      return new Response(JSON.stringify({ error: "Impossible d’enregistrer le bénévole." }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    // Email bénévole (confirmation) — non bloquant
    try {
      await resend.emails.send({
        from: "Tickrace <noreply@tickrace.com>",
        to: Email,
        subject: `Merci pour votre aide bénévole — ${course.nom}`,
        html: `
          <p>Bonjour ${escapeHtml(Prenom)} ${escapeHtml(Nom)},</p>
          <p>Merci pour votre inscription bénévole sur <strong>${escapeHtml(course.nom)}</strong> (${escapeHtml(
            course.lieu || ""
          )}).</p>
          <p>L’organisation pourra vous envoyer un lien d’accès à l’espace bénévole (planning + chat).</p>
          <p>Sportivement,<br/>L’équipe Tickrace</p>
        `,
      });
    } catch (e) {
      console.warn("Resend benevole email failed:", e);
    }

    // Email organisateur (notification) — non bloquant
    try {
      if (course.organisateur_id) {
        const { data: u } = await admin.auth.admin.getUserById(course.organisateur_id);
        const orgaEmail = u?.user?.email;

        if (orgaEmail) {
          await resend.emails.send({
            from: "Tickrace <noreply@tickrace.com>",
            to: orgaEmail,
            subject: `Nouveau bénévole — ${course.nom}`,
            html: `
              <p>Nouveau bénévole inscrit sur <strong>${escapeHtml(course.nom)}</strong> (${escapeHtml(
                course.lieu || ""
              )}).</p>
              <ul>
                <li>Nom : ${escapeHtml(Prenom)} ${escapeHtml(Nom)}</li>
                <li>Email : ${escapeHtml(Email)}</li>
                <li>Téléphone : ${escapeHtml(Telephone)}</li>
                <li>Statut : ${escapeHtml(bene.status || "registered")}</li>
              </ul>
              <p>Tu peux l’inviter depuis ta page “Bénévoles” pour lui donner accès à l’espace bénévole.</p>
            `,
          });
        }
      }
    } catch (e) {
      console.warn("Resend orga email failed:", e);
    }

    return new Response(JSON.stringify({ ok: true, benevole_id: bene.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  } catch (e) {
    console.error("volunteer-signup error:", e);
    return new Response(JSON.stringify({ error: "Bad Request", details: String(e) }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }
});

// petite fonction d'échappement HTML pour les emails
function escapeHtml(s: string) {
  return (s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
