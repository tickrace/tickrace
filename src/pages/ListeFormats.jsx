// src/pages/ListeFormats.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function ListeFormats() {
  const [formats, setFormats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFormats = async () => {
      const { data, error } = await supabase
        .from("formats")
        .select("*")
        .order("heure_depart", { ascending: true });

      if (error) {
        setError("Erreur de chargement des formats.");
        console.error(error);
      } else {
        setFormats(data);
      }

      setLoading(false);
    };

    fetchFormats();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Liste des formats d'épreuve</h1>

      {loading ? (
        <p>Chargement...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : formats.length === 0 ? (
        <p>Aucun format disponible.</p>
      ) : (
        <table className="w-full border-collapse border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2">Nom</th>
              <th className="border p-2">Distance (km)</th>
              <th className="border p-2">D+</th>
              <th className="border p-2">D-</th>
              <th className="border p-2">Prix (€)</th>
              <th className="border p-2">Heure départ</th>
            </tr>
          </thead>
          <tbody>
            {formats.map((format) => (
              <tr key={format.id}>
                <td className="border p-2">{format.nom}</td>
                <td className="border p-2">{format.distance_km}</td>
                <td className="border p-2">{format.denivele_dplus}</td>
                <td className="border p-2">{format.denivele_dmoins}</td>
                <td className="border p-2">{format.prix}</td>
                <td className="border p-2">{format.heure_depart}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
