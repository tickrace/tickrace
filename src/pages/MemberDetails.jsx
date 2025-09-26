// src/pages/MemberDetails.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";

export default function MemberDetails() {
  const navigate = useNavigate();
  const { courseId, formatId, teamIdx, memberIdx } = useParams();

  // Clé du brouillon alignée avec InscriptionCourse
  const draftKey = useMemo(() => {
    if (!courseId || !formatId) return null;
    return `tickrace_member_draft_${courseId}_${formatId}_${teamIdx}_${memberIdx}`;
  }, [courseId, formatId, teamIdx, memberIdx]);

  const [draft, setDraft] = useState(null);
  const [notFound, setNotFound] = useState(false);

  // Champs étendus (mappés sur la table inscriptions)
  const [form, setForm] = useState({
    nom: "",
    prenom: "",
    genre: "",
    date_naissance: "",
    email: "",
    nationalite: "",
    telephone: "",
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
    try {
      if (!draftKey) return;
      const raw = localStorage.getItem(draftKey);
      if (!raw) {
        setNotFound(true);
        return;
      }
      const parsed = JSON.parse(raw);
      setDraft(parsed);

      // Préremplir depuis le membre si dispo
      const m = parsed?.member || {};
      setForm((prev) => ({
        ...prev,
        nom: m.nom || "",
        prenom: m.prenom || "",
        genre: m.genre || "",
        date_naissance: m.date_naissance || "",
        email: m.email || "",
        // le reste reste vide par défaut
      }));
    } catch {
      setNotFound(true);
    }
  }, [draftKey]);

  function setField(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  function saveDraft() {
    if (!draftKey || !draft) return;
    const next = {
      ...draft,
      // on garde teamIdx/memberIdx dans le draft
      teamIdx: Number(teamIdx),
      memberIdx: Number(memberIdx),
      // on fusionne les champs étendus sous une clé "extended"
      extended: { ...(draft.extended || {}), [memberIdx]: { ...form } },
      // on met aussi à jour le snapshot direct du membre pour visibilité
      member: { ...(draft.member || {}), ...form },
    };
    localStorage.setItem(draftKey, JSON.stringify(next));
  }

  function handleSaveAndBack() {
    saveDraft();
    // Retour à l’inscription de la course
    navigate(`/inscription/${courseId}`);
  }

  if (notFound) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <h1 className="text-xl font-bold mb-2">Brouillon introuvable</h1>
          <p className="text-neutral-700">
            Fermez cette page et réessayez depuis l’inscription (bouton “Ajouter des détails”).
          </p>
          <div className="mt-4">
            <Link
              to={`/inscription/${courseId || ""}`}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm hover:bg-neutral-50"
            >
              ← Retourner à l’inscription
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-neutral-600">
        Chargement…
      </div>
    );
  }

  const title = draft?.teamName
    ? `Détails — ${draft.teamName} · Coureur #${Number(memberIdx) + 1}`
    : `Détails coureur #${Number(memberIdx) + 1}`;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-4">
        <Link
          to={`/inscription/${courseId}`}
          className="text-sm text-neutral-500 hover:text-neutral-800"
        >
          ← Retour à l’inscription
        </Link>
      </div>

      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-neutral-600 mt-1">
        Complète les informations optionnelles du coureur. Tes saisies sont enregistrées dans ton navigateur
        et seront reprises lors du paiement.
      </p>

      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Nom" name="nom" value={form.nom} onChange={setField} />
          <Input label="Prénom" name="prenom" value={form.prenom} onChange={setField} />
          <Select
            label="Genre"
            name="genre"
            value={form.genre}
            onChange={setField}
            options={[
              { label: "—", value: "" },
              { label: "Homme", value: "Homme" },
              { label: "Femme", value: "Femme" },
            ]}
          />
          <Input
            label="Date de naissance"
            name="date_naissance"
            type="date"
            value={form.date_naissance}
            onChange={setField}
          />
          <Input label="Email" name="email" type="email" value={form.email} onChange={setField} />
          <Input label="Nationalité" name="nationalite" value={form.nationalite} onChange={setField} />
          <Input label="Téléphone" name="telephone" value={form.telephone} onChange={setField} />
          <Input label="Adresse" name="adresse" value={form.adresse} onChange={setField} full />
          <Input label="Complément d’adresse" name="adresse_complement" value={form.adresse_complement} onChange={setField} full />
          <Input label="Code postal" name="code_postal" value={form.code_postal} onChange={setField} />
          <Input label="Ville" name="ville" value={form.ville} onChange={setField} />
          <Input label="Pays" name="pays" value={form.pays} onChange={setField} />
          <Input label="Club" name="club" value={form.club} onChange={setField} />
          <Input label="Justificatif (licence / pps)" name="justificatif_type" value={form.justificatif_type} onChange={setField} />
          <Input label="N° de licence" name="numero_licence" value={form.numero_licence} onChange={setField} />
          <Input label="Identifiant PPS" name="pps_identifier" value={form.pps_identifier} onChange={setField} />
          <Input label="Urgence — Nom" name="contact_urgence_nom" value={form.contact_urgence_nom} onChange={setField} full />
          <Input label="Urgence — Téléphone" name="contact_urgence_telephone" value={form.contact_urgence_telephone} onChange={setField} />
        </div>

        <div className="pt-2">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!form.apparaitre_resultats}
              onChange={(e) => setField("apparaitre_resultats", e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 accent-orange-500"
            />
            <span className="text-neutral-800">
              J’accepte d’apparaître dans les résultats officiels
            </span>
          </label>
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        <button
          onClick={() => { saveDraft(); }}
          className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
        >
          Enregistrer le brouillon
        </button>
        <button
          onClick={handleSaveAndBack}
          className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
        >
          Enregistrer et revenir à l’inscription
        </button>
      </div>
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

function Select({ label, name, value, onChange, options = [] }) {
  return (
    <label className="flex flex-col">
      <span className="text-xs font-semibold text-neutral-600">{label}</span>
      <select
        value={value || ""}
        onChange={(e) => onChange(name, e.target.value)}
        className="mt-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </label>
  );
}
