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

const SoftTag = ({ children }) => (
  <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 ring-1 ring-neutral-200">
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

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // 1..7 (lundi..dimanche)
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

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
  const [simExtras, setSimExtras] = useState(3); // panier moyen options
  const [simStripe, setSimStripe] = useState("eu"); // eu | international

  const goOrganizer = () => {
    if (!session?.user) navigate("/login");
    else navigate("/organisateur/mon-espace");
  };

  // À LA UNE : rotation hebdo entre tes 4 images du dossier public/
  const featured = useMemo(() => {
    const now = new Date();
    const week = getISOWeek(now);
    const images = ["/OIP.jpg", "/OIP2.jpg", "/OIP3.jpg", "/OIP4.jpg"];
    const imageSrc = images[week % images.length];

    return {
      tag: "À LA UNE",
      title: "Article & photo de la semaine",
      excerpt:
        "Ici, tu mettras un contenu qui change chaque semaine : actu, conseils, sélection de courses, focus organisateur…",
      editionLabel: `Semaine du ${fmtDate(now)}`,
      ctaLabel: "Lire",
      href: "#",
      imageSrc,
    };
  }, []);

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

      {/* À LA UNE — bandeau full width */}
      <section className="py-6 sm:py-8">
        <Container>
          <Card className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
              <div className="flex items-start gap-3 flex-1">
                <div className="relative">
                  <img
                    src={featured.imageSrc}
                    alt="À la une"
                    className="h-16 w-16 rounded-2xl object-cover ring-1 ring-neutral-200 bg-neutral-100"
                    loading="lazy"
                  />
                  <span className="absolute -top-2 -left-2 rounded-full bg-lime-400 px-2 py-1 text-[10px] font-black text-neutral-900 ring-1 ring-neutral-200">
                    {featured.tag}
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <SoftTag>{featured.editionLabel}</SoftTag>
                    <SoftTag>Mise à jour hebdo</SoftTag>
                    <SoftTag>Site en cours de développement</SoftTag>
                  </div>
                  <div className="mt-2 text-base sm:text-lg font-black leading-snug">
                    {featured.title}
                  </div>
                  <p className="mt-1 text-sm text-neutral-600 line-clamp-2">
                    {featured.excerpt}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <CTA href={featured.href} className="px-4 py-2 rounded-xl">
                  {featured.ctaLabel} <ArrowRight className="h-4 w-4" />
                </CTA>
                <Link
                  to="/contact"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-800 ring-1 ring-neutral-200 hover:bg-neutral-50"
                >
                  Partenariat
                </Link>
              </div>
            </div>
          </Card>
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
                <Link
                  to="/courses"
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-neutral-800 ring-1 ring-neutral-200 hover:bg-neutral-50"
                >
                  Voir la carte
                </Link>
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
                    <h3 className="text-base font-bold leading-snug line-clamp-1">{r.nom}</h3>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500">
                      <MapPin className="h-3.5 w-3.5" /> {r.lieu} ({r.departement})
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

      {/* 3 BLOCS ÉGAUX */}
      <section className="py-10 sm:py-14 bg-white">
        <Container>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
                Une plateforme pour organiser et courir
              </h2>
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
            {/* Organisateur */}
            <Card className="p-6 h-full">
              <h3 className="text-xl font-black">Publiez votre course en quelques minutes</h3>
              <p className="mt-2 text-sm text-neutral-600">
                Page dédiée, inscriptions, quotas, options, reversements automatiques. Fini les tableaux Excel.
              </p>
              <ul className="mt-4 grid gap-2 text-sm text-neutral-700">
                <li className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-orange-500" /> Multi-formats & quotas par format
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-orange-500" /> Paiements Stripe & reversements
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-orange-500" /> Annulation en ligne (crédit / remboursement)
                </li>
              </ul>
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
                <Badge>Reversement J+1</Badge>
              </div>
            </Card>

            {/* Chat (étoffé) */}
            <Card className="p-6 h-full">
              <h3 className="text-xl font-black">Discutez sous chaque épreuve</h3>
              <p className="mt-2 text-sm text-neutral-600">
                Questions, covoiturage, entraide. Mentionnez <span className="font-semibold">@IA</span> pour une réponse rapide.
              </p>

              <div className="mt-4 rounded-2xl bg-neutral-50 ring-1 ring-neutral-200 p-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 shrink-0 rounded-full bg-orange-200" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold">Léa</div>
                      <div className="text-sm text-neutral-700">Quel dénivelé cumulé sur le 32K ?</div>
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
                    <div className="h-9 w-9 shrink-0 rounded-full bg-orange-200" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold">Marco</div>
                      <div className="text-sm text-neutral-700">Il y a des ravitos eau / solide ?</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 shrink-0 rounded-full bg-neutral-200" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold">@IA</div>
                      <div className="text-sm text-neutral-700">Oui : points d’eau + ravitos principaux (selon fiche course).</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 shrink-0 rounded-full bg-orange-200" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold">Anaïs</div>
                      <div className="text-sm text-neutral-700">Barrières horaires ? Départ à quelle heure ?</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 shrink-0 rounded-full bg-neutral-200" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold">Organisateur</div>
                      <div className="text-sm text-neutral-700">Toutes les infos seront publiées ici + notification aux inscrits.</div>
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
                  ~ {fmtEUR(sim.netParInscrit)} / inscrit • reversements automatiques à J+1
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

          {/* ✅ Feature cards agrandies */}
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
                <Link to="/fonctionnalites" className="text-sm font-semibold text-neutral-800 hover:underline">
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
