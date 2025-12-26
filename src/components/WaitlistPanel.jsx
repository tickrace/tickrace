// src/components/WaitlistPanel.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { RefreshCcw, Send, AlertCircle, CheckCircle2, Clock } from "lucide-react";

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
  // consumed_at => invitation consommée
  if (row?.consumed_at) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Consommée
      </span>
    );
  }

  // invited_at => invitation envoyée mais pas consommée
  if (row?.invited_at) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
        <Clock className="h-3.5 w-3.5" />
        Invitée
      </span>
    );
  }

  // sinon en attente
  return (
    <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700">
      En attente
    </span>
  );
}

export default function WaitlistPanel({
  courseId,
  formatId,
  formatLabel = "",
  enabled = false,
  quotaAttente = null,
  onInvited, // callback optionnel (ex: reload inscriptions)
}) {
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);

  const resolved = !!courseId && !!formatId;

  const load = useCallback(async () => {
    setError("");
    if (!resolved) {
      setRows([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error: e } = await supabase
        .from("waitlist")
        .select("id, email, prenom, nom, created_at, invited_at, invite_expires_at, consumed_at, source")
        .eq("course_id", courseId)
        .eq("format_id", formatId)
        .order("created_at", { ascending: true });

      if (e) throw e;
      setRows(data || []);
    } catch (e) {
      console.error("WAITLIST_LOAD_ERROR", e);
      setError("Impossible de charger la liste d’attente.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [courseId, formatId, resolved]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const total = rows.length;
    const pending = rows.filter((r) => !r.invited_at && !r.consumed_at).length;
    const invited = rows.filter((r) => r.invited_at && !r.consumed_at).length;
    const consumed = rows.filter((r) => r.consumed_at).length;
    return { total, pending, invited, consumed };
  }, [rows]);

  const invite = useCallback(async () => {
    if (!resolved) return alert("Course/format non résolu.");
    if (!enabled) return alert("La liste d’attente n’est pas activée sur ce format.");

    const maxInvites = Number(prompt("Combien d’invitations envoyer ? (ex: 10)", "10") || "0");
    if (!maxInvites || maxInvites <= 0) return;

    const expireHours = Number(prompt("Durée de validité (heures) ? (ex: 48)", "48") || "0");
    if (!expireHours || expireHours <= 0) return;

    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-waitlist", {
        body: { courseId, formatId, maxInvites, expireHours },
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
  }, [resolved, enabled, courseId, formatId, load, onInvited]);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-neutral-800">Liste d’attente</h2>

            {!enabled && (
              <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                Désactivée
              </span>
            )}

            {quotaAttente != null && (
              <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700">
                Quota: {quotaAttente}
              </span>
            )}
          </div>

          <div className="mt-1 text-xs text-neutral-500 truncate">
            {formatLabel ? <span>Format : <b className="text-neutral-700">{formatLabel}</b></span> : null}
            {!resolved ? (
              <span className="ml-2 inline-flex items-center gap-1 text-rose-700">
                <AlertCircle className="h-3.5 w-3.5" />
                Course/format non résolu
              </span>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-600">
            <span className="rounded-full bg-neutral-100 px-2 py-0.5">Total: <b>{stats.total}</b></span>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5">En attente: <b>{stats.pending}</b></span>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5">Invitées: <b>{stats.invited}</b></span>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5">Consommées: <b>{stats.consumed}</b></span>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            onClick={load}
            disabled={loading || !resolved}
            className={cls(
              "inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-3 py-2 text-xs font-semibold",
              loading || !resolved ? "bg-neutral-100 text-neutral-400 cursor-not-allowed" : "hover:bg-neutral-50"
            )}
            title={!resolved ? "Course/format non résolu" : "Rafraîchir"}
          >
            <RefreshCcw className={cls("h-4 w-4", loading ? "animate-spin" : "")} />
            Rafraîchir
          </button>

          <button
            onClick={invite}
            disabled={inviting || !resolved || !enabled}
            className={cls(
              "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold",
              inviting || !resolved || !enabled
                ? "bg-neutral-200 text-neutral-500 cursor-not-allowed"
                : "bg-neutral-900 text-white hover:bg-black"
            )}
            title={
              !resolved ? "Course/format non résolu" : !enabled ? "Liste d’attente désactivée" : "Envoyer des invitations"
            }
          >
            <Send className={cls("h-4 w-4", inviting ? "animate-pulse" : "")} />
            {inviting ? "Invitation…" : "Inviter la liste d’attente"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {error}
        </div>
      )}

      <div className="mt-4">
        {loading ? (
          <div className="text-sm text-neutral-500">Chargement…</div>
        ) : !resolved ? (
          <div className="text-sm text-neutral-500">Sélectionnez un format valide pour afficher la liste d’attente.</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-neutral-500">Aucune personne en liste d’attente pour ce format.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Nom</th>
                  <th className="px-3 py-2 text-left">Ajouté le</th>
                  <th className="px-3 py-2 text-left">Statut</th>
                  <th className="px-3 py-2 text-left">Invité le</th>
                  <th className="px-3 py-2 text-left">Expire</th>
                  <th className="px-3 py-2 text-left">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-neutral-50/60">
                    <td className="px-3 py-2 font-medium text-neutral-900">{r.email}</td>
                    <td className="px-3 py-2 text-neutral-700">
                      {(r.prenom || "").trim()} {(r.nom || "").trim()}
                    </td>
                    <td className="px-3 py-2 text-neutral-700">{fmt(r.created_at)}</td>
                    <td className="px-3 py-2">
                      <StatusPill row={r} />
                    </td>
                    <td className="px-3 py-2 text-neutral-700">{fmt(r.invited_at)}</td>
                    <td className="px-3 py-2 text-neutral-700">{fmt(r.invite_expires_at)}</td>
                    <td className="px-3 py-2 text-neutral-500">{r.source || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {enabled && resolved && (
          <div className="mt-3 text-xs text-neutral-500">
            Astuce : le bouton “Inviter” prend les personnes <b>non invitées</b> en priorité (selon ta logique côté Edge Function).
          </div>
        )}
      </div>
    </div>
  );
}
