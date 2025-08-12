// src/components/CalculCreditAnnulation.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

const fmt = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const toEUR = (n) => fmt.format(Math.max(0, Number.isFinite(n) ? n : 0));

function diffDaysUTC(a, b) {
  // renvoie (dateB - dateA) en jours arrondis à l'entier
  const ms = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  return Math.round(ms / 86400000);
}

export default function CalculCreditAnnulation({ inscriptionId: propId }) {
  const [inscriptionId, setInscriptionId] = useState(propId || null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [okMsg, setOkMsg] = useState(null);

  const [insc, setInsc] = useState(null);
  const [format, setFormat] = useState(null);
  const [course, setCourse] = useState(null);

  // Permettre un usage direct via query ?inscription_id=...
  useEffect(() => {
    if (!propId) {
      const url = new URL(window.location.href);
      const q = url.searchParams.get("inscription_id");
      if (q) setInscriptionId(q);
    }
  }, [propId]);

  useEffect(() => {
    let abort = false;
    async function load() {
      if (!inscriptionId) return;
      setLoading(true);
      setError(null);
      setOkMsg(null);
      try {
        // 1) Inscription
        const { data: i, error: e1 } = await supabase
          .from("inscriptions")
          .select("id, course_id, format_id, prix_total_coureur, prix_total_repas, statut, nom, prenom, email")
          .eq("id", inscriptionId)
          .single();
        if (e1 || !i) throw new Error(e1?.message || "Inscription introuvable");
        if (abort) return;

        setInsc(i);

        // 2) Format
        const { data: f, error: e2 } = await supabase
          .from("formats")
          .select("id, nom, date, prix, prix_repas")
          .eq("id", i.format_id)
          .single();
        if (e2 || !f) throw new Error(e2?.message || "Format introuvable");
        if (abort) return;
        setFormat(f);

        // 3) Course
        const { data: c, error: e3 } = await supabase
          .from("courses")
          .select("id, nom")
          .eq("id", i.course_id)
          .single();
        if (e3 || !c) throw new Error(e3?.message || "Course introuvable");
        if (abort) return;
        setCourse(c);
      } catch (err) {
        if (!abort) setError(err.message || String(err));
      } finally {
        if (!abort) setLoading(false);
      }
    }
    load();
    return () => { abort = true; };
  }, [inscriptionId]);

  // Calculs preview (sans toucher à la base)
  const calc = useMemo(() => {
    if (!insc || !format) return null;

    const total = Number(insc.prix_total_coureur || 0);
    const repas = Number(insc.prix_total_repas || 0);
    const inscription = total - repas;

    const dCourse = new Date(format.date + "T00:00:00");
    const today = new Date();
    const jours_avant = diffDaysUTC(today, dCourse);

    // même formule que ta fonction SQL pour % conservé
    let pourcentage_conserve;
    if (jours_avant > 60) {
      pourcentage_conserve = 0.05;
    } else if (jours_avant >= 3) {
      pourcentage_conserve = Math.round((0.05 + (0.95 * (60 - jours_avant) / 57)) * 100) / 100;
    } else {
      pourcentage_conserve = 1.0;
    }

    // Règle Tickrace : on calcule tout sur la part organisateur (95%)
    const partOrga = 0.95;
    const commission5 = Math.round(total * 0.05 * 100) / 100; // info

    const remboursement_inscription = Math.round(partOrga * (1 - pourcentage_conserve) * inscription * 100) / 100;
    const remboursement_repas       = Math.round(partOrga * repas * 100) / 100;
    const frais_annulation_orga     = Math.round(partOrga * pourcentage_conserve * inscription * 100) / 100;
    const montant_total             = Math.round((remboursement_inscription + remboursement_repas) * 100) / 100;

    return {
      total, repas, inscription,
      jours_avant, pourcentage_conserve,
      partOrga, commission5,
      remboursement_inscription, remboursement_repas,
      frais_annulation_orga, montant_total,
    };
  }, [insc, format]);

  const canRefund =
    !!insc &&
    !!format &&
    insc.statut !== "remboursé" &&
    insc.statut !== "annulé" &&
    calc &&
    calc.montant_total > 0;

  async function handleConfirm() {
    if (!inscriptionId || !calc) return;
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      // 1) Calcul + insertion crédit (et statut = 'annulé')
      const { data: creditId, error: rpcErr } = await supabase
        .rpc("calculer_credit_annulation", { p_inscription_id: inscriptionId });
      if (rpcErr) throw new Error("Erreur calcul crédit: " + rpcErr.message);

      // 2) Refund réel (Edge Function)
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refund-inscription`;
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ inscription_id: inscriptionId }),
      });
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new Error(`Refund erreur (${r.status}) ${t}`);
      }
      const out = await r.json().catch(() => ({}));
      setOkMsg("Annulation confirmée et remboursement lancé avec succès.");
      // rafraîchir statut inscription
      const { data: i } = await supabase
        .from("inscriptions")
        .select("statut")
        .eq("id", inscriptionId)
        .single();
      if (i) setInsc((prev) => ({ ...prev, statut: i.statut }));

    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-4">Chargement…</div>;
  if (error)   return <div className="p-4 text-red-600">Erreur : {error}</div>;
  if (!insc || !format || !calc) return <div className="p-4">Données indisponibles.</div>;

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">Annulation & remboursement</h2>

      <div className="text-sm text-gray-700">
        <div><strong>Course :</strong> {course?.nom || "—"} {format?.nom ? `(${format.nom})` : ""}</div>
        <div><strong>Date de course :</strong> {new Date(format.date + "T00:00:00").toLocaleDateString("fr-FR")}</div>
        <div><strong>Inscription :</strong> {insc.prenom} {insc.nom} — statut actuel : <span className="font-medium">{insc.statut || "—"}</span></div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-3">
          <h3 className="font-medium mb-2">Récapitulatif</h3>
          <div className="flex justify-between"><span>Total payé</span><span>{toEUR(calc.total)}</span></div>
          <div className="flex justify-between text-gray-700"><span>— Dont inscription</span><span>{toEUR(calc.inscription)}</span></div>
          <div className="flex justify-between text-gray-700"><span>— Dont repas</span><span>{toEUR(calc.repas)}</span></div>
          <div className="flex justify-between"><span>Commission Tickrace (5 %, non remboursée)</span><span>{toEUR(calc.commission5)}</span></div>
          <div className="flex justify-between"><span>Part organisateur (95 %)</span><span>{toEUR(calc.partOrga * calc.total)}</span></div>
        </div>

        <div className="border rounded-lg p-3">
          <h3 className="font-medium mb-2">Politique d’annulation</h3>
          <div className="flex justify-between"><span>Jours avant course</span><span>{calc.jours_avant}</span></div>
          <div className="flex justify-between"><span>% conservé par l’organisateur</span><span>{(calc.pourcentage_conserve * 100).toFixed(0)}%</span></div>
          <div className="flex justify-between"><span>Part conservée (sur 95 %)</span><span>{toEUR(calc.frais_annulation_orga)}</span></div>
          <div className="flex justify-between"><span>Remboursement inscription (sur 95 %)</span><span>{toEUR(calc.remboursement_inscription)}</span></div>
          <div className="flex justify-between"><span>Remboursement repas (100 % × 95 %)</span><span>{toEUR(calc.remboursement_repas)}</span></div>
          <div className="flex justify-between font-semibold border-t mt-2 pt-2"><span>Montant total remboursé</span><span>{toEUR(calc.montant_total)}</span></div>
        </div>
      </div>

      {calc.jours_avant < 3 && (
        <div className="p-3 rounded-md bg-yellow-50 text-yellow-800 text-sm">
          À moins de 3 jours de la course, le remboursement est nul (hors repas ×95 %). Vérifie bien avant de confirmer.
        </div>
      )}

      {okMsg && <div className="p-3 rounded-md bg-green-50 text-green-700">{okMsg}</div>}
      {error && !loading && <div className="p-3 rounded-md bg-red-50 text-red-700">{error}</div>}

      <div className="flex items-center gap-3">
        <button
          disabled={!canRefund || saving}
          onClick={handleConfirm}
          className={`px-4 py-2 rounded-md text-white ${(!canRefund || saving) ? "bg-gray-400" : "bg-purple-600 hover:bg-purple-700"}`}
          title={!canRefund ? "Rien à rembourser ou inscription déjà annulée/remboursée" : "Confirmer l’annulation et déclencher le remboursement"}
        >
          {saving ? "Traitement..." : "Confirmer l’annulation et rembourser"}
        </button>
        <span className="text-sm text-gray-600">
          Cette action appelle la RPC <code>calculer_credit_annulation</code> puis l’Edge Function <code>refund-inscription</code>.
        </span>
      </div>
    </div>
  );
}
