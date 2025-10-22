import React from "react";
import { supabase } from "../supabase";

function cls(...xs) {
  return xs.filter(Boolean).join(" ");
}

/**
 * Modale d’attribution des dossards
 * Props attendues (comme dans ton appel existant) :
 * - open: boolean
 * - onClose: fn
 * - rows: array (toutes les lignes filtrées)
 * - selectedIds: array<string> (sélection)
 * - onDone: fn (callback après succès → pour recharger)
 */
export default function AssignBibModal({ open, onClose, rows = [], selectedIds = [], onDone }) {
  const [start, setStart] = React.useState(100);
  const [end, setEnd] = React.useState(500);
  const [scope, setScope] = React.useState(selectedIds.length ? "selected" : "all"); // "selected" | "all"
  const [orderBy, setOrderBy] = React.useState("created_at"); // "created_at" | "nom" | "prenom" | "dossard"
  const [overwrite, setOverwrite] = React.useState(false);
  const [onlyMissing, setOnlyMissing] = React.useState(true);
  const [assignCount, setAssignCount] = React.useState(null);
  const [saving, setSaving] = React.useState(false);

  // Reset propre quand on (dé)ouvre
  React.useEffect(() => {
    if (!open) {
      setStart(100);
      setEnd(500);
      setScope(selectedIds.length ? "selected" : "all");
      setOrderBy("created_at");
      setOverwrite(false);
      setOnlyMissing(true);
      setAssignCount(null);
      setSaving(false);
    }
  }, [open, selectedIds.length]);

  // Si pas ouverte, on ne rend rien (les hooks restent en haut => ordre stable ✔)
  if (!open) return null;

  const targetRows = React.useMemo(() => {
    let list = Array.isArray(rows) ? rows : [];
    if (scope === "selected") {
      const set = new Set(selectedIds);
      list = list.filter((r) => set.has(r.id));
    }
    // tri
    list = [...list].sort((a, b) => {
      const A = (a?.[orderBy] ?? "").toString().toLowerCase();
      const B = (b?.[orderBy] ?? "").toString().toLowerCase();
      if (A < B) return -1;
      if (A > B) return 1;
      return 0;
    });
    // ne garder que ceux sans dossard si demandé
    if (onlyMissing && !overwrite) {
      list = list.filter((r) => r.dossard == null || r.dossard === "");
    }
    return list;
  }, [rows, selectedIds, scope, orderBy, onlyMissing, overwrite]);

  const validRange =
    Number.isFinite(Number(start)) &&
    Number.isFinite(Number(end)) &&
    Number(end) >= Number(start);

  const capacity = validRange ? Number(end) - Number(start) + 1 : 0;

  const simulate = () => {
    if (!validRange) return setAssignCount(0);
    setAssignCount(Math.min(capacity, targetRows.length));
  };

  const run = async () => {
    if (!validRange) return alert("Plage invalide.");
    if (capacity <= 0) return alert("Plage vide.");
    if (targetRows.length === 0) return alert("Aucun coureur à numéroter dans la sélection.");

    setSaving(true);
    try {
      // Récupérer les numéros déjà pris (uniquement dans l’ensemble affiché)
      const taken = new Set(
        (rows || [])
          .map((r) => r.dossard)
          .filter((v) => v !== null && v !== undefined && String(v).trim() !== "")
          .map((v) => Number(v))
          .filter((n) => Number.isFinite(n))
      );

      // Construire la séquence disponible
      const seq = [];
      for (let n = Number(start); n <= Number(end); n++) {
        if (overwrite) {
          seq.push(n);
        } else if (!taken.has(n)) {
          seq.push(n);
        }
      }
      if (seq.length === 0) {
        setSaving(false);
        return alert("Aucun numéro disponible dans la plage.");
      }

      const toAssign = targetRows.slice(0, seq.length);

      const updates = toAssign.map((r, idx) =>
        supabase.from("inscriptions").update({ dossard: seq[idx] }).eq("id", r.id)
      );

      const results = await Promise.allSettled(updates);
      const ok = results.filter((x) => x.status === "fulfilled").length;
      const ko = results.length - ok;

      alert(`Dossards attribués : ${ok}${ko > 0 ? ` • Échecs : ${ko}` : ""}`);
      onDone?.();
    } catch (e) {
      console.error("ASSIGN_BIB_ERROR", e);
      alert("Erreur lors de l’attribution des dossards.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl ring-1 ring-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Attribuer des dossards</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-800 text-sm">Fermer</button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Début</label>
              <input
                type="number"
                value={start}
                onChange={(e) => setStart(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border px-3 py-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Fin</label>
              <input
                type="number"
                value={end}
                onChange={(e) => setEnd(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Portée</label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="mt-1 w-full rounded-xl border px-3 py-2"
              >
                <option value="selected">Coureurs sélectionnés</option>
                <option value="all">Tous les résultats filtrés</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Ordre d’attribution</label>
              <select
                value={orderBy}
                onChange={(e) => setOrderBy(e.target.value)}
                className="mt-1 w-full rounded-xl border px-3 py-2"
              >
                <option value="created_at">Date de création</option>
                <option value="nom">Nom</option>
                <option value="prenom">Prénom</option>
                <option value="dossard">Dossard actuel</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={onlyMissing}
                onChange={(e) => setOnlyMissing(e.target.checked)}
              />
              N’attribuer que si dossard manquant
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={overwrite}
                onChange={(e) => setOverwrite(e.target.checked)}
              />
              Écraser les dossards existants
            </label>
          </div>

          <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-3 text-sm">
            <div>Éligibles : <b>{targetRows.length}</b></div>
            <div>Capacité de la plage : <b>{capacity}</b></div>
            <div>Attribuables (approx.) : <b>{assignCount ?? "—"}</b></div>
            <button
              onClick={simulate}
              className="mt-2 rounded-lg border px-3 py-1.5 text-xs hover:bg-white"
            >
              Simuler
            </button>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm hover:bg-white">Annuler</button>
          <button
            onClick={run}
            disabled={saving}
            className={cls(
              "rounded-xl px-4 py-2 text-sm font-semibold text-white",
              saving ? "bg-neutral-400" : "bg-neutral-900 hover:bg-black"
            )}
          >
            {saving ? "Attribution…" : "Attribuer"}
          </button>
        </div>
      </div>
    </div>
  );
}
