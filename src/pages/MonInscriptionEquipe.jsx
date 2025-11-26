// src/pages/MonInscriptionEquipe.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../supabase";

/* ---------- UI helpers ---------- */
function Pill({ children, color = "neutral" }) {
  const map = {
    neutral: "bg-neutral-100 text-neutral-800 ring-neutral-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    orange: "bg-orange-50 text-orange-700 ring-orange-200",
    red: "bg-rose-50 text-rose-700 ring-rose-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${map[color]}`}
    >
      {children}
    </span>
  );
}

const formatDate = (d) =>
  d
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(typeof d === "string" ? new Date(d) : d)
    : "";

const formatDateTime = (d) =>
  d
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(typeof d === "string" ? new Date(d) : d)
    : "";

export default function MonInscriptionEquipe() {
  // Accepte les deux noms de param route : /mon-inscription-equipe/:groupeId ou :id
  const { groupeId, id } = useParams();
  const paramId = groupeId || id; // valeur réellement passée dans l'URL

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [inscriptions, setInscriptions] = useState([]);
  const [referenceInscription, setReferenceInscription] = useState(null);

  const course = referenceInscription?.format?.course || null;
  const format = referenceInscription?.format || null;

  const isTeamMode = useMemo(() => {
    const t = format?.type_format;
    return t === "groupe" || t === "relais";
  }, [format]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!paramId) {
        setErrorMsg("Paramètre d'URL manquant.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMsg("");
      setInscriptions([]);
      setReferenceInscription(null);

      try {
        // 1) On ESSAIE d'abord d'interpréter paramId comme un *inscription.id*
        const { data: insRef, error: eRef } = await supabase
          .from("inscriptions")
          .select(
            `
            *,
            format:format_id(
              id,
              nom,
              date,
              distance_km,
              denivele_dplus,
              prix,
              prix_equipe,
              type_format,
              course:course_id(
                id,
                nom,
                lieu,
                image_url
              )
            )
          `
          )
          .eq("id", paramId)
          .maybeSingle();

        if (eRef) {
          console.warn("Erreur chargement inscription de référence:", eRef.message);
        }

        // Cas A : on a trouvé une inscription par son ID
        if (insRef) {
          const gid = insRef.groupe_id;

          // Si pas de groupe_id, on affiche au moins cette inscription
          if (!gid) {
            if (!cancelled) {
              setReferenceInscription(insRef);
              setInscriptions([insRef]);
              setLoading(false);
              setErrorMsg(
                "Cette inscription ne semble pas rattachée à un groupe (groupe_id absent)."
              );
            }
            return;
          }

          // Si groupe_id présent, on charge toutes les inscriptions du groupe
          const { data: teamInsc, error: eTeam } = await supabase
            .from("inscriptions")
            .select(
              `
              *,
              format:format_id(
                id,
                nom,
                date,
                distance_km,
                denivele_dplus,
                prix,
                prix_equipe,
                type_format,
                course:course_id(
                  id,
                  nom,
                  lieu,
                  image_url
                )
              )
            `
            )
            .eq("groupe_id", gid)
            .order("created_at", { ascending: true });

          if (eTeam) {
            console.error("Erreur chargement inscriptions de groupe:", eTeam.message);
            if (!cancelled) {
              setErrorMsg("Erreur lors du chargement des inscriptions de l'équipe.");
              setLoading(false);
            }
            return;
          }

          if (!teamInsc || teamInsc.length === 0) {
            // Fallback : on a bien une inscription, mais personne d'autre n'est rattaché
            if (!cancelled) {
              setReferenceInscription(insRef);
              setInscriptions([insRef]);
              setErrorMsg(
                "Aucune autre inscription trouvée pour ce groupe. Il est possible que vous soyez le seul membre saisi."
              );
              setLoading(false);
            }
            return;
          }

          if (!cancelled) {
            setReferenceInscription(insRef);
            setInscriptions(teamInsc);
            setLoading(false);
          }
          return;
        }

        // Cas B : aucune inscription avec cet ID -> on essaie de l'interpréter comme *groupe_id*
        const { data: byGroup, error: eGroup } = await supabase
          .from("inscriptions")
          .select(
            `
            *,
            format:format_id(
              id,
              nom,
              date,
              distance_km,
              denivele_dplus,
              prix,
              prix_equipe,
              type_format,
              course:course_id(
                id,
                nom,
                lieu,
                image_url
              )
            )
          `
          )
          .eq("groupe_id", paramId)
          .order("created_at", { ascending: true });

        if (eGroup) {
          console.error("Erreur chargement par groupe_id:", eGroup.message);
          if (!cancelled) {
            setErrorMsg("Erreur lors du chargement des inscriptions pour ce groupe.");
            setLoading(false);
          }
          return;
        }

        if (!byGroup || byGroup.length === 0) {
          if (!cancelled) {
            setErrorMsg(
              "Aucune inscription trouvée pour ce groupe.\n\nIl est possible que :\n- Vous ne soyez pas connecté avec le bon compte.\n- Les règles de sécurité (RLS) empêchent l’accès à ce groupe.\n- L’URL ne corresponde pas à un groupe valide."
            );
            setLoading(false);
          }
          return;
        }

        if (!cancelled) {
          setReferenceInscription(byGroup[0]);
          setInscriptions(byGroup);
          setLoading(false);
        }
      } catch (err) {
        console.error("MonInscriptionEquipe fatal error:", err);
        if (!cancelled) {
          setErrorMsg("Une erreur inattendue est survenue lors du chargement de l'équipe.");
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [paramId]);

  /* ---------- Dérivés ---------- */
  const teamName = useMemo(() => {
    if (!inscriptions.length) return "";
    // On essaie d'abord un éventuel champ team_name,
    // sinon on fabrique un libellé générique.
    return (
      inscriptions[0]?.team_name ||
      referenceInscription?.team_name ||
      "Équipe"
    );
  }, [inscriptions, referenceInscription]);

  const totalParticipants = inscriptions.length;

  /* ---------- UI loading ---------- */
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <section className="bg-white border-b border-neutral-200">
          <div className="mx-auto max-w-7xl px-4 py-10">
            <div className="h-6 w-56 bg-neutral-100 rounded mb-2" />
            <div className="h-4 w-80 bg-neutral-100 rounded" />
          </div>
        </section>
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="grid gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl ring-1 ring-neutral-200 bg-white p-5"
              >
                <div className="h-5 w-1/3 bg-neutral-100 rounded mb-2" />
                <div className="h-4 w-2/3 bg-neutral-100 rounded mb-1" />
                <div className="h-4 w-1/2 bg-neutral-100 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Pas d'inscriptions / erreur ---------- */
  if (!inscriptions.length) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <section className="bg-white border-b border-neutral-200">
          <div className="mx-auto max-w-7xl px-4 py-10">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              Mon inscription équipe
            </h1>
            <p className="mt-2 text-neutral-600 text-base">
              {errorMsg || "Aucune inscription trouvée pour ce groupe."}
            </p>
          </div>
        </section>
        <div className="mx-auto max-w-3xl px-4 py-8">
          <div className="rounded-2xl bg-white ring-1 ring-neutral-200 p-6">
            <p className="text-sm whitespace-pre-line text-neutral-700">
              {errorMsg ||
                "Aucune inscription trouvée pour ce groupe.\n\nIl est possible que :\n- Vous ne soyez pas connecté avec le bon compte.\n- Les règles de sécurité (RLS) empêchent l’accès à ce groupe.\n- L’URL a été modifiée ou ne correspond pas à un groupe valide."}
            </p>
            <div className="mt-4">
              <Link
                to="/mesinscriptions"
                className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
              >
                ← Retour à mes inscriptions
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Affichage normal ---------- */
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Header */}
      <section className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-7xl px-4 py-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              to="/mesinscriptions"
              className="text-sm text-neutral-500 hover:text-neutral-800"
            >
              ← Retour à mes inscriptions
            </Link>
            <h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight">
              Mon inscription équipe
            </h1>
            {course && (
              <p className="mt-1 text-sm text-neutral-600">
                {course.nom} — {course.lieu}
              </p>
            )}
            {format && (
              <p className="mt-1 text-sm text-neutral-600">
                Format :{" "}
                <span className="font-medium">
                  {format.nom} · {format.distance_km} km / {format.denivele_dplus} m D+
                </span>{" "}
                {format.date && <>· {formatDate(format.date)}</>}
              </p>
            )}
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2">
            <Pill color="blue">
              {isTeamMode ? "Inscription équipe / relais" : "Inscription multiple"}
            </Pill>
            {teamName && (
              <div className="text-sm text-neutral-700">
                Équipe : <span className="font-semibold">{teamName}</span>
              </div>
            )}
            <div className="text-xs text-neutral-500">
              ID (URL) : <code className="font-mono">{paramId}</code>
            </div>
          </div>
        </div>
      </section>

      {/* Contenu */}
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        {/* Bloc résumé */}
        <div className="rounded-2xl bg-white ring-1 ring-neutral-200 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-neutral-600">Nom d'équipe :</span>
              <span className="font-semibold">
                {teamName || "Non renseigné"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-neutral-600">Participants :</span>
              <span className="font-semibold">{totalParticipants}</span>
            </div>
            {referenceInscription?.created_at && (
              <div className="flex items-center gap-2 text-neutral-600">
                <span>Inscription créée le</span>
                <span className="font-medium">
                  {formatDateTime(referenceInscription.created_at)}
                </span>
              </div>
            )}
            {referenceInscription?.statut && (
              <div className="flex items-center gap-2">
                <span className="text-neutral-600">Statut global inscrit :</span>
                <span className="font-semibold">{referenceInscription.statut}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tableau des membres */}
        <div className="rounded-2xl bg-white ring-1 ring-neutral-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Détail des membres</h2>
              <p className="text-sm text-neutral-500">
                Retrouvez la liste des coureurs rattachés à cette équipe.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="py-2 px-3 text-left">#</th>
                  <th className="py-2 px-3 text-left">Nom</th>
                  <th className="py-2 px-3 text-left">Prénom</th>
                  <th className="py-2 px-3 text-left">Sexe</th>
                  <th className="py-2 px-3 text-left">Date de naissance</th>
                  <th className="py-2 px-3 text-left">N° licence / PPS</th>
                  <th className="py-2 px-3 text-left">Email</th>
                  <th className="py-2 px-3 text-left">Statut</th>
                </tr>
              </thead>
              <tbody>
                {inscriptions.map((ins, idx) => (
                  <tr
                    key={ins.id}
                    className={idx % 2 === 0 ? "bg-white" : "bg-neutral-50/60"}
                  >
                    <td className="py-2 px-3 align-top">{idx + 1}</td>
                    <td className="py-2 px-3 align-top font-medium">
                      {ins.nom || "—"}
                    </td>
                    <td className="py-2 px-3 align-top">
                      {ins.prenom || "—"}
                    </td>
                    <td className="py-2 px-3 align-top">
                      {ins.genre || "—"}
                    </td>
                    <td className="py-2 px-3 align-top">
                      {ins.date_naissance ? formatDate(ins.date_naissance) : "—"}
                    </td>
                    <td className="py-2 px-3 align-top font-mono text-xs">
                      {ins.numero_licence || "—"}
                    </td>
                    <td className="py-2 px-3 align-top">
                      {ins.email || "—"}
                    </td>
                    <td className="py-2 px-3 align-top">
                      {ins.statut ? (
                        <Pill
                          color={
                            ins.statut === "validé"
                              ? "green"
                              : ins.statut === "annulé"
                              ? "red"
                              : "orange"
                          }
                        >
                          {ins.statut}
                        </Pill>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lien retour course (si dispo) */}
        {course && (
          <div className="flex justify-between items-center flex-wrap gap-3">
            <Link
              to={`/courses/${course.id}`}
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              ← Voir la page de la course
            </Link>
            <Link
              to="/mesinscriptions"
              className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
            >
              Retour à mes inscriptions
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
