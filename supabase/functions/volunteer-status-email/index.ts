// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { Resend } from "https://esm.sh/resend@3.2.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const resend = new Resend(RESEND_API_KEY);
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const ALLOWED_ORIGINS = [
  "https://www.tickrace.com",
  "https://tickrace.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];
function cors(o: string | null) {
  const origin = o && ALLOWED_ORIGINS.includes(o) ? o : "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, prefer",
  };
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });

  try {
    const body = await req.json();
    const { inscription_id, benevole_id, course_id } = body ?? {};
    if (!inscription_id && !(benevole_id && course_id)) {
      return json({ error: "inscription_id requis (ou benevole_id+course_id)" }, 400, origin);
    }

    // Charger la ligne d'inscription + jointures
    const { data: row, error } = await admin
      .from("benevoles_inscriptions")
      .select(`
        id, statut, message, created_at,
        benevole:benevole_id ( id, nom, prenom, email, telephone ),
        course:course_id ( id, nom, lieu )
      `)
      .match(
        inscription_id
          ? { id: inscription_id }
          : { benevole_id: benevole_id, course_id: course_id },
      )
      .maybeSingle();

    if (error || !row) return json({ error: "Inscription introuvable." }, 404, origin);
    if (!row.benevole?.email) return json({ error: "Email bénévole manquant." }, 400, origin);

    // Chercher la prochaine date (format le plus proche dans le futur)
    const { data: nextFmt } = await admin
      .from("formats")
      .select("date, heure_depart")
      .eq("course_id", row.course.id)
      .gte("date", new Date().toISOString().slice(0, 10))
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle();

    // Générer ICS (facultatif, all-day si pas d'horaire)
    const ics = buildICS({
      title: `Bénévole — ${row.course.nom}`,
      location: row.course.lieu || "",
      description: `Merci pour votre aide bénévole sur ${row.course.nom}.\n\nMessage transmis: ${row.message ?? "(aucun)"}`,
      date: nextFmt?.date || null,
      time: nextFmt?.heure_depart || null,
    });

    // Email bénévole
    try {
      await resend.emails.send({
        from: "Tickrace <noreply@tickrace.com>",
        to: row.benevole.email,
        subject: `Confirmation bénévole — ${row.course.nom}`,
        html: `
          <p>Bonjour ${esc(row.benevole.prenom)} ${esc(row.benevole.nom)},</p>
          <p>Votre participation comme <strong>bénévole</strong> pour <strong>${esc(row.course.nom)}</strong> est <strong>validée</strong>. Merci 🙌</p>
          ${
            nextFmt?.date
              ? `<p><strong>Prochaine date :</strong> ${esc(nextFmt.date)}${
                  nextFmt.heure_depart ? " • " + esc(nextFmt.heure_depart) : ""
                }</p>`
              : ""
          }
          <p>Lieu : ${esc(row.course.lieu || "-")}</p>
          <p>Message initial : ${row.message ? `<em>${esc(String(row.message))}</em>` : "(aucun)"}</p>
          <p>Sportivement,<br/>L'équipe Tickrace</p>
        `,
        attachments: ics
          ? [
              {
                filename: "benevole.ics",
                content: btoa(ics),
                contentType: "text/calendar; charset=utf-8",
              },
            ]
          : undefined,
      });
    } catch (_) {
      // on n'échoue pas la fonction si l'email ne part pas
    }

    // Notification organisateur (optionnel)
    try {
      const { data: u } = await admin.auth.admin.getUserById(
        (row as any).course.organisateur_id ?? "", // au cas où jointure différente
      );
      const orgaEmail = u?.user?.email;
      if (orgaEmail) {
        await resend.emails.send({
          from: "Tickrace <noreply@tickrace.com>",
          to: orgaEmail,
          subject: `Bénévole validé — ${row.course.nom}`,
          html: `
            <p>Bénévole validé pour <strong>${esc(row.course.nom)}</strong>.</p>
            <ul>
              <li>${esc(row.benevole.prenom)} ${esc(row.benevole.nom)} — ${esc(row.benevole.email)}</li>
              <li>Téléphone : ${esc(row.benevole.telephone || "-")}</li>
            </ul>
          `,
        });
      }
    } catch {}

    return json({ ok: true }, 200, origin);
  } catch (e) {
    return json({ error: "Bad Request", details: String(e) }, 400, origin);
  }
});

function json(obj: any, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors(origin) },
  });
}

function esc(s: string) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildICS(opts: {
  title: string;
  location?: string;
  description?: string;
  date: string | null; // YYYY-MM-DD
  time?: string | null; // HH:mm (optionnel)
}): string | null {
  if (!opts.date) return null;
  // Si pas d'heure, événement sur la journée (VALUE=DATE)
  const dt = opts.date.replaceAll("-", "");
  if (!opts.time) {
    return [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Tickrace//Volunteer//FR",
      "BEGIN:VEVENT",
      `UID:${cryptoRandom()}`,
      `DTSTAMP:${nowUTC()}`,
      `DTSTART;VALUE=DATE:${dt}`,
      `SUMMARY:${escapeICS(opts.title)}`,
      opts.location ? `LOCATION:${escapeICS(opts.location)}` : "",
      opts.description ? `DESCRIPTION:${escapeICS(opts.description)}` : "",
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .filter(Boolean)
      .join("\r\n");
  }
  // Avec heure locale → on encode en UTC (simplification)
  const [h, m] = String(opts.time).split(":").map((x) => parseInt(x, 10) || 0);
  const local = new Date(`${opts.date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
  const startUTC = toICSDateUTC(local);
  const endUTC = toICSDateUTC(new Date(local.getTime() + 2 * 60 * 60 * 1000)); // 2h par défaut
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tickrace//Volunteer//FR",
    "BEGIN:VEVENT",
    `UID:${cryptoRandom()}`,
    `DTSTAMP:${nowUTC()}`,
    `DTSTART:${startUTC}`,
    `DTEND:${endUTC}`,
    `SUMMARY:${escapeICS(opts.title)}`,
    opts.location ? `LOCATION:${escapeICS(opts.location)}` : "",
    opts.description ? `DESCRIPTION:${escapeICS(opts.description)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

function toICSDateUTC(d: Date) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}
function nowUTC() { return toICSDateUTC(new Date()); }
function cryptoRandom() {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function escapeICS(s: string) {
  return s.replace(/[,\n;]/g, (m) => ({ ",": "\\,", "\n": "\\n", ";": "\\;" }[m]!));
}
