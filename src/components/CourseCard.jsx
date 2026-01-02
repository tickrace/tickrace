// src/components/CourseCard.jsx
import React from "react";
import { Link } from "react-router-dom";
import { InscriptionPlacesBadge, InscriptionStatusBadge } from "./InscriptionBadges";

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

// ✅ Multi-sport compat : sport_global sinon fallback type_epreuve (ancien modèle)
const getSportLabelFromFormat = (format) => {
  const sg = (format?.sport_global || "").trim();
  if (sg) return sg;

  const te = (format?.type_epreuve || "").trim().toLowerCase();
  if (te === "trail") return "Trail";
  if (te === "route") return "Course à pied";
  if (te === "rando") return "Randonnée";
  return "";
};

// ✅ Style badges par sport (facultatif, juste pour harmoniser)
const sportBadgeClass = (sport) => {
  const s = (sport || "").toLowerCase();
  if (s.includes("trail")) return "bg-violet-100 text-violet-700";
  if (s.includes("course")) return "bg-blue-100 text-blue-700";
  if (s.includes("vtt") || s.includes("gravel") || s.includes("cyclo"))
    return "bg-green-100 text-green-700";
  if (s.includes("triathlon") || s.includes("swimrun") || s.includes("raid") || s.includes("multisport"))
    return "bg-amber-100 text-amber-800";
  if (s.includes("natation") || s.includes("swim")) return "bg-cyan-100 text-cyan-800";
  if (s.includes("orientation") || s.includes("orienteering")) return "bg-lime-100 text-lime-800";
  if (s.includes("rando")) return "bg-stone-100 text-stone-700";
  return "bg-neutral-100 text-neutral-700";
};

function uniqueSportsFromCourse(course) {
  const formats = Array.isArray(course?.formats) ? course.formats : [];
  const set = new Set();
  for (const f of formats) {
    const s = getSportLabelFromFormat(f);
    if (s) set.add(s);
  }
  return Array.from(set);
}

function orderSports(sports, nextSport) {
  if (!sports.length) return [];
  if (!nextSport) return sports.slice().sort((a, b) => a.localeCompare(b, "fr"));

  // nextSport en premier, puis le reste trié
  const rest = sports.filter((s) => s !== nextSport).sort((a, b) => a.localeCompare(b, "fr"));
  return [nextSport, ...rest];
}

/**
 * Attend un objet "course" déjà décoré (Courses.jsx / Home.jsx) :
 * {
 *  id, nom, lieu, departement, image_url,
 *  next_date, next_format,
 *  min_dist, max_dist, min_dplus, max_dplus, min_prix,
 *  is_full, is_new, has_multiple_formats,
 *  formats: [...]
 * }
 */
export default function CourseCard({ course }) {
  const soon =
    course?.next_date &&
    (parseDate(course.next_date)?.getTime() - new Date().getTime()) / 86400000 <= 14;

  const nextSport = getSportLabelFromFormat(course?.next_format);
  const sportsAll = uniqueSportsFromCourse(course);
  const sportsOrdered = orderSports(sportsAll, nextSport);

  const maxBadges = 3;
  const visibleSports = sportsOrdered.slice(0, maxBadges);
  const extraCount = Math.max(0, sportsOrdered.length - maxBadges);

  return (
    <div className="group overflow-hidden rounded-2xl ring-1 ring-neutral-200 bg-white shadow-sm hover:shadow-md transition-shadow">
      {/* Image */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-neutral-100">
        {course?.image_url ? (
          <img
            src={course.image_url}
            alt={`Image de ${course.nom}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-neutral-400 text-sm">
            Pas d’image
          </div>
        )}

        {/* Badges */}
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {/* ✅ Sports multiples */}
          {visibleSports.map((s) => (
            <span
              key={s}
              className={[
                "rounded-full px-2.5 py-1 text-[11px] font-medium",
                sportBadgeClass(s),
              ].join(" ")}
              title={sportsOrdered.length > 1 ? `Sports : ${sportsOrdered.join(", ")}` : `Sport : ${s}`}
            >
              {s}
            </span>
          ))}

          {extraCount > 0 && (
            <span
              className="rounded-full bg-neutral-900/80 px-2.5 py-1 text-[11px] font-medium text-white"
              title={`Autres sports : ${sportsOrdered.slice(maxBadges).join(", ")}`}
            >
              +{extraCount}
            </span>
          )}

          {soon && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
              Bientôt
            </span>
          )}

          {/* ✅ Badge inscriptions (complet/ouvertes/bientôt/fermées) */}
          <InscriptionStatusBadge
            format={course?.next_format}
            isFullOverride={course?.is_full}
            prefix="Inscriptions"
          />

          {course?.has_multiple_formats && (
            <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-medium text-sky-700">
              Multi-formats
            </span>
          )}

          {course?.is_new && (
            <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-medium text-orange-700">
              Nouveau
            </span>
          )}
        </div>

        {/* ✅ Mini compteur places (format prochain) */}
        <div className="absolute right-3 bottom-3">
          <InscriptionPlacesBadge format={course?.next_format} style="overlay" />
        </div>
      </div>

      {/* Infos */}
      <div className="p-4">
        <h3 className="line-clamp-1 text-lg font-semibold">{course?.nom}</h3>

        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-600">
          <span>
            📍 {course?.lieu} {course?.departement ? `(${course.departement})` : ""}
          </span>
          {course?.next_date && <span>📅 {formatDate(course.next_date)}</span>}
        </div>

        <div className="mt-2 text-sm text-neutral-700 space-y-1">
          {course?.min_dist != null && course?.max_dist != null && (
            <div>
              Distance :{" "}
              <strong>
                {Math.round(course.min_dist)}–{Math.round(course.max_dist)} km
              </strong>
            </div>
          )}

          {course?.min_dplus != null && course?.max_dplus != null && (
            <div>
              D+ :{" "}
              <strong>
                {Math.round(course.min_dplus)}–{Math.round(course.max_dplus)} m
              </strong>
            </div>
          )}

          {course?.min_prix != null && (
            <div>
              À partir de <strong>{Number(course.min_prix).toFixed(2)} €</strong>
            </div>
          )}
        </div>

        {/* CTA unique */}
        <div className="mt-4">
          <Link
            to={`/courses/${course.id}`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 text-white text-sm font-semibold hover:brightness-110"
            title="Voir l'épreuve"
          >
            Voir l’épreuve ↗
          </Link>
        </div>
      </div>
    </div>
  );
}
