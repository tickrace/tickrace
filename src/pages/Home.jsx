// src/pages/Home.jsx
import React, { useEffect, useMemo, useState, Suspense } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Mountain,
  CalendarDays,
  MapPin,
  Sparkles,
  Star,
  ArrowRight,
  MessageCircle,
  Settings,
  User2,
} from "lucide-react";
import { supabase } from "../supabase";

// --- Mini helpers (mêmes styles que la maquette)
const Container = ({ children, className = "" }) => (
  <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
);
const Pill = ({ children }) => (
  <span className="inline-flex items-center gap-2 rounded-full bg-neutral-900/70 ring-1 ring-white/10 px-3 py-1 text-xs text-white">
    <Sparkles className="h-3.5 w-3.5" /> {children}
  </span>
);
const CTA = ({ children, as: As = "button", ...props }) => (
  <As
    {...props}
    className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-orange-300 active:translate-y-px"
  >
    {children}
  </As>
);
const Ghost = ({ children, as: As = "button", ...props }) => (
  <As
    {...props}
    className="inline-flex items-center gap-2 rounded-2xl bg-white/5 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
  >
    {children}
  </As>
);
const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl bg-white shadow-lg shadow-neutral-900/5 ring-1 ring-neutral-200 ${className}`}>{children}</div>
);
const Badge = ({ children }) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-medium text-neutral-700 ring-1 ring-neutral-200">
    {children}
  </span>
);

// utils
const parseDate = (d) => (d ? new Date(d) : null);
const fmtDate = (d) =>
  d
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(typeof d === "string" ? new Date(d) : d)
    : "";

// ===== Page
export default function Home() {
  // données “vraies” pour le bloc 3 dernières créations
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [formatsByCourse, setFormatsByCourse] = useState({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      // 1) Dernières courses publiées (ou toutes si tu préfères)
      const { data: lastCourses, error } = await supabase
        .from("courses")
        .select("id, nom, lieu, departement, created_at, image_url, en_ligne")
      .eq("en_ligne", true) 
        .order("created_at", { ascending: false })
        .limit(3);
      if (error) {
        console.error(error);
        setCourses([]);
        setFormatsByCourse({});
        setLoading(false);
        return;
      }
      setCourses(lastCourses || []);

      // 2) Formats pour ces courses (pour afficher date/distance/D+)
      const ids = (lastCourses || []).map((c) => c.id);
      if (!ids.length) {
        setFormatsByCourse({});
        setLoading(false);
        return;
      }
      const { data: fmts, error: e2 } = await supabase
        .from("formats")
        .select("id, course_id, nom, date, distance_km, denivele_dplus, prix")
        .in("course_id", ids);
      if (e2) {
        console.error(e2);
        setFormatsByCourse({});
        setLoading(false);
        return;
      }
      const map = {};
      (fmts || []).forEach((f) => {
        (map[f.course_id] = map[f.course_id] || []).push(f);
      });
      // trie local par date croissante
      Object.keys(map).forEach((k) =>
        map[k].sort(
          (a, b) =>
            (parseDate(a.date)?.getTime() || Infinity) -
            (parseDate(b.date)?.getTime() || Infinity)
        )
      );
      setFormatsByCourse(map);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* ⚠️ Pas de navbar ici, tu utilises ta Navbar globale */}

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_0%,#fed7aa_0%,transparent_60%)]" />
        <Container className="py-14 sm:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-4"
            >
              <Pill>Nouvelle V1 — Carte interactive & Chat épreuves</Pill>
              <h1 className="text-4xl sm:text-5xl font-black leading-tight tracking-tight">
                Inscris-toi, organise, cours.{" "}
                <span className="text-orange-600">Une seule plateforme.</span>
              </h1>
              <p className="text-neutral-600 max-w-xl">
                TickRace centralise la création d’épreuves, l’inscription coureurs, le chat communautaire,
                et la synchronisation Strava. Une solution moderne pensée pour la performance et la simplicité.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <CTA as={Link} to="/courses">
                  <ArrowRight className="h-4 w-4" /> Trouver une course
                </CTA>
                <Ghost as={Link} to="/organisateur/mon-espace">
                  <Settings className="h-4 w-4" /> Je suis organisateur
                </Ghost>
              </div>
              <div className="flex items-center gap-3 pt-2 text-xs text-neutral-500">
                <Badge>
                  <Star className="h-3.5 w-3.5" /> 5% frais plateforme organisateur
                </Badge>
                <Badge>
                  <User2 className="h-3.5 w-3.5" /> Premium coureur 49€/an
                </Badge>
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
                  src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format&fit=crop"
                  alt="Coureurs en montagne"
                  className="h-full w-full object-cover"
                />
              </div>
            </motion.div>
          </div>
        </Container>
      </section>

      {/* 3 DERNIÈRES ÉPREUVES */}
      <section id="courses" className="py-8 sm:py-12">
        <Container>
          <div className="flex items-end justify-between mb-3">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Dernières épreuves publiées
            </h2>
            <Link to="/courses" className="text-sm font-semibold text-orange-600 hover:underline">
              Voir toutes les épreuves →
            </Link>
          </div>

          {loading ? (
            <SkeletonGrid />
          ) : courses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-neutral-600">
              Aucune épreuve pour le moment.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((c) => {
                const fList = formatsByCourse[c.id] || [];
                const next = fList[0] || null;
                const distance = Number(next?.distance_km);
                const dplus = Number(next?.denivele_dplus);
                return (
                  <Card key={c.id} className="overflow-hidden">
                    <div className="relative">
                      {c.image_url ? (
                        <img src={c.image_url} alt={c.nom} className="h-44 w-full object-cover" />
                      ) : (
                        <div className="h-44 w-full grid place-items-center bg-neutral-100 text-neutral-500">
                          <Mountain className="h-6 w-6" />
                        </div>
                      )}
                      <div className="absolute left-3 top-3">
                        <span className="rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold ring-1 ring-neutral-200">
                          {next?.date ? fmtDate(next.date) : "Date à venir"}
                        </span>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-bold leading-snug">{c.nom}</h3>
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500">
                            <MapPin className="h-3.5 w-3.5" /> {c.lieu} ({c.departement})
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-3 text-sm">
                        <Badge>
                          {Number.isFinite(distance) ? `${Math.round(distance)} km` : "Distance —"}
                        </Badge>
                        <Badge>
                          {Number.isFinite(dplus) ? `${Math.round(dplus)} m D+` : "D+ —"}
                        </Badge>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <Link
                          to={`/courses/${c.id}`}
                          className="rounded-xl bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:brightness-110"
                        >
                          Voir la fiche
                        </Link>
                        <Link
                          to={`/inscription/${c.id}`}
                          className="text-sm font-semibold text-neutral-700 hover:underline"
                        >
                          S’inscrire
                        </Link>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </Container>
      </section>

      {/* ORGANISATEUR */}
      <section id="org" className="py-12 sm:py-16 bg-white">
        <Container className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <motion.div initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.45 }}>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Publiez votre course en quelques minutes</h2>
            <p className="mt-3 text-neutral-600 max-w-xl">
              Créez une page dédiée, gérez les inscriptions, les codes promo, les reversements automatiques et le chat sous l’épreuve. Tout est pensé pour gagner du temps.
            </p>
            <ul className="mt-5 grid gap-2 text-sm text-neutral-700">
              <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-orange-500" /> Multi-formats & quotas par format</li>
              <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-orange-500" /> Paiements Stripe & reversements hebdo</li>
              <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-orange-500" /> Modération IA du chat</li>
            </ul>
            <div className="mt-6">
              <CTA as="a" href="https://www.tickrace.com/organisateur/mon-espace" target="_self" rel="noreferrer">
                <Settings className="h-4 w-4" /> Accéder à l'espace organisateur
              </CTA>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.45 }}>
            <Card className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
                  <div className="text-xs font-semibold text-neutral-500">Inscriptions</div>
                  <div className="mt-2 text-2xl font-black">1 254</div>
                  <div className="mt-2 h-20 rounded-lg bg-gradient-to-br from-orange-200 to-amber-200" />
                </div>
                <div className="rounded-xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
                  <div className="text-xs font-semibold text-neutral-500">Revenus (30j)</div>
                  <div className="mt-2 text-2xl font-black">12 430€</div>
                  <div className="mt-2 h-20 rounded-lg bg-gradient-to-br from-neutral-200 to-neutral-300" />
                </div>
                <div className="rounded-xl bg-neutral-50 p-4 ring-1 ring-neutral-200 col-span-2">
                  <div className="text-xs font-semibold text-neutral-500">Reversements</div>
                  <div className="mt-2 flex items-center justify-between">
                    <div>
                      <div className="text-lg font-bold">95% / semaine</div>
                      <div className="text-xs text-neutral-500">Automatique chaque fin de semaine</div>
                    </div>
                    <button className="rounded-xl bg-neutral-900 px-3 py-2 text-sm font-semibold text-white">Configurer</button>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        </Container>
      </section>

      {/* PREMIUM */}
      <section id="premium" className="py-12 sm:py-16">
        <Container>
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Passez en Premium</h2>
            <p className="mt-2 text-neutral-600">Plans d’entraînement IA, estimation de chrono par ITRA/UTMB, export vers montres, sync Strava.</p>
          </div>
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-semibold text-neutral-500">Gratuit</div>
                  <div className="mt-1 text-2xl font-black">0€</div>
                </div>
                <Badge>Pour démarrer</Badge>
              </div>
              <ul className="mt-4 grid gap-2 text-sm text-neutral-700">
                <li>• Recherche & inscription aux courses</li>
                <li>• Fiches épreuves, GPX & infos</li>
                <li>• Chat public (lecture)</li>
              </ul>
              <div className="mt-6">
                <button className="inline-flex items-center gap-2 rounded-2xl bg-white/5 px-5 py-3 text-sm font-semibold text-neutral-900 ring-1 ring-neutral-200 hover:bg-neutral-50">
                  Créer un compte
                </button>
              </div>
            </Card>
            <Card className="p-6 ring-2 ring-orange-400">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-semibold text-orange-600">Premium</div>
                  <div className="mt-1 text-2xl font-black">
                    49€<span className="text-sm font-semibold text-neutral-500">/an</span>
                  </div>
                </div>
                <Badge>Le meilleur choix</Badge>
              </div>
              <ul className="mt-4 grid gap-2 text-sm text-neutral-700">
                <li>• Plans IA personnalisés</li>
                <li>• Estimation chrono (ITRA/UTMB)</li>
                <li>• Export .zwo / Garmin Connect</li>
                <li>• Sync Strava + Feedback hebdo</li>
                <li>• Comparateur interactif d’allure</li>
                <li>• 0% de réduction sur frais ⚑</li>
              </ul>
              <div className="mt-6">
                <CTA>Souscrire Premium</CTA>
              </div>
            </Card>
          </div>
        </Container>
      </section>

      {/* COMMUNITY */}
      <section id="community" className="py-12 sm:py-16 bg-white">
        <Container className="grid items-center gap-10 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.45 }}>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Discutez sous chaque épreuve</h2>
            <p className="mt-2 text-neutral-600 max-w-xl">
              Posez vos questions, organisez du covoiturage, et mentionnez l’<span className="font-semibold">@IA</span> pour obtenir des infos instantanées sur le parcours, l’équipement ou le ravito.
            </p>
            <div className="mt-6 flex gap-3">
              <button className="inline-flex items-center gap-2 rounded-2xl bg-white/5 px-5 py-3 text-sm font-semibold text-neutral-900 ring-1 ring-neutral-200 hover:bg-neutral-50">
                Voir un exemple
              </button>
              <CTA>
                <MessageCircle className="h-4 w-4" /> Ouvrir un chat
              </CTA>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.45 }}>
            <Card className="p-6">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-orange-300 to-amber-300" />
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
        </Container>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-neutral-200 bg-white">
        <Container className="py-10">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2 font-black">
                <Mountain className="h-5 w-5" /> TickRace
              </div>
              <p className="mt-2 text-sm text-neutral-600">La plateforme pour créer, gérer et vivre les épreuves outdoor.</p>
            </div>
            <div>
              <div className="text-sm font-semibold">Produit</div>
              <ul className="mt-3 grid gap-2 text-sm text-neutral-700">
                <li><Link className="hover:underline" to="/courses">Trouver une course</Link></li>
                <li><Link className="hover:underline" to="/organisateur/mon-espace">Espace organisateur</Link></li>
                <li><a className="hover:underline" href="#premium">Premium</a></li>
              </ul>
            </div>
            <div>
              <div className="text-sm font-semibold">Légal</div>
              <ul className="mt-3 grid gap-2 text-sm text-neutral-700">
                <li>CGU</li>
                <li>Confidentialité</li>
                <li>Cookies</li>
              </ul>
            </div>
            <div>
              <div className="text-sm font-semibold">Langues</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {["FR", "EN", "ES", "DE", "IT", "PT", "CA"].map((l) => (
                  <span key={l} className="rounded-full bg-neutral-100 px-3 py-1 text-xs ring-1 ring-neutral-200">
                    {l}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-8 text-xs text-neutral-500">© {new Date().getFullYear()} TickRace. Tous droits réservés.</div>
        </Container>
      </footer>
    </div>
  );
}

/* Skeleton pour le bloc 3 épreuves */
function SkeletonGrid() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <div className="h-44 w-full bg-neutral-100" />
          <div className="p-4 space-y-3">
            <div className="h-5 w-2/3 bg-neutral-100 rounded" />
            <div className="h-4 w-1/2 bg-neutral-100 rounded" />
            <div className="h-8 w-1/2 bg-neutral-100 rounded mt-2" />
          </div>
        </div>
      ))}
    </div>
  );
}
