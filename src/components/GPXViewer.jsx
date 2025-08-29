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
import { Maximize2, Minimize2, Map as MapIcon, Mountain, Download } from "lucide-react";

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
  const progressRef = useRef(null);        // segment de progression
  const hoverMarkerRef = useRef(null);
  const osmLayerRef = useRef(null);
  const topoLayerRef = useRef(null);
  const latlngsRef = useRef([]);           // latlngs du tracé
  const lastIdxRef = useRef(-1);           // dernier index utilisé

  // Repères départ/arrivée
  const startMarkerRef = useRef(null);
  const finishMarkerRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState([]);    // [{lat, lon, ele, d}] d en km
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [basemap, setBasemap] = useState("plan"); // 'plan' | 'relief'

  // Slider (scrubbing mobile)
  const [sliderKm, setSliderKm] = useState(null); // km sélectionnés par le slider (null = inactif)

  // ---- helpers ----
  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000; // m
    const toRad = (v) => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
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
      if (i > 0) cum += haversine(pts[i - 1].lat, pts[i - 1].lon, p.lat, p.lon);
      return { ...p, d: cum / 1000 }; // km
    });

    // downsample léger pour la courbe si > 3000 points
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

  // index le + proche pour une distance (km)
  function nearestIndexByDistance(dVal, arr) {
    let lo = 0, hi = arr.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid].d === dVal) return mid;
      if (arr[mid].d < dVal) lo = mid + 1;
      else hi = mid - 1;
    }
    if (lo <= 0) return 0;
    if (lo >= arr.length) return arr.length - 1;
    return Math.abs(arr[lo].d - dVal) < Math.abs(arr[hi].d - dVal) ? lo : hi;
  }

  // Met à jour le marqueur/progression à partir d'un index
  function updatePointerByIndex(idx, options = { autopan: true }) {
    if (!mapRef.current || !hoverMarkerRef.current || !data.length) return;
    if (idx < 0 || idx >= data.length) return;

    if (idx === lastIdxRef.current) return;
    lastIdxRef.current = idx;

    const { lat, lon, ele, d } = data[idx];

    // Marqueur
    hoverMarkerRef.current.setLatLng([lat, lon]);
    hoverMarkerRef.current.setStyle({ opacity: 1, fillOpacity: 1 });
    const tt = `${Math.round(ele)} m • ${d.toFixed(2)} km`;
    const tooltip = hoverMarkerRef.current.getTooltip?.();
    if (tooltip) tooltip.setContent(tt);
    hoverMarkerRef.current.openTooltip();

    // Progression
    if (progressRef.current && latlngsRef.current.length) {
      const seg = latlngsRef.current.slice(0, Math.max(1, idx + 1));
      progressRef.current.setLatLngs(seg);
    }

    // Auto-pan
    if (options.autopan) {
      const map = mapRef.current;
      const pt = map.latLngToContainerPoint([lat, lon]);
      const pad = 20;
      const sz = map.getSize();
      if (pt.x < pad || pt.y < pad || pt.x > sz.x - pad || pt.y > sz.y - pad) {
        map.panTo([lat, lon], { animate: true });
      }
    }
  }

  // Met à jour via km (slider)
  function updatePointerByKm(km, options = { autopan: false }) {
    if (!data.length) return;
    const idx = nearestIndexByDistance(km, data);
    updatePointerByIndex(idx, options);
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
    const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    });
    const topo = L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
      maxZoom: 17,
      attribution: 'Map data: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    });
    osm.addTo(map);
    osmLayerRef.current = osm;
    topoLayerRef.current = topo;

    // Marqueur hover (invisible au départ)
    hoverMarkerRef.current = L.circleMarker([0, 0], {
      radius: 6,
      weight: 2,
      color: "#111",
      fillColor: "#fff",
      fillOpacity: 0,
      opacity: 0,
    })
      .bindTooltip("", { direction: "top", offset: [0, -8] })
      .addTo(map);

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

        // Nettoie anciens layers
        if (lineRef.current) { lineRef.current.remove(); lineRef.current = null; }
        if (progressRef.current) { progressRef.current.remove(); progressRef.current = null; }
        if (startMarkerRef.current) { startMarkerRef.current.remove(); startMarkerRef.current = null; }
        if (finishMarkerRef.current) { finishMarkerRef.current.remove(); finishMarkerRef.current = null; }

        // Polyline
        const latlngs = pts.map((p) => [p.lat, p.lon]);
        latlngsRef.current = latlngs;

        const line = L.polyline(latlngs, { color: "#ff6b00", weight: 4, opacity: 0.9 }).addTo(mapRef.current);
        lineRef.current = line;

        // Segment de progression
        const progress = L.polyline([], { color: "#111", weight: 6, opacity: 0.35 }).addTo(mapRef.current);
        progressRef.current = progress;

        // Repères Départ / Arrivée
        const start = L.circleMarker(latlngs[0], {
          radius: 7,
          color: "#065f46",
          fillColor: "#10b981",
          fillOpacity: 1,
          weight: 2,
        }).bindTooltip("Départ", { permanent: false, direction: "top", offset: [0, -8] })
          .addTo(mapRef.current);
        startMarkerRef.current = start;

        const finish = L.circleMarker(latlngs[latlngs.length - 1], {
          radius: 7,
          color: "#7f1d1d",
          fillColor: "#ef4444",
          fillOpacity: 1,
          weight: 2,
        }).bindTooltip("Arrivée", { permanent: false, direction: "top", offset: [0, -8] })
          .addTo(mapRef.current);
        finishMarkerRef.current = finish;

        // Fit + position initiale du slider/curseur au départ
        mapRef.current.fitBounds(line.getBounds(), { padding: [20, 20] });
        setSliderKm(0);
        lastIdxRef.current = -1;
        updatePointerByKm(0, { autopan: false });
      } catch (e) {
        console.error(e);
        setErr(e.message || "Erreur de chargement du GPX");
      } finally {
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
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
      setTimeout(() => mapRef.current?.invalidateSize(), 150);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const requestFs = () => containerRef.current?.parentElement?.requestFullscreen?.();
  const exitFs = () => document.exitFullscreen?.();

  // ---- Téléchargement GPX ----
  function filenameFromUrl(url) {
    try {
      const u = new URL(url, window.location.origin);
      const name = u.pathname.split("/").pop() || "trace.gpx";
      return name.includes(".") ? name : `${name}.gpx`;
    } catch {
      return "trace.gpx";
    }
  }
  async function handleDownload() {
    if (!gpxUrl) return;
    try {
      const r = await fetch(gpxUrl, { credentials: "omit" });
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filenameFromUrl(gpxUrl);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // fallback: ouvre le lien brut (selon CORS, le navigateur proposera le DL)
      window.open(gpxUrl, "_blank", "noopener,noreferrer");
    }
  }

  // ---- SURVOL: déplace/affiche le marqueur + progression + autopan ----
  const onChartMove = (state) => {
    if (!mapRef.current || !hoverMarkerRef.current || !data.length || !state) return;

    const { isTooltipActive, activeTooltipIndex, activeLabel, activePayload } = state;
    if (!isTooltipActive) return;

    // index robuste
    let idx =
      typeof activeTooltipIndex === "number" && activeTooltipIndex >= 0
        ? activeTooltipIndex
        : -1;

    if (idx < 0 || idx >= data.length) {
      const dVal =
        typeof activeLabel === "number"
          ? activeLabel
          : activePayload?.[0]?.payload?.d;
      if (typeof dVal === "number") idx = nearestIndexByDistance(dVal, data);
      else return;
    }

    updatePointerByIndex(idx, { autopan: true });

    // On synchronise le slider (sans autopan)
    const km = data[idx].d;
    setSliderKm(km);
  };

  // ---- SORTIE SURVOL ----
  const onChartLeave = () => {
    if (sliderKm == null) {
      // Si pas de slider actif, on cache tout
      hoverMarkerRef.current?.setStyle({ opacity: 0, fillOpacity: 0 });
      hoverMarkerRef.current?.closeTooltip?.();
      progressRef.current?.setLatLngs([]);
      lastIdxRef.current = -1;
    } else {
      // Sinon on remet le curseur sur la position du slider
      updatePointerByKm(sliderKm, { autopan: false });
    }
  };

  // ---- CLIC: centre la carte sur le point cliqué ----
  const onChartClick = (state) => {
    if (!mapRef.current || !data.length || !state) return;

    const { activeTooltipIndex, activeLabel, activePayload } = state;
    let idx =
      typeof activeTooltipIndex === "number" && activeTooltipIndex >= 0
        ? activeTooltipIndex
        : -1;

    if (idx < 0 || idx >= data.length) {
      const dVal =
        typeof activeLabel === "number"
          ? activeLabel
          : activePayload?.[0]?.payload?.d;
      if (typeof dVal === "number") idx = nearestIndexByDistance(dVal, data);
      else return;
    }

    const { lat, lon } = data[idx];
    mapRef.current.panTo([lat, lon], { animate: true });
  };

  const totalKm = useMemo(() => (data.length ? data[data.length - 1].d : 0), [data]);
  const totalDplus = useMemo(() => {
    if (!data.length) return 0;
    let dplus = 0;
    for (let i = 1; i < data.length; i++) {
      const diff = data[i].ele - data[i - 1].ele;
      if (diff > 0) dplus += diff;
    }
    return Math.round(dplus);
  }, [data]);

  // km & altitude pour l'affichage du slider
  const sliderInfo = useMemo(() => {
    if (sliderKm == null || !data.length) return { km: null, ele: null };
    const idx = nearestIndexByDistance(sliderKm, data);
    return { km: data[idx].d, ele: data[idx].ele };
  }, [sliderKm, data]);

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

          <button
            onClick={handleDownload}
            disabled={!gpxUrl}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm hover:bg-gray-50 disabled:opacity-50"
            title="Télécharger le fichier GPX"
          >
            <Download className="w-4 h-4" />
            Télécharger le GPX
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

      {/* Elevation chart + slider */}
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
                onClick={onChartClick}
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
                <YAxis dataKey="ele" width={40} stroke="#6b7280" fontSize={12} />
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

          {/* Slider scrubbing (mobile friendly) */}
          <div className="mt-3 px-2">
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
              <span>0 km</span>
              <span>{totalKm.toFixed(1)} km</span>
            </div>
            <input
              type="range"
              min={0}
              max={totalKm}
              step={0.1}
              value={sliderKm ?? 0}
              onChange={(e) => {
                const v = Number(e.target.value);
                setSliderKm(v);
                updatePointerByKm(v, { autopan: false });
              }}
              className="w-full accent-orange-600"
            />
            {sliderInfo.km != null && (
              <div className="mt-1 text-xs text-gray-700">
                Position: <span className="font-medium">{sliderInfo.km.toFixed(2)} km</span> • Alt:{" "}
                <span className="font-medium">{Math.round(sliderInfo.ele)} m</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
