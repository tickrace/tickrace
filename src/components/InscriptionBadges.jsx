// src/components/InscriptionBadges.jsx
import React, { useMemo } from "react";

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

const statusBadgeForKey = (key) => {
  if (key === "open") return { text: "Ouvertes", cls: "bg-emerald-100 text-emerald-700" };
  if (key === "soon") return { text: "Bientôt", cls: "bg-amber-100 text-amber-700" };
  if (key === "closed") return { text: "Fermées", cls: "bg-neutral-200 text-neutral-700" };
  return null;
};

const isFormatFull = (format) => {
  if (!format) return false;
  const max = Number(format.nb_max_coureurs);
  const count = Number(format.nb_inscrits || 0);
  const closeOnFull = format.close_on_full !== false; // default true
  if (!closeOnFull) return false;
  if (!max || Number.isNaN(max)) return false;
  return count >= max;
};

const placesText = (format) => {
  if (!format) return null;
  const max = Number(format.nb_max_coureurs);
  if (!Number.isFinite(max) || max <= 0) return null;
  const count = Number(format.nb_inscrits || 0);
  return `${count}/${max}`;
};

/* --------------------------- Components -------------------------- */
/**
 * Badge statut inscriptions (Ouvertes / Bientôt / Fermées / Complet)
 */
export function InscriptionStatusBadge({
  format,
  isFullOverride,
  prefix = "Inscriptions",
  className = "",
}) {
  const now = useMemo(() => new Date(), []);
  const full = Boolean(isFullOverride ?? isFormatFull(format));

  const computed = useMemo(() => {
    if (!format) return { badge: null, title: "" };

    const openAt = parseDate(format.inscription_ouverture);
    const closeAt = parseDate(format.inscription_fermeture);
    const status = getWindowStatus(now, openAt, closeAt);
    const badge = statusBadgeForKey(status.key);

    let title = "";
    if (status.key === "soon" && openAt) title = `Ouverture le ${formatDate(openAt)}`;
    if (status.key === "closed" && closeAt) title = `Fermeture le ${formatDate(closeAt)}`;

    return { badge, title };
  }, [format, now]);

  if (full) {
    return (
      <span
        className={[
          "rounded-full px-2.5 py-1 text-[11px] font-medium bg-rose-100 text-rose-700",
          className,
        ].join(" ")}
      >
        Complet
      </span>
    );
  }

  if (!computed.badge) return null;

  const text = prefix ? `${prefix} ${computed.badge.text}` : computed.badge.text;

  return (
    <span
      className={[
        "rounded-full px-2.5 py-1 text-[11px] font-medium",
        computed.badge.cls,
        className,
      ].join(" ")}
      title={computed.title || undefined}
    >
      {text}
    </span>
  );
}

/**
 * Badge places (nb_inscrits / nb_max_coureurs)
 */
export function InscriptionPlacesBadge({
  format,
  label = "Places",
  className = "",
  style = "overlay", // "overlay" | "soft"
}) {
  const txt = placesText(format);
  if (!txt) return null;

  const base =
    style === "overlay"
      ? "bg-white/90 ring-1 ring-black/5 text-neutral-800"
      : "bg-neutral-100 text-neutral-800";

  return (
    <span
      className={[
        "rounded-full px-2.5 py-1 text-[11px] font-semibold",
        base,
        className,
      ].join(" ")}
    >
      {label} {txt}
    </span>
  );
}
