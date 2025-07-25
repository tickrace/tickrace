import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Polyline, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { parseString } from "xml2js";

const startIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const endIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-red.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

function ResetViewButton({ bounds }) {
  const map = useMap();
  return (
    <button
      onClick={() => map.fitBounds(bounds)}
      className="absolute top-2 right-2 bg-white p-2 shadow-md rounded hover:bg-gray-200 text-sm"
    >
      🔄 Centrer
    </button>
  );
}

export default function GPXViewer({ gpxUrl }) {
  const [positions, setPositions] = useState([]);
  const [bounds, setBounds] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ distance: 0, elevationGain: 0 });

  useEffect(() => {
    if (!gpxUrl) return;

    const fetchGPX = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(gpxUrl);
        const text = await res.text();
        parseString(text, (err, result) => {
          if (err) return;

          const trkpts = result.gpx.trk[0].trkseg[0].trkpt;
          const coords = trkpts.map((pt) => [
            parseFloat(pt.$.lat),
            parseFloat(pt.$.lon),
            parseFloat(pt.ele[0]),
          ]);

          setPositions(coords);
          setBounds(L.latLngBounds(coords));

          let dist = 0;
          let elevationGain = 0;
          for (let i = 1; i < coords.length; i++) {
            const [lat1, lon1, ele1] = coords[i - 1];
            const [lat2, lon2, ele2] = coords[i];
            const R = 6371e3;
            const φ1 = (lat1 * Math.PI) / 180;
            const φ2 = (lat2 * Math.PI) / 180;
            const Δφ = ((lat2 - lat1) * Math.PI) / 180;
            const Δλ = ((lon2 - lon1) * Math.PI) / 180;

            const a =
              Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

            dist += R * c;
            if (ele2 > ele1) elevationGain += ele2 - ele1;
          }
          setStats({ distance: dist / 1000, elevationGain });
        });
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

  return (
    <div className="relative h-96">
      <MapContainer bounds={bounds} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <Polyline positions={positions} color="blue" />
        <Marker position={[start[0], start[1]]} icon={startIcon} />
        <Marker position={[end[0], end[1]]} icon={endIcon} />
        <ResetViewButton bounds={bounds} />
      </MapContainer>
      <div className="absolute bottom-2 left-2 bg-white p-1 text-xs rounded shadow">
        {stats.distance.toFixed(2)} km — D+ {Math.round(stats.elevationGain)} m
      </div>
    </div>
  );
}
