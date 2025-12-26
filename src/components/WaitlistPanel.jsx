// src/components/WaitlistPanel.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { RefreshCw, UserPlus, Trash2, Send, AlertTriangle, CheckCircle2 } from "lucide-react";

/* ----------------------------- Utils ----------------------------- */
function cls(...xs) {
  return xs.filter(Boolean).join(" ");
}
function fmtDT(iso) {
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

export default function WaitlistPanel({
  courseId,
  formatId,
  formatLabel = "",
  enabled = false, // waitlist_enabled (info only; on affiche quand même le bloc)
  quotaAttente = null,
  onChanged,
}) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  // Add form
  const [email, setEmail] = useState("");
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [saving, setSaving] = useState(false);

  const canQuery = !!courseId && !!formatId;

  const stats = useMemo(() => {
    const total = rows.length;
    const invited = rows.filter((r) => !!r.invited_at && !r.consumed_at).length;
    const consumed = rows.filter((r) => !!r.consumed_at).length;
    return { total, invited, consumed };
  }, [rows]);

  const load = useCallback(async () => {
    if (!canQuery) {
      setRows([]);
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error: e } = await supabase
        .from("waitlist")
        .select(
          "id, email, prenom, nom, created_at, invited_at, invite_expires_at, consumed_at, source"
        )
        .eq("course_id", courseId)
        .eq("format_id", formatId)
        .order("created_at", { ascending: true });

      if (e) throw e;
      setRows(data || []);
    } catch (e) {
      console.error("WAITLIST_LOAD_ERROR", e);
      // Très souvent: RLS ou manque de droits.
      setError("Impossible de charger la liste d’attente (droits/RLS ?).");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [canQuery, courseId, formatId]);

  useEffect(() => {
    load();
  }, [load]);

  const addToWaitlist = async () => {
    if (!canQuery) return;
    const em = (email || "").trim().toLowerCase();
    if (!em || !em.includes("@")) return alert("Email invalide.");

    setSaving(true);
    try {
      const payload = {
        course_id: courseId,
        format_id: formatId,
        email: em,
        prenom: prenom?.trim() || null,
        nom: nom?.trim() || null,
        source: "organisateur",
      };

      const { error: e } = await supabase.from("waitlist").insert(payload);
      if (e) {
        // Unique (format_id, lower(email))
        if (String(e.message || "").toLowerCase().includes("duplicate")) {
          alert("Cet email est déjà en liste d’attente pour ce format.");
          return;
        }
        throw e;
      }

      setEmail("");
      setPrenom("");
      setNom("");
      await load();
      onChanged?.();
    } catch (e) {
      console.error("WAITLIST_ADD_ERROR", e);
      alert("Erreur lors de l’ajout à la liste d’attente.");
    } finally {
      setSaving(false);
    }
  };

  const removeRow = async (id) => {
    if (!window.confirm("Supprimer cette entrée de la liste d’attente ?")) return;
    try {
      const { error: e } = await supabase.from("waitlist").delete().eq("id", id);
      if (e) throw e;
      await load();
      onChanged?.();
    } catch (e) {
      console.error("WAITLIST_DELETE_ERROR", e);
      alert("Impossible de supprimer.");
    }
  };

  const invite = async () => {
    if (!canQuery) return;

    const maxInvites = Number(prompt("Combien d’invitations envoyer ? (ex: 10)", "10") || "0");
    if (!maxInvites || maxInvites <= 0) return;

    try {
      const { data, error: e } = await supabase.functions.invoke("invite-waitlist", {
        body: { courseId, formatId, maxInvites, expireHours: 48 },
      });

      if (e) throw e;

      alert(
        `Invitations traitées: ${data?.invited ?? 0}\nEnvoyées: ${data?.sent ?? 0}\nÉchecs: ${data?.failed ?? 0}`
      );

      await load();
      onChanged?.();
    } catch (e) {
      console.error("WAITLIST_INVITE_ERROR", e);
      alert("Erreur lors de l’envoi des invitations.");
    }
  };

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Liste d’attente</h2>
          <div className="mt-0.5 text-xs text-neutral-500">
            {formatLabel ? <>Format : <b>{formatLabel}</b></> : <>Format : <b>{formatId || "—"}</b></>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-3 py-2 text-xs font-semibold hover:bg-neutral-50"
            title="Rafraîchir"
          >
            <RefreshCw className={cls("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </button>

          <button
            onClick={invite}
            disabled={!canQuery}
            className={cls(
              "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold",
              !canQuery ? "bg-neutral-200 text-neutral-500 cursor-not-allowed" : "bg-neutral-900 text-white hover:bg-black"
            )}
          >
            <Send className="h-4 w-4" />
            Inviter
          </button>
        </div>
      </div>

      {/* Info enabled/disabled */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {enabled ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 px-2 py-1">
            <CheckCircle2 className="h-4 w-4" /> Activée
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-800 ring-1 ring-amber-200 px-2 py-1">
            <AlertTriangle className="h-4 w-4" /> Désactivée (waitlist_enabled=false)
          </span>
        )}

        <span className="rounded-full bg-neutral-100 text-neutral-700 px-2 py-1">
          Total : <b>{stats.total}</b>
        </span>
        <span className="rounded-full bg-neutral-100 text-neutral-700 px-2 py-1">
          Invités : <b>{stats.invited}</b>
        </span>
        <span className="rounded-full bg-neutral-100 text-neutral-700 px-2 py-1">
          Consommés : <b>{stats.consumed}</b>
        </span>

        {quotaAttente != null && Number.isFinite(Number(quotaAttente)) && (
          <span className="rounded-full bg-neutral-100 text-neutral-700 px-2 py-1">
            Quota : <b>{Number(quotaAttente)}</b>
          </span>
        )}
      </div>

      {/* Add form */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-2">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="md:col-span-2 rounded-xl border border-neutral-300 px-3 py-2 text-sm"
          placeholder="Email *"
        />
        <input
          value={prenom}
          onChange={(e) => setPrenom(e.target.value)}
          className="rounded-xl border border-neutral-300 px-3 py-2 text-sm"
          placeholder="Prénom"
        />
        <input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          className="rounded-xl border border-neutral-300 px-3 py-2 text-sm"
          placeholder="Nom"
        />
        <button
          onClick={addToWaitlist}
          disabled={!canQuery || saving}
          className={cls(
            "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold",
            !canQuery || saving
              ? "bg-neutral-200 text-neutral-500 cursor-not-allowed"
              : "bg-orange-500 text-white hover:brightness-110"
          )}
        >
          <UserPlus className="h-4 w-4" />
          {saving ? "Ajout…" : "Ajouter"}
        </button>
      </div>

      {/* Errors / empty */}
      {error && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th className="text-left px-3 py-2">Email</th>
              <th className="text-left px-3 py-2">Nom</th>
              <th className="text-left px-3 py-2">Prénom</th>
              <th className="text-left px-3 py-2">Ajouté</th>
              <th className="text-left px-3 py-2">Invité</th>
              <th className="text-left px-3 py-2">Expire</th>
              <th className="text-left px-3 py-2">Consommé</th>
              <th className="text-right px-3 py-2">Action</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-neutral-500">
                  Chargement…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-neutral-500">
                  Aucune entrée en liste d’attente pour ce format.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-neutral-200">
                  <td className="px-3 py-2 font-medium text-neutral-900">{r.email}</td>
                  <td className="px-3 py-2">{r.nom || "—"}</td>
                  <td className="px-3 py-2">{r.prenom || "—"}</td>
                  <td className="px-3 py-2 text-neutral-600">{fmtDT(r.created_at)}</td>
                  <td className="px-3 py-2 text-neutral-600">{fmtDT(r.invited_at)}</td>
                  <td className="px-3 py-2 text-neutral-600">{fmtDT(r.invite_expires_at)}</td>
                  <td className="px-3 py-2 text-neutral-600">{fmtDT(r.consumed_at)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => removeRow(r.id)}
                      className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50"
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!canQuery && (
        <div className="mt-3 text-xs text-neutral-500">
          Sélectionne un format (formatId) pour afficher la liste d’attente.
        </div>
      )}
    </div>
  );
}
