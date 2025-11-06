// src/pages/MonInscription.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

/* ------------------------------ UI helpers ------------------------------ */
function Pill({ children, tone = "neutral" }) {
  const map = {
    neutral: "bg-neutral-100 text-neutral-800 ring-neutral-200",
    success: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    warning: "bg-amber-100 text-amber-800 ring-amber-200",
    danger: "bg-rose-100 text-rose-800 ring-rose-200",
    info: "bg-blue-100 text-blue-800 ring-blue-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs ring-1 ${map[tone] || map.neutral}`}>
      {children}
    </span>
  );
}

function eur(v) {
  if (!Number.isFinite(v)) v = 0;
  return v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

/* --------------------------------- Page -------------------------------- */
export default function MonInscription() {
  const { id } = useParams(); // id d'inscription
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [insc, setInsc] = useState(null);
  const [course, setCourse] = useState(null);
  const [format, setFormat] = useState(null);

  const [optRows, setOptRows] = useState([]); // [{option_id,label,quantity,prix_unitaire_cents,status}]
  const [optTotalEur, setOptTotalEur] = useState(0);

  const statutTone = useMemo(() => {
    switch ((insc?.statut || "").toLowerCase()) {
      case "validé":
      case "paye":
      case "payé":
        return "success";
      case "en attente":
      case "pending":
        return "warning";
      case "annulé":
      case "annule":
        return "danger";
      default:
        return "neutral";
    }
  }, [insc?.statut]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);

      // 1) Inscription
      const { data: ins, error: errIns } = await supabase
        .from("inscriptions")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (!mounted) return;
      if (errIns || !ins) {
        setLoading(false);
        alert("Inscription introuvable.");
        return;
      }
      setInsc(ins);

      // 2) Course & Format (requêtes séparées pour éviter les erreurs de FK PostgREST)
      if (ins.course_id) {
        const { data: c } = await supabase.from("courses").select("*").eq("id", ins.course_id).maybeSingle();
        if (mounted) setCourse(c || null);
      }
      if (ins.format_id) {
        const { data: f } = await supabase.from("formats").select("*").eq("id", ins.format_id).maybeSingle();
        if (mounted) setFormat(f || null);
      }

      // 3) Options associées (confirmed + pending visibles ici)
      const { data: io } = await supabase
        .from("inscriptions_options")
        .select("option_id, quantity, prix_unitaire_cents, status")
        .eq("inscription_id", id);

      const rows = io || [];
      let labels = {};
      if (rows.length) {
        const ids = Array.from(new Set(rows.map((r) => r.option_id))).filter(Boolean);
        if (ids.length) {
          const { data: optsMeta } = await supabase
            .from("options_catalogue")
            .select("id,label,price_cents")
            .in("id", ids);
          labels = (optsMeta || []).reduce((acc, o) => {
            acc[o.id] = { label: o.label, price_cents: o.price_cents };
            return acc;
          }, {});
        }
      }

      const withLabels = rows.map((r) => ({
        ...r,
        label: labels[r.option_id]?.label || "Option",
        unit_cents: Number(r.prix_unitaire_cents ?? labels[r.option_id]?.price_cents ?? 0),
      }));

      const totalEur =
        withLabels.reduce((s, r) => s + (Number(r.quantity || 0) * Number(r.unit_cents || 0)) / 100, 0) || 0;

      if (mounted) {
        setOptRows(withLabels);
        setOptTotalEur(totalEur);
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id]);

  const canCancel = useMemo(() => {
    const st = (insc?.statut || "").toLowerCase();
    return st === "validé" || st === "paye" || st === "payé" || st === "en attente";
  }, [insc?.statut]);

  async function handleCancel() {
    if (!insc?.id) return;
    const ok = window.confirm(
      "Confirmer l'annulation ?\n\nCela lancera le calcul du crédit d'annulation et mettra l'inscription à “annulé”."
    );
    if (!ok) return;

    // Appel de la fonction SQL calculer_credit_annulation(uuid)
    // Le nom du paramètre peut varier. On tente le plus probable `inscription_id`.
    // Si votre fonction l’attend sous un autre nom, adaptez ci-dessous.
    const { data, error } = await supabase.rpc("calculer_credit_annulation", {
      inscription_id: insc.id,
    });

    if (error) {
      console.error("RPC calculer_credit_annulation:", error);
      alert(
        "Impossible d'annuler via la fonction SQL. Vérifiez le nom du paramètre de la fonction `calculer_credit_annulation`.\n" +
          (error.message || "")
      );
      return;
    }

    // Recharger l’inscription (statut devrait passer à 'annulé')
    const { data: insRefetch } = await supabase
      .from("inscriptions")
      .select("*")
      .eq("id", insc.id)
      .maybeSingle();

    if (insRefetch) setInsc(insRefetch);

    alert("Annulation effectuée. Un crédit d'annulation a été calculé et enregistré.");
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="h-7 w-64 bg-neutral-200 rounded animate-pulse mb-6" />
        <div className="grid gap-4">
          <div className="h-40 bg-neutral-100 rounded-2xl animate-pulse" />
          <div className="h-40 bg-neutral-100 rounded-2xl animate-pulse" />
          <div className="h-40 bg-neutral-100 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!insc) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <p className="text-neutral-600">Inscription introuvable.</p>
      </div>
    );
  }

  // Totaux côté affichage (pour cohérence avec ancienne page)
  const prixInscription = Number(format?.prix || 0);
  const totalIndiv = (prixInscription + Number(insc?.prix_total_repas || 0)) || 0;
  const totalAvecOptions = totalIndiv + Number(optTotalEur || 0);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Header */}
      <section className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-5xl px-4 py-8 flex items-start justify-between gap-3">
          <div>
            <Link to="/mesinscriptions" className="text-sm text-neutral-500 hover:text-neutral-800">
              ← Retour à mes inscriptions
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold mt-1">
              {course?.nom || "Épreuve"} — {format?.nom || "Format"}
            </h1>
            <p className="text-neutral-600 mt-1">
              {course?.lieu && `${course.lieu}${course?.departement ? ` (${course.departement})` : ""}`}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Pill tone={statutTone}>
                Statut : <b className="ml-1">{insc.statut}</b>
              </Pill>
              {insc?.dossard ? <Pill tone="info">Dossard : <b className="ml-1">{insc.dossard}</b></Pill> : null}
              {format?.date ? <Pill tone="neutral">Départ : {format.date}{format?.heure_depart ? ` • ${format.heure_depart}` : ""}</Pill> : null}
            </div>
          </div>

          {/* Actions principales */}
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-neutral-50"
            >
              🖨️ Imprimer
            </button>
            <button
              type="button"
              disabled={!canCancel}
              onClick={handleCancel}
              className={`rounded-xl px-3 py-2 text-sm font-semibold text-white ${
                canCancel ? "bg-rose-600 hover:bg-rose-700" : "bg-neutral-400 cursor-not-allowed"
              }`}
              title={canCancel ? "Annuler et générer un crédit" : "Annulation indisponible pour ce statut"}
            >
              ❌ Annuler l’inscription & générer un crédit
            </button>
          </div>
        </div>
      </section>

      {/* Corps */}
      <div className="mx-auto max-w-5xl px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne gauche */}
        <div className="lg:col-span-2 space-y-6">
          {/* Carte — Détails coureur */}
          <div className="rounded-2xl bg-white shadow-lg shadow-neutral-900/5 ring-1 ring-neutral-200">
            <div className="p-5 border-b border-neutral-200">
              <h2 className="text-lg sm:text-xl font-bold">Détails du participant</h2>
              <p className="mt-1 text-sm text-neutral-600">Vos informations enregistrées pour cette inscription.</p>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <Field label="Nom">{insc.nom || "—"}</Field>
              <Field label="Prénom">{insc.prenom || "—"}</Field>
              <Field label="Email">{insc.email || "—"}</Field>
              <Field label="Téléphone">{insc.telephone || "—"}</Field>
              <Field label="Date de naissance">{insc.date_naissance || "—"}</Field>
              <Field label="Genre">{insc.genre || "—"}</Field>
              <Field label="Nationalité">{insc.nationalite || "—"}</Field>
              <Field label="Club">{insc.club || "—"}</Field>
              <Field label="Adresse" className="sm:col-span-2">
                {[insc.adresse, insc.adresse_complement, [insc.code_postal, insc.ville].filter(Boolean).join(" "), insc.pays]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </Field>
              <Field label="Afficher dans les résultats ?">
                {insc.apparaitre_resultats === false ? "Non" : "Oui"}
              </Field>
              <Field label="N° licence / PPS">{insc.numero_licence || insc.pps_identifier || "—"}</Field>
              <Field label="Contact d’urgence">
                {insc.contact_urgence_nom ? `${insc.contact_urgence_nom} (${insc.contact_urgence_telephone || "—"})` : "—"}
              </Field>
            </div>
          </div>

          {/* Carte — Format & parcours */}
          <div className="rounded-2xl bg-white shadow-lg shadow-neutral-900/5 ring-1 ring-neutral-200">
            <div className="p-5 border-b border-neutral-200">
              <h2 className="text-lg sm:text-xl font-bold">Format & parcours</h2>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <Field label="Format">{format?.nom || "—"}</Field>
              <Field label="Type">{format?.type_format || "—"}</Field>
              <Field label="Distance">{format?.distance_km ? `${format.distance_km} km` : "—"}</Field>
              <Field label="D+">{format?.denivele_dplus ? `${format.denivele_dplus} m` : "—"}</Field>
              <Field label="Date">{format?.date || "—"}</Field>
              <Field label="Heure de départ">{format?.heure_depart || "—"}</Field>
              <Field label="Adresse départ">{format?.adresse_depart || "—"}</Field>
              <Field label="Adresse arrivée">{format?.adresse_arrivee || "—"}</Field>
            </div>
            <div className="p-5 pt-0 text-sm text-neutral-700">
              {format?.presentation_parcours ? (
                <p className="whitespace-pre-wrap">{format.presentation_parcours}</p>
              ) : (
                <p className="text-neutral-500">Aucune description fournie.</p>
              )}
            </div>
          </div>

          {/* Carte — Options payantes */}
          <div className="rounded-2xl bg-white shadow-lg shadow-neutral-900/5 ring-1 ring-neutral-200">
            <div className="p-5 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg sm:text-xl font-bold">Options sélectionnées</h2>
                <p className="mt-1 text-sm text-neutral-600">Quantités et montants unitaires enregistrés.</p>
              </div>
            </div>

            <div className="p-5">
              {optRows.length === 0 ? (
                <div className="text-sm text-neutral-500">Aucune option.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-neutral-600">
                        <th className="py-2 pr-3">Option</th>
                        <th className="py-2 pr-3">Statut</th>
                        <th className="py-2 pr-3 text-right">Quantité</th>
                        <th className="py-2 pr-0 text-right">Prix unitaire</th>
                      </tr>
                    </thead>
                    <tbody>
                      {optRows.map((o, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="py-2 pr-3">{o.label}</td>
                          <td className="py-2 pr-3">
                            {o.status === "confirmed" ? <Pill tone="success">confirmée</Pill> :
                             o.status === "pending" ? <Pill tone="warning">en attente</Pill> :
                             <Pill tone="neutral">{o.status || "—"}</Pill>}
                          </td>
                          <td className="py-2 pr-3 text-right">{o.quantity}</td>
                          <td className="py-2 pr-0 text-right">{eur((o.unit_cents || 0) / 100)}</td>
                        </tr>
                      ))}
                      <tr className="border-t">
                        <td colSpan={3} className="py-2 pr-3 text-right font-semibold">Total options</td>
                        <td className="py-2 pr-0 text-right font-semibold">{eur(optTotalEur)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Colonne droite — Résumé paiement */}
        <aside className="lg:col-span-1">
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm sticky top-6">
            <div className="p-5 border-b border-neutral-100">
              <h3 className="text-lg font-semibold">Résumé paiement</h3>
              <p className="text-sm text-neutral-500">Montants estimés enregistrés pour cette inscription.</p>
            </div>

            <div className="p-5 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-600">Inscription</span>
                <span className="font-medium">{eur(prixInscription)}</span>
              </div>
              {Number(insc?.prix_total_repas || 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-neutral-600">Repas</span>
                  <span className="font-medium">{eur(Number(insc.prix_total_repas || 0))}</span>
                </div>
              )}
              {optTotalEur > 0 && (
                <div className="flex justify-between">
                  <span className="text-neutral-600">Options</span>
                  <span className="font-medium">{eur(optTotalEur)}</span>
                </div>
              )}
              <div className="h-px bg-neutral-200 my-2" />
              <div className="flex justify-between text-base">
                <span className="font-semibold">Total</span>
                <span className="font-bold">{eur(totalAvecOptions)}</span>
              </div>

              {/* Aide / infos statut */}
              <div className="mt-3 text-xs text-neutral-500">
                Statut actuel : <b className="text-neutral-700">{insc.statut}</b>.
                {canCancel
                  ? " Vous pouvez annuler et générer un crédit si besoin."
                  : " L'annulation n'est pas disponible pour ce statut."}
              </div>
            </div>

            <div className="p-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => navigate(`/courses/${insc.course_id}`)}
                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-50"
              >
                Voir la page de l’épreuve
              </button>
              <button
                type="button"
                disabled={!canCancel}
                onClick={handleCancel}
                className={`w-full rounded-xl px-4 py-2 text-sm font-semibold text-white ${
                  canCancel ? "bg-rose-600 hover:bg-rose-700" : "bg-neutral-400 cursor-not-allowed"
                }`}
              >
                Annuler & générer un crédit
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* --------------------------------- Field -------------------------------- */
function Field({ label, children, className = "" }) {
  return (
    <div className={className}>
      <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">{label}</div>
      <div className="mt-0.5 text-neutral-900">{children}</div>
    </div>
  );
}
