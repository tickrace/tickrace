import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";

export default function ListeInscriptions() {
  const { formatId } = useParams();
  const [inscriptions, setInscriptions] = useState([]);

  useEffect(() => {
    if (formatId) {
      fetchInscriptions();
    }
  }, [formatId]);

  const fetchInscriptions = async () => {
    const { data, error } = await supabase
      .from("inscriptions")
      .select("*")
      .eq("format_id", formatId);

    if (!error) setInscriptions(data);
    else console.error("Erreur de chargement des inscriptions :", error);
  };

  const handleDossardChange = async (id, newDossard) => {
    const { error } = await supabase
      .from("inscriptions")
      .update({ dossard: parseInt(newDossard) })
      .eq("id", id);

    if (error) {
      console.error("Erreur de mise à jour du dossard :", error);
      alert("Erreur lors de la mise à jour du dossard.");
    } else {
      const updated = inscriptions.map((i) =>
        i.id === id ? { ...i, dossard: parseInt(newDossard) } : i
      );
      setInscriptions(updated);
    }
  };

  if (!formatId) return <p>Format non défini.</p>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Liste des inscrits</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border">Nom</th>
              <th className="p-2 border">Prénom</th>
              <th className="p-2 border">Email</th>
              <th className="p-2 border">Téléphone</th>
              <th className="p-2 border">Date Naissance</th>
              <th className="p-2 border">Nationalité</th>
              <th className="p-2 border">Ville</th>
              <th className="p-2 border">Club</th>
              <th className="p-2 border">Justificatif</th>
              <th className="p-2 border">Statut</th>
              <th className="p-2 border">Dossard</th>
              <th className="p-2 border">Urgence</th>
              <th className="p-2 border">Créé le</th>
            </tr>
          </thead>
          <tbody>
            {inscriptions.map((inscription) => (
              <tr key={inscription.id} className="border-t">
                <td className="p-2 border">{inscription.nom}</td>
                <td className="p-2 border">{inscription.prenom}</td>
                <td className="p-2 border">{inscription.email}</td>
                <td className="p-2 border">{inscription.telephone}</td>
                <td className="p-2 border">{inscription.date_naissance}</td>
                <td className="p-2 border">{inscription.nationalite}</td>
                <td className="p-2 border">{inscription.ville}</td>
                <td className="p-2 border">{inscription.club}</td>
                <td className="p-2 border">{inscription.justificatif_type}</td>
                <td className="p-2 border">{inscription.statut}</td>
                <td className="p-2 border">
                  <input
                    type="number"
                    value={inscription.dossard || ""}
                    onChange={(e) =>
                      handleDossardChange(inscription.id, e.target.value)
                    }
                    className="border p-1 rounded w-20"
                  />
                </td>
                <td className="p-2 border">
                  {inscription.contact_urgence_nom} - {inscription.contact_urgence_telephone}
                </td>
                <td className="p-2 border">
                  {new Date(inscription.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
