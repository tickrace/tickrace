// src/pages/MonInscription.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../supabase";

/* ------------------------------ UI helpers ------------------------------ */
function Card({ title, children, right }) {
  return (
    <section className="rounded-2xl bg-white shadow-lg shadow-neutral-900/5 ring-1 ring-neutral-200">
      <div className="p-5 border-b border-neutral-200 flex items-center justify-between">
        <h2 className="text-lg sm:text-xl font-bold">{title}</h2>
        {right}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
const Row = ({ label, value }) => (
  <div className="flex items-start justify-between gap-6 py-2 border-b last:border-b-0">
    <div className="text-neutral-600 text-sm">{label}</div>
    <div className="font-medium text-sm text-right">{value ?? "—"}</div>
  </div>
);

function eur(n) {
  if (!Number.isFinite(Number(n))) return "—";
  return Number(n).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

/* --------------------------------- Page --------------------------------- */
export default function MonInscription() {
  // Route: /mon-inscription/:id
  const { id, inscriptionId } = useParams();
  const INSCRIPTION_ID = inscriptionId || id;

  const [loading, setLoading] = useState(true);
  const [inscription, setInscription] = useState(null);
  const [course, setCourse] = useState(null);
  const [format, setFormat] = useState(null);
  const [credit, setCredit] = useState(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        // 1) Inscription
        const { data: ins, error: insErr } = await supabase
          .from("inscriptions")
          .select("*")
          .eq("id", INSCRIPTION_ID)
          .maybeSingle();
        if (insErr) throw insErr;
        if (!ins) {
          setInscription(null);
          setLoading(false);
          return;
        }
        if (!mounted) return;
        setInscription(ins);

        // 2) Course + Format (requêtes séparées pour éviter les FK implicites)
        if (ins.course_id) {
          const { data: c } = await supabase
            .from("courses")
            .select("id, nom, lieu, departement, code_postal, image_url")
            .eq("id", ins.course_id)
            .maybeSingle();
          if (mounted) setCourse(c || null);
        }
        if (ins.format_id) {
          const { data: f } = await supabase
            .from("formats")
            .select("id, nom, date, heure_depart, distance_km, denivele_dplus, type_format, prix, prix_equipe")
            .eq("id", ins.format_id)
            .maybeSingle();
          if (mounted) setFormat(f || null);
        }

        // 3) Dernier crédit d’annulation (s’il existe déjà)
        const { data: cr } = await supabase
          .from("credits_annulation")
          .select("*")
          .eq("inscription_id", INSCRIPTION_ID)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (mounted) setCredit(cr || null);
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [INSCRIPTION_ID]);

  const raceDate = useMemo(() => {
    if (!format?.date) return null;
    try {
      // On combine date + heure si fournis
      const d = new Date(format.date);
      if (format.heure_depart) {
        const [hh, mm] = String(format.heure_depart).split(":");
        d.setHours(Number(hh || 0), Number(mm || 0), 0, 0);
      }
      return d;
    } catch {
      return null;
    }
  }, [format?.date, format?.heure_depart]);

  const canCancel = useMemo(() => {
    if (!inscription) return false;
    if (inscription.statut === "annulé") return false;
    // Laisser la logique de fenêtre à la fonction SQL ; ici on permet l’action,
    // mais tu peux restreindre si tu veux :
    // if (raceDate && new Date() >= raceDate) return false;
    return true;
  }, [inscription, raceDate]);

  async function handleCancelAndCredit() {
    if (!INSCRIPTION_ID || !canCancel) return;
    const ok = window.confirm(
      "Confirmer l’annulation de cette inscription ? Un crédit sera calculé et enregistré."
    );
    if (!ok) return;

    setWorking(true);
    try {
      // 1) Appel de la fonction SQL
      const { data: rpcData, error: rpcErr } = await supabase.rpc(
        "calculer_credit_annulation",
        { inscription_id: INSCRIPTION_ID }
      );
      if (rpcErr) {
        console.error(rpcErr);
        alert(rpcErr.message || "Échec du calcul de crédit.");
        setWorking(false);
        return;
      }

      // 2) Rafraîchir l’inscription (statut devrait être 'annulé')
      const { data: ins } = await supabase
        .from("inscriptions")
        .select("*")
        .eq("id", INSCRIPTION_ID)
        .maybeSingle();
      if (ins) setInscription(ins);

      // 3) Récupérer le dernier crédit inséré si le RPC ne le renvoie pas
      if (rpcData && typeof rpcData === "object") {
        // Beaucoup de fonctions renvoient le row inséré : on tente d’afficher rpcData
        setCredit(rpcData);
      } else {
        const { data: cr } = await supabase
          .from("credits_annulation")
          .select("*")
          .eq("inscription_id", INSCRIPTION_ID)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cr) setCredit(cr);
      }

      alert("Inscription annulée et crédit généré.");
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l’annulation/crédit.");
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="h-7 w-64 bg-neutral-200 rounded animate-pulse mb-6" />
        <div className="grid gap-4">
          <div className="h-40 bg-neutral-100 rounded-2xl animate-pulse" />
          <div className="h-40 bg-neutral-100 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!inscription) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <p className="text-neutral-600">Inscription introuvable.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link to="/" className="text-sm text-neutral-500 hover:text-neutral-800">← Accueil</Link>
          <h1 className="text-2xl sm:text-3xl font-bold mt-1">
            Mon inscription
          </h1>
          {course && (
            <p className="text-neutral-600 mt-1">
              Épreuve : <Link to={`/courses/${course.id}`} className="underline hover:no-underline">{course.nom}</Link>
              {course.lieu ? ` — ${course.lieu}` : ""} {course.departement ? ` (${course.departement})` : ""}
            </p>
          )}
        </div>

        <div className="text-sm">
          <span className={[
            "px-2.5 py-1 rounded-full ring-1",
            inscription.statut === "annulé"
              ? "bg-rose-50 text-rose-700 ring-rose-200"
              : inscription.statut === "validé"
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : "bg-amber-50 text-amber-700 ring-amber-200"
          ].join(" ")}>
            {inscription.statut || "—"}
          </span>
        </div>
      </div>

      {/* Détails inscription */}
      <div className="grid gap-6">
        <Card
          title="Détails de l’inscription"
          right={
            canCancel ? (
              <button
                type="button"
                onClick={handleCancelAndCredit}
                disabled={working}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${
                  working ? "bg-neutral-400" : "bg-neutral-900 hover:bg-black"
                }`}
                title="Annuler l’inscription et générer un crédit"
              >
                {working ? "Traitement…" : "Annuler et générer un crédit"}
              </button>
            ) : null
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Row label="Nom" value={`${inscription.prenom || ""} ${inscription.nom || ""}`.trim() || "—"} />
              <Row label="Email" value={inscription.email || "—"} />
              <Row label="Téléphone" value={inscription.telephone || "—"} />
              <Row label="Club" value={inscription.club || "—"} />
              <Row label="N° licence / PPS" value={inscription.numero_licence || inscription.pps_identifier || "—"} />
              <Row label="Adresse" value={[
                inscription.adresse,
                inscription.adresse_complement,
                inscription.code_postal,
                inscription.ville,
                inscription.pays
              ].filter(Boolean).join(", ") || "—"} />
            </div>
            <div>
              <Row label="Format" value={format?.nom || "—"} />
              <Row label="Date de course" value={
                format?.date ? new Date(format.date + (format.heure_depart ? `T${format.heure_depart}:00` : "T00:00:00")).toLocaleString() : "—"
              } />
              <Row label="Distance / D+" value={
                (format?.distance_km ? `${format.distance_km} km` : "—") +
                (Number.isFinite(Number(format?.denivele_dplus)) ? ` / ${format.denivele_dplus} m` : "")
              } />
              <Row label="Type d’inscription" value={format?.type_format || "—"} />
              <Row label="Dossard" value={inscription.dossard || "—"} />
              <Row label="Créée le" value={inscription.created_at ? new Date(inscription.created_at).toLocaleString() : "—"} />
            </div>
          </div>
        </Card>

        {/* Crédit d’annulation (si existant) */}
        {credit && (
          <Card title="Crédit d’annulation">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Row label="Date" value={credit.created_at ? new Date(credit.created_at).toLocaleString() : "—"} />
                <Row label="Jours avant course (calc.)" value={Number.isFinite(Number(credit.jours_avant_course)) ? credit.jours_avant_course : "—"} />
                <Row label="Pourcentage appliqué" value={
                  Number.isFinite(Number(credit.pourcentage)) ? `${(Number(credit.pourcentage) * 100).toFixed(0)} %` : "—"
                } />
              </div>
              <div>
                <Row label="Remboursement inscription" value={eur(credit.remboursement_inscription)} />
                <Row label="Remboursement repas" value={eur(credit.remboursement_repas)} />
                <Row label="Frais d’annulation" value={eur(credit.frais_annulation)} />
                <div className="mt-2 pt-2 border-t">
                  <Row label="Montant total crédité" value={<span className="font-bold">{eur(credit.montant_total)}</span>} />
                </div>
              </div>
            </div>
            {inscription.statut === "annulé" && (
              <p className="mt-4 text-sm text-neutral-600">
                L’inscription est désormais <b>annulée</b>. Le crédit ci-dessus a été enregistré.
              </p>
            )}
          </Card>
        )}

        {/* Astuces / Aide */}
        <Card title="Aide">
          <ul className="list-disc pl-5 text-sm text-neutral-700 space-y-1">
            <li>Le crédit est calculé automatiquement selon la date de l’épreuve et vos règles internes.</li>
            <li>En cas d’erreur, contactez l’organisateur pour toute correction manuelle.</li>
            <li>Si vous avez payé des options (repas, etc.), elles sont prises en compte dans le calcul.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
