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
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";

// --- Mini helpers
const Container = ({ children, className = "" }) => (
  <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>
    {children}
  </div>
);

const Pill = ({ children }) => (
  <span className="inline-flex items-center gap-2 rounded-full bg-neutral-900/70 ring-1 ring-white/10 px-3 py-1 text-xs text-white">
    <Sparkles className="h-3.5 w-3.5" /> {children}
  </span>
);

const CTA = ({ children, to, href }) =>
  href ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-2xl bg-lime-400 px-5 py-3 text-sm font-semibold text-neutral-900 shadow-sm hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-lime-300 active:translate-y-px"
    >
      {children}
    </a>
  ) : (
    <Link
      to={to || "#"}
      className="inline-flex items-center gap-2 rounded-2xl bg-lime-400 px-5 py-3 text-sm font-semibold text-neutral-900 shadow-sm hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-lime-300 active:translate-y-px"
    >
      {children}
    </Link>
  );

const Ghost = ({ children, to, href }) =>
  href ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-2xl bg-white/5 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
    >
      {children}
    </a>
  ) : (
    <Link
      to={to || "#"}
      className="inline-flex items-center gap-2 rounded-2xl bg-white/5 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
    >
      {children}
    </Link>
  );

const Card = ({ children, className = "" }) => (
  <div
    className={`rounded-2xl bg-white shadow-lg shadow-neutral-900/5 ring-1 ring-neutral-200 ${className}`}
  >
    {children}
  </div>
);

const Badge = ({ children }) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-medium text-neutral-700 ring-1 ring-neutral-200">
    {children}
  </span>
);

// --- Utils
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

// ============================
// Page
// ============================
export default function Home() {
  const navigate = useNavigate();
  const { session } = useUser();

  const [latest, setLatest] = useState([]);
  const [loading, setLoading] = useState(true);

  // Simulateur (home)
  const [simParticipants, setSimParticipants] = useState(250);
  const [simPrix, setSimPrix] = useState(25);
  const [simExtras, setSimExtras] = useState(3); // options / panier moyen
  const [simStripe, setSimStripe] = useState("eu"); // eu | international

  const featured = useMemo(() => {
    const now = new Date();
    return {
      tag: "À LA UNE",
      title: "L’article de la semaine arrive sur TickRace",
      excerpt:
        "Bientôt : une sélection éditoriale (actu, conseils, nouveautés, coups de cœur) qui changera chaque semaine sur la page d’accueil.",
      editionLabel: `Édition du ${fmtDate(now)}`,
      ctaLabel: "Découvrir",
      href: "#",
    };
  }, []);

  const goOrganizer = () => {
    if (!session?.user) {
      navigate("/login");
    } else {
      navigate("/organisateur/mon-espace");
    }
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
      stripePct,
      stripeFixe,
    };
  }, [simParticipants, simPrix, simExtras, simStripe]);

  // Charger 3 dernières courses en ligne
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("courses")
          .select("id, nom, lieu, departement, created_at, image_url")
          .eq("en_ligne", true)
          .order("created_at", { ascending: false })
          .limit(3);
        if (error) throw error;

        // On ramène aussi des infos de formats pour distance/d+
        const ids = (data || []).map((c) => c.id);
        let byCourse = {};
        if (ids.length) {
          const { data: fmts } = await supabase
            .from("formats")
            .select("course_id, date, distance_km, denivele_dplus")
            .in("course_id", ids);

          (fmts || []).forEach((f) => {
            (byCourse[f.course_id] = byCourse[f.course_id] || []).push(f);
          });
        }

        const decorated = (data || []).map((c) => {
          const f = byCourse[c.id] || [];
          const dists = f.map((x) => Number(x.distance_km)).filter((n) => Number.isFinite(n));
          const dplus = f.map((x) => Number(x.denivele_dplus)).filter((n) => Number.isFinite(n));
          const nextDate = f
            .map((x) => x.date)
            .filter(Boolean)
            .sort((a, b) => new Date(a) - new Date(b))[0];

          return {
            ...c,
            nextDate: nextDate || null,
            minDist: dists.length ? Math.min(...dists) : null,
            maxDist: dists.length ? Math.max(...dists) : null,
            minDplus: dplus.length ? Math.min(...dplus) : null,
            maxDplus: dplus.length ? Math.max(...dplus) : null,
          };
        });

        setLatest(decorated);
      } catch (e) {
        console.error(e);
        setLatest([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
                Inscris-toi, organise, cours.{" "}
                <span className="text-orange-600">Une seule plateforme.</span>
              </h1>
              <p className="text-neutral-600 max-w-xl">
                TickRace centralise la création d’épreuves, l’inscription coureurs, le chat
                communautaire, la gestion des bénévoles et les reversements automatiques.
                Une solution pensée pour simplifier la vie des organisateurs et des coureurs.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <CTA to="/courses">
                  <ArrowRight className="h-4 w-4" /> Trouver une course
                </CTA>
                <button
                  onClick={goOrganizer}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white/5 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
                >
                  <Settings className="h-4 w-4" /> Je suis organisateur
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-neutral-500">
                <Badge>
                  <Star className="h-3.5 w-3.5" /> 5% frais plateforme organisateur
                </Badge>
                <Badge>Reversements automatiques à J+1</Badge>
                <Badge>Annulation en ligne par le coureur</Badge>
                <Badge>
                  <MessageCircle className="h-3.5 w-3.5" /> Chat épreuves avec IA
                </Badge>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="relative"
            >
              <div className="aspect-[4/3] overflow-hidden rounded-3xl ring-1 ring-neutral-200 shadow-xl">
                <img
                  src="/home.png"
                  alt="Coureurs sur TickRace"
                  className="h-full w-full object-cover"
                />
              </div>
            </motion.div>
          </div>
        </Container>
      </section>

      {/* SEARCH + DERNIÈRES COURSES */}
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
                      className="w-full bg-transparent text-sm outline-none"
                      placeholder="Ville, région…"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-neutral-600">Date</label>
                  <div className="mt-1 flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2">
                    <CalendarDays className="h-4 w-4 text-neutral-400" />
                    <input type="date" className="w-full bg-transparent text-sm outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-neutral-600">Distance</label>
                  <select className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm">
                    <option>—</option>
                    <option>&lt; 10 km</option>
                    <option>10–20 km</option>
                    <option>20–40 km</option>
                    <option>&gt; 40 km</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <CTA to="/courses">
                  <ArrowRight className="h-4 w-4" /> Rechercher
                </CTA>
                <Ghost to="/courses">Voir la carte</Ghost>
              </div>
            </div>
          </Card>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="overflow-hidden animate-pulse">
                  <div className="h-44 w-full bg-neutral-100" />
                  <div className="p-4 space-y-2">
                    <div className="h-5 w-2/3 bg-neutral-100 rounded" />
                    <div className="h-4 w-1/3 bg-neutral-100 rounded" />
                    <div className="h-4 w-1/2 bg-neutral-100 rounded" />
                  </div>
                </Card>
              ))
            ) : latest.length === 0 ? (
              <div className="sm:col-span-2 lg:col-span-3">
                <Card className="p-6 text-center text-neutral-600">
                  Aucune épreuve en ligne pour le moment.
                </Card>
              </div>
            ) : (
              latest.map((r) => (
                <Card key={r.id} className="overflow-hidden">
                  <div className="relative">
                    {r.image_url ? (
                      <img src={r.image_url} alt={r.nom} className="h-44 w-full object-cover" />
                    ) : (
                      <div className="h-44 w-full grid place-items-center bg-neutral-100 text-neutral-400">
                        <Mountain className="h-6 w-6" />
                      </div>
                    )}
                    {r.nextDate && (
                      <div className="absolute left-3 top-3">
                        <span className="rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold ring-1 ring-neutral-200">
                          {fmtDate(r.nextDate)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold leading-snug line-clamp-1">{r.nom}</h3>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500">
                          <MapPin className="h-3.5 w-3.5" /> {r.lieu} ({r.departement})
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-3 text-sm">
                      {r.minDist != null && r.maxDist != null && (
                        <Badge>
                          {Math.round(r.minDist)}–{Math.round(r.maxDist)} km
                        </Badge>
                      )}
                      {r.minDplus != null && r.maxDplus != null && (
                        <Badge>
                          {Math.round(r.minDplus)}–{Math.round(r.maxDplus)} m D+
                        </Badge>
                      )}
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <Link
                        to={`/inscription/${r.id}`}
                        className="rounded-xl bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:brightness-110"
                      >
                        S'inscrire
                      </Link>
                      <Link
                        to={`/courses/${r.id}`}
                        className="text-sm font-semibold text-neutral-700 hover:underline"
                      >
                        Voir la fiche
                      </Link>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </Container>
      </section>

      {/* ORGANISER + COMMUNITY (regroupés) */}
      <section id="org" className="py-12 sm:py-16 bg-white">
        {/* ✅ IMPORTANT: items-start pour supprimer les grands vides */}
        <Container className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
          >
            <h2 className="text-3xl sm:4xl font-black tracking-tight">
              Publiez votre course en quelques minutes
            </h2>
            <p className="mt-3 text-neutral-600 max-w-xl">
              Créez une page dédiée, gérez les inscriptions, les bénévoles, les reversements
              automatiques et le chat sous l’épreuve. Tout est pensé pour gagner du temps
              et limiter les fichiers Excel.
            </p>
            <ul className="mt-5 grid gap-2 text-sm text-neutral-700">
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-orange-500" /> Multi-formats
                (individuel, groupe, relais) & quotas par format
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-orange-500" /> Paiements Stripe &
                reversements automatiques à J+1
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-orange-500" /> Annulation en ligne
                par le coureur, avec crédit / remboursement calculé automatiquement
              </li>
            </ul>
            <div className="mt-6 flex gap-3">
              <button
                onClick={goOrganizer}
                className="inline-flex items-center gap-2 rounded-2xl bg-lime-400 px-5 py-3 text-sm font-semibold text-neutral-900 shadow-sm hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-lime-300 active:translate-y-px"
              >
                <Settings className="h-4 w-4" /> Accéder à l'espace organisateur
              </button>
              <Ghost to="/fonctionnalites">Voir toutes les fonctionnalités</Ghost>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
          >
            <Card className="p-6">
              <div className="grid grid-cols-2 gap-4">
                {/* À LA UNE */}
                <div className="col-span-2 overflow-hidden rounded-2xl ring-1 ring-neutral-200 bg-neutral-900 text-white">
                  <div className="grid grid-cols-1 sm:grid-cols-5">
                    <div className="sm:col-span-2 relative">
                      <div className="h-40 sm:h-full w-full bg-[radial-gradient(90%_80%_at_20%_0%,#fb923c_0%,transparent_55%),radial-gradient(80%_70%_at_90%_30%,#a3e635_0%,transparent_55%),linear-gradient(135deg,#0a0a0a_0%,#171717_55%,#0a0a0a_100%)]" />
                      <div className="absolute inset-0 grid place-items-center text-white/70 text-xs font-semibold">
                        Image hebdo (à venir)
                      </div>
                      <div className="absolute left-3 top-3">
                        <span className="inline-flex items-center rounded-full bg-lime-400 px-3 py-1 text-[11px] font-black text-neutral-900">
                          {featured.tag}
                        </span>
                      </div>
                    </div>

                    <div className="sm:col-span-3 p-4 sm:p-5">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
                        <span className="rounded-full bg-white/10 px-2 py-1 ring-1 ring-white/10">
                          Mise à jour hebdo
                        </span>
                        <span className="rounded-full bg-white/10 px-2 py-1 ring-1 ring-white/10">
                          Site en cours de développement
                        </span>
                        <span className="rounded-full bg-white/10 px-2 py-1 ring-1 ring-white/10">
                          {featured.editionLabel}
                        </span>
                      </div>

                      <h3 className="mt-3 text-xl sm:text-2xl font-black leading-tight">
                        {featured.title}
                      </h3>
                      <p className="mt-2 text-sm text-white/80 max-w-xl">{featured.excerpt}</p>

                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <a
                          href={featured.href}
                          className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:brightness-95"
                        >
                          {featured.ctaLabel} <ArrowRight className="h-4 w-4" />
                        </a>
                        <button
                          type="button"
                          onClick={() => {}}
                          className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/15"
                        >
                          Proposer un partenariat
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SIMULATEUR */}
                <div className="rounded-xl bg-neutral-50 p-4 ring-1 ring-neutral-200 col-span-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-neutral-500">
                        Simulateur de gains (estimation)
                      </div>
                      <div className="mt-1 text-lg font-bold">
                        Net organisateur : {fmtEUR(sim.netOrganisateur)}
                      </div>
                      <div className="mt-1 text-xs text-neutral-500">
                        Inclut 5% Tickrace + frais de paiement estimés (Stripe). Reversements automatiques à J+1.
                      </div>
                    </div>
                    <button
                      onClick={goOrganizer}
                      className="shrink-0 rounded-xl bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:brightness-110"
                    >
                      Ouvrir l’espace
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white p-3 ring-1 ring-neutral-200">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-neutral-600">Inscrits</div>
                        <div className="text-xs font-semibold text-neutral-900">{sim.n}</div>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={3000}
                        step={10}
                        value={simParticipants}
                        onChange={(e) => setSimParticipants(Number(e.target.value))}
                        className="mt-2 w-full"
                      />
                      <div className="mt-2 flex gap-2">
                        <input
                          type="number"
                          min={0}
                          step={10}
                          value={simParticipants}
                          onChange={(e) => setSimParticipants(Number(e.target.value || 0))}
                          className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                        />
                      </div>
                    </div>

                    <div className="rounded-xl bg-white p-3 ring-1 ring-neutral-200">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-neutral-600">
                          Prix moyen inscription
                        </div>
                        <div className="text-xs font-semibold text-neutral-900">
                          {fmtEUR(sim.prix)}
                        </div>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={120}
                        step={1}
                        value={simPrix}
                        onChange={(e) => setSimPrix(Number(e.target.value))}
                        className="mt-2 w-full"
                      />
                      <div className="mt-2 flex gap-2">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={simPrix}
                          onChange={(e) => setSimPrix(Number(e.target.value || 0))}
                          className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                        />
                      </div>
                    </div>

                    <div className="rounded-xl bg-white p-3 ring-1 ring-neutral-200">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-neutral-600">
                          Panier moyen options
                        </div>
                        <div className="text-xs font-semibold text-neutral-900">
                          {fmtEUR(sim.extras)}
                        </div>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={40}
                        step={1}
                        value={simExtras}
                        onChange={(e) => setSimExtras(Number(e.target.value))}
                        className="mt-2 w-full"
                      />
                      <div className="mt-2 flex gap-2">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={simExtras}
                          onChange={(e) => setSimExtras(Number(e.target.value || 0))}
                          className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                        />
                      </div>
                    </div>

                    <div className="rounded-xl bg-white p-3 ring-1 ring-neutral-200">
                      <div className="text-xs font-semibold text-neutral-600">
                        Paiement (estimation)
                      </div>
                      <div className="mt-2 flex gap-2">
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
                      <div className="mt-2 text-xs text-neutral-500">
                        {simStripe === "international"
                          ? "Estimation : 2,9% + 0,25€ / paiement"
                          : "Estimation : 1,4% + 0,25€ / paiement"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white p-3 ring-1 ring-neutral-200">
                      <div className="text-xs font-semibold text-neutral-600">Détail</div>
                      <div className="mt-2 space-y-1 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-600">Total encaissé</span>
                          <span className="font-semibold">{fmtEUR(sim.brut)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-600">Commission Tickrace (5%)</span>
                          <span className="font-semibold">-{fmtEUR(sim.commissionTickrace)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-600">Frais de paiement estimés</span>
                          <span className="font-semibold">-{fmtEUR(sim.fraisStripe)}</span>
                        </div>
                        <div className="mt-2 border-t border-neutral-200 pt-2 flex items-center justify-between">
                          <span className="text-neutral-900 font-semibold">Net organisateur</span>
                          <span className="text-neutral-900 font-black">
                            {fmtEUR(sim.netOrganisateur)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-white p-3 ring-1 ring-neutral-200">
                      <div className="text-xs font-semibold text-neutral-600">Lecture rapide</div>
                      <div className="mt-2 text-sm text-neutral-700 space-y-1">
                        <div className="flex items-center justify-between">
                          <span>Recette / inscrit (moyenne)</span>
                          <span className="font-semibold">{fmtEUR(sim.totalParInscrit)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Net / inscrit (moyenne)</span>
                          <span className="font-semibold">{fmtEUR(sim.netParInscrit)}</span>
                        </div>
                        <div className="mt-2 text-xs text-neutral-500">
                          Estimation indicative. Le détail réel (options, coupons, annulations, remboursements)
                          est calculé dans l’espace organisateur.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reversements */}
                <div className="rounded-xl bg-neutral-50 p-4 ring-1 ring-neutral-200 col-span-2">
                  <div className="text-xs font-semibold text-neutral-500">Reversements</div>
                  <div className="mt-2 flex items-center justify-between">
                    <div>
                      <div className="text-lg font-bold">95% automatique à J+1</div>
                      <div className="text-xs text-neutral-500">Acompte sur demande</div>
                    </div>
                    <a
                      href="https://www.tickrace.com/monprofilorganisateur"
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:brightness-110"
                    >
                      Configurer
                    </a>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        </Container>

        {/* CHAT juste en dessous */}
        <Container className="mt-12">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45 }}
            >
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
                Discutez sous chaque épreuve
              </h2>
              <p className="mt-2 text-neutral-600 max-w-xl">
                Posez vos questions, organisez du covoiturage, et mentionnez l{"' "}
                <span className="font-semibold">@IA</span> pour obtenir des infos instantanées
                sur le parcours, l’équipement ou le ravito.
              </p>
              <div className="mt-6 flex gap-3">
                <Ghost to="/courses">Voir un exemple</Ghost>
                <CTA to="/courses">
                  <MessageCircle className="h-4 w-4" /> Ouvrir un chat
                </CTA>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45 }}
            >
              <Card className="p-6">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-orange-300 to-amber-300" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold">Léa</div>
                      <div className="text-sm text-neutral-700">
                        Quel dénivelé cumulé sur le 32K ?
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 shrink-0 rounded-full bg-neutral-200" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold">@IA</div>
                      <div className="text-sm text-neutral-700">+2630 m D+</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 shrink-0 rounded-full bg-neutral-200" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold">Marco</div>
                      <div className="text-sm text-neutral-700">
                        Des passages techniques ?
                        <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] ring-1 ring-neutral-200">
                          Skyrace
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        </Container>
      </section>
    </div>
  );
}
