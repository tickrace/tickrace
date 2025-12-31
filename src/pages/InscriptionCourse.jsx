// src/pages/InscriptionCourse.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { v4 as uuidv4 } from "uuid";
import JustificatifInscriptionBlock from "../components/inscription/JustificatifInscriptionBlock";

/* ---------------- Options payantes ---------------- */
function OptionsPayantesPicker({ formatId, onTotalCentsChange, registerPersist, registerGetSelected }) {
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(true);
  const [options, setOptions] = useState([]);
  const [quantites, setQuantites] = useState({}); // option_id -> qty

  const recomputeAndEmit = (qMap, opts = options) => {
    const total = (opts || []).reduce((acc, o) => {
      const q = Number(qMap[o.id] || 0);
      const pu = Number(o.price_cents || 0);
      return acc + q * pu;
    }, 0);
    onTotalCentsChange?.(total);
    return total;
  };

  useEffect(() => {
    let abort = false;
    async function load() {
      if (!formatId) {
        setOptions([]);
        setQuantites({});
        onTotalCentsChange?.(0);
        return;
      }
      setLoading(true);

      const { data, error } = await supabase
        .from("options_catalogue")
        .select("*")
        .eq("format_id", formatId)
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (abort) return;

      if (error) {
        setSupported(false);
        setOptions([]);
        setQuantites({});
        setLoading(false);
        onTotalCentsChange?.(0);
        return;
      }

      const rows = data || [];
      setSupported(true);
      setOptions(rows);

      const init = {};
      rows.forEach((o) => {
        init[o.id] = 0;
      });
      setQuantites(init);
      recomputeAndEmit(init, rows);
      setLoading(false);
    }
    load();
    return () => {
      abort = true;
    };
  }, [formatId]);

  // Persistance dans inscriptions_options (pending) après création d’inscription
  async function persist(inscriptionId) {
    if (!supported || !inscriptionId) return;
    await supabase.from("inscriptions_options").delete().eq("inscription_id", inscriptionId).eq("status", "pending");

    const rows = [];
    for (const o of options) {
      const q = Number(quantites[o.id] || 0);
      const max = Number(o.max_qty_per_inscription ?? 10);
      if (q > 0) {
        if (q > max) continue;
        rows.push({
          inscription_id: inscriptionId,
          option_id: o.id,
          quantity: q,
          prix_unitaire_cents: Number(o.price_cents || 0),
          status: "pending",
        });
      }
    }
    if (rows.length > 0) {
      const { error } = await supabase.from("inscriptions_options").insert(rows);
      if (error) console.error("❌ insert inscriptions_options:", error);
    }
  }

  useEffect(() => {
    registerPersist?.(persist);
  }, [registerPersist, options, quantites, supported]);

  // Getter des options sélectionnées (pour groupe/relais)
  function getSelected() {
    return (options || [])
      .map((o) => ({
        option_id: o.id,
        quantity: Number(quantites[o.id] || 0),
        prix_unitaire_cents: Number(o.price_cents || 0),
      }))
      .filter((x) => x.quantity > 0);
  }
  useEffect(() => {
    registerGetSelected?.(getSelected);
  }, [registerGetSelected, options, quantites]);

  const dec = (o) => {
    const max = Number(o.max_qty_per_inscription ?? 10);
    setQuantites((prev) => {
      const cur = Number(prev[o.id] || 0);
      const next = Math.max(0, Math.min(max, cur - 1));
      const qMap = { ...prev, [o.id]: next };
      recomputeAndEmit(qMap);
      return qMap;
    });
  };
  const inc = (o) => {
    const max = Number(o.max_qty_per_inscription ?? 10);
    setQuantites((prev) => {
      const cur = Number(prev[o.id] || 0);
      const next = Math.max(0, Math.min(max, cur + 1));
      const qMap = { ...prev, [o.id]: next };
      recomputeAndEmit(qMap);
      return qMap;
    });
  };
  const setQty = (o, raw) => {
    const max = Number(o.max_qty_per_inscription ?? 10);
    const v = Number(raw ?? 0);
    const clamped = Number.isFinite(v) ? Math.min(Math.max(v, 0), max) : 0;
    setQuantites((prev) => {
      const qMap = { ...prev, [o.id]: clamped };
      recomputeAndEmit(qMap);
      return qMap;
    });
  };

  if (!supported) return null;
  if (loading) {
    return (
      <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="p-5 border-b border-neutral-100">
          <h2 className="text-lg font-semibold">Options payantes</h2>
        </div>
        <div className="p-5 text-sm text-neutral-500">Chargement…</div>
      </section>
    );
  }
  if (options.length === 0) return null;

  const affichageTotalCents = options.reduce((acc, o) => {
    const q = Number(quantites[o.id] || 0);
    return acc + q * Number(o.price_cents || 0);
  }, 0);

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="p-5 border-b border-neutral-100">
        <h2 className="text-lg font-semibold">Options payantes</h2>
        <p className="text-sm text-neutral-500">Sélectionne les quantités souhaitées.</p>
      </div>
      <div className="p-5 space-y-3">
        {options.map((o) => {
          const q = Number(quantites[o.id] || 0);
          const max = Number(o.max_qty_per_inscription ?? 10);
          const prixCents = Number(o.price_cents || 0);
          return (
            <div key={o.id} className="flex items-start justify-between gap-3 rounded-xl border border-neutral-200 p-3">
              <div className="text-sm">
                <div className="font-medium">
                  {o.label} · {(prixCents / 100).toFixed(2)} €
                </div>
                {o.description && <div className="text-neutral-600">{o.description}</div>}
                <div className="text-xs text-neutral-500">Quantité autorisée : 0–{max}</div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" className="rounded-lg border px-2 py-1 text-sm" onClick={() => dec(o)}>
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  max={max}
                  value={q}
                  onChange={(e) => setQty(o, e.target.value)}
                  className="w-16 rounded-lg border px-2 py-1 text-sm text-center"
                />
                <button type="button" className="rounded-lg border px-2 py-1 text-sm" onClick={() => inc(o)}>
                  +
                </button>
              </div>
            </div>
          );
        })}
        <div className="mt-2 text-right text-sm">
          Total options : <b>{(affichageTotalCents / 100).toFixed(2)} €</b>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

export default function InscriptionCourse() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // ✅ Justificatifs (policy globale course)
  const [justifPolicy, setJustifPolicy] = useState({
    is_required: false,
    allow_medical_upload: true,
    allowed_types: [],
    notes: "",
  });
  const [justifTypes, setJustifTypes] = useState([]);
  const [justifUploading, setJustifUploading] = useState(false);

  // Formulaire coureur / payeur
  const [inscription, setInscription] = useState(defaultCoureur());

  // Modes
  const [mode, setMode] = useState("individuel"); // 'individuel' | 'groupe' | 'relais'

  // ✅ Confirmation liste d’attente (individuel)
  const [waitlistCreated, setWaitlistCreated] = useState(null); // { id, email }

  // Équipes
  const emptyMember = () => ({
    nom: "",
    prenom: "",
    genre: "",
    date_naissance: "",
    email: "",
    justificatif_type: "",
    numero_licence: "",
    pps_identifier: "",
    justificatif_url: "",
  });

  const defaultTeam = (name = "", size = 0) => ({
    team_name: name,
    team_size: size,
    members: Array.from({ length: Math.max(0, size) }, () => emptyMember()),
    category: null,
  });

  const [teams, setTeams] = useState([defaultTeam("Équipe 1", 0)]);

  // Filtres UI
  const [teamFilter, setTeamFilter] = useState({
    q: "",
    category: "all",
    completeOnly: false,
  });

  // Total options payantes (cents) & callbacks
  const [totalOptionsCents, setTotalOptionsCents] = useState(0);
  const persistOptionsFnRef = useRef(null);
  function registerPersist(fn) {
    persistOptionsFnRef.current = fn;
  }

  // Getter options sélectionnées (groupe/relais)
  const getSelectedOptionsRef = useRef(null);
  function registerGetSelected(fn) {
    getSelectedOptionsRef.current = fn;
  }

  // Helpers
  function defaultCoureur() {
    return {
      coureur_id: null,
      format_id: "",
      nom: "",
      prenom: "",
      genre: "",
      date_naissance: "",
      nationalite: "",
      email: "",
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
      justificatif_url: "",
      contact_urgence_nom: "",
      contact_urgence_telephone: "",
    };
  }

  function setField(name, value) {
    setInscription((prev) => ({ ...prev, [name]: value }));
  }

  const hasJustificatif = (obj) => {
    const type = String(obj?.justificatif_type || "").trim();

    const allowed = Array.isArray(justifPolicy?.allowed_types) ? justifPolicy.allowed_types.map(String) : [];
    if (justifPolicy?.is_required && allowed.length > 0) {
      if (!type) return false;
      if (!allowed.includes(type)) return false;
    }

    const hasLicence = !!String(obj?.numero_licence || "").trim();
    const hasPps = !!String(obj?.pps_identifier || "").trim();
    const hasUpload = !!String(obj?.justificatif_url || "").trim();

    if (justifPolicy?.allow_medical_upload) return hasLicence || hasPps || hasUpload;
    return hasLicence || hasPps;
  };

  useEffect(() => {
    let mounted = true;

    async function fetchAll() {
      setLoading(true);

      // Course + formats
      const { data, error } = await supabase
        .from("courses")
        .select(
          `
          *,
          formats (
            id, nom, prix, prix_equipe, date, distance_km, denivele_dplus,
            nb_max_coureurs, type_format,
            team_size, nb_coureurs_min, nb_coureurs_max,
            inscription_ouverture, inscription_fermeture,
            fuseau_horaire, waitlist_enabled,
            age_minimum
          )
        `
        )
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

      // ✅ Policy globale justificatifs (course_justificatif_policies / format_id IS NULL)
      try {
        const { data: pol, error: polErr } = await supabase
          .from("course_justificatif_policies")
          .select("*")
          .eq("course_id", courseId)
          .is("format_id", null)
          .maybeSingle();
        if (!polErr && pol) {
          setJustifPolicy({
            is_required: pol.is_required !== false,
            allow_medical_upload: !!pol.allow_medical_upload,
            allowed_types: Array.isArray(pol.allowed_types) ? pol.allowed_types.filter(Boolean) : [],
            notes: pol.notes || "",
          });
        }
      } catch (e) {
        console.error("❌ load justif policy:", e);
      }

      // ✅ Catalogue types (affichage labels)
      try {
        const { data: jt, error: jtErr } = await supabase
          .from("justificatif_types")
          .select("code,label,federation_code,input_mode,is_medical,sort_order,is_active")
          .eq("is_active", true)
          .order("sort_order", { ascending: true });
        if (!jtErr) setJustifTypes(jt || []);
      } catch (e) {
        console.error("❌ load justificatif_types:", e);
      }

      // Préremplir profil si connecté
      const session = await supabase.auth.getSession();
      const user = session.data?.session?.user;
      if (user) {
        const { data: profil } = await supabase.from("profils_utilisateurs").select("*").eq("user_id", user.id).maybeSingle();

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
            apparaitre_resultats: typeof profil.apparaitre_resultats === "boolean" ? profil.apparaitre_resultats : true,
            club: profil.club ?? "",
            justificatif_type: profil.justificatif_type ?? "",
            numero_licence: profil.numero_licence ?? "",
            pps_identifier: profil.pps_identifier ?? "",
            justificatif_url: profil.justificatif_url ?? "",
            contact_urgence_nom: profil.contact_urgence_nom ?? "",
            contact_urgence_telephone: profil.contact_urgence_telephone ?? "",
            coureur_id: user.id,
          }));
        }
      }

      setLoading(false);
    }

    fetchAll();
    return () => {
      mounted = false;
    };
  }, [courseId]);

  const selectedFormat = useMemo(() => formats.find((f) => f.id === inscription.format_id), [formats, inscription.format_id]);

  const isFormatFull = useMemo(() => {
    if (!selectedFormat) return false;
    const max = Number(selectedFormat.nb_max_coureurs || 0);
    if (!max) return false;
    return Number(selectedFormat.inscrits || 0) >= max;
  }, [selectedFormat]);

  // Fenêtre d’inscriptions (hint client)
  const registrationWindow = useMemo(() => {
    if (!selectedFormat) return { isOpen: true, reason: "" };
    const now = new Date();
    const openAt = selectedFormat.inscription_ouverture ? new Date(selectedFormat.inscription_ouverture) : null;
    const closeAt = selectedFormat.inscription_fermeture ? new Date(selectedFormat.inscription_fermeture) : null;
    if (openAt && now < openAt) return { isOpen: false, reason: `Ouvre le ${openAt.toLocaleString()}` };
    if (closeAt && now > closeAt) return { isOpen: false, reason: `Fermé depuis le ${closeAt.toLocaleString()}` };
    return { isOpen: true, reason: "" };
  }, [selectedFormat]);

  // Estimation équipes (multi)
  const estimationEquipe = useMemo(() => {
    if (!selectedFormat || mode === "individuel") return 0;
    const fee = Number(selectedFormat.prix_equipe || 0) || 0;
    const prixUnitaire = Number(selectedFormat.prix || 0) || 0;
    const sum = teams.reduce((acc, t) => acc + (t.team_size || 0) * prixUnitaire + fee, 0);
    return sum;
  }, [selectedFormat, mode, teams]);

  // ----- Gestion équipes -----
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
    setTeams((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], team_name: name };
      return copy;
    });
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
    setTeams((prev) => [...prev, defaultTeam("Équipe " + n, selectedFormat?.team_size || minTeam)]);
  }

  function removeTeam(idx) {
    setTeams((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

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
    return team.members.every((m) => {
      const baseOk = m.nom?.trim() && m.prenom?.trim() && m.genre && m.date_naissance;
      if (!baseOk) return false;
      if (!justifPolicy?.is_required) return true;
      return hasJustificatif(m);
    });
  }

  function calculerAge(dateNaissanceStr) {
    if (!dateNaissanceStr) return null;
    const dob = new Date(dateNaissanceStr);
    if (Number.isNaN(dob.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
  }

  // ✅ Upload justificatif (photo/pdf) — stockage (INDIVIDUEL)
  async function handleUploadJustificatif(file) {
    if (!file) return;
    setJustifUploading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const user = sess?.session?.user;
      if (!user) {
        alert("Connecte-toi pour importer un justificatif.");
        return;
      }

      const bucket = "ppsjustificatifs";
      const safeName = String(file.name || "justificatif")
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .slice(0, 80);

      const path = `justif/${courseId}/${user.id}/${Date.now()}-${safeName}`;

      const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
      if (error) throw error;

      const publicUrl = supabase.storage.from(bucket).getPublicUrl(data.path).data.publicUrl;
      setField("justificatif_url", publicUrl);
    } catch (e) {
      console.error("❌ upload justificatif:", e);
      alert("Erreur lors de l’upload du justificatif.");
    } finally {
      setJustifUploading(false);
    }
  }

  // ----- Paiement / Waitlist -----
  async function handlePay() {
    if (submitting) return;
    setSubmitting(true);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const user = sess?.session?.user;

      if (!user) {
        alert("Veuillez vous connecter pour continuer.");
        setSubmitting(false);
        return;
      }
      if (!inscription.format_id) {
        alert("Veuillez sélectionner un format.");
        setSubmitting(false);
        return;
      }
      if (!registrationWindow.isOpen) {
        alert(`Inscriptions non ouvertes : ${registrationWindow.reason}`);
        setSubmitting(false);
        return;
      }

      const ageMin = selectedFormat?.age_minimum ? Number(selectedFormat.age_minimum) : null;

      // ----- Contrôle âge minimum : individuel -----
      if (mode === "individuel" && ageMin) {
        if (!inscription.date_naissance) {
          alert(`Veuillez renseigner votre date de naissance pour vérifier l'âge minimum (${ageMin} ans).`);
          setSubmitting(false);
          return;
        }
        const age = calculerAge(inscription.date_naissance);
        if (age === null || age < ageMin) {
          alert(`L'âge minimum pour ce format est de ${ageMin} ans. (Âge calculé : ${age ?? "inconnu"})`);
          setSubmitting(false);
          return;
        }
      }

      // ✅ Contrôle justificatifs (individuel) selon policy globale
      if (mode === "individuel" && justifPolicy?.is_required) {
        if (!hasJustificatif(inscription)) {
          alert("Justificatif obligatoire : choisis un type + renseigne un N° licence/PPS ou importe un justificatif.");
          setSubmitting(false);
          return;
        }
      }

      const payerEmail = inscription.email || user.email || user.user_metadata?.email || "";
      if (!payerEmail) {
        alert("Veuillez renseigner un email.");
        setSubmitting(false);
        return;
      }

      // ===== INDIVIDUEL =====
      if (mode === "individuel") {
        // ✅ Si complet + waitlist activée => inscription en liste d’attente (pas de Stripe)
        if (isFormatFull && selectedFormat?.waitlist_enabled) {
          const trace_id = uuidv4();

          const { data: inserted, error: insertErr } = await supabase
            .from("inscriptions")
            .insert([
              {
                ...inscription,
                course_id: courseId,
                format_id: inscription.format_id,
                statut: "liste_attente",
                is_waitlist: true,
                paiement_trace_id: trace_id,
              },
            ])
            .select()
            .single();

          if (insertErr || !inserted) {
            console.error("❌ Erreur insertion waitlist :", insertErr);
            alert("Erreur lors de l'enregistrement en liste d'attente.");
            setSubmitting(false);
            return;
          }

          // On persiste quand même les options en pending (elles pourront être reprises à l’acceptation)
          if (persistOptionsFnRef.current) {
            await persistOptionsFnRef.current(inserted.id);
          }

          setWaitlistCreated({ id: inserted.id, email: payerEmail });
          setSubmitting(false);
          return;
        }

        // Si complet et pas de waitlist
        if (isFormatFull && !selectedFormat?.waitlist_enabled) {
          alert(`Le format ${selectedFormat?.nom || ""} est complet.`);
          setSubmitting(false);
          return;
        }

        const trace_id = uuidv4();

        // Inscription “en attente” (paiement)
        const { data: inserted, error: insertErr } = await supabase
          .from("inscriptions")
          .insert([
            {
              ...inscription,
              course_id: courseId,
              format_id: inscription.format_id,
              statut: "en attente",
              paiement_trace_id: trace_id,
            },
          ])
          .select()
          .single();

        if (insertErr || !inserted) {
          console.error("❌ Erreur insertion inscription :", insertErr);
          alert("Erreur lors de l'enregistrement de l'inscription.");
          setSubmitting(false);
          return;
        }

        // Persister les options en 'pending'
        if (persistOptionsFnRef.current) {
          await persistOptionsFnRef.current(inserted.id);
        }

        const { data, error: fnError } = await supabase.functions.invoke("create-checkout-session", {
          body: {
            user_id: user.id,
            course_id: courseId,
            inscription_id: inserted.id,
            email: payerEmail,
            trace_id,
            successUrl: "https://www.tickrace.com/merci",
            cancelUrl: "https://www.tickrace.com/paiement-annule",
            options_total_eur: (totalOptionsCents || 0) / 100,
          },
        });

        if (fnError || !data?.url) {
          console.error("❌ create-checkout-session error:", fnError, data);
          alert("Erreur lors de la création du paiement.");
          setSubmitting(false);
          return;
        }
        window.location.href = data.url;
        return;
      }

      // ===== GROUPE / RELAIS =====
      const full = isFormatFull;

      if (full && !selectedFormat?.waitlist_enabled) {
        alert(`Le format ${selectedFormat?.nom || ""} est complet.`);
        setSubmitting(false);
        return;
      }

      for (const [idx, team] of teams.entries()) {
        if (!team.team_name || !team.team_size) {
          alert(`Équipe #${idx + 1} : nom et taille requis.`);
          setSubmitting(false);
          return;
        }
        if (team.members.length !== team.team_size) {
          alert(`Équipe #${idx + 1} : le nombre de membres doit être ${team.team_size}.`);
          setSubmitting(false);
          return;
        }

        const bad = team.members.find((m) => {
          const baseOk = m.nom?.trim() && m.prenom?.trim() && m.genre && m.date_naissance;
          if (!baseOk) return true;
          if (justifPolicy?.is_required && !hasJustificatif(m)) return true;
          return false;
        });

        if (bad) {
          alert(
            `Équipe #${idx + 1} : chaque coureur doit avoir nom, prénom, sexe, date de naissance` +
              (justifPolicy?.is_required ? " et un justificatif conforme." : ".")
          );
          setSubmitting(false);
          return;
        }

        if (ageMin) {
          const jeune = team.members.find((m) => {
            const age = calculerAge(m.date_naissance);
            return age !== null && age < ageMin;
          });
          if (jeune) {
            alert(`Équipe #${idx + 1} : un membre ne respecte pas l'âge minimum de ${ageMin} ans.`);
            setSubmitting(false);
            return;
          }
        }
      }

      const teamsForPayload = teams.map((t) => ({
        team_name: t.team_name,
        team_size: t.team_size,
        category: computeTeamCategory(t),
        members: t.members,
      }));

      const selected_options = getSelectedOptionsRef.current ? getSelectedOptionsRef.current() : [];

      let body = {
        mode,
        format_id: inscription.format_id,
        user_id: user.id,
        course_id: courseId,
        email: payerEmail,
        successUrl: "https://www.tickrace.com/merci",
        cancelUrl: "https://www.tickrace.com/paiement-annule",
        options_total_eur: (totalOptionsCents || 0) / 100,
        selected_options,
      };

      if (teams.length > 1) {
        body = { ...body, teams: teamsForPayload };
      } else {
        body = {
          ...body,
          team_name: teamsForPayload[0].team_name,
          team_size: teamsForPayload[0].team_size,
          category: teamsForPayload[0].category,
          members: teamsForPayload[0].members,
        };
      }

      const { data, error: fnError } = await supabase.functions.invoke("create-checkout-session", { body });

      if (fnError || !data?.url) {
        console.error("❌ create-checkout-session error:", fnError, data);
        alert(fnError?.message || "Erreur lors de la création du paiement.");
        setSubmitting(false);
        return;
      }

      window.location.href = data.url;
    } finally {
      // submitting reste true jusqu'à la redirection (ou reset en cas de waitlist/erreur)
    }
  }

  // --- UI ---
  if (loading) {
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

  if (!course || formats.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <p className="text-neutral-600">Aucun format disponible pour cette course.</p>
      </div>
    );
  }

  const placesRestantes = selectedFormat
    ? Math.max(0, Number(selectedFormat.nb_max_coureurs || 0) - Number(selectedFormat.inscrits || 0))
    : null;

  const basePriceIndivEUR = selectedFormat ? Number(selectedFormat.prix || 0) : 0;
  const indivWaitlistMode = mode === "individuel" && !!selectedFormat?.waitlist_enabled && isFormatFull;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link to={`/courses/${courseId}`} className="text-sm text-neutral-500 hover:text-neutral-800">
            ← Retour à la course
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold mt-1">{course.nom}</h1>
          <p className="text-neutral-600 mt-1">
            {mode === "individuel" ? "Inscription individuelle" : mode === "groupe" ? "Inscription en groupe" : "Inscription relais"}
            {selectedFormat?.inscription_ouverture || selectedFormat?.inscription_fermeture ? (
              <>
                {" • "}
                <span className="text-neutral-700">
                  {selectedFormat.inscription_ouverture && <>Ouverture : {new Date(selectedFormat.inscription_ouverture).toLocaleString()} </>}
                  {selectedFormat.inscription_fermeture && <> / Fermeture : {new Date(selectedFormat.inscription_fermeture).toLocaleString()} </>}
                </span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      {/* ✅ Confirmation liste d’attente */}
      {waitlistCreated && (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="font-semibold text-emerald-900">✅ Inscription enregistrée en liste d’attente</div>
          <div className="mt-1 text-sm text-emerald-900/80">
            Tu seras contacté(e) à <b>{waitlistCreated.email}</b> si une place se libère.
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate(`/courses/${courseId}`)}
              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
            >
              Retour à la course
            </button>
            <button
              type="button"
              onClick={() => setWaitlistCreated(null)}
              className="rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100/40"
            >
              Nouvelle inscription
            </button>
          </div>
          <div className="mt-3 text-xs text-emerald-900/70">(Aucun paiement n’a été demandé : la place devra être acceptée avant de payer.)</div>
        </div>
      )}

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
                  setWaitlistCreated(null);

                  const f = formats.find((ff) => ff.id === e.target.value);
                  const newMode = f?.type_format || "individuel";
                  setMode(newMode);

                  if (newMode === "individuel") {
                    setTeams([defaultTeam("Équipe 1", 0)]);
                  } else {
                    const def = f?.team_size || f?.nb_coureurs_min || 1;
                    setTeams([defaultTeam("Équipe 1", def)]);
                  }

                  setTotalOptionsCents(0);
                }}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:ring-2 focus:ring-black"
                required
              >
                <option value="">-- Sélectionnez un format --</option>
                {formats.map((f) => {
                  const max = Number(f.nb_max_coureurs || 0);
                  const full = max ? Number(f.inscrits) >= max : false;
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
                  {selectedFormat.waitlist_enabled && placesRestantes === 0 && <span className="ml-2 text-amber-700">(Liste d’attente possible)</span>}
                  {!registrationWindow.isOpen && <span className="ml-2 text-red-600">— {registrationWindow.reason}</span>}
                </div>
              )}

              {/* Sélecteur de mode */}
              {selectedFormat && selectedFormat.type_format !== "individuel" && (
                <div className="mt-3">
                  <div className="text-sm font-medium mb-1">Type d’inscription</div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMode("individuel")}
                      className={`px-3 py-1.5 rounded-xl border text-sm ${
                        mode === "individuel" ? "bg-black text-white border-black" : "bg-white hover:bg-neutral-50"
                      }`}
                    >
                      Individuel
                    </button>
                    {selectedFormat.type_format === "groupe" && (
                      <button
                        type="button"
                        onClick={() => setMode("groupe")}
                        className={`px-3 py-1.5 rounded-xl border text-sm ${
                          mode === "groupe" ? "bg-black text-white border-black" : "bg-white hover:bg-neutral-50"
                        }`}
                      >
                        Groupe
                      </button>
                    )}
                    {selectedFormat.type_format === "relais" && (
                      <button
                        type="button"
                        onClick={() => setMode("relais")}
                        className={`px-3 py-1.5 rounded-xl border text-sm ${
                          mode === "relais" ? "bg-black text-white border-black" : "bg-white hover:bg-neutral-50"
                        }`}
                      >
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
                  <p className="text-sm text-neutral-500">
                    Renseigne le nom de l’équipe, la taille, puis chaque coureur (avec justificatif si obligatoire).
                  </p>
                </div>
                <div className="flex gap-2">
                  {mode !== "groupe" && (
                    <button
                      type="button"
                      onClick={addTeam}
                      className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
                    >
                      + Ajouter une équipe
                    </button>
                  )}
                </div>
              </div>

              {/* Filtres */}
              <div className="px-5 pt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  className="rounded-xl border border-neutral-300 px-3 py-2"
                  placeholder="Rechercher une équipe…"
                  value={teamFilter.q}
                  onChange={(e) => setTeamFilter((p) => ({ ...p, q: e.target.value }))}
                />
                <select
                  className="rounded-xl border border-neutral-300 px-3 py-2"
                  value={teamFilter.category}
                  onChange={(e) => setTeamFilter((p) => ({ ...p, category: e.target.value }))}
                >
                  <option value="all">Toutes catégories</option>
                  <option value="masculine">Équipe masculine</option>
                  <option value="feminine">Équipe féminine</option>
                  <option value="mixte">Équipe mixte</option>
                </select>
                <label className="inline-flex items-center gap-2 text-sm text-neutral-800">
                  <input
                    type="checkbox"
                    checked={teamFilter.completeOnly}
                    onChange={(e) => setTeamFilter((p) => ({ ...p, completeOnly: e.target.checked }))}
                  />
                  Afficher uniquement les équipes complètes
                </label>
              </div>

              <div className="p-5 space-y-6">
                {teams
                  .map((t) => ({ ...t, category: computeTeamCategory(t) }))
                  .filter((t) => (teamFilter.q ? (t.team_name || "").toLowerCase().includes(teamFilter.q.toLowerCase()) : true))
                  .filter((t) => (teamFilter.category === "all" ? true : t.category === teamFilter.category))
                  .filter((t) => (!teamFilter.completeOnly ? true : isTeamComplete(t)))
                  .map((team, tIdx) => (
                    <div key={tIdx} className="rounded-xl ring-1 ring-neutral-200 bg-neutral-50 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="font-medium flex items-center gap-2">
                          {team.team_name || `Équipe ${tIdx + 1}`}
                          {computeTeamCategory(team) && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-900">
                              {computeTeamCategory(team) === "masculine"
                                ? "Équipe masculine"
                                : computeTeamCategory(team) === "feminine"
                                ? "Équipe féminine"
                                : "Équipe mixte"}
                            </span>
                          )}
                          {isTeamComplete(team) ? (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">complète</span>
                          ) : (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">incomplète</span>
                          )}
                        </div>
                        {teams.length > 1 && (
                          <button type="button" onClick={() => removeTeam(tIdx)} className="text-sm text-neutral-600 hover:text-red-600">
                            Supprimer
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                        <div>
                          <label className="text-sm font-medium">Nom d’équipe</label>
                          <input
                            className="mt-1 rounded-xl border border-neutral-300 px-3 py-2 w-full"
                            value={team.team_name}
                            onChange={(e) => setTeamNameAt(tIdx, e.target.value)}
                            placeholder={`Équipe ${tIdx + 1}`}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">
                            Taille de l’équipe {selectedFormat?.team_size ? `(par défaut ${selectedFormat.team_size})` : ""}
                          </label>
                          <input
                            type="number"
                            className="mt-1 rounded-xl border border-neutral-300 px-3 py-2 w-full"
                            value={team.team_size || selectedFormat?.team_size || 0}
                            min={minTeam}
                            max={maxTeam}
                            onChange={(e) => setTeamSizeAt(tIdx, e.target.value)}
                          />
                          <p className="text-xs text-neutral-500 mt-1">
                            Min {minTeam} — Max {maxTeam}
                          </p>
                        </div>
                      </div>

                      {/* Coureurs */}
                      <div className="space-y-4">
                        {(team.members || []).map((m, mIdx) => {
                          const okBase = m.nom?.trim() && m.prenom?.trim() && m.genre && m.date_naissance;
                          const okJustif = !justifPolicy?.is_required ? true : hasJustificatif(m);

                          return (
                            <div key={mIdx} className="rounded-xl border border-neutral-200 bg-white p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div className="font-semibold text-neutral-900">Coureur {mIdx + 1}</div>
                                <div className="flex items-center gap-2">
                                  {okBase && okJustif ? (
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">ok</span>
                                  ) : (
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">à compléter</span>
                                  )}
                                </div>
                              </div>

                              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                                <input
                                  className="rounded-xl border border-neutral-300 px-3 py-2"
                                  value={m.nom}
                                  onChange={(e) => setMemberAt(tIdx, mIdx, "nom", e.target.value)}
                                  placeholder="Nom *"
                                />
                                <input
                                  className="rounded-xl border border-neutral-300 px-3 py-2"
                                  value={m.prenom}
                                  onChange={(e) => setMemberAt(tIdx, mIdx, "prenom", e.target.value)}
                                  placeholder="Prénom *"
                                />
                                <select
                                  className="rounded-xl border border-neutral-300 px-3 py-2"
                                  value={m.genre || ""}
                                  onChange={(e) => setMemberAt(tIdx, mIdx, "genre", e.target.value)}
                                >
                                  <option value="">Genre *</option>
                                  <option value="Homme">Homme</option>
                                  <option value="Femme">Femme</option>
                                </select>
                                <input
                                  type="date"
                                  className="rounded-xl border border-neutral-300 px-3 py-2"
                                  value={m.date_naissance || ""}
                                  onChange={(e) => setMemberAt(tIdx, mIdx, "date_naissance", e.target.value)}
                                />
                                <input
                                  className="rounded-xl border border-neutral-300 px-3 py-2 md:col-span-2"
                                  value={m.email || ""}
                                  onChange={(e) => setMemberAt(tIdx, mIdx, "email", e.target.value)}
                                  placeholder="Email (optionnel)"
                                />
                              </div>

                              {/* Justificatif par coureur */}
                              <div className="mt-4 pt-4 border-t border-neutral-200">
                                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                                  <JustificatifInscriptionBlock
                                    policy={justifPolicy}
                                    types={justifTypes}
                                    value={m}
                                    onPatch={(p) => {
                                      setTeams((prev) => {
                                        const copy = [...prev];
                                        const team2 = { ...copy[tIdx] };
                                        const members2 = [...team2.members];
                                        members2[mIdx] = { ...members2[mIdx], ...p };
                                        team2.members = members2;
                                        copy[tIdx] = team2;
                                        return copy;
                                      });
                                    }}
                                    // upload équipe désactivé
                                    disableUpload={true}
                                    title="Justificatif"
                                  />
                                  <div className="mt-2 text-xs text-neutral-500">(Upload en équipe désactivé pour l’instant.)</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {team.team_size === 0 && <div className="text-sm text-neutral-500">Indique une taille d’équipe pour générer les coureurs.</div>}
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* Infos coureur : INDIVIDUEL */}
          {mode === "individuel" && (
            <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="p-5 border-b border-neutral-100">
                <h2 className="text-lg font-semibold">Informations coureur</h2>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    className="rounded-xl border border-neutral-300 px-3 py-2"
                    name="nom"
                    placeholder="Nom"
                    value={inscription.nom}
                    onChange={(e) => setField("nom", e.target.value)}
                  />
                  <input
                    className="rounded-xl border border-neutral-300 px-3 py-2"
                    name="prenom"
                    placeholder="Prénom"
                    value={inscription.prenom}
                    onChange={(e) => setField("prenom", e.target.value)}
                  />
                  <select
                    className="rounded-xl border border-neutral-300 px-3 py-2"
                    name="genre"
                    value={inscription.genre}
                    onChange={(e) => setField("genre", e.target.value)}
                  >
                    <option value="">Genre</option>
                    <option value="Homme">Homme</option>
                    <option value="Femme">Femme</option>
                  </select>
                  <input
                    type="date"
                    className="rounded-xl border border-neutral-300 px-3 py-2"
                    name="date_naissance"
                    value={inscription.date_naissance}
                    onChange={(e) => setField("date_naissance", e.target.value)}
                  />
                  <input
                    className="rounded-xl border border-neutral-300 px-3 py-2"
                    name="nationalite"
                    placeholder="Nationalité"
                    value={inscription.nationalite}
                    onChange={(e) => setField("nationalite", e.target.value)}
                  />
                  <input
                    className="rounded-xl border border-neutral-300 px-3 py-2"
                    name="email"
                    placeholder="Email"
                    value={inscription.email}
                    onChange={(e) => setField("email", e.target.value)}
                  />
                  <input
                    className="rounded-xl border border-neutral-300 px-3 py-2"
                    name="telephone"
                    placeholder="Téléphone"
                    value={inscription.telephone}
                    onChange={(e) => setField("telephone", e.target.value)}
                  />
                  <input
                    className="rounded-xl border border-neutral-300 px-3 py-2 md:col-span-2"
                    name="adresse"
                    placeholder="Adresse"
                    value={inscription.adresse}
                    onChange={(e) => setField("adresse", e.target.value)}
                  />
                  <input
                    className="rounded-xl border border-neutral-300 px-3 py-2"
                    name="adresse_complement"
                    placeholder="Complément adresse"
                    value={inscription.adresse_complement}
                    onChange={(e) => setField("adresse_complement", e.target.value)}
                  />
                  <input
                    className="rounded-xl border border-neutral-300 px-3 py-2"
                    name="code_postal"
                    placeholder="Code postal"
                    value={inscription.code_postal}
                    onChange={(e) => setField("code_postal", e.target.value)}
                  />
                  <input
                    className="rounded-xl border border-neutral-300 px-3 py-2"
                    name="ville"
                    placeholder="Ville"
                    value={inscription.ville}
                    onChange={(e) => setField("ville", e.target.value)}
                  />
                  <input
                    className="rounded-xl border border-neutral-300 px-3 py-2"
                    name="pays"
                    placeholder="Pays"
                    value={inscription.pays}
                    onChange={(e) => setField("pays", e.target.value)}
                  />
                  <input
                    className="rounded-xl border border-neutral-300 px-3 py-2"
                    name="club"
                    placeholder="Club"
                    value={inscription.club}
                    onChange={(e) => setField("club", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Affichage des résultats</p>
                  <div className="flex gap-4 text-sm text-neutral-700">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="apparaitre_resultats"
                        checked={inscription.apparaitre_resultats === true}
                        onChange={() => setField("apparaitre_resultats", true)}
                      />
                      Oui
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="apparaitre_resultats"
                        checked={inscription.apparaitre_resultats === false}
                        onChange={() => setField("apparaitre_resultats", false)}
                      />
                      Non
                    </label>
                  </div>
                </div>

                {/* ✅ Justificatifs (policy globale) */}
                <div className="pt-4 border-t border-neutral-200">
                  <JustificatifInscriptionBlock
                    policy={justifPolicy}
                    types={justifTypes}
                    value={inscription}
                    onPatch={(p) => setInscription((prev) => ({ ...prev, ...p }))}
                    onUploadFile={justifPolicy.allow_medical_upload ? handleUploadJustificatif : undefined}
                    uploading={justifUploading}
                    disableUpload={!justifPolicy.allow_medical_upload}
                    title="Justificatifs"
                  />
                </div>
              </div>
            </section>
          )}

          {/* Options payantes (en bas) */}
          {selectedFormat && (mode === "individuel" || mode === "groupe" || mode === "relais") && (
            <OptionsPayantesPicker
              formatId={selectedFormat.id}
              onTotalCentsChange={(c) => setTotalOptionsCents(c)}
              registerPersist={registerPersist}
              registerGetSelected={registerGetSelected}
            />
          )}
        </div>

        {/* Résumé / paiement */}
        <aside className="lg:col-span-1">
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm sticky top-6">
            <div className="p-5 border-b border-neutral-100">
              <h3 className="text-lg font-semibold">Résumé</h3>
              <p className="text-sm text-neutral-500">
                {indivWaitlistMode ? "Format complet : inscription en liste d’attente (sans paiement)." : "Vérifie les informations puis procède au paiement."}
              </p>
            </div>

            <div className="p-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-600">Format</span>
                <span className="font-medium">{selectedFormat ? selectedFormat.nom : "—"}</span>
              </div>

              {/* Résumé équipes */}
              {mode !== "individuel" && (
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
                        <div className="flex justify-between">
                          <span>Équipes</span>
                          <b>{totals.count}</b>
                        </div>
                        <div className="flex justify-between">
                          <span>Participants</span>
                          <b>{totals.participants}</b>
                        </div>
                        <div className="flex justify-between">
                          <span>Masculines</span>
                          <b>{totals.masculine}</b>
                        </div>
                        <div className="flex justify-between">
                          <span>Féminines</span>
                          <b>{totals.feminine}</b>
                        </div>
                        <div className="flex justify-between">
                          <span>Mixtes</span>
                          <b>{totals.mixte}</b>
                        </div>
                        <div className="flex justify-between">
                          <span>Équipes complètes</span>
                          <b>{totals.completes}</b>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {mode === "individuel" ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">{indivWaitlistMode ? "Montant (estimation)" : "Inscription"}</span>
                    <span className="font-medium">{selectedFormat ? Number(selectedFormat.prix || 0).toFixed(2) : "0.00"} €</span>
                  </div>
                  {totalOptionsCents > 0 && (
                    <div className="flex justify-between">
                      <span className="text-neutral-600">{indivWaitlistMode ? "Options (estimation)" : "Options payantes"}</span>
                      <span className="font-medium">{(totalOptionsCents / 100).toFixed(2)} €</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {teams.map((t, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-neutral-600">
                        {t.team_name || `Équipe ${i + 1}`} — {t.team_size} pers.
                      </span>
                      <span className="font-medium">
                        ~{(Number(selectedFormat?.prix || 0) * (t.team_size || 0) + (Number(selectedFormat?.prix_equipe || 0) || 0)).toFixed(2)} €
                      </span>
                    </div>
                  ))}
                  {totalOptionsCents > 0 && (
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Options payantes</span>
                      <span className="font-medium">{(totalOptionsCents / 100).toFixed(2)} €</span>
                    </div>
                  )}
                  <div className="h-px bg-neutral-200 my-2" />
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Sous-total estimé</span>
                    <span className="font-medium">~{(Number(estimationEquipe || 0) + totalOptionsCents / 100).toFixed(2)} €</span>
                  </div>
                </>
              )}

              <div className="h-px bg-neutral-200 my-2" />

              <div className="flex justify-between text-base">
                <span className="font-semibold">{indivWaitlistMode ? "Estimation" : "Total"}</span>
                <span className="font-bold">
                  {mode === "individuel"
                    ? (basePriceIndivEUR + totalOptionsCents / 100).toFixed(2)
                    : `~${(Number(estimationEquipe || 0) + totalOptionsCents / 100).toFixed(2)}`}{" "}
                  €
                </span>
              </div>

              {indivWaitlistMode && (
                <div className="text-xs text-amber-800">
                  Paiement non demandé maintenant : il sera proposé uniquement si l’organisateur accepte une place.
                </div>
              )}
            </div>

            <div className="p-5">
              <button
                type="button"
                onClick={handlePay}
                disabled={
                  submitting ||
                  !inscription.format_id ||
                  !registrationWindow.isOpen ||
                  (mode === "individuel" && selectedFormat && !selectedFormat.waitlist_enabled && isFormatFull)
                }
                className={`w-full rounded-xl px-4 py-3 text-white font-semibold transition ${
                  submitting ? "bg-neutral-400 cursor-not-allowed" : "bg-neutral-900 hover:bg-black"
                }`}
              >
                {submitting
                  ? "Traitement…"
                  : indivWaitlistMode
                  ? "S’inscrire en liste d’attente"
                  : mode === "individuel"
                  ? "Confirmer et payer"
                  : "Payer les équipes"}
              </button>

              {selectedFormat && isFormatFull && (
                <p className="text-xs text-amber-700 mt-2">
                  {selectedFormat.waitlist_enabled
                    ? "Capacité atteinte : en individuel, vous pouvez vous inscrire en liste d’attente."
                    : "Ce format est complet."}
                </p>
              )}

              {!registrationWindow.isOpen && <p className="text-xs text-red-600 mt-2">{registrationWindow.reason}</p>}

              <p className="text-xs text-neutral-500 mt-3">En confirmant, vous acceptez les conditions de l’épreuve et de Tickrace.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
