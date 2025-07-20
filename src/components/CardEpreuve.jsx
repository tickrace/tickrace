// src/components/CardEpreuve.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

export default function CardEpreuve({ course }) {
  const navigate = useNavigate();
  const premierFormat = course.formats?.[0];
  const date = premierFormat?.date || "Date inconnue";
  const image = course.image_url;

  return (
    <div className="border rounded-xl p-4 bg-white shadow">
      {image && <img src={image} alt={course.nom} className="w-full h-48 object-cover rounded-md mb-3" />}
      <h2 className="text-xl font-semibold mb-1">{course.nom}</h2>
      <p className="text-sm text-gray-600">📍 {course.lieu} ({course.departement})</p>
      <p className="text-sm text-gray-500">📅 {date}</p>
      <div className="flex gap-2 mt-4">
        <button
          onClick={() => navigate(`/modifier-course/${course.id}`)}
          className="bg-blue-600 text-white px-3 py-1 rounded"
        >
          Modifier
        </button>
        <button
          onClick={() => navigate(`/course/${course.id}`)}
          className="bg-gray-600 text-white px-3 py-1 rounded"
        >
          Voir page publique
        </button>
      </div>
    </div>
  );
}
