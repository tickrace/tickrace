// src/components/CoursesMap.jsx
import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { Link } from "react-router-dom";

const CoursesMap = ({ courses }) => {
  const defaultPosition = [46.8, 2.5]; // Centre de la France
  const zoom = 6;

  // Icône personnalisée pour les marqueurs
  const courseIcon = new L.Icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });

  
  return (
    <MapContainer center={defaultPosition} zoom={zoom} style={{ height: "600px", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {courses.map((course) => (
        <Marker key={course.id} position={[course.lat || 46.8, course.lng || 2.5]} icon={courseIcon}>
          <Popup>
            <div className="text-sm">
              <strong>{course.nom}</strong>
              <p>{course.lieu} ({course.departement})</p>
              <p>Prochaine date : {course.formats[0]?.date ?? "?"}</p>
              <Link to={`/courses/${course.id}`} className="text-blue-600 underline">
                Voir la fiche
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default CoursesMap;
