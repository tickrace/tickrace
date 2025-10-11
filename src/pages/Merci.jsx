// src/pages/Merci.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "../supabase";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function formatEur(cents) {
  const n = Number(cents || 0) / 100;
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }) {
  const s = (status || "").toLowerCase();
  const map = {
    paye: "bg-emerald-100 text-emerald-800",
    pending: "bg-amber-100 text-amber-800",
    en_attente: "bg-amber-100 text-amber-800",
    "en attente": "bg-amber-100 text-amber-800",
    annule: "bg-rose-100 text-rose-800",
  };
  const cls = map[s] || "bg-neutral-100 text-neutral-800";
  const label = s === "paye" ? "Payé" : s === "annule" ? "Annulé" : "En attente";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

export default function Merci() {
  const q = useQuery();
  const sessionId = q.get("session_id");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  const baseUrl =
    (import.meta.env && import.meta.env.VITE_SUPABASE_URL) ||
    (typeof process !== "undefined" && process.env && process.env.VITE_SUPABASE_URL) ||
    "";

  async function getAuthHeader() {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token) return { Authorization: `Bearer ${token}` };
    } catch {}
    const anon =
      (import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) ||
      (typeof process !== "undefined" && process.env && process.env.VITE_SUPABASE_ANON_KEY) ||
      "";
    return anon ? { Authorization: `Bearer ${anon}` } : {};
  }

  async function loadSummary(id) {
    setError("");
    setLoading(true);
    try {
      const auth = await getAuthHeader();
      // ➜ Un seul endpoint central : finalize-payment (finalise + renvoie le récap)
      const resp = await fetch(
        `${baseUrl}/functions/v1/finalize-payment?session_id=${encodeURIComponent(id)}`,
        { method: "GET", headers: { "Content-Type": "application/json", ...auth } }
      );
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`);
      // ⚠️ finalize-payment renvoie { ok, paid, summary } → on extrait summary
      setSummary(data.summary || null);
    } catch (e) {
      console.error("finalize-payment error:", e);
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    loadSummary(sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Regroupe les inscriptions par équipe (si applicable)
  const grouped = useMemo(() => {
    const g = new Map();
    const list = summary?.inscriptions || [];
    for (const i of list) {
      const key = i.team_name || "Individuel";
      if (!g.has(key)) g.set(key, []);
      g.get(key).push(i);
    }
    return g;
  }, [summary]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link to="/mes-inscriptions" className="text-sm text-neutral-500 hover:text-neutral-800">
            ← Mes inscriptions
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold mt-1">Merci pour votre inscription</h1>
          <p className="text-neutral-600 mt-1">Voici le récapitulatif de votre paiement.</p>
        </div>
        <div className="hidden sm:flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-700">
          <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {!sessionId && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800">
          <div className="font-semibold mb-1">Paramètres manquants</div>
          <div className="text-sm">
            Le paramètre <code>session_id</code> est requis.
          </div>
        </div>
      )}

      {sessionId && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Colonne principale */}
          <div className="lg:col-span-2 space-y-6">
            {/* Carte état paiement */}
            <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="p-5 border-b border-neutral-100 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">État du paiement</h2>
                  <p className="text-sm text-neutral-500">
                    Session Stripe : <code className="text-neutral-700">{sessionId}</code>
                  </p>
                </div>
                {summary?.payment?.status && <StatusBadge status={summary.payment.status} />}
              </div>

              {loading ? (
                <div className="p-5">
                  <div className="h-4 w-56 bg-neutral-100 rounded mb-3 animate-pulse" />
                  <div className="h-4 w-40 bg-neutral-100 rounded mb-3 animate-pulse" />
                  <div className="h-4 w-24 bg-neutral-100 rounded animate-pulse" />
                </div>
              ) : error ? (
                <div className="p-5 text-sm text-rose-700">
                  <div className="font-medium mb-1">Détails indisponibles</div>
                  <p>{error}</p>
                  <button
                    onClick={() => loadSummary(sessionId)}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-neutral-50"
                  >
                    Réessayer
                  </button>
                </div>
              ) : summary ? (
                <div className="p-5 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-600">Montant réglé</span>
                    <span className="font-semibold">{formatEur(summary.payment?.total_amount_cents)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-600">Date</span>
                    <span className="font-medium">{formatDateTime(summary.payment?.created_at)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-600">Statut</span>
                    <span>
                      <StatusBadge status={summary.payment?.status} />
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 pt-1">
                    Un email de confirmation vous est envoyé à l’adresse utilisée lors du paiement.
                    En cas d’absence d’email, vérifiez vos spams.
                  </p>
                </div>
              ) : (
                <div className="p-5 text-sm text-neutral-600">Aucun détail disponible.</div>
              )}
            </section>

            {/* Participants / Groupes */}
            <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="p-5 border-b border-neutral-100">
                <h2 className="text-lg font-semibold">Participants</h2>
                <p className="text-sm text-neutral-500">
                  {loading
                    ? "Chargement…"
                    : `${(summary?.inscriptions || []).length} inscription(s) trouvée(s)`}
                </p>
              </div>

              {loading ? (
                <div className="p-5 space-y-3">
                  <div className="h-10 bg-neutral-100 rounded animate-pulse" />
                  <div className="h-10 bg-neutral-100 rounded animate-pulse" />
                  <div className="h-10 bg-neutral-100 rounded animate-pulse" />
                </div>
              ) : (summary?.inscriptions || []).length === 0 ? (
                <div className="p-5 text-sm text-neutral-600">Aucun participant trouvé pour cette session.</div>
              ) : (
                <div className="p-5 space-y-6">
                  {[...grouped.entries()].map(([teamName, list]) => (
                    <div key={teamName} className="rounded-xl border border-neutral-200">
                      <div className="px-4 py-2 border-b bg-neutral-50 rounded-t-xl flex items-center justify-between">
                        <div className="font-medium">
                          {teamName === "Individuel" ? "Inscription individuelle" : `Équipe : ${teamName}`}
                        </div>
                        <div className="text-xs text-neutral-500">{list.length} participant(s)</div>
                      </div>
                      <div className="divide-y">
                        {list.map((p) => (
                          <div key={p.id} className="px-4 py-3 text-sm flex items-center justify-between">
                            <div className="font-medium">
                              {p.prenom} {p.nom}
                            </div>
                            <div className="text-xs text-neutral-500">{p.email || "—"}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Groupes (si dispo) */}
            {(summary?.groupes || []).length > 0 && (
              <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
                <div className="p-5 border-b border-neutral-100">
                  <h2 className="text-lg font-semibold">Équipe(s)</h2>
                </div>
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {summary.groupes.map((g) => (
                    <div key={g.id} className="rounded-xl border border-neutral-200 p-4">
                      <div className="font-medium mb-1">
                        {g.team_name_public || g.team_name || g.nom_groupe || "Équipe"}
                      </div>
                      <div className="text-sm text-neutral-600">Catégorie&nbsp;: {g.team_category || "—"}</div>
                      <div className="text-sm text-neutral-600">Membres&nbsp;: {g.members_count ?? "—"}</div>
                      <div className="mt-2">
                        <StatusBadge status={g.statut} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Colonne latérale */}
          <aside className="lg:col-span-1 space-y-6">
            <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm sticky top-6">
              <div className="p-5 border-b border-neutral-100">
                <h3 className="text-lg font-semibold">Actions</h3>
                <p className="text-sm text-neutral-500">Accédez rapidement à vos infos.</p>
              </div>
              <div className="p-5 space-y-3">
                <Link
                  to="/mes-inscriptions"
                  className="block w-full text-center rounded-xl bg-neutral-900 hover:bg-black text-white font-semibold px-4 py-3"
                >
                  Voir mes inscriptions
                </Link>
                <button
                  onClick={() => loadSummary(sessionId)}
                  className="w-full rounded-xl border border-neutral-300 px-4 py-3 font-semibold hover:bg-neutral-50"
                >
                  Rafraîchir les détails
                </button>
                <Link
                  to="/"
                  className="block w-full text-center rounded-xl border border-neutral-200 px-4 py-3 hover:bg-neutral-50"
                >
                  Retour à l’accueil
                </Link>
                <div className="pt-3 border-t border-neutral-100 text-xs text-neutral-500">
                  Besoin d’aide&nbsp;? Écrivez-nous via la page contact.
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
