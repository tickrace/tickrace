// src/pages/Courses.jsx
import React, { useEffect, useMemo, useState, Suspense } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase";
import "leaflet/dist/leaflet.css";

// Lazy load de la carte (optimisation)
const MapView = React.lazy(() => import("../components/CoursesMap"));

/** Utils simples */
const todayISO = () => new Date().toISOString().slice(0, 10);
const parseDate = (d) => (d ? new Date(d) : null);
const formatDate = (d) =>
  d
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(typeof d === "string" ? new Date(d) : d)
    : "";

const DIST_BUCKETS = [
  { key: "all", label: "Distance (toutes)" },
  { key: "0-15", label: "0–15 km", min: 0, max: 15 },
  { key: "15-30", label: "15–30 km", min: 15, max: 30 },
  { key: "30+", label: "30+ km", min: 30, max: Infinity },
];

const DPLUS_BUCKETS = [
  { key: "all", label: "D+ (tous)" },
  { key: "0-1000", label: "0–1 000 m", min: 0, max: 1000 },
  { key: "1000-2000", label: "1 000–2 000 m", min: 1000, max: 2000 },
  { key: "2000+", label: "2 000+ m", min: 2000, max: Infinity },
];

export default function Courses() {
  const [loading, setLoading] = useState(true);

  // Données brutes
  const [courses, setCourses] = useState([]);
  const [formatsByCourse, setFormatsByCourse] = useState({});
  const [countsByFormat, setCountsByFormat] = useState(null); // null = inconnu (RLS), {} = connu

  // Filtres UI
  const [viewMode, setViewMode] = useState("list"); // "list" | "map"
  const [search, setSearch] = useState("");
  const [departement, setDepartement] = useState("all");
  const [type, setType] = useState("all");
  const [dateFrom, setDateFrom] = useState(todayISO());
  const [dateTo, setDateTo] = useState("");
  const [distKey, setDistKey] = useState("all");
  const [dplusKey, setDplusKey] = useState("all");
  const [onlyRepas, setOnlyRepas] = useState(false);

  // Tri & pagination
  const [sortBy, setSortBy] = useState("date"); // 'date' | 'price' | 'dplus'
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  /** Chargement initial */
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);

    // 1) Courses publiées (en_ligne = true)
let query = supabase
  .from("courses")
  .select(`
    id,
    nom,
    lieu,
    departement,
    created_at,
    image_url,
    lat,
    lng,
    formats (
      id,
      date,
      distance_km,
      denivele_dplus
    )
  `)
  .eq("en_ligne", true)
  .order("created_at", { ascending: false });

if (search && search.trim().length > 0) {
  const term = search.trim();
  query = query.or(
    `nom.ilike.%${term}%,lieu.ilike.%${term}%,departement.ilike.%${term}%`
  );
}

const { data, error } = await query;
if (error) throw error;

// (optionnel) trier les formats par date + calculer prochaine date
const decorated = (data || []).map((c) => {
  const fs = (c.formats || [])
    .filter((f) => !!f.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  return {
    ...c,
    formats: fs,
    nextDate: fs[0]?.date || null,
  };
});

// → pour la carte, on peut filtrer les coords invalides
const coursesForMap = decorated.filter(
  (c) => Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng))
);

// <CoursesMap courses={coursesForMap} />

      const { data: coursesData, error: coursesErr } = await query;
      if (coursesErr) {
        console.error(coursesErr);
        setCourses([]);
        setFormatsByCourse({});
        setCountsByFormat(null);
        setLoading(false);
        return;
      }

      setCourses(coursesData || []);
      const courseIds = (coursesData || []).map((c) => c.id);
      if (courseIds.length === 0) {
        setFormatsByCourse({});
        setCountsByFormat({});
        setLoading(false);
        return;
      }

      // 2) Formats (légers)
      const { data: fmts, error: fmtErr } = await supabase
        .from("formats")
        .select(
          "id, course_id, nom, type_epreuve, date, prix, distance_km, denivele_dplus, nb_max_coureurs, stock_repas"
        )
        .in("course_id", courseIds);

      if (fmtErr) {
        console.error(fmtErr);
        setFormatsByCourse({});
      } else {
        const map = {};
        (fmts || []).forEach((f) => {
          (map[f.course_id] = map[f.course_id] || []).push(f);
        });
        Object.keys(map).forEach((k) =>
          map[k].sort(
            (a, b) =>
              (parseDate(a.date)?.getTime() || Infinity) -
              (parseDate(b.date)?.getTime() || Infinity)
          )
        );
        setFormatsByCourse(map);
      }

      // 3) Inscriptions → comptage par format (peut être bloqué par RLS en public)
      try {
        const allFormatIds = (fmts || []).map((f) => f.id);
        let fmtCounts = {};
        if (allFormatIds.length) {
          const { data: insc, error: insErr } = await supabase
            .from("inscriptions")
            .select("format_id")
            .in("format_id", allFormatIds);

          if (insErr) {
            console.warn("Lecture inscriptions refusée (ok):", insErr.message);
            setCountsByFormat(null); // badge "Complet" désactivé
          } else {
            (insc || []).forEach((i) => {
              fmtCounts[i.format_id] = (fmtCounts[i.format_id] || 0) + 1;
            });
            setCountsByFormat(fmtCounts);
          }
        } else {
          setCountsByFormat({});
        }
      } catch (e) {
        console.warn("Lecture inscriptions: exception (ok)", e);
        setCountsByFormat(null);
      }

      setLoading(false);
    };

    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  /** Dépendances dynamiques du UI -> reset page quand ça bouge */
  useEffect(() => {
    setPage(1);
  }, [departement, type, dateFrom, dateTo, distKey, dplusKey, onlyRepas, sortBy, pageSize, viewMode]);

  /** Listes de filtres dynamiques */
  const departements = useMemo(
    () => Array.from(new Set(courses.map((c) => c.departement).filter(Boolean))).sort(),
    [courses]
  );
  const typesDisponibles = useMemo(() => {
    const all = [];
    Object.values(formatsByCourse).forEach((arr) =>
      arr.forEach((f) => {
        if (f.type_epreuve) all.push(f.type_epreuve);
      })
    );
    return Array.from(new Set(all)).sort();
  }, [formatsByCourse]);

  /** Agrégation par course */
  const resume = useMemo(() => {
    const res = [];
    for (const c of courses) {
      const fList = formatsByCourse[c.id] || [];
      const now = new Date();
      const upcoming = fList.filter((f) => {
        const d = parseDate(f.date);
        return d && d >= new Date(now.toDateString());
      });

      // Prochaine date
      const next = (upcoming.length ? upcoming : fList)[0]?.date || null;

      // Prix mini
      const minPrix = fList.reduce((min, f) => {
        const p = Number(f.prix);
        return Number.isFinite(p) ? Math.min(min, p) : min;
      }, Infinity);
      const minPrixVal = minPrix === Infinity ? null : minPrix;

      // Distance / D+ (min/max)
      const dists = fList.map((f) => Number(f.distance_km)).filter((n) => Number.isFinite(n));
      const dplus = fList.map((f) => Number(f.denivele_dplus)).filter((n) => Number.isFinite(n));
      const minDist = dists.length ? Math.min(...dists) : null;
      const maxDist = dists.length ? Math.max(...dists) : null;
      const minDplus = dplus.length ? Math.min(...dplus) : null;
      const maxDplus = dplus.length ? Math.max(...dplus) : null;

      // Repas dispo ?
      const hasRepas = fList.some((f) => Number(f.stock_repas) > 0);

      // Complet (si on connaît les counts)
      let isFull = false;
      if (countsByFormat !== null && fList.length) {
        isFull = fList.every((f) => {
          const max = Number(f.nb_max_coureurs);
          if (!max || Number.isNaN(max)) return false;
          const count = Number(countsByFormat?.[f.id] || 0);
          return count >= max;
        });
      }

      // Nouveau ? (< 14 jours)
      const createdAt = parseDate(c.created_at);
      const isNew =
        createdAt ? (new Date().getTime() - createdAt.getTime()) / 86400000 < 14 : false;

      res.push({
        ...c,
        formats: fList,
        next_date: next,
        min_prix: minPrixVal,
        min_dist: minDist,
        max_dist: maxDist,
        min_dplus: minDplus,
        max_dplus: maxDplus,
        has_repas: hasRepas,
        is_full: isFull,
        is_new: isNew,
      });
    }
    return res;
  }, [courses, formatsByCourse, countsByFormat]);

  /** Application des filtres + tri */
  const filtered = useMemo(() => {
    return resume
      .filter((c) => {
        // Département
        if (departement !== "all" && c.departement !== departement) return false;

        // Type épreuve (si au moins un format match)
        if (type !== "all") {
          const hasType = (c.formats || []).some((f) => f.type_epreuve === type);
          if (!hasType) return false;
        }

        // Dates
        if (dateFrom || dateTo) {
          const nd = parseDate(c.next_date);
          if (!nd) return false;
          if (dateFrom && nd < new Date(dateFrom)) return false;
          if (dateTo && nd > new Date(dateTo)) return false;
        }

        // Distance
        if (distKey !== "all" && (c.min_dist == null || c.max_dist == null)) return false;
        if (distKey !== "all") {
          const b = DIST_BUCKETS.find((x) => x.key === distKey);
          const overlaps =
            (c.min_dist ?? Infinity) <= (b.max ?? Infinity) &&
            (c.max_dist ?? -Infinity) >= (b.min ?? 0);
          if (!overlaps) return false;
        }

        // D+
        if (dplusKey !== "all" && (c.min_dplus == null || c.max_dplus == null)) return false;
        if (dplusKey !== "all") {
          const b = DPLUS_BUCKETS.find((x) => x.key === dplusKey);
          const overlaps =
            (c.min_dplus ?? Infinity) <= (b.max ?? Infinity) &&
            (c.max_dplus ?? -Infinity) >= (b.min ?? 0);
          if (!overlaps) return false;
        }

        // Repas
        if (onlyRepas && !c.has_repas) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "price") {
          const pa = a.min_prix ?? Infinity;
          const pb = b.min_prix ?? Infinity;
          return pa - pb;
        }
        if (sortBy === "dplus") {
          const da = a.max_dplus ?? Infinity;
          const db = b.max_dplus ?? Infinity;
          return da - db;
        }
        // default: date
        const ta = parseDate(a.next_date)?.getTime() ?? Infinity;
        const tb = parseDate(b.next_date)?.getTime() ?? Infinity;
        return ta - tb;
      });
  }, [resume, departement, type, dateFrom, dateTo, distKey, dplusKey, onlyRepas, sortBy]);

  /** Pagination */
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageSlice = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  /** Resets */
  const resetFilters = () => {
    setSearch("");
    setDepartement("all");
    setType("all");
    setDateFrom(todayISO());
    setDateTo("");
    setDistKey("all");
    setDplusKey("all");
    setOnlyRepas(false);
    setSortBy("date");
    setPage(1);
  };

  /** UI */
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Header */}
      <section className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-7xl px-4 py-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-neutral-900">
            Courses <span className="font-black"><span className="text-orange-600">Tick</span>Race</span>
          </h1>
          <p className="mt-2 text-neutral-600 text-base">Inscrivez-vous. Courez. Partagez.</p>

          <div className="mt-4 max-w-2xl mx-auto">
            <div className="rounded-2xl ring-1 ring-neutral-200 bg-white p-2 flex flex-col md:flex-row gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher (nom, lieu, département)…"
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
              />
              <button
                onClick={() => setViewMode(viewMode === "list" ? "map" : "list")}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-white text-sm font-semibold hover:brightness-110"
                title={viewMode === "list" ? "Passer en vue carte" : "Passer en vue liste"}
              >
                {viewMode === "list" ? "🌍 Vue carte" : "📃 Vue liste"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Contenu */}
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Filtres (uniquement en vue liste) */}
        {viewMode === "list" && (
          <div className="mb-6 rounded-2xl ring-1 ring-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
              {/* Ligne 1 : dates */}
              <div className="flex flex-1 flex-col md:flex-row gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-neutral-500">Du</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-neutral-500">Au</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300"
                  />
                </div>
              </div>

              {/* Ligne 2 : selects & switches */}
              <div className="flex flex-1 flex-col md:flex-row gap-3">
                <select
                  value={departement}
                  onChange={(e) => setDepartement(e.target.value)}
                  className="rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300"
                >
                  <option value="all">Tous les départements</option>
                  {departements.map((dep) => (
                    <option key={dep} value={dep}>
                      {dep}
                    </option>
                  ))}
                </select>

                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300"
                >
                  <option value="all">Tous les types</option>
                  {typesDisponibles.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>

                <select
                  value={distKey}
                  onChange={(e) => setDistKey(e.target.value)}
                  className="rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300"
                >
                  {DIST_BUCKETS.map((b) => (
                    <option key={b.key} value={b.key}>
                      {b.label}
                    </option>
                  ))}
                </select>

                <select
                  value={dplusKey}
                  onChange={(e) => setDplusKey(e.target.value)}
                  className="rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300"
                >
                  {DPLUS_BUCKETS.map((b) => (
                    <option key={b.key} value={b.key}>
                      {b.label}
                    </option>
                  ))}
                </select>

                <label className="inline-flex items-center gap-2 select-none">
                  <input
                    type="checkbox"
                    checked={onlyRepas}
                    onChange={(e) => setOnlyRepas(e.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300 text-orange-600 focus:ring-orange-300"
                  />
                  <span className="text-sm text-neutral-700 flex items-center gap-1">
                    🍽️ Repas disponibles
                  </span>
                </label>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300"
                  title="Trier par"
                >
                  <option value="date">Prochaine date</option>
                  <option value="price">Prix mini</option>
                  <option value="dplus">D+ maximum</option>
                </select>

                <button
                  onClick={resetFilters}
                  className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm text-neutral-800 hover:bg-neutral-50"
                  title="Réinitialiser"
                >
                  ↺ Réinitialiser
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Résumé & page size (liste) */}
        {viewMode === "list" && (
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm text-neutral-600">
              {loading
                ? "Chargement…"
                : `${total} épreuve${total > 1 ? "s" : ""} trouvée${total > 1 ? "s" : ""}`}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-600">Par page</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-xl border border-neutral-200 px-2 py-1 text-sm focus:ring-2 focus:ring-orange-300"
              >
                {[6, 12, 18, 24].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Vue carte */}
        {viewMode === "map" ? (
          <Suspense fallback={<p>Chargement de la carte…</p>}>
            <MapView courses={filtered} />
          </Suspense>
        ) : loading ? (
          <SkeletonGrid />
        ) : total === 0 ? (
          <EmptyState onReset={resetFilters} />
        ) : (
          <>
            {/* Grille des cartes */}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {pageSlice.map((c) => (
                <CourseCard key={c.id} course={c} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
                >
                  ◀︎ Précédent
                </button>
                <span className="text-sm text-neutral-600">
                  Page <strong>{currentPage}</strong> / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
                >
                  Suivant ▶︎
                </button>
              </div>
            )}

            {/* Note si "Complet" indisponible */}
            {countsByFormat === null && (
              <div className="mt-6 text-xs text-neutral-500">
                ⚠️ Le badge <strong>Complet</strong> est masqué (accès aux inscriptions restreint).
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Carte épreuve */
function CourseCard({ course }) {
  const soon =
    course.next_date &&
    (parseDate(course.next_date).getTime() - new Date().getTime()) / 86400000 <= 14;

  return (
    <div className="group overflow-hidden rounded-2xl ring-1 ring-neutral-200 bg-white shadow-sm hover:shadow-md transition-shadow">
      {/* Image */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-neutral-100">
        {course.image_url ? (
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

        {/* Badges flottants */}
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {soon && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
              Bientôt
            </span>
          )}
          {course.has_repas && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-700">
              Repas
            </span>
          )}
          {course.is_full && (
            <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-medium text-rose-700">
              Complet
            </span>
          )}
          {course.is_new && (
            <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-medium text-orange-700">
              Nouveau
            </span>
          )}
        </div>
      </div>

      {/* Infos */}
      <div className="p-4">
        <h3 className="line-clamp-1 text-lg font-semibold">{course.nom}</h3>

        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-600">
          <span>📍 {course.lieu} ({course.departement})</span>
          {course.next_date && <span>📅 {formatDate(course.next_date)}</span>}
        </div>

        <div className="mt-2 text-sm text-neutral-700 space-y-1">
          {course.min_dist != null && course.max_dist != null && (
            <div>
              Distance :{" "}
              <strong>
                {Math.round(course.min_dist)}–{Math.round(course.max_dist)} km
              </strong>
            </div>
          )}
          {course.min_dplus != null && course.max_dplus != null && (
            <div>
              D+ :{" "}
              <strong>
                {Math.round(course.min_dplus)}–{Math.round(course.max_dplus)} m
              </strong>
            </div>
          )}
          {course.min_prix != null && (
            <div>
              À partir de <strong>{Number(course.min_prix).toFixed(2)} €</strong>
            </div>
          )}
        </div>

        {/* CTAs */}
        <div className="mt-4 flex items-center justify-between">
          <Link
            to={`/courses/${course.id}`}
            className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 text-white text-sm font-semibold hover:brightness-110"
            title="Voir l'épreuve"
          >
            Voir l’épreuve ↗
          </Link>

          <Link
            to={`/inscription/${course.id}`}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            title="S'inscrire"
          >
            S’inscrire
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Skeletons */
function SkeletonGrid() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse overflow-hidden rounded-2xl ring-1 ring-neutral-200 bg-white"
        >
          <div className="h-40 w-full bg-neutral-100" />
          <div className="p-4 space-y-3">
            <div className="h-5 w-2/3 bg-neutral-100 rounded" />
            <div className="h-4 w-1/3 bg-neutral-100 rounded" />
            <div className="h-4 w-1/2 bg-neutral-100 rounded" />
            <div className="h-8 w-1/2 bg-neutral-100 rounded mt-4" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Empty state */
function EmptyState({ onReset }) {
  return (
    <div className="rounded-2xl ring-1 ring-neutral-200 bg-white p-10 text-center">
      <h3 className="text-lg font-semibold">Aucune épreuve trouvée</h3>
      <p className="mt-1 text-neutral-600">
        Modifiez vos filtres, ou réinitialisez pour tout revoir.
      </p>
      <button
        onClick={onReset}
        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
      >
        ↺ Réinitialiser les filtres
      </button>
    </div>
  );
}
