// src/components/ModalAjoutCoureur.jsx

import React, { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { X } from "lucide-react";

export default function ModalAjoutCoureur({
  isOpen,
  onClose,
  format,
  defaultCourseId,
  onSaved,
}) {
  const prixRepasFormat = format?.prix_repas ?? 0;

  const [form, setForm] = useState({
    nom: "",
    prenom: "",
    email: "",
    genre: "",
    date_naissance: "",
    nationalite: "",
    telephone: "",
    adresse: "",
    adresse_complement: "",
    code_postal: "",
    ville: "",
    pays: "",
    apparaitre_resultats: true,
    club: "",
    justificatif_type: "",
    numero_licence: "",
    pps_identifier: "",
    contact_urgence_nom: "",
    contact_urgence_telephone: "",
    statut: "en attente",
    dossard: "",
    nombre_repas: 0,
    prix_total_repas: 0,
  });

  useEffect(() => {
    if (isOpen) {
      setForm({
        nom: "",
        prenom: "",
        email: "",
        genre: "",
        date_naissance: "",
        nationalite: "",
        telephone: "",
        adresse: "",
        adresse_complement: "",
        code_postal: "",
        ville: "",
        pays: "",
        apparaitre_resultats: true,
        club: "",
        justificatif_type: "",
        numero_licence: "",
        pps_identifier: "",
        contact_urgence_nom: "",
        contact_urgence_telephone: "",
        statut: "en attente",
        dossard: "",
        nombre_repas: 0,
        prix_total_repas: 0,
      });
    }
  }, [isOpen]);

  const setField = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "nombre_repas") {
        const n = parseInt(value, 10) || 0;
        next.nombre_repas = n;
        next.prix_total_repas = n * prixRepasFormat;
      }
      return next;
    });
  };

  const valider = async () => {
    if (!form.nom.trim() || !form.prenom.trim()) {
      alert("Nom et prénom sont obligatoires.");
      return;
    }
    if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) {
      alert("Email invalide.");
      return;
    }

    const payload = {
      ...form,
      dossard: form.dossard === "" ? null : Number(form.dossard),
      course_id: defaultCourseId ?? format?.course_id ?? null,
      format_id: format?.id ?? null,
      prix_total_repas: form.prix_total_repas || 0,
    };

    // 🔐 suppression forcée de coureur_id
    delete payload.coureur_id;

    console.log("Payload final à insérer :", payload); // debug

    const { error } = await supabase.from("inscriptions").insert([payload]);
    if (error) {
      console.error("Erreur insert inscription :", error);
      alert("Erreur lors de l'enregistrement.");
      return;
    }

    onClose();
    onSaved?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-black"
        >
          <X />
        </button>

        <h2 className="text-xl font-semibold mb-4">
          Ajouter un coureur – {format?.nom || "Format"}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <Field label="Nom *"><input type="text" value={form.nom} onChange={(e) => setField("nom", e.target.value)} className="w-full border px-2 py-1 rounded" /></Field>
          <Field label="Prénom *"><input type="text" value={form.prenom} onChange={(e) => setField("prenom", e.target.value)} className="w-full border px-2 py-1 rounded" /></Field>
          <Field label="Email"><input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} className="w-full border px-2 py-1 rounded" /></Field>
          <Field label="Genre"><input type="text" value={form.genre} onChange={(e) => setField("genre", e.target.value)} className="w-full border px-2 py-1 rounded" /></Field>
          <Field label="Date de naissance"><input type="date" value={form.date_naissance} onChange={(e) => setField("date_naissance", e.target.value)} className="w-full border px-2 py-1 rounded" /></Field>
          <Field label="Nationalité"><input type="text" value={form.nationalite} onChange={(e) => setField("nationalite", e.target.value)} className="w-full border px-2 py-1 rounded" /></Field>
          <Field label="Téléphone"><input type="text" value={form.telephone} onChange={(e) => setField("telephone", e.target.value)} className="w-full border px-2 py-1 rounded" /></Field>
          <Field label="Adresse"><input type="text" value={form.adresse} onChange={(e) => setField("adresse", e.target.value)} className="w-full border px-2 py-1 rounded" /></Field>
          <Field label="Adresse complément"><input type="text" value={form.adresse_complement} onChange={(e) => setField("adresse_complement", e.target.value)} className="w-full border px-2 py-1 rounded" /></Field>
          <Field label="Code postal"><input type="text" value={form.code_postal} onChange={(e) => setField("code_postal", e.target.value)} className="w-full border px-2 py-1 rounded" /></Field>
          <Field label="Ville"><input type="text" value={form.ville} onChange={(e) => setField("ville", e.target.value)} className="w-full border px-2 py-1 rounded" /></Field>
          <Field label="Pays"><input type="text" value={form.pays} onChange={(e) => setField("pays", e.target.value)} className="w-full border px-2 py-1 rounded" /></Field>
          <Field label="Club"><input type="text" value={form.club} onChange={(e) => setField("club", e.target.value)} className="w-full border px-2 py-1 rounded" /></Field>

          <Field label="Justificatif">
            <select value={form.justificatif_type} onChange={(e) => setField("justificatif_type", e.target.value)} className="w-full border px-2 py-1 rounded">
              <option value="">-- Sélectionnez --</option>
              <option value="licence">Licence</option>
              <option value="pps">PPS</option>
            </select>
          </Field>

          {form.justificatif_type === "licence" && (
            <Field label="Numéro de licence">
              <input type="text" value={form.numero_licence} onChange={(e) => setField("numero_licence", e.target.value)} className="w-full border px-2 py-1 rounded" />
            </Field>
          )}

          {form.justificatif_type === "pps" && (
            <Field label="Identifiant PPS">
              <input type="text" value={form.pps_identifier} onChange={(e) => setField("pps_identifier", e.target.value)} className="w-full border px-2 py-1 rounded" />
            </Field>
          )}

          <Field label="Contact urgence - Nom"><input type="text" value={form.contact_urgence_nom} onChange={(e) => setField("contact_urgence_nom", e.target.value)} className="w-full border px-2 py-1 rounded" /></Field>
          <Field label="Contact urgence - Téléphone"><input type="text" value={form.contact_urgence_telephone} onChange={(e) => setField("contact_urgence_telephone", e.target.value)} className="w-full border px-2 py-1 rounded" /></Field>

          <Field label="Statut">
            <select value={form.statut} onChange={(e) => setField("statut", e.target.value)} className="w-full border px-2 py-1 rounded">
              <option value="en attente">En attente</option>
              <option value="validée">Validée</option>
              <option value="refusée">Refusée</option>
            </select>
          </Field>

          <Field label="Dossard"><input type="number" value={form.dossard} onChange={(e) => setField("dossard", e.target.value)} className="w-full border px-2 py-1 rounded" /></Field>
          <Field label="Nombre de repas"><input type="number" min={0} value={form.nombre_repas} onChange={(e) => setField("nombre_repas", e.target.value)} className="w-full border px-2 py-1 rounded" /></Field>
          <Field label="Prix total repas (€)"><input type="number" value={form.prix_total_repas} readOnly className="w-full border px-2 py-1 rounded bg-gray-100 text-gray-700 cursor-not-allowed" /></Field>
        </div>

        <div className="flex items-center mt-4 mb-4">
          <input id="apparaitre_results" type="checkbox" checked={form.apparaitre_resultats} onChange={(e) => setField("apparaitre_resultats", e.target.checked)} className="mr-2" />
          <label htmlFor="apparaitre_results" className="text-sm">Apparaître dans les résultats publics.</label>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded border bg-gray-100 hover:bg-gray-200 text-sm">Annuler</button>
          <button onClick={valider} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-600">{label}</span>
      {children}
    </label>
  );
}
