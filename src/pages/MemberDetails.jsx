// src/pages/MemberDetails.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
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
  const txt =
    s === "paye" ? "Payé" : s === "annule" ? "Annulé" : "En attente";
  return (
    <span
      className={cls(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        map[s] || "bg-neutral-100 text-neutral-800"
      )}
    >
      {txt}
    </span>
  );
}

/* -------------------------- MemberDetails -------------------------- */
export default function MemberDetails() {
  const params = useParams();
  const navigate = useNavigate();

  const courseId = params.courseId;
  const formatId = params.formatId;
  const teamIdxParam = Number(params.teamIdx ?? 0);
  const memberIdxParam = Number(params.memberIdx ?? 0);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        if (!courseId || !formatId) {
          throw new Error("Paramètres manquants dans l’URL.");
        }
        // Charge toutes les inscriptions du couple (courseId, formatId)
        const { data, error } = await supabase
          .from("inscriptions")
          .select(
            "id, created_at, nom, prenom, email, statut, format_id, member_of_group_id, team_name, course_id"
          )
          .eq("course_id", courseId)
          .eq("format_id", formatId)
          .order("created_at", { ascending: true }); // ordre stable pour les membres

        if (error) throw error;
        if (alive) setRows(data || []);
      } catch (e) {
        if (alive) setErr(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [courseId, formatId]);

  // Reconstitue EXACTEMENT la même logique d’indices que dans ListeInscriptions.jsx
  const { orderedTeams, memberByIndices } = useMemo(() => {
    // Regroupe par format_id (ici identique pour tout) puis par teamKey
    const teamsMap = new Map(); // teamKey -> rows[]
    for (const r of rows) {
      const teamKey =
        r.member_of_group_id ||
        (r.team_name ? `team:${r.team_name}` : `__solo__:${r.id}`);
      if (!teamsMap.has(teamKey)) teamsMap.set(teamKey, []);
      teamsMap.get(teamKey).push(r);
    }

    // Crée un tableau ordonné des teams (alpha sur name, puis firstCreated)
    const teams = [...teamsMap.entries()]
      .map(([key, arr]) => {
        const firstCreated = arr.reduce(
          (min, x) =>
            new Date(x.created_at) < new Date(min) ? x.created_at : min,
          arr[0]?.created_at
        );
        const name = key.startsWith("__solo__")
          ? "solo"
          : key.startsWith("team:")
          ? key.slice(5)
          : key; // group id sinon
        // Ordonne les membres par created_at asc
        const membersOrdered = [...arr].sort(
          (a, b) => new Date(a.created_at) - new Date(b.created_at)
        );
        return { key, name, firstCreated, members: membersOrdered };
      })
      .sort((a, b) => {
        const an = (a.name || "").toString().toLowerCase();
        const bn = (b.name || "").toString().toLowerCase();
        if (an < bn) return -1;
        if (an > bn) return 1;
        return new Date(a.firstCreated) - new Date(b.firstCreated);
      });

    // Pour un accès direct par indices
    const memberByIndices = (ti, mi) => {
      if (ti < 0 || ti >= teams.length) return null;
      const team = teams[ti];
      if (!team) return null;
      if (mi < 0 || mi >= team.members.length) return null;
      return { team, member: team.members[mi] };
    };

    return { orderedTeams: teams, memberByIndices };
  }, [rows]);

  const current = memberByIndices(teamIdxParam, memberIdxParam);

  const buildUrl = (ti, mi) =>
    `/member-details/${encodeURIComponent(courseId)}/${encodeURIComponent(
      formatId
    )}/${ti}/${mi}`;

  const goPrev = () => {
    if (!current) return;
    let ti = teamIdxParam;
    let mi = memberIdxParam - 1;
    if (mi < 0) {
      ti = teamIdxParam - 1;
      if (ti < 0) return;
      mi = (orderedTeams[ti]?.members?.length || 1) - 1;
    }
    navigate(buildUrl(ti, mi));
  };

  const goNext = () => {
    if (!current) return;
    let ti = teamIdxParam;
    let mi = memberIdxParam + 1;
    const len = orderedTeams[ti]?.members?.length || 0;
    if (mi >= len) {
      ti = teamIdxParam + 1;
      if (ti >= orderedTeams.length) return;
      mi = 0;
    }
    navigate(buildUrl(ti, mi));
  };

  if (loading) return <div className="p-6">Chargement…</div>;

  if (err) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <Link
          to={courseId ? `/courses/${courseId}` : "/"}
          className="text-sm text-neutral-500 hover:text-neutral-800"
        >
          ← Retour
        </Link>
        <h1 className="text-2xl font-bold">Détail membre</h1>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
          <div className="font-semibold mb-1">Impossible de charger</div>
          <div className="text-sm">{String(err.message || err)}</div>
          <div className="text-xs mt-2">
            Vérifie les paramètres d’URL et les règles RLS de{" "}
            <code>inscriptions</code>.
          </div>
        </div>
      </div>
    );
  }

  if (!orderedTeams.length) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <Link
          to={courseId ? `/courses/${courseId}` : "/"}
          className="text-sm text-neutral-500 hover:text-neutral-800"
        >
          ← Retour
        </Link>
        <h1 className="text-2xl font-bold">Détail membre</h1>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          Aucun membre trouvé pour ce format.
        </div>
      </div>
    );
  }

  // Gestion d’indices hors bornes
  if (!current) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <Link
          to={courseId ? `/courses/${courseId}` : "/"}
          className="text-sm text-neutral-500 hover:text-neutral-800"
        >
          ← Retour
        </Link>
        <h1 className="text-2xl font-bold">Détail membre</h1>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
          Indices invalides (<code>teamIdx={teamIdxParam}</code>,{" "}
          <code>memberIdx={memberIdxParam}</code>). Sélectionnez un membre
          existant ci-dessous.
        </div>

        {/* Liste de toutes les équipes pour que l’utilisateur puisse naviguer */}
        <TeamsIndex
          courseId={courseId}
          formatId={formatId}
          orderedTeams={orderedTeams}
          buildUrl={buildUrl}
        />
      </div>
    );
  }

  const { team, member } = current;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link
            to={courseId ? `/courses/${courseId}` : "/"}
            className="text-sm text-neutral-500 hover:text-neutral-800"
          >
            ← Retour
          </Link>
          <h1 className="text-2xl font-bold">Détail membre</h1>
          <div className="text-neutral-600 text-sm">
            Format <code className="font-mono">{formatId}</code> • Équipe{" "}
            <b>
              {team.key.startsWith("__solo__")
                ? "Solo"
                : team.key.startsWith("team:")
                ? team.key.slice(5)
                : team.key}
            </b>{" "}
            • Membre {memberIdxParam + 1} / {team.members.length} • Équipe{" "}
            {teamIdxParam + 1} / {orderedTeams.length}
          </div>
        </div>

        {/* Navigation membre */}
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            className={cls(
              "rounded-lg border px-3 py-1.5 text-sm",
              teamIdxParam === 0 && memberIdxParam === 0
                ? "text-neutral-400 border-neutral-200 cursor-not-allowed"
                : "hover:bg-neutral-50"
            )}
            disabled={teamIdxParam === 0 && memberIdxParam === 0}
          >
            ← Précédent
          </button>
          <button
            onClick={goNext}
            className={cls(
              "rounded-lg border px-3 py-1.5 text-sm",
              teamIdxParam === orderedTeams.length - 1 &&
                memberIdxParam === team.members.length - 1
                ? "text-neutral-400 border-neutral-200 cursor-not-allowed"
                : "hover:bg-neutral-50"
            )}
            disabled={
              teamIdxParam === orderedTeams.length - 1 &&
              memberIdxParam === team.members.length - 1
            }
          >
            Suivant →
          </button>
        </div>
      </div>

      {/* Carte détail membre */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <Field label="ID">
            <code className="font-mono break-all">{member.id}</code>
          </Field>
          <Field label="Statut">
            <StatusBadge status={member.statut} />
          </Field>
          <Field label="Nom">{member.nom || "—"}</Field>
          <Field label="Prénom">{member.prenom || "—"}</Field>
          <Field label="Email">
            {member.email ? (
              <a
                className="text-neutral-900 hover:underline"
                href={`mailto:${member.email}`}
              >
                {member.email}
              </a>
            ) : (
              "—"
            )}
          </Field>
          <Field label="Équipe">{member.team_name || "—"}</Field>
          <Field label="Groupe">
            {member.member_of_group_id ? member.member_of_group_id : "—"}
          </Field>
          <Field label="Créé le">{formatDateTime(member.created_at)}</Field>
        </div>
      </div>

      {/* Teammates / autres membres de l’équipe */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">
            Membres de l’équipe ({team.members.length})
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {team.members.map((m, i) => {
            const isCurrent = i === memberIdxParam;
            return (
              <Link
                key={m.id}
                to={buildUrl(teamIdxParam, i)}
                className={cls(
                  "rounded-xl border p-3 hover:bg-neutral-50",
                  isCurrent
                    ? "border-neutral-900"
                    : "border-neutral-200"
                )}
              >
                <div className="text-sm font-medium">
                  {m.prenom || "—"} {m.nom || ""}
                </div>
                <div className="text-xs text-neutral-600">
                  {m.email || "—"}
                </div>
                <div className="mt-1">
                  <StatusBadge status={m.statut} />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Index des équipes pour navigation rapide */}
      <TeamsIndex
        courseId={courseId}
        formatId={formatId}
        orderedTeams={orderedTeams}
        buildUrl={buildUrl}
      />
    </div>
  );
}

/* ----------------------------- Subcomponents ----------------------------- */
function Field({ label, children }) {
  return (
    <div>
      <div className="text-neutral-500 text-xs">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function TeamsIndex({ courseId, formatId, orderedTeams, buildUrl }) {
  if (!orderedTeams?.length) return null;
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold">Toutes les équipes</h2>
        <div className="text-sm text-neutral-600">
          {orderedTeams.length} équipe{orderedTeams.length > 1 ? "s" : ""}
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {orderedTeams.map((t, ti) => {
          const label =
            t.key.startsWith("__solo__")
              ? `Solo (${t.members.length})`
              : t.key.startsWith("team:")
              ? `${t.key.slice(5)} (${t.members.length})`
              : `${t.key} (${t.members.length})`;
        return (
          <div key={t.key} className="rounded-xl border border-neutral-200 p-3">
            <div className="text-sm font-medium mb-2">{label}</div>
            <div className="flex flex-wrap gap-2">
              {t.members.map((m, mi) => (
                <Link
                  key={m.id}
                  to={buildUrl(ti, mi)}
                  className="text-xs rounded-lg border border-neutral-300 px-2 py-1 hover:bg-neutral-50"
                  title={`${m.prenom || ""} ${m.nom || ""}`}
                >
                  {mi + 1}
                </Link>
              ))}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
