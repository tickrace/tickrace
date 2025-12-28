// src/pages/Courses.jsx
import React, { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../supabase";
import "leaflet/dist/leaflet.css";

import CourseCard from "../components/CourseCard";

// Lazy load de la carte (optimisation)
const MapView = React.lazy(() => import("../components/CoursesMap"));

/* ----------------------------- Utils ----------------------------- */
const todayISO = () => new Date().toISOString().slice(0, 10);

const parseDate = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
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

/* ------------------- Multi-sport (compat) ------------------- */
/**
 * Objectif :
 * - supporter les URLs home -> /courses?sport=trail&discipline=...
 * - garder compat avec anciennes URLs -> ?type=Trail (ou autres)
 * - supporter legacy formats.sport_global (label) et formats.type_epreuve
 */

const SPORT_LABELS = {
  trail: "Trail",
  running: "Course à pied",
  road: "Course à pied",
  hiking: "Randonnée",
  mtb: "VTT",
  gravel: "Gravel",
  cycling_road: "Cyclisme route",
  triathlon: "Triathlon",
  swimrun: "Swimrun",
  raid_multisport: "Raid multisport",
};

function normalizeSportCodeFromLabel(labelOrCode) {
  const v = (labelOrCode || "").trim();
  if (!v) return "";

  const lower = v.toLowerCase();

  // déjà un code
  if (
    [
      "trail",
      "running",
      "road",
      "hiking",
      "mtb",
      "gravel",
      "cycling_road",
      "triathlon",
      "swimrun",
      "raid_multisport",
    ].includes(lower)
  ) {
    return lower;
  }

  // labels / variantes
  if (lower === "trail") return "trail";
  if (lower === "course à pied" || lower === "course a pied" || lower === "route") return "running";
  if (lower === "randonnée" || lower === "randonnee" || lower === "rando") return "hiking";
  if (lower === "vtt") return "mtb";
  if (lower === "gravel") return "gravel";
  if (lower === "cyclisme route" || lower === "cyclisme" || lower === "route vélo" || lower === "route velo")
    return "cycling_road";
  if (lower === "triathlon") return "triathlon";
  if (lower === "swimrun") return "swimrun";
  if (lower === "raid multisport" || lower === "raid") return "raid_multisport";

  return "";
}

// ⚠️ Backward compat : si sport_global est vide (anciennes courses),
// on déduit un sport depuis type_epreuve.
function getFormatSportLabel(f) {
  const sg = (f?.sport_global || "").trim();
  if (sg) return sg;

  const te = (f?.type_epreuve || "").trim().toLowerCase();
  if (te === "trail") return "Trail";
  if (te === "route") return "Course à pied";
  if (te === "rando") return "Randonnée";
  if (te === "vtt") return "VTT";
  if (te === "gravel") return "Gravel";
  if (te === "triathlon") return "Triathlon";
  return "";
}

function getCourseSportCode(course) {
  const sc = (course?.sport_code || "").trim().toLowerCase();
  if (sc) return sc;

  // fallback sur formats
  const fList = Array.isArray(course?.formats) ? course.formats : [];
  for (const f of fList) {
    const label = getFormatSportLabel(f);
    const code = normalizeSportCodeFromLabel(label);
    if (code) return code;
  }
  return "";
}

function getCourseSportLabel(course) {
  const code = getCourseSportCode(course);
  if (code && SPORT_LABELS[code]) return SPORT_LABELS[code];

  // fallback si on ne sait pas map
  const fList = Array.isArray(course?.formats) ? course.formats : [];
  const label = getFormatSportLabel(fList?.[0]);
  return label || "";
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

  const initial = useMemo(() => {
    const q = searchParams.get("q") ?? "";

    const viewFromUrl = searchParams.get("view");
    const viewFromLs = safeLocalStorageGet("tickrace:courses:view");
    const view =
      (viewFromUrl && VIEWS.has(viewFromUrl) && viewFromUrl) ||
      (viewFromLs && VIEWS.has(viewFromLs) && viewFromLs) ||
      "list";

    const dep = searchParams.get("dep") ?? "all";

    // ✅ new home uses ?sport=... ; compat old URLs: ?type=...
    const sport = searchParams.get("sport") ?? searchParams.get("type") ?? "all";
    const discipline = searchParams.get("discipline") ?? "all";

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
      sport, // code ou label (normalisé plus bas)
      discipline,
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

  // UI state
  const [viewMode, setViewMode] = useState(initial.view);
  const [search, setSearch] = useState(initial.q);
  const [departement, setDepartement] = useState(initial.dep);

  // ✅ sport (valeur stockée = code si possible)
  const [sport, setSport] = useState(() => {
    if (initial.sport === "all") return "all";
    return normalizeSportCodeFromLabel(initial.sport) || initial.sport;
  });

  const [discipline, setDiscipline] = useState(initial.discipline);

  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [distKey, setDistKey] = useState(initial.dist);
  const [dplusKey, setDplusKey] = useState(initial.dplus);
  const [sortBy, setSortBy] = useState(initial.sort);
  const [page, setPage] = useState(initial.page);
  const [pageSize, setPageSize] = useState(initial.size);

  // Data state
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [courses, setCourses] = useState([]);

  const searchDebounced = useDebouncedValue(search, 350);

  useEffect(() => {
    safeLocalStorageSet("tickrace:courses:view", viewMode);
  }, [viewMode]);

  // Sync URL
  const didSyncUrl = useRef(false);
  useEffect(() => {
    if (!didSyncUrl.current) didSyncUrl.current = true;

    const sp = new URLSearchParams();
    if (search.trim()) sp.set("q", search.trim());
    sp.set("view", viewMode);

    if (departement !== "all") sp.set("dep", departement);

    // ✅ écrire sport (et garder type en miroir pour compat liens)
    if (sport !== "all") {
      sp.set("sport", sport);
      sp.set("type", sport);
    }

    if (discipline !== "all" && discipline) sp.set("discipline", discipline);

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
    sport,
    discipline,
    dateFrom,
    dateTo,
    distKey,
    dplusKey,
    sortBy,
    page,
    pageSize,
    setSearchParams,
  ]);

  // Reset page quand filtres changent
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departement, sport, discipline, dateFrom, dateTo, distKey, dplusKey, sortBy, pageSize, viewMode]);

  // Fetch courses + formats (avec nb_inscrits)
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
          sport_code,
          discipline_code,
          formats (
            id,
            course_id,
            nom,
            type_epreuve,
            sport_global,
            date,
            prix,
            distance_km,
            denivele_dplus,
            nb_max_coureurs,
            nb_inscrits,
            inscription_ouverture,
            inscription_fermeture,
            close_on_full
          )
        `
        )
        .eq("en_ligne", true)
        .order("created_at", { ascending: false });

      if (searchDebounced && searchDebounced.trim()) {
        const term = searchDebounced.trim();
        query = query.or(`nom.ilike.%${term}%,lieu.ilike.%${term}%,departement.ilike.%${term}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

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
      setLoading(false);
    } catch (e) {
      console.error(e);
      setCourses([]);
      setErrorMsg(e?.message || "Impossible de charger les courses.");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDebounced]);

  // Filtres dynamiques
  const departements = useMemo(() => {
    return Array.from(new Set(courses.map((c) => c.departement).filter(Boolean))).sort();
  }, [courses]);

  // ✅ Sports disponibles : valeur = sport_code (si possible)
  const sportsDisponibles = useMemo(() => {
    const acc = [];
    courses.forEach((c) => {
      const code = getCourseSportCode(c);
      const label = getCourseSportLabel(c);
      if (code) acc.push({ code, label: SPORT_LABELS[code] || label || code });
      else if (label) {
        const fallbackCode = normalizeSportCodeFromLabel(label);
        if (fallbackCode) acc.push({ code: fallbackCode, label: SPORT_LABELS[fallbackCode] || label });
      }
    });

    const map = new Map();
    for (const s of acc) {
      if (!map.has(s.code)) map.set(s.code, s.label);
    }

    return Array.from(map.entries())
      .map(([code, label]) => ({ code, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr"));
  }, [courses]);

  // ✅ Disciplines disponibles : dynamiques depuis courses.discipline_code
  const disciplinesDisponibles = useMemo(() => {
    const set = new Set();
    courses.forEach((c) => {
      const sc = getCourseSportCode(c);
      if (sport !== "all") {
        // sport sélectionné peut être un code OU un label legacy
        const wanted = normalizeSportCodeFromLabel(sport) || sport;
        if (sc && wanted && sc !== wanted) return;
        if (!sc && wanted) {
          // fallback si sc absent : on teste via formats
          const hasWanted = (c.formats || []).some((f) => {
            const code = normalizeSportCodeFromLabel(getFormatSportLabel(f));
            return code && code === wanted;
          });
          if (!hasWanted) return;
        }
      }

      const dc = (c?.discipline_code || "").trim();
      if (dc) set.add(dc);
    });

    return Array.from(set)
      .sort((a, b) => a.localeCompare(b, "fr"))
      .map((code) => ({ code, label: code })); // label = code (pas d'assumptions)
  }, [courses, sport]);

  // ViewModel course (minimal + clean)
  const resume = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.toDateString());

    return courses.map((c) => {
      const fList = c.formats || [];

      const upcoming = fList.filter((f) => {
        const d = parseDate(f.date);
        return d && d >= todayStart;
      });

      const nextFormat = (upcoming.length ? upcoming : fList)[0] || null;
      const next = nextFormat?.date || null;

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

      // course full = tous les formats full (close_on_full + max)
      let isFull = false;
      if (fList.length) {
        isFull = fList.every((f) => {
          const max = Number(f.nb_max_coureurs);
          if (!max || Number.isNaN(max)) return false;
          const count = Number(f.nb_inscrits || 0);
          const closeOnFull = f.close_on_full !== false;
          if (!closeOnFull) return false;
          return count >= max;
        });
      }

      const createdAt = parseDate(c.created_at);
      const isNew = createdAt ? (Date.now() - createdAt.getTime()) / 86400000 < 14 : false;

      return {
        ...c,
        formats: fList,
        next_format: nextFormat,
        next_date: next,
        min_prix: minPrixVal,
        min_dist: minDist,
        max_dist: maxDist,
        min_dplus: minDplus,
        max_dplus: maxDplus,
        is_full: isFull,
        is_new: isNew,
        has_multiple_formats: fList.length > 1,
      };
    });
  }, [courses]);

  // Filtres + tri
  const filtered = useMemo(() => {
    const wantedSportCode = sport === "all" ? "" : normalizeSportCodeFromLabel(sport) || sport;

    return resume
      .filter((c) => {
        if (departement !== "all" && c.departement !== departement) return false;

        // ✅ Filtre sport (supporte code ou label legacy)
        if (sport !== "all") {
          const courseCode = getCourseSportCode(c);
          if (courseCode) {
            if (courseCode !== wantedSportCode) return false;
          } else {
            // fallback via formats
            const hasSport = (c.formats || []).some((f) => {
              const code = normalizeSportCodeFromLabel(getFormatSportLabel(f));
              if (!code) return false;
              return code === wantedSportCode;
            });
            if (!hasSport) return false;
          }
        }

        // ✅ Filtre discipline (sur courses.discipline_code)
        if (discipline !== "all" && discipline) {
          const dc = (c?.discipline_code || "").trim();
          if (!dc || dc !== discipline) return false;
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
            (c.min_dist ?? Infinity) <= (b.max ?? Infinity) && (c.max_dist ?? -Infinity) >= (b.min ?? 0);
          if (!overlaps) return false;
        }

        if (dplusKey !== "all") {
          if (c.min_dplus == null || c.max_dplus == null) return false;
          const b = DPLUS_BUCKETS.find((x) => x.key === dplusKey);
          const overlaps =
            (c.min_dplus ?? Infinity) <= (b.max ?? Infinity) && (c.max_dplus ?? -Infinity) >= (b.min ?? 0);
          if (!overlaps) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "price") return (a.min_prix ?? Infinity) - (b.min_prix ?? Infinity);
        if (sortBy === "dplus") return (a.max_dplus ?? Infinity) - (b.max_dplus ?? Infinity);
        return (parseDate(a.next_date)?.getTime() ?? Infinity) - (parseDate(b.next_date)?.getTime() ?? Infinity);
      });
  }, [resume, departement, sport, discipline, dateFrom, dateTo, distKey, dplusKey, sortBy]);

  // Pagination
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = clampInt(page, 1, totalPages);
  const pageSlice = filtered.slice((currentPage - 1) * pageSize, pageSize * currentPage);

  const toggleView = () => setViewMode((v) => (v === "list" ? "map" : "list"));

  const resetFilters = () => {
    setSearch("");
    setDepartement("all");
    setSport("all");
    setDiscipline("all");
    setDateFrom(todayISO());
    setDateTo("");
    setDistKey("all");
    setDplusKey("all");
    setSortBy("date");
    setPage(1);
    setPageSize(12);
  };

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
          <p className="mt-2 text-neutral-600 text-base">Inscrivez-vous. Bougez. Partagez.</p>

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
            sportsDisponibles={sportsDisponibles}
            disciplinesDisponibles={disciplinesDisponibles}
            departement={departement}
            setDepartement={setDepartement}
            sport={sport}
            setSport={(v) => {
              setSport(v);
              setDiscipline("all"); // reset discipline quand sport change
            }}
            discipline={discipline}
            setDiscipline={setDiscipline}
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
              {loading ? "Chargement…" : `${total} épreuve${total > 1 ? "s" : ""} trouvée${total > 1 ? "s" : ""}`}
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
            <MapView courses={filtered.filter((c) => Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng)))} />
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
          </>
        )}
      </div>
    </div>
  );
}

/* ========================== Components =========================== */

function FiltersBar({
  departements,
  sportsDisponibles,
  disciplinesDisponibles,
  departement,
  setDepartement,
  sport,
  setSport,
  discipline,
  setDiscipline,
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

          {/* ✅ sport (valeur = code) */}
          <select
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            className="rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300"
          >
            <option value="all">Tous les sports</option>
            {sportsDisponibles.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}
              </option>
            ))}
          </select>

          {/* ✅ discipline (si dispo) */}
          <select
            value={discipline}
            onChange={(e) => setDiscipline(e.target.value)}
            className="rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300"
            disabled={disciplinesDisponibles.length === 0}
            title={disciplinesDisponibles.length === 0 ? "Aucune discipline disponible pour ce sport" : ""}
          >
            <option value="all">{disciplinesDisponibles.length ? "Toutes les disciplines" : "Disciplines (—)"}</option>
            {disciplinesDisponibles.map((d) => (
              <option key={d.code} value={d.code}>
                {d.label}
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
          >
            <option value="date">Prochaine date</option>
            <option value="price">Prix mini</option>
            <option value="dplus">D+ maximum</option>
          </select>

          <button
            onClick={resetFilters}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm text-neutral-800 hover:bg-neutral-50"
          >
            ↺ Réinitialiser
          </button>
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

function SkeletonGrid() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-2xl ring-1 ring-neutral-200 bg-white">
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

function EmptyState({ onReset }) {
  return (
    <div className="rounded-2xl ring-1 ring-neutral-200 bg-white p-10 text-center">
      <h3 className="text-lg font-semibold">Aucune épreuve trouvée</h3>
      <p className="mt-1 text-neutral-600">Modifiez vos filtres, ou réinitialisez pour tout revoir.</p>
      <button
        onClick={onReset}
        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
      >
        ↺ Réinitialiser les filtres
      </button>
    </div>
  );
}
