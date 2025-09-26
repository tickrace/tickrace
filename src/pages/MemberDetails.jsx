// src/pages/MemberDetails.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

function useDraft() {
  const location = useLocation();
  const sp = new URLSearchParams(location.search);
  const draftId = sp.get("draft") || "";
  const key = draftId ? `tickrace_member_draft_${draftId}` : null;

  const raw = key ? localStorage.getItem(key) : null;
  const draft = useMemo(() => {
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [raw]);

  return { draftId, key, draft };
}

export default function MemberDetails() {
  const navigate = useNavigate();
  const { draftId, key, draft } = useDraft();

  const [member, setMember] = useState({
    nom: "",
    prenom: "",
    genre: "",
    date_naissance: "",
    email: "",
    telephone: "",
    nationalite: "",
    adresse: "",
    adresse_complement: "",
    code_postal: "",
    ville: "",
    pays: "",
    club: "",
    justificatif_type: "",
    numero_licence: "",
    pps_identifier: "",
    contact_urgence_nom: "",
    contact_urgence_telephone: "",
    apparaitre_resultats: true,
  });

  useEffect(() => {
    if (draft?.member) {
      setMember((prev) => ({ ...prev, ...draft.member }));
    }
  }, [draft]);

  if (!draftId || !key || !draft) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-neutral-700">
        Brouillon introuvable. Fermez cette page et réessayez depuis l’inscription.
        <div className="mt-4">
          <button
            onClick={() => navigate(-1)}
            className="rounded-xl border px-4 py-2 text-sm"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  const setField = (name, value) => {
    setMember((p) => ({ ...p, [name]: value }));
  };

  const handleSave = () => {
    const updated = {
      ...draft,
      member: { ...member },
      updatedAt: new Date().toISOString(),
    };
    // Écrit le draft (déclenchera un event "storage" dans l’autre onglet/onglet courant lors du retour)
    localStorage.setItem(key, JSON.stringify(updated));
    // Retour à la page précédente (InscriptionCourse)
    navigate(-1);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-8 py-8">
      <header className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-neutral-900 text-white ring-1 ring-black/10 px-3 py-1 text-xs">
          • Détails du coureur
        </div>
        <h1 className="mt-3 text-2xl sm:text-3xl font-black tracking-tight">
          Compléter le profil du membre
        </h1>
        <p className="text-neutral-600 mt-1">
          Ces informations seront recopiées dans l’équipe à ton retour.
        </p>
      </header>

      <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="p-5 border-b border-neutral-100">
          <h2 className="text-lg font-semibold">
            {draft?.teamName ? `Équipe : ${draft.teamName}` : "Équipe"}
            {" • "}
            Membre #{(Number(draft?.memberIdx) ?? 0) + 1}
          </h2>
          <p className="text-sm text-neutral-500">
            Course {draft?.courseId?.slice(0, 8)}… — Format {draft?.formatId?.slice(0, 8)}…
          </p>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="Nom" name="nom" value={member.nom} onChange={setField} />
            <Input label="Prénom" name="prenom" value={member.prenom} onChange={setField} />
            <Select
              label="Genre"
              name="genre"
              value={member.genre}
              onChange={setField}
              options={[
                { value: "", label: "—" },
                { value: "Homme", label: "Homme" },
                { value: "Femme", label: "Femme" },
              ]}
            />
            <Input
              label="Date de naissance"
              name="date_naissance"
              type="date"
              value={member.date_naissance || ""}
              onChange={setField}
            />
            <Input label="Nationalité" name="nationalite" value={member.nationalite || ""} onChange={setField} />
            <Input label="Email" name="email" type="email" value={member.email || ""} onChange={setField} />
            <Input label="Téléphone" name="telephone" value={member.telephone || ""} onChange={setField} />
            <Input label="Adresse" name="adresse" value={member.adresse || ""} onChange={setField} full />
            <Input label="Complément d'adresse" name="adresse_complement" value={member.adresse_complement || ""} onChange={setField} full />
            <Input label="Code postal" name="code_postal" value={member.code_postal || ""} onChange={setField} />
            <Input label="Ville" name="ville" value={member.ville || ""} onChange={setField} />
            <Input label="Pays" name="pays" value={member.pays || ""} onChange={setField} />
            <Input label="Club" name="club" value={member.club || ""} onChange={setField} />
            <Input label="Type justificatif (licence/PPS)" name="justificatif_type" value={member.justificatif_type || ""} onChange={setField} />
            <Input label="N° licence" name="numero_licence" value={member.numero_licence || ""} onChange={setField} />
            <Input label="Identifiant PPS" name="pps_identifier" value={member.pps_identifier || ""} onChange={setField} />
            <Input label="Contact urgence - Nom" name="contact_urgence_nom" value={member.contact_urgence_nom || ""} onChange={setField} />
            <Input label="Contact urgence - Téléphone" name="contact_urgence_telephone" value={member.contact_urgence_telephone || ""} onChange={setField} />
          </div>

          <div className="flex items-center gap-2 text-sm">
            <input
              id="appear"
              type="checkbox"
              checked={!!member.apparaitre_resultats}
              onChange={(e) => setField("apparaitre_resultats", e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 accent-orange-500"
            />
            <label htmlFor="appear" className="text-neutral-800">
              Apparaître dans les résultats officiels
            </label>
          </div>
        </div>

        <div className="p-5 border-t border-neutral-100 flex items-center justify-end gap-2">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white bg-orange-500 hover:brightness-110"
          >
            Enregistrer et revenir
          </button>
        </div>
      </section>
    </div>
  );
}

function Input({ label, name, value, onChange, type = "text", full = false }) {
  return (
    <label className={`flex flex-col ${full ? "md:col-span-2" : ""}`}>
      <span className="text-xs font-semibold text-neutral-600">{label}</span>
      <input
        type={type}
        value={value || ""}
        onChange={(e) => onChange(name, e.target.value)}
        className="mt-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
        placeholder={label}
      />
    </label>
  );
}

function Select({ label, name, value, onChange, options }) {
  return (
    <label className="flex flex-col">
      <span className="text-xs font-semibold text-neutral-600">{label}</span>
      <select
        value={value || ""}
        onChange={(e) => onChange(name, e.target.value)}
        className="mt-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
