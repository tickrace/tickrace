// src/pages/Courses.jsx
import React, { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../supabase";
import "leaflet/dist/leaflet.css";

// Lazy load de la carte (optimisation)
const MapView = React.lazy(() => import("../components/CoursesMap"));

/* ----------------------------- Utils ----------------------------- */
const todayISO = () => new Date().toISOString().slice(0, 10);

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

const clampInt = (n, min, max) => Math.max(min, Math.min(max, n));

function useDebouncedValue(value, delayMs = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function safeLocalStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeLocalStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

/* ----------------------- Buckets filtres ------------------------- */
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

const PAGE_SIZES = [6, 12, 18, 24];
const SORTS = new Set(["date", "price", "dplus"]);
const VIEWS = new Set(["list", "map"]);

/* ============================= Page ============================== */
export default function Courses() {
  const [searchParams, setSearchParams] = useSearchParams();

  // --- Init depuis l’URL (+ fallback localStorage)
  const initial = useMemo(() => {
    const q = searchParams.get("q") ?? "";
    const viewFromUrl = searchParams.get("view");
    const viewFromLs = safeLocalStorageGet("tickrace:courses:view");
    const view =
      (viewFromUrl && VIEWS.has(viewFromUrl) && viewFromUrl) ||
      (viewFromLs && VIEWS.has(viewFromLs) && viewFromLs) ||
      "list";

    const dep = searchParams.get("dep") ?? "all";
    const type = searchParams.get("type") ?? "all";
    const from = searchParams.get("from") ?? todayISO();
    const to = searchParams.get("to") ?? "";
    const dist = searchParams.get("dist") ?? "all";
    const dplus = searchParams.get("dplus") ?? "all";
    const sort = searchParams.get("sort") ?? "date";

    const page = Number(searchParams.get("page") ?? 1);
    const size = Number(searchParams.get("size") ?? 12);

    return {
      q,
      view: VIEWS.has(view) ? view : "list",
      dep,
      type,
      from,
      to,
      dist: DIST_BUCKETS.some((b) => b.key === dist) ? dist : "all",
      dplus: DPLUS_BUCKETS.some((b) => b.key === dplus) ? dplus : "all",
      sort: SORTS.has(sort) ? sort : "date",
      page: Number.isFinite(page) ? clampInt(page, 1, 999) : 1,
      size: PAGE_SIZES.includes(size) ? size : 12,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- UI state
  const [viewMode, setViewMode] = useState(initial.view);
  const [search, setSearch] = useState(initial.q);
  const [departement, setDepartement] = useState(initial.dep);
  const [type, setType] = useState(initial.type);
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [distKey, setDistKey] = useState(initial.dist);
  const [dplusKey, setDplusKey] = useState(initial.dplus);
  const [sortBy, setSortBy] = useState(initial.sort);
  const [page, setPage] = useState(initial.page);
  const [pageSize, setPageSize] = useState(initial.size);

  // --- Data state
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [courses, setCourses] = useState([]); // courses + formats (nested)
  const [countsByFormat, setCountsByFormat] = useState(null); // null = inconnu (RLS), {} = connu

  const searchDebounced = useDebouncedValue(search, 350);

  // --- Persistance viewMode
  useEffect(() => {
    safeLocalStorageSet("tickrace:courses:view", viewMode);
  }, [viewMode]);

  // --- Sync URL (partageable + persistant)
  const didSyncUrl = useRef(false);
  useEffect(() => {
    // on évite une première écriture agressive si jamais
    if (!didSyncUrl.current) didSyncUrl.current = true;

    const sp = new URLSearchParams();

    if (search.trim()) sp.set("q", search.trim());
    sp.set("view", viewMode);

    if (departement !== "all") sp.set("dep", departement);
    if (type !== "all") sp.set("type", type);

    if (dateFrom) sp.set("from", dateFrom);
    if (dateTo) sp.set("to", dateTo);

    if (distKey !== "all") sp.set("dist", distKey);
    if (dplusKey !== "all") sp.set("dplus", dplusKey);

    if (sortBy !== "date") sp.set("sort", sortBy);

    if (page !== 1) sp.set("page", String(page));
    if (pageSize !== 12) sp.set("size", String(pageSize));

    setSearchParams(sp, { replace: true });
  }, [
    search,
    viewMode,
    departement,
    type,
    dateFrom,
    dateTo,
    distKey,
    dplusKey,
    sortBy,
    page,
    pageSize,
    setSearchParams,
  ]);

  // --- Reset page si filtres changent (hors pagination)
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departement, type, dateFrom, dateTo, distKey, dplusKey, sortBy, pageSize, viewMode]);

  // --- Fetch (courses publiées + formats)
  const fetchAll = async () => {
    setLoading(true);
    setErrorMsg("");

    try {
      let query = supabase
        .from("courses")
        .select(
          `
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
            course_id,
            nom,
            type_epreuve,
            date,
            prix,
            distance_km,
            denivele_dplus,
            nb_max_coureurs
          )
        `
        )
        .eq("en_ligne", true)
        .order("created_at", { ascending: false });

      if (searchDebounced && searchDebounced.trim().length > 0) {
        const term = searchDebounced.trim();
        query = query.or(`nom.ilike.%${term}%,lieu.ilike.%${term}%,departement.ilike.%${term}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Nettoyage + tri formats par date
      const normalized = (data || []).map((c) => {
        const f = Array.isArray(c.formats) ? c.formats : [];
        const sortedFormats = [...f].sort((a, b) => {
          const ta = parseDate(a.date)?.getTime() ?? Infinity;
          const tb = parseDate(b.date)?.getTime() ?? Infinity;
          return ta - tb;
        });
        return { ...c, formats: sortedFormats };
      });

      setCourses(normalized);

      // Tentative : lecture inscriptions pour badge "Complet" (peut être bloquée par RLS)
      const allFormatIds = normalized.flatMap((c) => (c.formats || []).map((f) => f.id));
      if (!allFormatIds.length) {
        setCountsByFormat({});
        setLoading(false);
        return;
      }

      try {
        const { data: insc, error: insErr } = await supabase
          .from("inscriptions")
          .select("format_id")
          .in("format_id", allFormatIds);

        if (insErr) {
          // normal si RLS bloque en public
          setCountsByFormat(null);
        } else {
          const counts = {};
          (insc || []).forEach((i) => {
            counts[i.format_id] = (counts[i.format_id] || 0) + 1;
          });
          setCountsByFormat(counts);
        }
      } catch {
        setCountsByFormat(null);
      }

      setLoading(false);
    } catch (e) {
      console.error(e);
      setCourses([]);
      setCountsByFormat(null);
      setErrorMsg(e?.message || "Impossible de charger les courses.");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDebounced]);

  /* --------------------- Filtres dynamiques ---------------------- */
  const departements = useMemo(() => {
    return Array.from(new Set(courses.map((c) => c.departement).filter(Boolean))).sort();
  }, [courses]);

  const typesDisponibles = useMemo(() => {
    const all = [];
    courses.forEach((c) => {
      (c.formats || []).forEach((f) => {
        if (f.type_epreuve) all.push(f.type_epreuve);
      });
    });
    return Array.from(new Set(all)).sort();
  }, [courses]);

  /* ---------------------- ViewModel course ----------------------- */
  const resume = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.toDateString());

    return courses.map((c) => {
      const fList = c.formats || [];

      const upcoming = fList.filter((f) => {
        const d = parseDate(f.date);
        return d && d >= todayStart;
      });

      const next = (upcoming.length ? upcoming : fList)[0]?.date || null;

      const minPrix = fList.reduce((min, f) => {
        const p = Number(f.prix);
        return Number.isFinite(p) ? Math.min(min, p) : min;
      }, Infinity);
      const minPrixVal = minPrix === Infinity ? null : minPrix;

      const dists = fList.map((f) => Number(f.distance_km)).filter((n) => Number.isFinite(n));
      const dplus = fList.map((f) => Number(f.denivele_dplus)).filter((n) => Number.isFinite(n));

      const minDist = dists.length ? Math.min(...dists) : null;
      const maxDist = dists.length ? Math.max(...dists) : null;

      const minDplus = dplus.length ? Math.min(...dplus) : null;
      const maxDplus = dplus.length ? Math.max(...dplus) : null;

      let isFull = false;
      if (countsByFormat !== null && fList.length) {
        isFull = fList.every((f) => {
          const max = Number(f.nb_max_coureurs);
          if (!max || Number.isNaN(max)) return false;
          const count = Number(countsByFormat?.[f.id] || 0);
          return count >= max;
        });
      }

      const createdAt = parseDate(c.created_at);
      const isNew =
        createdAt ? (new Date().getTime() - createdAt.getTime()) / 86400000 < 14 : false;

      const hasMultipleFormats = fList.length > 1;

      return {
        ...c,
        formats: fList,
        next_date: next,
        min_prix: minPrixVal,
        min_dist: minDist,
        max_dist: maxDist,
        min_dplus: minDplus,
        max_dplus: maxDplus,
        is_full: isFull,
        is_new: isNew,
        has_multiple_formats: hasMultipleFormats,
      };
    });
  }, [courses, countsByFormat]);

  /* --------------------- Application filtres --------------------- */
  const filtered = useMemo(() => {
    return resume
      .filter((c) => {
        if (departement !== "all" && c.departement !== departement) return false;

        if (type !== "all") {
          const hasType = (c.formats || []).some((f) => f.type_epreuve === type);
          if (!hasType) return false;
        }

        if (dateFrom || dateTo) {
          const nd = parseDate(c.next_date);
          if (!nd) return false;
          if (dateFrom && nd < new Date(dateFrom)) return false;
          if (dateTo && nd > new Date(dateTo)) return false;
        }

        if (distKey !== "all") {
          if (c.min_dist == null || c.max_dist == null) return false;
          const b = DIST_BUCKETS.find((x) => x.key === distKey);
          const overlaps =
            (c.min_dist ?? Infinity) <= (b.max ?? Infinity) &&
            (c.max_dist ?? -Infinity) >= (b.min ?? 0);
          if (!overlaps) return false;
        }

        if (dplusKey !== "all") {
          if (c.min_dplus == null || c.max_dplus == null) return false;
          const b = DPLUS_BUCKETS.find((x) => x.key === dplusKey);
          const overlaps =
            (c.min_dplus ?? Infinity) <= (b.max ?? Infinity) &&
            (c.max_dplus ?? -Infinity) >= (b.min ?? 0);
          if (!overlaps) return false;
        }

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
        const ta = parseDate(a.next_date)?.getTime() ?? Infinity;
        const tb = parseDate(b.next_date)?.getTime() ?? Infinity;
        return ta - tb;
      });
  }, [resume, departement, type, dateFrom, dateTo, distKey, dplusKey, sortBy]);

  /* -------------------------- Pagination -------------------------- */
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = clampInt(page, 1, totalPages);
  const pageSlice = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  /* ---------------------------- Actions --------------------------- */
  const toggleView = () => setViewMode((v) => (v === "list" ? "map" : "list"));

  const resetFilters = () => {
    setSearch("");
    setDepartement("all");
    setType("all");
    setDateFrom(todayISO());
    setDateTo("");
    setDistKey("all");
    setDplusKey("all");
    setSortBy("date");
    setPage(1);
    setPageSize(12);
  };

  /* ----------------------------- Render --------------------------- */
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Header */}
      <section className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-7xl px-4 py-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-neutral-900">
            Courses{" "}
            <span className="font-black">
              <span className="text-orange-600">Tick</span>Race
            </span>
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
                onClick={toggleView}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-white text-sm font-semibold hover:brightness-110"
                title={viewMode === "list" ? "Passer en vue carte" : "Passer en vue liste"}
              >
                {viewMode === "list" ? "🌍 Vue carte" : "📃 Vue liste"}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="mt-4 mx-auto max-w-2xl rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-left">
              <div className="text-sm font-semibold text-rose-800">Erreur de chargement</div>
              <div className="text-sm text-rose-700 mt-1">{errorMsg}</div>
              <button
                onClick={fetchAll}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 text-white text-sm font-semibold hover:brightness-110"
              >
                ↻ Réessayer
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Contenu */}
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Filtres (uniquement en vue liste) */}
        {viewMode === "list" && (
          <FiltersBar
            departements={departements}
            typesDisponibles={typesDisponibles}
            departement={departement}
            setDepartement={setDepartement}
            type={type}
            setType={setType}
            dateFrom={dateFrom}
            setDateFrom={setDateFrom}
            dateTo={dateTo}
            setDateTo={setDateTo}
            distKey={distKey}
            setDistKey={setDistKey}
            dplusKey={dplusKey}
            setDplusKey={setDplusKey}
            sortBy={sortBy}
            setSortBy={setSortBy}
            resetFilters={resetFilters}
          />
        )}

        {/* Résumé & page size */}
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
                {PAGE_SIZES.map((n) => (
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
          <Suspense fallback={<p className="text-sm text-neutral-600">Chargement de la carte…</p>}>
            <MapView
              courses={filtered.filter(
                (c) => Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng))
              )}
            />
          </Suspense>
        ) : loading ? (
          <SkeletonGrid />
        ) : total === 0 ? (
          <EmptyState onReset={resetFilters} />
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {pageSlice.map((c) => (
                <CourseCard key={c.id} course={c} />
              ))}
            </div>

            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
              />
            )}

            {countsByFormat === null && (
              <div className="mt-6 text-xs text-neutral-500">
                ⚠️ Le badge <strong>Complet</strong> peut être masqué (accès aux inscriptions restreint).
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ========================== Components =========================== */

function FiltersBar({
  departements,
  typesDisponibles,
  departement,
  setDepartement,
  type,
  setType,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  distKey,
  setDistKey,
  dplusKey,
  setDplusKey,
  sortBy,
  setSortBy,
  resetFilters,
}) {
  return (
    <div className="mb-6 rounded-2xl ring-1 ring-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        {/* Dates */}
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

        {/* Selects */}
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
  );
}

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

        {/* Badges */}
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {soon && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
              Bientôt
            </span>
          )}
          {course.has_multiple_formats && (
            <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-medium text-sky-700">
              Multi-formats
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
          <span>📍 {course.lieu} {course.departement ? `(${course.departement})` : ""}</span>
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

function Pagination({ currentPage, totalPages, onPrev, onNext }) {
  return (
    <div className="mt-8 flex items-center justify-center gap-2">
      <button
        onClick={onPrev}
        disabled={currentPage === 1}
        className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
      >
        ◀︎ Précédent
      </button>
      <span className="text-sm text-neutral-600">
        Page <strong>{currentPage}</strong> / {totalPages}
      </span>
      <button
        onClick={onNext}
        disabled={currentPage === totalPages}
        className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
      >
        Suivant ▶︎
      </button>
    </div>
  );
}

/* --------------------------- Skeletons --------------------------- */
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
            <div className="h-8 w-full bg-neutral-100 rounded mt-4" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* --------------------------- Empty state -------------------------- */
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
