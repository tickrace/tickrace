""import React, { useEffect, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  LayersControl,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.fullscreen/Control.FullScreen.css";
import "leaflet.fullscreen";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

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
      className="absolute top-2 right-2 bg-white p-2 shadow-md rounded hover:bg-gray-200 text-sm z-[1000]"
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
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const mapRef = useRef(null);
  const hoverMarkerRef = useRef(null);

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
    if (!mapRef.current || !hoveredIndex || !profileData[hoveredIndex]) return;
    const { lat, lon } = profileData[hoveredIndex];
    if (!hoverMarkerRef.current) {
      hoverMarkerRef.current = L.marker([lat, lon], {
        icon: L.divIcon({ className: "custom-hover-marker" }),
      }).addTo(mapRef.current);
    } else {
      hoverMarkerRef.current.setLatLng([lat, lon]);
    }
  }, [hoveredIndex, profileData]);

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

  return (
    <div className="space-y-4">
      <div className="relative h-[500px]">
        <MapContainer
          bounds={bounds}
          style={{ height: "100%", width: "100%" }}
          fullscreenControl
          whenCreated={(mapInstance) => (mapRef.current = mapInstance)}
        >
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="IGN">
              <TileLayer
                url="https://wxs.ign.fr/essentiels/geoportail/wmts?layer=GEOGRAPHICALGRIDSYSTEMS.MAPS&style=normal&tilematrixset=PM&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/jpeg&TileMatrix={z}&TileRow={y}&TileCol={x}"
                attribution="&copy; IGN"
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="OSM">
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
            </LayersControl.BaseLayer>
          </LayersControl>

          <Polyline positions={positions} color="#3b82f6" />
          <Marker position={[start[0], start[1]]} icon={startIcon}><Popup>Départ</Popup></Marker>
          <Marker position={[end[0], end[1]]} icon={endIcon}><Popup>Arrivée</Popup></Marker>
          {waypoints.map((w, idx) => (
            <Marker key={idx} position={[w.lat, w.lon]} icon={waypointIcon}>
              <Popup><strong>{w.name}</strong><div className="text-xs">{w.desc}</div></Popup>
            </Marker>
          ))}
          <ResetViewButton bounds={bounds} />
        </MapContainer>
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
                if (state?.activeTooltipIndex != null) {
                  setHoveredIndex(state.activeTooltipIndex);
                }
              }}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <XAxis dataKey="km" tickFormatter={(v) => v.toFixed(1) + " km"} />
              <YAxis dataKey="ele" unit=" m" />
              <Tooltip formatter={(value) => `${Math.round(value)} m`} labelFormatter={(l) => `${l.toFixed(2)} km`} />
              <Line type="monotone" dataKey="ele" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
