
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

export default function DetailsCoureur() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [inscription, setInscription] = useState(null);

  useEffect(() => {
    const fetchInscription = async () => {
      const { data, error } = await supabase
        .from("inscriptions")
        .select("*")
        .eq("id", id)
        .single();

      if (data) setInscription(data);
    };

    if (id) fetchInscription();
  }, [id]);

  const handleChange = async (field, value) => {
    const updated = { ...inscription, [field]: value };
    setInscription(updated);

    await supabase
      .from("inscriptions")
      .update({ [field]: value })
      .eq("id", id);
  };

  if (!inscription) return <div className="p-6">Chargement...</div>;

  const champs = [
    "nom", "prenom", "genre", "date_naissance", "nationalite",
    "email", "telephone", "adresse", "adresse_complement",
    "code_postal", "ville", "pays", "apparaitre_resultats",
    "club", "justificatif_type", "contact_urgence_nom",
    "contact_urgence_telephone", "statut", "created_at",
    "numero_licence", "updated_at", "dossard", "nombre_repas", "prix_total_repas"
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-black rounded"
      >
        ← Retour
      </button>
      <h2 className="text-2xl font-bold mb-4">Détails du coureur</h2>
      <table className="w-full table-auto border border-gray-300">
        <tbody>
          {champs.map((champ) => (
            <tr key={champ}>
              <td className="border px-2 py-1 font-semibold capitalize">{champ.replace(/_/g, " ")}</td>
              <td className="border px-2 py-1">
                {champ === "apparaitre_resultats" ? (
                  <input
                    type="checkbox"
                    checked={!!inscription[champ]}
                    onChange={(e) => handleChange(champ, e.target.checked)}
                  />
                ) : champ === "created_at" || champ === "updated_at" ? (
                  <span>{inscription[champ] || "—"}</span>
                ) : (
                  <input
                    type={champ.includes("date") ? "date" : "text"}
                    value={inscription[champ] || ""}
                    onChange={(e) => handleChange(champ, e.target.value)}
                    className="w-full px-2 py-1 border rounded"
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
