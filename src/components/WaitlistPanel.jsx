// src/components/WaitlistPanel.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "../supabase";

function cls(...xs) {
  return xs.filter(Boolean).join(" ");
}

function fmt(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function Pill({ children, tone = "neutral" }) {
  const map = {
    neutral: "bg-neutral-100 text-neutral-800",
    emerald: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    rose: "bg-rose-100 text-rose-800",
    blue: "bg-blue-100 text-blue-800",
  };
  return (
    <span className={cls("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", map[tone])}>
      {children}
    </span>
  );
}

export default function WaitlistPanel({
  courseId,
  formatId,
  formatLabel = "",
  enabled = false,
  quotaAttente = null,
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);
  const [showConsumed, setShowConsumed] = useState(false);

  const canFetch = !!(enabled && courseId && formatId);

  const load = useCallback(async () => {
    if (!canFetch) return;

    setLoading(true);
    setErr("");

    try {
      let q = supabase
        .from("waitlist")
        .select("id, email, prenom, nom, created_at, invited_at, invite_expires_at, consumed_at, source")
        .eq("course_id", courseId)
        .eq("format_id", formatId)
        .order("created_at", { ascending: false });

      if (!showConsumed) q = q.is("consumed_at", null);

      const { data, error } = await q;

      if (error) {
        console.error("[WaitlistPanel] select error:", error);
        // 42501 / "permission denied" => RLS très probable
        const msg =
          (error?.code === "42501" || /permission/i.test(error?.message || ""))
            ? "Accès refusé (RLS). Ajoute une policy SELECT sur public.waitlist pour l’organisateur (voir plus bas)."
            : error.message || "Erreur lors du chargement de la liste d’attente.";
        setErr(msg);
        setRows([]);
        return;
      }

      setRows(data || []);
    } catch (e) {
      console.error("[WaitlistPanel] unexpected error:", e);
      setErr("Erreur inattendue lors du chargement de la liste d’attente.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [canFetch, courseId, formatId, showConsumed]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const total = rows.length;
    const invited = rows.filter((r) => !!r.invited_at && !r.consumed_at).length;
    const notInvited = rows.filter((r) => !r.invited_at && !r.consumed_at).length;
    const consumed = rows.filter((r) => !!r.consumed_at).length;
    return { total, invited, notInvited, consumed };
  }, [rows]);

  if (!enabled) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-neutral-800">Liste d’attente</div>
            <div className="text-xs text-neutral-500">Désactivée pour ce format.</div>
          </div>
          <Pill tone="neutral">OFF</Pill>
        </div>
      </div>
    );
  }

  if (!courseId || !formatId) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="text-sm font-semibold text-neutral-800">Liste d’attente</div>
        <div className="text-xs text-neutral-500 mt-1">Course/format non résolu.</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-sm font-semibold text-neutral-800">Liste d’attente</div>
            {quotaAttente != null && <Pill tone="blue">Quota : {Number(quotaAttente)}</Pill>}
            <Pill tone="neutral">Format</Pill>
            <span className="text-xs text-neutral-500">{formatLabel || formatId}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <Pill tone="amber">À inviter : {stats.notInvited}</Pill>
            <Pill tone="emerald">Invités : {stats.invited}</Pill>
            {showConsumed && <Pill tone="neutral">Consommés : {stats.consumed}</Pill>}
            <span className="text-xs text-neutral-500">{loading ? "Chargement…" : `${stats.total} ligne(s)`}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 text-xs text-neutral-700 select-none">
            <input
              type="checkbox"
              checked={showConsumed}
              onChange={(e) => setShowConsumed(e.target.checked)}
            />
            Afficher consommés
          </label>

          <button
            onClick={load}
            className="rounded-xl border border-neutral-300 px-3 py-2 text-xs hover:bg-neutral-50"
            disabled={loading}
          >
            Rafraîchir
          </button>
        </div>
      </div>

      {err && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800 text-xs">
          {err}
          <div className="mt-1 text-rose-700/90">
            Debug : course_id={String(courseId)} • format_id={String(formatId)}
          </div>
        </div>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="text-left text-neutral-600">
            <tr className="border-b">
              <th className="px-3 py-2">Créé le</th>
              <th className="px-3 py-2">Nom</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2">Invité le</th>
              <th className="px-3 py-2">Expire</th>
              <th className="px-3 py-2">Consommé le</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {loading ? (
              [...Array(3)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-3 py-2"><div className="h-4 w-24 bg-neutral-100 rounded" /></td>
                  <td className="px-3 py-2"><div className="h-4 w-36 bg-neutral-100 rounded" /></td>
                  <td className="px-3 py-2"><div className="h-4 w-52 bg-neutral-100 rounded" /></td>
                  <td className="px-3 py-2"><div className="h-4 w-16 bg-neutral-100 rounded" /></td>
                  <td className="px-3 py-2"><div className="h-4 w-20 bg-neutral-100 rounded" /></td>
                  <td className="px-3 py-2"><div className="h-4 w-24 bg-neutral-100 rounded" /></td>
                  <td className="px-3 py-2"><div className="h-4 w-24 bg-neutral-100 rounded" /></td>
                  <td className="px-3 py-2"><div className="h-4 w-24 bg-neutral-100 rounded" /></td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-neutral-600 text-sm">
                  Aucune entrée{showConsumed ? "" : " (non consommée)"} pour ce format.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const status = r.consumed_at
                  ? { label: "Consommé", tone: "neutral" }
                  : r.invited_at
                  ? { label: "Invité", tone: "emerald" }
                  : { label: "En attente", tone: "amber" };

                return (
                  <tr key={r.id} className="hover:bg-neutral-50/60">
                    <td className="px-3 py-2">{fmt(r.created_at)}</td>
                    <td className="px-3 py-2">
                      {(r.prenom || "—") + " " + (r.nom || "")}
                    </td>
                    <td className="px-3 py-2">{r.email || "—"}</td>
                    <td className="px-3 py-2">{r.source || "—"}</td>
                    <td className="px-3 py-2"><Pill tone={status.tone}>{status.label}</Pill></td>
                    <td className="px-3 py-2">{fmt(r.invited_at)}</td>
                    <td className="px-3 py-2">{fmt(r.invite_expires_at)}</td>
                    <td className="px-3 py-2">{fmt(r.consumed_at)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-[11px] text-neutral-500">
        NB : si tu vois “Accès refusé (RLS)”, c’est que le front ne peut pas lire `public.waitlist` → ajoute les policies ci-dessous.
      </div>
    </div>
  );
}
