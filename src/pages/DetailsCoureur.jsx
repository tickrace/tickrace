import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

export default function DetailsCoureur() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [coureur, setCoureur] = useState(null);

  useEffect(() => {
    if (id) fetchCoureur();
  }, [id]);

  const fetchCoureur = async () => {
    const { data, error } = await supabase
      .from("inscriptions")
      .select("*")
      .eq("id", id)
      .single();

    if (!error) setCoureur(data);
  };

  const handleChange = async (e, field) => {
    const value =
      e.target.type === "checkbox" ? e.target.checked : e.target.value;
    const updated = { ...coureur, [field]: value };
    setCoureur(updated);
    await supabase
      .from("inscriptions")
      .update({ [field]: value })
      .eq("id", coureur.id);
  };

  if (!coureur) return <div>Chargement...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Détails du coureur</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(coureur).map(([key, value]) => (
          <div key={key}>
            <label className="block text-sm font-medium">{key}</label>
            {typeof value === "boolean" ? (
              <input
                type="checkbox"
                checked={value}
                onChange={(e) => handleChange(e, key)}
              />
            ) : (
              <input
                type="text"
                value={value ?? ""}
                onChange={(e) => handleChange(e, key)}
                className="w-full border border-gray-300 rounded px-2 py-1"
              />
            )}
          </div>
        ))}
      </div>
      <button
        onClick={() => navigate(-1)}
        className="mt-6 bg-gray-500 text-white px-4 py-2 rounded"
      >
        Retour
      </button>
    </div>
  );
}
