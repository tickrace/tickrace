import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function ListeInscriptions() {
  const [inscriptions, setInscriptions] = useState([]);

  useEffect(() => {
    const fetchInscriptions = async () => {
      const { data, error } = await supabase
        .from("inscriptions")
        .select("*, formats(id, nom)");

      if (error) {
        console.error("Erreur Supabase :", error);
      } else {
        console.log("Inscriptions avec formats :", data);
        setInscriptions(data);
      }
    };

    fetchInscriptions();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Toutes les inscriptions (avec format)</h1>

      {inscriptions.length === 0 ? (
        <p>Aucune inscription chargée.</p>
      ) : (
        <table className="table-auto border-collapse border w-full">
          <thead className="bg-gray-200">
            <tr>
              <th className="border px-2 py-1">Nom</th>
              <th className="border px-2 py-1">Prénom</th>
              <th className="border px-2 py-1">Email</th>
              <th className="border px-2 py-1">Format</th>
              <th className="border px-2 py-1">Statut</th>
            </tr>
          </thead>
          <tbody>
            {inscriptions.map((i) => (
              <tr key={i.id}>
                <td className="border px-2 py-1">{i.nom}</td>
                <td className="border px-2 py-1">{i.prenom}</td>
                <td className="border px-2 py-1">{i.email}</td>
                <td className="border px-2 py-1">{i.formats?.nom || "?"}</td>
                <td className="border px-2 py-1">{i.statut}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
