// src/pages/admin/Payouts.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase"; // <-- adapte si besoin (../supabase ou ../../supabase)

function cents(n) { return Number.isFinite(n) ? n : 0; }
function eur(c) { return (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" }); }

export default function Payouts() {
  const [authInfo, setAuthInfo] = useState("(non vérifié)");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [selected, setSelected] = useState({});
  const [platformPct, setPlatformPct] = useState(5);   // % Tickrace
  const [depositPct, setDepositPct] = useState(50);    // % du net restant à verser
  const [busy, setBusy] = useState(false);

  // Garde d'accès admin (évite page blanche)
  const [gate, setGate] = useState("loading"); // loading | ok | forbidden
  const [gateMsg, setGateMsg] = useState("");

  async function checkAdmin() {
    try {
      const { data: auth } = await supabase.auth.getSession();
      const user = auth?.session?.user;
      if (!user) { setGate("forbidden"); setGateMsg("Vous devez être connecté."); return false; }
      const { data: me, error } = await supabase
        .from("profils_utilisateurs")
        .select("is_admin")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) { setGate("forbidden"); setGateMsg(error.message); return false; }
      if (!me?.is_admin) { setGate("forbidden"); setGateMsg("Accès réservé aux administrateurs."); return false; }
      setGate("ok"); setAuthInfo(`connecté: ${user.email || user.id}`);
      return true;
    } catch (e) {
      setGate("forbidden"); setGateMsg(String(e?.message || e));
      return false;
    }
  }

  async function load() {
    setLoading(true); setErr(null);
    try {
      const ok = await checkAdmin();
      if (!ok) { setLoading(false); return; }
      const { data, error } = await supabase
        .from("paiements")
        .select("id, created_at, inscription_id, destination_account_id, amount_total, fee_total, platform_fee_amount, transferred_total_cents, balance_transaction_id, charge_id, devise, status")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      setRows(data || []);
    } catch (e) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const computed = useMemo(() => rows.map((p) => {
    const gross = cents(p.amount_total);
    const stripe = cents(p.fee_total);
    const already = cents(p.transferred_total_cents);
    const desiredPlatformFee = Math.round((platformPct / 100) * gross);
    const remaining = Math.max(0, gross - stripe - desiredPlatformFee - already);
    const depositNow = Math.max(0, Math.min(remaining, Math.round((depositPct / 100) * remaining)));
    return { ...p,
      gross, stripe, already,
      platformFeeCurrent: cents(p.platform_fee_amount),
      platformFeeDesired: desiredPlatformFee,
      remaining, depositNow
    };
  }), [rows, platformPct, depositPct]);

  const totals = useMemo(() => {
    const sel = computed.filter(r => selected[r.id]);
    const count = sel.length;
    const gross = sel.reduce((a, r) => a + r.gross, 0);
    const stripe = sel.reduce((a, r) => a + r.stripe, 0);
    const curPlat = sel.reduce((a, r) => a + r.platformFeeCurrent, 0);
    const newPlat = sel.reduce((a, r) => a + r.platformFeeDesired, 0);
    const remaining = sel.reduce((a, r) => a + r.remaining, 0);
    const deposit = sel.reduce((a, r) => a + r.depositNow, 0);
    return { count, gross, stripe, curPlat, newPlat, remaining, deposit };
  }, [computed, selected]);

  async function savePlatformFees() {
    const sel = computed.filter(r => selected[r.id]);
    if (sel.length === 0) { alert("Sélection vide"); return; }
    setBusy(true);
    try {
      const res = await Promise.all(sel.map(r =>
        supabase.from("paiements").update({ platform_fee_amount: r.platformFeeDesired }).eq("id", r.id)
      ));
      const err = res.find(x => x.error)?.error;
      if (err) throw new Error(err.message);
      await load();
      alert(`Commission plateforme mise à jour sur ${sel.length} paiement(s).`);
    } catch (e) {
      alert("Erreur: " + (e?.message ?? String(e)));
    } finally { setBusy(false); }
  }

  async function transfer(mode) {
    const sel = computed.filter(r => selected[r.id]);
    if (sel.length === 0) { alert("Sélection vide"); return; }
    const { data: auth } = await supabase.auth.getSession();
    const headers = { "Content-Type": "application/json" };
    // Ajoute JWT admin + apikey pour Edge Function
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY; // Vite
    if (anon) headers["apikey"] = anon;
    if (auth?.session?.access_token) headers["Authorization"] = `Bearer ${auth.session.access_token}`;

    setBusy(true);
    let ok = 0, ko = 0;
    for (const r of sel) {
      const amount = mode === "full" ? r.remaining : r.depositNow;
      if (amount <= 0) continue;
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/release-funds`;
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

  if (gate === "loading") return <div style={{padding:24}}>Chargement de l’espace admin…</div>;
  if (gate === "forbidden") return (
    <div style={{padding:24}}>
      <h1>403 — Accès refusé</h1>
      <p style={{color:"#666", marginTop:8}}>{gateMsg}</p>
    </div>
  );

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Admin — Reversements</h1>
      <div style={{ marginBottom: 12, color: "#666" }}>Auth: {authInfo}</div>

      {err && (
        <div style={{ background: "#fff7cc", border: "1px solid #ffeb99", padding: 12, marginBottom: 16 }}>
          <b>Erreur :</b> {err}
        </div>
      )}

      <div style={{ display: "flex", gap: 16, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <label>
          % Tickrace : {platformPct}%
          <input type="number" min={0} max={50} step={0.1} value={platformPct}
                 onChange={(e) => setPlatformPct(Number(e.target.value))}
                 style={{ marginLeft: 8, width: 100 }} />
        </label>
        <button onClick={savePlatformFees} disabled={busy}>Enregistrer ce % sur la sélection</button>
        <label style={{ marginLeft: 24 }}>
          % d'acompte : {depositPct}% (du net restant)
          <input type="number" min={0} max={100} step={1} value={depositPct}
                 onChange={(e) => setDepositPct(Number(e.target.value))}
                 style={{ marginLeft: 8, width: 100 }} />
        </label>
        <button onClick={() => transfer("deposit")} disabled={busy} style={{ marginLeft: 8 }}>Verser l'acompte</button>
        <button onClick={() => transfer("full")} disabled={busy} style={{ marginLeft: 8 }}>Tout transférer</button>
        <button onClick={load} disabled={busy} style={{ marginLeft: 8 }}>Actualiser</button>
      </div>

      <div style={{ overflowX: "auto", border: "1px solid #ddd", borderRadius: 8 }}>
        <table style={{ minWidth: 900, borderCollapse: "collapse", width: "100%" }}>
          <thead style={{ background: "#f5f5f5" }}>
            <tr>
              <th style={{ padding: 8 }}>
                <input
                  type="checkbox"
                  checked={computed.length > 0 && computed.every(r => selected[r.id])}
                  onChange={(e) => {
                    const on = e.target.checked;
                    const obj = {};
                    computed.forEach(r => obj[r.id] = on);
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
              <tr><td colSpan={12} style={{ padding: 16, color: "#666" }}>Chargement…</td></tr>
            ) : computed.length === 0 ? (
              <tr><td colSpan={12} style={{ padding: 16, color: "#666" }}>
                Aucun paiement (ou accès refusé). Vérifie que ton compte est <code>is_admin=true</code> et que les RLS sont en place.
              </td></tr>
            ) : (
              computed.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid #eee" }}>
                  <td style={{ padding: 8 }}>
                    <input type="checkbox"
                           checked={!!selected[r.id]}
                           onChange={(e) => setSelected((s) => ({ ...s, [r.id]: e.target.checked }))} />
                  </td>
                  <td style={{ padding: 8 }}>{new Date(r.created_at).toLocaleString("fr-FR")}</td>
                  <td style={{ padding: 8, fontFamily: "monospace" }}>{r.id.slice(0, 8)}…</td>
                  <td style={{ padding: 8, fontFamily: "monospace" }}>{r.inscription_id?.slice(0, 8) ?? "-"}…</td>
                  <td style={{ padding: 8, fontFamily: "monospace" }}>{r.destination_account_id ?? "-"}</td>
                  <td style={{ padding: 8, textAlign: "right" }}>{eur(r.gross)}</td>
                  <td style={{ padding: 8, textAlign: "right" }}>{eur(r.stripe)}</td>
                  <td style={{ padding: 8, textAlign: "right" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                      <span style={{ color: "#888", textDecoration: "line-through" }}>{eur(r.platformFeeCurrent)}</span>
                      <span style={{ fontWeight: 600 }}>{eur(r.platformFeeDesired)}</span>
                    </div>
                  </td>
                  <td style={{ padding: 8, textAlign: "right" }}>{eur(r.already)}</td>
                  <td style={{ padding: 8, textAlign: "right", fontWeight: 600 }}>{eur(r.remaining)}</td>
                  <td style={{ padding: 8, textAlign: "right" }}>{eur(r.depositNow)}</td>
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
