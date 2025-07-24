import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

export default function DetailsCoureur() {
  const { id } = useParams(); // ID de l'inscription
  const navigate = useNavigate();
  const [inscription, setInscription] = useState(null);

  useEffect(() => {
    if (id) {
      fetchInscription();
    }
  }, [id]);

  const fetchInscription = async () => {
    const { data, error } = await supabase
      .from("inscriptions")
      .select("*")
      .eq("id", id)
      .single();
    if (!error) setInscription(data);
  };

  const handleChange = async (field, value) => {
    const updated = { ...inscription, [field]: value };
    setInscription(updated);
    await supabase.from("inscriptions").update({ [field]: value }).eq("id", id);
  };

  if (!inscription) return <div className="p-6">Chargement...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="px-4 py-2 bg-gray-300 text-gray-900 rounded hover:bg-gray-400"
      >
        ← Retour
      </button>

      <h1 className="text-2xl font-bold">Détails du coureur</h1>

      <table className="min-w-full table-auto border border-gray-300">
        <tbody>
          {Object.entries({
            nom: "Nom",
            prenom: "Prénom",
            genre: "Genre",
            date_naissance: "Date de naissance",
            nationalite: "Nationalité",
            email: "Email",
            telephone: "Téléphone",
            adresse: "Adresse",
            adresse_complement: "Complément d'adresse",
            code_postal: "Code postal",
            ville: "Ville",
            pays: "Pays",
            apparaitre_resultats: "Apparaître dans les résultats",
            club: "Club",
            justificatif_type: "Justificatif",
            contact_urgence_nom: "Nom contact d'urgence",
            contact_urgence_telephone: "Téléphone contact d'urgence",
            statut: "Statut",
            created_at: "Créé le",
            updated_at: "Mis à jour le",
            numero_licence: "Numéro de licence",
            dossard: "Dossard",
            nombre_repas: "Nombre de repas",
            prix_total_repas: "Prix total des repas",
          }).map(([field, label]) => (
            <tr key={field}>
              <td className="border px-2 py-1 font-medium bg-gray-100">{label}</td>
              <td className="border px-2 py-1">
                {field === "apparaitre_resultats" ? (
                  <input
                    type="checkbox"
                    checked={inscription[field] || false}
                    onChange={(e) => handleChange(field, e.target.checked)}
                  />
                ) : field === "created_at" || field === "updated_at" ? (
                  <span className="text-gray-600">
                    {inscription[field] ? new Date(inscription[field]).toLocaleString() : "-"}
                  </span>
                ) : (
                  <input
                    type={field === "date_naissance" ? "date" : "text"}
                    value={inscription[field] || ""}
                    onChange={(e) => handleChange(field, e.target.value)}
                    className="w-full border rounded px-2 py-1"
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
