import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "edge" };


const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseSR = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function pickPrimaryFormat(formats: any[] | null | undefined) {
  if (!Array.isArray(formats) || formats.length === 0) return null;
  // ✅ choix “propre” : format le plus tôt (date + heure)
  const sorted = [...formats].sort((a, b) => {
    const da = `${a?.date || "9999-12-31"}T${a?.heure_depart || "23:59"}`;
    const db = `${b?.date || "9999-12-31"}T${b?.heure_depart || "23:59"}`;
    return da.localeCompare(db);
  });
  return sorted[0];
}

export default async function handler(req: Request) {
  const id = new URL(req.url).pathname.split("/").pop();
  const origin = "https://www.tickrace.com";

  const { data, error } = await supabaseSR
    .from("courses")
    .select(
      `
      id,
      nom,
      lieu,
      image_url,
      formats:formats (
        distance,
        denivele_positif,
        date,
        heure_depart
      )
    `
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  const f = pickPrimaryFormat(data.formats);
  const distance = f?.distance ?? null;
  const dplus = f?.denivele_positif ?? null;
  const date = f?.date ?? null;
  const heure = f?.heure_depart ?? null;

  const title = data.nom || "Tickrace";
  const description = [
    distance ? `${distance} km` : null,
    dplus ? `${dplus} m D+` : null,
    data.lieu || null,
    date ? `📅 ${date}` : null,
    heure ? `🕒 ${String(heure).slice(0, 5)}` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  return new Response(
    JSON.stringify({
      id: data.id,
      title,
      description,
      url: `${origin}/courses/${data.id}`,
      image: `${origin}/api/og-image/course/${data.id}`,
      image_bg: data.image_url || null, // ✅ fond
    }),
    { headers: { "content-type": "application/json" } }
  );
}
