import { ImageResponse } from "@vercel/og";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseSR = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const ORANGE = "#f97316"; // Tickrace vibe
const DARK = "#0a0a0a";

function safeStr(v: any, fb = "") {
  return typeof v === "string" && v.trim() ? v.trim() : fb;
}

function pickPrimaryFormat(formats: any[] | null | undefined) {
  if (!Array.isArray(formats) || formats.length === 0) return null;
  const sorted = [...formats].sort((a, b) => {
    const da = `${a?.date || "9999-12-31"}T${a?.heure_depart || "23:59"}`;
    const db = `${b?.date || "9999-12-31"}T${b?.heure_depart || "23:59"}`;
    return da.localeCompare(db);
  });
  return sorted[0];
}

function fmtDateFR(iso: string) {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default async function handler(req: Request) {
  const id = new URL(req.url).pathname.split("/").pop();

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
    return new ImageResponse(
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: DARK,
          color: "white",
          fontSize: 56,
          fontWeight: 900,
        }}
      >
        Tickrace
      </div>,
      { width: 1200, height: 630 }
    );
  }

  const f = pickPrimaryFormat(data.formats);
  const title = safeStr(data.nom, "Course Tickrace");
  const lieu = safeStr(data.lieu, "");
  const distance = f?.distance ? `${f.distance} km` : "";
  const dplus = f?.denivele_positif ? `${f.denivele_positif} m D+` : "";
  const date = f?.date ? fmtDateFR(String(f.date)) : "";
  const heure = f?.heure_depart ? `🕒 ${String(f.heure_depart).slice(0, 5)}` : "";

  const topChips = [distance, dplus].filter(Boolean);
  const bottomLine = [date, heure, lieu].filter(Boolean).join(" • ");

  const bg = safeStr(data.image_url, "");

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          padding: "56px",
          boxSizing: "border-box",
          background: bg
            ? `linear-gradient(90deg, rgba(10,10,10,.92), rgba(10,10,10,.30)), url(${bg})`
            : `radial-gradient(circle at 20% 20%, rgba(249,115,22,.18), transparent 35%),
               radial-gradient(circle at 80% 35%, rgba(249,115,22,.14), transparent 40%),
               linear-gradient(135deg, ${DARK}, #111827)`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          color: "white",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: 1 }}>TICKRACE</div>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: ORANGE,
                boxShadow: "0 0 0 6px rgba(249,115,22,.15)",
              }}
            />
            <div style={{ fontSize: 18, opacity: 0.88 }}>Inscriptions & résultats</div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 16px",
              borderRadius: 999,
              background: "rgba(255,255,255,.08)",
              border: "1px solid rgba(255,255,255,.14)",
              fontSize: 18,
              opacity: 0.95,
            }}
          >
            <span style={{ color: ORANGE, fontWeight: 900 }}>●</span>
            tickrace.com
          </div>
        </div>

        <div style={{ height: 34 }} />

        {/* Content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          {/* Chips */}
          {topChips.length > 0 ? (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
              {topChips.map((c) => (
                <div
                  key={c}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 999,
                    background: "rgba(249,115,22,.14)",
                    border: "1px solid rgba(249,115,22,.28)",
                    fontSize: 20,
                  }}
                >
                  {c}
                </div>
              ))}
            </div>
          ) : null}

          {/* Title */}
          <div
            style={{
              fontSize: 72,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -1,
              textShadow: "0 10px 30px rgba(0,0,0,.40)",
              marginBottom: 18,
              maxWidth: "1040px",
            }}
          >
            {title}
          </div>

          {/* Bottom line */}
          {bottomLine ? (
            <div
              style={{
                fontSize: 24,
                opacity: 0.92,
                textShadow: "0 10px 30px rgba(0,0,0,.40)",
              }}
            >
              {bottomLine}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: 28,
            paddingTop: 18,
            borderTop: "1px solid rgba(255,255,255,.14)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div style={{ fontSize: 18, opacity: 0.9 }}>Partage ce lien pour inviter des coureurs 👇</div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              borderRadius: 14,
              background: "rgba(255,255,255,.08)",
              border: "1px solid rgba(255,255,255,.14)",
              fontSize: 18,
            }}
          >
            <span style={{ color: ORANGE, fontWeight: 900 }}>→</span>
            /courses/{String(data.id).slice(0, 8)}…
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
