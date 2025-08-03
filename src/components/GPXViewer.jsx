import React, { useEffect, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import "leaflet.fullscreen/dist/leaflet.fullscreen.css";

import "leaflet.fullscreen";

// Icônes
const startIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const endIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-red.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const waypointIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/854/854878.png",
  iconSize: [24, 24],
  iconAnchor: [12, 24],
});

function ResetViewButton({ bounds }) {
  const map = useMap();
  return (
    <button
      onClick={() => map.fitBounds(bounds)}
      className="absolute top-2 right-2 bg-white p-2 shadow rounded hover:bg-gray-100 z-[1000]"
    >
      🔄 Centrer
    </button>
  );
}

export default function GPXViewer({ gpxUrl }) {
  const [positions, setPositions] = useState([]);
  const [bounds, setBounds] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileData, setProfileData] = useState([]);
  const [stats, setStats] = useState({ distance: 0, elevationGain: 0 });
  const [waypoints, setWaypoints] = useState([]);
  const [hoverPosition, setHoverPosition] = useState(null);
  const [selectedMap, setSelectedMap] = useState("ign");

  const mapRef = useRef();

  useEffect(() => {
    if (!gpxUrl) return;

    const fetchGPX = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(gpxUrl);
        if (!res.ok) throw new Error("Impossible de charger le GPX");
        const text = await res.text();

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "application/xml");

        const trkpts = xmlDoc.getElementsByTagName("trkpt");

        const coords = [];
        const profile = [];
        let dist = 0;
        let elevationGain = 0;

        for (let i = 0; i < trkpts.length; i++) {
          const lat = parseFloat(trkpts[i].getAttribute("lat"));
          const lon = parseFloat(trkpts[i].getAttribute("lon"));
          const ele = parseFloat(
            trkpts[i].getElementsByTagName("ele")[0]?.textContent || "0"
          );
          coords.push([lat, lon, ele]);

          if (i > 0) {
            const [lat1, lon1, ele1] = coords[i - 1];
            const R = 6371e3;
            const φ1 = (lat1 * Math.PI) / 180;
            const φ2 = (lat * Math.PI) / 180;
            const Δφ = ((lat - lat1) * Math.PI) / 180;
            const Δλ = ((lon - lon1) * Math.PI) / 180;

            const a =
              Math.sin(Δφ / 2) ** 2 +
              Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            dist += R * c;

            if (ele > ele1) elevationGain += ele - ele1;
          }
          profile.push({ km: dist / 1000, ele, lat, lon });
        }

        setPositions(coords);
        if (coords.length > 0) setBounds(L.latLngBounds(coords));
        setProfileData(profile);
        setStats({ distance: dist / 1000, elevationGain });

        const wpts = xmlDoc.getElementsByTagName("wpt");
        const wptsArray = [];
        for (let i = 0; i < wpts.length; i++) {
          const lat = parseFloat(wpts[i].getAttribute("lat"));
          const lon = parseFloat(wpts[i].getAttribute("lon"));
          const name =
            wpts[i].getElementsByTagName("name")[0]?.textContent || "Waypoint";
          const desc =
            wpts[i].getElementsByTagName("desc")[0]?.textContent || "";
          wptsArray.push({ lat, lon, name, desc });
        }
        setWaypoints(wptsArray);
      } catch (error) {
        console.error("Erreur GPX:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGPX();
  }, [gpxUrl]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 rounded">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!positions.length) return <p>Impossible de charger le GPX.</p>;

  const start = positions[0];
  const end = positions[positions.length - 1];

  const tileOptions = {
    ign: "https://wxs.ign.fr/essentiels/geoportail/wmts?layer=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&style=normal&tilematrixset=PM&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/png&TileMatrix={z}&TileCol={x}&TileRow={y}",
    osm: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  };

  return (
    <div className="space-y-4">
      <div className="relative h-96 rounded overflow-hidden">
        <MapContainer
          ref={mapRef}
          bounds={bounds}
          style={{ height: "100%", width: "100%" }}
          fullscreenControl={true}
        >
          <TileLayer
            url={tileOptions[selectedMap]}
            attribution="&copy; IGN / OpenStreetMap"
          />
          <Polyline positions={positions.map(([lat, lon]) => [lat, lon])} color="blue" />

          <Marker position={[start[0], start[1]]} icon={startIcon}>
            <Popup>Départ</Popup>
          </Marker>
          <Marker position={[end[0], end[1]]} icon={endIcon}>
            <Popup>Arrivée</Popup>
          </Marker>

          {hoverPosition && (
            <Marker position={hoverPosition} icon={waypointIcon}>
              <Popup>Position actuelle</Popup>
            </Marker>
          )}

          {waypoints.map((w, idx) => (
            <Marker key={idx} position={[w.lat, w.lon]} icon={waypointIcon}>
              <Popup>
                <strong>{w.name}</strong>
                {w.desc && <div className="text-xs text-gray-600">{w.desc}</div>}
              </Popup>
            </Marker>
          ))}

          <ResetViewButton bounds={bounds} />
        </MapContainer>

        <div className="absolute top-2 left-2 z-[1000] bg-white p-1 text-xs rounded shadow">
          <select value={selectedMap} onChange={(e) => setSelectedMap(e.target.value)}>
            <option value="ign">Carte IGN</option>
            <option value="osm">OpenStreetMap</option>
          </select>
        </div>

        <div className="absolute bottom-2 left-2 bg-white p-1 text-xs rounded shadow">
          {stats.distance.toFixed(2)} km — D+ {Math.round(stats.elevationGain)} m
        </div>
      </div>

      {profileData.length > 0 && (
        <div className="h-48 bg-white shadow rounded p-2">
          <h4 className="text-sm font-semibold mb-1">Profil altimétrique</h4>
          <ResponsiveContainer width="100%" height="90%">
            <LineChart
              data={profileData}
              onMouseMove={(state) => {
                if (state?.activePayload?.[0]) {
                  const { lat, lon } = state.activePayload[0].payload;
                  setHoverPosition([lat, lon]);
                }
              }}
              onMouseLeave={() => setHoverPosition(null)}
            >
              <XAxis dataKey="km" tickFormatter={(v) => v.toFixed(1) + " km"} />
              <YAxis dataKey="ele" unit=" m" />
              <Tooltip
                formatter={(value) => `${Math.round(value)} m`}
                labelFormatter={(label) => `${label.toFixed(2)} km`}
              />
              <Line
                type="monotone"
                dataKey="ele"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
