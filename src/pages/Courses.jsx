// src/pages/Courses.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase";
import {
  CalendarDays,
  MapPin,
  Mountain,
  ArrowUpRight,
  Filter,
  Search,
  RotateCcw,
  UtensilsCrossed,
  Sparkles,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  BadgePercent,
} from "lucide-react";

/** Utils */
const todayISO = () => new Date().toISOString().slice(0, 10);
const parseDate = (d) => (d ? new Date(d) : null);
const isWithin = (date, minISO, maxISO) => {
  if (!date) return false;
  const t = typeof date === "string" ? new Date(date) : date;
  if (minISO && t < new Date(minISO)) return false;
  if (maxISO && t > new Date(maxISO)) return false;
  return true;
};
const formatDate = (d) =>
  d
    ? new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(
        typeof d === "string" ? new Date(d) : d
      )
    : "";

const DISTANCE_BUCKETS = [
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

const PAGE_SIZE_DEFAULT = 12;

/**
 * Cette page :
 * 1) Charge les courses publiées (en_ligne = true)
 * 2) Charge les formats liés (dates, prix, distances, D+, stocks repas…)
 * 3) Tente de charger les inscriptions (pour détecter "Complet"). Si accès refusé, on ignore proprement.
 * 4) Calcule les agrégats par course (next_date, min_prix, min/max distance, min/max D+, has_repas, is_full*)
 * 5) Applique filtres, tri, pagination
 */
export default function Courses() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]); // courses brutes
  const [formatsByCourse, setFormatsByCourse] = useState({}); // { course_id: [formats] }
  const [countsByFormat, setCountsByFormat] = useState(null); // null = inconnu (pas d'accès), {} = connu

  // Filtres
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState(todayISO());
  const [dateTo, setDateTo] = useState("");
  const [distKey, setDistKey] = useState("all");
  const [dplusKey, setDplusKey] = useState("all");
  const [onlyRepas, setOnlyRepas] = useState(false);

  // Tri & pagination
  const [sortBy, setSortBy] = useState("date"); // 'date' | 'price' | 'dplus'
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);

      // 1) Courses publiées
      let query = supabase
        .from("courses")
        .select("id, nom, lieu, departement, created_at, image_url, image_path", { count: "exact" })
        .eq("en_ligne", true)
        .order("created_at", { ascending: false });

      if (q && q.trim().length > 0) {
        const term = q.trim();
        query = query.or(
          `nom.ilike.%${term}%,lieu.ilike.%${term}%,departement.ilike.%${term}%`
        );
      }

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
          "id, course_id, date, prix, distance_km, denivele_dplus, nb_max_coureurs, stock_repas"
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
        // Tri local des formats par date croissante
        Object.keys(map).forEach((k) =>
          map[k].sort(
            (a, b) =>
              (parseDate(a.date)?.getTime() || Infinity) -
              (parseDate(b.date)?.getTime() || Infinity)
          )
        );
        setFormatsByCourse(map);
      }

      // 3) Inscriptions → counts (peut échouer si RLS)
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
  }, [q]);

  /** Helper image */
  const getImageUrl = (course) => {
    // Priorité image_url si déjà public
    if (course.image_url) return course.image_url;
    // Sinon, tenter storage public url depuis image_path (bucket 'courses')
    if (course.image_path) {
      try {
        const { data } = supabase.storage.from("courses").getPublicUrl(course.image_path);
        return data?.publicUrl || null;
      } catch {
        return null;
      }
    }
    return null;
  };

  /** Agrégation par course */
  const resume = useMemo(() => {
    const res = [];
    for (const c of courses) {
      const fList = formatsByCourse[c.id] || [];
      const now = new Date();
      const upcoming = fList.filter((f) => {
        const d = parseDate(f.date);
        return d && d >= new Date(now.toDateString()); // >= aujourd'hui
      });

      // next_date = date la + proche parmi formats à venir (sinon plus proche historique)
      const next = (upcoming.length ? upcoming : fList)[0]?.date || null;

      // prix mini
      const minPrix = fList.reduce(
        (min, f) =>
          typeof f.prix === "number" && !Number.isNaN(f.prix)
            ? Math.min(min, f.prix)
            : min,
        Infinity
      );
      const minPrixVal = minPrix === Infinity ? null : minPrix;

      // distance / D+ (min/max)
      const dists = fList.map((f) => Number(f.distance_km)).filter((n) => !Number.isNaN(n));
      const dplus = fList.map((f) => Number(f.denivele_dplus)).filter((n) => !Number.isNaN(n));
      const minDist = dists.length ? Math.min(...dists) : null;
      const maxDist = dists.length ? Math.max(...dists) : null;
      const minDplus = dplus.length ? Math.min(...dplus) : null;
      const maxDplus = dplus.length ? Math.max(...dplus) : null;

      // repas dispo ?
      const hasRepas = fList.some((f) => Number(f.stock_repas) > 0);

      // complet ?
      let isFull = false;
      if (countsByFormat !== null && fList.length) {
        isFull = fList.every((f) => {
          const max = Number(f.nb_max_coureurs);
          if (!max || Number.isNaN(max)) return false; // si pas de limite connue → pas "complet"
          const count = Number(countsByFormat?.[f.id] || 0);
          return count >= max;
        });
      }

      // nouveau ? (< 14j)
      const createdAt = parseDate(c.created_at);
      const isNew = createdAt ? (new Date().getTime() - createdAt.getTime()) / 86400000 < 14 : false;

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

  /** Filtres + tri */
  const filtered = useMemo(() => {
    return resume
      .filter((c) => {
        // Date range
        if (dateFrom || dateTo) {
          if (!isWithin(c.next_date, dateFrom || null, dateTo || null)) return false;
        }
        // Distance
        if (distKey !== "all" && (c.min_dist == null || c.max_dist == null)) return false;
        if (distKey !== "all") {
          const b = DISTANCE_BUCKETS.find((x) => x.key === distKey);
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
  }, [resume, dateFrom, dateTo, distKey, dplusKey, onlyRepas, sortBy]);

  /** Pagination */
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageSlice = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  /** Handlers */
  const resetFilters = () => {
    setQ("");
    setDateFrom(todayISO());
    setDateTo("");
    setDistKey("all");
    setDplusKey("all");
    setOnlyRepas(false);
    setSortBy("date");
    setPage(1);
  };

  useEffect(() => {
    setPage(1); // reset pagination quand on change des filtres majeurs
  }, [q, dateFrom, dateTo, distKey, dplusKey, onlyRepas, sortBy, pageSize]);

  /** UI */
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Épreuves à venir</h1>
          <p className="text-gray-600 mt-1">
            Découvrez les courses publiées. Filtrez par date, distance, D+, et plus.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BadgePercent className="w-5 h-5 text-amber-600" />
          <span className="text-sm text-gray-600">
            Astuce : triez par <strong>prix</strong> pour trouver les meilleures affaires.
          </span>
        </div>
      </div>

      {/* Bar filtres */}
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          {/* Ligne 1 : recherche + dates */}
          <div className="flex flex-1 flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher (nom, lieu, département)…"
                className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Du</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Au</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Ligne 2 : selects */}
          <div className="flex flex-1 flex-col md:flex-row gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={distKey}
                onChange={(e) => setDistKey(e.target.value)}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                {DISTANCE_BUCKETS.map((b) => (
                  <option key={b.key} value={b.key}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Mountain className="w-4 h-4 text-gray-400" />
              <select
                value={dplusKey}
                onChange={(e) => setDplusKey(e.target.value)}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                {DPLUS_BUCKETS.map((b) => (
                  <option key={b.key} value={b.key}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="inline-flex items-center gap-2 select-none">
              <input
                type="checkbox"
                checked={onlyRepas}
                onChange={(e) => setOnlyRepas(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 flex items-center gap-1">
                <UtensilsCrossed className="w-4 h-4" /> Repas disponibles
              </span>
            </label>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              title="Trier par"
            >
              <option value="date">Trier : prochaine date</option>
              <option value="price">Trier : prix mini</option>
              <option value="dplus">Trier : D+</option>
            </select>

            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              title="Réinitialiser"
            >
              <RotateCcw className="w-4 h-4" />
              Réinitialiser
            </button>
          </div>
        </div>
      </div>

      {/* Résumé & page size */}
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {loading ? "Chargement…" : `${total} épreuve${total > 1 ? "s" : ""} trouvée${total > 1 ? "s" : ""}`}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Par page</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded-xl border border-gray-200 px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
          >
            {[6, 12, 18, 24].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grille */}
      {loading ? (
        <SkeletonGrid />
      ) : pageSlice.length === 0 ? (
        <EmptyState onReset={resetFilters} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {pageSlice.map((c) => (
            <CourseCard key={c.id} course={c} getImageUrl={getImageUrl} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
            Précédent
          </button>
          <span className="text-sm text-gray-600">
            Page <strong>{currentPage}</strong> / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Suivant
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Note en bas si "Complet" indisponible */}
      {countsByFormat === null && (
        <div className="mt-6 flex items-center gap-2 text-xs text-gray-500">
          <AlertTriangle className="w-4 h-4" />
          Le statut <strong>Complet</strong> est masqué (accès aux inscriptions restreint).
        </div>
      )}
    </div>
  );
}

/** Card composant */
function CourseCard({ course, getImageUrl }) {
  const img = getImageUrl(course);
  const soon =
    course.next_date &&
    (parseDate(course.next_date).getTime() - new Date().getTime()) / 86400000 <= 14;

  return (
    <div className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
      {/* Image */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-gray-100">
        {img ? (
          // eslint-disable-next-line jsx-a11y/img-redundant-alt
          <img
            src={img}
            alt={`Image de ${course.nom}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-gray-400">
            <Mountain className="w-10 h-10" />
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
            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-medium text-blue-700 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Nouveau
            </span>
          )}
        </div>
      </div>

      {/* Infos */}
      <div className="p-4">
        <h3 className="line-clamp-1 text-lg font-semibold">{course.nom}</h3>

        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            {course.lieu} ({course.departement})
          </span>
          {course.next_date && (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="w-4 h-4" />
              {formatDate(course.next_date)}
            </span>
          )}
        </div>

        {/* Résumé formats */}
        <div className="mt-2 text-sm text-gray-700">
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
              À partir de <strong>{course.min_prix.toFixed(2)} €</strong>
            </div>
          )}
        </div>

        {/* CTAs */}
        <div className="mt-4 flex items-center justify-between">
          <Link
            to={`/courses/${course.id}`}
            className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-white text-sm font-semibold hover:bg-black"
            title="Voir l'épreuve"
          >
            Voir l’épreuve <ArrowUpRight className="w-4 h-4" />
          </Link>

          <Link
            to={`/inscription/${course.id}`}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
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
          className="animate-pulse overflow-hidden rounded-2xl border border-gray-200 bg-white"
        >
          <div className="h-40 w-full bg-gray-100" />
          <div className="p-4 space-y-3">
            <div className="h-5 w-2/3 bg-gray-100 rounded" />
            <div className="h-4 w-1/3 bg-gray-100 rounded" />
            <div className="h-4 w-1/2 bg-gray-100 rounded" />
            <div className="h-8 w-1/2 bg-gray-100 rounded mt-4" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Empty state */
function EmptyState({ onReset }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center">
      <h3 className="text-lg font-semibold">Aucune épreuve trouvée</h3>
      <p className="mt-1 text-gray-600">
        Modifiez vos filtres, ou réinitialisez pour tout revoir.
      </p>
      <button
        onClick={onReset}
        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
      >
        <RotateCcw className="w-4 h-4" />
        Réinitialiser les filtres
      </button>
    </div>
  );
}
