// src/pages/MonInscription.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

/* ------------------------------ UI helpers ------------------------------ */
function Section({ title, desc, children, right }) {
  return (
    <section className="rounded-2xl bg-white shadow-lg shadow-neutral-900/5 ring-1 ring-neutral-200 overflow-hidden">
      <div className="p-5 border-b border-neutral-200 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold">{title}</h2>
          {desc ? <p className="text-sm text-neutral-600 mt-0.5">{desc}</p> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
function Row({ label, children }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 py-2 border-b last:border-b-0">
      <div className="text-sm font-semibold text-neutral-600">{label}</div>
      <div className="sm:col-span-2 text-sm text-neutral-900">{children ?? "—"}</div>
    </div>
  );
}
function Badge({ tone = "neutral", children }) {
  const styles = {
    neutral: "bg-neutral-100 text-neutral-800 ring-neutral-200",
    green: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    amber: "bg-amber-100 text-amber-800 ring-amber-200",
    red: "bg-rose-100 text-rose-800 ring-rose-200",
    blue: "bg-blue-100 text-blue-800 ring-blue-200",
  }[tone];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full ring-1 ${styles}`}>
      {children}
    </span>
  );
}
const eur = (n) => (Number(n || 0)).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

/* --------------------------------- Page --------------------------------- */
export default function MonInscription() {
  const { id } = useParams(); // id d'inscription (UUID)
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [inscription, setInscription] = useState(null);
  const [course, setCourse] = useState(null);
  const [format, setFormat] = useState(null);
  const [options, setOptions] = useState([]); // lignes pour CETTE inscription
  const [teamMates, setTeamMates] = useState([]); // autres membres (même member_of_group_id)
  const [working, setWorking] = useState(false);

  const isTeamMode = useMemo(() => {
    const t = (format?.type_format || "individuel").toLowerCase();
    return t === "groupe" || t === "relais";
  }, [format]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);

      // 1) Charger l'inscription avec jointures course/format
      const { data: insc, error } = await supabase
        .from("inscriptions")
        .select(`
          *,
          courses:course_id ( id, nom, lieu, departement ),
          formats:format_id ( id, nom, date, heure_depart, distance_km, denivele_dplus, type_format, prix, prix_equipe )
        `)
        .eq("id", id)
        .single();

      if (!mounted) return;

      if (error || !insc) {
        console.error("inscription not found", error);
        setLoading(false);
        return;
      }

      setInscription(insc);
      setCourse(insc.courses || null);
      setFormat(insc.formats || null);

      // 2) Options liées à l’inscription
      const { data: opts } = await supabase
        .from("inscriptions_options")
        .select(`
          id, option_id, quantity, prix_unitaire_cents, status,
          option:option_id ( label, price_cents )
        `)
        .eq("inscription_id", id);

      setOptions(opts || []);

      // 3) Équipe (si applicable) : tous ceux qui partagent le même member_of_group_id
      if (insc.member_of_group_id) {
        const { data: mates } = await supabase
          .from("inscriptions")
          .select("*")
          .eq("member_of_group_id", insc.member_of_group_id)
          .order("created_at", { ascending: true });
        // Inclut potentiellement la ligne courante : on filtrera à l’affichage
        setTeamMates(mates || []);
      } else {
        setTeamMates([]);
      }

      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [id]);

  async function refresh() {
    // simple reload state
    navigate(0);
  }

  async function cancelInscription() {
    if (!inscription) return;
    const ok = window.confirm(
      "Confirmer l’annulation de cette inscription ?\nUn calcul de crédit d’annulation sera effectué."
    );
    if (!ok) return;

    try {
      setWorking(true);
      // RPC calculer_credit_annulation(uuid)
      const { error } = await supabase.rpc("calculer_credit_annulation", { id: inscription.id });
      if (error) throw error;
      alert("Annulation effectuée. Le crédit a été calculé et enregistré.");
      await refresh();
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l’annulation : " + (e?.message || "inconnue"));
    } finally {
      setWorking(false);
    }
  }

  // UI statuts
  function statutBadge(statut) {
    const s = (statut || "").toLowerCase();
    if (s === "validé" || s === "valide" || s === "payé" || s === "paye")
      return <Badge tone="green">✅ {inscription.statut}</Badge>;
    if (s === "en attente" || s === "pending")
      return <Badge tone="amber">⏳ {inscription.statut}</Badge>;
    if (s === "annulé" || s === "annule")
      return <Badge tone="red">🛑 {inscription.statut}</Badge>;
    return <Badge>{inscription.statut || "—"}</Badge>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <div className="max-w-5xl mx-auto px-4 py-10">
          <div className="h-8 w-60 bg-neutral-200 rounded animate-pulse mb-4" />
          <div className="space-y-4">
            <div className="h-40 bg-neutral-100 rounded-2xl animate-pulse" />
            <div className="h-40 bg-neutral-100 rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!inscription) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <p className="text-neutral-700">Inscription introuvable.</p>
          <Link to="/mesinscriptions" className="text-sm text-neutral-600 underline">
            ← Retour à mes inscriptions
          </Link>
        </div>
      </div>
    );
  }

  const prixOptionsEur = (options || []).reduce(
    (sum, o) => sum + ((Number(o.prix_unitaire_cents ?? o.option?.price_cents ?? 0) * Number(o.quantity || 0)) / 100),
    0
  );

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Header */}
      <section className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Link to="/mesinscriptions" className="text-sm text-neutral-500 hover:text-neutral-800">
                ← Retour à mes inscriptions
              </Link>
              <h1 className="text-2xl sm:text-3xl font-bold mt-1">
                Mon inscription — <span className="text-orange-600">Tick</span>Race
              </h1>
              <p className="text-neutral-600 mt-1 text-sm">
                ID : <span className="font-mono">{inscription.id}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              {statutBadge(inscription.statut)}
              {inscription.dossard ? <Badge tone="blue">Dossard #{inscription.dossard}</Badge> : null}
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        {/* Bloc Course / Format */}
        <Section
          title={course?.nom || "Épreuve"}
          desc={course ? `${course.lieu || ""}${course.departement ? " • " + course.departement : ""}` : ""}
          right={
            <Link
              to={course ? `/courses/${course.id}` : "#"}
              className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
            >
              Voir la page épreuve
            </Link>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl ring-1 ring-neutral-200 bg-neutral-50 p-4">
              <div className="font-semibold text-neutral-800 mb-2">Format</div>
              <Row label="Nom">{format?.nom || "—"}</Row>
              <Row label="Type d’inscription">
                {format?.type_format ? format.type_format : "—"}
                {isTeamMode ? (
                  <span className="ml-2 text-xs text-neutral-600">
                    ({format?.type_format === "groupe" ? "Paiement groupé" : "Relais"})
                  </span>
                ) : null}
              </Row>
              <Row label="Date">{format?.date || "—"}</Row>
              <Row label="Heure de départ">{format?.heure_depart || "—"}</Row>
              <Row label="Parcours">
                {(format?.distance_km ? `${format.distance_km} km` : "—") +
                  (format?.denivele_dplus ? ` • ${format.denivele_dplus} m D+` : "")}
              </Row>
            </div>

            <div className="rounded-xl ring-1 ring-neutral-200 bg-neutral-50 p-4">
              <div className="font-semibold text-neutral-800 mb-2">Récapitulatif</div>
              <Row label="Inscription au nom de">
                {inscription.prenom} {inscription.nom}
              </Row>
              <Row label="Email">{inscription.email || "—"}</Row>
              <Row label="Téléphone">{inscription.telephone || "—"}</Row>
              <Row label="Club">{inscription.club || "—"}</Row>
              <Row label="Statut">{statutBadge(inscription.statut)}</Row>
              <Row label="Dossard">{inscription.dossard ? `#${inscription.dossard}` : "Non attribué"}</Row>
            </div>
          </div>
        </Section>

        {/* Bloc Options payantes */}
        <Section
          title="Options liées à l’inscription"
          desc="Repas, goodies, etc."
          right={options?.length ? <div className="text-sm text-neutral-600">Total : <b>{eur(prixOptionsEur)}</b></div> : null}
        >
          {options?.length ? (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-neutral-600 border-b">
                    <th className="py-2 pr-3">Option</th>
                    <th className="py-2 pr-3">Qté</th>
                    <th className="py-2 pr-3">PU</th>
                    <th className="py-2 pr-3">Statut</th>
                    <th className="py-2 pr-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {options.map((o) => {
                    const pu = Number(o.prix_unitaire_cents ?? o.option?.price_cents ?? 0) / 100;
                    const total = pu * Number(o.quantity || 0);
                    const s = (o.status || "").toLowerCase();
                    const tone = s === "confirmed" ? "green" : s === "canceled" ? "red" : "amber";
                    return (
                      <tr key={o.id} className="border-b last:border-b-0">
                        <td className="py-2 pr-3">{o.option?.label || "Option"}</td>
                        <td className="py-2 pr-3">{o.quantity}</td>
                        <td className="py-2 pr-3">{eur(pu)}</td>
                        <td className="py-2 pr-3"><Badge tone={tone}>{o.status || "—"}</Badge></td>
                        <td className="py-2 pr-3 font-medium">{eur(total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-neutral-600">Aucune option n’est liée à cette inscription.</p>
          )}
        </Section>

        {/* Bloc Détails personnels */}
        <Section title="Détails personnels" desc="Ces informations ont été fournies lors de l’inscription.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl ring-1 ring-neutral-200 bg-neutral-50 p-4">
              <Row label="Nom / Prénom">
                {inscription.nom?.toUpperCase()} {inscription.prenom}
              </Row>
              <Row label="Genre">{inscription.genre || "—"}</Row>
              <Row label="Date de naissance">{inscription.date_naissance || "—"}</Row>
              <Row label="Nationalité">{inscription.nationalite || "—"}</Row>
              <Row label="Affichage résultats">
                {inscription.apparaitre_resultats === false ? "Non" : "Oui"}
              </Row>
              <Row label="N° licence / PPS">{inscription.numero_licence || inscription.pps_identifier || "—"}</Row>
              <Row label="Justificatif">{inscription.justificatif_type || "—"}</Row>
              <Row label="Contact d’urgence">
                {inscription.contact_urgence_nom || "—"} {inscription.contact_urgence_telephone ? `(${inscription.contact_urgence_telephone})` : ""}
              </Row>
            </div>

            <div className="rounded-xl ring-1 ring-neutral-200 bg-neutral-50 p-4">
              <Row label="Adresse">{inscription.adresse || "—"}</Row>
              <Row label="Complément">{inscription.adresse_complement || "—"}</Row>
              <Row label="Code postal">{inscription.code_postal || "—"}</Row>
              <Row label="Ville / Pays">
                {(inscription.ville || "—") + (inscription.pays ? `, ${inscription.pays}` : "")}
              </Row>
              <Row label="Email">{inscription.email || "—"}</Row>
              <Row label="Téléphone">{inscription.telephone || "—"}</Row>
            </div>
          </div>
        </Section>

        {/* Bloc Équipe (si groupe/relais) */}
        {isTeamMode && (
          <Section
            title={format?.type_format === "groupe" ? "Inscription groupée" : "Équipe relais"}
            desc={inscription.team_name ? `Nom d’équipe : ${inscription.team_name}` : undefined}
          >
            {teamMates?.length ? (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-neutral-600 border-b">
                      <th className="py-2 pr-3">#</th>
                      <th className="py-2 pr-3">Nom</th>
                      <th className="py-2 pr-3">Prénom</th>
                      <th className="py-2 pr-3">Genre</th>
                      <th className="py-2 pr-3">Naissance</th>
                      <th className="py-2 pr-3">Licence / PPS</th>
                      <th className="py-2 pr-3">Email</th>
                      <th className="py-2 pr-3">Statut</th>
                      <th className="py-2 pr-3">Dossard</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamMates
                      .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""))
                      .map((m, i) => (
                        <tr key={m.id} className={`border-b last:border-b-0 ${m.id === inscription.id ? "bg-amber-50/40" : ""}`}>
                          <td className="py-2 pr-3">{i + 1}</td>
                          <td className="py-2 pr-3">{m.nom}</td>
                          <td className="py-2 pr-3">{m.prenom}</td>
                          <td className="py-2 pr-3">{m.genre || "—"}</td>
                          <td className="py-2 pr-3">{m.date_naissance || "—"}</td>
                          <td className="py-2 pr-3">{m.numero_licence || m.pps_identifier || "—"}</td>
                          <td className="py-2 pr-3">{m.email || "—"}</td>
                          <td className="py-2 pr-3">{m.statut}</td>
                          <td className="py-2 pr-3">{m.dossard ? `#${m.dossard}` : "—"}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-neutral-600">Aucun membre d’équipe supplémentaire trouvé.</p>
            )}
          </Section>
        )}

        {/* Bloc Actions */}
        <Section title="Actions">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={refresh}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-50"
            >
              ↻ Rafraîchir
            </button>

            {String(inscription.statut || "").toLowerCase() !== "annulé" && (
              <button
                type="button"
                onClick={cancelInscription}
                disabled={working}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${
                  working ? "bg-neutral-400 cursor-not-allowed" : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {working ? "Annulation…" : "Annuler l’inscription"}
              </button>
            )}

            <Link
              to={`/courses/${inscription.course_id}`}
              className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
            >
              Voir la course
            </Link>
          </div>

          <p className="text-xs text-neutral-500 mt-3">
            L’annulation déclenche la fonction <code>calculer_credit_annulation(uuid)</code> qui calcule le crédit selon les règles en base, enregistre la
            ligne dans <code>credits_annulation</code> et met le statut de l’inscription à <code>annulé</code>.
          </p>
        </Section>
      </div>
    </div>
  );
}
