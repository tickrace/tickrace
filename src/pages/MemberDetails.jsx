// src/pages/MemberDetails.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";

// clé locale unique par course/format
const draftKey = (courseId, formatId) => `tickrace:draftTeams:${courseId}:${formatId}`;

function getDraft(courseId, formatId) {
  try { return JSON.parse(localStorage.getItem(draftKey(courseId, formatId)) || "null"); }
  catch { return null; }
}
function setDraft(courseId, formatId, value) {
  localStorage.setItem(draftKey(courseId, formatId), JSON.stringify(value));
}

export default function MemberDetails() {
  const { courseId, formatId, teamIdx: teamIdxStr, memberIdx: memberIdxStr } = useParams();
  const teamIdx = Number(teamIdxStr ?? 0);
  const memberIdx = Number(memberIdxStr ?? 0);
  const nav = useNavigate();

  const [teams, setTeams] = useState([]);
  const [member, setMember] = useState(null);

  useEffect(() => {
    const draft = getDraft(courseId, formatId) || [];
    setTeams(draft);
    const m = draft?.[teamIdx]?.members?.[memberIdx] || null;
    setMember(m ? { ...m } : {
      nom: "", prenom: "", genre: "", date_naissance: "", email: "",
      telephone: "", adresse: "", adresse_complement: "", code_postal: "",
      ville: "", pays: "", nationalite: "", club: "",
      justificatif_type: "", numero_licence: "", contact_urgence_nom: "",
      contact_urgence_telephone: "", pps_identifier: ""
    });
  }, [courseId, formatId, teamIdx, memberIdx]);

  const title = useMemo(() => {
    const teamName = teams?.[teamIdx]?.team_name || `Équipe ${teamIdx + 1}`;
    return `Détails du coureur — ${teamName} #${memberIdx + 1}`;
  }, [teams, teamIdx, memberIdx]);

  function setField(name, value) {
    setMember((prev) => ({ ...prev, [name]: value }));
  }

  function saveAndBack() {
    // merge dans le draft et sauver
    const draft = Array.isArray(teams) ? [...teams] : [];
    if (!draft[teamIdx]) return nav(-1);
    const team = { ...draft[teamIdx] };
    const members = Array.isArray(team.members) ? [...team.members] : [];
    members[memberIdx] = { ...(members[memberIdx] || {}), ...member };
    team.members = members;
    draft[teamIdx] = team;
    setDraft(courseId, formatId, draft);
    nav(-1);
  }

  if (!member) return (
    <div className="max-w-3xl mx-auto px-4 py-12 text-neutral-600">Chargement…</div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-4">
        <Link to={`/inscription/${courseId}`} className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Retour à l’inscription
        </Link>
      </div>

      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-neutral-600 mt-1">
        Ces informations seront utilisées pour la fiche coureur. Elles restent en brouillon tant que vous n’avez pas payé.
      </p>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
        <Input label="Nom" value={member.nom} onChange={(v) => setField("nom", v)} />
        <Input label="Prénom" value={member.prenom} onChange={(v) => setField("prenom", v)} />
        <Select
          label="Sexe"
          value={member.genre || ""}
          onChange={(v) => setField("genre", v)}
          options={[["", "Sélectionner"], ["Homme", "Homme"], ["Femme", "Femme"]]}
        />
        <Input label="Date de naissance" type="date" value={member.date_naissance || ""} onChange={(v) => setField("date_naissance", v)} />
        <Input label="Email" type="email" value={member.email || ""} onChange={(v) => setField("email", v)} />
        <Input label="Téléphone" value={member.telephone || ""} onChange={(v) => setField("telephone", v)} />
        <Input label="Adresse" value={member.adresse || ""} onChange={(v) => setField("adresse", v)} full />
        <Input label="Complément d’adresse" value={member.adresse_complement || ""} onChange={(v) => setField("adresse_complement", v)} full />
        <Input label="Code postal" value={member.code_postal || ""} onChange={(v) => setField("code_postal", v)} />
        <Input label="Ville" value={member.ville || ""} onChange={(v) => setField("ville", v)} />
        <Input label="Pays" value={member.pays || ""} onChange={(v) => setField("pays", v)} />
        <Input label="Nationalité" value={member.nationalite || ""} onChange={(v) => setField("nationalite", v)} />
        <Input label="Club" value={member.club || ""} onChange={(v) => setField("club", v)} full />
        <Select
          label="Justificatif"
          value={member.justificatif_type || ""}
          onChange={(v) => setField("justificatif_type", v)}
          options={[
            ["", "—"],
            ["licence", "Licence Fédérale"],
            ["pps", "Parcours Prévention Santé (PPS)"]
          ]}
        />
        <Input label="N° de licence" value={member.numero_licence || ""} onChange={(v) => setField("numero_licence", v)} />
        <Input label="Contact d’urgence — Nom" value={member.contact_urgence_nom || ""} onChange={(v) => setField("contact_urgence_nom", v)} full />
        <Input label="Contact d’urgence — Téléphone" value={member.contact_urgence_telephone || ""} onChange={(v) => setField("contact_urgence_telephone", v)} />
        <Input label="Identifiant PPS" value={member.pps_identifier || ""} onChange={(v) => setField("pps_identifier", v)} />
      </div>

      <div className="mt-6 flex gap-2">
        <button onClick={() => nav(-1)} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50">
          Annuler
        </button>
        <button onClick={saveAndBack} className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-orange-500 hover:brightness-110">
          Enregistrer et revenir
        </button>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", full }) {
  return (
    <label className={`flex flex-col ${full ? "md:col-span-2" : ""}`}>
      <span className="text-xs font-semibold text-neutral-600">{label}</span>
      <input
        type={type} value={value || ""} onChange={(e) => onChange(e.target.value)}
        className="mt-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
        placeholder={label}
      />
    </label>
  );
}
function Select({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col">
      <span className="text-xs font-semibold text-neutral-600">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
      >
        {options.map(([val, lab]) => <option key={val} value={val}>{lab}</option>)}
      </select>
    </label>
  );
}
