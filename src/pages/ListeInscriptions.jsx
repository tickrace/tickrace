// src/pages/ListeInscriptions.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";

export default function ListeInscriptions() {
  const { format_id } = useParams();
  const [inscrits, setInscrits] = useState([]);
  const [formatNom, setFormatNom] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const { data: format } = await supabase
        .from("formats")
        .select("nom")
        .eq("id", format_id)
        .single();

      setFormatNom(format?.nom || "");

      const { data: inscriptions } = await supabase
        .from("inscriptions")
        .select("*")
        .eq("format_id", format_id);

      setInscrits(inscriptions || []);
    };

    fetchData();
  }, [format_id]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">
        Inscriptions – {formatNom}
      </h1>

      {inscrits.length === 0 ? (
        <p className="text-gray-600">Aucun coureur inscrit pour ce format.</p>
      ) : (
        <table className="w-full border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2">Nom</th>
              <th className="border p-2">Prénom</th>
              <th className="border p-2">Club</th>
              <th className="border p-2">Email</th>
              <th className="border p-2">Statut</th>
            </tr>
          </thead>
          <tbody>
            {inscrits.map((inscrit) => (
              <tr key={inscrit.id}>
                <td className="border p-2">{inscrit.nom}</td>
                <td className="border p-2">{inscrit.prenom}</td>
                <td className="border p-2">{inscrit.club}</td>
                <td className="border p-2">{inscrit.email}</td>
                <td className="border p-2">{inscrit.statut || "Validé"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
