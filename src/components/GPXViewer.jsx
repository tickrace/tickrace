// src/components/GPXViewer.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* ---------- Icônes départ/arrivée/curseur ---------- */
const startIcon = new L.DivIcon({
  className: "gpx-start-marker",
  html: '<div style="background:#10b981;border:2px solid #fff;width:12px;height:12px;border-radius:9999px;box-shadow:0 0 0 2px #10b98155"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});
const finishIcon = new L.DivIcon({
  className: "gpx-finish-marker",
  html: '<div style="background:#ef4444;border:2px solid #fff;width:12px;height:12px;border-radius:2px;transform:rotate(45deg);box-shadow:0 0 0 2px #ef444455"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});
const cursorIcon = new L.DivIcon({
  className: "gpx-cursor-marker",
  html: '<div style="background:#2563eb;border:2px solid #fff;width:10px;height:10px;border-radius:9999px;box-shadow:0 0 0 2px #2563eb33"></div>',
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

/* ---------- Utils ---------- */
const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const dφ = ((lat2 - lat1) * Math.PI) / 180;
  const dλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};
const metersToKm = (m) => m / 1000;
const fmtKm = (km) => `${km.toFixed(km >= 100 ? 0 : 1)} km`;
const fmtM = (m) => `${Math.round(m)} m`;
const clampDelta = (d) => {
  if (!isFinite(d)) return 0;
  // filtre le bruit < 0.5 m entre points
  if (Math.abs(d) < 0.5) return 0;
  return d;
};

/* ---------- Composant ---------- */
export default function GPXViewer({
  gpxUrl,
  height = 420,
  responsive = true,
  allowDownload = false,
  allowBaseMapChoice = true,
  allowFullscreen = true,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const mapEl = useRef(null);
  const trackLineRef = useRef(null);
  const cursorMarkerRef = useRef(null);
  const recenterControlRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Données du GPX
  const [points, setPoints] = useState([]); // [{lat, lon, ele?}]
  const [cumDist, setCumDist] = useState([]); // distances cumulées en m
  const [altitudes, setAltitudes] = useState([]); // altitudes (null si absente)

  // Hover chart
  const [hoverX, setHoverX] = useState(null); // coord x (px) dans le chart
  const [hoverIdx, setHoverIdx] = useState(null); // index du point le plus proche

  // Plein écran
  const [isFullscreen, setIsFullscreen] = useState(false);

  /* ----- Fetch + parse GPX ----- */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!gpxUrl) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(gpxUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (cancelled) return;
        const xml = new DOMParser().parseFromString(text, "application/xml");
        const trkpts = Array.from(xml.querySelectorAll("trkpt"));
        const pts = trkpts
          .map((n) => ({
            lat: parseFloat(n.getAttribute("lat")),
            lon: parseFloat(n.getAttribute("lon")),
            ele: n.querySelector("ele")
              ? parseFloat(n.querySelector("ele").textContent)
              : null,
          }))
          .filter(
            (p) => Number.isFinite(p.lat) && Number.isFinite(p.lon)
          );

        if (pts.length < 2) throw new Error("Trace GPX insuffisante");

        // distances cumulées
        let dist = 0;
        const dists = [0];
        for (let i = 1; i < pts.length; i++) {
          dist += haversine(
            pts[i - 1].lat,
            pts[i - 1].lon,
            pts[i].lat,
            pts[i].lon
          );
          dists.push(dist);
        }

        // altitudes
        const eles = pts.map((p) => (Number.isFinite(p.ele) ? p.ele : null));

        if (!cancelled) {
          setPoints(pts);
          setCumDist(dists);
          setAltitudes(eles);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "Impossible de charger le GPX");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [gpxUrl]);

  /* ----- Stats ----- */
  const stats = useMemo(() => {
    if (!points.length) return null;
    let dplus = 0,
      dminus = 0,
      amin = Infinity,
      amax = -Infinity;
    for (let i = 1; i < points.length; i++) {
      const a1 = altitudes[i - 1];
      const a2 = altitudes[i];
      if (a1 != null && a2 != null) {
        const delta = clampDelta(a2 - a1);
        if (delta > 0) dplus += delta;
        else dminus += Math.abs(delta);
        amin = Math.min(amin, a1, a2);
        amax = Math.max(amax, a1, a2);
      }
    }
    if (amin === Infinity) {
      amin = null;
      amax = null;
    }
    const dist = cumDist[cumDist.length - 1] || 0;
    return { dist, dplus, dminus, amin, amax };
  }, [points, altitudes, cumDist]);

  /* ----- Initialisation Leaflet ----- */
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, {
      zoomControl: false,
      attributionControl: true,
    });
    mapRef.current = map;

    const osmLight = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      { maxZoom: 19, attribution: "&copy; OpenStreetMap" }
    ).addTo(map);
    const osmBw = L.tileLayer(
      "https://{s}.basemaptile.openstreetmap.de/black_white/{z}/{x}/{y}.png",
      { maxZoom: 18, attribution: "&copy; OpenStreetMap" }
    );
    const esriSat = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, attribution: "&copy; Esri" }
    );

    if (allowBaseMapChoice) {
      L.control
        .layers(
          { "OSM Clair": osmLight, "OSM N&B": osmBw, Satellite: esriSat },
          {},
          { position: "topright" }
        )
        .addTo(map);
    }

    L.control.zoom({ position: "topright" }).addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowBaseMapChoice]);

  /* ----- Affichage trace sur carte ----- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || points.length < 2) return;

    // Nettoie anciens overlays (polyline + markers) uniquement
    if (trackLineRef.current) {
      try {
        map.removeLayer(trackLineRef.current);
      } catch {}
      trackLineRef.current = null;
    }
    if (cursorMarkerRef.current) {
      try {
        map.removeLayer(cursorMarkerRef.current);
      } catch {}
      cursorMarkerRef.current = null;
    }
    // Retire anciens markers start/finish
    const nonTiles = [];
    map.eachLayer((l) => {
      if (!(l instanceof L.TileLayer)) nonTiles.push(l);
    });
    nonTiles.forEach((l) => map.removeLayer(l));

    const latlngs = points.map((p) => [p.lat, p.lon]);
    const line = L.polyline(latlngs, {
      color: "#111827",
      weight: 4,
      opacity: 0.9,
    }).addTo(map);
    trackLineRef.current = line;

    const start = latlngs[0];
    const end = latlngs[latlngs.length - 1];
    L.marker(start, { icon: startIcon }).addTo(map).bindTooltip("Départ");
    L.marker(end, { icon: finishIcon }).addTo(map).bindTooltip("Arrivée");

    map.fitBounds(line.getBounds(), { padding: [20, 20] });

    // Bouton recadrer
    const Custom = L.Control.extend({
      options: { position: "topright" },
      onAdd: function () {
        const btn = L.DomUtil.create("button", "leaflet-bar");
        btn.innerHTML = "↺";
        btn.title = "Recentrer la trace";
        btn.style.cursor = "pointer";
        btn.style.padding = "6px 10px";
        L.DomEvent.on(btn, "click", (e) => {
          L.DomEvent.stopPropagation(e);
          map.fitBounds(line.getBounds(), { padding: [20, 20] });
        });
        return btn;
      },
    });
    const recenter = new Custom();
    recenter.addTo(map);
    recenterControlRef.current = recenter;

    return () => {
      try {
        map.removeControl(recenter);
      } catch {}
    };
  }, [points]);

  /* ----- Synchronisation curseur carte depuis le chart ----- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || hoverIdx == null || !points[hoverIdx]) return;

    const p = points[hoverIdx];
    const latlng = L.latLng(p.lat, p.lon);
    if (!cursorMarkerRef.current) {
      cursorMarkerRef.current = L.marker(latlng, { icon: cursorIcon }).addTo(
        map
      );
    } else {
      cursorMarkerRef.current.setLatLng(latlng);
    }
  }, [hoverIdx, points]);

  /* ----- Fullscreen ----- */
  useEffect(() => {
    const onFsChange = () => {
      const fs =
        document.fullscreenElement &&
        document.fullscreenElement === containerRef.current;
      setIsFullscreen(!!fs);
      // Fix Leaflet sizing après transition
      setTimeout(() => mapRef.current && mapRef.current.invalidateSize(), 150);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!allowFullscreen || !containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  /* ---------- Chart interactif (SVG) ---------- */
  function ElevationChart({
    w = 820,
    h = 160,
    padding = { l: 46, r: 20, t: 10, b: 28 },
  }) {
    const hasEle = altitudes.some((a) => Number.isFinite(a));
    const total = cumDist[cumDist.length - 1] || 0;

    const minY = useMemo(() => {
      if (!hasEle) return 0;
      const v = Math.min(...altitudes.filter((a) => a != null));
      return Math.floor(v / 10) * 10; // arrondi
    }, [altitudes, hasEle]);
    const maxY = useMemo(() => {
      if (!hasEle) return 1;
      const v = Math.max(...altitudes.filter((a) => a != null));
      return Math.ceil(v / 10) * 10;
    }, [altitudes, hasEle]);

    const innerW = w - padding.l - padding.r;
    const innerH = h - padding.t - padding.b;

    const xScale = (x) =>
      padding.l + (innerW * x) / (total || 1);
    const yScale = (y) =>
      padding.t +
      innerH * (1 - (y - minY) / ((maxY - minY) || 1));

    // courbe & aplat
    const path = [];
    const area = [];
    for (let i = 0; i < altitudes.length; i++) {
      const x = xScale(cumDist[i]);
      const y = yScale(altitudes[i] == null ? minY : altitudes[i]);
      path.push(`${i === 0 ? "M" : "L"} ${x} ${y}`);
      area.push(`${i === 0 ? "M" : "L"} ${x} ${y}`);
    }
    if (area.length) {
      area.push(`L ${xScale(total)} ${yScale(minY)}`);
      area.push(`L ${xScale(0)} ${yScale(minY)}`);
      area.push("Z");
    }

    // graduations X (distance)
    const ticksX = [];
    const stepKm = total > 30000 ? 10 : total > 10000 ? 5 : total > 5000 ? 2 : 1;
    for (let km = 0; km <= metersToKm(total); km += stepKm) {
      ticksX.push(km);
    }

    // graduations Y (altitude)
    const ticksY = [];
    const stepY =
      maxY - minY > 1500 ? 500 : maxY - minY > 600 ? 200 : 100;
    for (let y = Math.ceil(minY / stepY) * stepY; y <= maxY; y += stepY) {
      ticksY.push(y);
    }

    // interaction
    const svgRef = useRef(null);
    const [bbox, setBbox] = useState(null);
    useEffect(() => {
      if (!svgRef.current) return;
      setBbox(svgRef.current.getBoundingClientRect());
      const obs = new ResizeObserver(() => {
        setBbox(svgRef.current.getBoundingClientRect());
      });
      obs.observe(svgRef.current);
      return () => obs.disconnect();
    }, []);

    const onMove = (e) => {
      if (!bbox) return;
      const xPx = e.clientX - bbox.left;
      setHoverX(Math.max(padding.l, Math.min(w - padding.r, xPx)));
      // calc index le plus proche
      const xDist = ((hoverX ?? xPx) - padding.l) / innerW * (total || 1);
      // recherche binaire approx
      let lo = 0,
        hi = cumDist.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cumDist[mid] < xDist) lo = mid + 1;
        else hi = mid;
      }
      // voisin le plus proche
      const i1 = Math.max(0, lo - 1);
      const i2 = lo;
      const idx =
        Math.abs(cumDist[i1] - xDist) < Math.abs(cumDist[i2] - xDist)
          ? i1
          : i2;
      setHoverIdx(idx);
    };
    const onLeave = () => {
      setHoverIdx(null);
      setHoverX(null);
    };

    return (
      <div className="rounded-2xl border bg-white shadow-sm p-3 overflow-hidden">
        <div className="text-xs text-gray-600 mb-2 flex items-center gap-3">
          <span>
            Distance <strong>{fmtKm(metersToKm(total))}</strong>
          </span>
          {stats?.dplus != null && (
            <span>
              D+ <strong>{fmtM(stats.dplus)}</strong>
            </span>
          )}
          {stats?.dminus != null && (
            <span>
              D- <strong>{fmtM(stats.dminus)}</strong>
            </span>
          )}
          {stats?.amin != null && stats?.amax != null && (
            <span>
              Alt <strong>{Math.round(stats.amin)}–{Math.round(stats.amax)} m</strong>
            </span>
          )}
          {/* infobulle dynamique */}
          {hoverIdx != null && (
            <span className="ml-auto rounded-full bg-gray-100 px-2 py-1">
              {fmtKm(metersToKm(cumDist[hoverIdx]))}
              {altitudes[hoverIdx] != null && (
                <> • {Math.round(altitudes[hoverIdx])} m</>
              )}
            </span>
          )}
        </div>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${w} ${h}`}
          className="w-full block cursor-crosshair select-none"
          onMouseMove={onMove}
          onMouseLeave={onLeave}
        >
          {/* fond */}
          <rect x="0" y="0" width={w} height={h} fill="white" />

          {/* axes */}
          <line
            x1={padding.l}
            y1={padding.t}
            x2={padding.l}
            y2={h - padding.b}
            stroke="#E5E7EB"
          />
          <line
            x1={padding.l}
            y1={h - padding.b}
            x2={w - padding.r}
            y2={h - padding.b}
            stroke="#E5E7EB"
          />

          {/* ticks Y */}
          {ticksY.map((ty, i) => {
            const y = yScale(ty);
            return (
              <g key={`ty-${i}`}>
                <line
                  x1={padding.l}
                  x2={w - padding.r}
                  y1={y}
                  y2={y}
                  stroke="#F3F4F6"
                />
                <text
                  x={padding.l - 6}
                  y={y + 3}
                  fontSize="10"
                  textAnchor="end"
                  fill="#6B7280"
                >
                  {ty} m
                </text>
              </g>
            );
          })}

          {/* ticks X */}
          {ticksX.map((kx, i) => {
            const x = xScale(kx * 1000);
            return (
              <g key={`tx-${i}`}>
                <line
                  x1={x}
                  x2={x}
                  y1={padding.t}
                  y2={h - padding.b}
                  stroke="#F9FAFB"
                />
                <text
                  x={x}
                  y={h - padding.b + 14}
                  fontSize="10"
                  textAnchor="middle"
                  fill="#6B7280"
                >
                  {kx} km
                </text>
              </g>
            );
          })}

          {/* zone & ligne */}
          <defs>
            <linearGradient id="gpxElev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#111827" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#111827" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {area.length > 0 && (
            <path d={area.join(" ")} fill="url(#gpxElev)" />
          )}
          {path.length > 0 && (
            <path d={path.join(" ")} fill="none" stroke="#111827" strokeWidth="2" />
          )}

          {/* ligne verticale/point de survol */}
          {hoverIdx != null && hoverX != null && (
            <>
              <line
                x1={hoverX}
                x2={hoverX}
                y1={padding.t}
                y2={h - padding.b}
                stroke="#2563EB"
                strokeDasharray="3,3"
                opacity="0.7"
              />
              {altitudes[hoverIdx] != null && (
                <circle
                  cx={xScale(cumDist[hoverIdx])}
                  cy={yScale(altitudes[hoverIdx])}
                  r="3"
                  fill="#2563EB"
                  stroke="#fff"
                  strokeWidth="1"
                />
              )}
            </>
          )}
        </svg>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={[
        "w-full rounded-2xl border bg-white shadow-sm",
        isFullscreen ? "fixed inset-0 z-50 rounded-none" : "relative",
      ].join(" ")}
      style={{
        height: isFullscreen ? "100vh" : (responsive ? "auto" : `${height + 200}px`),
      }}
    >
      {/* Header : actions */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-gray-50">
        <div className="text-sm text-gray-700">
          {loading ? "Chargement GPX…" : error ? "Erreur GPX" : "GPX"}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {allowDownload && gpxUrl && (
            <a
              href={gpxUrl}
              download
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-100"
              title="Télécharger le GPX"
            >
              ⬇ Télécharger
            </a>
          )}
          {allowFullscreen && (
            <button
              onClick={toggleFullscreen}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-100"
              title={isFullscreen ? "Quitter le plein écran" : "Passer en plein écran"}
            >
              {isFullscreen ? "⤢ Fermer" : "⤢ Plein écran"}
            </button>
          )}
        </div>
      </div>

      {/* Carte */}
      <div
        ref={mapEl}
        className="w-full"
        style={{ height: isFullscreen ? "55vh" : `${height}px`, minHeight: 240 }}
      >
        {!gpxUrl && (
          <div className="h-full w-full flex items-center justify-center text-gray-500">
            Aucun GPX
          </div>
        )}
      </div>

      {/* Profil altimétrique interactif */}
      <div className="px-3 pb-3">
        <ElevationChart />
      </div>

      {/* Erreur */}
      {error && (
        <div className="m-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      )}
    </div>
  );
}
// src/components/GPXViewer.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Maximize2, Minimize2, Map as MapIcon, Mountain } from "lucide-react";

/**
 * Props:
 * - gpxUrl (string, requis) : URL publique du GPX
 * - height (number) : hauteur en px (défaut 480)
 * - className (string) : classes Tailwind optionnelles
 */
export default function GPXViewer({ gpxUrl, height = 480, className = "" }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const lineRef = useRef(null);
  const hoverMarkerRef = useRef(null);
  const osmLayerRef = useRef(null);
  const topoLayerRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState([]); // [{lat, lon, ele, d}] d en km cumulée
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [basemap, setBasemap] = useState("plan"); // 'plan' | 'relief'

  // ---- parse GPX utility ----
  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000; // m
    const toRad = (v) => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // meters
  }

  async function loadGPX(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Impossible de charger le GPX");
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, "application/xml");
    const pts = Array.from(doc.querySelectorAll("trkpt")).map((pt) => {
      const lat = parseFloat(pt.getAttribute("lat"));
      const lon = parseFloat(pt.getAttribute("lon"));
      const ele = parseFloat(pt.querySelector("ele")?.textContent || "0");
      return { lat, lon, ele };
    });
    if (pts.length < 2) throw new Error("GPX invalide ou trop court");

    // distance cumulée
    let cum = 0;
    const enriched = pts.map((p, i) => {
      if (i > 0) {
        cum += haversine(pts[i - 1].lat, pts[i - 1].lon, p.lat, p.lon);
      }
      return { ...p, d: cum / 1000 }; // km
    });

    // Downsample léger si > 3000 points (perf chart)
    const maxPoints = 2500;
    let sampled = enriched;
    if (enriched.length > maxPoints) {
      const step = Math.ceil(enriched.length / maxPoints);
      sampled = enriched.filter((_, idx) => idx % step === 0);
      if (sampled[sampled.length - 1] !== enriched[enriched.length - 1]) {
        sampled.push(enriched[enriched.length - 1]);
      }
    }

    return sampled;
  }

  // ---- init map once ----
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: true,
    });
    mapRef.current = map;

    // Basemaps
    const osm = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      }
    );
    const topo = L.tileLayer(
      "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 17,
        attribution:
          'Map data: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
      }
    );
    osm.addTo(map);
    osmLayerRef.current = osm;
    topoLayerRef.current = topo;

    // Hover marker
    hoverMarkerRef.current = L.circleMarker([0, 0], {
      radius: 5,
      weight: 2,
      color: "#111",
      fillColor: "#fff",
      fillOpacity: 1,
      opacity: 0,
    }).addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ---- load GPX & draw ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!gpxUrl || !mapRef.current) return;
      setLoading(true);
      setErr("");
      try {
        const pts = await loadGPX(gpxUrl);
        if (cancelled) return;
        setData(pts);

        // draw polyline
        if (lineRef.current) {
          lineRef.current.remove();
          lineRef.current = null;
        }
        const latlngs = pts.map((p) => [p.lat, p.lon]);
        const line = L.polyline(latlngs, {
          color: "#ff6b00",
          weight: 4,
          opacity: 0.9,
        }).addTo(mapRef.current);
        lineRef.current = line;
        mapRef.current.fitBounds(line.getBounds(), { padding: [20, 20] });
      } catch (e) {
        console.error(e);
        setErr(e.message || "Erreur de chargement du GPX");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gpxUrl]);

  // ---- basemap toggle ----
  useEffect(() => {
    if (!mapRef.current || !osmLayerRef.current || !topoLayerRef.current) return;
    if (basemap === "plan") {
      mapRef.current.addLayer(osmLayerRef.current);
      mapRef.current.removeLayer(topoLayerRef.current);
    } else {
      mapRef.current.addLayer(topoLayerRef.current);
      mapRef.current.removeLayer(osmLayerRef.current);
    }
  }, [basemap]);

  // ---- fullscreen ----
  useEffect(() => {
    function onFsChange() {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      // invalidate map size after animation
      setTimeout(() => mapRef.current?.invalidateSize(), 150);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const requestFs = () => containerRef.current?.parentElement?.requestFullscreen?.();
  const exitFs = () => document.exitFullscreen?.();

  // ---- chart hover -> move marker on map ----
  const onChartMove = (state) => {
    if (!state?.activePayload || !mapRef.current || !hoverMarkerRef.current) return;
    const p = state.activePayload[0]?.payload;
    if (!p) return;
    hoverMarkerRef.current.setLatLng([p.lat, p.lon]);
    hoverMarkerRef.current.setStyle({ opacity: 1 });
  };
  const onChartLeave = () => {
    hoverMarkerRef.current?.setStyle({ opacity: 0 });
  };

  const totalKm = useMemo(
    () => (data.length ? data[data.length - 1].d : 0),
    [data]
  );
  const totalDplus = useMemo(() => {
    if (!data.length) return 0;
    let dplus = 0;
    for (let i = 1; i < data.length; i++) {
      const diff = data[i].ele - data[i - 1].ele;
      if (diff > 0) dplus += diff;
    }
    return Math.round(dplus);
  }, [data]);

  return (
    <div className={className}>
      {/* Header actions */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-sm text-gray-700">
          <span className="inline-flex items-center gap-1">
            <Mountain className="w-4 h-4" />
            {totalKm.toFixed(1)} km
          </span>
          <span className="text-gray-300">•</span>
          <span>{totalDplus} m D+</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setBasemap((b) => (b === "plan" ? "relief" : "plan"))}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm hover:bg-gray-50"
            title="Changer le fond de carte"
          >
            <MapIcon className="w-4 h-4" />
            {basemap === "plan" ? "Relief" : "Plan"}
          </button>
          {!isFullscreen ? (
            <button
              onClick={requestFs}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm hover:bg-gray-50"
              title="Plein écran"
            >
              <Maximize2 className="w-4 h-4" />
              Plein écran
            </button>
          ) : (
            <button
              onClick={exitFs}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm hover:bg-gray-50"
              title="Quitter le plein écran"
            >
              <Minimize2 className="w-4 h-4" />
              Quitter
            </button>
          )}
        </div>
      </div>

      {/* Map */}
      <div
        ref={containerRef}
        className="w-full rounded-2xl border shadow-sm overflow-hidden"
        style={{ height }}
      >
        {loading && (
          <div className="w-full h-full flex items-center justify-center text-sm text-gray-500">
            Chargement du tracé…
          </div>
        )}
        {err && !loading && (
          <div className="w-full h-full flex items-center justify-center text-sm text-red-600">
            {err}
          </div>
        )}
      </div>

      {/* Elevation chart */}
      {!!data.length && (
        <div className="mt-3 rounded-2xl border shadow-sm p-2 bg-white">
          <div className="px-2 py-1 text-xs text-gray-600">
            Profil altitude (m) vs distance (km)
          </div>
          <div style={{ width: "100%", height: 180 }}>
            <ResponsiveContainer>
              <AreaChart
                data={data}
                onMouseMove={onChartMove}
                onMouseLeave={onChartLeave}
                margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
              >
                <defs>
                  <linearGradient id="eleFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff6b00" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ff6b00" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="d"
                  type="number"
                  tickFormatter={(v) => v.toFixed(1)}
                  domain={[0, Math.max(0.1, totalKm)]}
                  stroke="#6b7280"
                  fontSize={12}
                />
                <YAxis
                  dataKey="ele"
                  width={40}
                  stroke="#6b7280"
                  fontSize={12}
                />
                <Tooltip
                  formatter={(val, name) => {
                    if (name === "ele") return [`${Math.round(val)} m`, "Altitude"];
                    return [val, name];
                  }}
                  labelFormatter={(lab) => `${lab.toFixed(2)} km`}
                />
                <Area
                  type="monotone"
                  dataKey="ele"
                  stroke="#ff6b00"
                  fill="url(#eleFill)"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
