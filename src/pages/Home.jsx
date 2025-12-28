// src/pages/Home.jsx
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarDays,
  MapPin,
  MessageCircle,
  Mountain,
  Settings,
  Sparkles,
  Star,
  Users,
  ShieldCheck,
  FileText,
  Mail,
  Receipt,
  CheckCircle2,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";
import ALaUneSection from "../components/home/ALaUneSection";

import { InscriptionPlacesBadge, InscriptionStatusBadge } from "../components/InscriptionBadges";

/* ----------------------------- UI helpers ----------------------------- */
const Container = ({ children, className = "" }) => (
  <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
);

const Card = ({ children, className = "" }) => (
  <div className={["rounded-2xl bg-white ring-1 ring-neutral-200 shadow-sm", className].join(" ")}>
    {children}
  </div>
);

const Badge = ({ children, className = "" }) => (
  <span
    className={[
      "inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-700 ring-1 ring-neutral-200",
      className,
    ].join(" ")}
  >
    {children}
  </span>
);

const CTA = ({ children, to, onClick, variant = "primary", className = "" }) => {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition active:translate-y-px focus:outline-none focus:ring-2";
  const styles =
    variant === "primary"
      ? "bg-lime-400 text-neutral-900 shadow-sm hover:brightness-95 focus:ring-lime-300"
      : variant === "dark"
      ? "bg-neutral-900 text-white shadow-sm hover:brightness-110 focus:ring-neutral-300"
      : "bg-white text-neutral-800 ring-1 ring-neutral-200 hover:bg-neutral-50 focus:ring-neutral-200";
  const cls = [base, styles, className].join(" ");

  if (onClick) return <button onClick={onClick} className={cls}>{children}</button>;
  return (
    <Link to={to || "#"} className={cls}>
      {children}
    </Link>
  );
};

/* ----------------------------- Utils ----------------------------- */
const parseDate = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const fmtDate = (d) =>
  d
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(typeof d === "string" ? new Date(d) : d)
    : "";

const fmtEUR = (n) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(Number(n || 0));

const todayStart = () => new Date(new Date().toDateString());

/* ============================ Page ============================ */
export default function Home() {
  const navigate = useNavigate();
  const { session } = useUser();

  // 3 prochaines courses (tri chrono)
  const [upcoming3, setUpcoming3] = useState([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);

  // Recherche rapide (redirige vers /courses)
  const [homeLieu, setHomeLieu] = useState("");
  const [homeDate, setHomeDate] = useState("");
  const [homeDist, setHomeDist] = useState("");

  // Simulateur (compact)
  const [showSimDetails, setShowSimDetails] = useState(false);
  const [simParticipants, setSimParticipants] = useState(250);
  const [simPrix, setSimPrix] = useState(25);
  const [simExtras, setSimExtras] = useState(3);
  const [simStripe, setSimStripe] = useState("eu"); // eu | international

  const goOrganizer = () => {
    if (!session?.user) navigate("/login");
    else navigate("/organisateur/mon-espace");
  };

  const sim = useMemo(() => {
    const n = Math.max(0, Number(simParticipants || 0));
    const prix = Math.max(0, Number(simPrix || 0));
    const extras = Math.max(0, Number(simExtras || 0));

    const totalParInscrit = prix + extras;
    const brut = n * totalParInscrit;

    const commissionTickrace = brut * 0.05;

    // UE : 1,4% + 0,25€ / tx ; International : 2,9% + 0,25€ / tx
    const stripePct = simStripe === "international" ? 0.029 : 0.014;
    const stripeFixe = 0.25;
    const fraisStripe = brut * stripePct + n * stripeFixe;

    const netOrganisateur = Math.max(0, brut - commissionTickrace - fraisStripe);

    return {
      n,
      brut,
      commissionTickrace,
      fraisStripe,
      netOrganisateur,
      netParInscrit: n > 0 ? netOrganisateur / n : 0,
    };
  }, [simParticipants, simPrix, simExtras, simStripe]);

  /* -------- Charger les 3 prochaines épreuves (chrono) -------- */
  useEffect(() => {
    (async () => {
      setLoadingUpcoming(true);
      try {
        const { data, error } = await supabase
          .from("courses")
          .select(
            `
            id,
            nom,
            lieu,
            departement,
            created_at,
            image_url,
            formats (
              id,
              course_id,
              nom,
              type_epreuve,
              date,
              prix,
              distance_km,
              denivele_dplus,
              nb_max_coureurs,
              nb_inscrits,
              inscription_ouverture,
              inscription_fermeture,
              close_on_full
            )
          `
          )
          .eq("en_ligne", true);

        if (error) throw error;

        const t0 = todayStart();

        const normalized = (data || []).map((c) => {
          const fList = Array.isArray(c.formats) ? c.formats : [];
          const sorted = [...fList].sort((a, b) => {
            const ta = parseDate(a.date)?.getTime() ?? Infinity;
            const tb = parseDate(b.date)?.getTime() ?? Infinity;
            return ta - tb;
          });

          const upcoming = sorted.filter((f) => {
            const d = parseDate(f.date);
            return d && d >= t0;
          });

          const nextFormat = upcoming[0] || null;
          const nextDate = nextFormat?.date || null;

          const prices = sorted.map((f) => Number(f.prix)).filter((n) => Number.isFinite(n));
          const dists = sorted.map((f) => Number(f.distance_km)).filter((n) => Number.isFinite(n));
          const dplus = sorted.map((f) => Number(f.denivele_dplus)).filter((n) => Number.isFinite(n));

          const minPrix = prices.length ? Math.min(...prices) : null;
          const minDist = dists.length ? Math.min(...dists) : null;
          const maxDist = dists.length ? Math.max(...dists) : null;
          const minDplus = dplus.length ? Math.min(...dplus) : null;
          const maxDplus = dplus.length ? Math.max(...dplus) : null;

          let isFull = false;
          if (sorted.length) {
            isFull = sorted.every((f) => {
              const max = Number(f.nb_max_coureurs);
              if (!max || Number.isNaN(max)) return false;
              const count = Number(f.nb_inscrits || 0);
              const closeOnFull = f.close_on_full !== false;
              if (!closeOnFull) return false;
              return count >= max;
            });
          }

          const createdAt = parseDate(c.created_at);
          const isNew = createdAt ? (Date.now() - createdAt.getTime()) / 86400000 < 14 : false;

          return {
            ...c,
            formats: sorted,
            next_format: nextFormat,
            next_date: nextDate,
            min_prix: minPrix,
            min_dist: minDist,
            max_dist: maxDist,
            min_dplus: minDplus,
            max_dplus: maxDplus,
            is_full: isFull,
            is_new: isNew,
            has_multiple_formats: sorted.length > 1,
          };
        });

        const onlyUpcoming = normalized
          .filter((c) => parseDate(c.next_date))
          .sort(
            (a, b) =>
              (parseDate(a.next_date)?.getTime() ?? Infinity) -
              (parseDate(b.next_date)?.getTime() ?? Infinity)
          )
          .slice(0, 3);

        setUpcoming3(onlyUpcoming);
      } catch (e) {
        console.error(e);
        setUpcoming3([]);
      } finally {
        setLoadingUpcoming(false);
      }
    })();
  }, []);

  const onHomeSearch = () => {
    const sp = new URLSearchParams();
    if (homeLieu.trim()) sp.set("q", homeLieu.trim());
    if (homeDate) sp.set("from", homeDate);
    // mapping simple vers buckets /courses
    if (homeDist === "<10") sp.set("dist", "0-15");
    if (homeDist === "10-20") sp.set("dist", "0-15");
    if (homeDist === "20-40") sp.set("dist", "15-30");
    if (homeDist === ">40") sp.set("dist", "30+");
    navigate(`/courses?${sp.toString()}`);
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* HERO (clean, respirant) */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(55%_55%_at_50%_0%,#fdba74_0%,transparent_60%)]" />
        <Container className="py-14 sm:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
              className="space-y-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-neutral-900/70 px-3 py-1 text-xs text-white ring-1 ring-white/10">
                  <Sparkles className="h-3.5 w-3.5" />
                  V1 — inscriptions, chat, bénévoles, reversements
                </span>
                <span className="inline-flex items-center rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-neutral-900 ring-1 ring-neutral-200">
                  Bêta — site en cours de développement
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl font-black leading-tight tracking-tight">
                Trouve une course.{" "}
                <span className="text-orange-600">Ou publie la tienne.</span>
              </h1>

              <p className="text-neutral-600 max-w-xl">
                TickRace centralise la création d’épreuves, l’inscription, le règlement, les messages coureurs,
                la gestion bénévoles et les reversements automatiques.
              </p>

              <div className="flex flex-wrap gap-3">
                <CTA to="/courses" variant="primary">
                  <ArrowRight className="h-4 w-4" /> Explorer les courses
                </CTA>
                <CTA onClick={goOrganizer} variant="dark">
                  <Settings className="h-4 w-4" /> Espace organisateur
                </CTA>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge>
                  <Star className="h-3.5 w-3.5" /> 5% plateforme
                </Badge>
                <Badge>Reversements J+7 / J+2</Badge>
                <Badge>
                  <MessageCircle className="h-3.5 w-3.5" /> Chat sous épreuve
                </Badge>
              </div>

              <div className="text-[11px] text-neutral-500">
                Reversements indicatifs : acompte (50%) à partir de J+7 après paiement, puis solde à partir de J+2 après la course.
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08 }}
              className="relative"
            >
              <div className="aspect-[4/3] overflow-hidden rounded-3xl ring-1 ring-neutral-200 shadow-xl bg-white">
                <img src="/home.png" alt="Coureurs sur TickRace" className="h-full w-full object-cover" />
              </div>

              {/* petite carte flottante (sobre) */}
              <div className="absolute -bottom-5 left-5 right-5 hidden sm:block">
                <div className="rounded-2xl bg-white ring-1 ring-neutral-200 shadow-sm px-4 py-3 flex items-center justify-between">
                  <div className="text-sm font-semibold text-neutral-900">Prochaine étape</div>
                  <div className="text-sm text-neutral-600">Découvrir les 3 prochaines épreuves</div>
                </div>
              </div>
            </motion.div>
          </div>
        </Container>
      </section>

      {/* À LA UNE */}
      <ALaUneSection />

      {/* Recherche + Prochaines épreuves (simple, premium) */}
      <section className="py-10 sm:py-14">
        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* recherche */}
            <Card className="p-5 lg:col-span-5">
              <div className="text-sm font-black text-neutral-900">Recherche rapide</div>
              <p className="mt-1 text-sm text-neutral-600">
                Une recherche simple — puis tous les filtres avancés sur la page Courses.
              </p>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-neutral-600">Lieu</label>
                  <div className="mt-1 flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2">
                    <MapPin className="h-4 w-4 text-neutral-400" />
                    <input
                      value={homeLieu}
                      onChange={(e) => setHomeLieu(e.target.value)}
                      className="w-full bg-transparent text-sm outline-none"
                      placeholder="Ville, région, département…"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-neutral-600">À partir du</label>
                    <div className="mt-1 flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2">
                      <CalendarDays className="h-4 w-4 text-neutral-400" />
                      <input
                        type="date"
                        value={homeDate}
                        onChange={(e) => setHomeDate(e.target.value)}
                        className="w-full bg-transparent text-sm outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-neutral-600">Distance</label>
                    <select
                      value={homeDist}
                      onChange={(e) => setHomeDist(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">—</option>
                      <option value="<10">&lt; 10 km</option>
                      <option value="10-20">10–20 km</option>
                      <option value="20-40">20–40 km</option>
                      <option value=">40">&gt; 40 km</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <CTA onClick={onHomeSearch} variant="primary" className="flex-1">
                    <ArrowRight className="h-4 w-4" /> Rechercher
                  </CTA>
                  <CTA to="/courses" variant="secondary" className="flex-1">
                    Voir la carte
                  </CTA>
                </div>
              </div>
            </Card>

            {/* prochaines épreuves */}
            <div className="lg:col-span-7">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-neutral-900">Prochaines épreuves</div>
                  <p className="mt-1 text-sm text-neutral-600">
                    Les 3 prochaines courses à venir, triées par date.
                  </p>
                </div>
                <Link to="/courses" className="text-sm font-semibold text-neutral-800 hover:underline">
                  Voir toutes →
                </Link>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {loadingUpcoming ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="animate-pulse overflow-hidden rounded-2xl ring-1 ring-neutral-200 bg-white"
                    >
                      <div className="h-40 w-full bg-neutral-100" />
                      <div className="p-4 space-y-3">
                        <div className="h-5 w-2/3 bg-neutral-100 rounded" />
                        <div className="h-4 w-1/2 bg-neutral-100 rounded" />
                        <div className="h-8 w-full bg-neutral-100 rounded mt-2" />
                      </div>
                    </div>
                  ))
                ) : upcoming3.length === 0 ? (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <Card className="p-6 text-center text-neutral-600">
                      Aucune épreuve à venir n’est en ligne pour le moment.
                    </Card>
                  </div>
                ) : (
                  upcoming3.map((c) => <CourseCardHome key={c.id} course={c} />)
                )}
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Valeur (pro, lisible) */}
      <section className="py-10 sm:py-14 bg-white">
        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Organisateur */}
            <div className="lg:col-span-7">
              <Card className="p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                      Une suite organisateur <span className="text-orange-600">simple & pro</span>
                    </h2>
                    <p className="mt-2 text-sm text-neutral-600">
                      Tout est pensé pour réduire l’administratif : un flux clair, des outils intégrés,
                      et une traçabilité propre.
                    </p>
                  </div>
                  <Badge className="bg-orange-50 text-orange-700 ring-orange-200">
                    <Sparkles className="h-3.5 w-3.5" /> Ultra premium
                  </Badge>
                </div>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-neutral-50 ring-1 ring-neutral-200 p-4">
                    <div className="flex items-center gap-2 font-semibold text-neutral-900">
                      <CheckCircle2 className="h-4 w-4" /> Créer & publier
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                      <li>• Multi-formats, quotas, options & codes promo.</li>
                      <li>• Page publique propre (partage, QR, etc.).</li>
                      <li>• Règlement assisté + checklist.</li>
                    </ul>
                  </div>

                  <div className="rounded-2xl bg-neutral-50 ring-1 ring-neutral-200 p-4">
                    <div className="flex items-center gap-2 font-semibold text-neutral-900">
                      <Mail className="h-4 w-4" /> Communiquer
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                      <li>• Invitations coureurs & relances.</li>
                      <li>• Mailing de masse aux inscrits.</li>
                      <li>• Messages post-course (infos, résultats, etc.).</li>
                    </ul>
                  </div>

                  <div className="rounded-2xl bg-neutral-50 ring-1 ring-neutral-200 p-4">
                    <div className="flex items-center gap-2 font-semibold text-neutral-900">
                      <Receipt className="h-4 w-4" /> Suivi & compta
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                      <li>• Paiements & reversements (J+7 / J+2).</li>
                      <li>• Factures / justificatifs (roadmap).</li>
                      <li>• Historique clair, anti erreurs.</li>
                    </ul>
                  </div>

                  <div className="rounded-2xl bg-neutral-50 ring-1 ring-neutral-200 p-4">
                    <div className="flex items-center gap-2 font-semibold text-neutral-900">
                      <ShieldCheck className="h-4 w-4" /> Confiance
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                      <li>• Annulation en ligne (crédit / remboursement).</li>
                      <li>• Traçabilité & statuts.</li>
                      <li>• Expérience coureur moderne.</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  <Badge>5% Tickrace</Badge>
                  <Badge>Reversements J+7 / J+2</Badge>
                  <Badge>Règlement + checklist</Badge>
                  <Badge>Invitations & mailing</Badge>
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  <CTA onClick={goOrganizer} variant="dark">
                    <Settings className="h-4 w-4" /> Ouvrir l’espace
                  </CTA>
                  <CTA to="/fonctionnalites" variant="secondary">
                    Détails
                  </CTA>
                </div>
              </Card>
            </div>

            {/* Côté coureur + simulateur compact */}
            <div className="lg:col-span-5 space-y-6">
              <Card className="p-6">
                <h3 className="text-lg font-black">Côté coureur</h3>
                <p className="mt-2 text-sm text-neutral-600">
                  Inscription claire, infos à jour, et échanges sous l’épreuve.
                </p>

                <div className="mt-4 rounded-2xl bg-neutral-50 ring-1 ring-neutral-200 p-4">
                  <div className="flex items-center gap-2 font-semibold text-neutral-900">
                    <Users className="h-4 w-4" /> Communauté
                  </div>
                  <p className="mt-2 text-sm text-neutral-700">
                    Pose une question, organise un covoit’, et mentionne <span className="font-semibold">@IA</span> si besoin.
                  </p>

                  <div className="mt-4 flex gap-2">
                    <CTA to="/courses" variant="dark" className="flex-1">
                      <MessageCircle className="h-4 w-4" /> Voir une épreuve
                    </CTA>
                    <CTA to="/courses" variant="secondary" className="flex-1">
                      Trouver une course
                    </CTA>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge>Inscription en ligne</Badge>
                  <Badge>Annulation simple</Badge>
                  <Badge>Chat épreuve</Badge>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black">Simulateur organisateur</h3>
                    <p className="mt-1 text-sm text-neutral-600">
                      Aperçu rapide : 5% Tickrace + frais de paiement estimés.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowSimDetails((v) => !v)}
                    className="text-sm font-semibold text-neutral-800 hover:underline"
                  >
                    {showSimDetails ? "Réduire" : "Détails"}
                  </button>
                </div>

                <div className="mt-4 rounded-2xl bg-neutral-50 ring-1 ring-neutral-200 p-4">
                  <div className="text-xs font-semibold text-neutral-500">Net organisateur (estimation)</div>
                  <div className="mt-1 text-2xl font-black">{fmtEUR(sim.netOrganisateur)}</div>
                  <div className="mt-1 text-xs text-neutral-500">~ {fmtEUR(sim.netParInscrit)} / inscrit</div>

                  {showSimDetails && (
                    <div className="mt-4 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-xs font-semibold text-neutral-600">
                          Inscrits
                          <input
                            type="number"
                            min={0}
                            step={10}
                            value={simParticipants}
                            onChange={(e) => setSimParticipants(Number(e.target.value || 0))}
                            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                          />
                        </label>
                        <label className="text-xs font-semibold text-neutral-600">
                          Prix inscription
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={simPrix}
                            onChange={(e) => setSimPrix(Number(e.target.value || 0))}
                            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                          />
                        </label>
                      </div>

                      <label className="text-xs font-semibold text-neutral-600">
                        Panier options (moyenne)
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={simExtras}
                          onChange={(e) => setSimExtras(Number(e.target.value || 0))}
                          className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                        />
                      </label>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSimStripe("eu")}
                          className={[
                            "flex-1 rounded-xl px-3 py-2 text-sm font-semibold ring-1",
                            simStripe === "eu"
                              ? "bg-neutral-900 text-white ring-neutral-900"
                              : "bg-white text-neutral-800 ring-neutral-200 hover:bg-neutral-50",
                          ].join(" ")}
                        >
                          Carte UE
                        </button>
                        <button
                          type="button"
                          onClick={() => setSimStripe("international")}
                          className={[
                            "flex-1 rounded-xl px-3 py-2 text-sm font-semibold ring-1",
                            simStripe === "international"
                              ? "bg-neutral-900 text-white ring-neutral-900"
                              : "bg-white text-neutral-800 ring-neutral-200 hover:bg-neutral-50",
                          ].join(" ")}
                        >
                          International
                        </button>
                      </div>

                      <div className="text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-600">Total encaissé</span>
                          <span className="font-semibold">{fmtEUR(sim.brut)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-600">Commission Tickrace (5%)</span>
                          <span className="font-semibold">-{fmtEUR(sim.commissionTickrace)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-600">Frais paiement estimés</span>
                          <span className="font-semibold">-{fmtEUR(sim.fraisStripe)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex gap-2">
                  <CTA onClick={goOrganizer} variant="dark" className="flex-1">
                    <Settings className="h-4 w-4" /> Espace organisateur
                  </CTA>
                  <CTA to="/fonctionnalites" variant="secondary" className="flex-1">
                    Comprendre
                  </CTA>
                </div>
              </Card>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}

/* ============================ Course card (home) ============================ */
/* Alignée à Courses.jsx mais plus “calme” (CTA plus simple) */
function CourseCardHome({ course }) {
  const soon =
    course.next_date &&
    (parseDate(course.next_date).getTime() - new Date().getTime()) / 86400000 <= 14;

  return (
    <div className="group overflow-hidden rounded-2xl ring-1 ring-neutral-200 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-neutral-100">
        {course.image_url ? (
          <img
            src={course.image_url}
            alt={`Image de ${course.nom}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="h-full w-full grid place-items-center text-neutral-400">
            <Mountain className="h-6 w-6" />
          </div>
        )}

        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {soon && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
              Bientôt
            </span>
          )}

          <InscriptionStatusBadge
            format={course.next_format}
            isFullOverride={course.is_full}
            prefix="Inscriptions"
          />

          {course.has_multiple_formats && (
            <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-medium text-sky-700">
              Multi-formats
            </span>
          )}

          {course.is_new && (
            <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-medium text-orange-700">
              Nouveau
            </span>
          )}
        </div>

        <div className="absolute right-3 bottom-3">
          <InscriptionPlacesBadge format={course.next_format} style="overlay" />
        </div>
      </div>

      <div className="p-4">
        <h3 className="line-clamp-1 text-base font-bold">{course.nom}</h3>

        <div className="mt-1 text-sm text-neutral-600">
          📍 {course.lieu} {course.departement ? `(${course.departement})` : ""}
        </div>

        {course.next_date && <div className="mt-1 text-sm text-neutral-600">📅 {fmtDate(course.next_date)}</div>}

        <div className="mt-3 text-sm text-neutral-700 space-y-1">
          {course.min_dist != null && course.max_dist != null && (
            <div>
              <strong>{Math.round(course.min_dist)}–{Math.round(course.max_dist)} km</strong>
            </div>
          )}
          {course.min_dplus != null && course.max_dplus != null && (
            <div>
              <strong>{Math.round(course.min_dplus)}–{Math.round(course.max_dplus)} m D+</strong>
            </div>
          )}
          {course.min_prix != null && (
            <div className="text-neutral-700">
              À partir de <strong>{Number(course.min_prix).toFixed(2)} €</strong>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            to={`/courses/${course.id}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 text-white text-sm font-semibold hover:brightness-110"
          >
            Voir ↗
          </Link>
          <Link
            to={`/inscription/${course.id}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
          >
            S’inscrire
          </Link>
        </div>
      </div>
    </div>
  );
}
