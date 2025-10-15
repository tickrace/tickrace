// src/pages/MemberDetails.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../supabase";

/* ----------------------------- Utils ----------------------------- */
function cls(...xs) {
  return xs.filter(Boolean).join(" ");
}
function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function StatusBadge({ status }) {
  const s = (status || "").toLowerCase();
  const map = {
    paye: "bg-emerald-100 text-emerald-800",
    "en attente": "bg-amber-100 text-amber-800",
    en_attente: "bg-amber-100 text-amber-800",
    pending: "bg-amber-100 text-amber-800",
    annule: "bg-rose-100 text-rose-800",
  };
  const txt = s === "paye" ? "Payé" : s === "annule" ? "Annulé" : "En attente";
  return (
    <span className={cls("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", map[s] || "bg-neutral-100 text-neutral-800")}>
      {txt}
    </span>
  );
}

/* -------------------------- Page MemberDetails -------------------------- */
export default function MemberDetails() {
  const { courseId, formatId, teamIdx, memberIdx } = useParams();
  const teamIdxNum = Number(teamIdx ?? 0);
  const memberIdxNum = Number(memberIdx ?? 0);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [rows, setRows] = useState([]);

  // Form state (editable)
  const [form, setForm] = useState({
    id: null,
    nom: "",
    prenom: "",
    email: "",
    team_name: "",
    statut: "en_attente",
    created_at: null,
  });
  const [saving, setSaving] = useState(false);

  /* --------- Charger toutes les inscriptions du couple (courseId, formatId) --------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        if (!courseId || !formatId) throw new Error("Paramètres manquants.");
        const { data, error } = await supabase
          .from("inscriptions")
          .select("id, created_at, nom, prenom, email, statut, format_id, member_of_group_id, team_name, course_id")
          .eq("course_id", courseId)
          .eq("format_id", formatId);
        if (error) throw error;
        if (alive) setRows(data || []);
      } catch (e) {
        if (alive) setErr(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [courseId, formatId]);

  /* --------- Même logique d’indexation que dans ListeInscriptions (simple) --------- */
  const current = useMemo(() => {
    if (!rows.length) return null;

    // teamKey: group_id || team:team_name || __solo__:id
    const teamsMap = new Map();
    for (const r of rows) {
      const key = r.member_of_group_id || (r.team_name ? `team:${r.team_name}` : `__solo__:${r.id}`);
      if (!teamsMap.has(key)) teamsMap.set(key, []);
      teamsMap.get(key).push(r);
    }

    // Ordonne équipes puis membres
    const orderedTeams = [...teamsMap.entries()]
      .map(([key, arr]) => {
        const members = [...arr].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        const firstCreated = members[0]?.created_at;
        const name = key.startsWith("__solo__") ? "solo" : key.startsWith("team:") ? key.slice(5) : key;
        return { key, name, members, firstCreated };
      })
      .sort((a, b) => {
        const an = (a.name || "").toLowerCase();
        const bn = (b.name || "").toLowerCase();
        if (an < bn) return -1;
        if (an > bn) return 1;
        return new Date(a.firstCreated) - new Date(b.firstCreated);
      });

    if (teamIdxNum < 0 || teamIdxNum >= orderedTeams.length) return { error: "Indice d’équipe invalide.", teamsCount: orderedTeams.length };
    const team = orderedTeams[teamIdxNum];
    if (memberIdxNum < 0 || memberIdxNum >= team.members.length) return { error: "Indice de membre invalide.", team };

    return { team, member: team.members[memberIdxNum], teamsCount: orderedTeams.length };
  }, [rows, teamIdxNum, memberIdxNum]);

  /* --------- Hydrate le formulaire quand current change --------- */
  useEffect(() => {
    if (!current || !current.member || current.error) return;
    const m = current.member;
    setForm({
      id: m.id,
      nom: m.nom || "",
      prenom: m.prenom || "",
      email: m.email || "",
      team_name: m.team_name || "",
      statut: (m.statut || "en_attente"),
      created_at: m.created_at || null,
    });
  }, [current]);

  /* --------- Enregistrer --------- */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSave = async () => {
    if (!form.id) return;
    if (!form.nom.trim() || !form.prenom.trim()) {
      alert("Nom et prénom sont requis.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        email: form.email.trim() || null,
        team_name: form.team_name.trim() || null,
        statut: form.statut,
      };
      const { error } = await supabase.from("inscriptions").update(payload).eq("id", form.id);
      if (error) throw error;
      alert("Modifications enregistrées.");
    } catch (e) {
      console.error("SAVE_MEMBER_ERROR", e);
      alert("Échec de l’enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  /* --------- UI --------- */
  if (loading) return <div className="p-6">Chargement…</div>;

  if (err) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <Link to={courseId ? `/courses/${courseId}` : "/"} className="text-sm text-neutral-500 hover:text-neutral-800">← Retour</Link>
        <h1 className="text-2xl font-bold">Membre</h1>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
          <div className="font-semibold mb-1">Impossible de charger</div>
          <div className="text-sm">{String(err.message || err)}</div>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <Link to={courseId ? `/courses/${courseId}` : "/"} className="text-sm text-neutral-500 hover:text-neutral-800">← Retour</Link>
        <h1 className="text-2xl font-bold">Membre</h1>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">Aucun membre trouvé.</div>
      </div>
    );
  }

  if (current.error) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <Link to={courseId ? `/courses/${courseId}` : "/"} className="text-sm text-neutral-500 hover:text-neutral-800">← Retour</Link>
        <h1 className="text-2xl font-bold">Membre</h1>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
          {current.error}
        </div>
      </div>
    );
  }

  const { team, member } = current;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="space-y-1">
        <Link to={courseId ? `/courses/${courseId}` : "/"} className="text-sm text-neutral-500 hover:text-neutral-800">← Retour</Link>
        <h1 className="text-2xl font-bold">Membre</h1>
        <div className="text-neutral-600 text-sm">
          Format <code className="font-mono">{formatId}</code>
          {" • "}Équipe{" "}
          <b>{team.key.startsWith("__solo__") ? "Solo" : team.key.startsWith("team:") ? team.key.slice(5) : team.key}</b>
        </div>
      </div>

      {/* Carte édition simple */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-neutral-500">ID</label>
            <div className="mt-0.5 text-sm font-mono break-all">{form.id}</div>
          </div>
          <div>
            <label className="text-xs text-neutral-500">Créé le</label>
            <div className="mt-0.5 text-sm">{formatDateTime(form.created_at)}</div>
          </div>

          <div>
            <label className="text-sm font-medium">Nom *</label>
            <input
              name="nom"
              value={form.nom}
              onChange={handleChange}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Prénom *</label>
            <input
              name="prenom"
              value={form.prenom}
              onChange={handleChange}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-sm font-medium">Email</label>
            <input
              name="email"
              value={form.email}
              onChange={handleChange}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
              placeholder="email@exemple.com"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-sm font-medium">Équipe</label>
            <input
              name="team_name"
              value={form.team_name}
              onChange={handleChange}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
              placeholder="Nom de l’équipe"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-sm font-medium">Statut</label>
            <div className="mt-1 flex items-center gap-3">
              <StatusBadge status={form.statut} />
              <select
                name="statut"
                value={form.statut}
                onChange={handleChange}
                className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
              >
                <option value="en_attente">En attente</option>
                <option value="paye">Payé</option>
                <option value="annule">Annulé</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Link
            to={courseId ? `/courses/${courseId}` : "/"}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
          >
            Annuler
          </Link>
          <button
            onClick={handleSave}
            disabled={saving || !form.id}
            className={cls(
              "rounded-xl px-4 py-2 text-sm font-semibold text-white",
              saving ? "bg-neutral-400 cursor-not-allowed" : "bg-neutral-900 hover:bg-black"
            )}
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>

      {/* Aperçu rapide des autres membres de l’équipe (clic pour info rapide) */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold mb-3">Membres de l’équipe</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {team.members.map((m, i) => (
            <div
              key={m.id}
              className={cls(
                "rounded-xl border p-3 text-sm",
                m.id === form.id ? "border-neutral-900" : "border-neutral-200"
              )}
            >
              <div className="font-medium">
                {m.prenom || "—"} {m.nom || ""}
              </div>
              <div className="text-xs text-neutral-600">{m.email || "—"}</div>
              <div className="mt-1">
                <StatusBadge status={m.statut} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
