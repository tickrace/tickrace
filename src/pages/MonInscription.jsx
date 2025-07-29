import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

export default function MonInscription() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [inscription, setInscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [club, setClub] = useState("");
  const [apparaitreResultats, setApparaitreResultats] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchInscription = async () => {
      const { data, error } = await supabase
        .from("inscriptions")
        .select("*, format:formats(*, course:courses(*))")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Erreur de chargement :", error);
        setMessage("Erreur lors du chargement.");
      } else {
        setInscription(data);
        setClub(data.club || "");
        setApparaitreResultats(data.apparaitre_resultats ?? true);
      }
      setLoading(false);
    };

    fetchInscription();
  }, [id]);

  const handleUpdate = async () => {
    const { error } = await supabase
      .from("inscriptions")
      .update({
        club,
        apparaitre_resultats: apparaitreResultats,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      setMessage("Erreur lors de la mise à jour.");
    } else {
      setMessage("Inscription mise à jour avec succès.");
    }
  };

  const handleCancel = async () => {
    const confirm = window.confirm("Confirmer l'annulation de cette inscription ?");
    if (!confirm) return;

    const { error } = await supabase
      .from("inscriptions")
      .update({ statut: "annulé", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      setMessage("Erreur lors de l'annulation.");
    } else {
      navigate("/mes-inscriptions");
    }
  };

  if (loading) return <p className="p-4">Chargement...</p>;
  if (!inscription) return <p className="p-4 text-red-500">Inscription introuvable.</p>;

  const { format } = inscription;
  const course = format?.course;

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Modifier mon inscription</h1>

      {message && <p className="mb-4 text-sm text-blue-600">{message}</p>}

      <div className="mb-4">
        <strong>Course :</strong> {course?.nom} — {course?.lieu}
      </div>
      <div className="mb-4">
        <strong>Format :</strong> {format?.nom} ({format?.distance_km} km / {format?.denivele_dplus} m D+)
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium">Club :</label>
        <input
          type="text"
          value={club}
          onChange={(e) => setClub(e.target.value)}
          className="mt-1 block w-full border px-3 py-2 rounded"
        />
      </div>
      <div className="mb-4">
        <label className="inline-flex items-center">
          <input
            type="checkbox"
            checked={apparaitreResultats}
            onChange={(e) => setApparaitreResultats(e.target.checked)}
            className="mr-2"
          />
          Afficher mon nom dans les résultats publics
        </label>
      </div>

      <div className="flex gap-4">
        <button
          onClick={handleUpdate}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Enregistrer
        </button>
        <button
          onClick={handleCancel}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Annuler mon inscription
        </button>
      </div>
    </div>
  );
}
