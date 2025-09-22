// src/pages/InscriptionCourse.jsx
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../supabase";
import { v4 as uuidv4 } from "uuid";
import OptionsPayantesPicker from "../components/OptionsPayantesPicker";

export default function InscriptionCourse() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Formulaire coureur
  const [inscription, setInscription] = useState(defaultCoureur());

  // Modes / équipes
  const [mode, setMode] = useState("individuel"); // 'individuel' | 'groupe' | 'relais'
  const [canShowOptions, setCanShowOptions] = useState(false); // anti-flash

  // Pour équipe(s)
  const emptyMember = () => ({ nom: "", prenom: "", genre: "", date_naissance: "", email: "" });
  const defaultTeam = (name = "", size = 0) => ({
    team_name: name,
    team_size: size,
    members: Array.from({ length: Math.max(0, size) }, () => emptyMember()),
    category: null,
  });
  const [teams, setTeams] = useState([defaultTeam("Équipe 1", 0)]);

  // Filtres d’affichage
  const [teamFilter, setTeamFilter] = useState({ q: "", category: "all", completeOnly: false });

  // Options payantes
  const [totalOptionsCents, setTotalOptionsCents] = useState(0);
  const persistOptionsFnRef = useRef(null);
  const registerPersist = useCallback((fn) => { persistOptionsFnRef.current = fn; }, []);
  const handleOptionsTotal = useCallback((cents) => setTotalOptionsCents(cents), []);

  useEffect(() => {
    let mounted = true;
    async function fetchAll() {
      setLoading(true);
      const { data, error } = await supabase
        .from("courses")
        .select(`
          *,
          formats (
            id, nom, prix, prix_equipe, date, distance_km, denivele_dplus,
            nb_max_coureurs, stock_repas, prix_repas, type_format,
            team_size, nb_coureurs_min, nb_coureurs_max,
            inscription_ouverture, inscription_fermeture,
            fuseau_horaire, waitlist_enabled
          )
        `)
        .eq("id", courseId)
        .single();

      if (!mounted) return;

      if (!error && data) {
        const withCounts = await Promise.all(
          (data.formats || []).map(async (f) => {
            const { count } = await supabase
              .from("inscriptions")
              .select("*", { count: "exact", head: true })
              .eq("format_id", f.id)
              .neq("statut", "annulé");
            return { ...f, inscrits: count || 0 };
          })
        );
        setCourse(data);
        setFormats(withCounts);
      }

      const session = await supabase.auth.getSession();
      const user = session.data?.session?.user;
      if (user) {
        const { data: profil } = await supabase
          .from("profils_utilisateurs")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profil) {
          setInscription((prev) => ({
            ...prev,
            nom: profil.nom ?? "",
            prenom: profil.prenom ?? "",
            email: profil.email ?? user.email ?? "",
            genre: profil.genre ?? "",
            date_naissance: profil.date_naissance ?? "",
            nationalite: profil.nationalite ?? "",
            telephone: profil.telephone ?? "",
            adresse: profil.adresse ?? "",
            adresse_complement: profil.adresse_complement ?? "",
            code_postal: profil.code_postal ?? "",
            ville: profil.ville ?? "",
            pays: profil.pays ?? "",
            apparaitre_resultats:
              typeof profil.apparaitre_resultats === "boolean" ? profil.apparaitre_resultats : true,
            club: profil.club ?? "",
            justificatif_type: profil.justificatif_type ?? "",
            numero_licence: profil.numero_licence ?? "",
            pps_identifier: profil.pps_identifier ?? "",
            contact_urgence_nom: profil.contact_urgence_nom ?? "",
            contact_urgence_telephone: profil.contact_urgence_telephone ?? "",
            coureur_id: user.id,
          }));
        }
      }

      setLoading(false);
    }
    fetchAll();
    return () => { mounted = false; };
  }, [courseId]);

  function defaultCoureur() {
    return {
      coureur_id: null, format_id: "", nom: "", prenom: "", genre: "", date_naissance: "",
      nationalite: "", email: "", telephone: "", adresse: "", adresse_complement: "",
      code_postal: "", ville: "", pays: "", apparaitre_resultats: true, club: "",
      justificatif_type: "", numero_licence: "", pps_identifier: "",
      contact_urgence_nom: "", contact_urgence_telephone: "",
      nombre_repas: 0, prix_total_repas: 0, prix_total_coureur: 0,
    };
  }

  const selectedFormat = useMemo(
    () => formats.find((f) => f.id === inscription.format_id),
    [formats, inscription.format_id]
  );

  useEffect(() => { setCanShowOptions(!!selectedFormat); }, [selectedFormat]);

  const registrationWindow = useMemo(() => {
    if (!selectedFormat) return { isOpen: true, reason: "" };
    const now = new Date();
    const openAt = selectedFormat.inscription_ouverture ? new Date(selectedFormat.inscription_ouverture) : null;
    const closeAt = selectedFormat.inscription_fermeture ? new Date(selectedFormat.inscription_fermeture) : null;
    if (openAt && now < openAt) return { isOpen: false, reason: `Ouvre le ${openAt.toLocaleString()}` };
    if (closeAt && now > closeAt) return { isOpen: false, reason: `Fermé depuis le ${closeAt.toLocaleString()}` };
    return { isOpen: true, reason: "" };
  }, [selectedFormat]);

  // Recalcul prix (individuel)
  useEffect(() => {
    if (!selectedFormat || mode !== "individuel") {
      setInscription((p) => ({ ...p, prix_total_repas: 0, prix_total_coureur: 0 }));
      return;
    }
    const prixRepas = Number(selectedFormat.prix_repas || 0);
    const prixInscription = Number(selectedFormat.prix || 0);
    const totalRepas = prixRepas * Number(inscription.nombre_repas || 0);
    const total = prixInscription + totalRepas;
    setInscription((prev) => ({ ...prev, prix_total_repas: totalRepas, prix_total_coureur: total }));
  }, [selectedFormat, inscription.nombre_repas, mode]);

  // Estimation équipes (multi)
  const estimationEquipe = useMemo(() => {
    if (!selectedFormat || mode === "individuel") return 0;
    const fee = Number(selectedFormat.prix_equipe || 0) || 0;
    const prixUnitaire = Number(selectedFormat.prix || 0) || 0;
    return teams.reduce((acc, t) => acc + (t.team_size || 0) * prixUnitaire + fee, 0);
  }, [selectedFormat, mode, teams]);

  function setField(name, value) { setInscription((prev) => ({ ...prev, [name]: value })); }

  const minTeam = selectedFormat?.nb_coureurs_min || selectedFormat?.team_size || 1;
  const maxTeam = selectedFormat?.nb_coureurs_max || selectedFormat?.team_size || 20;

  function setTeamSizeAt(index, size) {
    size = Math.max(minTeam, Math.min(maxTeam, Number(size || 0)));
    setTeams((prev) => {
      const copy = [...prev];
      const t = { ...copy[index] };
      t.team_size = size;
      const cur = t.members.length;
      if (size > cur) t.members = [...t.members, ...Array.from({ length: size - cur }, () => emptyMember())];
      if (size < cur) t.members = t.members.slice(0, size);
      copy[index] = t;
      return copy;
    });
  }
  function setTeamNameAt(index, name) {
    setTeams((prev) => { const copy = [...prev]; copy[index] = { ...copy[index], team_name: name }; return copy; });
  }
  function setMemberAt(teamIdx, memberIdx, field, value) {
    setTeams((prev) => {
      const copy = [...prev];
      const team = { ...copy[teamIdx] };
      const members = [...team.members];
      members[memberIdx] = { ...members[memberIdx], [field]: value };
      team.members = members;
      copy[teamIdx] = team;
      return copy;
    });
  }
  function addTeam() {
    const n = teams.length + 1;
    setTeams((prev) => [...prev, defaultTeam(`Équipe ${n}`, selectedFormat?.team_size || minTeam)]);
  }
  function removeTeam(idx) { setTeams((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx))); }

  function computeTeamCategory(team) {
    const gens = (team.members || []).map((m) => (m.genre || "").toLowerCase()).filter(Boolean);
    if (gens.length === 0) return null;
    const allH = gens.every((g) => g.startsWith("h"));
    const allF = gens.every((g) => g.startsWith("f"));
    if (allH) return "masculine";
    if (allF) return "feminine";
    return "mixte";
  }
  function isTeamComplete(team) {
    if (!team.team_size || (team.members?.length || 0) !== team.team_size) return false;
    return team.members.every((m) => m.nom?.trim() && m.prenom?.trim() && m.genre && m.date_naissance);
  }

  const filteredTeams = useMemo(() => {
    return teams
      .map((t) => ({ ...t, category: computeTeamCategory(t) }))
      .filter((t) => (teamFilter.q ? (t.team_name || "").toLowerCase().includes(teamFilter.q.toLowerCase()) : true))
      .filter((t) => (teamFilter.category === "all" ? true : t.category === teamFilter.category))
      .filter((t) => (!teamFilter.completeOnly ? true : isTeamComplete(t)));
  }, [teams, teamFilter]);

  const ready = !loading && course && formats.length > 0;

  async function handlePay() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const user = sess?.session?.user;
      if (!user) { alert("Veuillez vous connecter pour effectuer le paiement."); setSubmitting(false); return; }
      if (!inscription.format_id) { alert("Veuillez sélectionner un format."); setSubmitting(false); return; }

      if (!registrationWindow.isOpen) { alert(`Inscriptions non ouvertes : ${registrationWindow.reason}`); setSubmitting(false); return; }

      const full = selectedFormat && Number(selectedFormat.inscrits || 0) >= Number(selectedFormat.nb_max_coureurs || 0);

      if (mode === "individuel") {
        if (full && !selectedFormat?.waitlist_enabled) { alert(`Le format ${selectedFormat.nom} est complet.`); setSubmitting(false); return; }
        const trace_id = uuidv4();
        const prixTotalClient = Number(inscription.prix_total_coureur || 0) + (totalOptionsCents / 100);

        const { data: inserted, error: insertErr } = await supabase
          .from("inscriptions")
          .insert([{ ...inscription, course_id: courseId, format_id: inscription.format_id, statut: "en attente", paiement_trace_id: trace_id }])
          .select().single();

        if (insertErr || !inserted) { console.error("❌ Erreur insertion inscription :", insertErr); alert("Erreur lors de l'enregistrement de l'inscription."); setSubmitting(false); return; }

        if (persistOptionsFnRef.current) await persistOptionsFnRef.current(inserted.id);

        const payerEmail = inscription.email || user.email || user.user_metadata?.email || "";
        if (!payerEmail) { alert("Veuillez renseigner un email."); setSubmitting(false); return; }

        const { data, error: fnError } = await supabase.functions.invoke("create-checkout-session", {
          body: {
            user_id: user.id, course_id: courseId, prix_total: prixTotalClient,
            inscription_id: inserted.id, email: payerEmail, trace_id,
            successUrl: "https://www.tickrace.com/merci", cancelUrl: "https://www.tickrace.com/paiement-annule"
          }
        });
        if (fnError || !data?.url) { console.error("❌ create-checkout-session error:", fnError, data); alert("Erreur lors de la création du paiement."); setSubmitting(false); return; }
        window.location.href = data.url;
        return;
      }

      if (mode === "relais") {
        if (teams.length === 0) { alert("Veuillez ajouter au moins une équipe relais."); setSubmitting(false); return; }
        for (const [idx, team] of teams.entries()) {
          if (!team.team_name || !team.team_size) { alert(`Équipe #${idx + 1} : nom et taille requis.`); setSubmitting(false); return; }
          if (team.members.length !== team.team_size) { alert(`Équipe #${idx + 1} : le nombre de membres doit être ${team.team_size}.`); setSubmitting(false); return; }
          const bad = team.members.find((m) => !m.nom?.trim() || !m.prenom?.trim() || !m.genre || !m.date_naissance);
          if (bad) { alert(`Équipe #${idx + 1} : chaque membre doit avoir nom, prénom, sexe et date de naissance.`); setSubmitting(false); return; }
        }

        const payerEmail = inscription.email || user.email || user.user_metadata?.email || "";
        if (!payerEmail) { alert("Veuillez renseigner un email."); setSubmitting(false); return; }

        const teamsForPayload = teams.map((t) => ({ team_name: t.team_name, team_size: t.team_size, category: computeTeamCategory(t), members: t.members }));
        const trace_id = uuidv4();
        const { data: insertedRelay, error: insErr } = await supabase
          .from("inscriptions")
          .insert([{ user_id: user.id, course_id: courseId, format_id: inscription.format_id, statut: "draft", paiement_trace_id: trace_id }])
          .select().single();
        if (insErr || !insertedRelay) { console.error("❌ Erreur création draft relais :", insErr); alert("Erreur: impossible de préparer le paiement relais."); setSubmitting(false); return; }

        if (persistOptionsFnRef.current) await persistOptionsFnRef.current(insertedRelay.id);

        const body = (teams.length > 1)
          ? { mode, format_id: inscription.format_id, user_id: user.id, course_id: courseId, email: payerEmail, teams: teamsForPayload,
              options_total_eur: totalOptionsCents / 100, inscription_id: insertedRelay.id,
              successUrl: "https://www.tickrace.com/merci", cancelUrl: "https://www.tickrace.com/paiement-annule" }
          : { mode, format_id: inscription.format_id, user_id: user.id, course_id: courseId, email: payerEmail,
              team_name: teamsForPayload[0].team_name, team_size: teamsForPayload[0].team_size, category: teamsForPayload[0].category, members: teamsForPayload[0].members,
              options_total_eur: totalOptionsCents / 100, inscription_id: insertedRelay.id,
              successUrl: "https://www.tickrace.com/merci", cancelUrl: "https://www.tickrace.com/paiement-annule" };

        const { data, error: fnError } = await supabase.functions.invoke("create-checkout-session", { body });
        if (fnError || !data?.url) { console.error("❌ create-checkout-session (relais) error:", fnError, data); alert(fnError?.message || "Erreur lors de la création du paiement (relais)."); setSubmitting(false); return; }
        window.location.href = data.url;
        return;
      }

      // GROUPE (sans options)
      for (const [idx, team] of teams.entries()) {
        if (!team.team_name || !team.team_size) { alert(`Équipe #${idx + 1} : nom et taille requis.`); setSubmitting(false); return; }
        if (team.members.length !== team.team_size) { alert(`Équipe #${idx + 1} : le nombre de membres doit être ${team.team_size}.`); setSubmitting(false); return; }
        const bad = team.members.find((m) => !m.nom?.trim() || !m.prenom?.trim() || !m.genre || !m.date_naissance);
        if (bad) { alert(`Équipe #${idx + 1} : chaque membre doit avoir nom, prénom, sexe et date de naissance.`); setSubmitting(false); return; }
      }
      const payerEmail = inscription.email || user.email || user.user_metadata?.email || "";
      if (!payerEmail) { alert("Veuillez renseigner un email."); setSubmitting(false); return; }
      const teamsForPayload = teams.map((t) => ({ team_name: t.team_name, team_size: t.team_size, category: computeTeamCategory(t), members: t.members }));
      let body = { mode, format_id: inscription.format_id, user_id: user.id, course_id: courseId, email: payerEmail,
        successUrl: "https://www.tickrace.com/merci", cancelUrl: "https://www.tickrace.com/paiement-annule" };
      if (teams.length > 1) body = { ...body, teams: teamsForPayload };
      else body = { ...body, team_name: teamsForPayload[0].team_name, team_size: teamsForPayload[0].team_size, category: teamsForPayload[0].category, members: teamsForPayload[0].members };
      const { data, error: fnError } = await supabase.functions.invoke("create-checkout-session", { body });
      if (fnError || !data?.url) { console.error("❌ create-checkout-session error:", fnError, data); alert(fnError?.message || "Erreur lors de la création du paiement."); setSubmitting(false); return; }
      window.location.href = data.url;
    } finally {
      // on laisse submitting à true pendant la redirection
    }
  }

  if (!ready) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="h-7 w-64 bg-neutral-200 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-48 bg-neutral-100 rounded-2xl animate-pulse" />
            <div className="h-48 bg-neutral-100 rounded-2xl animate-pulse" />
          </div>
          <div className="h-64 bg-neutral-100 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  const placesRestantes = Math.max(0, Number(selectedFormat.nb_max_coureurs || 0) - Number(selectedFormat.inscrits || 0));
  const totalIndividuelEUR = useMemo(() => (Number(inscription.prix_total_coureur || 0) + totalOptionsCents / 100), [inscription.prix_total_coureur, totalOptionsCents]);
  const totalRelaisEUR = useMemo(() => (Number(estimationEquipe || 0) + totalOptionsCents / 100), [estimationEquipe, totalOptionsCents]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link to={`/courses/${courseId}`} className="text-sm text-neutral-500 hover:text-neutral-800">← Retour à la course</Link>
          <h1 className="text-2xl sm:text-3xl font-bold mt-1">{course.nom}</h1>
          <p className="text-neutral-600 mt-1">
            {mode === "individuel" ? "Inscription individuelle" : (mode === "groupe" ? "Inscription en groupe" : "Inscription relais")}
            {(selectedFormat?.inscription_ouverture || selectedFormat?.inscription_fermeture) && (
              <> {" • "} <span className="text-neutral-700">
                {selectedFormat.inscription_ouverture && (<>Ouverture : {new Date(selectedFormat.inscription_ouverture).toLocaleString()} </>)}
                {selectedFormat.inscription_fermeture && (<> / Fermeture : {new Date(selectedFormat.inscription_fermeture).toLocaleString()} </>)}
              </span></>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulaire */}
        <div className="lg:col-span-2 space-y-6">
          {/* Choix format */}
          <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="p-5 border-b border-neutral-100">
              <h2 className="text-lg font-semibold">Choix du format</h2>
              <p className="text-sm text-neutral-500">Sélectionne le format. La capacité affichée tient compte des inscriptions existantes.</p>
            </div>
            <div className="p-5 space-y-4">
              <label className="block text-sm font-medium mb-1">Format</label>
              <select
                name="format_id"
                value={inscription.format_id}
                onChange={(e) => {
                  setField("format_id", e.target.value);
                  const f = formats.find((ff) => ff.id === e.target.value);
                  const newMode = f?.type_format || "individuel";
                  setMode(newMode);
                  if (newMode === "individuel") setTeams([defaultTeam("Équipe 1", 0)]);
                  else {
                    const def = f?.team_size || (f?.nb_coureurs_min || 1);
                    setTeams([defaultTeam("Équipe 1", def)]);
                  }
                  setTotalOptionsCents(0);
                }}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:ring-2 focus:ring-black"
                required
              >
                <option value="">-- Sélectionnez un format --</option>
                {formats.map((f) => {
                  const full = Number(f.inscrits) >= Number(f.nb_max_coureurs || 0);
                  return (
                    <option key={f.id} value={f.id} disabled={full && !f.waitlist_enabled}>
                      {f.nom} — {f.date} — {f.distance_km} km / {f.denivele_dplus} m D+ {full ? (f.waitlist_enabled ? " (liste d’attente)" : " (complet)") : ""}
                    </option>
                  );
                })}
              </select>

              {selectedFormat && (
                <div className="text-sm text-neutral-600">
                  Capacité : {selectedFormat.inscrits}/{selectedFormat.nb_max_coureurs} —{" "}
                  <span className="font-medium">
                    {placesRestantes} place{placesRestantes > 1 ? "s" : ""} restante{placesRestantes > 1 ? "s" : ""}
                  </span>
                  {selectedFormat.waitlist_enabled && placesRestantes === 0 && (<span className="ml-2 text-amber-700">(Liste d’attente possible)</span>)}
                  {!registrationWindow.isOpen && (<span className="ml-2 text-red-600">— {registrationWindow.reason}</span>)}
                </div>
              )}

              {selectedFormat && selectedFormat.type_format !== "individuel" && (
                <div className="mt-3">
                  <div className="text-sm font-medium mb-1">Type d’inscription</div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setMode("individuel")}
                      className={`px-3 py-1.5 rounded-xl border text-sm ${mode==="individuel" ? "bg-black text-white border-black" : "bg-white hover:bg-neutral-50"}`}>
                      Individuel
                    </button>
                    {selectedFormat.type_format === "groupe" && (
                      <button type="button" onClick={() => setMode("groupe")}
                        className={`px-3 py-1.5 rounded-xl border text-sm ${mode==="groupe" ? "bg-black text-white border-black" : "bg-white hover:bg-neutral-50"}`}>
                        Groupe
                      </button>
                    )}
                    {selectedFormat.type_format === "relais" && (
                      <button type="button" onClick={() => setMode("relais")}
                        className={`px-3 py-1.5 rounded-xl border text-sm ${mode==="relais" ? "bg-black text-white border-black" : "bg-white hover:bg-neutral-50"}`}>
                        Relais
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Équipes (groupe/relais) */}
          {selectedFormat && mode !== "individuel" && (
            <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{mode === "groupe" ? "Équipe" : "Équipes relais"}</h2>
                  <p className="text-sm text-neutral-500">Renseigne le nom de l’équipe, la taille et les membres (nom, prénom, sexe, date de naissance).</p>
                </div>
                <div className="flex gap-2">
                  {mode !== "groupe" && (
                    <button type="button" onClick={addTeam} className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:brightness-110">
                      + Ajouter une équipe
                    </button>
                  )}
                </div>
              </div>

              {/* Filtres */}
              <div className="px-5 pt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <input className="rounded-xl border border-neutral-300 px-3 py-2" placeholder="Rechercher une équipe…"
                  value={teamFilter.q} onChange={(e) => setTeamFilter((p) => ({ ...p, q: e.target.value }))} />
                <select className="rounded-xl border border-neutral-300 px-3 py-2"
                  value={teamFilter.category} onChange={(e) => setTeamFilter((p) => ({ ...p, category: e.target.value }))}>
                  <option value="all">Toutes catégories</option>
                  <option value="masculine">Équipe masculine</option>
                  <option value="feminine">Équipe féminine</option>
                  <option value="mixte">Équipe mixte</option>
                </select>
                <label className="inline-flex items-center gap-2 text-sm text-neutral-800">
                  <input type="checkbox" checked={teamFilter.completeOnly} onChange={(e) => setTeamFilter((p) => ({ ...p, completeOnly: e.target.checked }))} />
                  Afficher uniquement les équipes complètes
                </label>
              </div>

              <div className="p-5 space-y-6">
                {filteredTeams.map((team, tIdx) => (
                  <div key={tIdx} className="rounded-xl ring-1 ring-neutral-200 bg-neutral-50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-medium flex items-center gap-2">
                        {team.team_name || `Équipe ${tIdx + 1}`}
                        {computeTeamCategory(team) && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-900">
                            {computeTeamCategory(team) === "masculine" ? "Équipe masculine" :
                             computeTeamCategory(team) === "feminine" ? "Équipe féminine" : "Équipe mixte"}
                          </span>
                        )}
                        {isTeamComplete(team)
                          ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">complète</span>
                          : <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">incomplète</span>}
                      </div>
                      {teams.length > 1 && (
                        <button type="button" onClick={() => removeTeam(tIdx)} className="text-sm text-neutral-600 hover:text-red-600">Supprimer</button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                      <div>
                        <label className="text-sm font-medium">Nom d’équipe</label>
                        <input className="mt-1 rounded-xl border border-neutral-300 px-3 py-2 w-full"
                          value={team.team_name} onChange={(e) => setTeamNameAt(tIdx, e.target.value)} placeholder={`Équipe ${tIdx + 1}`} />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Taille de l’équipe {selectedFormat.team_size ? `(par défaut ${selectedFormat.team_size})` : ""}</label>
                        <input type="number" className="mt-1 rounded-xl border border-neutral-300 px-3 py-2 w-full"
                          value={team.team_size || selectedFormat.team_size || 0} min={minTeam} max={maxTeam}
                          onChange={(e) => setTeamSizeAt(tIdx, e.target.value)} />
                        <p className="text-xs text-neutral-500 mt-1">Min {minTeam} — Max {maxTeam}</p>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-neutral-600">
                            <th className="py-2 pr-3">#</th><th className="py-2 pr-3">Nom *</th><th className="py-2 pr-3">Prénom *</th>
                            <th className="py-2 pr-3">Sexe *</th><th className="py-2 pr-3">Date de naissance *</th><th className="py-2 pr-3">Email (optionnel)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {team.members.map((m, mIdx) => (
                            <tr key={mIdx} className="border-t">
                              <td className="py-2 pr-3 w-10">{mIdx + 1}</td>
                              <td className="py-2 pr-3"><input className="w-full rounded-xl border border-neutral-300 px-3 py-2" value={m.nom}
                                onChange={(e) => setMemberAt(tIdx, mIdx, "nom", e.target.value)} placeholder="Nom" /></td>
                              <td className="py-2 pr-3"><input className="w-full rounded-xl border border-neutral-300 px-3 py-2" value={m.prenom}
                                onChange={(e) => setMemberAt(tIdx, mIdx, "prenom", e.target.value)} placeholder="Prénom" /></td>
                              <td className="py-2 pr-3"><select className="w-full rounded-xl border border-neutral-300 px-3 py-2" value={m.genre || ""}
                                onChange={(e) => setMemberAt(tIdx, mIdx, "genre", e.target.value)}>
                                <option value="">Sélectionner</option><option value="Homme">Homme</option><option value="Femme">Femme</option>
                              </select></td>
                              <td className="py-2 pr-3"><input type="date" className="w-full rounded-xl border border-neutral-300 px-3 py-2" value={m.date_naissance || ""}
                                onChange={(e) => setMemberAt(tIdx, mIdx, "date_naissance", e.target.value)} /></td>
                              <td className="py-2 pr-3"><input className="w-full rounded-xl border border-neutral-300 px-3 py-2" value={m.email || ""}
                                onChange={(e) => setMemberAt(tIdx, mIdx, "email", e.target.value)} placeholder="email@exemple.com" /></td>
                            </tr>
                          ))}
                          {team.team_size === 0 && (
                            <tr><td colSpan={6} className="py-2 text-neutral-500">Indique une taille d’équipe pour générer les lignes.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Infos coureur : individuel */}
          {mode === "individuel" && (
            <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="p-5 border-b border-neutral-100"><h2 className="text-lg font-semibold">Informations coureur</h2></div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input className="rounded-xl border border-neutral-300 px-3 py-2" name="nom" placeholder="Nom" value={inscription.nom} onChange={(e) => setField("nom", e.target.value)} />
                  <input className="rounded-xl border border-neutral-300 px-3 py-2" name="prenom" placeholder="Prénom" value={inscription.prenom} onChange={(e) => setField("prenom", e.target.value)} />
                  <select className="rounded-xl border border-neutral-300 px-3 py-2" name="genre" value={inscription.genre} onChange={(e) => setField("genre", e.target.value)}>
                    <option value="">Genre</option><option value="Homme">Homme</option><option value="Femme">Femme</option>
                  </select>
                  <input type="date" className="rounded-xl border border-neutral-300 px-3 py-2" name="date_naissance" value={inscription.date_naissance}
                    onChange={(e) => setField("date_naissance", e.target.value)} />
                  <input className="rounded-xl border border-neutral-300 px-3 py-2" name="nationalite" placeholder="Nationalité" value={inscription.nationalite}
                    onChange={(e) => setField("nationalite", e.target.value)} />
                  <input className="rounded-xl border border-neutral-300 px-3 py-2" name="email" placeholder="Email" value={inscription.email}
                    onChange={(e) => setField("email", e.target.value)} />
                  <input className="rounded-xl border border-neutral-300 px-3 py-2" name="telephone" placeholder="Téléphone" value={inscription.telephone}
                    onChange={(e) => setField("telephone", e.target.value)} />
                  <input className="rounded-xl border border-neutral-300 px-3 py-2 md:col-span-2" name="adresse" placeholder="Adresse" value={inscription.adresse}
                    onChange={(e) => setField("adresse", e.target.value)} />
                  <input className="rounded-xl border border-neutral-300 px-3 py-2" name="adresse_complement" placeholder="Complément adresse" value={inscription.adresse_complement}
                    onChange={(e) => setField("adresse_complement", e.target.value)} />
                  <input className="rounded-xl border border-neutral-300 px-3 py-2" name="code_postal" placeholder="Code postal" value={inscription.code_postal}
                    onChange={(e) => setField("code_postal", e.target.value)} />
                  <input className="rounded-xl border border-neutral-300 px-3 py-2" name="ville" placeholder="Ville" value={inscription.ville}
                    onChange={(e) => setField("ville", e.target.value)} />
                  <input className="rounded-xl border border-neutral-300 px-3 py-2" name="pays" placeholder="Pays" value={inscription.pays}
                    onChange={(e) => setField("pays", e.target.value)} />
                  <input className="rounded-xl border border-neutral-300 px-3 py-2" name="club" placeholder="Club" value={inscription.club}
                    onChange={(e) => setField("club", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Affichage des résultats</p>
                  <div className="flex gap-4 text-sm text-neutral-700">
                    <label className="inline-flex items-center gap-2">
                      <input type="radio" name="apparaitre_resultats" checked={inscription.apparaitre_resultats === true}
                        onChange={() => setField("apparaitre_resultats", true)} /> Oui
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input type="radio" name="apparaitre_resultats" checked={inscription.apparaitre_resultats === false}
                        onChange={() => setField("apparaitre_resultats", false)} /> Non
                    </label>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Options payantes */}
          {canShowOptions && (mode === "individuel" || mode === "relais") && (
            <OptionsPayantesPicker
              formatId={selectedFormat.id}
              onTotalCentsChange={handleOptionsTotal}
              registerPersist={registerPersist}
            />
          )}
        </div>

        {/* Résumé / paiement */}
        <aside className="lg:col-span-1">
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm sticky top-6">
            <div className="p-5 border-b border-neutral-100">
              <h3 className="text-lg font-semibold">Résumé</h3>
              <p className="text-sm text-neutral-500">Vérifie les informations puis procède au paiement.</p>
            </div>

            <div className="p-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-600">Format</span>
                <span className="font-medium">{selectedFormat ? selectedFormat.nom : "—"}</span>
              </div>

              {mode !== "individuel" && (
                <>
                  <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3">
                    {(() => {
                      const teamsWithCat = teams.map((t) => ({ ...t, category: computeTeamCategory(t) }));
                      const totals = {
                        count: teams.length,
                        participants: teams.reduce((acc, t) => acc + (t.team_size || 0), 0),
                        masculine: teamsWithCat.filter((t) => t.category === "masculine").length,
                        feminine: teamsWithCat.filter((t) => t.category === "feminine").length,
                        mixte: teamsWithCat.filter((t) => t.category === "mixte").length,
                        completes: teamsWithCat.filter((t) => isTeamComplete(t)).length,
                      };
                      return (
                        <div className="space-y-1">
                          <div className="flex justify-between"><span>Équipes</span><b>{totals.count}</b></div>
                          <div className="flex justify-between"><span>Participants</span><b>{totals.participants}</b></div>
                          <div className="flex justify-between"><span>Masculines</span><b>{totals.masculine}</b></div>
                          <div className="flex justify-between"><span>Féminines</span><b>{totals.feminine}</b></div>
                          <div className="flex justify-between"><span>Mixtes</span><b>{totals.mixte}</b></div>
                          <div className="flex justify-between"><span>Équipes complètes</span><b>{totals.completes}</b></div>
                        </div>
                      );
                    })()}
                  </div>
                </>
              )}

              {mode === "individuel" ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Inscription</span>
                    <span className="font-medium">{Number(selectedFormat.prix || 0).toFixed(2)} €</span>
                  </div>
                  {Number(selectedFormat.stock_repas) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Repas × {Number(inscription.nombre_repas || 0)}</span>
                      <span className="font-medium">{Number(inscription.prix_total_repas || 0).toFixed(2)} €</span>
                    </div>
                  )}
                  {totalOptionsCents > 0 && (
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Options payantes</span>
                      <span className="font-medium">{(totalOptionsCents / 100).toFixed(2)} €</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {teams.map((t, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-neutral-600">{t.team_name || `Équipe ${i + 1}`} — {t.team_size} pers.</span>
                      <span className="font-medium">~{((Number(selectedFormat?.prix || 0) * (t.team_size || 0)) + (Number(selectedFormat?.prix_equipe || 0) || 0)).toFixed(2)} €</span>
                    </div>
                  ))}
                  {mode === "relais" && totalOptionsCents > 0 && (
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Options payantes</span>
                      <span className="font-medium">{(totalOptionsCents / 100).toFixed(2)} €</span>
                    </div>
                  )}
                  <div className="h-px bg-neutral-200 my-2" />
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Sous-total estimé</span>
                    <span className="font-medium">
                      ~{(Number(estimationEquipe || 0) + (mode === "relais" ? totalOptionsCents / 100 : 0)).toFixed(2)} €
                    </span>
                  </div>
                </>
              )}

              <div className="h-px bg-neutral-200 my-2" />
              <div className="flex justify-between text-base">
                <span className="font-semibold">Total</span>
                <span className="font-bold">
                  {mode === "individuel"
                    ? totalIndividuelEUR.toFixed(2)
                    : (mode === "relais"
                        ? `~${totalRelaisEUR.toFixed(2)}`
                        : `~${Number(estimationEquipe || 0).toFixed(2)}`)}
                  {" "}€
                </span>
              </div>
            </div>

            <div className="p-5">
              <button
                type="button" onClick={handlePay}
                disabled={
                  submitting || !inscription.format_id || !registrationWindow.isOpen ||
                  (mode === "individuel" && !selectedFormat.waitlist_enabled && Number(selectedFormat.inscrits) >= Number(selectedFormat.nb_max_coureurs || 0))
                }
                className={`w-full rounded-xl px-4 py-3 text-white font-semibold transition ${submitting ? "bg-neutral-400 cursor-not-allowed" : "bg-neutral-900 hover:bg-black"}`}
              >
                {submitting ? "Redirection vers Stripe…" : (mode === "individuel" ? "Confirmer et payer" : "Payer")}
              </button>

              {Number(selectedFormat.inscrits) >= Number(selectedFormat.nb_max_coureurs || 0) && (
                <p className="text-xs text-amber-700 mt-2">
                  {selectedFormat.waitlist_enabled ? "Capacité atteinte : vous serez placé(e) en liste d’attente si l’organisateur l’autorise." : "Ce format est complet."}
                </p>
              )}
              {!registrationWindow.isOpen && (<p className="text-xs text-red-600 mt-2">{registrationWindow.reason}</p>)}
              <p className="text-xs text-neutral-500 mt-3">En confirmant, vous acceptez les conditions de l’épreuve et de Tickrace.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
