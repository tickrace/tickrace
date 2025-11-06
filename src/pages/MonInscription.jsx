// src/pages/MonInscription.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import toast from "react-hot-toast";

export default function MonInscription() {
  const { id } = useParams(); // UUID de l’inscription
  const navigate = useNavigate();
  const [inscription, setInscription] = useState(null);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    fetchInscription();
    // eslint-disable-next-line
  }, [id]);

  async function fetchInscription() {
    try {
      setLoading(true);

      // 🔸 On récupère l’inscription seule
      const { data: insc, error: errInsc } = await supabase
        .from("inscriptions")
        .select("*")
        .eq("id", id)
        .single();
      if (errInsc) throw errInsc;

      // 🔸 On récupère le format
      const { data: format } = await supabase
        .from("formats")
        .select("id, nom, date, heure_depart, distance_km, denivele_dplus, type_format, prix, prix_equipe")
        .eq("id", insc.format_id)
        .single();

      // 🔸 On récupère la course
      const { data: course } = await supabase
        .from("courses")
        .select("id, nom, lieu, departement")
        .eq("id", insc.course_id)
        .single();

      // 🔸 On récupère les options liées à cette inscription
      const { data: opts } = await supabase
        .from("inscriptions_options")
        .select("option_label, quantity, prix_unitaire_cents")
        .eq("inscription_id", id);

      setInscription({
        ...insc,
        course,
        format,
      });
      setOptions(opts || []);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors du chargement de l’inscription.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    try {
      const confirm = window.confirm(
        "Confirmer l’annulation ? Cette action est irréversible."
      );
      if (!confirm) return;

      setCancelling(true);

      const { data, error } = await supabase.rpc(
        "calculer_credit_annulation",
        { inscription_id: id } // ✅ bon paramètre
      );

      if (error) throw error;

      toast.success("Annulation effectuée. Crédit créé.");
      await fetchInscription();
    } catch (err) {
      console.error(err);
      toast.error("Annulation impossible : " + err.message);
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-neutral-700">
        Chargement…
      </div>
    );
  }

  if (!inscription) {
    return (
      <div className="min-h-screen flex items-center justify-center text-neutral-700">
        Inscription introuvable.
      </div>
    );
  }

  const totalOptionsEur = options.reduce(
    (sum, o) => sum + (o.prix_unitaire_cents || 0) * (o.quantity || 0),
    0
  ) / 100;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Header */}
      <section className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <h1 className="text-3xl font-black">
            Mon inscription{" "}
            <span className="text-orange-600">Tick</span>
            <span className="text-neutral-900">Race</span>
          </h1>
          <p className="text-sm text-neutral-600 mt-1">
            Détails et suivi de votre inscription.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 py-8 space-y-8">
        {/* Informations générales */}
        <div className="rounded-2xl bg-white shadow ring-1 ring-neutral-200 p-6">
          <h2 className="text-lg font-bold mb-4">Informations générales</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-semibold">Épreuve :</span>{" "}
              {inscription.course?.nom || "—"}
            </div>
            <div>
              <span className="font-semibold">Lieu :</span>{" "}
              {inscription.course?.lieu || "—"}{" "}
              {inscription.course?.departement && (
                <>({inscription.course.departement})</>
              )}
            </div>
            <div>
              <span className="font-semibold">Format :</span>{" "}
              {inscription.format?.nom || "—"}
            </div>
            <div>
              <span className="font-semibold">Date :</span>{" "}
              {inscription.format?.date
                ? new Date(inscription.format.date).toLocaleDateString("fr-FR")
                : "—"}
            </div>
            <div>
              <span className="font-semibold">Statut :</span>{" "}
              <span
                className={`font-semibold ${
                  inscription.statut === "annulé"
                    ? "text-rose-600"
                    : inscription.statut === "validé"
                    ? "text-emerald-600"
                    : "text-neutral-600"
                }`}
              >
                {inscription.statut}
              </span>
            </div>
            <div>
              <span className="font-semibold">Numéro de dossard :</span>{" "}
              {inscription.dossard || "—"}
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="rounded-2xl bg-white shadow ring-1 ring-neutral-200 p-6">
          <h2 className="text-lg font-bold mb-4">Options sélectionnées</h2>
          {options.length === 0 ? (
            <p className="text-neutral-600 text-sm">
              Aucune option sélectionnée.
            </p>
          ) : (
            <table className="w-full text-sm border-t border-neutral-200">
              <thead>
                <tr className="text-left text-neutral-700 border-b border-neutral-200">
                  <th className="py-2">Option</th>
                  <th className="py-2 text-center">Quantité</th>
                  <th className="py-2 text-right">Prix</th>
                </tr>
              </thead>
              <tbody>
                {options.map((opt, i) => (
                  <tr key={i} className="border-b border-neutral-100">
                    <td className="py-2">{opt.option_label}</td>
                    <td className="py-2 text-center">{opt.quantity}</td>
                    <td className="py-2 text-right">
                      {(opt.prix_unitaire_cents / 100).toFixed(2)} €
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td></td>
                  <td className="py-2 font-semibold text-right">Total :</td>
                  <td className="py-2 font-semibold text-right">
                    {totalOptionsEur.toFixed(2)} €
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Bouton Annulation */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => navigate(-1)}
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-50"
          >
            ← Retour
          </button>

          <button
            onClick={handleCancel}
            disabled={cancelling || inscription.statut === "annulé"}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${
              inscription.statut === "annulé"
                ? "bg-neutral-400 cursor-not-allowed"
                : "bg-rose-600 hover:bg-rose-700"
            }`}
          >
            {cancelling ? "Annulation…" : "🗑️ Annuler l’inscription"}
          </button>
        </div>
      </div>
    </div>
  );
}
