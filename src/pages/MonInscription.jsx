// src/pages/MonInscription.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../supabase";

function eur(cents) {
  if (!Number.isFinite(cents)) cents = 0;
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export default function MonInscription() {
  const { id } = useParams(); // /mon-inscription/:id
  const [loading, setLoading] = useState(true);
  const [insc, setInsc] = useState(null);
  const [course, setCourse] = useState(null);
  const [format, setFormat] = useState(null);
  const [opts, setOpts] = useState([]); // inscriptions_options pour cette inscription
  const [error, setError] = useState("");

  useEffect(() => {
    let aborted = false;
    async function load() {
      setLoading(true);
      setError("");

      // 1) Lire l’inscription
      const { data: ins, error: e1 } = await supabase
        .from("inscriptions")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (aborted) return;

      if (e1) {
        setError(e1.message || "Impossible de charger l’inscription.");
        setLoading(false);
        return;
      }
      if (!ins) {
        setError("Inscription introuvable.");
        setLoading(false);
        return;
      }
      setInsc(ins);

      // 2) Lire la course
      let c = null;
      if (ins.course_id) {
        const { data: cRow } = await supabase
          .from("courses")
          .select("id, nom, lieu, departement, image_url")
          .eq("id", ins.course_id)
          .maybeSingle();
        if (!aborted) c = cRow || null;
      }
      setCourse(c);

      // 3) Lire le format
      let f = null;
      if (ins.format_id) {
        const { data: fRow } = await supabase
          .from("formats")
          .select("id, nom, date, heure_depart, distance_km, denivele_dplus, type_format, prix, prix_equipe")
          .eq("id", ins.format_id)
          .maybeSingle();
        if (!aborted) f = fRow || null;
      }
      setFormat(f);

      // 4) Lire les options payantes (confirmées & en attente)
      const { data: io, error: e4 } = await supabase
        .from("inscriptions_options")
        .select("option_id, quantity, prix_unitaire_cents, status")
        .eq("inscription_id", id)
        .in("status", ["pending", "confirmed"]);

      if (!aborted) {
        if (!e4 && io?.length) {
          // Charger le libellé et le prix catalogue pour info
          const optionIds = Array.from(new Set(io.map((r) => r.option_id)));
          let meta = {};
          if (optionIds.length) {
            const { data: cat } = await supabase
              .from("options_catalogue")
              .select("id, label, price_cents")
              .in("id", optionIds);
            if (cat?.length) {
              meta = cat.reduce((acc, o) => {
                acc[o.id] = o;
                return acc;
              }, {});
            }
          }
          const withLabels = io.map((r) => ({
            ...r,
            label: meta[r.option_id]?.label || "Option",
            catalogue_price_cents: Number(meta[r.option_id]?.price_cents || 0),
          }));
          setOpts(withLabels);
        } else {
          setOpts([]);
        }
      }

      if (!aborted) setLoading(false);
    }
    load();
    return () => {
      aborted = true;
    };
  }, [id]);

  const totalOptionsCents = useMemo(() => {
    return (opts || []).reduce((s, o) => s + Number(o.prix_unitaire_cents || 0) * Number(o.quantity || 0), 0);
  }, [opts]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="h-7 w-64 bg-neutral-200 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-40 bg-neutral-100 rounded-2xl animate-pulse" />
            <div className="h-28 bg-neutral-100 rounded-2xl animate-pulse" />
          </div>
          <div className="h-64 bg-neutral-100 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <p className="text-red-700 bg-red-50 border border-red-200 rounded-xl p-4">{error}</p>
        <div className="mt-4">
          <Link to="/" className="text-sm text-neutral-600 hover:text-neutral-900">← Retour à l’accueil</Link>
        </div>
      </div>
    );
  }

  if (!insc) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <p className="text-neutral-600">Inscription introuvable.</p>
      </div>
    );
  }

  const statutBadge = (() => {
    const s = (insc.statut || "").toLowerCase();
    if (s.includes("valid")) return { text: "Validée", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
    if (s.includes("attente")) return { text: "En attente", cls: "bg-amber-50 text-amber-700 ring-amber-200" };
    if (s.includes("annul")) return { text: "Annulée", cls: "bg-neutral-50 text-neutral-700 ring-neutral-200" };
    return { text: insc.statut || "—", cls: "bg-neutral-50 text-neutral-700 ring-neutral-200" };
  })();

  const isTeamMode = (format?.type_format === "groupe" || format?.type_format === "relais");

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Hero */}
      <section className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-6xl px-4 py-8 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm">
              <Link to="/" className="text-neutral-500 hover:text-neutral-900">Accueil</Link>
              {" / "}
              {course ? (
                <Link to={`/courses/${course.id}`} className="text-neutral-500 hover:text-neutral-900">
                  {course.nom}
                </Link>
              ) : (
                <span className="text-neutral-500">Épreuve</span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold mt-1">
              Mon inscription {course ? `— ${course.nom}` : ""}
            </h1>
            {format && (
              <p className="text-neutral-600 mt-1">
                Format : <b>{format.nom}</b>
                {format.date ? ` — ${format.date}` : ""}{" "}
                {format.heure_depart ? `à ${format.heure_depart}` : ""}
              </p>
            )}
          </div>

          <span className={["shrink-0 text-xs px-2.5 py-1 rounded-full ring-1", statutBadge.cls].join(" ")}>
            {statutBadge.text}
          </span>
        </div>
      </section>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Col gauche */}
        <div className="lg:col-span-2 space-y-6">
          {/* Carte — Détails coureur / équipe */}
          <div className="rounded-2xl bg-white shadow-lg shadow-neutral-900/5 ring-1 ring-neutral-200">
            <div className="p-5 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg sm:text-xl font-bold">Détails de l’inscription</h2>
                <p className="text-sm text-neutral-600">
                  ID : <span className="font-mono text-xs">{insc.id}</span>
                </p>
              </div>
              {Number.isFinite(insc.dossard) && insc.dossard > 0 && (
                <div className="text-sm px-3 py-1 rounded-full bg-black text-white">Dossard #{insc.dossard}</div>
              )}
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {!isTeamMode ? (
                <>
                  <Field label="Nom">{insc.nom || "—"}</Field>
                  <Field label="Prénom">{insc.prenom || "—"}</Field>
                  <Field label="Sexe">{insc.genre || "—"}</Field>
                  <Field label="Date de naissance">{insc.date_naissance || "—"}</Field>
                  <Field label="Nationalité">{insc.nationalite || "—"}</Field>
                  <Field label="Email">{insc.email || "—"}</Field>
                  <Field label="Téléphone">{insc.telephone || "—"}</Field>
                  <Field label="Club">{insc.club || "—"}</Field>
                  <Field label="Adresse" className="md:col-span-2">
                    {[
                      insc.adresse,
                      insc.adresse_complement,
                      [insc.code_postal, insc.ville].filter(Boolean).join(" "),
                      insc.pays,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </Field>
                  <Field label="Justificatif">{insc.justificatif_type || "—"}</Field>
                  <Field label="N° licence / PPS">{insc.numero_licence || insc.pps_identifier || "—"}</Field>
                  <Field label="Apparaître aux résultats">{insc.apparaitre_resultats ? "Oui" : "Non"}</Field>
                </>
              ) : (
                <>
                  <Field label="Inscription d’équipe">{format?.type_format === "relais" ? "Relais" : "Groupe"}</Field>
                  <Field label="Nom d’équipe">{insc.team_name || "—"}</Field>
                  <Field label="Identifiant groupe">{insc.member_of_group_id || "—"}</Field>
                  <Field label="Email payeur">{insc.email || "—"}</Field>
                  <div className="md:col-span-2 text-neutral-600">
                    <p className="text-sm">
                      Cette page affiche votre enregistrement principal. Les membres d’équipe sont
                      visibles dans la page organisateur « Liste des inscriptions » et sur l’email de confirmation.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Carte — Options payantes */}
          <div className="rounded-2xl bg-white shadow-lg shadow-neutral-900/5 ring-1 ring-neutral-200">
            <div className="p-5 border-b border-neutral-200">
              <h2 className="text-lg sm:text-xl font-bold">Options payantes</h2>
              <p className="text-sm text-neutral-600">Repas, goodies, etc.</p>
            </div>
            <div className="p-5">
              {opts.length === 0 ? (
                <div className="text-sm text-neutral-600">Aucune option.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-neutral-600">
                        <th className="py-2 pr-3">Libellé</th>
                        <th className="py-2 pr-3">Quantité</th>
                        <th className="py-2 pr-3">Prix unitaire</th>
                        <th className="py-2 pr-3">Statut</th>
                        <th className="py-2 pr-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {opts.map((o, i) => {
                        const q = Number(o.quantity || 0);
                        const pu = Number(o.prix_unitaire_cents || 0);
                        return (
                          <tr key={i} className="border-t">
                            <td className="py-2 pr-3">{o.label}</td>
                            <td className="py-2 pr-3">{q}</td>
                            <td className="py-2 pr-3">{eur(pu)}</td>
                            <td className="py-2 pr-3">{o.status}</td>
                            <td className="py-2 pr-3 text-right font-semibold">{eur(q * pu)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t font-semibold">
                        <td className="py-2 pr-3" colSpan={4}>Total options</td>
                        <td className="py-2 pr-3 text-right">{eur(totalOptionsCents)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Col droite — Récap */}
        <aside>
          <div className="rounded-2xl bg-white shadow-lg shadow-neutral-900/5 ring-1 ring-neutral-200 sticky top-6">
            <div className="p-5 border-b border-neutral-200">
              <h3 className="text-lg font-semibold">Résumé</h3>
              <p className="text-sm text-neutral-500">Vérifie tes informations.</p>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <Row k="Épreuve" v={course ? `${course.nom} — ${course.lieu} (${course.departement || "—"})` : "—"} />
              <Row k="Format" v={format ? format.nom : "—"} />
              {format && (
                <Row
                  k="Date / Heure"
                  v={[format.date, format.heure_depart].filter(Boolean).join(" · ") || "—"}
                />
              )}
              {!isTeamMode ? (
                <>
                  <Row k="Prix inscription" v={`${Number(format?.prix || 0).toFixed(2)} €`} />
                </>
              ) : (
                <>
                  <Row k="Type équipe" v={format?.type_format === "relais" ? "Relais" : "Groupe"} />
                  {!!format?.prix_equipe && <Row k="Frais d’équipe" v={`${Number(format.prix_equipe).toFixed(2)} €`} />}
                </>
              )}
              <div className="h-px bg-neutral-200 my-2" />
              <Row k="Total options" v={eur(totalOptionsCents)} />
              <div className="h-px bg-neutral-200 my-2" />
              <div className="flex justify-between text-base">
                <span className="font-semibold">Statut</span>
                <span className="font-bold">{statutBadge.text}</span>
              </div>
            </div>

            <div className="p-5 border-t border-neutral-200">
              {course && (
                <Link
                  to={`/courses/${course.id}`}
                  className="w-full inline-flex justify-center rounded-xl bg-neutral-900 px-4 py-3 text-white font-semibold hover:bg-black"
                >
                  Voir la page de l’épreuve
                </Link>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* --- Petits composants d’affichage --- */
function Field({ label, children, className = "" }) {
  return (
    <div className={className}>
      <div className="text-xs font-semibold text-neutral-600">{label}</div>
      <div className="mt-1 text-neutral-900">{children}</div>
    </div>
  );
}
function Row({ k, v }) {
  return (
    <div className="flex justify-between">
      <span className="text-neutral-600">{k}</span>
      <span className="font-medium text-right">{v}</span>
    </div>
  );
}
