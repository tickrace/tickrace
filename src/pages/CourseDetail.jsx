// src/pages/CourseDetail.jsx
import React, { useEffect, useMemo, useState, Suspense, lazy } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";
import {
  CalendarDays,
  MapPin,
  Mountain,
  UtensilsCrossed,
  Share2,
  ExternalLink,
  ArrowRight,
  AlertCircle,
  Loader2,
} from "lucide-react";

const GPXViewer = lazy(() => import("../components/GPXViewer"));

const parseDate = (d) => (d ? new Date(d) : null);
const fmtDate = (d) =>
  d
    ? new Intl.DateTimeFormat("fr-FR", {
        weekday: "short",
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(typeof d === "string" ? new Date(d) : d)
    : "";

export default function CourseDetail() {
  const { id } = useParams();
  const { session } = useUser();

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);
  const [countsByFormat, setCountsByFormat] = useState(null); // null = inconnu (RLS), {} = connu
  const [error, setError] = useState(null);

  const [tab, setTab] = useState("aperçu"); // "aperçu" | "formats" | "parcours" | "infos"
  const [selectedFormatId, setSelectedFormatId] = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setError(null);

      // 1) Course — sélection "safe"
      const { data: c, error: e1 } = await supabase
        .from("courses")
        .select("id, nom, presentation, lieu, departement, image_url, en_ligne, organisateur_id, created_at")
        .eq("id", id)
        .maybeSingle();

      if (e1 || !c) {
        console.error("Erreur course:", e1);
        setError("Épreuve introuvable.");
        setLoading(false);
        return;
      }

      const isOwner = !!(session?.user?.id && c.organisateur_id === session.user.id);
      if (!c.en_ligne && !isOwner) {
        setCourse(c);
        setError("Cette épreuve est hors-ligne.");
        setLoading(false);
        return;
      }

      setCourse(c);

      // 2) Formats (toutes les colonnes que tu utilises déjà)
      const { data: fmts, error: e2 } = await supabase
        .from("formats")
        .select(
          "id, nom, type_epreuve, date, heure_depart, prix, distance_km, denivele_dplus, denivele_dmoins, adresse_depart, adresse_arrivee, dotation, presentation_parcours, image_url, gpx_url, nb_max_coureurs, stock_repas"
        )
        .eq("course_id", id)
        .order("date", { ascending: true });

      if (e2) {
        console.error(e2);
        setFormats([]);
      } else {
        setFormats(fmts || []);
        if (!selectedFormatId && (fmts || []).length) {
          setSelectedFormatId(fmts[0].id);
        }
      }

      // 3) Inscriptions → comptage (peut être bloqué par RLS)
      try {
        const fids = (fmts || []).map((f) => f.id);
        if (fids.length) {
          const { data: insc, error: e3 } = await supabase
            .from("inscriptions")
            .select("format_id")
            .in("format_id", fids);

          if (e3) {
            setCountsByFormat(null);
          } else {
            const counts = {};
            (insc || []).forEach((i) => {
              counts[i.format_id] = (counts[i.format_id] || 0) + 1;
            });
            setCountsByFormat(counts);
          }
        } else {
          setCountsByFormat({});
        }
      } catch {
        setCountsByFormat(null);
      }

      setLoading(false);
    };

    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, session?.user?.id]);

  // Agrégats généraux
  const aggregates = useMemo(() => {
    const fList = formats || [];
    const now = new Date();
    const upcoming = fList.filter((f) => {
      const d = parseDate(f.date);
      return d && d >= new Date(now.toDateString());
    });
    const next_date = (upcoming.length ? upcoming : fList)[0]?.date || null;

    const minPrix = fList.reduce((min, f) => {
      const p = Number(f.prix);
      return Number.isFinite(p) ? Math.min(min, p) : min;
    }, Infinity);
    const min_prix = minPrix === Infinity ? null : minPrix;

    const dists = fList.map((f) => Number(f.distance_km)).filter((n) => Number.isFinite(n));
    const dplus = fList.map((f) => Number(f.denivele_dplus)).filter((n) => Number.isFinite(n));
    const min_dist = dists.length ? Math.min(...dists) : null;
    const max_dist = dists.length ? Math.max(...dists) : null;
    const min_dplus = dplus.length ? Math.min(...dplus) : null;
    const max_dplus = dplus.length ? Math.max(...dplus) : null;

    const has_repas = fList.some((f) => Number(f.stock_repas) > 0);

    let is_full = false;
    if (countsByFormat !== null && fList.length) {
      is_full = fList.every((f) => {
        const max = Number(f.nb_max_coureurs);
        if (!max || Number.isNaN(max)) return false;
        const count = Number(countsByFormat?.[f.id] || 0);
        return count >= max;
      });
    }

    const is_new = course?.created_at
      ? (new Date().getTime() - new Date(course.created_at).getTime()) / 86400000 < 14
      : false;

    return { next_date, min_prix, min_dist, max_dist, min_dplus, max_dplus, has_repas, is_full, is_new };
  }, [formats, countsByFormat, course?.created_at]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 flex items-center gap-3 text-gray-600">
        <Loader2 className="w-5 h-5 animate-spin" />
        Chargement de l’épreuve…
      </div>
    );
  }

  if (!course) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
        <h1 className="text-xl font-semibold">Épreuve introuvable</h1>
        <p className="text-gray-600 mt-1">Vérifiez le lien ou revenez à la liste.</p>
        <Link to="/courses" className="inline-flex mt-4 items-center gap-2 rounded-xl border px-4 py-2">
          ← Retour aux épreuves
        </Link>
      </div>
    );
  }

  const shareUrl = `${window.location.origin}/courses/${course.id}`;
  const soon =
    aggregates.next_date &&
    (parseDate(aggregates.next_date).getTime() - new Date().getTime()) / 86400000 <= 14;

  const selectedFormat = formats.find((f) => f.id === selectedFormatId) || null;

  return (
    <div className="mx-auto max-w-7xl">
      {/* HERO */}
      <div className="relative h-[260px] sm:h-[360px] md:h-[420px] w-full overflow-hidden">
        {course.image_url ? (
          <img src={course.image_url} alt={`Image de ${course.nom}`} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gray-200 flex items-center justify-center text-gray-500">
            <Mountain className="w-10 h-10" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

        {/* Badges */}
        <div className="absolute left-4 top-4 flex gap-2 flex-wrap">
          {soon && <Badge text="Bientôt" color="emerald" />}
          {aggregates.has_repas && <Badge text="Repas" color="amber" />}
          {aggregates.is_full && <Badge text="Complet" color="rose" />}
          {aggregates.is_new && <Badge text="Nouveau" color="blue" />}
          {!course.en_ligne && <Badge text="Hors-ligne" color="gray" />}
        </div>

        {/* Titre & CTA */}
        <div className="absolute bottom-4 left-4 right-4">
          <div className="max-w-7xl mx-auto px-2 sm:px-4">
            <h1 className="text-white text-2xl sm:text-3xl md:text-4xl font-bold drop-shadow">
              {course.nom}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-white/90">
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {course.lieu} ({course.departement})
              </span>
              {aggregates.next_date && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="w-4 h-4" />
                  {fmtDate(aggregates.next_date)}
                </span>
              )}
              {aggregates.min_prix != null && (
                <span className="inline-flex items-center gap-1">
                  💶 À partir de <strong>{aggregates.min_prix.toFixed(2)} €</strong>
                </span>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link
                to={`/inscription/${course.id}`}
                className="inline-flex items-center gap-2 rounded-xl bg-white/95 px-4 py-2 text-gray-900 text-sm font-semibold hover:bg-white"
              >
                S’inscrire <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                    alert("Lien copié !");
                  } catch {}
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-3 py-2 text-white text-sm hover:bg-white/25"
                title="Copier le lien"
              >
                <Share2 className="w-4 h-4" />
                Partager
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENU */}
      <div className="px-4 sm:px-6 md:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Colonne principale */}
          <div className="lg:col-span-8">
            {/* Onglets */}
            <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b">
              <div className="flex gap-3 overflow-x-auto py-2">
                {[
                  { key: "aperçu", label: "Aperçu" },
                  { key: "formats", label: "Formats & tarifs" },
                  { key: "parcours", label: "Parcours" },
                  { key: "infos", label: "Infos pratiques" },
                ].map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={[
                      "rounded-full px-4 py-2 text-sm",
                      tab === t.key ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                    ].join(" ")}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* PANELS */}
            {tab === "aperçu" && (
              <section className="mt-6 space-y-4">
                {course.presentation ? (
                  <p className="text-gray-800 leading-relaxed whitespace-pre-line">
                    {course.presentation}
                  </p>
                ) : (
                  <p className="text-gray-500">La présentation de l’épreuve sera bientôt disponible.</p>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Fact title="Distance" value={formatRange(aggregates.min_dist, aggregates.max_dist, " km")} />
                  <Fact title="D+" value={formatRange(aggregates.min_dplus, aggregates.max_dplus, " m")} />
                  <Fact title="Prochaine date" value={aggregates.next_date ? fmtDate(aggregates.next_date) : "À venir"} />
                  <Fact title="Repas" value={aggregates.has_repas ? "Disponible" : "—"} Icon={UtensilsCrossed} />
                </div>
              </section>
            )}

            {tab === "formats" && (
              <section className="mt-6">
                {formats.length === 0 ? (
                  <EmptyBox text="Les formats seront publiés bientôt." />
                ) : (
                  <FormatsTable courseId={course.id} formats={formats} countsByFormat={countsByFormat} />
                )}
              </section>
            )}

            {tab === "parcours" && (
              <section className="mt-6 space-y-4">
                {formats.length === 0 ? (
                  <EmptyBox text="Les parcours seront publiés bientôt." />
                ) : (
                  <>
                    {/* Sélecteur de format pour afficher le GPX de ce format */}
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-sm text-gray-700">Choisir un format :</label>
                      <select
                        value={selectedFormatId || ""}
                        onChange={(e) => setSelectedFormatId(e.target.value)}
                        className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      >
                        {formats.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.nom} {f.date ? `— ${fmtDate(f.date)}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedFormat?.gpx_url ? (
                      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                        <Suspense fallback={<div className="p-4 text-gray-600">Chargement de la carte…</div>}>
                          <GPXViewer gpxUrl={selectedFormat.gpx_url} height={420} allowDownload responsive />
                        </Suspense>
                      </div>
                    ) : (
                      <EmptyBox text="Le GPX n’est pas disponible pour ce format." />
                    )}

                    {selectedFormat?.presentation_parcours && (
                      <p className="text-gray-700">{selectedFormat.presentation_parcours}</p>
                    )}
                  </>
                )}
              </section>
            )}

            {tab === "infos" && (
              <section className="mt-6 space-y-4">
                {formats.length === 0 ? (
                  <EmptyBox text="Infos à venir." />
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4">
                    <InfoCard
                      title="Départ"
                      lines={[
                        selectedFormat?.adresse_depart ||
                          formats[0]?.adresse_depart ||
                          "Non communiqué",
                      ]}
                    />
                    <InfoCard
                      title="Arrivée"
                      lines={[
                        selectedFormat?.adresse_arrivee ||
                          formats[0]?.adresse_arrivee ||
                          "Non communiqué",
                      ]}
                    />
                    <InfoCard
                      title="Dotation"
                      lines={[
                        selectedFormat?.dotation || formats[0]?.dotation || "Non communiqué",
                      ]}
                    />
                    <InfoCard
                      title="Type d’épreuve"
                      lines={[
                        selectedFormat?.type_epreuve ||
                          formats[0]?.type_epreuve ||
                          "Non communiqué",
                      ]}
                    />
                  </div>
                )}
              </section>
            )}
          </div>

          {/* Sidebar sticky */}
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-6 space-y-4">
              <div className="rounded-2xl border bg-white shadow-sm p-4">
                <h3 className="text-lg font-semibold">S’inscrire</h3>
                {formats.length === 0 ? (
                  <p className="text-sm text-gray-600 mt-2">Les formats seront publiés bientôt.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {formats.map((f) => {
                      const max = Number(f.nb_max_coureurs) || null;
                      const inscrit = Number(countsByFormat?.[f.id] || 0);
                      const remaining = max ? Math.max(0, max - inscrit) : null;
                      const full = max ? inscrit >= max : false;
                      return (
                        <div key={f.id} className="rounded-xl border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium">{f.nom}</div>
                              <div className="text-xs text-gray-600 mt-0.5 flex flex-wrap gap-2">
                                {f.date && (
                                  <span className="inline-flex items-center gap-1">
                                    <CalendarDays className="w-3 h-3" />
                                    {fmtDate(f.date)}
                                    {f.heure_depart ? ` • ${f.heure_depart}` : ""}
                                  </span>
                                )}
                                {Number.isFinite(Number(f.distance_km)) && <span>{Number(f.distance_km)} km</span>}
                                {Number.isFinite(Number(f.denivele_dplus)) && <span>{Number(f.denivele_dplus)} m D+</span>}
                              </div>
                              <div className="mt-1 text-sm text-gray-800">
                                {Number.isFinite(Number(f.prix)) ? (
                                  <>Prix : <strong>{Number(f.prix).toFixed(2)} €</strong></>
                                ) : (
                                  <>Prix : —</>
                                )}
                              </div>
                              {max && (
                                <div className="mt-1 text-xs text-gray-600">
                                  Places : {inscrit} / {max}{" "}
                                  {remaining !== null && remaining <= 10 && !full && (
                                    <span className="ml-1 text-amber-700 font-medium">({remaining} restantes)</span>
                                  )}
                                </div>
                              )}
                            </div>

                            {full ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-[11px] font-medium text-rose-800">
                                Complet
                              </span>
                            ) : (
                              <Link
                                to={`/inscription/${course.id}?format=${f.id}`}
                                className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-white text-sm font-semibold hover:bg-black"
                              >
                                S’inscrire <ArrowRight className="w-4 h-4" />
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Faits rapides */}
              <div className="rounded-2xl border bg-white shadow-sm p-4">
                <h3 className="text-lg font-semibold">Faits rapides</h3>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Fact title="Distance" value={formatRange(aggregates.min_dist, aggregates.max_dist, " km")} />
                  <Fact title="D+" value={formatRange(aggregates.min_dplus, aggregates.max_dplus, " m")} />
                  <Fact title="Prochaine date" value={aggregates.next_date ? fmtDate(aggregates.next_date) : "—"} />
                  <Fact title="Repas" value={aggregates.has_repas ? "Disponible" : "—"} Icon={UtensilsCrossed} />
                </div>
              </div>

              {/* Partage */}
              <div className="rounded-2xl border bg-white shadow-sm p-4">
                <h3 className="text-lg font-semibold">Partager</h3>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(shareUrl);
                        alert("Lien copié !");
                      } catch {}
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    <Share2 className="w-4 h-4" />
                    Copier le lien
                  </button>
                  <div className="ml-auto">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                        shareUrl
                      )}`}
                      alt="QR de partage"
                      className="rounded-md border"
                      width={120}
                      height={120}
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>

              {/* Alerte hors-ligne pour l'organisateur */}
              {!course.en_ligne && course.organisateur_id === session?.user?.id && (
                <div className="rounded-2xl border bg-yellow-50 text-yellow-900 shadow-sm p-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Cette épreuve est en **brouillon** (hors-ligne).
                  </div>
                  <Link
                    to={`/modifier-course/${course.id}`}
                    className="inline-flex items-center gap-2 mt-3 rounded-xl bg-yellow-600 px-3 py-2 text-white text-sm font-semibold hover:bg-yellow-700"
                  >
                    Modifier l’épreuve
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Message d’erreur éventuel (ex: hors-ligne pour public) */}
        {error && (
          <div className="mt-8 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== Sous-composants ===== */

function Badge({ text, color = "gray" }) {
  const bg = {
    emerald: "bg-emerald-100/90 text-emerald-800",
    amber: "bg-amber-100/90 text-amber-800",
    rose: "bg-rose-100/90 text-rose-800",
    blue: "bg-blue-100/90 text-blue-800",
    gray: "bg-gray-200/90 text-gray-800",
  }[color];
  return <span className={`rounded-full px-3 py-1 text-[12px] font-medium ${bg}`}>{text}</span>;
}

function Fact({ title, value, Icon }) {
  return (
    <div className="rounded-xl border bg-white p-3 text-center">
      {Icon ? <Icon className="w-4 h-4 mx-auto text-gray-700" /> : null}
      <div className="text-[11px] text-gray-500 mt-1">{title}</div>
      <div className="text-sm font-semibold text-gray-900">{value || "—"}</div>
    </div>
  );
}

function formatRange(min, max, unit = "") {
  if (min == null && max == null) return "—";
  if (min != null && max != null) {
    if (min === max) return `${Math.round(min)}${unit}`;
    return `${Math.round(min)}–${Math.round(max)}${unit}`;
  }
  if (min != null) return `≥ ${Math.round(min)}${unit}`;
  return `≤ ${Math.round(max)}${unit}`;
}

function EmptyBox({ text }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-600">
      {text}
    </div>
  );
}

function FormatsTable({ courseId, formats, countsByFormat }) {
  if (!formats?.length) return null;
  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th className="text-left px-4 py-3">Format</th>
            <th className="text-left px-4 py-3">Date</th>
            <th className="text-left px-4 py-3">Distance</th>
            <th className="text-left px-4 py-3">D+ / D-</th>
            <th className="text-left px-4 py-3">Places</th>
            <th className="text-left px-4 py-3">Prix</th>
            <th className="text-right px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {formats.map((f, idx) => {
            const max = Number(f.nb_max_coureurs) || null;
            const inscrit = Number(countsByFormat?.[f.id] || 0);
            const remaining = max ? Math.max(0, max - inscrit) : null;
            const full = max ? inscrit >= max : false;
            return (
              <tr key={f.id} className={idx % 2 ? "bg-white" : "bg-gray-50/50"}>
                <td className="px-4 py-3 font-medium text-gray-900">{f.nom}</td>
                <td className="px-4 py-3 text-gray-700">
                  {f.date ? fmtDate(f.date) : "—"}{f.heure_depart ? ` • ${f.heure_depart}` : ""}
                </td>
                <td className="px-4 py-3 text-gray-700">{numOrDash(f.distance_km)} km</td>
                <td className="px-4 py-3 text-gray-700">
                  {numOrDash(f.denivele_dplus)} / {numOrDash(f.denivele_dmoins)} m
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {max ? (
                    <>
                      {inscrit} / {max}{" "}
                      {remaining !== null && remaining <= 10 && !full && (
                        <span className="ml-1 text-amber-700 font-medium">({remaining} restantes)</span>
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-gray-900">
                  {Number.isFinite(Number(f.prix)) ? `${Number(f.prix).toFixed(2)} €` : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  {full ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-[11px] font-medium text-rose-800">
                      Complet
                    </span>
                  ) : (
                    <Link
                      to={`/inscription/${courseId}?format=${f.id}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-white text-sm font-semibold hover:bg-black"
                    >
                      S’inscrire <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function numOrDash(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : "—";
}
