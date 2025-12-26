// src/components/CoursesMap.jsx
import React, { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { Link } from "react-router-dom";

/* ----------------------------- Utils ----------------------------- */
const parseDate = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const formatDate = (d) => {
  const dt = typeof d === "string" ? parseDate(d) : d;
  if (!dt) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(dt);
};

const getWindowStatus = (now, openAt, closeAt) => {
  if (!openAt && !closeAt) return { key: "unknown", label: "" };
  if (openAt && now < openAt) return { key: "soon", label: "Bientôt" };
  if (closeAt && now > closeAt) return { key: "closed", label: "Fermées" };
  return { key: "open", label: "Ouvertes" };
};

const formatPlaces = (count, max) => {
  const c = Number(count || 0);
  const m = Number(max || 0);
  if (!Number.isFinite(m) || m <= 0) return null;
  return `${c}/${m}`;
};

const badgeForStatus = (statusKey) => {
  if (statusKey === "open") return { text: "Inscriptions ouvertes", cls: "bg-emerald-100 text-emerald-700" };
  if (statusKey === "soon") return { text: "Inscriptions bientôt", cls: "bg-amber-100 text-amber-700" };
  if (statusKey === "closed") return { text: "Inscriptions fermées", cls: "bg-neutral-200 text-neutral-700" };
  return null;
};

/* ---------------------------- Icon ------------------------------- */
const courseIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

export default function CoursesMap({ courses = [] }) {
  const defaultPosition = [46.8, 2.5]; // Centre France
  const zoom = 6;

  const normalized = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.toDateString());

    return (courses || [])
      .map((c) => {
        const formats = Array.isArray(c.formats) ? c.formats : [];
        const sorted = [...formats].sort((a, b) => {
          const ta = parseDate(a.date)?.getTime() ?? Infinity;
          const tb = parseDate(b.date)?.getTime() ?? Infinity;
          return ta - tb;
        });

        const upcoming = sorted.filter((f) => {
          const d = parseDate(f.date);
          return d && d >= todayStart;
        });

        const nextFormat = (upcoming.length ? upcoming : sorted)[0] || null;

        const openAt = nextFormat?.inscription_ouverture ? parseDate(nextFormat.inscription_ouverture) : null;
        const closeAt = nextFormat?.inscription_fermeture ? parseDate(nextFormat.inscription_fermeture) : null;
        const windowStatus = getWindowStatus(now, openAt, closeAt);
        const placesText = nextFormat ? formatPlaces(nextFormat.nb_inscrits, nextFormat.nb_max_coureurs) : null;

        return {
          ...c,
          formats: sorted,
          nextFormat,
          windowStatus,
          placesText,
        };
      })
      .filter((c) => Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng)));
  }, [courses]);

  return (
    <div className="rounded-2xl ring-1 ring-neutral-200 bg-white overflow-hidden">
      <MapContainer center={defaultPosition} zoom={zoom} style={{ height: 600, width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {normalized.map((course) => {
          const pos = [Number(course.lat), Number(course.lng)];
          const nextDateLabel = course.nextFormat?.date ? formatDate(course.nextFormat.date) : "—";
          const statusBadge =
            course.is_full
              ? { text: "Complet", cls: "bg-rose-100 text-rose-700" }
              : badgeForStatus(course.windowStatus?.key);

          return (
            <Marker key={course.id} position={pos} icon={courseIcon}>
              <Popup>
                <div className="text-sm w-[240px]">
                  <div className="font-semibold text-neutral-900">{course.nom}</div>
                  <div className="text-neutral-600">
                    {course.lieu} {course.departement ? `(${course.departement})` : ""}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {statusBadge && (
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statusBadge.cls}`}>
                        {statusBadge.text}
                      </span>
                    )}
                    {course.placesText && (
                      <span className="rounded-full bg-white ring-1 ring-neutral-200 px-2.5 py-1 text-[11px] font-semibold text-neutral-800">
                        Places {course.placesText}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 text-neutral-700">
                    Prochaine date : <strong>{nextDateLabel}</strong>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Link
                      to={`/courses/${course.id}`}
                      className="inline-flex items-center justify-center rounded-xl bg-neutral-900 px-3 py-2 text-white text-sm font-semibold hover:brightness-110"
                    >
                      Voir
                    </Link>

                    <Link
                      to={`/benevoles/${course.id}`}
                      className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                    >
                      Bénévoles
                    </Link>

                    <Link
                      to={`/inscription/${course.id}`}
                      className="col-span-2 inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                    >
                      S’inscrire
                    </Link>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
