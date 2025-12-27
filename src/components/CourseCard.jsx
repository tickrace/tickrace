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

/**
 * Attend un objet "course" déjà décoré (comme dans Courses.jsx / Home.jsx) :
 * {
 *  id, nom, lieu, departement, image_url,
 *  next_date, next_format,
 *  min_dist, max_dist, min_dplus, max_dplus, min_prix,
 *  is_full, is_new, has_multiple_formats
 * }
 */
export default function CourseCard({ course }) {
  const soon =
    course?.next_date &&
    (parseDate(course.next_date)?.getTime() - new Date().getTime()) / 86400000 <= 14;

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

        {/* CTAs */}
        <div className="mt-4 flex flex-col gap-2">
          <Link
            to={`/courses/${course.id}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 text-white text-sm font-semibold hover:brightness-110"
            title="Voir l'épreuve"
          >
            Voir l’épreuve ↗
          </Link>

          <div className="grid grid-cols-2 gap-2">
            <Link
              to={`/inscription/${course.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
              title="S'inscrire"
            >
              S’inscrire
            </Link>

            <Link
              to={`/benevoles/${course.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
              title="S’inscrire comme bénévole"
            >
              Bénévoles
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
