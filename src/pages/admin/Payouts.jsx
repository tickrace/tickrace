// src/pages/admin/Payouts.jsx

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase";
import { RefreshCw, Loader2 } from "lucide-react";

/* ----------------------------- utils ----------------------------- */
function cents(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}
function eur(c) {
  return (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}
function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("fr-FR");
}

/* ----------------------------- page ------------------------------ */
export default function Payouts() {
  // Filtres
  const [filters, setFilters] = useState({
    search: "", // course / format / email / charge
    statut: "", // status paiement
    course_id: "",
    date_from: "",
    date_to: "",
  });

  // Réglages calculs
  const [platformPct, setPlatformPct] = useState(5); // % Tickrace sur le brut
  const [depositPct, setDepositPct] = useState(50); // % du net restant pour acompte

  // Data
  const [rows, setRows] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [selected, setSelected] = useState({});
  const [busy, setBusy] = useState(false);

  // Sync frais Stripe
  const [syncing, setSyncing] = useState({}); // { [paiementId]: true }
  const [syncAllBusy, setSyncAllBusy] = useState(false);

  // Gate admin
  const [gate, setGate] = useState("loading");
  const [gateMsg, setGateMsg] = useState("");

  async function checkAdmin() {
    try {
      const { data: auth } = await supabase.auth.getSession();
      const user = auth?.session?.user;
      if (!user) {
        setGate("forbidden");
        setGateMsg("Connectez-vous.");
        return false;
      }

      const { data: isA } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!isA) {
        setGate("forbidden");
        setGateMsg("Accès réservé aux administrateurs.");
        return false;
      }

      setGate("ok");
      return true;
    } catch (e) {
      setGate("forbidden");
      setGateMsg(String(e?.message || e));
      return false;
    }
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("courses").select("id, nom").order("nom");
      setCourses(data || []);
    })();
  }, []);

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const ok = await checkAdmin();
      if (!ok) {
        setLoading(false);
        return;
      }

      let q = supabase.from("admin_paiements_v").select("*");

      if (filters.course_id) q = q.eq("course_id", filters.course_id);
      if (filters.statut) q = q.eq("status", filters.statut);
      if (filters.date_from) q = q.gte("created_at", `${filters.date_from}T00:00:00`);
      if (filters.date_to) q = q.lte("created_at", `${filters.date_to}T23:59:59`);

      if (filters.search.trim()) {
        const s = `%${filters.search.trim()}%`;
        q = q.or(
          [
            `course_nom.ilike.${s}`,
            `format_nom.ilike.${s}`,
            `coureur_email.ilike.${s}`,
            `coureur_nom.ilike.${s}`,
            `coureur_prenom.ilike.${s}`,
            `charge_id.ilike.${s}`,
          ].join(","),
        );
      }

      q = q.order("created_at", { ascending: false }).limit(300);

      const { data, error } = await q;
      if (error) throw error;

      setRows(data || []);
    } catch (e) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, []);
  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [JSON.stringify(filters)]);

  /* ------------------------- computed rows ------------------------- */
  const computed = useMemo(() => {
    return (rows || []).map((p) => {
      const gross = cents(p.amount_total_cents);
      const stripe = cents(p.fee_total_cents);
      const already = cents(p.transferred_total_cents);

      // Ce que la DB a déjà comme commission plateforme (historique)
      const currentPlat = cents(p.platform_fee_cents);

      // Commission souhaitée (slider)
      const desiredPlatformFee = Math.round((platformPct / 100) * gross);

      // ✅ Nouvelle colonne “Net final” (après frais Stripe + Tickrace)
      const netFinal = Math.max(0, gross - stripe - desiredPlatformFee);

      // Net restant basé sur netFinal (plus cohérent quand tu modifies le %)
      const remaining = Math.max(0, netFinal - already);

      // Acompte proposé sur le net restant
      const depositNow = Math.max(0, Math.min(remaining, Math.round((depositPct / 100) * remaining)));

      return {
        ...p,
        gross,
        stripe,
        already,
        currentPlat,
        desiredPlatformFee,
        netFinal,
        remaining,
        depositNow,
      };
    });
  }, [rows, platformPct, depositPct]);

  const totals = useMemo(() => {
    const sel = computed.filter((r) => selected[r.id]);
    const count = sel.length;

    const gross = sel.reduce((a, r) => a + r.gross, 0);
    const stripe = sel.reduce((a, r) => a + r.stripe, 0);
    const curPlat = sel.reduce((a, r) => a + r.currentPlat, 0);
    const newPlat = sel.reduce((a, r) => a + r.desiredPlatformFee, 0);
    const netFinal = sel.reduce((a, r) => a + r.netFinal, 0);
    const remaining = sel.reduce((a, r) => a + r.remaining, 0);
    const deposit = sel.reduce((a, r) => a + r.depositNow, 0);

    return { count, gross, stripe, curPlat, newPlat, netFinal, remaining, deposit };
  }, [computed, selected]);

  /* ------------------------- actions ------------------------- */
  async function savePlatformFees() {
    const sel = computed.filter((r) => selected[r.id]);
    if (sel.length === 0) {
      alert("Sélection vide");
      return;
    }

    setBusy(true);
    try {
      const res = await Promise.all(
        sel.map((r) => supabase.from("paiements").update({ platform_fee_amount: r.desiredPlatformFee }).eq("id", r.id)),
      );
      const anyErr = res.find((x) => x.error)?.error;
      if (anyErr) throw new Error(anyErr.message);

      await load();
      alert(`Commission plateforme mise à jour sur ${sel.length} paiement(s).`);
    } catch (e) {
      alert("Erreur: " + (e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function transfer(mode) {
    const sel = computed.filter((r) => selected[r.id]);
    if (sel.length === 0) {
      alert("Sélection vide");
      return;
    }

    const { data: auth } = await supabase.auth.getSession();
    const headers = { "Content-Type": "application/json" };
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (anon) headers["apikey"] = anon;
    if (auth?.session?.access_token) headers["Authorization"] = `Bearer ${auth.session.access_token}`;

    setBusy(true);

    let ok = 0;
    let ko = 0;

    for (const r of sel) {
      const amount = mode === "full" ? r.remaining : r.depositNow;
      if (amount <= 0) continue;

      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/release-funds`;
        // eslint-disable-next-line no-await-in-loop
        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ paiement_id: r.id, amount_eur: amount / 100 }),
        });

        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || res.statusText);
        }

        ok++;
      } catch {
        ko++;
      }
    }

    setBusy(false);
    await load();
    alert(`Transferts terminés: ${ok} OK, ${ko} échec(s).`);
  }

  async function syncStripeFees(paiementId) {
    if (!paiementId) return;

    setSyncing((m) => ({ ...m, [paiementId]: true }));
    try {
      const { error } = await supabase.functions.invoke("sync-stripe-fees", {
        body: { paiement_id: paiementId },
      });
      if (error) throw error;

      await load();
    } catch (e) {
      alert("Sync frais Stripe impossible: " + (e?.message ?? String(e)));
    } finally {
      setSyncing((m) => {
        const c = { ...m };
        delete c[paiementId];
        return c;
      });
    }
  }

  async function syncStripeFeesForSelection() {
    const sel = computed.filter((r) => selected[r.id]);
    if (sel.length === 0) {
      alert("Sélection vide");
      return;
    }

    const todo = sel.filter((r) => cents(r.fee_total_cents) === 0);
    if (todo.length === 0) {
      alert("Tous les paiements sélectionnés ont déjà des frais Stripe.");
      return;
    }

    setSyncAllBusy(true);

    let ok = 0;
    let ko = 0;

    for (const r of todo) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const { error } = await supabase.functions.invoke("sync-stripe-fees", {
          body: { paiement_id: r.id },
        });
        if (error) throw error;
        ok++;
      } catch {
        ko++;
      }
    }

    setSyncAllBusy(false);
    await load();
    alert(`Sync frais Stripe: ${ok} OK, ${ko} échec(s).`);
  }

  /* ---------------------------- render ---------------------------- */
  if (gate === "loading") return <div className="p-6">Chargement de l’espace admin…</div>;
  if (gate === "forbidden") return <div className="p-6 text-red-600">403 — {gateMsg}</div>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Admin — Paiements</h1>
        <button className="border rounded px-3 py-1" onClick={load} disabled={loading}>
          Actualiser
        </button>
      </div>

      {err && (
        <div className="p-3 border border-yellow-300 bg-yellow-50 text-yellow-800 rounded">
          Erreur : {err}
        </div>
      )}

      {/* Filtres */}
      <div className="grid gap-3 md:grid-cols-6">
        <input
          className="border rounded px-2 py-1"
          placeholder="Recherche (course, format, email, charge)"
          value={filters.search}
          onChange={(e) => setFilters((s) => ({ ...s, search: e.target.value }))}
        />
        <select
          className="border rounded px-2 py-1"
          value={filters.statut}
          onChange={(e) => setFilters((s) => ({ ...s, statut: e.target.value }))}
        >
          <option value="">Tous statuts</option>
          <option value="succeeded">succeeded</option>
          <option value="pending">pending</option>
          <option value="failed">failed</option>
          <option value="refunded">refunded</option>
          <option value="paye">paye</option>
          <option value="rembourse">rembourse</option>
          <option value="partiellement_rembourse">partiellement_rembourse</option>
        </select>
        <select
          className="border rounded px-2 py-1"
          value={filters.course_id}
          onChange={(e) => setFilters((s) => ({ ...s, course_id: e.target.value }))}
        >
          <option value="">Toutes courses</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="border rounded px-2 py-1"
          value={filters.date_from}
          onChange={(e) => setFilters((s) => ({ ...s, date_from: e.target.value }))}
        />
        <input
          type="date"
          className="border rounded px-2 py-1"
          value={filters.date_to}
          onChange={(e) => setFilters((s) => ({ ...s, date_to: e.target.value }))}
        />
        <div className="flex items-center gap-2">
          <button
            className="border rounded px-3 py-1"
            onClick={() => setFilters({ search: "", statut: "", course_id: "", date_from: "", date_to: "" })}
          >
            Réinitialiser
          </button>
          <button className="border rounded px-3 py-1" onClick={load}>
            Appliquer
          </button>
        </div>
      </div>

      {/* Réglages & actions */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span>% Tickrace (sur brut)</span>
          <input
            type="number"
            min={0}
            max={50}
            step={0.1}
            value={platformPct}
            onChange={(e) => setPlatformPct(Number(e.target.value))}
            className="border rounded px-2 py-1 w-24"
          />
        </label>

        <button onClick={savePlatformFees} disabled={busy} className="border rounded px-3 py-1">
          Enregistrer ce % sur la sélection
        </button>

        <label className="flex items-center gap-2 ml-2">
          <span>% acompte sur net restant</span>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={depositPct}
            onChange={(e) => setDepositPct(Number(e.target.value))}
            className="border rounded px-2 py-1 w-24"
          />
        </label>

        <button
          onClick={syncStripeFeesForSelection}
          disabled={syncAllBusy || loading}
          className="border rounded px-3 py-1 inline-flex items-center gap-2"
          title="Récupérer frais Stripe (charge + balance transaction) pour la sélection"
        >
          {syncAllBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Rafraîchir frais Stripe (sélection)
        </button>

        <button onClick={() => transfer("deposit")} disabled={busy} className="border rounded px-3 py-1">
          Verser l'acompte
        </button>
        <button onClick={() => transfer("full")} disabled={busy} className="border rounded px-3 py-1">
          Tout transférer
        </button>
      </div>

      {/* Tableau */}
      <div className="rounded-xl border overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-2">
                <input
                  type="checkbox"
                  checked={computed.length > 0 && computed.every((r) => selected[r.id])}
                  onChange={(e) => {
                    const on = e.target.checked;
                    const obj = {};
                    computed.forEach((r) => (obj[r.id] = on));
                    setSelected(obj);
                  }}
                />
              </th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Course / Format</th>
              <th className="px-3 py-2 text-left">Coureur</th>
              <th className="px-3 py-2 text-left">Compte connecté</th>
              <th className="px-3 py-2 text-right">Brut</th>
              <th className="px-3 py-2 text-right">Frais Stripe</th>
              <th className="px-3 py-2 text-right">Tickrace (actuelle → nouvelle)</th>
              <th className="px-3 py-2 text-right">Net final</th>
              <th className="px-3 py-2 text-right">Déjà versé</th>
              <th className="px-3 py-2 text-right">Net restant</th>
              <th className="px-3 py-2 text-right">Acompte (prévu)</th>
              <th className="px-3 py-2 text-left">Charge</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={14} className="px-3 py-4 text-gray-500">
                  Chargement…
                </td>
              </tr>
            ) : computed.length === 0 ? (
              <tr>
                <td colSpan={14} className="px-3 py-6 text-gray-500">
                  Aucun paiement
                </td>
              </tr>
            ) : (
              computed.map((r) => {
                const isSyncing = !!syncing[r.id];
                const hasStripeFee = cents(r.fee_total_cents) > 0;

                return (
                  <tr key={r.id} className="border-t">
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={!!selected[r.id]}
                        onChange={(e) => setSelected((s) => ({ ...s, [r.id]: e.target.checked }))}
                      />
                    </td>

                    <td className="px-3 py-2">{fmtDateTime(r.created_at)}</td>

                    <td className="px-3 py-2">
                      <div className="font-medium">{r.course_nom ?? "-"}</div>
                      <div className="text-gray-500">
                        {r.format_nom ?? "-"}{" "}
                        {r.format_date ? `— ${new Date(r.format_date).toLocaleDateString("fr-FR")}` : ""}
                      </div>
                    </td>

                    <td className="px-3 py-2">
                      <div className="font-medium">
                        {r.coureur_prenom} {r.coureur_nom}
                      </div>
                      <div className="text-gray-500">{r.coureur_email}</div>
                    </td>

                    <td className="px-3 py-2 font-mono">{r.destination_account_id ?? "-"}</td>

                    <td className="px-3 py-2 text-right">{eur(r.gross)}</td>
                    <td className="px-3 py-2 text-right">{eur(r.stripe)}</td>

                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-gray-500 line-through">{eur(r.currentPlat)}</span>
                        <span className="font-semibold">{eur(r.desiredPlatformFee)}</span>
                      </div>
                    </td>

                    <td className="px-3 py-2 text-right font-semibold">{eur(r.netFinal)}</td>
                    <td className="px-3 py-2 text-right">{eur(r.already)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{eur(r.remaining)}</td>
                    <td className="px-3 py-2 text-right">{eur(r.depositNow)}</td>

                    <td className="px-3 py-2 font-mono">{r.charge_id ?? "-"}</td>

                    <td className="px-3 py-2">
                      <button
                        onClick={() => syncStripeFees(r.id)}
                        disabled={isSyncing}
                        className={[
                          "border rounded px-2 py-1 text-xs inline-flex items-center gap-2",
                          hasStripeFee ? "opacity-60" : "",
                        ].join(" ")}
                        title={
                          hasStripeFee
                            ? "Frais déjà présents (tu peux resync si besoin)"
                            : "Récupérer charge + balance transaction + frais Stripe"
                        }
                      >
                        {isSyncing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        Sync frais
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Résumé sélection */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
        <span>Sélection : {totals.count}</span>
        <span>
          Brut : <b>{eur(totals.gross)}</b>
        </span>
        <span>
          Stripe : <b>{eur(totals.stripe)}</b>
        </span>
        <span>
          Tickrace actuel : <b>{eur(totals.curPlat)}</b>
        </span>
        <span>
          Tickrace nouveau : <b>{eur(totals.newPlat)}</b>
        </span>
        <span>
          Net final : <b>{eur(totals.netFinal)}</b>
        </span>
        <span>
          Net restant : <b>{eur(totals.remaining)}</b>
        </span>
        <span>
          Acompte prévu : <b>{eur(totals.deposit)}</b>
        </span>
      </div>
    </div>
  );
}
