// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1?target=deno&deno-std=0.192.0";
import { Resend } from "https://esm.sh/resend@3.2.0?target=deno&deno-std=0.192.0";

/* ========= Env ========= */
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const resend = new Resend(RESEND_API_KEY);
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/* ========= CORS ========= */
const ALLOWED_ORIGINS = [
  "https://www.tickrace.com",
  "https://tickrace.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function corsHeaders(origin: string | null) {
  const allowOrigin =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info, prefer",
  };
}

/* ========= Utils ========= */

function stripHtml(html: string): string {
  try {
    const withoutTags = html.replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, " ");
    return withoutTags
      .replace(/\s+/g, " ")
      .replace(/\u00A0/g, " ")
      .trim();
  } catch {
    return html;
  }
}

function tmpl(input: string, vars: Record<string, any>): string {
  if (!input) return "";
  return input.replace(/\{\{\s*([a-zA-Z0-9_\.]+)\s*\}\}/g, (_, key) => {
    const path = key.split(".");
    let cur: any = vars;
    for (const p of path) {
      if (cur && typeof cur === "object" && p in cur) {
        cur = cur[p];
      } else {
        return "";
      }
    }
    return (cur ?? "").toString();
  });
}

function chunk<T>(arr: T[], size = 80): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/* ========= Types du body =========
  {
    course_id?: string;
    volunteer_ids?: string[]; // benevoles_inscriptions.id OU benevoles.id (voir param recipient_key)
    recipient_key?: "benevoles_inscriptions.id" | "benevoles.id"; // défaut: benevoles.id
    statut?: "nouveau" | "valide" | "refuse"; // optionnel si course_id utilisé
    subject: string;  // peut contenir {{variables}}
    html: string;     // peut contenir {{variables}}
    reply_to?: string;
  }
*/

serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }

  try {
    const body = await req.json();
    const {
      course_id,
      volunteer_ids,
      recipient_key = "benevoles.id",
      statut,
      subject,
      html,
      reply_to,
    } = body ?? {};

    if (!subject || !html) {
      return new Response(
        JSON.stringify({ error: "Sujet et contenu HTML sont requis." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } },
      );
    }

    // --- Récupération destinataires ---
    // Cas 1: IDs fournis (benevoles.id ou benevoles_inscriptions.id)
    // Cas 2: Filtre par course_id (+ statut optionnel) sur benevoles_inscriptions
    let recipients: Array<{
      email: string;
      nom: string;
      prenom: string;
      benevole_id?: string;
      benevoles_inscriptions_id?: string;
      course_nom?: string;
      course_lieu?: string;
    }> = [];

    if (Array.isArray(volunteer_ids) && volunteer_ids.length > 0) {
      if (recipient_key === "benevoles_inscriptions.id") {
        // Joindre pour obtenir email + infos course
        const { data, error } = await admin
          .from("benevoles_inscriptions")
          .select(`
            id,
            benevole:benevole_id ( id, nom, prenom, email, telephone ),
            course:course_id ( id, nom, lieu )
          `)
          .in("id", volunteer_ids);

        if (error) throw error;

        recipients = (data || [])
          .map((r: any) => ({
            email: r?.benevole?.email,
            nom: r?.benevole?.nom ?? "",
            prenom: r?.benevole?.prenom ?? "",
            benevoles_inscriptions_id: r?.id,
            benevole_id: r?.benevole?.id,
            course_nom: r?.course?.nom ?? "",
            course_lieu: r?.course?.lieu ?? "",
          }))
          .filter((x) => x.email);
      } else {
        // recipient_key === "benevoles.id"
        const { data, error } = await admin
          .from("benevoles")
          .select("id, nom, prenom, email, telephone")
          .in("id", volunteer_ids);

        if (error) throw error;

        recipients = (data || [])
          .map((b: any) => ({
            email: b?.email,
            nom: b?.nom ?? "",
            prenom: b?.prenom ?? "",
            benevole_id: b?.id,
          }))
          .filter((x) => x.email);
      }
    } else if (course_id) {
      // Filtre par course + (statut optionnel)
      let query = admin
        .from("benevoles_inscriptions")
        .select(`
          id, statut,
          benevole:benevole_id ( id, nom, prenom, email ),
          course:course_id ( id, nom, lieu )
        `)
        .eq("course_id", course_id);

      if (statut) query = query.eq("statut", statut);
      const { data, error } = await query;
      if (error) throw error;

      recipients = (data || [])
        .map((r: any) => ({
          email: r?.benevole?.email,
          nom: r?.benevole?.nom ?? "",
          prenom: r?.benevole?.prenom ?? "",
          benevoles_inscriptions_id: r?.id,
          benevole_id: r?.benevole?.id,
          course_nom: r?.course?.nom ?? "",
          course_lieu: r?.course?.lieu ?? "",
        }))
        .filter((x) => x.email);
    } else {
      return new Response(
        JSON.stringify({ error: "Fournir `volunteer_ids` ou `course_id`." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } },
      );
    }

    // Déduplication par email
    const byEmail = new Map<string, typeof recipients[number]>();
    for (const r of recipients) {
      if (!byEmail.has(r.email)) byEmail.set(r.email, r);
    }
    const uniqueRecipients = Array.from(byEmail.values());
    if (uniqueRecipients.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, results: [] }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } },
      );
    }

    // Récup info course si possible (pour templating global)
    let courseInfo: { nom?: string; lieu?: string } = {};
    if (course_id) {
      const { data: c } = await admin
        .from("courses")
        .select("id, nom, lieu")
        .eq("id", course_id)
        .maybeSingle();
      if (c) courseInfo = { nom: c.nom, lieu: c.lieu };
    }

    // Prépare envoi
    const now = new Date();
    const globalVars = {
      date_iso: now.toISOString(),
      course_nom: courseInfo.nom ?? "",
      course_lieu: courseInfo.lieu ?? "",
    };

    const results: Array<{ email: string; ok: boolean; error?: string }> = [];

    // Envoi par lots
    for (const group of chunk(uniqueRecipients, 80)) {
      const promises = group.map(async (rcpt) => {
        const vars = {
          ...globalVars,
          prenom: rcpt.prenom ?? "",
          nom: rcpt.nom ?? "",
          course_nom: rcpt.course_nom || globalVars.course_nom,
          course_lieu: rcpt.course_lieu || globalVars.course_lieu,
        };

        const subj = tmpl(subject, vars) || "Message organisateur";
        const htmlBody = tmpl(html, vars);
        const textBody = stripHtml(htmlBody);

        try {
          await resend.emails.send({
            from: "Tickrace <noreply@tickrace.com>",
            to: rcpt.email,
            subject: subj,
            html: htmlBody,
            text: textBody,
            replyTo: reply_to || undefined,
          });
          results.push({ email: rcpt.email, ok: true });
        } catch (e) {
          results.push({ email: rcpt.email, ok: false, error: String(e) });
        }
      });

      await Promise.all(promises);
      // Petite pause (optionnel) si tu veux throttler davantage :
      // await new Promise((r) => setTimeout(r, 200));
    }

    return new Response(
      JSON.stringify({
        ok: true,
        sent: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        results,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Bad Request", details: String(e) }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } },
    );
  }
});
