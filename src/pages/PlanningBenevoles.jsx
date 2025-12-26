// src/pages/PlanningBenevoles.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  Edit3,
  Loader2,
  MapPin,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  Users,
  AlertTriangle,
  X,
} from "lucide-react";

/* ------------------------------ UI Helpers ------------------------------ */

const Container = ({ children }) => (
  <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
);

const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200 ${className}`}>{children}</div>
);

const Pill = ({ tone = "gray", children }) => {
  const map = {
    gray: "bg-neutral-100 text-neutral-700 ring-neutral-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    orange: "bg-orange-50 text-orange-700 ring-orange-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
  };
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ring-1 ${map[tone]}`}>
      {children}
    </span>
  );
};

const Btn = ({ variant = "dark", className = "", ...props }) => {
  const variants = {
    dark: "bg-neutral-900 text-white hover:bg-neutral-800",
    light: "bg-white text-neutral-900 ring-1 ring-neutral-200 hover:bg-neutral-50",
    orange: "bg-orange-600 text-white hover:bg-orange-500",
    subtle: "bg-neutral-100 text-neutral-900 hover:bg-neutral-200",
    danger: "bg-red-600 text-white hover:bg-red-500",
  };
  return (
    <button
      {...props}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        className,
      ].join(" ")}
    />
  );
};

const Input = (props) => (
  <input
    {...props}
    className={[
      "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none",
      "focus:ring-2 focus:ring-orange-300",
      props.className || "",
    ].join(" ")}
  />
);

const Textarea = (props) => (
  <textarea
    {...props}
    className={[
      "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none",
      "focus:ring-2 focus:ring-orange-300",
      props.className || "",
    ].join(" ")}
  />
);

function fmtDateTime(d) {
  try {
    if (!d) return "—";
    const dd = new Date(d);
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(dd);
  } catch {
    return "—";
  }
}

function fmtTime(d) {
  try {
    if (!d) return "—";
    const dd = new Date(d);
    return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(dd);
  } catch {
    return "—";
  }
}

function safe(s) {
  return (s ?? "").toString().trim();
}

function csvCell(s) {
  const v = (s ?? "").toString();
  return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

const AFF_STATUSES = [
  { value: "assigned", label: "Assigné" },
  { value: "confirmed", label: "Confirmé" },
  { value: "declined", label: "Refusé" },
  { value: "checked_in", label: "Présent" },
  { value: "no_show", label: "Absent" },
];

function statusTone(st) {
  if (st === "checked_in" || st === "confirmed") return "green";
  if (st === "declined" || st === "no_show") return "red";
  if (st === "assigned") return "orange";
  return "gray";
}

/* ------------------------------ Modal ------------------------------ */

function Modal({ open, title, subtitle, children, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl ring-1 ring-neutral-200">
        <div className="flex items-start justify-between gap-3 border-b border-neutral-200 p-4">
          <div className="min-w-0">
            <div className="text-lg font-extrabold">{title}</div>
            {subtitle ? <div className="mt-0.5 text-sm text-neutral-600">{subtitle}</div> : null}
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-neutral-700 hover:bg-neutral-100"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

/* ====================================================================== */

export default function PlanningBenevoles() {
  const { courseId } = useParams();
  const nav = useNavigate();

  const { session } = useUser();
  const userId = session?.user?.id || null;

  const [tab, setTab] = useState("affectations"); // postes | creneaux | affectations

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [course, setCourse] = useState(null);
  const [isOrga, setIsOrga] = useState(false);

  const [benevoles, setBenevoles] = useState([]);
  const [postes, setPostes] = useState([]);
  const [creneaux, setCreneaux] = useState([]);
  const [affectations, setAffectations] = useState([]);

  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPoste, setFilterPoste] = useState("all");
  const [filterCreneau, setFilterCreneau] = useState("all");

  const [toast, setToast] = useState("");
  const [err, setErr] = useState("");

  /* ------------------------------ Modals State ------------------------------ */

  const [mPosteOpen, setMPosteOpen] = useState(false);
  const [mPosteEditId, setMPosteEditId] = useState(null);
  const [posteForm, setPosteForm] = useState({
    titre: "",
    lieu: "",
    description: "",
    capacite: 1,
    ordre: 0,
  });

  const [mCreneauOpen, setMCreneauOpen] = useState(false);
  const [mCreneauEditId, setMCreneauEditId] = useState(null);
  const [creneauForm, setCreneauForm] = useState({
    label: "",
    start_at: "",
    end_at: "",
    ordre: 0,
  });

  const [mAffOpen, setMAffOpen] = useState(false);
  const [mAffEditId, setMAffEditId] = useState(null);
  const [affForm, setAffForm] = useState({
    benevole_id: "",
    poste_id: "",
    creneau_id: "",
    status: "assigned",
    note: "",
  });

  /* ------------------------------ Derived ------------------------------ */

  const coverage = useMemo(() => {
    const filledByPoste = new Map();

    affectations.forEach((a) => {
      const pid = a?.poste?.id || a?.poste_id;
      if (!pid) return;
      // On compte comme "occupé": assigned/confirmed/checked_in
      const st = a?.status;
      const ok = ["assigned", "confirmed", "checked_in"].includes(st);
      if (!ok) return;
      filledByPoste.set(pid, (filledByPoste.get(pid) || 0) + 1);
    });

    return postes.map((p) => {
      const filled = filledByPoste.get(p.id) || 0;
      const need = Math.max(0, Number(p.capacite || 0));
      const ratio = need > 0 ? Math.min(100, Math.round((filled / need) * 100)) : 0;
      const done = need > 0 ? filled >= need : true;
      return { id: p.id, titre: p.titre, lieu: p.lieu, filled, need, ratio, done };
    });
  }, [postes, affectations]);

  const filteredAffectations = useMemo(() => {
    const needle = safe(q).toLowerCase();
    return affectations
      .filter((a) => {
        if (filterStatus !== "all" && a.status !== filterStatus) return false;
        if (filterPoste !== "all" && (a?.poste?.id || a.poste_id) !== filterPoste) return false;
        if (filterCreneau !== "all" && (a?.creneau?.id || a.creneau_id) !== filterCreneau) return false;
        if (!needle) return true;

        const b = a?.benevole || {};
        const p = a?.poste || {};
        const c = a?.creneau || {};
        const hay = [
          b.prenom,
          b.nom,
          b.email,
          b.telephone,
          a.status,
          a.note,
          p.titre,
          p.lieu,
          c.label,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return hay.includes(needle);
      })
      .sort((x, y) => {
        const ox = x?.creneau?.ordre ?? 9999;
        const oy = y?.creneau?.ordre ?? 9999;
        if (ox !== oy) return ox - oy;

        const px = (x?.poste?.ordre ?? 9999) - (y?.poste?.ordre ?? 9999);
        if (px !== 0) return px;

        const bx = safe(x?.benevole?.nom).localeCompare(safe(y?.benevole?.nom));
        if (bx !== 0) return bx;

        return (x?.created_at || "").localeCompare(y?.created_at || "");
      });
  }, [affectations, q, filterStatus, filterPoste, filterCreneau]);

  /* ------------------------------ Fetch ------------------------------ */

  const loadAll = async () => {
    if (!courseId) return;
    setLoading(true);
    setErr("");

    try {
      // 1) course
      const { data: c, error: cErr } = await supabase
        .from("courses")
        .select("id, nom, lieu, organisateur_id")
        .eq("id", courseId)
        .maybeSingle();
      if (cErr || !c) throw cErr || new Error("Course introuvable.");
      setCourse(c);

      // 2) check ownership (UI guard)
      const okOrga = !!userId && c.organisateur_id === userId;
      setIsOrga(okOrga);

      // 3) benevoles (course)
      const { data: b, error: bErr } = await supabase
        .from("benevoles")
        .select("id, course_id, user_id, nom, prenom, email, telephone, status, created_at, invite_count, invited_at, last_invite_at")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false });
      if (bErr) throw bErr;
      setBenevoles(b || []);

      // 4) postes
      const { data: p, error: pErr } = await supabase
        .from("benevoles_postes")
        .select("id, course_id, titre, lieu, description, capacite, ordre, created_at")
        .eq("course_id", courseId)
        .order("ordre", { ascending: true })
        .order("created_at", { ascending: true });
      if (pErr) throw pErr;
      setPostes(p || []);

      // 5) creneaux
      const { data: cr, error: crErr } = await supabase
        .from("benevoles_creneaux")
        .select("id, course_id, label, start_at, end_at, ordre, created_at")
        .eq("course_id", courseId)
        .order("ordre", { ascending: true })
        .order("created_at", { ascending: true });
      if (crErr) throw crErr;
      setCreneaux(cr || []);

      // 6) affectations (join)
      const { data: a, error: aErr } = await supabase
        .from("benevoles_affectations")
        .select(
          `
          id, course_id, benevole_id, poste_id, creneau_id,
          status, note, created_at, updated_at,
          benevole:benevoles ( id, nom, prenom, email, telephone ),
          poste:benevoles_postes ( id, titre, lieu, capacite, ordre ),
          creneau:benevoles_creneaux ( id, label, start_at, end_at, ordre )
        `
        )
        .eq("course_id", courseId);

      if (aErr) throw aErr;
      setAffectations(a || []);
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Erreur chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, userId]);

  const toastOk = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  /* ------------------------------ CRUD Postes ------------------------------ */

  const openCreatePoste = () => {
    setMPosteEditId(null);
    setPosteForm({ titre: "", lieu: "", description: "", capacite: 1, ordre: postes.length });
    setMPosteOpen(true);
  };

  const openEditPoste = (p) => {
    setMPosteEditId(p.id);
    setPosteForm({
      titre: p.titre || "",
      lieu: p.lieu || "",
      description: p.description || "",
      capacite: Number(p.capacite || 1),
      ordre: Number(p.ordre || 0),
    });
    setMPosteOpen(true);
  };

  const savePoste = async () => {
    if (!isOrga) return;
    setBusy(true);
    setErr("");
    try {
      const payload = {
        course_id: courseId,
        titre: safe(posteForm.titre),
        lieu: safe(posteForm.lieu) || null,
        description: safe(posteForm.description) || null,
        capacite: Math.max(1, Number(posteForm.capacite || 1)),
        ordre: Number(posteForm.ordre || 0),
      };
      if (!payload.titre) throw new Error("Titre obligatoire.");

      if (mPosteEditId) {
        const { error } = await supabase.from("benevoles_postes").update(payload).eq("id", mPosteEditId);
        if (error) throw error;
        toastOk("Poste mis à jour ✅");
      } else {
        const { error } = await supabase.from("benevoles_postes").insert(payload);
        if (error) throw error;
        toastOk("Poste créé ✅");
      }

      setMPosteOpen(false);
      await loadAll();
    } catch (e) {
      setErr(e?.message || "Erreur sauvegarde poste");
    } finally {
      setBusy(false);
    }
  };

  const deletePoste = async (posteId) => {
    if (!isOrga) return;
    if (!window.confirm("Supprimer ce poste ? (les affectations liées seront supprimées)")) return;

    setBusy(true);
    setErr("");
    try {
      const { error } = await supabase.from("benevoles_postes").delete().eq("id", posteId);
      if (error) throw error;
      toastOk("Poste supprimé ✅");
      await loadAll();
    } catch (e) {
      setErr(e?.message || "Erreur suppression poste");
    } finally {
      setBusy(false);
    }
  };

  /* ------------------------------ CRUD Créneaux ------------------------------ */

  const openCreateCreneau = () => {
    setMCreneauEditId(null);
    setCreneauForm({ label: "", start_at: "", end_at: "", ordre: creneaux.length });
    setMCreneauOpen(true);
  };

  const openEditCreneau = (c) => {
    setMCreneauEditId(c.id);
    setCreneauForm({
      label: c.label || "",
      start_at: c.start_at ? new Date(c.start_at).toISOString().slice(0, 16) : "",
      end_at: c.end_at ? new Date(c.end_at).toISOString().slice(0, 16) : "",
      ordre: Number(c.ordre || 0),
    });
    setMCreneauOpen(true);
  };

  const saveCreneau = async () => {
    if (!isOrga) return;
    setBusy(true);
    setErr("");
    try {
      const payload = {
        course_id: courseId,
        label: safe(creneauForm.label),
        start_at: creneauForm.start_at ? new Date(creneauForm.start_at).toISOString() : null,
        end_at: creneauForm.end_at ? new Date(creneauForm.end_at).toISOString() : null,
        ordre: Number(creneauForm.ordre || 0),
      };
      if (!payload.label) throw new Error("Label obligatoire.");

      if (payload.start_at && payload.end_at) {
        const s = new Date(payload.start_at).getTime();
        const e = new Date(payload.end_at).getTime();
        if (e <= s) throw new Error("La fin doit être après le début.");
      }

      if (mCreneauEditId) {
        const { error } = await supabase.from("benevoles_creneaux").update(payload).eq("id", mCreneauEditId);
        if (error) throw error;
        toastOk("Créneau mis à jour ✅");
      } else {
        const { error } = await supabase.from("benevoles_creneaux").insert(payload);
        if (error) throw error;
        toastOk("Créneau créé ✅");
      }

      setMCreneauOpen(false);
      await loadAll();
    } catch (e) {
      setErr(e?.message || "Erreur sauvegarde créneau");
    } finally {
      setBusy(false);
    }
  };

  const deleteCreneau = async (creneauId) => {
    if (!isOrga) return;
    if (!window.confirm("Supprimer ce créneau ? (les affectations liées seront conservées sans créneau)")) return;

    setBusy(true);
    setErr("");
    try {
      // FK sur affectations: on delete set null -> OK
      const { error } = await supabase.from("benevoles_creneaux").delete().eq("id", creneauId);
      if (error) throw error;
      toastOk("Créneau supprimé ✅");
      await loadAll();
    } catch (e) {
      setErr(e?.message || "Erreur suppression créneau");
    } finally {
      setBusy(false);
    }
  };

  /* ------------------------------ CRUD Affectations ------------------------------ */

  const openCreateAffectation = () => {
    setMAffEditId(null);
    setAffForm({
      benevole_id: "",
      poste_id: postes?.[0]?.id || "",
      creneau_id: "",
      status: "assigned",
      note: "",
    });
    setMAffOpen(true);
  };

  const openEditAffectation = (a) => {
    setMAffEditId(a.id);
    setAffForm({
      benevole_id: a.benevole_id || a?.benevole?.id || "",
      poste_id: a.poste_id || a?.poste?.id || "",
      creneau_id: a.creneau_id || a?.creneau?.id || "",
      status: a.status || "assigned",
      note: a.note || "",
    });
    setMAffOpen(true);
  };

  const saveAffectation = async () => {
    if (!isOrga) return;
    setBusy(true);
    setErr("");
    try {
      const payload = {
        course_id: courseId,
        benevole_id: affForm.benevole_id,
        poste_id: affForm.poste_id,
        creneau_id: affForm.creneau_id || null,
        status: affForm.status || "assigned",
        note: safe(affForm.note) || null,
      };
      if (!payload.benevole_id) throw new Error("Choisis un bénévole.");
      if (!payload.poste_id) throw new Error("Choisis un poste.");

      if (mAffEditId) {
        const { error } = await supabase.from("benevoles_affectations").update(payload).eq("id", mAffEditId);
        if (error) throw error;
        toastOk("Affectation mise à jour ✅");
      } else {
        // anti-dup simple (même bénévole + poste + créneau)
        const exists = affectations.some((a) => {
          const sameB = (a.benevole_id || a?.benevole?.id) === payload.benevole_id;
          const sameP = (a.poste_id || a?.poste?.id) === payload.poste_id;
          const sameC = (a.creneau_id || a?.creneau?.id || null) === (payload.creneau_id || null);
          return sameB && sameP && sameC;
        });
        if (exists) throw new Error("Cette affectation existe déjà.");

        const { error } = await supabase.from("benevoles_affectations").insert(payload);
        if (error) throw error;
        toastOk("Affectation créée ✅");
      }

      setMAffOpen(false);
      await loadAll();
    } catch (e) {
      setErr(e?.message || "Erreur sauvegarde affectation");
    } finally {
      setBusy(false);
    }
  };

  const deleteAffectation = async (affId) => {
    if (!isOrga) return;
    if (!window.confirm("Supprimer cette affectation ?")) return;

    setBusy(true);
    setErr("");
    try {
      const { error } = await supabase.from("benevoles_affectations").delete().eq("id", affId);
      if (error) throw error;
      toastOk("Affectation supprimée ✅");
      await loadAll();
    } catch (e) {
      setErr(e?.message || "Erreur suppression affectation");
    } finally {
      setBusy(false);
    }
  };

  const quickUpdateStatus = async (affId, status) => {
    if (!isOrga) return;
    setBusy(true);
    setErr("");
    try {
      const { error } = await supabase.from("benevoles_affectations").update({ status }).eq("id", affId);
      if (error) throw error;
      await loadAll();
    } catch (e) {
      setErr(e?.message || "Erreur maj statut");
    } finally {
      setBusy(false);
    }
  };

  /* ------------------------------ Export CSV Affectations ------------------------------ */

  const exportAffectationsCSV = () => {
    const headers = [
      "Bénévole",
      "Email",
      "Téléphone",
      "Poste",
      "Lieu poste",
      "Créneau",
      "Début",
      "Fin",
      "Statut",
      "Note",
      "Créé le",
      "Maj le",
    ];
    const lines = [headers.join(";")];

    filteredAffectations.forEach((a) => {
      const b = a?.benevole || {};
      const p = a?.poste || {};
      const c = a?.creneau || {};
      const cols = [
        [b.prenom, b.nom].filter(Boolean).join(" ").trim(),
        b.email || "",
        b.telephone || "",
        p.titre || "",
        p.lieu || "",
        c.label || "",
        c.start_at ? fmtDateTime(c.start_at) : "",
        c.end_at ? fmtDateTime(c.end_at) : "",
        a.status || "",
        a.note || "",
        a.created_at ? fmtDateTime(a.created_at) : "",
        a.updated_at ? fmtDateTime(a.updated_at) : "",
      ];
      lines.push(cols.map(csvCell).join(";"));
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `benevoles-affectations-${courseId}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  /* ------------------------------ Render Guards ------------------------------ */

  if (!userId) {
    return (
      <Container>
        <div className="py-10">
          <h1 className="text-2xl font-extrabold">Planning bénévoles</h1>
          <p className="mt-2 text-neutral-600">Connecte-toi en tant qu’organisateur.</p>
          <div className="mt-4">
            <Btn variant="light" onClick={() => nav("/login")}>
              Aller à la connexion
            </Btn>
          </div>
        </div>
      </Container>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <Container>
          <div className="py-10">
            <div className="flex items-center gap-2 text-neutral-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Container>
        {/* Header */}
        <div className="py-8 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => nav(-1)}
                  className="rounded-xl p-2 text-neutral-700 hover:bg-neutral-100"
                  title="Retour"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h1 className="truncate text-2xl font-extrabold tracking-tight">Planning bénévoles</h1>
              </div>
              <p className="mt-1 text-sm text-neutral-600">
                <span className="font-semibold">{course?.nom || "Course"}</span>{" "}
                {course?.lieu ? (
                  <>
                    · <MapPin className="inline h-4 w-4 -mt-0.5" /> {course.lieu}
                  </>
                ) : null}
              </p>

              {!isOrga ? (
                <div className="mt-3 rounded-2xl bg-orange-50 px-4 py-3 text-sm text-orange-800 ring-1 ring-orange-200">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4" /> Mode lecture
                  </div>
                  <div className="mt-1">
                    Ton compte n’est pas l’organisateur de cette course. Les actions d’édition sont désactivées.
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link to="/mon-espace">
                <Btn variant="light">← Mon espace</Btn>
              </Link>

              <Btn variant="light" onClick={loadAll}>
                <RefreshCcw className="h-4 w-4" /> Actualiser
              </Btn>

              {tab === "postes" ? (
                <Btn variant="orange" onClick={openCreatePoste} disabled={!isOrga || busy}>
                  <Plus className="h-4 w-4" /> Nouveau poste
                </Btn>
              ) : null}

              {tab === "creneaux" ? (
                <Btn variant="orange" onClick={openCreateCreneau} disabled={!isOrga || busy}>
                  <Plus className="h-4 w-4" /> Nouveau créneau
                </Btn>
              ) : null}

              {tab === "affectations" ? (
                <>
                  <Btn variant="light" onClick={exportAffectationsCSV} disabled={filteredAffectations.length === 0}>
                    <Download className="h-4 w-4" /> Export affectations
                  </Btn>
                  <Btn variant="orange" onClick={openCreateAffectation} disabled={!isOrga || busy}>
                    <Plus className="h-4 w-4" /> Affecter
                  </Btn>
                </>
              ) : null}
            </div>
          </div>

          {toast ? (
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
              {toast}
            </div>
          ) : null}

          {err ? (
            <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
              {err}
            </div>
          ) : null}

          {/* Tabs */}
          <Card className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setTab("affectations")}
                className={[
                  "rounded-xl px-3 py-2 text-sm font-semibold transition",
                  tab === "affectations" ? "bg-neutral-900 text-white" : "bg-white text-neutral-700 hover:bg-neutral-50 ring-1 ring-neutral-200",
                ].join(" ")}
              >
                <ClipboardList className="inline h-4 w-4 mr-2" />
                Affectations
              </button>

              <button
                onClick={() => setTab("postes")}
                className={[
                  "rounded-xl px-3 py-2 text-sm font-semibold transition",
                  tab === "postes" ? "bg-neutral-900 text-white" : "bg-white text-neutral-700 hover:bg-neutral-50 ring-1 ring-neutral-200",
                ].join(" ")}
              >
                <Users className="inline h-4 w-4 mr-2" />
                Postes
              </button>

              <button
                onClick={() => setTab("creneaux")}
                className={[
                  "rounded-xl px-3 py-2 text-sm font-semibold transition",
                  tab === "creneaux" ? "bg-neutral-900 text-white" : "bg-white text-neutral-700 hover:bg-neutral-50 ring-1 ring-neutral-200",
                ].join(" ")}
              >
                <CalendarDays className="inline h-4 w-4 mr-2" />
                Créneaux
              </button>

              <div className="ml-auto flex items-center gap-2 text-sm text-neutral-600">
                <Pill tone="gray">
                  <Users className="h-4 w-4" /> {benevoles.length} bénévoles
                </Pill>
                <Pill tone="gray">
                  <ClipboardList className="h-4 w-4" /> {affectations.length} affectations
                </Pill>
              </div>
            </div>
          </Card>

          {/* Coverage quick view */}
          <Card className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="font-extrabold inline-flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" /> Couverture des postes
              </div>
              <Pill tone="gray">assigné/confirmé/présent</Pill>
            </div>

            {coverage.length === 0 ? (
              <div className="mt-3 text-sm text-neutral-600">Crée au moins un poste pour suivre la couverture.</div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {coverage.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-neutral-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-bold">{p.titre}</div>
                        <div className="mt-0.5 text-sm text-neutral-600">{p.lieu || "—"}</div>
                      </div>
                      <Pill tone={p.done ? "green" : "orange"}>
                        {p.filled}/{p.need} {p.done ? "OK" : "manque"}
                      </Pill>
                    </div>

                    <div className="mt-2">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100 ring-1 ring-neutral-200">
                        <div className="h-full bg-neutral-900" style={{ width: `${p.ratio}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Content */}
        {tab === "postes" ? (
          <Card className="overflow-hidden">
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-50 text-neutral-700">
                  <tr>
                    <th className="text-left px-4 py-3">Poste</th>
                    <th className="text-left px-4 py-3">Lieu</th>
                    <th className="text-left px-4 py-3">Capacité</th>
                    <th className="text-left px-4 py-3">Ordre</th>
                    <th className="text-left px-4 py-3">Créé</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {postes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-neutral-600">
                        Aucun poste. Clique “Nouveau poste”.
                      </td>
                    </tr>
                  ) : (
                    postes.map((p) => (
                      <tr key={p.id} className="hover:bg-neutral-50/60">
                        <td className="px-4 py-3 align-top">
                          <div className="font-semibold">{p.titre}</div>
                          {p.description ? <div className="mt-1 text-xs text-neutral-600">{p.description}</div> : null}
                        </td>
                        <td className="px-4 py-3 align-top">{p.lieu || "—"}</td>
                        <td className="px-4 py-3 align-top">{p.capacite}</td>
                        <td className="px-4 py-3 align-top">{p.ordre}</td>
                        <td className="px-4 py-3 align-top">{p.created_at ? fmtDateTime(p.created_at) : "—"}</td>
                        <td className="px-4 py-3 align-top text-right">
                          <div className="inline-flex items-center gap-2">
                            <Btn variant="light" onClick={() => openEditPoste(p)} disabled={!isOrga || busy}>
                              <Edit3 className="h-4 w-4" /> Modifier
                            </Btn>
                            <Btn variant="danger" onClick={() => deletePoste(p.id)} disabled={!isOrga || busy}>
                              <Trash2 className="h-4 w-4" /> Supprimer
                            </Btn>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}

        {tab === "creneaux" ? (
          <Card className="overflow-hidden">
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-50 text-neutral-700">
                  <tr>
                    <th className="text-left px-4 py-3">Créneau</th>
                    <th className="text-left px-4 py-3">Début</th>
                    <th className="text-left px-4 py-3">Fin</th>
                    <th className="text-left px-4 py-3">Ordre</th>
                    <th className="text-left px-4 py-3">Créé</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {creneaux.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-neutral-600">
                        Aucun créneau. Clique “Nouveau créneau”.
                      </td>
                    </tr>
                  ) : (
                    creneaux.map((c) => (
                      <tr key={c.id} className="hover:bg-neutral-50/60">
                        <td className="px-4 py-3 align-top">
                          <div className="font-semibold">{c.label}</div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          {c.start_at ? `${fmtDateTime(c.start_at)} (${fmtTime(c.start_at)})` : "—"}
                        </td>
                        <td className="px-4 py-3 align-top">
                          {c.end_at ? `${fmtDateTime(c.end_at)} (${fmtTime(c.end_at)})` : "—"}
                        </td>
                        <td className="px-4 py-3 align-top">{c.ordre}</td>
                        <td className="px-4 py-3 align-top">{c.created_at ? fmtDateTime(c.created_at) : "—"}</td>
                        <td className="px-4 py-3 align-top text-right">
                          <div className="inline-flex items-center gap-2">
                            <Btn variant="light" onClick={() => openEditCreneau(c)} disabled={!isOrga || busy}>
                              <Edit3 className="h-4 w-4" /> Modifier
                            </Btn>
                            <Btn variant="danger" onClick={() => deleteCreneau(c.id)} disabled={!isOrga || busy}>
                              <Trash2 className="h-4 w-4" /> Supprimer
                            </Btn>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}

        {tab === "affectations" ? (
          <div className="space-y-4 pb-10">
            {/* Filters */}
            <Card className="p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative w-full lg:max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Recherche (bénévole, email, poste, créneau, note...)"
                    className="pl-9"
                  />
                </div>

                <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-3 lg:ml-auto">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="all">Tous statuts</option>
                    {AFF_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filterPoste}
                    onChange={(e) => setFilterPoste(e.target.value)}
                    className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="all">Tous postes</option>
                    {postes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.titre}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filterCreneau}
                    onChange={(e) => setFilterCreneau(e.target.value)}
                    className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="all">Tous créneaux</option>
                    <option value="">Sans créneau</option>
                    {creneaux.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-neutral-600">
                <Pill tone="gray">
                  <ClipboardList className="h-4 w-4" /> {filteredAffectations.length} résultat(s)
                </Pill>
                <Pill tone="gray">
                  <Users className="h-4 w-4" /> {benevoles.length} bénévoles
                </Pill>
              </div>
            </Card>

            {/* Table */}
            <Card className="overflow-hidden">
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-neutral-50 text-neutral-700">
                    <tr>
                      <th className="text-left px-4 py-3">Bénévole</th>
                      <th className="text-left px-4 py-3">Poste</th>
                      <th className="text-left px-4 py-3">Créneau</th>
                      <th className="text-left px-4 py-3">Statut</th>
                      <th className="text-left px-4 py-3">Note</th>
                      <th className="text-left px-4 py-3">Maj</th>
                      <th className="text-right px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {filteredAffectations.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-neutral-600">
                          Aucune affectation. Clique “Affecter”.
                        </td>
                      </tr>
                    ) : (
                      filteredAffectations.map((a) => {
                        const b = a?.benevole || {};
                        const p = a?.poste || {};
                        const c = a?.creneau || null;

                        return (
                          <tr key={a.id} className="hover:bg-neutral-50/60">
                            <td className="px-4 py-3 align-top">
                              <div className="font-semibold">
                                {[b.prenom, b.nom].filter(Boolean).join(" ").trim() || "—"}
                              </div>
                              <div className="mt-1 text-xs text-neutral-600">
                                {b.email ? <a className="hover:underline" href={`mailto:${b.email}`}>{b.email}</a> : "—"}
                                {b.telephone ? (
                                  <>
                                    {" "}
                                    · <a className="hover:underline" href={`tel:${b.telephone}`}>{b.telephone}</a>
                                  </>
                                ) : null}
                              </div>
                            </td>

                            <td className="px-4 py-3 align-top">
                              <div className="font-semibold">{p.titre || "—"}</div>
                              <div className="mt-1 text-xs text-neutral-600">{p.lieu || "—"}</div>
                            </td>

                            <td className="px-4 py-3 align-top">
                              {c ? (
                                <>
                                  <div className="font-semibold">{c.label}</div>
                                  <div className="mt-1 text-xs text-neutral-600">
                                    {c.start_at ? fmtTime(c.start_at) : "—"} → {c.end_at ? fmtTime(c.end_at) : "—"}
                                  </div>
                                </>
                              ) : (
                                <span className="text-neutral-600">Sans créneau</span>
                              )}
                            </td>

                            <td className="px-4 py-3 align-top">
                              <Pill tone={statusTone(a.status)}>
                                {AFF_STATUSES.find((x) => x.value === a.status)?.label || a.status}
                              </Pill>

                              {isOrga ? (
                                <div className="mt-2">
                                  <select
                                    value={a.status}
                                    onChange={(e) => quickUpdateStatus(a.id, e.target.value)}
                                    className="rounded-xl border border-neutral-200 bg-white px-2 py-1 text-xs"
                                    disabled={busy}
                                  >
                                    {AFF_STATUSES.map((s) => (
                                      <option key={s.value} value={s.value}>
                                        {s.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ) : null}
                            </td>

                            <td className="px-4 py-3 align-top">
                              <div className="text-neutral-700">{a.note || <span className="text-neutral-400">—</span>}</div>
                            </td>

                            <td className="px-4 py-3 align-top text-xs text-neutral-600">
                              <div>créé: {a.created_at ? fmtDateTime(a.created_at) : "—"}</div>
                              <div>maj: {a.updated_at ? fmtDateTime(a.updated_at) : "—"}</div>
                            </td>

                            <td className="px-4 py-3 align-top text-right">
                              <div className="inline-flex items-center gap-2">
                                <Btn variant="light" onClick={() => openEditAffectation(a)} disabled={!isOrga || busy}>
                                  <Edit3 className="h-4 w-4" /> Éditer
                                </Btn>
                                <Btn variant="danger" onClick={() => deleteAffectation(a.id)} disabled={!isOrga || busy}>
                                  <Trash2 className="h-4 w-4" /> Supprimer
                                </Btn>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        ) : null}
      </Container>

      {/* ===================== Modals ===================== */}

      {/* Poste modal */}
      <Modal
        open={mPosteOpen}
        onClose={() => setMPosteOpen(false)}
        title={mPosteEditId ? "Modifier le poste" : "Créer un poste"}
        subtitle="Définis la mission + capacité, et l’ordre d’affichage."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-neutral-700">Titre *</span>
              <Input
                value={posteForm.titre}
                onChange={(e) => setPosteForm((f) => ({ ...f, titre: e.target.value }))}
                placeholder="Ravitaillement, Parking, Signaleur, Dossards…"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-neutral-700">Lieu</span>
              <Input
                value={posteForm.lieu}
                onChange={(e) => setPosteForm((f) => ({ ...f, lieu: e.target.value }))}
                placeholder="Zone départ, Km 12, Parking mairie…"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-neutral-700">Description / consignes</span>
            <Textarea
              rows={3}
              value={posteForm.description}
              onChange={(e) => setPosteForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Consignes importantes, matériel, brief…"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-neutral-700">Capacité *</span>
              <Input
                type="number"
                min={1}
                value={posteForm.capacite}
                onChange={(e) => setPosteForm((f) => ({ ...f, capacite: e.target.value }))}
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-neutral-700">Ordre</span>
              <Input
                type="number"
                value={posteForm.ordre}
                onChange={(e) => setPosteForm((f) => ({ ...f, ordre: e.target.value }))}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Btn variant="light" onClick={() => setMPosteOpen(false)} disabled={busy}>
              Annuler
            </Btn>
            <Btn variant="orange" onClick={savePoste} disabled={!isOrga || busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Enregistrer
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Créneau modal */}
      <Modal
        open={mCreneauOpen}
        onClose={() => setMCreneauOpen(false)}
        title={mCreneauEditId ? "Modifier le créneau" : "Créer un créneau"}
        subtitle="Optionnel : tu peux définir des horaires (utile pour l’export calendrier)."
      >
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-neutral-700">Label *</span>
            <Input
              value={creneauForm.label}
              onChange={(e) => setCreneauForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="Matin / Après-midi / Départ / Arrivées…"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-neutral-700">Début</span>
              <Input
                type="datetime-local"
                value={creneauForm.start_at}
                onChange={(e) => setCreneauForm((f) => ({ ...f, start_at: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-neutral-700">Fin</span>
              <Input
                type="datetime-local"
                value={creneauForm.end_at}
                onChange={(e) => setCreneauForm((f) => ({ ...f, end_at: e.target.value }))}
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-neutral-700">Ordre</span>
            <Input
              type="number"
              value={creneauForm.ordre}
              onChange={(e) => setCreneauForm((f) => ({ ...f, ordre: e.target.value }))}
            />
          </label>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Btn variant="light" onClick={() => setMCreneauOpen(false)} disabled={busy}>
              Annuler
            </Btn>
            <Btn variant="orange" onClick={saveCreneau} disabled={!isOrga || busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Enregistrer
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Affectation modal */}
      <Modal
        open={mAffOpen}
        onClose={() => setMAffOpen(false)}
        title={mAffEditId ? "Éditer l’affectation" : "Créer une affectation"}
        subtitle="Attribue une mission (poste + créneau) à un bénévole."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-neutral-700">Bénévole *</span>
              <select
                value={affForm.benevole_id}
                onChange={(e) => setAffForm((f) => ({ ...f, benevole_id: e.target.value }))}
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">— choisir —</option>
                {benevoles.map((b) => (
                  <option key={b.id} value={b.id}>
                    {[b.prenom, b.nom].filter(Boolean).join(" ").trim()} — {b.email}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-neutral-700">Poste *</span>
              <select
                value={affForm.poste_id}
                onChange={(e) => setAffForm((f) => ({ ...f, poste_id: e.target.value }))}
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">— choisir —</option>
                {postes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.titre}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-neutral-700">Créneau</span>
              <select
                value={affForm.creneau_id}
                onChange={(e) => setAffForm((f) => ({ ...f, creneau_id: e.target.value }))}
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Sans créneau</option>
                {creneaux.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                    {c.start_at && c.end_at ? ` (${fmtTime(c.start_at)}→${fmtTime(c.end_at)})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-neutral-700">Statut</span>
              <select
                value={affForm.status}
                onChange={(e) => setAffForm((f) => ({ ...f, status: e.target.value }))}
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
              >
                {AFF_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-neutral-700">Note</span>
            <Textarea
              rows={3}
              value={affForm.note}
              onChange={(e) => setAffForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Ex: venir 15 min avant, radio canal 2, matériel à récupérer…"
            />
          </label>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Btn variant="light" onClick={() => setMAffOpen(false)} disabled={busy}>
              Annuler
            </Btn>
            <Btn variant="orange" onClick={saveAffectation} disabled={!isOrga || busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Enregistrer
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
