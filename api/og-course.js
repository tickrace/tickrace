// api/og-course.js
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SERVICE_ROLE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE || // fallback éventuel
  process.env.SUPABASE_SERVICE_KEY; // fallback éventuel

function pickPrimaryFormat(formats) {
  if (!Array.isArray(formats) || formats.length === 0) return null;
  const sorted = [...formats].sort((a, b) => {
    const da = `${a?.date || "9999-12-31"}T${a?.heure_depart || "23:59"}`;
    const db = `${b?.date || "9999-12-31"}T${b?.heure_depart || "23:59"}`;
    return da.localeCompare(db);
  });
  return sorted[0];
}

async function supaGetCourseOnly(id) {
  const url =
    `${SUPABASE_URL}/rest/v1/courses` +
    `?id=eq.${encodeURIComponent(id)}` +
    `&select=id,nom,lieu,image_url`;

  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0] ?? null;
}

async function supaGetFormats(courseId) {
  const url =
    `${SUPABASE_URL}/rest/v1/formats` +
    `?course_id=eq.${encodeURIComponent(courseId)}` +
    `&select=distance,denivele_positif,date,heure_depart` +
    `&order=date.asc`;

  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) return [];
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

export default async function handler(req, res) {
  const origin = "https://www.tickrace.com";
  const id = req.query?.id || "";

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    res.status(500).json({
      error: "Missing env VITE_SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY",
    });
    return;
  }

  if (!id) {
    res.status(400).json({ error: "Missing id" });
    return;
  }

  const course = await supaGetCourseOnly(id);
  if (!course) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const formats = await supaGetFormats(id);
  const f = pickPrimaryFormat(formats);

  const distance = f?.distance ?? null;
  const dplus = f?.denivele_positif ?? null;
  const date = f?.date ?? null;
  const heure = f?.heure_depart ?? null;

  const title = course.nom || "Tickrace";
  const description = [
    distance ? `${distance} km` : null,
    dplus ? `${dplus} m D+` : null,
    course.lieu || null,
    date ? `📅 ${date}` : null,
    heure ? `🕒 ${String(heure).slice(0, 5)}` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  res.setHeader("Content-Type", "application/json");
  res.status(200).send(
    JSON.stringify({
      id: course.id,
      title,
      description,
      url: `${origin}/courses/${course.id}`,
      image: `${origin}/api/og-image?id=${encodeURIComponent(course.id)}`,
      image_bg: course.image_url || null,
    })
  );
}
