// src/pages/DetailsCoureur.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

const [receiptUrl, setReceiptUrl] = useState(null);
const [loadingReceipt, setLoadingReceipt] = useState(false);
const [receiptError, setReceiptError] = useState("");


export default function DetailsCoureur() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [inscription, setInscription] = useState(null);
  const [paiement, setPaiement] = useState(null);
  const [loadingPaiement, setLoadingPaiement] = useState(true);

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

  // ⚡ Dès qu’on a l’inscription, on charge le paiement via paiement_trace_id
  useEffect(() => {
    const fetchPaiement = async () => {
      if (!inscription) return;
      setLoadingPaiement(true);

      // Priorité au trace_id (lien propre 1↔1 ou 1↔N)
      if (inscription.paiement_trace_id) {
        const { data: payByTrace } = await supabase
          .from("paiements")
          .select("*")
          .eq("trace_id", inscription.paiement_trace_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (payByTrace) {
          setPaiement(payByTrace);
          setLoadingPaiement(false);
          return;
        }
      }

      // Fallback: ancien modèle, s’il n’y a pas de trace_id
      const { data: payByInscription } = await supabase
        .from("paiements")
        .select("*")
        .eq("inscription_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setPaiement(payByInscription || null);
      setLoadingPaiement(false);
    };

    fetchPaiement();
  }, [inscription, id]);

  const handleChange = async (field, value) => {
    const updated = { ...inscription, [field]: value };
    setInscription(updated);

    await supabase.from("inscriptions").update({ [field]: value }).eq("id", id);
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
              <td className="border px-2 py-1 font-semibold capitalize">
                {champ.replace(/_/g, " ")}
              </td>
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

      


{paiement && (
  <div className="mt-4 flex gap-3 items-center">
    {receiptUrl ? (
      <a
        href={receiptUrl}
        target="_blank"
        rel="noreferrer"
        className="px-3 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
      >
        Ouvrir le reçu Stripe
      </a>
    ) : (
      <button
        disabled={loadingReceipt}
        onClick={async () => {
          try {
            setLoadingReceipt(true);
            setReceiptError("");

            const { data, error } = await supabase.functions.invoke("get-receipt-url", {
              body: {
                // on donne tout ce qu'on a, la fonction s’en sortira
                inscription_id: id,
                trace_id: inscription.paiement_trace_id,
                payment_intent_id: paiement?.stripe_payment_intent_id,
              },
            });

            if (error) throw error;
            if (data?.receipt_url) {
              setReceiptUrl(data.receipt_url);
              // on peut aussi ouvrir direct:
              window.open(data.receipt_url, "_blank", "noopener,noreferrer");
            } else {
              setReceiptError("Reçu indisponible.");
            }
          } catch (e) {
            console.error(e);
            setReceiptError("Erreur lors de la récupération du reçu.");
          } finally {
            setLoadingReceipt(false);
          }
        }}
        className="px-3 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {loadingReceipt ? "Récupération…" : "Récupérer le reçu"}
      </button>
    )}
    {receiptError && <span className="text-red-600 text-sm">{receiptError}</span>}
  </div>
)}

      </div>
    
  );
}
