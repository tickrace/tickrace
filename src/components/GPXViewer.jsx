import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function GPXViewer({ gpxUrl }) {
  const [profileData, setProfileData] = useState([]);
  const [positions, setPositions] = useState([]);

  useEffect(() => {
    const fetchGPX = async () => {
      try {
        const res = await fetch(gpxUrl);
        const text = await res.text();
        const parser = new DOMParser();
        const gpx = parser.parseFromString(text, "application/xml");

        const points = Array.from(gpx.querySelectorAll("trkpt")).map((pt, idx) => ({
          distance: idx,
          elevation: parseFloat(pt.querySelector("ele")?.textContent || 0),
          lat: parseFloat(pt.getAttribute("lat")),
          lon: parseFloat(pt.getAttribute("lon")),
        }));

        setProfileData(points);
        setPositions(points.map((p) => [p.lat, p.lon]));
      } catch (err) {
        console.error("Erreur GPX :", err);
      }
    };
    if (gpxUrl) fetchGPX();
  }, [gpxUrl]);

  if (!gpxUrl) return null;

  const avgLat = positions.reduce((sum, [lat]) => sum + lat, 0) / (positions.length || 1);
  const avgLon = positions.reduce((sum, [, lon]) => sum + lon, 0) / (positions.length || 1);

  return (
    <div className="mt-4 space-y-4">
      {/* Carte GPX */}
      <div className="h-72 mb-2">
        <MapContainer
          center={[avgLat || 44.5, avgLon || 2.5]}
          zoom={12}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {positions.length > 0 && (
            <Polyline positions={positions} color="blue" weight={3} />
          )}
        </MapContainer>
      </div>

      {/* Bouton de téléchargement */}
      <div>
        <a
          href={gpxUrl}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-4 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
        >
          📥 Télécharger le fichier GPX
        </a>
      </div>

      {/* Profil Altitude */}
      <div className="h-64 bg-white p-2 rounded shadow">
        <h4 className="text-sm font-semibold mb-2">Profil d’altitude</h4>
        {profileData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={profileData}>
              <XAxis
                dataKey="distance"
                label={{ value: "Points", position: "insideBottomRight", offset: -5 }}
              />
              <YAxis label={{ value: "Altitude (m)", angle: -90, position: "insideLeft" }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="elevation"
                stroke="#82ca9d"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-500">Chargement du profil...</p>
        )}
      </div>
    </div>
  );
}
