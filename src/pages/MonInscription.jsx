import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import CalculCreditAnnulation from "../components/CalculCreditAnnulation";

export default function MonInscription() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [inscription, setInscription] = useState(null);
  const [format, setFormat] = useState(null);
  const [credit, setCredit] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // Récupérer inscription
      const { data: insc, error } = await supabase
        .from("inscriptions")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !insc) return setLoading(false);
      setInscription(insc);

      // Récupérer format
      const { data: fmt } = await supabase
        .from("formats")
        .select("*")
        .eq("id", insc.format_id)
        .single();

      setFormat(fmt);

      // Si annulée, récupérer crédit
      if (insc.statut === "annulé") {
        const { data: cred } = await supabase
          .from("credits_annulation")
          .select("*")
          .eq("inscription_id", insc.id)
          .single();
        setCredit(cred);
      }

      setLoading(false);
    };

    fetchData();
  }, [id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setInscription({
      ...inscription,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleSave = async () => {
    await supabase.from("inscriptions").update(inscription).eq("id", id);
    alert("Modifications enregistrées");
  };

  const handleCancel = async () => {
    await supabase
      .from("inscriptions")
      .update({ statut: "annulé" })
      .eq("id", id);
    alert("Inscription annulée");
    navigate("/mes-inscriptions");
  };

  if (loading || !inscription) return <p>Chargement...</p>;

  const prixInscription =
    (inscription.prix_total_coureur || 0) -
    (inscription.prix_total_repas || 0);

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Modifier mon inscription</h1>

      <div className="space-y-2">
        {/* Champs modifiables */}
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
            placeholder={field.replace(/_/g, " ")}
            className="w-full p-2 border rounded"
          />
        ))}

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            name="apparaitre_resultats"
            checked={inscription.apparaitre_resultats}
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
          className="w-full p-2 border rounded"
        />

        {/* ✅ Encadré simulation si NON annulé */}
        {inscription.statut !== "annulé" && (
          <CalculCreditAnnulation
            formatDate={format?.date}
            prixInscription={prixInscription}
            prixRepas={inscription.prix_total_repas || 0}
          />
        )}

        {/* ✅ Affichage du crédit réel si annulé */}
        {inscription.statut === "annulé" && credit && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 p-4 rounded">
            <p className="font-semibold mb-2">💰 Crédit généré suite à l’annulation :</p>
            <ul className="list-disc list-inside">
              <li>
                Remboursement repas :{" "}
                <strong>{credit.montant_rembourse_repas.toFixed(2)} €</strong>
              </li>
              <li>
                Remboursement partiel inscription :{" "}
                <strong>{credit.montant_rembourse_inscription.toFixed(2)} €</strong>
              </li>
              <li>
                Frais retenus :{" "}
                <strong>{credit.frais_tickrace.toFixed(2)} €</strong>
              </li>
              <li>
                Crédit total :{" "}
                <strong>{credit.credit_total.toFixed(2)} €</strong>
              </li>
            </ul>
          </div>
        )}

        <div className="flex space-x-4 mt-4">
          <button
            onClick={handleSave}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Enregistrer
          </button>
          {inscription.statut !== "annulé" && (
            <button
              onClick={handleCancel}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Annuler mon inscription
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
