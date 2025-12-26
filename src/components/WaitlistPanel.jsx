import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

function cls(...xs) {
  return xs.filter(Boolean).join(" ");
}

function fmt(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusPill({ row }) {
  const consumed = !!row.consumed_at;
  const invited = !!row.invited_at;

  const label = consumed ? "Consommé" : invited ? "Invité" : "En attente";
  const style = consumed
    ? "bg-emerald-100 text-emerald-800"
    : invited
    ? "bg-amber-100 text-amber-800"
    : "bg-neutral-100 text-neutral-700";

  return (
    <span className={cls("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", style)}>
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
  onInvited, // optionnel: callback après invitation + reload parent
}) {
  const [resolvedCourseId, setResolvedCourseId] = useState(courseId || null);
  const [resolvedFormatId, setResolvedFormatId] = useState(formatId || null);

  const [loadingResolve, setLoadingResolve] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);

  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => setResolvedCourseId(courseId || null), [courseId]);
  useEffect(() => setResolvedFormatId(formatId || null), [formatId]);

  // si formatId mais pas courseId => resolve course via formats
  useEffect(() => {
    let alive = true;

    const resolve = async () => {
      setError("");

      const fid = resolvedFormatId || formatId;
      const cid = resolvedCourseId || courseId;

      if (!fid) return;
      if (cid) return;

      setLoadingResolve(true);
      try {
        const { data, error: e } = await supabase
          .from("formats")
          .select("id, course_id")
          .eq("id", fid)
          .maybeSingle();

        if (e) throw e;
        if (!alive) return;

        if (data?.course_id) setResolvedCourseId(data.course_id);
      } catch (e) {
        console.error("WAITLIST_RESOLVE_ERROR", e);
        if (alive) setError("Impossible de résoudre la course depuis le format.");
      } finally {
        if (alive) setLoadingResolve(false);
      }
    };

    resolve();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formatId, courseId, resolvedFormatId, resolvedCourseId]);

  const canLoad = useMemo(() => !!resolvedFormatId, [resolvedFormatId]);

  const load = useCallback(async () => {
    if (!canLoad) return;

    setLoading(true);
    setError("");
    try {
      let q = supabase
        .from("waitlist")
        .select("id, course_id, format_id, email, prenom, nom, created_at, invited_at, invite_expires_at, consumed_at, source")
        .eq("format_id", resolvedFormatId)
        .order("created_at", { ascending: false });

      if (resolvedCourseId) q = q.eq("course_id", resolvedCourseId);

      const { data, error: e } = await q;
      if (e) throw e;

      setRows(data || []);
    } catch (e) {
      console.error("WAITLIST_LOAD_ERROR", e);
      setError(
        "Impossible de charger la liste d’attente (droits / RLS ?). Vérifie les policies SELECT sur waitlist."
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [canLoad, resolvedCourseId, resolvedFormatId]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const total = rows.length;
    const invited = rows.filter((r) => !!r.invited_at && !r.consumed_at).length;
    const consumed = rows.filter((r) => !!r.consumed_at).length;
    const pending = total - invited - consumed;
    return { total, invited, consumed, pending };
  }, [rows]);

  const invite = useCallback(async () => {
    const cid = resolvedCourseId || courseId;
    const fid = resolvedFormatId || formatId;

    if (!fid || !cid) return alert("Course/format non résolu.");
    if (!enabled) return alert("Liste d’attente désactivée sur ce format.");

    const maxInvites = Number(prompt("Combien d’invitations envoyer ? (ex: 10)", "10") || "0");
    if (!maxInvites || maxInvites <= 0) return;

    const expireHours = Number(prompt("Durée de validité (heures) ? (ex: 48)", "48") || "0");
    if (!expireHours || expireHours <= 0) return;

    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-waitlist", {
        body: { courseId: cid, formatId: fid, maxInvites, expireHours },
      });
      if (error) throw error;

      alert(
        `Invitations traitées: ${data?.invited ?? 0}\nEnvoyées: ${data?.sent ?? 0}\nÉchecs: ${data?.failed ?? 0}`
      );

      await load();
      onInvited?.(data);
    } catch (e) {
      console.error("INVITE_WAITLIST_ERROR", e);
      alert("Erreur lors de l’envoi des invitations.");
    } finally {
      setInviting(false);
    }
  }, [resolvedCourseId, resolvedFormatId, courseId, formatId, enabled, load, onInvited]);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-neutral-900">Liste d’attente</div>

          <div className="mt-1 text-xs text-neutral-500">
            {formatLabel ? (
              <>Format : <span className="font-medium text-neutral-700">{formatLabel}</span></>
            ) : (
              <>Format : <span className="font-medium text-neutral-700">{resolvedFormatId || "—"}</span></>
            )}
          </div>

          <div className="mt-1 text-xs text-neutral-500">
            {loadingResolve && "Résolution course/format…"}
            {!loadingResolve && !resolvedFormatId && "Format non sélectionné"}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={invite}
            className={cls(
              "rounded-xl px-3 py-2 text-xs font-semibold",
              !enabled || inviting || !resolvedFormatId
                ? "bg-neutral-200 text-neutral-500 cursor-not-allowed"
                : "bg-neutral-900 text-white hover:bg-black"
            )}
            disabled={!enabled || inviting || !resolvedFormatId}
            title={!enabled ? "Liste d’attente désactivée" : "Envoyer des invitations"}
          >
            {inviting ? "Invitation…" : "Inviter"}
          </button>

          <button
            onClick={load}
            className="rounded-xl border border-neutral-300 px-3 py-2 text-xs font-semibold hover:bg-neutral-50"
            disabled={!canLoad || loading}
          >
            {loading ? "…" : "Rafraîchir"}
          </button>
        </div>
      </div>

      {!enabled && (
        <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
          Liste d’attente désactivée pour ce format.
        </div>
      )}

      {quotaAttente != null && (
        <div className="mt-3 text-xs text-neutral-600">
          Quota attente : <b>{quotaAttente}</b> • Total : <b>{stats.total}</b>
        </div>
      )}

      {!!error && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-neutral-700">
          Total <b>{stats.total}</b>
        </span>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-neutral-700">
          En attente <b>{stats.pending}</b>
        </span>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">
          Invités <b>{stats.invited}</b>
        </span>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">
          Consommés <b>{stats.consumed}</b>
        </span>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-neutral-500">
            <tr>
              <th className="py-2 pr-3">Statut</th>
              <th className="py-2 pr-3">Email</th>
              <th className="py-2 pr-3">Nom</th>
              <th className="py-2 pr-3">Créé</th>
              <th className="py-2 pr-3">Invité</th>
              <th className="py-2 pr-3">Expire</th>
              <th className="py-2 pr-3">Consommé</th>
              <th className="py-2 pr-3">Source</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {!resolvedFormatId ? (
              <tr>
                <td colSpan={8} className="py-3 text-xs text-neutral-500">
                  Format non sélectionné.
                </td>
              </tr>
            ) : loading ? (
              <tr>
                <td colSpan={8} className="py-3 text-xs text-neutral-500">
                  Chargement…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-3 text-xs text-neutral-500">
                  Aucun inscrit en liste d’attente pour ce format.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-50/60">
                  <td className="py-2 pr-3"><StatusPill row={r} /></td>
                  <td className="py-2 pr-3 font-medium text-neutral-900">{r.email}</td>
                  <td className="py-2 pr-3 text-neutral-700">
                    {(r.nom || "") + (r.prenom ? ` ${r.prenom}` : "") || "—"}
                  </td>
                  <td className="py-2 pr-3 text-neutral-600">{fmt(r.created_at)}</td>
                  <td className="py-2 pr-3 text-neutral-600">{fmt(r.invited_at)}</td>
                  <td className="py-2 pr-3 text-neutral-600">{fmt(r.invite_expires_at)}</td>
                  <td className="py-2 pr-3 text-neutral-600">{fmt(r.consumed_at)}</td>
                  <td className="py-2 pr-3 text-neutral-500">{r.source || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
