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
      className="absolute top-2 right-2 z-[1000] bg-white p-2 shadow rounded text-sm hover:bg-gray-200"
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
  const [activePoint, setActivePoint] = useState(null);
  const [mapLayer, setMapLayer] = useState("osm");
  const dynamicMarkerRef = useRef();
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
          const ele = parseFloat(trkpts[i].getElementsByTagName("ele")[0]?.textContent || "0");
          coords.push([lat, lon, ele]);

          if (i > 0) {
            const [lat1, lon1, ele1] = coords[i - 1];
            const R = 6371e3;
            const φ1 = (lat1 * Math.PI) / 180;
            const φ2 = (lat * Math.PI) / 180;
            const Δφ = ((lat - lat1) * Math.PI) / 180;
            const Δλ = ((lon - lon1) * Math.PI) / 180;
            const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
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
          const name = wpts[i].getElementsByTagName("name")[0]?.textContent || "Waypoint";
          const desc = wpts[i].getElementsByTagName("desc")[0]?.textContent || "";
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

  useEffect(() => {
    if (!bounds) return;
    const map = mapRef.current;
    if (map) {
      map.fitBounds(bounds);
    }
  }, [bounds]);

  const start = positions[0];
  const end = positions[positions.length - 1];

  const tileURLs = {
    osm: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  };

  return (
    <div className="space-y-4">
      <div className="relative h-96">
        <MapContainer
          ref={mapRef}
          bounds={bounds || [[0, 0], [0, 0]]}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url={tileURLs[mapLayer]}
            attribution={
              mapLayer === "osm"
                ? "&copy; OpenStreetMap"
                : "Tiles &copy; Esri &mdash; Source: Esri"
            }
          />

          <Polyline positions={positions.map(([lat, lon]) => [lat, lon])} color="blue" />

          {start && <Marker position={[start[0], start[1]]} icon={startIcon}><Popup>Départ</Popup></Marker>}
          {end && <Marker position={[end[0], end[1]]} icon={endIcon}><Popup>Arrivée</Popup></Marker>}

          {waypoints.map((w, idx) => (
            <Marker key={idx} position={[w.lat, w.lon]} icon={waypointIcon}>
              <Popup><strong>{w.name}</strong><div className="text-xs text-gray-600">{w.desc}</div></Popup>
            </Marker>
          ))}

          {activePoint && (
            <Marker
              ref={dynamicMarkerRef}
              position={[activePoint.lat, activePoint.lon]}
              icon={new L.DivIcon({
                className: 'custom-icon',
                html: '<div style="width:10px;height:10px;border-radius:50%;background:red;"></div>'
              })}
            />
          )}

          <ResetViewButton bounds={bounds} />
        </MapContainer>

        {/* Bouton de fond de carte */}
        <div className="absolute top-2 left-2 bg-white shadow rounded z-[1000] text-sm">
          <select
            value={mapLayer}
            onChange={(e) => setMapLayer(e.target.value)}
            className="p-1 text-sm border-none bg-white rounded"
          >
            <option value="osm">OpenStreetMap</option>
            <option value="satellite">Satellite</option>
          </select>
        </div>

        <div className="absolute bottom-2 left-2 bg-white p-1 text-xs rounded shadow">
          {stats.distance.toFixed(2)} km — D+ {Math.round(stats.elevationGain)} m
        </div>
      </div>

      {/* Profil altimétrique */}
      {profileData.length > 0 && (
        <div className="h-48 bg-white shadow rounded p-2">
          <h4 className="text-sm font-semibold mb-1">Profil altimétrique</h4>
          <ResponsiveContainer width="100%" height="90%">
            <LineChart
              data={profileData}
              onMouseMove={(e) => {
                if (e && e.activePayload && e.activePayload[0]) {
                  const { lat, lon } = e.activePayload[0].payload;
                  setActivePoint({ lat, lon });
                }
              }}
              onMouseLeave={() => setActivePoint(null)}
            >
              <XAxis dataKey="km" tickFormatter={(v) => v.toFixed(1) + " km"} />
              <YAxis dataKey="ele" unit=" m" />
              <Tooltip formatter={(value) => `${Math.round(value)} m`} labelFormatter={(label) => `${label.toFixed(2)} km`} />
              <Line type="monotone" dataKey="ele" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
