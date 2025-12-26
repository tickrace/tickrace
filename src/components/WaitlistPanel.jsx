// src/components/WaitlistPanel.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

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

function WaitlistStatusBadge({ row }) {
  const invited = !!row.invited_at;
  const consumed = !!row.consumed_at;

  const label = consumed ? "Consommé" : invited ? "Invité" : "En attente";
  const style = consumed
    ? "bg-emerald-100 text-emerald-800"
    : invited
    ? "bg-blue-100 text-blue-800"
    : "bg-amber-100 text-amber-800";

  return (
    <span className={cls("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", style)}>
      {label}
    </span>
  );
}

export default function WaitlistPanel({
  courseId,
  formatId,
  formatLabel = "",
  enabled = true,
  quotaAttente = null,
}) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  // Ajout manuel (orga)
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ email: "", prenom: "", nom: "" });

  // Invitation
  const [inviting, setInviting] = useState(false);
  const [inviteCount, setInviteCount] = useState(10);

  const canLoad = !!courseId && !!formatId && enabled;

  const stats = useMemo(() => {
    const total = rows.length;
    const pending = rows.filter((r) => !r.invited_at && !r.consumed_at).length;
    const invited = rows.filter((r) => !!r.invited_at && !r.consumed_at).length;
    const consumed = rows.filter((r) => !!r.consumed_at).length;
    return { total, pending, invited, consumed };
  }, [rows]);

  const load = useCallback(async () => {
    if (!canLoad) {
      setRows([]);
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data, error: e } = await supabase
        .from("waitlist")
        .select("id, email, prenom, nom, created_at, invited_at, invite_expires_at, consumed_at, source")
        .eq("course_id", courseId)
        .eq("format_id", formatId)
        .order("created_at", { ascending: false });

      if (e) throw e;
      setRows(data || []);
    } catch (e) {
      console.error("WAITLIST_LOAD_ERROR", e);
      setError("Impossible de charger la liste d’attente (droits/RLS ?).");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [canLoad, courseId, formatId]);

  useEffect(() => {
    load();
  }, [load]);

  const addWaitlist = async () => {
    if (!courseId || !formatId) return;
    const email = (f.email || "").trim().toLowerCase();
    if (!email) return alert("Email requis.");

    setAdding(true);
    try {
      const payload = {
        course_id: courseId,
        format_id: formatId,
        email,
        prenom: (f.prenom || "").trim() || null,
        nom: (f.nom || "").trim() || null,
        source: "organisateur",
      };

      const { error: e } = await supabase.from("waitlist").insert(payload);
      if (e) throw e;

      setF({ email: "", prenom: "", nom: "" });
      await load();
      alert("Ajouté à la liste d’attente.");
    } catch (e) {
      console.error("WAITLIST_ADD_ERROR", e);
      // unique index (format_id, lower(email)) → déjà inscrit
      alert("Impossible d’ajouter (déjà en liste ou erreur).");
    } finally {
      setAdding(false);
    }
  };

  const inviteWaitlist = async () => {
    if (!courseId || !formatId) return;

    const n = Math.max(1, Number(inviteCount || 1));
    const ok = window.confirm(
      `Inviter jusqu’à ${n} personne(s) de la liste d’attente à s’inscrire ?`
    );
    if (!ok) return;

    setInviting(true);
    try {
      const { data, error: e } = await supabase.functions.invoke("invite-waitlist", {
        body: { courseId, formatId, limit: n },
      });

      if (e) throw e;

      // Optionnel: la function peut renvoyer { invited: X, skipped: Y, ... }
      const invited = data?.invited ?? data?.count ?? null;

      await load();
      alert(invited != null ? `Invitations envoyées (${invited}).` : "Invitations envoyées.");
    } catch (e) {
      console.error("INVITE_WAITLIST_ERROR", e);
      alert("Erreur lors de l’envoi des invitations.");
    } finally {
      setInviting(false);
    }
  };

  if (!enabled) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-neutral-800">Liste d’attente</div>
            <div className="text-xs text-neutral-500">Désactivée sur ce format.</div>
          </div>
        </div>
      </div>
    );
  }

  if (!courseId || !formatId) return null;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
        <div>
          <div className="text-sm font-semibold text-neutral-800">Liste d’attente</div>
          <div className="text-xs text-neutral-500 mt-0.5">
            {formatLabel ? (
              <>
                Format : <b>{formatLabel}</b>
              </>
            ) : (
              <>Format : <b>{formatId}</b></>
            )}
            {quotaAttente != null && (
              <>
                {" "}
                • Quota : <b>{quotaAttente}</b>
              </>
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-neutral-100 px-2 py-1 text-neutral-700">
              Total : <b>{stats.total}</b>
            </span>
            <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">
              En attente : <b>{stats.pending}</b>
            </span>
            <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-800">
              Invités : <b>{stats.invited}</b>
            </span>
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-800">
              Consommés : <b>{stats.consumed}</b>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          <button
            onClick={load}
            className="rounded-xl border border-neutral-300 px-3 py-2 text-xs sm:text-sm hover:bg-neutral-50"
          >
            Rafraîchir
          </button>

          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={inviteCount}
              onChange={(e) => setInviteCount(e.target.value)}
              className="w-20 rounded-xl border border-neutral-300 px-3 py-2 text-xs sm:text-sm"
              title="Nombre d’invitations"
            />
            <button
              onClick={inviteWaitlist}
              disabled={inviting || stats.pending === 0}
              className={cls(
                "rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold",
                inviting || stats.pending === 0
                  ? "bg-neutral-200 text-neutral-500 cursor-not-allowed"
                  : "bg-neutral-900 text-white hover:bg-black"
              )}
              title={stats.pending === 0 ? "Aucun en attente" : "Envoyer des invitations"}
            >
              {inviting ? "Invitation…" : "Inviter"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      {/* Ajout manuel */}
      <div className="mb-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        <div className="text-xs font-medium text-neutral-700 mb-2">Ajouter manuellement</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input
            value={f.email}
            onChange={(e) => setF((p) => ({ ...p, email: e.target.value }))}
            className="rounded-xl border border-neutral-300 px-3 py-2 text-sm md:col-span-2"
            placeholder="Email *"
          />
          <input
            value={f.prenom}
            onChange={(e) => setF((p) => ({ ...p, prenom: e.target.value }))}
            className="rounded-xl border border-neutral-300 px-3 py-2 text-sm"
            placeholder="Prénom"
          />
          <input
            value={f.nom}
            onChange={(e) => setF((p) => ({ ...p, nom: e.target.value }))}
            className="rounded-xl border border-neutral-300 px-3 py-2 text-sm"
            placeholder="Nom"
          />
        </div>
        <div className="mt-2 flex justify-end">
          <button
            onClick={addWaitlist}
            disabled={adding}
            className={cls(
              "rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold",
              adding ? "bg-neutral-300 text-neutral-600 cursor-wait" : "bg-white border border-neutral-300 hover:bg-neutral-100"
            )}
          >
            {adding ? "Ajout…" : "Ajouter"}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-neutral-200">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th className="px-3 py-2 text-left">Créé le</th>
              <th className="px-3 py-2 text-left">Statut</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Prénom</th>
              <th className="px-3 py-2 text-left">Nom</th>
              <th className="px-3 py-2 text-left">Invité le</th>
              <th className="px-3 py-2 text-left">Expire</th>
              <th className="px-3 py-2 text-left">Consommé le</th>
              <th className="px-3 py-2 text-left">Source</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {loading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-3 py-2"><div className="h-4 w-28 rounded bg-neutral-100" /></td>
                  <td className="px-3 py-2"><div className="h-4 w-16 rounded bg-neutral-100" /></td>
                  <td className="px-3 py-2"><div className="h-4 w-56 rounded bg-neutral-100" /></td>
                  <td className="px-3 py-2"><div className="h-4 w-24 rounded bg-neutral-100" /></td>
                  <td className="px-3 py-2"><div className="h-4 w-24 rounded bg-neutral-100" /></td>
                  <td className="px-3 py-2"><div className="h-4 w-28 rounded bg-neutral-100" /></td>
                  <td className="px-3 py-2"><div className="h-4 w-28 rounded bg-neutral-100" /></td>
                  <td className="px-3 py-2"><div className="h-4 w-28 rounded bg-neutral-100" /></td>
                  <td className="px-3 py-2"><div className="h-4 w-20 rounded bg-neutral-100" /></td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-neutral-600">
                  Aucun inscrit en liste d’attente pour ce format.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-50/60">
                  <td className="px-3 py-2">{formatDateTime(r.created_at)}</td>
                  <td className="px-3 py-2">
                    <WaitlistStatusBadge row={r} />
                  </td>
                  <td className="px-3 py-2 font-medium text-neutral-900">{r.email}</td>
                  <td className="px-3 py-2">{r.prenom || "—"}</td>
                  <td className="px-3 py-2">{r.nom || "—"}</td>
                  <td className="px-3 py-2">{formatDateTime(r.invited_at)}</td>
                  <td className="px-3 py-2">{formatDateTime(r.invite_expires_at)}</td>
                  <td className="px-3 py-2">{formatDateTime(r.consumed_at)}</td>
                  <td className="px-3 py-2 text-neutral-600">{r.source || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-[11px] text-neutral-500">
        ℹ️ “Inviter” appelle l’Edge Function <b>invite-waitlist</b> (envoi email + token). Les entrées “Consommé” sont celles dont le lien a été utilisé.
      </div>
    </div>
  );
}
