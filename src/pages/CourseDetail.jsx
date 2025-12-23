// src/pages/CourseDetail.jsx
import Chat from "../components/Chat";
import React, { useEffect, useMemo, useState, Suspense, lazy } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import LiveResultsPublic from "../components/LiveResultsPublic";

import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";
import {
  CalendarDays,
  MapPin,
  Mountain,
  UtensilsCrossed,
  Share2,
  ArrowRight,
  AlertCircle,
  Loader2,
  FileText,
} from "lucide-react";

const GPXViewer = lazy(() => import("../components/GPXViewer"));

/* ===== Helpers de dates et téléchargements ===== */
const parseDate = (d) => (d ? new Date(d) : null);
const fmtDate = (d) =>
  d
    ? new Intl.DateTimeFormat("fr-FR", {
        weekday: "short",
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(typeof d === "string" ? new Date(d) : d)
    : "";

const downloadFile = (url, filename = "parcours.gpx") => {
  try {
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", filename);
    a.setAttribute("rel", "noopener");
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch {
    window.open(url, "_blank", "noopener");
  }
};

/* ===== Page ===== */
export default function CourseDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { session } = useUser();

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);
  const [countsByFormat, setCountsByFormat] = useState(null); // null = inconnu (RLS), {} = connu
  const [error, setError] = useState(null);

  const [tab, setTab] = useState("aperçu"); // "aperçu" | "formats" | "parcours" | "infos" | "reglement" | "resultats"
  const [selectedFormatId, setSelectedFormatId] = useState(null);

  const [mapFull, setMapFull] = useState(false); // plein écran GPX (réservé)
  const [copied, setCopied] = useState(false); // toast copie lien

  // ✅ Règlement (fallback markdown depuis table reglements)
  const [reglementText, setReglementText] = useState("");
  const [reglementLoading, setReglementLoading] = useState(false);
  const [reglementError, setReglementError] = useState("");

  const BASE = import.meta.env?.VITE_PUBLIC_BASE_URL || window.location.origin;

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setError(null);

      // 1) Course
      const { data: c, error: e1 } = await supabase
        .from("courses")
        .select("id, nom, presentation, lieu, departement, image_url, en_ligne, organisateur_id, created_at")
        .eq("id", id)
        .maybeSingle();

      if (e1 || !c) {
        console.error("Erreur course:", e1);
        setError("Épreuve introuvable.");
        setLoading(false);
        return;
      }

      const isOwner = !!(session?.user?.id && c.organisateur_id === session.user.id);
      if (!c.en_ligne && !isOwner) {
        setCourse(c);
        setError("Cette épreuve est hors-ligne.");
        setLoading(false);
        return;
      }

      setCourse(c);

      // 2) Formats
      const { data: fmts, error: e2 } = await supabase
        .from("formats")
        .select(
          "id, nom, type_epreuve, date, heure_depart, prix, distance_km, denivele_dplus, denivele_dmoins, adresse_depart, adresse_arrivee, dotation, presentation_parcours, image_url, gpx_url, nb_max_coureurs, stock_repas, ravitaillements, remise_dossards, reglement_pdf_url, age_minimum, hebergements, prix_repas"
        )
        .eq("course_id", id)
        .order("date", { ascending: true });

      if (e2) {
        console.error(e2);
        setFormats([]);
      } else {
        setFormats(fmts || []);
        // Pré-sélection via ?format=...
        const wanted = searchParams.get("format");
        if (!selectedFormatId && (fmts || []).length) {
          setSelectedFormatId(
            wanted && (fmts || []).some((f) => f.id === wanted) ? wanted : fmts[0].id
          );
        }
      }

      // 3) Inscriptions → comptage (peut être bloqué par RLS)
      try {
        const fids = (fmts || []).map((f) => f.id);
        if (fids.length) {
          const { data: insc, error: e3 } = await supabase.from("inscriptions").select("format_id").in("format_id", fids);

          if (e3) {
            setCountsByFormat(null);
          } else {
            const counts = {};
            (insc || []).forEach((i) => {
              counts[i.format_id] = (counts[i.format_id] || 0) + 1;
            });
            setCountsByFormat(counts);
          }
        } else {
          setCountsByFormat({});
        }
      } catch {
        setCountsByFormat(null);
      }

      setLoading(false);
    };

    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, session?.user?.id]);

 // ✅ Charger le règlement unique seulement quand on ouvre l’onglet
useEffect(() => {
  if (tab !== "reglement") return;
  if (reglementText || reglementLoading) return;

  const fetchReglement = async () => {
    setReglementLoading(true);
    setReglementError("");

    try {
      const { data, error } = await supabase
        .from("reglements")
        .select("id, status, generated_md, edited_md, published_md, updated_at")
        .eq("course_id", id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error(error);
        setReglementError("Règlement indisponible pour le moment.");
        return;
      }

      const md = (data?.published_md || data?.edited_md || data?.generated_md || "").trim();
      setReglementText(md);
    } catch (e) {
      console.error(e);
      setReglementError("Règlement indisponible pour le moment.");
    } finally {
      setReglementLoading(false);
    }
  };

  fetchReglement();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [tab, id]); // volontairement minimal


  // Agrégats généraux
  const aggregates = useMemo(() => {
    const fList = formats || [];
    const now = new Date();
    const upcoming = fList.filter((f) => {
      const d = parseDate(f.date);
      return d && d >= new Date(now.toDateString());
    });
    const next_date = (upcoming.length ? upcoming : fList)[0]?.date || null;

    const minPrix = fList.reduce((min, f) => {
      const p = Number(f.prix);
      return Number.isFinite(p) ? Math.min(min, p) : min;
    }, Infinity);
    const min_prix = minPrix === Infinity ? null : minPrix;

    const dists = fList.map((f) => Number(f.distance_km)).filter((n) => Number.isFinite(n));
    const dplus = fList.map((f) => Number(f.denivele_dplus)).filter((n) => Number.isFinite(n));
    const min_dist = dists.length ? Math.min(...dists) : null;
    const max_dist = dists.length ? Math.max(...dists) : null;
    const min_dplus = dplus.length ? Math.min(...dplus) : null;
    const max_dplus = dplus.length ? Math.max(...dplus) : null;

    const has_repas = fList.some((f) => Number(f.stock_repas) > 0);

    let is_full = false;
    if (countsByFormat !== null && fList.length) {
      is_full = fList.every((f) => {
        const max = Number(f.nb_max_coureurs);
        if (!max || Number.isNaN(max)) return false;
        const count = Number(countsByFormat?.[f.id] || 0);
        return count >= max;
      });
    }

    const is_new = course?.created_at
      ? (new Date().getTime() - new Date(course.created_at).getTime()) / 86400000 < 14
      : false;

    return {
      next_date,
      min_prix,
      min_dist,
      max_dist,
      min_dplus,
      max_dplus,
      has_repas,
      is_full,
      is_new,
    };
  }, [formats, countsByFormat, course?.created_at]);

  const selectedFormat = formats.find((f) => f.id === selectedFormatId) || null;
  const hasAnyGPX = useMemo(() => (formats || []).some((f) => !!f.gpx_url), [formats]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 flex items-center gap-3 text-neutral-600">
        <Loader2 className="w-5 h-5 animate-spin" />
        Chargement de l’épreuve…
      </div>
    );
  }

  if (!course) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
        <h1 className="text-xl font-semibold">Épreuve introuvable</h1>
        <p className="text-neutral-600 mt-1">Vérifiez le lien ou revenez à la liste.</p>
        <Link
          to="/courses"
          className="inline-flex mt-4 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
        >
          ← Retour aux épreuves
        </Link>
      </div>
    );
  }

  const shareUrl = `${BASE}/courses/${course.id}`;
  const soon =
    aggregates.next_date &&
    (parseDate(aggregates.next_date).getTime() - new Date().getTime()) / 86400000 <= 14;

  async function copyShare(url) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className="mx-auto max-w-7xl">
      {/* TOAST de copie lien */}
      {copied && (
        <div className="fixed bottom-4 right-4 z-[70] rounded-full bg-black text-white text-sm px-3 py-2 shadow">
          Lien copié ✨
        </div>
      )}

      {/* HERO */}
      <div className="relative h-[260px] sm:h-[360px] md:h-[420px] w-full overflow-hidden">
        {course.image_url ? (
          <img
            src={course.image_url}
            alt={`Image de ${course.nom}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-neutral-200 flex items-center justify-center text-neutral-500">
            <Mountain className="w-10 h-10" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

        {/* Badges */}
        <div className="absolute left-4 top-4 flex gap-2 flex-wrap">
          {soon && <Badge text="Bientôt" color="emerald" />}
          {aggregates.has_repas && <Badge text="Repas" color="amber" />}
          {aggregates.is_full && <Badge text="Complet" color="rose" />}
          {aggregates.is_new && <Badge text="Nouveau" color="blue" />}
          {!course.en_ligne && <Badge text="Hors-ligne" color="gray" />}
        </div>

        {/* Titre & CTA */}
        <div className="absolute bottom-4 left-4 right-4">
          <div className="max-w-7xl mx-auto px-2 sm:px-4">
            <h1 className="text-white text-2xl sm:text-3xl md:text-4xl font-bold drop-shadow">
              {course.nom}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-white/90">
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {course.lieu} ({course.departement})
              </span>
              {aggregates.next_date && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="w-4 h-4" />
                  {fmtDate(aggregates.next_date)}
                </span>
              )}
              {aggregates.min_prix != null && (
                <span className="inline-flex items-center gap-1">
                  💶 À partir de <strong>{aggregates.min_prix.toFixed(2)} €</strong>
                </span>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link
                to={`/inscription/${course.id}`}
                className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-white text-sm font-semibold hover:brightness-110"
              >
                S’inscrire <ArrowRight className="w-4 h-4" />
              </Link>

              {/* Devenir bénévole */}
              <Link
                to={`/benevoles/${course.id}`}
                className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-3 py-2 text-white text-sm font-semibold hover:bg-white/25"
              >
                Devenir bénévole
              </Link>

              <button
                onClick={() => copyShare(shareUrl)}
                className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-3 py-2 text-white text-sm hover:bg-white/25"
                title="Copier le lien"
              >
                <Share2 className="w-4 h-4" />
                Partager
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENU */}
      <div className="px-4 sm:px-6 md:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Colonne principale */}
          <div className="lg:col-span-8">
            {/* Onglets */}
            <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b">
              <div className="flex gap-3 overflow-x-auto py-2">
                {[
                  { key: "aperçu", label: "Aperçu" },
                  { key: "formats", label: "Formats & tarifs" },
                  { key: "parcours", label: "Parcours", disabled: !hasAnyGPX },
                  { key: "infos", label: "Infos pratiques" },
                  { key: "reglement", label: "Règlement" },
                  { key: "resultats", label: "Résultats" },
                ].map((t) => (
                  <button
                    key={t.key}
                    onClick={() => !t.disabled && setTab(t.key)}
                    disabled={t.disabled}
                    className={[
                      "rounded-full px-4 py-2 text-sm",
                      t.disabled
                        ? "bg-neutral-100 text-neutral-400 cursor-not-allowed"
                        : tab === t.key
                        ? "bg-neutral-900 text-white"
                        : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
                    ].join(" ")}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* PANELS */}
            {tab === "aperçu" && (
              <section className="mt-6 space-y-4">
                {course.presentation ? (
                  <p className="text-neutral-800 leading-relaxed whitespace-pre-line">
                    {course.presentation}
                  </p>
                ) : (
                  <p className="text-neutral-500">
                    La présentation de l’épreuve sera bientôt disponible.
                  </p>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Fact
                    title="Distance"
                    value={formatRange(aggregates.min_dist, aggregates.max_dist, " km")}
                  />
                  <Fact
                    title="D+"
                    value={formatRange(aggregates.min_dplus, aggregates.max_dplus, " m")}
                  />
                  <Fact
                    title="Prochaine date"
                    value={aggregates.next_date ? fmtDate(aggregates.next_date) : "À venir"}
                  />
                  <Fact
                    title="Repas"
                    value={aggregates.has_repas ? "Disponible" : "—"}
                    Icon={UtensilsCrossed}
                  />
                </div>
              </section>
            )}

            {tab === "formats" && (
              <section className="mt-6">
                {formats.length === 0 ? (
                  <EmptyBox text="Les formats seront publiés bientôt." />
                ) : (
                  <FormatsTable courseId={course.id} formats={formats} countsByFormat={countsByFormat} />
                )}
              </section>
            )}

            {tab === "parcours" && (
              <section className="mt-6 space-y-4">
                {formats.length === 0 ? (
                  <EmptyBox text="Les parcours seront publiés bientôt." />
                ) : (
                  <>
                    {/* Sélecteur de format pour afficher le GPX de ce format */}
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-sm text-neutral-700">Choisir un format :</label>
                      <select
                        value={selectedFormatId || ""}
                        onChange={(e) => setSelectedFormatId(e.target.value)}
                        className="rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300"
                      >
                        {formats.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.nom} {f.date ? `— ${fmtDate(f.date)}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedFormat?.gpx_url ? (
                      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                        <Suspense fallback={<div className="p-4 text-neutral-600">Chargement de la carte…</div>}>
                          <GPXViewer
                            gpxUrl={selectedFormat.gpx_url}
                            height={420}
                            showElevationProfile
                            xAxis="distance"
                            yAxis="elevation"
                            responsive
                            allowDownload
                          />
                        </Suspense>
                      </div>
                    ) : (
                      <EmptyBox text="Le GPX n’est pas disponible pour ce format." />
                    )}

                    {selectedFormat?.presentation_parcours && (
                      <p className="text-neutral-700">{selectedFormat.presentation_parcours}</p>
                    )}
                  </>
                )}
              </section>
            )}

            {tab === "infos" && (
              <section className="mt-6 space-y-4">
                {formats.length === 0 ? (
                  <EmptyBox text="Infos à venir." />
                ) : (
                  <>
                    {/* Sélecteur du format affiché */}
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-sm text-neutral-700">Choisir un format :</label>
                      <select
                        value={selectedFormatId || ""}
                        onChange={(e) => setSelectedFormatId(e.target.value)}
                        className="rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300"
                      >
                        {formats.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.nom} {f.date ? `— ${fmtDate(f.date)}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* GRID INFO PRATIQUES */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      {/* Carte logistique */}
                      <SectionCard title="Logistique" subtitle="Infos clés du jour J">
                        <InfoItem icon="calendar" label="Date">
                          {selectedFormat?.date ? fmtDate(selectedFormat.date) : "—"}
                          {selectedFormat?.heure_depart ? ` • ${selectedFormat.heure_depart}` : ""}
                        </InfoItem>
                        <InfoItem icon="start" label="Départ">
                          {selectedFormat?.adresse_depart || formats[0]?.adresse_depart || "Non communiqué"}
                          <MapLink address={selectedFormat?.adresse_depart || formats[0]?.adresse_depart} />
                        </InfoItem>
                        <InfoItem icon="finish" label="Arrivée">
                          {selectedFormat?.adresse_arrivee || formats[0]?.adresse_arrivee || "Non communiqué"}
                          <MapLink address={selectedFormat?.adresse_arrivee || formats[0]?.adresse_arrivee} />
                        </InfoItem>
                        <InfoItem icon="shield" label="Âge minimum">
                          {Number.isFinite(Number(selectedFormat?.age_minimum))
                            ? `${selectedFormat.age_minimum} ans`
                            : "—"}
                        </InfoItem>
                      </SectionCard>

                      {/* Carte course & tarifs */}
                      <SectionCard title="Course & tarifs" subtitle="Résumé du format">
                        <div className="mb-2">
                          <Chips
                            items={[
                              selectedFormat?.type_epreuve && selectedFormat.type_epreuve.toUpperCase(),
                              selectedFormat?.distance_km && `${Number(selectedFormat.distance_km)} km`,
                              Number.isFinite(Number(selectedFormat?.denivele_dplus)) && `${selectedFormat.denivele_dplus} m D+`,
                              Number.isFinite(Number(selectedFormat?.denivele_dmoins)) && `${selectedFormat.denivele_dmoins} m D-`,
                            ]}
                          />
                        </div>
                        <InfoItem icon="euro" label="Prix">
                          {Number.isFinite(Number(selectedFormat?.prix))
                            ? `${Number(selectedFormat.prix).toFixed(2)} €`
                            : "—"}
                        </InfoItem>
                        {Number(selectedFormat?.stock_repas) > 0 && (
                          <InfoItem icon="meal" label="Repas">
                            {selectedFormat?.prix_repas != null
                              ? `${Number(selectedFormat.prix_repas).toFixed(2)} €`
                              : "Disponible"}
                          </InfoItem>
                        )}
                        <InfoItem icon="trophy" label="Dotation">
                          {selectedFormat?.dotation || "—"}
                        </InfoItem>
                      </SectionCard>

                      {/* Carte ravitos & dossards */}
                      <SectionCard title="Ravitaillements & dossards" subtitle="Ce qu’il faut savoir">
                        {asList(selectedFormat?.ravitaillements).length > 0 ? (
                          <div className="mb-3">
                            <div className="text-[13px] font-medium text-neutral-600 mb-1">Ravitaillements</div>
                            <ul className="list-disc pl-5 text-sm text-neutral-800 space-y-1">
                              {asList(selectedFormat.ravitaillements).map((r, i) => (
                                <li key={i}>{r}</li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <InfoItem icon="bottle" label="Ravitaillements">
                            —
                          </InfoItem>
                        )}

                        <InfoItem icon="id" label="Remise des dossards">
                          {selectedFormat?.remise_dossards || "—"}
                        </InfoItem>
                      </SectionCard>

                      {/* Carte règlement & hébergements */}
                      <SectionCard title="Règlement & hébergements" subtitle="Documentation & pratique">
                        <InfoItem icon="file" label="Règlement">
                          {selectedFormat?.reglement_pdf_url ? (
                            <a
                              href={selectedFormat.reglement_pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
                            >
                              Télécharger le PDF
                            </a>
                          ) : (
                            "—"
                          )}
                        </InfoItem>

                        {asList(selectedFormat?.hebergements).length > 0 ? (
                          <div>
                            <div className="text-[13px] font-medium text-neutral-600 mb-1">Hébergements</div>
                            <ul className="list-disc pl-5 text-sm text-neutral-800 space-y-1">
                              {asList(selectedFormat.hebergements).map((h, i) => (
                                <li key={i}>{h}</li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <InfoItem icon="bed" label="Hébergements">
                            {selectedFormat?.hebergements || "—"}
                          </InfoItem>
                        )}
                      </SectionCard>

                      {/* Carte présentation / texte libre (plein largeur) */}
                      <div className="xl:col-span-2">
                        <SectionCard title="Présentation du parcours" subtitle="Description de l’organisateur">
                          <div className="text-sm text-neutral-800 whitespace-pre-line">
                            {selectedFormat?.presentation_parcours || course.presentation || "—"}
                          </div>
                        </SectionCard>
                      </div>
                    </div>
                  </>
                )}
              </section>
            )}

            {/* ✅ NOUVEL ONGLET : Règlement */}
            {tab === "reglement" && (
  <section className="mt-6 space-y-4">
    {reglementLoading ? (
      <div className="rounded-2xl border bg-white shadow-sm p-5 text-neutral-600 inline-flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Chargement du règlement…
      </div>
    ) : reglementError ? (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800">
        {reglementError}
      </div>
    ) : reglementText ? (
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b border-neutral-200 flex items-center gap-2 font-semibold text-neutral-900">
          <FileText className="w-4 h-4" />
          Règlement de l’épreuve
        </div>

        <div className="p-5">
          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
            {reglementText}
          </pre>
        </div>
      </div>
    ) : (
      <EmptyBox text="Le règlement n’est pas encore disponible." />
    )}
  </section>
)}


                {/* PDF prioritaire si présent */}
                {selectedFormat?.reglement_pdf_url ? (
                  <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-neutral-200 flex items-center justify-between gap-3">
                      <div className="inline-flex items-center gap-2 font-semibold text-neutral-900">
                        <FileText className="w-4 h-4" />
                        Règlement (PDF)
                      </div>
                      <a
                        href={selectedFormat.reglement_pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                      >
                        Télécharger
                      </a>
                    </div>

                    <iframe
                      title="Règlement PDF"
                      src={selectedFormat.reglement_pdf_url}
                      className="w-full h-[80vh]"
                    />
                  </div>
                ) : (
                  <>
                    {reglementLoading ? (
                      <div className="rounded-2xl border bg-white shadow-sm p-5 text-neutral-600 inline-flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Chargement du règlement…
                      </div>
                    ) : reglementError ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800">
                        {reglementError}
                      </div>
                    ) : reglementText ? (
                      <div className="rounded-2xl border bg-white shadow-sm p-5">
                        <div className="text-sm text-neutral-500 mb-3">
                          Version texte (générée) — vous pouvez aussi publier un PDF depuis l’espace organisateur.
                        </div>
                        <pre className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
                          {reglementText}
                        </pre>
                      </div>
                    ) : (
                      <EmptyBox text="Le règlement n’est pas encore disponible." />
                    )}
                  </>
                )}
              </section>
            )}

            {tab === "resultats" && (
              <section className="mt-6">
                <LiveResultsPublic courseId={course.id} />
              </section>
            )}

            {/* Discussion */}
            <section id="discussion" className="mt-8">
              <div className="rounded-2xl border bg-white shadow-sm">
                <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Discuter sous l’épreuve</h2>
                  <a
                    href="#discussion"
                    className="text-sm text-neutral-500 hover:text-neutral-800"
                    title="Lien direct"
                  >
                    #discussion
                  </a>
                </div>
                <div className="p-5">
                  {course && <Chat courseId={course.id} organisateurId={course.organisateur_id} />}

                  <p className="text-neutral-600 text-sm mt-3">
                    Le chat arrive bientôt. Mentionnez <strong>@IA</strong> pour poser une question à
                    l’assistant.
                  </p>
                </div>
              </div>
            </section>
          </div>

          {/* Sidebar sticky */}
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-6 space-y-4">
              <div className="rounded-2xl border bg-white shadow-sm p-4">
                <h3 className="text-lg font-semibold">S’inscrire</h3>
                {formats.length === 0 ? (
                  <p className="text-sm text-neutral-600 mt-2">Les formats seront publiés bientôt.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {formats.map((f) => {
                      const max = Number(f.nb_max_coureurs) || null;
                      const inscrit = Number(countsByFormat?.[f.id] || 0);
                      const remaining = max ? Math.max(0, max - inscrit) : null;
                      const full = max ? inscrit >= max : false;

                      return (
                        <div key={f.id} className="rounded-xl border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium">{f.nom}</div>
                              <div className="text-xs text-neutral-600 mt-0.5 flex flex-wrap gap-2">
                                {f.date && (
                                  <span className="inline-flex items-center gap-1">
                                    <CalendarDays className="w-3 h-3" />
                                    {fmtDate(f.date)}
                                    {f.heure_depart ? ` • ${f.heure_depart}` : ""}
                                  </span>
                                )}
                                {Number.isFinite(Number(f.distance_km)) && <span>{Number(f.distance_km)} km</span>}
                                {Number.isFinite(Number(f.denivele_dplus)) && (
                                  <span>{Number(f.denivele_dplus)} m D+</span>
                                )}
                              </div>

                              <div className="mt-1 text-sm text-neutral-800">
                                {Number.isFinite(Number(f.prix)) ? (
                                  <>
                                    Prix : <strong>{Number(f.prix).toFixed(2)} €</strong>
                                  </>
                                ) : (
                                  <>Prix : —</>
                                )}
                              </div>

                              {max && (
                                <div className="mt-1 text-xs text-neutral-600">
                                  Places : {inscrit} / {max}{" "}
                                  {remaining !== null && remaining <= 10 && !full && (
                                    <span className="ml-1 text-amber-700 font-medium">
                                      ({remaining} restantes)
                                    </span>
                                  )}
                                </div>
                              )}

                              {remaining !== null && remaining <= 10 && !full && (
                                <div className="mt-1">
                                  <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[11px] font-medium">
                                    {remaining} place{remaining > 1 ? "s" : ""} restante{remaining > 1 ? "s" : ""}
                                  </span>
                                </div>
                              )}
                            </div>

                            {full ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-[11px] font-medium text-rose-800">
                                Complet
                              </span>
                            ) : (
                              <Link
                                to={`/inscription/${course.id}?format=${f.id}`}
                                className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-white text-sm font-semibold hover:brightness-110"
                              >
                                S’inscrire <ArrowRight className="w-4 h-4" />
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Faits rapides */}
              <div className="rounded-2xl border bg-white shadow-sm p-4">
                <h3 className="text-lg font-semibold">Faits rapides</h3>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Fact title="Distance" value={formatRange(aggregates.min_dist, aggregates.max_dist, " km")} />
                  <Fact title="D+" value={formatRange(aggregates.min_dplus, aggregates.max_dplus, " m")} />
                  <Fact title="Prochaine date" value={aggregates.next_date ? fmtDate(aggregates.next_date) : "—"} />
                  <Fact title="Repas" value={aggregates.has_repas ? "Disponible" : "—"} Icon={UtensilsCrossed} />
                </div>
              </div>

              {/* Partage */}
              <div className="rounded-2xl border bg-white shadow-sm p-4">
                <h3 className="text-lg font-semibold">Partager</h3>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={() => copyShare(shareUrl)}
                    className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                  >
                    <Share2 className="w-4 h-4" />
                    Copier le lien
                  </button>
                  <div className="ml-auto">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                        shareUrl
                      )}`}
                      alt="QR de partage"
                      className="rounded-md border"
                      width={120}
                      height={120}
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>

              {/* Bénévoles */}
              <div className="rounded-2xl border bg-white shadow-sm p-4">
                <h3 className="text-lg font-semibold">Bénévoles</h3>
                <p className="mt-2 text-sm text-neutral-600">
                  Un peu de temps libre ? Donnez un coup de main à l’organisation.
                </p>
                <Link
                  to={`/benevoles/${course.id}`}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-white text-sm font-semibold hover:brightness-110"
                >
                  Proposer mon aide <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Alerte hors-ligne pour l'organisateur */}
              {!course.en_ligne && course.organisateur_id === session?.user?.id && (
                <div className="rounded-2xl border bg-amber-50 text-amber-900 shadow-sm p-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    <span>Cette épreuve est en </span>
                    <strong>brouillon</strong>
                    <span> (hors-ligne).</span>
                  </div>
                  <Link
                    to={`/modifier-course/${course.id}`}
                    className="inline-flex items-center gap-2 mt-3 rounded-xl bg-amber-600 px-3 py-2 text-white text-sm font-semibold hover:bg-amber-700"
                  >
                    Modifier l’épreuve
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Message d’erreur éventuel */}
        {error && (
          <div className="mt-8 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== Sous-composants & utilitaires UI ===== */

function Badge({ text, color = "gray" }) {
  const bg = {
    emerald: "bg-emerald-100/90 text-emerald-800",
    amber: "bg-amber-100/90 text-amber-800",
    rose: "bg-rose-100/90 text-rose-800",
    blue: "bg-blue-100/90 text-blue-800",
    gray: "bg-neutral-200/90 text-neutral-800",
  }[color];
  return <span className={`rounded-full px-3 py-1 text-[12px] font-medium ${bg}`}>{text}</span>;
}

function Fact({ title, value, Icon }) {
  return (
    <div className="rounded-xl border bg-white p-3 text-center">
      {Icon ? <Icon className="w-4 h-4 mx-auto text-neutral-700" /> : null}
      <div className="text-[11px] text-neutral-500 mt-1">{title}</div>
      <div className="text-sm font-semibold text-neutral-900">{value || "—"}</div>
    </div>
  );
}

function formatRange(min, max, unit = "") {
  if (min == null && max == null) return "—";
  if (min != null && max != null) {
    if (min === max) return `${Math.round(min)}${unit}`;
    return `${Math.round(min)}–${Math.round(max)}${unit}`;
  }
  if (min != null) return `≥ ${Math.round(min)}${unit}`;
  return `≤ ${Math.round(max)}${unit}`;
}

function EmptyBox({ text }) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-neutral-600">
      {text}
    </div>
  );
}

function FormatsTable({ courseId, formats, countsByFormat }) {
  if (!formats?.length) return null;
  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-neutral-50 text-neutral-700">
          <tr>
            <th className="text-left px-4 py-3">Format</th>
            <th className="text-left px-4 py-3">Date</th>
            <th className="text-left px-4 py-3">Distance</th>
            <th className="text-left px-4 py-3">D+ / D-</th>
            <th className="text-left px-4 py-3">Places</th>
            <th className="text-left px-4 py-3">Prix</th>
            <th className="text-right px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {formats.map((f, idx) => {
            const max = Number(f.nb_max_coureurs) || null;
            const inscrit = Number(countsByFormat?.[f.id] || 0);
            const remaining = max ? Math.max(0, max - inscrit) : null;
            const full = max ? inscrit >= max : false;

            return (
              <tr key={f.id} className={idx % 2 ? "bg-white" : "bg-neutral-50/50"}>
                <td className="px-4 py-3 font-medium text-neutral-900">{f.nom}</td>
                <td className="px-4 py-3 text-neutral-700">
                  {f.date ? fmtDate(f.date) : "—"}
                  {f.heure_depart ? ` • ${f.heure_depart}` : ""}
                </td>
                <td className="px-4 py-3 text-neutral-700">{numOrDash(f.distance_km)} km</td>
                <td className="px-4 py-3 text-neutral-700">
                  {numOrDash(f.denivele_dplus)} / {numOrDash(f.denivele_dmoins)} m
                </td>
                <td className="px-4 py-3 text-neutral-700">
                  {max ? (
                    <>
                      {inscrit} / {max}{" "}
                      {remaining !== null && remaining <= 10 && !full && (
                        <span className="ml-1 text-amber-700 font-medium">
                          ({remaining} restantes)
                        </span>
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-neutral-900">
                  {Number.isFinite(Number(f.prix)) ? `${Number(f.prix).toFixed(2)} €` : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  {full ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-[11px] font-medium text-rose-800">
                      Complet
                    </span>
                  ) : (
                    <Link
                      to={`/inscription/${courseId}?format=${f.id}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-white text-sm font-semibold hover:brightness-110"
                    >
                      S’inscrire <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function numOrDash(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : "—";
}

/* ===== Détails format (onglet Infos) ===== */

function Chips({ items }) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {list.map((it, i) => (
        <span
          key={`${it}-${i}`}
          className="inline-flex items-center rounded-full bg-neutral-100 text-neutral-800 px-3 py-1 text-[12px] font-medium"
        >
          {it}
        </span>
      ))}
    </div>
  );
}

function asList(text) {
  if (!text) return [];
  // accepte séparateurs \n, ; ou ,
  return String(text)
    .split(/\r?\n|[;,]/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function SectionCard({ title, subtitle, children }) {
  return (
    <div className="rounded-2xl border bg-white shadow-sm p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-neutral-500">{subtitle}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function InfoItem({ icon, label, children }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0">
        <InfoIcon name={icon} className="w-4 h-4 text-neutral-700" />
      </div>
      <div className="min-w-0">
        <div className="text-[13px] text-neutral-600">{label}</div>
        <div className="text-sm font-medium text-neutral-900">{children}</div>
      </div>
    </div>
  );
}

function InfoIcon({ name, className }) {
  switch (name) {
    case "calendar":
      return <CalendarDays className={className} />;
    case "start":
      return <MapPin className={className} />;
    case "finish":
      return <MapPin className={className} />;
    case "shield":
      return <ShieldIcon className={className} />;
    case "euro":
      return <EuroIcon className={className} />;
    case "meal":
      return <UtensilsCrossed className={className} />;
    case "trophy":
      return <TrophyIcon className={className} />;
    case "bottle":
      return <BottleIcon className={className} />;
    case "id":
      return <IdIcon className={className} />;
    case "file":
      return <FileIcon className={className} />;
    case "bed":
      return <BedIcon className={className} />;
    default:
      return <div className={className} />;
  }
}

// Icônes minimalistes en SVG inline (pour éviter d’ajouter d’autres imports)
function ShieldIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="M12 3l7 4v5a7 7 0 0 1-7 7 7 7 0 0 1-7-7V7l7-4z" />
    </svg>
  );
}
function EuroIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="M4 10h11M4 14h11" />
      <path d="M17 5a7 7 0 0 0-7 7 7 7 0 0 0 7 7" />
    </svg>
  );
}
function TrophyIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-5 5 5 5 0 0 1-5-5V4z" />
      <path d="M5 6h2v2a3 3 0 0 1-3 3H3V8a2 2 0 0 1 2-2z" />
      <path d="M19 6h-2v2a3 3 0 0 0 3 3h1V8a2 2 0 0 0-2-2z" />
    </svg>
  );
}
function BottleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="M10 2h4v3a2 2 0 0 1-2 2 2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2" />
    </svg>
  );
}
function IdIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="M13 14h5M13 10h5M7 14h4" />
    </svg>
  );
}
function FileIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}
function BedIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="M3 7v10M21 7v10" />
      <path d="M3 11h18" />
      <path d="M7 11V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function MapLink({ address }) {
  if (!address) return null;
  const href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="ml-2 inline-flex items-center text-[12px] text-neutral-500 hover:text-neutral-800 underline underline-offset-2"
    >
      (Voir sur Maps)
    </a>
  );
}
