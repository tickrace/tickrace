// src/pages/Home.jsx
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Mountain,
  CalendarDays,
  MapPin,
  Sparkles,
  Star,
  ArrowRight,
  MessageCircle,
  Settings,
  Map,
  Tag,
  Undo2,
  Users,
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

const Pill = ({ children }) => (
  <span className="inline-flex items-center gap-2 rounded-full bg-neutral-900/70 ring-1 ring-white/10 px-3 py-1 text-xs text-white">
    <Sparkles className="h-3.5 w-3.5" /> {children}
  </span>
);

const CTA = ({ children, to, href, className = "" }) =>
  href ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={[
        "inline-flex items-center gap-2 rounded-2xl bg-lime-400 px-5 py-3 text-sm font-semibold text-neutral-900 shadow-sm hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-lime-300 active:translate-y-px",
        className,
      ].join(" ")}
    >
      {children}
    </a>
  ) : (
    <Link
      to={to || "#"}
      className={[
        "inline-flex items-center gap-2 rounded-2xl bg-lime-400 px-5 py-3 text-sm font-semibold text-neutral-900 shadow-sm hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-lime-300 active:translate-y-px",
        className,
      ].join(" ")}
    >
      {children}
    </Link>
  );

const Card = ({ children, className = "" }) => (
  <div
    className={[
      "rounded-2xl bg-white shadow-lg shadow-neutral-900/5 ring-1 ring-neutral-200",
      className,
    ].join(" ")}
  >
    {children}
  </div>
);

const Badge = ({ children }) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-medium text-neutral-700 ring-1 ring-neutral-200">
    {children}
  </span>
);

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

  // Prochaines courses (3) triées chronologiquement (par prochaine date)
  const [upcoming3, setUpcoming3] = useState([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);

  // Simulateur (home)
  const [simParticipants, setSimParticipants] = useState(250);
  const [simPrix, setSimPrix] = useState(25);
  const [simExtras, setSimExtras] = useState(3); // panier moyen options
  const [simStripe, setSimStripe] = useState("eu"); // eu | international

  // Search quick inputs (optionnels, non bloquants)
  const [homeLieu, setHomeLieu] = useState("");
  const [homeDate, setHomeDate] = useState("");
  const [homeDist, setHomeDist] = useState("");

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

    // Estimation Stripe (par transaction)
    // UE : 1,4% + 0,25€
    // International : 2,9% + 0,25€
    const stripePct = simStripe === "international" ? 0.029 : 0.014;
    const stripeFixe = 0.25;
    const fraisStripe = brut * stripePct + n * stripeFixe;

    const netOrganisateur = Math.max(0, brut - commissionTickrace - fraisStripe);

    return {
      n,
      prix,
      extras,
      totalParInscrit,
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

          // course full = tous les formats full (close_on_full + max)
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

        // garder uniquement les courses à venir (avec next_date)
        const onlyUpcoming = normalized
          .filter((c) => parseDate(c.next_date))
          .sort((a, b) => (parseDate(a.next_date)?.getTime() ?? Infinity) - (parseDate(b.next_date)?.getTime() ?? Infinity))
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
    // On garde simple : on redirige vers /courses avec q et from si renseignés
    const sp = new URLSearchParams();
    if (homeLieu.trim()) sp.set("q", homeLieu.trim());
    if (homeDate) sp.set("from", homeDate);
    // distance bucket (optionnel, simple mapping)
    if (homeDist === "<10") sp.set("dist", "0-15");
    if (homeDist === "10-20") sp.set("dist", "0-15");
    if (homeDist === "20-40") sp.set("dist", "15-30");
    if (homeDist === ">40") sp.set("dist", "30+");
    navigate(`/courses?${sp.toString()}`);
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_0%,#fdba74_0%,transparent_60%)]" />
        <Container className="py-14 sm:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Pill>Nouvelle V1 — Carte interactive, chat & annulation simplifiée</Pill>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-neutral-900 ring-1 ring-neutral-200">
                  Bêta — site en cours de développement
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl font-black leading-tight tracking-tight">
                Inscris-toi, organise, cours. <span className="text-orange-600">Une seule plateforme.</span>
              </h1>

              <p className="text-neutral-600 max-w-xl">
                TickRace centralise la création d’épreuves, l’inscription coureurs, le chat communautaire,
                la gestion des bénévoles et les reversements automatiques (en 2 temps).
              </p>

              <div className="flex flex-wrap gap-3 pt-1">
                <CTA to="/courses">
                  <ArrowRight className="h-4 w-4" /> Trouver une course
                </CTA>
                <button
                  onClick={goOrganizer}
                  className="inline-flex items-center gap-2 rounded-2xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-neutral-300 active:translate-y-px"
                >
                  <Settings className="h-4 w-4" /> Je suis organisateur
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-neutral-500">
                <Badge>
                  <Star className="h-3.5 w-3.5" /> 5% frais plateforme organisateur
                </Badge>
                <Badge>Reversements automatiques en 2 temps</Badge>
                <Badge>Annulation en ligne par le coureur</Badge>
                <Badge>
                  <MessageCircle className="h-3.5 w-3.5" /> Chat épreuves avec IA
                </Badge>
              </div>

              <div className="text-[11px] text-neutral-500">
                Reversements : acompte (50%) à partir de J+7 après paiement, puis solde à partir de J+2 après la course.
                Délais indicatifs selon Stripe, contrôles et banques.
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="relative"
            >
              <div className="aspect-[4/3] overflow-hidden rounded-3xl ring-1 ring-neutral-200 shadow-xl">
                <img src="/home.png" alt="Coureurs sur TickRace" className="h-full w-full object-cover" />
              </div>
            </motion.div>
          </div>
        </Container>
      </section>

      {/* À LA UNE — géré par le composant */}
      <ALaUneSection />

      {/* SEARCH + 3 PROCHAINES COURSES */}
      <section id="courses" className="py-8 sm:py-12">
        <Container>
          <Card className="p-4 sm:p-6">
            <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
              <div className="grid flex-1 grid-cols-1 sm:grid-cols-3 gap-3">
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

              <div className="flex gap-3">
                <button
                  onClick={onHomeSearch}
                  className="inline-flex items-center gap-2 rounded-2xl bg-lime-400 px-5 py-3 text-sm font-semibold text-neutral-900 shadow-sm hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-lime-300 active:translate-y-px"
                >
                  <ArrowRight className="h-4 w-4" /> Rechercher
                </button>
                <Link
                  to="/courses"
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-neutral-800 ring-1 ring-neutral-200 hover:bg-neutral-50"
                >
                  Voir la carte
                </Link>
              </div>
            </div>
          </Card>

          <div className="mt-6 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Prochaines épreuves</h2>
              <p className="mt-1 text-sm text-neutral-600">Les 3 prochaines courses à venir, triées par date.</p>
            </div>
            <Link to="/courses" className="text-sm font-semibold text-neutral-800 hover:underline">
              Voir toutes les courses →
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {loadingUpcoming ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse overflow-hidden rounded-2xl ring-1 ring-neutral-200 bg-white"
                >
                  <div className="h-44 w-full bg-neutral-100" />
                  <div className="p-4 space-y-3">
                    <div className="h-5 w-2/3 bg-neutral-100 rounded" />
                    <div className="h-4 w-1/3 bg-neutral-100 rounded" />
                    <div className="h-4 w-1/2 bg-neutral-100 rounded" />
                    <div className="h-8 w-full bg-neutral-100 rounded mt-4" />
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
        </Container>
      </section>

      {/* 3 BLOCS ÉGAUX */}
      <section className="py-10 sm:py-14 bg-white">
        <Container>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Une plateforme pour organiser et courir</h2>
              <p className="mt-2 text-neutral-600 max-w-2xl">
                Des outils clairs, une expérience moderne, et une page d’accueil qui évolue grâce à “À LA UNE”.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={goOrganizer}
                className="inline-flex items-center gap-2 rounded-2xl bg-lime-400 px-4 py-2 text-sm font-semibold text-neutral-900 shadow-sm hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-lime-300"
              >
                <Settings className="h-4 w-4" /> Espace organisateur
              </button>
              <Link
                to="/courses"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-neutral-800 ring-1 ring-neutral-200 hover:bg-neutral-50"
              >
                Voir les courses
              </Link>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Organisateur — ultra premium (KPI simulés, pas “réels”) */}
            <Card className="p-6 h-full">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black">Publiez votre course en quelques minutes</h3>
                  <p className="mt-2 text-sm text-neutral-600">
                    Un back-office clair pour centraliser : page épreuve, inscriptions, règlement, administratif,
                    communication, reversements et suivi compta.
                  </p>
                </div>
                <span className="shrink-0 inline-flex items-center rounded-full bg-orange-50 px-3 py-1 text-[11px] font-semibold text-orange-700 ring-1 ring-orange-200">
                  Mode organisateur • Premium UI
                </span>
              </div>

              {/* Mini-dashboard (aperçu) — chiffres non “réels” */}
              <div className="mt-4 rounded-2xl bg-neutral-50 ring-1 ring-neutral-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-neutral-500">Mini-dashboard (aperçu)</div>
                    <div className="mt-0.5 text-sm font-semibold text-neutral-800">
                      Estimations & repères rapides
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700 ring-1 ring-neutral-200">
                    Bêta
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="rounded-xl bg-white ring-1 ring-neutral-200 p-3">
                    <div className="text-[11px] text-neutral-500">Net / inscrit (simu)</div>
                    <div className="mt-0.5 text-base font-black">{fmtEUR(sim.netParInscrit)}</div>
                    <div className="mt-0.5 text-[11px] text-neutral-500">après 5% + frais paiement</div>
                  </div>

                  <div className="rounded-xl bg-white ring-1 ring-neutral-200 p-3">
                    <div className="text-[11px] text-neutral-500">Net total (simu)</div>
                    <div className="mt-0.5 text-base font-black">{fmtEUR(sim.netOrganisateur)}</div>
                    <div className="mt-0.5 text-[11px] text-neutral-500">{sim.n} inscrits • panier moyen</div>
                  </div>

                  <div className="rounded-xl bg-white ring-1 ring-neutral-200 p-3">
                    <div className="text-[11px] text-neutral-500">Prochaines épreuves</div>
                    <div className="mt-0.5 text-base font-black">{upcoming3.length}</div>
                    <div className="mt-0.5 text-[11px] text-neutral-500">affichées sur la home</div>
                  </div>

                  <div className="rounded-xl bg-white ring-1 ring-neutral-200 p-3">
                    <div className="text-[11px] text-neutral-500">Reversements</div>
                    <div className="mt-0.5 text-base font-black">J+7 • J+2</div>
                    <div className="mt-0.5 text-[11px] text-neutral-500">acompte 50% • solde après course</div>
                  </div>
                </div>

                <div className="mt-3 rounded-xl bg-white ring-1 ring-neutral-200 p-3">
                  <div className="flex items-center justify-between text-[11px] text-neutral-500">
                    <span>Pipeline organisateur</span>
                    <span className="font-semibold text-neutral-700">Créer → Publier → Inviter → Suivre</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                    <div className="h-full w-[72%] rounded-full bg-neutral-900" />
                  </div>
                  <div className="mt-1 text-[11px] text-neutral-500">
                    (Aperçu) chiffres illustratifs : le but est d’expliquer la logique, pas d’afficher de la compta réelle sur la home.
                  </div>
                </div>
              </div>

              {/* Workflow */}
              <div className="mt-4 rounded-2xl bg-white ring-1 ring-neutral-200 p-4">
                <div className="text-sm font-black text-neutral-900">Workflow</div>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  {[
                    { k: "1", t: "Créer", d: "formats, quotas, options" },
                    { k: "2", t: "Publier", d: "règlement, infos, page" },
                    { k: "3", t: "Inviter", d: "coureurs, groupes, emails" },
                    { k: "4", t: "Suivre", d: "paiements, factures, reversements" },
                  ].map((s) => (
                    <div key={s.k} className="rounded-xl bg-neutral-50 ring-1 ring-neutral-200 p-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-white text-xs font-black">
                          {s.k}
                        </span>
                        <div className="font-semibold">{s.t}</div>
                      </div>
                      <div className="mt-1 text-xs text-neutral-500">{s.d}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sections */}
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-2xl bg-white ring-1 ring-neutral-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-black text-neutral-900">Inscriptions & paiements</div>
                    <span className="text-[11px] font-semibold text-neutral-500">Opérationnel</span>
                  </div>
                  <ul className="mt-3 space-y-2 text-sm text-neutral-700">
                    <li className="flex items-start gap-2">
                      <span className="mt-2 h-2 w-2 rounded-full bg-orange-500" />
                      <span>
                        <span className="font-semibold">Multi-formats</span> : prix, distance, D+, quotas, ouverture/fermeture.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-2 h-2 w-2 rounded-full bg-orange-500" />
                      <span>
                        <span className="font-semibold">Stripe</span> : paiements + reversements (acompte / solde) + suivi.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-2 h-2 w-2 rounded-full bg-orange-500" />
                      <span>
                        <span className="font-semibold">Annulation en ligne</span> : calcul crédit/remboursement + traçabilité.
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="rounded-2xl bg-white ring-1 ring-neutral-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-black text-neutral-900">Admin & communication</div>
                    <span className="text-[11px] font-semibold text-neutral-500">Gain de temps</span>
                  </div>
                  <ul className="mt-3 space-y-2 text-sm text-neutral-700">
                    <li className="flex items-start gap-2">
                      <span className="mt-2 h-2 w-2 rounded-full bg-orange-500" />
                      <span>
                        <span className="font-semibold">Règlement assisté</span> : une version unique, propre, facile à maintenir.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-2 h-2 w-2 rounded-full bg-orange-500" />
                      <span>
                        <span className="font-semibold">Checklist administratif</span> : points clés, docs, rappels (sécurité, organisation).
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-2 h-2 w-2 rounded-full bg-orange-500" />
                      <span>
                        <span className="font-semibold">Invitations & mailing</span> : infos course, relances, messages de masse.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-2 h-2 w-2 rounded-full bg-orange-500" />
                      <span>
                        <span className="font-semibold">Compta & factures</span> : paiements, justificatifs, exports & traçabilité.
                      </span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* CTAs */}
              <div className="mt-6 flex gap-2">
                <button
                  onClick={goOrganizer}
                  className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
                >
                  Ouvrir l’espace <ArrowRight className="h-4 w-4" />
                </button>
                <Link
                  to="/fonctionnalites"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-800 ring-1 ring-neutral-200 hover:bg-neutral-50"
                >
                  Détails
                </Link>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Badge>5% Tickrace</Badge>
                <Badge>Acompte J+7 • solde J+2</Badge>
                <Badge>Règlement & checklist</Badge>
                <Badge>Invitations & mailing</Badge>
                <Badge>Factures & suivi</Badge>
              </div>
            </Card>

            {/* Chat — avec exemple étoffé */}
            <Card className="p-6 h-full">
              <h3 className="text-xl font-black">Discutez sous chaque épreuve</h3>
              <p className="mt-2 text-sm text-neutral-600">
                Questions, covoiturage, entraide. Mentionnez <span className="font-semibold">@IA</span> pour une réponse rapide.
              </p>

              <div className="mt-4 rounded-2xl bg-neutral-50 ring-1 ring-neutral-200 p-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 shrink-0 rounded-full bg-orange-200 ring-1 ring-orange-300/40" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">Léa</div>
                      <div className="text-sm text-neutral-700">Quel dénivelé cumulé sur le 32K ?</div>
                      <div className="text-[11px] text-neutral-400 mt-0.5">Il y a 3 min</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 shrink-0 rounded-full bg-neutral-200 ring-1 ring-neutral-300/50" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">@IA</div>
                      <div className="text-sm text-neutral-700">
                        Sur la fiche actuelle : <span className="font-semibold">+2630 m D+</span>. (Ça peut évoluer si l’organisateur met à jour la trace.)
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-0.5">Il y a 2 min</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 shrink-0 rounded-full bg-orange-200 ring-1 ring-orange-300/40" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">Marco</div>
                      <div className="text-sm text-neutral-700">Il y a des ravitos eau / solide ?</div>
                      <div className="text-[11px] text-neutral-400 mt-0.5">Il y a 1 min</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 shrink-0 rounded-full bg-neutral-200 ring-1 ring-neutral-300/50" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">@IA</div>
                      <div className="text-sm text-neutral-700">
                        Oui : points d’eau + ravitos principaux (selon la fiche et le règlement). Si tu veux, ping l’orga pour le détail.
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-0.5">À l’instant</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 shrink-0 rounded-full bg-neutral-200 ring-1 ring-neutral-300/50" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">Organisateur</div>
                      <div className="text-sm text-neutral-700">
                        Merci ! On publie le plan ravito + barrières horaires ce soir, et les inscrits seront notifiés.
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-0.5">À l’instant</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-2">
                <Link
                  to="/courses"
                  className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
                >
                  <MessageCircle className="h-4 w-4" /> Voir un chat <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/courses"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-800 ring-1 ring-neutral-200 hover:bg-neutral-50"
                >
                  Trouver une course
                </Link>
              </div>
            </Card>

            {/* Simulateur */}
            <Card className="p-6 h-full">
              <h3 className="text-xl font-black">Simulateur de gains organisateur</h3>
              <p className="mt-2 text-sm text-neutral-600">
                Estimation rapide : 5% Tickrace + frais de paiement estimés (Stripe).
              </p>

              <div className="mt-4 rounded-2xl bg-neutral-50 ring-1 ring-neutral-200 p-4">
                <div className="text-xs font-semibold text-neutral-500">Net organisateur (estimation)</div>
                <div className="mt-1 text-2xl font-black">{fmtEUR(sim.netOrganisateur)}</div>
                <div className="mt-1 text-xs text-neutral-500">
                  ~ {fmtEUR(sim.netParInscrit)} / inscrit • reversements automatiques (J+7 / J+2)
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3">
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

                  <div className="mt-1 text-sm">
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
              </div>

              <div className="mt-6 flex gap-2">
                <button
                  onClick={goOrganizer}
                  className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
                >
                  Ouvrir l’espace <ArrowRight className="h-4 w-4" />
                </button>
                <Link
                  to="/fonctionnalites"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-800 ring-1 ring-neutral-200 hover:bg-neutral-50"
                >
                  Comprendre le modèle
                </Link>
              </div>
            </Card>
          </div>

          {/* Feature cards */}
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="rounded-2xl bg-neutral-50 ring-1 ring-neutral-200 p-5 min-h-[190px] flex flex-col">
              <div className="flex items-center gap-2 text-neutral-900">
                <Map className="h-5 w-5" />
                <div className="text-base font-black">Carte interactive</div>
              </div>
              <p className="mt-2 text-sm text-neutral-600">
                Trouve une course en un coup d’œil : liste + carte, filtres et recherche.
              </p>
              <ul className="mt-3 text-sm text-neutral-700 space-y-1">
                <li>• Localisation, date, distance, D+.</li>
                <li>• Accès rapide à la fiche et à l’inscription.</li>
              </ul>
              <div className="mt-auto pt-4">
                <Link to="/courses" className="text-sm font-semibold text-neutral-800 hover:underline">
                  Explorer les courses →
                </Link>
              </div>
            </div>

            <div className="rounded-2xl bg-neutral-50 ring-1 ring-neutral-200 p-5 min-h-[190px] flex flex-col">
              <div className="flex items-center gap-2 text-neutral-900">
                <Tag className="h-5 w-5" />
                <div className="text-base font-black">Options & promos</div>
              </div>
              <p className="mt-2 text-sm text-neutral-600">
                Vends simplement des extras (repas, navette, textile…) et gère des codes promo.
              </p>
              <ul className="mt-3 text-sm text-neutral-700 space-y-1">
                <li>• Catalogue d’options, quantités, quotas.</li>
                <li>• Codes promo par format / public cible.</li>
              </ul>
              <div className="mt-auto pt-4">
                <Link to="/fonctionnalites" className="text-sm font-semibold text-neutral-800 hover:underline">
                  Voir les options →
                </Link>
              </div>
            </div>

            <div className="rounded-2xl bg-neutral-50 ring-1 ring-neutral-200 p-5 min-h-[190px] flex flex-col">
              <div className="flex items-center gap-2 text-neutral-900">
                <Undo2 className="h-5 w-5" />
                <div className="text-base font-black">Annulation simple</div>
              </div>
              <p className="mt-2 text-sm text-neutral-600">
                Le coureur annule en ligne, et Tickrace calcule automatiquement le crédit / remboursement.
              </p>
              <ul className="mt-3 text-sm text-neutral-700 space-y-1">
                <li>• Règles selon J-xx, frais, options incluses.</li>
                <li>• Traçabilité et statut côté organisateur.</li>
              </ul>
              <div className="mt-auto pt-4">
                <Link to="/legal/remboursements" className="text-sm font-semibold text-neutral-800 hover:underline">
                  Comprendre l’annulation →
                </Link>
              </div>
            </div>

            <div className="rounded-2xl bg-neutral-50 ring-1 ring-neutral-200 p-5 min-h-[190px] flex flex-col">
              <div className="flex items-center gap-2 text-neutral-900">
                <Users className="h-5 w-5" />
                <div className="text-base font-black">Bénévoles</div>
              </div>
              <p className="mt-2 text-sm text-neutral-600">
                Simplifie la gestion des missions : inscriptions, planning, points de passage (roadmap).
              </p>
              <ul className="mt-3 text-sm text-neutral-700 space-y-1">
                <li>• Affectations & communication équipe.</li>
                <li>• Suivi sur mobile sur le terrain (V2+).</li>
              </ul>
              <div className="mt-auto pt-4">
                <Link to="/fonctionnalites" className="text-sm font-semibold text-neutral-800 hover:underline">
                  Découvrir la roadmap →
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}

/* ============================ Home Course Card ============================ */
/* Card alignée sur Courses.jsx (badges, overlay, CTA) */
function CourseCardHome({ course }) {
  const soon =
    course.next_date &&
    (parseDate(course.next_date).getTime() - new Date().getTime()) / 86400000 <= 14;

  return (
    <div className="group overflow-hidden rounded-2xl ring-1 ring-neutral-200 bg-white shadow-sm hover:shadow-md transition-shadow">
      {/* Image */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-neutral-100">
        {course.image_url ? (
          <img
            src={course.image_url}
            alt={`Image de ${course.nom}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-neutral-400 text-sm">
            Pas d’image
          </div>
        )}

        {/* Badges */}
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

        {/* Mini compteur places */}
        <div className="absolute right-3 bottom-3">
          <InscriptionPlacesBadge format={course.next_format} style="overlay" />
        </div>
      </div>

      {/* Infos */}
      <div className="p-4">
        <h3 className="line-clamp-1 text-lg font-semibold">{course.nom}</h3>

        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-600">
          <span>
            📍 {course.lieu} {course.departement ? `(${course.departement})` : ""}
          </span>
          {course.next_date && <span>📅 {fmtDate(course.next_date)}</span>}
        </div>

        <div className="mt-2 text-sm text-neutral-700 space-y-1">
          {course.min_dist != null && course.max_dist != null && (
            <div>
              Distance :{" "}
              <strong>
                {Math.round(course.min_dist)}–{Math.round(course.max_dist)} km
              </strong>
            </div>
          )}
          {course.min_dplus != null && course.max_dplus != null && (
            <div>
              D+ :{" "}
              <strong>
                {Math.round(course.min_dplus)}–{Math.round(course.max_dplus)} m
              </strong>
            </div>
          )}
          {course.min_prix != null && (
            <div>
              À partir de <strong>{Number(course.min_prix).toFixed(2)} €</strong>
            </div>
          )}
        </div>

        {/* CTAs */}
        <div className="mt-4 flex flex-col gap-2">
          <Link
            to={`/courses/${course.id}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 text-white text-sm font-semibold hover:brightness-110"
            title="Voir l'épreuve"
          >
            Voir l’épreuve ↗
          </Link>

          <div className="grid grid-cols-2 gap-2">
            <Link
              to={`/inscription/${course.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
              title="S'inscrire"
            >
              S’inscrire
            </Link>

            <Link
              to={`/benevoles/${course.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
              title="S’inscrire comme bénévole"
            >
              Bénévoles
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
