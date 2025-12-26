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
  if (!dt) return "—";
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
  if (statusKey === "open") return { text: "Ouvertes", cls: "bg-emerald-100 text-emerald-700" };
  if (statusKey === "soon") return { text: "Bientôt", cls: "bg-amber-100 text-amber-700" };
  if (statusKey === "closed") return { text: "Fermées", cls: "bg-neutral-200 text-neutral-700" };
  return null;
};

const fmtNum = (n) => (Number.isFinite(Number(n)) ? Number(n) : null);

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

        // Pré-calc par format (badges + places + complet)
        const formatsVM = sorted.map((f) => {
          const openAt = f.inscription_ouverture ? parseDate(f.inscription_ouverture) : null;
          const closeAt = f.inscription_fermeture ? parseDate(f.inscription_fermeture) : null;
          const status = getWindowStatus(now, openAt, closeAt);
          const placesText = formatPlaces(f.nb_inscrits, f.nb_max_coureurs);

          const max = Number(f.nb_max_coureurs);
          const count = Number(f.nb_inscrits || 0);
          const closeOnFull = f.close_on_full !== false; // default true
          const isFull = !!(closeOnFull && max && Number.isFinite(max) && count >= max);

          const dist = fmtNum(f.distance_km);
          const dplus = fmtNum(f.denivele_dplus);

          return {
            ...f,
            _dateLabel: formatDate(f.date),
            _status: status, // {key,label}
            _statusBadge: badgeForStatus(status.key),
            _placesText: placesText,
            _isFull: isFull,
            _dist: dist,
            _dplus: dplus,
          };
        });

        // Complet course si tous les formats complets (comme Courses.jsx)
        let isFullCourse = false;
        if (formatsVM.length) {
          isFullCourse = formatsVM.every((f) => f._isFull);
        }

        return {
          ...c,
          formats: formatsVM,
          nextFormat,
          is_full: typeof c.is_full === "boolean" ? c.is_full : isFullCourse,
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

          return (
            <Marker key={course.id} position={pos} icon={courseIcon}>
              <Popup>
                <div className="text-sm w-[300px]">
                  <div className="font-semibold text-neutral-900">{course.nom}</div>
                  <div className="text-neutral-600">
                    {course.lieu} {course.departement ? `(${course.departement})` : ""}
                  </div>

                  <div className="mt-2 text-neutral-700">
                    Prochaine date : <strong>{nextDateLabel}</strong>
                  </div>

                  {/* Formats dynamiques */}
                  <div className="mt-3">
                    <div className="text-xs font-semibold text-neutral-700 mb-2">Formats</div>

                    <div className="space-y-2 max-h-[220px] overflow-auto pr-1">
                      {(course.formats || []).length === 0 ? (
                        <div className="text-sm text-neutral-500">Aucun format publié.</div>
                      ) : (
                        course.formats.map((f) => {
                          const statusBadge =
                            f._isFull
                              ? { text: "Complet", cls: "bg-rose-100 text-rose-700" }
                              : f._statusBadge;

                          return (
                            <div
                              key={f.id}
                              className="rounded-xl border border-neutral-200 bg-white p-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-neutral-900 truncate">
                                    {f.nom || "Format"}
                                  </div>
                                  <div className="text-xs text-neutral-600 mt-0.5">
                                    📅 {f._dateLabel}
                                    {f._dist != null && (
                                      <>
                                        {"  "}•{" "}
                                        <span className="whitespace-nowrap">
                                          {Math.round(f._dist)} km
                                        </span>
                                      </>
                                    )}
                                    {f._dplus != null && (
                                      <>
                                        {"  "}•{" "}
                                        <span className="whitespace-nowrap">
                                          {Math.round(f._dplus)} m D+
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  {statusBadge && (
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadge.cls}`}
                                      title={
                                        f._status?.key === "soon" && f.inscription_ouverture
                                          ? `Ouverture le ${formatDate(f.inscription_ouverture)}`
                                          : f._status?.key === "closed" && f.inscription_fermeture
                                          ? `Fermeture le ${formatDate(f.inscription_fermeture)}`
                                          : undefined
                                      }
                                    >
                                      {statusBadge.text}
                                    </span>
                                  )}

                                  {f._placesText && (
                                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-800">
                                      Places {f._placesText}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="mt-2 flex items-center gap-2">
                                <Link
                                  to={`/inscription/${course.id}`}
                                  className="inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-neutral-50"
                                  title="S’inscrire (choix du format sur la page)"
                                >
                                  S’inscrire
                                </Link>

                                <Link
                                  to={`/courses/${course.id}`}
                                  className="inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-neutral-50"
                                  title="Voir l’épreuve"
                                >
                                  Voir
                                </Link>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* CTAs globaux */}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Link
                      to={`/courses/${course.id}`}
                      className="inline-flex items-center justify-center rounded-xl bg-neutral-900 px-3 py-2 text-white text-sm font-semibold hover:brightness-110"
                    >
                      Voir l’épreuve
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
