"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Loader2, RefreshCw, Send, ShieldCheck, Percent, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

// ✅ Supabase client (navigateur)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
if (!supabaseUrl || !supabaseAnon) {
  // Cela s'affiche en dev si les variables sont manquantes
  // (évite un crash build-time)
  // eslint-disable-next-line no-console
  console.warn("[Admin Payouts] NEXT_PUBLIC_SUPABASE_URL / ANON_KEY manquantes");
}
const supabase = createClient(supabaseUrl, supabaseAnon);

// ---- Types
export type Paiement = {
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

export default function AdminPayoutsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Paiement[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [platformPct, setPlatformPct] = useState<number>(5); // % que garde Tickrace
  const [depositPct, setDepositPct] = useState<number>(50); // % du net restant à verser maintenant
  const [updating, setUpdating] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [filter, setFilter] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("paiements")
      .select(
        "id, created_at, inscription_id, destination_account_id, amount_total, fee_total, platform_fee_amount, transferred_total_cents, balance_transaction_id, charge_id, devise, status"
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      toast({ title: "Erreur lecture", description: error.message, variant: "destructive" });
    } else {
      setRows(data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calculs par ligne selon % courants (prévisualisation)
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

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return computed;
    return computed.filter(
      (r) =>
        r.id.toLowerCase().includes(f) ||
        (r.inscription_id ?? "").toLowerCase().includes(f) ||
        (r.destination_account_id ?? "").toLowerCase().includes(f) ||
        (r.charge_id ?? "").toLowerCase().includes(f)
    );
  }, [computed, filter]);

  const totals = useMemo(() => {
    const sel = filtered.filter((r) => selected[r.id]);
    const count = sel.length;
    const gross = sel.reduce((a, r) => a + r.gross, 0);
    const stripe = sel.reduce((a, r) => a + r.stripe, 0);
    const curPlat = sel.reduce((a, r) => a + r.platformFeeCurrent, 0);
    const newPlat = sel.reduce((a, r) => a + r.platformFeeDesired, 0);
    const remaining = sel.reduce((a, r) => a + r.remaining, 0);
    const deposit = sel.reduce((a, r) => a + r.depositNow, 0);
    return { count, gross, stripe, curPlat, newPlat, remaining, deposit };
  }, [filtered, selected]);

  function toggleAll(on: boolean) {
    const obj: Record<string, boolean> = {};
    filtered.forEach((r) => (obj[r.id] = on));
    setSelected(obj);
  }

  async function savePlatformFeesForSelection() {
    const sel = filtered.filter((r) => selected[r.id]);
    if (sel.length === 0) {
      toast({ title: "Sélection vide", description: "Choisis au moins un paiement." });
      return;
    }
    setUpdating(true);
    try {
      const updates = sel.map((r) =>
        supabase.from("paiements").update({ platform_fee_amount: r.platformFeeDesired }).eq("id", r.id)
      );
      const results = await Promise.all(updates);
      const err = results.find((r: any) => r.error)?.error;
      if (err) throw new Error(err.message);
      toast({ title: "OK", description: `${sel.length} paiement(s) mis à jour.` });
      await load();
    } catch (e: any) {
      toast({ title: "Erreur mise à jour", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  }

  async function transferSelection(mode: "deposit" | "full") {
    const sel = filtered.filter((r) => selected[r.id]);
    if (sel.length === 0) {
      toast({ title: "Sélection vide", description: "Choisis au moins un paiement." });
      return;
    }

    // Auth headers (JWT admin)
    const { data: auth } = await supabase.auth.getSession();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      apikey: supabaseAnon,
    };
    if (auth?.session?.access_token) headers["Authorization"] = `Bearer ${auth.session.access_token}`;

    setTransferring(true);
    let ok = 0, ko = 0;

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
      } catch (e: any) {
        ko++;
      }
    }

    setTransferring(false);
    toast({
      title: "Transferts terminés",
      description: `${ok} OK, ${ko} échec(s).`,
      variant: ko ? "destructive" : "default",
    });
    await load();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Wallet className="h-6 w-6" /> Admin — Reversements
        </h1>
        <div className="flex items-center gap-2">
          <Button onClick={load} variant="secondary">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Paramètres de calcul (prévisualisation)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground flex items-center gap-2">
              <Percent className="h-4 w-4" /> % commission Tickrace (appliquée sur le brut)
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step={0.1}
                min={0}
                max={50}
                value={platformPct}
                onChange={(e) => setPlatformPct(Number(e.target.value))}
                className="w-32"
              />
              <Button variant="outline" onClick={savePlatformFeesForSelection} disabled={updating}>
                {updating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enregistrer ce % sur la sélection
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Met à jour <code>paiements.platform_fee_amount</code> pour les paiements cochés.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">% d’acompte à verser maintenant (du net restant)</label>
            <Input
              type="number"
              step={1}
              min={0}
              max={100}
              value={depositPct}
              onChange={(e) => setDepositPct(Number(e.target.value))}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">“Tout transférer” ignore ce % et verse le net intégral.</p>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Filtre (id, inscription, compte, charge)</label>
            <Input placeholder="Rechercher…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>À reverser</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={filtered.every((r) => selected[r.id]) && filtered.length > 0}
                onCheckedChange={(v) => toggleAll(Boolean(v))}
              />
              <span className="text-sm text-muted-foreground">
                {totals.count} paiement(s) sélectionné(s) — Brut {eur(totals.gross)} · Frais Stripe {eur(totals.stripe)} · Plateforme actuelle {eur(totals.curPlat)} → nouvelle {eur(totals.newPlat)} · Net restant {eur(totals.remaining)} · Acompte prévu {eur(totals.deposit)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => transferSelection("deposit")} disabled={transferring || totals.count === 0}>
                {transferring && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Send className="h-4 w-4 mr-2" /> Verser l’acompte
              </Button>
              <Button onClick={() => transferSelection("full")} disabled={transferring || totals.count === 0}>
                {transferring && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Send className="h-4 w-4 mr-2" /> Tout transférer
              </Button>
            </div>
          </div>

          <div className="overflow-auto rounded-lg border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="p-2"></th>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Paiement</th>
                  <th className="p-2 text-left">Inscription</th>
                  <th className="p-2 text-left">Compte connecté</th>
                  <th className="p-2 text-right">Brut</th>
                  <th className="p-2 text-right">Frais Stripe</th>
                  <th className="p-2 text-right">Plateforme (actuelle → nouvelle)</th>
                  <th className="p-2 text-right">Déjà versé</th>
                  <th className="p-2 text-right">Net restant</th>
                  <th className="p-2 text-right">Acompte (prévu)</th>
                  <th className="p-2 text-left">Charge</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="p-4" colSpan={12}>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td className="p-4 text-muted-foreground" colSpan={12}>
                      Aucun paiement à afficher.
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id} className="border-t hover:bg-muted/20">
                      <td className="p-2">
                        <Checkbox
                          checked={!!selected[r.id]}
                          onCheckedChange={(v) => setSelected((s) => ({ ...s, [r.id]: Boolean(v) }))}
                        />
                      </td>
                      <td className="p-2">{new Date(r.created_at).toLocaleString("fr-FR")}</td>
                      <td className="p-2 font-mono">{r.id.slice(0, 8)}…</td>
                      <td className="p-2 font-mono">{r.inscription_id?.slice(0, 8)}…</td>
                      <td className="p-2 font-mono">{r.destination_account_id ?? "-"}</td>
                      <td className="p-2 text-right">{eur((r as any).gross)}</td>
                      <td className="p-2 text-right">{eur((r as any).stripe)}</td>
                      <td className="p-2 text-right">
                        <div className="flex flex-col items-end">
                          <span className="line-through text-muted-foreground">{eur((r as any).platformFeeCurrent)}</span>
                          <span className="font-medium">{eur((r as any).platformFeeDesired)}</span>
                        </div>
                      </td>
                      <td className="p-2 text-right">{eur((r as any).already)}</td>
                      <td className="p-2 text-right font-semibold">{eur((r as any).remaining)}</td>
                      <td className="p-2 text-right">{eur((r as any).depositNow)}</td>
                      <td className="p-2 font-mono">{r.charge_id ?? "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
