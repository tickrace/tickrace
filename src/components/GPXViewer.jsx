// src/components/GPXViewer.jsx
import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Icônes simples départ/arrivée
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

function metersToKm(m) { return (m / 1000); }
function fmtKm(km) { return `${km.toFixed(km >= 100 ? 0 : 1)} km`; }
function fmtMeters(m) { return `${Math.round(m)} m`; }

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const φ1 = lat1 * Math.PI/180, φ2 = lat2 * Math.PI/180;
  const dφ = (lat2-lat1) * Math.PI/180;
  const dλ = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(dφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(dλ/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Lissage simple pour D+/D-
function clampDelta(d) { if (!isFinite(d)) return 0; if (Math.abs(d) < 0.5) return 0; return d; }

export default function GPXViewer({
  gpxUrl,
  height = 420,
  responsive = true,
  allowDownload = false,
  allowBaseMapChoice = true
}) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const layerRefs = useRef({}); // basemaps
  const [loading, setLoading] = useState(true);
  const [track, setTrack] = useState([]); // [{lat, lon, ele?}]
  const [stats, setStats] = useState(null); // {dist, dplus, dminus, amin, amax, avgGrade}
  const [error, setError] = useState(null);

  // fetch + parse GPX
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null); setTrack([]); setStats(null);
      try {
        const res = await fetch(gpxUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (cancelled) return;
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, "application/xml");
        const pts = Array.from(xml.querySelectorAll("trkpt")).map((n) => ({
          lat: parseFloat(n.getAttribute("lat")),
          lon: parseFloat(n.getAttribute("lon")),
          ele: n.querySelector("ele") ? parseFloat(n.querySelector("ele").textContent) : null,
        })).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));

        if (pts.length < 2) throw new Error("Trace insuffisante");

        // stats
        let dist = 0, dplus = 0, dminus = 0, amin = Infinity, amax = -Infinity;
        for (let i=1;i<pts.length;i++) {
          dist += haversine(pts[i-1].lat, pts[i-1].lon, pts[i].lat, pts[i].lon);
        }
        for (let i=1;i<pts.length;i++) {
          const a1 = pts[i-1].ele, a2 = pts[i].ele;
          if (a1 != null && a2 != null) {
            const delta = clampDelta(a2 - a1);
            if (delta > 0) dplus += delta;
            else dminus += Math.abs(delta);
            amin = Math.min(amin, a1, a2);
            amax = Math.max(amax, a1, a2);
          }
        }
        if (amin === Infinity) { amin = null; amax = null; } // pas d’altitude dispo
        const avgGrade = amin != null && amax != null && dist > 0
          ? ((dplus - dminus) / dist) * 100
          : null;

        if (!cancelled) {
          setTrack(pts);
          setStats({ dist, dplus, dminus, amin, amax, avgGrade });
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "Impossible de charger le GPX");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (gpxUrl) load();
    return () => { cancelled = true; };
  }, [gpxUrl]);

  // init Leaflet
  useEffect(() => {
    if (!mapEl.current) return;
    if (mapRef.current) return; // init once

    const map = L.map(mapEl.current, {
      zoomControl: false,
      attributionControl: true,
    });
    mapRef.current = map;

    // Basemaps
    const osmLight = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      { maxZoom: 19, attribution: "&copy; OpenStreetMap" }
    ).addTo(map);

    const osmDark = L.tileLayer(
      "https://{s}.basemaptile.openstreetmap.de/black_white/{z}/{x}/{y}.png",
      { maxZoom: 18, attribution: "&copy; OpenStreetMap" }
    );

    const esriSat = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, attribution: "&copy; Esri" }
    );

    layerRefs.current = { "OSM Clair": osmLight, "OSM Dark": osmDark, "Satellite": esriSat };

    if (allowBaseMapChoice) {
      L.control.layers(layerRefs.current, {}, { position: "topright" }).addTo(map);
    }

    L.control.zoom({ position: "topright" }).addTo(map);

    // Cleanup à l’unmount
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [allowBaseMapChoice]);

  // afficher la trace
  useEffect(() => {
    const map = mapRef.current;
    if (!map || track.length < 2) return;

    // clear anciens layers trace
    const toRemove = [];
    map.eachLayer((l) => {
      // ne pas retirer les tuiles
      if (!(l instanceof L.TileLayer)) toRemove.push(l);
    });
    toRemove.forEach((l) => map.removeLayer(l));

    const latlngs = track.map((p) => [p.lat, p.lon]);
    const line = L.polyline(latlngs, {
      color: "#111827", // gray-900
      weight: 4,
      opacity: 0.9,
    }).addTo(map);

    const start = latlngs[0];
    const end   = latlngs[latlngs.length - 1];
    L.marker(start, { icon: startIcon }).addTo(map).bindTooltip("Départ");
    L.marker(end,   { icon: finishIcon }).addTo(map).bindTooltip("Arrivée");

    map.fitBounds(line.getBounds(), { padding: [20, 20] });

    // bouton recadrer
    L.control.custom = L.Control.extend({
      options: { position: "topright" },
      onAdd: function() {
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
      }
    });
    const recenter = new L.control.custom();
    recenter.addTo(map);

    // Cleanup local (on retire seulement nos layers non-tile)
    return () => {
      try { map.removeControl(recenter); } catch {}
      try { map.removeLayer(line); } catch {}
    };
  }, [track]);

  return (
    <div className="w-full">
      {/* Header infos + actions */}
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <StatsPill stats={stats} loading={loading} />
        <div className="ml-auto flex items-center gap-2">
          {allowDownload && gpxUrl && (
            <a
              href={gpxUrl}
              download
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
              title="Télécharger le GPX"
            >
              ⬇ Télécharger
            </a>
          )}
        </div>
      </div>

      {/* Map */}
      <div
        ref={mapEl}
        className="w-full rounded-2xl border bg-white shadow-sm"
        style={{ height: responsive ? `${height}px` : `${height}px`, minHeight: 240 }}
      >
        {!gpxUrl && (
          <div className="h-full w-full flex items-center justify-center text-gray-500">
            Aucun GPX
          </div>
        )}
      </div>

      {/* Profil altimétrique */}
      <div className="mt-3">
        <ElevationChart points={track} />
      </div>

      {/* Erreur */}
      {error && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      )}
    </div>
  );
}

/* ====== Sous-composants ====== */

function StatsPill({ stats, loading }) {
  if (loading) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-600">
        Chargement GPX…
      </div>
    );
  }
  if (!stats) return null;
  const items = [
    stats.dist != null ? `Distance ${fmtKm(metersToKm(stats.dist))}` : null,
    stats.dplus != null ? `D+ ${fmtMeters(stats.dplus)}` : null,
    stats.dminus != null ? `D- ${fmtMeters(stats.dminus)}` : null,
    stats.amin != null && stats.amax != null ? `Alt ${Math.round(stats.amin)}–${Math.round(stats.amax)} m` : null,
  ].filter(Boolean);
  if (items.length === 0) return null;
  return (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-700">
      {items.join(" • ")}
    </div>
  );
}

// Profil altimétrique (SVG pur)
function ElevationChart({ points, height = 120 }) {
  const hasEle = points?.some((p) => Number.isFinite(p.ele));
  if (!hasEle || points.length < 2) {
    return (
      <div className="rounded-xl border bg-white p-3 text-sm text-gray-500">
        Profil altimétrique indisponible.
      </div>
    );
  }

  // x = distance cumulée, y = élévation
  let dist = 0;
  const xs = [0];
  const ys = [points[0].ele];
  for (let i = 1; i < points.length; i++) {
    dist += haversine(points[i-1].lat, points[i-1].lon, points[i].lat, points[i].lon);
    xs.push(dist);
    ys.push(points[i].ele);
  }

  const w = 800; // largeur logique (sera responsive via CSS)
  const h = height;
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const minX = 0;
  const maxX = xs[xs.length - 1];

  const px = (x) => (x - minX) / (maxX - minX || 1) * (w - 40) + 20; // padding 20
  const py = (y) => (1 - (y - minY) / (maxY - minY || 1)) * (h - 30) + 10; // padding 10/20

  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"} ${px(x)} ${py(ys[i])}`).join(" ");
  const area = `${d} L ${px(maxX)} ${py(minY)} L ${px(minX)} ${py(minY)} Z`;

  return (
    <div className="rounded-2xl border bg-white shadow-sm p-3 overflow-hidden">
      <div className="text-xs text-gray-600 mb-2">
        Profil altimétrique — Distance {fmtKm(metersToKm(maxX))} • Dénivelé visuel
      </div>
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[${h}px]">
          <defs>
            <linearGradient id="gpxElev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#111827" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#111827" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#gpxElev)" />
          <path d={d} fill="none" stroke="#111827" strokeWidth="2" />
          {/* graduations simples */}
          <text x="20" y={h - 6} fontSize="10" fill="#6b7280">{fmtKm(metersToKm(minX))}</text>
          <text x={w - 40} y={h - 6} fontSize="10" fill="#6b7280">{fmtKm(metersToKm(maxX))}</text>
          {Number.isFinite(minY) && Number.isFinite(maxY) && (
            <>
              <text x={w - 36} y={py(maxY)} fontSize="10" fill="#6b7280">{Math.round(maxY)} m</text>
              <text x={w - 36} y={py(minY)} fontSize="10" fill="#6b7280">{Math.round(minY)} m</text>
            </>
          )}
        </svg>
      </div>
    </div>
  );
}
