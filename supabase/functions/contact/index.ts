// supabase/functions/contact/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const CONTACT_TO_EMAIL = Deno.env.get("CONTACT_TO_EMAIL") || "support@tickrace.com";
const CONTACT_FROM_EMAIL = Deno.env.get("CONTACT_FROM_EMAIL") || "no-reply@tickrace.com";
const SITE_URL = Deno.env.get("SITE_URL") || "https://www.tickrace.com";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function jsonResponse(body: any, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

// CORS (ajuste selon tes environnements)
const ALLOWED_ORIGINS = new Set([
  "https://www.tickrace.com",
  "https://tickrace.com",
  "http://localhost:5173",
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://www.tickrace.com";
  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-credentials": "true",
  };
}

function isValidEmail(email: string) {
  // simple & efficace
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function clampText(s: string, max = 5000) {
  const v = (s || "").toString().trim();
  return v.length > max ? v.slice(0, max) : v;
}

async function sendResendEmail(args: {
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
}) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: args.from,
      to: [args.to],
      subject: args.subject,
      text: args.text,
      html: args.html,
      reply_to: args.replyTo ? [args.replyTo] : undefined,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Resend error: ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

Deno.serve(async (req) => {
  const c = corsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: c });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405, c);
  }

  try {
    const body = await req.json();

    // Honeypot anti-spam: si rempli => on répond OK sans rien faire
    if (body?.website && String(body.website).trim().length > 0) {
      return jsonResponse({ ok: true, message: "Message envoyé ✅" }, 200, c);
    }

    const role = clampText(body?.role, 40) || "autre";
    const categorie = clampText(body?.categorie, 80) || "autre";
    const nom = clampText(body?.nom, 120);
    const email = clampText(body?.email, 180);
    const telephone = clampText(body?.telephone, 40) || null;
    const organisation = clampText(body?.organisation, 180) || null;
    const lien = clampText(body?.lien, 500) || null;
    const sujet = clampText(body?.sujet, 180) || `${role} — ${categorie}`;
    const message = clampText(body?.message, 8000);
    const source = clampText(body?.source, 60) || "contact_page";
    const ua = clampText(body?.ua, 400) || req.headers.get("user-agent") || null;

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      null;

    // validations
    const roleOk = ["coureur", "organisateur", "partenaire", "presse", "autre"].includes(role);
    if (!roleOk) {
      return jsonResponse({ ok: false, error: "Rôle invalide" }, 400, c);
    }
    if (!nom || nom.length < 2) {
      return jsonResponse({ ok: false, error: "Nom requis" }, 400, c);
    }
    if (!email || !isValidEmail(email)) {
      return jsonResponse({ ok: false, error: "Email invalide" }, 400, c);
    }
    if (!message || message.length < 10) {
      return jsonResponse({ ok: false, error: "Message trop court" }, 400, c);
    }

    // Insert DB (service role => bypass RLS)
    const { data: inserted, error: insErr } = await supabase
      .from("contact_messages")
      .insert({
        role,
        categorie,
        source,
        nom,
        email,
        telephone,
        organisation,
        lien,
        sujet,
        message,
        ua,
        ip,
        status: "new",
        meta: {
          site_url: SITE_URL,
        },
      })
      .select("id, created_at")
      .single();

    if (insErr) throw insErr;

    const id = inserted.id as string;

    // Email content
    const subject = `Tickrace — Contact (${role}/${categorie}) — ${nom}`;
    const text = [
      `Nouveau message via ${SITE_URL}`,
      ``,
      `ID: ${id}`,
      `Rôle: ${role}`,
      `Catégorie: ${categorie}`,
      `Nom: ${nom}`,
      `Email: ${email}`,
      `Téléphone: ${telephone ?? "—"}`,
      `Organisation: ${organisation ?? "—"}`,
      `Lien: ${lien ?? "—"}`,
      ``,
      `Sujet: ${sujet}`,
      ``,
      `Message:`,
      message,
      ``,
      `UA: ${ua ?? "—"}`,
      `IP: ${ip ?? "—"}`,
    ].join("\n");

    const html = `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system; line-height:1.5">
        <h2>Nouveau message (Tickrace)</h2>
        <p><b>ID :</b> ${id}</p>
        <table cellpadding="6" cellspacing="0" style="border-collapse:collapse; font-size:14px">
          <tr><td><b>Rôle</b></td><td>${role}</td></tr>
          <tr><td><b>Catégorie</b></td><td>${categorie}</td></tr>
          <tr><td><b>Nom</b></td><td>${nom}</td></tr>
          <tr><td><b>Email</b></td><td>${email}</td></tr>
          <tr><td><b>Téléphone</b></td><td>${telephone ?? "—"}</td></tr>
          <tr><td><b>Organisation</b></td><td>${organisation ?? "—"}</td></tr>
          <tr><td><b>Lien</b></td><td>${lien ? `<a href="${lien}">${lien}</a>` : "—"}</td></tr>
          <tr><td><b>Sujet</b></td><td>${sujet}</td></tr>
        </table>
        <hr style="margin:16px 0" />
        <h3>Message</h3>
        <pre style="white-space:pre-wrap; font-family: ui-monospace, SFMono-Regular; background:#f6f6f6; padding:12px; border-radius:12px">${message}</pre>
        <p style="color:#666; font-size:12px">
          UA: ${ua ?? "—"}<br/>
          IP: ${ip ?? "—"}
        </p>
      </div>
    `;

    await sendResendEmail({
      to: CONTACT_TO_EMAIL,
      from: CONTACT_FROM_EMAIL,
      replyTo: email,
      subject,
      text,
      html,
    });

    return jsonResponse(
      { ok: true, id, message: "Message envoyé ✅ On te répond dès que possible." },
      200,
      c
    );
  } catch (e) {
    console.error(e);
    return jsonResponse(
      {
        ok: false,
        error:
          "Erreur côté serveur. Réessaie plus tard, ou écris à support@tickrace.com.",
      },
      500,
      c
    );
  }
});
