"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

/**
 * ✅ Page minimale, sans dépendances UI externes (pas de shadcn, pas d'icônes)
 * À placer dans app/admin/payouts/page.tsx
 * Affiche clairement les erreurs (env manquantes, non authentifié, RLS, etc.).
 */

type Paiement = {
  id: string;
  created_at: string;
  inscription_id: string | null;
  destination_account_id: string | null;
  amount_total: number; // cents
  fee_total: number | null; // frais Stripe (SCT) cents
  platform_fee_amount: number | null; // commission Tickrace en cents
  transferred_total_cents: number | null;
  balance_transaction_id: string | null;
  charge_id: string | null;
  devise: string | null;
  status: string | null;
};

function cents(n?: number | null) {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}
function eur(c: number) {
  return (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export default function Page() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

  const [envError, setEnvError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string>("(non vérifié)");
  const [rows, setRows] = useState<Paiement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [platformPct, setPlatformPct] = useState<number>(5);
  const [depositPct, setDepositPct] = useState<number>(50);
  const [busy, setBusy] = useState(false);

  // 1) Vérif env
  useEffect(() => {
    if (!supabaseUrl || !supabaseAnon) {
      setEnvError(
        "Variables d'environnement manquantes : NEXT_PUBLIC_SUPABASE_URL et/ou NEXT_PUBLIC_SUPABASE_ANON_KEY. Configure-les en prod et dans .env.local."
      );
    }
  }, [supabaseUrl, supabaseAnon]);

  // 2) Client Supabase (seulement si env OK)
  const supabase = useMemo(() => {
    if (!supabaseUrl || !supabaseAnon) return null;
    return createClient(supabaseUrl, supabaseAnon);
  }, [supabaseUrl, supabaseAnon]);

  // 3) Chargement données + statut auth
  async function load() {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const { data: auth } = await supabase.auth.getSession();
      const isLogged = !!auth?.session?.user;
      setAuthInfo(isLogged ? `connecté: ${auth!.session!.user!.email}` : "non connecté");

      const { data, error } = await supabase
        .from("paiements")
        .select(
          "id, created_at, inscription_id, destination_account_id, amount_total, fee_total, platform_fee_amount, transferred_total_cents, balance_transaction_id, charge_id, devise, status"
        )
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      setRows(data || []);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // 4) Calculs
  const computed = useMemo(() => {
    return rows.map((p) => {
      const gross = cents(p.amount_total);
      const stripe = cents(p.fee_total);
      const already = cents(p.transferred_total_cents);
      const desiredPlatformFee = Math.round((platformPct / 100) * gross);
      const remaining = Math.max(0, gross - stripe - desiredPlatformFee - already);
      const depositNow = Math.max(0, Math.min(remaining, Math.round((depositPct / 100) * remaining)));
      return {
        ...p,
        gross,
        stripe,
        already,
        platformFeeCurrent: cents(p.platform_fee_amount),
        platformFeeDesired: desiredPlatformFee,
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
    const curPlat = sel.reduce((a, r) => a + r.platformFeeCurrent, 0);
    const newPlat = sel.reduce((a, r) => a + r.platformFeeDesired, 0);
    const remaining = sel.reduce((a, r) => a + r.remaining, 0);
    const deposit = sel.reduce((a, r) => a + r.depositNow, 0);
    return { count, gross, stripe, curPlat, newPlat, remaining, deposit };
  }, [computed, selected]);

  // 5) Actions
  async function savePlatformFees() {
    if (!supabase) return;
    const sel = computed.filter((r) => selected[r.id]);
    if (sel.length === 0) {
      alert("Sélection vide");
      return;
    }
    setBusy(true);
    try {
      const updates = sel.map((r) =>
        supabase.from("paiements").update({ platform_fee_amount: r.platformFeeDesired }).eq("id", r.id)
      );
      const res = await Promise.all(updates);
      const err = res.find((x: any) => x.error)?.error;
      if (err) throw new Error(err.message);
      await load();
      alert(`Commission plateforme mise à jour sur ${sel.length} paiement(s).`);
    } catch (e: any) {
      alert("Erreur: " + (e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function transfer(mode: "deposit" | "full") {
    if (!supabase) return;
    const sel = computed.filter((r) => selected[r.id]);
    if (sel.length === 0) {
      alert("Sélection vide");
      return;
    }

    const { data: auth } = await supabase.auth.getSession();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      apikey: supabaseAnon!,
    };
    if (auth?.session?.access_token) headers["Authorization"] = `Bearer ${auth.session.access_token}`;

    setBusy(true);
    let ok = 0,
      ko = 0;
    for (const r of sel) {
      const amount = mode === "full" ? r.remaining : r.depositNow;
      if (amount <= 0) continue;
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/release-funds`, {
          method: "POST",
          headers,
          body: JSON.stringify({ paiement_id: r.id, amount_eur: amount / 100 }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({} as any));
          throw new Error(j?.error || res.statusText);
        }
        ok++;
      } catch (e) {
        ko++;
      }
    }
    setBusy(false);
    await load();
    alert(`Transferts terminés: ${ok} OK, ${ko} échec(s).`);
  }

  // 6) UI
  return (
    <div style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Admin — Reversements (Minimal)</h1>
      <div style={{ marginBottom: 12, color: "#666" }}>
        Env: <code>NEXT_PUBLIC_SUPABASE_URL</code> = <b>{supabaseUrl || "(manquante)"}</b>,
        <span style={{ marginLeft: 8 }}>
          <code>ANON_KEY</code> = <b>{supabaseAnon ? "OK" : "(manquante)"} </b>
        </span>
      </div>
      <div style={{ marginBottom: 12, color: "#666" }}>Auth: {authInfo}</div>

      {envError && (
        <div style={{ background: "#ffe8e8", border: "1px solid #ffb3b3", padding: 12, marginBottom: 16 }}>
          <b>Erreur d'environnement :</b> {envError}
        </div>
      )}

      {error && (
        <div style={{ background: "#fff7cc", border: "1px solid #ffeb99", padding: 12, marginBottom: 16 }}>
          <b>Erreur :</b> {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 16, marginBottom: 16, alignItems: "center" }}>
        <label>
          % Tickrace : {platformPct}%
          <input
            type="number"
            min={0}
            max={50}
            step={0.1}
            value={platformPct}
            onChange={(e) => setPlatformPct(Number(e.target.value))}
            style={{ marginLeft: 8, width: 100 }}
          />
        </label>
        <button onClick={savePlatformFees} disabled={busy}>
          Enregistrer ce % sur la sélection
        </button>
        <label style={{ marginLeft: 24 }}>
          % d'acompte : {depositPct}% (du net restant)
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={depositPct}
            onChange={(e) => setDepositPct(Number(e.target.value))}
            style={{ marginLeft: 8, width: 100 }}
          />
        </label>
        <button onClick={() => transfer("deposit")} disabled={busy} style={{ marginLeft: 8 }}>
          Verser l'acompte
        </button>
        <button onClick={() => transfer("full")} disabled={busy} style={{ marginLeft: 8 }}>
          Tout transférer
        </button>
        <button onClick={load} disabled={busy} style={{ marginLeft: 8 }}>
          Actualiser
        </button>
      </div>

      <div style={{ overflowX: "auto", border: "1px solid #ddd", borderRadius: 8 }}>
        <table style={{ minWidth: 900, borderCollapse: "collapse", width: "100%" }}>
          <thead style={{ background: "#f5f5f5" }}>
            <tr>
              <th style={{ padding: 8 }}>
                <input
                  type="checkbox"
                  checked={computed.length > 0 && computed.every((r) => selected[r.id])}
                  onChange={(e) => {
                    const on = e.target.checked;
                    const obj: Record<string, boolean> = {};
                    computed.forEach((r) => (obj[r.id] = on));
                    setSelected(obj);
                  }}
                />
              </th>
              <th style={{ padding: 8, textAlign: "left" }}>Date</th>
              <th style={{ padding: 8, textAlign: "left" }}>Paiement</th>
              <th style={{ padding: 8, textAlign: "left" }}>Inscription</th>
              <th style={{ padding: 8, textAlign: "left" }}>Compte connecté</th>
              <th style={{ padding: 8, textAlign: "right" }}>Brut</th>
              <th style={{ padding: 8, textAlign: "right" }}>Frais Stripe</th>
              <th style={{ padding: 8, textAlign: "right" }}>Plateforme (actuelle → nouvelle)</th>
              <th style={{ padding: 8, textAlign: "right" }}>Déjà versé</th>
              <th style={{ padding: 8, textAlign: "right" }}>Net restant</th>
              <th style={{ padding: 8, textAlign: "right" }}>Acompte (prévu)</th>
              <th style={{ padding: 8, textAlign: "left" }}>Charge</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={12} style={{ padding: 16, color: "#666" }}>
                  Chargement…
                </td>
              </tr>
            ) : computed.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ padding: 16, color: "#666" }}>
                  Aucun paiement (ou accès refusé). Vérifie que ton compte est <code>is_admin=true</code> et que les RLS sont en place.
                </td>
              </tr>
            ) : (
              computed.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid #eee" }}>
                  <td style={{ padding: 8 }}>
                    <input
                      type="checkbox"
                      checked={!!selected[r.id]}
                      onChange={(e) => setSelected((s) => ({ ...s, [r.id]: e.target.checked }))}
                    />
                  </td>
                  <td style={{ padding: 8 }}>{new Date(r.created_at).toLocaleString("fr-FR")}</td>
                  <td style={{ padding: 8, fontFamily: "monospace" }}>{r.id.slice(0, 8)}…</td>
                  <td style={{ padding: 8, fontFamily: "monospace" }}>{r.inscription_id?.slice(0, 8) ?? "-"}…</td>
                  <td style={{ padding: 8, fontFamily: "monospace" }}>{r.destination_account_id ?? "-"}</td>
                  <td style={{ padding: 8, textAlign: "right" }}>{eur((r as any).gross)}</td>
                  <td style={{ padding: 8, textAlign: "right" }}>{eur((r as any).stripe)}</td>
                  <td style={{ padding: 8, textAlign: "right" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                      <span style={{ color: "#888", textDecoration: "line-through" }}>{eur((r as any).platformFeeCurrent)}</span>
                      <span style={{ fontWeight: 600 }}>{eur((r as any).platformFeeDesired)}</span>
                    </div>
                  </td>
                  <td style={{ padding: 8, textAlign: "right" }}>{eur((r as any).already)}</td>
                  <td style={{ padding: 8, textAlign: "right", fontWeight: 600 }}>{eur((r as any).remaining)}</td>
                  <td style={{ padding: 8, textAlign: "right" }}>{eur((r as any).depositNow)}</td>
                  <td style={{ padding: 8, fontFamily: "monospace" }}>{r.charge_id ?? "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
