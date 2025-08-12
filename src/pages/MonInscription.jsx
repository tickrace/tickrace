// src/pages/MonInscription.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";
import CalculCreditAnnulation from "../components/CalculCreditAnnulation";

export default function MonInscription() {
  const { id } = useParams();
  const [inscription, setInscription] = useState(null);
  const [format, setFormat] = useState(null);
  const [loading, setLoading] = useState(true);

  const [openCancelModal, setOpenCancelModal] = useState(false);

  useEffect(() => {
    let abort = false;

    async function fetchInscription() {
      setLoading(true);
      const { data, error } = await supabase
        .from("inscriptions")
        .select("*")
        .eq("id", id)
        .single();

      if (!abort) {
        if (!error && data) setInscription(data);
        setLoading(false);
      }
    }

    fetchInscription();
    return () => { abort = true; };
  }, [id]);

  useEffect(() => {
    let abort = false;

    async function fetchFormat() {
      if (!inscription?.format_id) return;
      const { data, error } = await supabase
        .from("formats")
        .select("id, date, prix")
        .eq("id", inscription.format_id)
        .single();

      if (!abort && !error) setFormat(data);
    }

    fetchFormat();
    return () => { abort = true; };
  }, [inscription]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setInscription((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSave = async () => {
    if (!inscription) return;
    await supabase.from("inscriptions").update(inscription).eq("id", id);
    alert("Modifications enregistrées");
  };

  const canCancel =
    inscription &&
    inscription.statut !== "annulé" &&
    inscription.statut !== "remboursé";

  if (loading || !inscription) return <p className="p-6">Chargement...</p>;

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white shadow-md rounded">
      <h1 className="text-3xl font-bold mb-2 text-center text-gray-800">
        Modifier mon inscription
      </h1>

      <p
        className={`text-center text-sm mb-6 font-medium ${
          inscription.statut === "annulé" || inscription.statut === "remboursé"
            ? "text-red-600"
            : "text-green-600"
        }`}
      >
        Statut de l’inscription : {inscription.statut}
      </p>

      <div className="grid grid-cols-1 gap-4">
        {[
          "nom",
          "prenom",
          "genre",
          "date_naissance",
          "nationalite",
          "email",
          "telephone",
          "adresse",
          "adresse_complement",
          "code_postal",
          "ville",
          "pays",
          "club",
          "justificatif_type",
          "numero_licence",
          "contact_urgence_nom",
          "contact_urgence_telephone",
          "pps_identifier",
        ].map((field) => (
          <input
            key={field}
            type="text"
            name={field}
            value={inscription[field] || ""}
            onChange={handleChange}
            placeholder={field.replace(/_/g, " ").toUpperCase()}
            className="w-full p-3 border border-gray-300 rounded"
          />
        ))}

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            name="apparaitre_resultats"
            checked={!!inscription.apparaitre_resultats}
            onChange={handleChange}
          />
          <label>Apparaître dans les résultats</label>
        </div>

        <input
          type="number"
          name="nombre_repas"
          value={inscription.nombre_repas || 0}
          onChange={handleChange}
          placeholder="Nombre de repas"
          className="w-full p-3 border border-gray-300 rounded"
        />

        {/* NOTE : l’ancien "CalculCreditAnnulation" en simulation avec des props prix/date
           n’est plus nécessaire. Le nouveau composant gère tout via l’inscriptionId
           et fait l’aperçu + confirmation dans une modale. */}
      </div>

      <div className="flex justify-center gap-3 mt-6">
        <button
          onClick={handleSave}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded"
        >
          Enregistrer les modifications
        </button>

        {canCancel ? (
          <button
            onClick={() => setOpenCancelModal(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-3 rounded"
          >
            Annuler & rembourser (95 %)
          </button>
        ) : (
          <p className="text-red-600 font-semibold self-center">
            Cette inscription est déjà {inscription.statut}.
          </p>
        )}
      </div>

      {/* Modal Annulation + Remboursement */}
      {openCancelModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white shadow-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Annulation & remboursement</h3>
              <button
                onClick={() => setOpenCancelModal(false)}
                className="px-2 py-1 rounded hover:bg-gray-100"
                aria-label="Fermer"
                title="Fermer"
              >
                ✕
              </button>
            </div>

            {/* Le composant gère l’aperçu + appel RPC + Edge Function refund */}
            <CalculCreditAnnulation inscriptionId={id} />
          </div>
        </div>
      )}
    </div>
  );
}
