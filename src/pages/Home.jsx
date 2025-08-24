// src/pages/Home.jsx
import React from "react";
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
  User2,
} from "lucide-react";

// --- UI helpers (internes au fichier)
const Container = ({ children, className = "" }) => (
  <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
);

const Pill = ({ children }) => (
  <span className="inline-flex items-center gap-2 rounded-full bg-neutral-900/70 ring-1 ring-white/10 px-3 py-1 text-xs text-white">
    <Sparkles className="h-3.5 w-3.5" /> {children}
  </span>
);

const CTA = ({ children, className = "", ...props }) => (
  <button
    className={`inline-flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-orange-300 active:translate-y-px ${className}`}
    {...props}
  >
    {children}
  </button>
);

const Ghost = ({ children, className = "", ...props }) => (
  <button
    className={`inline-flex items-center gap-2 rounded-lg bg-white/5 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20 ${className}`}
    {...props}
  >
    {children}
  </button>
);

const Card = ({ children, className = "", ...props }) => (
  <div className={`rounded-lg bg-white shadow-lg shadow-neutral-900/5 ring-1 ring-neutral-200 ${className}`} {...props}>
    {children}
  </div>
);

const Badge = ({ children, className = "" }) => (
  <span className={`inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-medium text-neutral-700 ring-1 ring-neutral-200 ${className}`}>
    {children}
  </span>
);

// --- Données mock
const sampleRaces = [
  {
    id: 1,
    name: "Skyrace des Aiguilles",
    city: "Chamonix, FR",
    date: "12 Oct 2025",
    distance: "32.6 km",
    dplus: "+2630 m",
    cover: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=1400&auto=format&fit=crop",
  },
  {
    id: 2,
    name: "Trail des Vallées",
    city: "Gavarnie, FR",
    date: "27 Sep 2025",
    distance: "21 km",
    dplus: "+980 m",
    cover: "https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1400&auto=format&fit=crop",
  },
  {
    id: 3,
    name: "Ultra du Ventoux",
    city: "Bédoin, FR",
    date: "16 Nov 2025",
    distance: "50 km",
    dplus: "+2100 m",
    cover: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=1400&auto=format&fit=crop",
  },
];

// --- Petits tests fumée (console)
function TestRunner() {
  React.useEffect(() => {
    try {
      console.assert(Array.isArray(sampleRaces), "sampleRaces should be an array");
      console.assert(sampleRaces.length === 3, "sampleRaces length should be 3");
      console.assert(sampleRaces.every((r) => r.id && r.name && r.cover), "each race should have id, name, cover");
      console.assert(typeof Home === "function", "Home should be a component");
      // eslint-disable-next-line no-console
      console.log("✅ UI smoke tests passed");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("❌ UI tests failed", e);
    }
  }, []);
  return null;
}

export default function Home() {
  // TODO: branche ces handlers sur tes vraies routes (react-router)
  const goFind = () => (window.location.href = "/courses");
  const goOrg = () => (window.location.href = "/organisateur");

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <TestRunner />

      {/* NAVBAR */}
      <header className="sticky top-0 z-40 w-full backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white/80 border-b border-neutral-200">
        <Container className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-orange-500 text-white">
              <Mountain className="h-5 w-5" />
            </div>
            <div className="text-lg font-extrabold tracking-tight">TickRace</div>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a className="hover:text-neutral-700" href="#courses">Courses</a>
            <a className="hover:text-neutral-700" href="#org">Espace organisateur</a>
            <a className="hover:text-neutral-700" href="#premium">Premium</a>
            <a className="hover:text-neutral-700" href="#community">Communauté</a>
          </nav>
          <div className="flex items-center gap-3">
            <button className="rounded-lg px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100">Connexion</button>
            <button className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:brightness-110">
              + Créer une épreuve
            </button>
          </div>
        </Container>
      </header>

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
                Inscris-toi, organise, cours. <span className="text-orange-600">Une seule plateforme.</span>
              </h1>
              <p className="text-neutral-600 max-w-xl">
                TickRace centralise la création d’épreuves, l’inscription coureurs, le chat communautaire,
                et la synchronisation Strava. Une solution moderne pensée pour la performance et la simplicité.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <CTA onClick={goFind}>
                  <ArrowRight className="h-4 w-4" /> Trouver une course
                </CTA>
                <Ghost onClick={goOrg}>
                  <Settings className="h-4 w-4" /> Je suis organisateur
                </Ghost>
              </div>
              <div className="flex items-center gap-3 pt-2 text-xs text-neutral-500">
                <Badge><Star className="h-3.5 w-3.5" /> 5% frais plateforme organisateur</Badge>
                <Badge><User2 className="h-3.5 w-3.5" /> Premium coureur 49€/an</Badge>
                <Badge><MessageCircle className="h-3.5 w-3.5" /> Chat épreuves avec IA</Badge>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="relative"
            >
              <div className="aspect-[4/3] overflow-hidden rounded-2xl ring-1 ring-neutral-200 shadow-xl">
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

      {/* SEARCH + CARDS */}
      <section id="courses" className="py-8 sm:py-12">
        <Container>
          <Card className="p-4 sm:p-6">
            <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
              <div className="grid flex-1 grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-neutral-600">Lieu</label>
                  <div className="mt-1 flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2">
                    <MapPin className="h-4 w-4 text-neutral-400" />
                    <input className="w-full bg-transparent text-sm outline-none" placeholder="Ville, région…" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-neutral-600">Date</label>
                  <div className="mt-1 flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2">
                    <CalendarDays className="h-4 w-4 text-neutral-400" />
                    <input type="date" className="w-full bg-transparent text-sm outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-neutral-600">Distance</label>
                  <select className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm">
                    <option>—</option>
                    <option>&lt; 10 km</option>
                    <option>10–20 km</option>
                    <option>20–40 km</option>
                    <option>&gt; 40 km</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <CTA onClick={goFind}>
                  <ArrowRight className="h-4 w-4" /> Rechercher
                </CTA>
                <button className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-5 py-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50">
                  Voir la carte
                </button>
              </div>
            </div>
          </Card>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sampleRaces.length === 0 ? (
              <div className="text-sm text-neutral-500">Aucune épreuve trouvée. Modifie tes filtres.</div>
            ) : (
              sampleRaces.map((r) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35 }}
                >
                  <Card className="overflow-hidden">
                    <div className="relative">
                      <img src={r.cover} alt={r.name} className="h-44 w-full object-cover" />
                      <div className="absolute left-3 top-3">
                        <span className="rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold ring-1 ring-neutral-200">
                          {r.date}
                        </span>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-bold leading-snug">{r.name}</h3>
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500">
                            <MapPin className="h-3.5 w-3.5" /> {r.city}
                          </div>
                        </div>
                        <Badge>ITRA 480</Badge>
                      </div>
                      <div className="mt-3 flex items-center gap-3 text-sm">
                        <Badge>{r.distance}</Badge>
                        <Badge>{r.dplus}</Badge>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <button className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:brightness-110">
                          S'inscrire
                        </button>
                        <button className="text-sm font-semibold text-neutral-700 hover:underline">Voir la fiche</button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
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
              <CTA onClick={goOrg}><Settings className="h-4 w-4" /> Accéder à l'espace organisateur</CTA>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.45 }}>
            <Card className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-neutral-50 p-4 ring-1 ring-neutral-200">
                  <div className="text-xs font-semibold text-neutral-500">Inscriptions</div>
                  <div className="mt-2 text-2xl font-black">1 254</div>
                  <div className="mt-2 h-20 rounded-lg bg-gradient-to-br from-orange-200 to-orange-300" />
                </div>
                <div className="rounded-lg bg-neutral-50 p-4 ring-1 ring-neutral-200">
                  <div className="text-xs font-semibold text-neutral-500">Revenus (30j)</div>
                  <div className="mt-2 text-2xl font-black">12 430€</div>
                  <div className="mt-2 h-20 rounded-lg bg-gradient-to-br from-neutral-200 to-neutral-300" />
                </div>
                <div className="rounded-lg bg-neutral-50 p-4 ring-1 ring-neutral-200 col-span-2">
                  <div className="text-xs font-semibold text-neutral-500">Reversements</div>
                  <div className="mt-2 flex items-center justify-between">
                    <div>
                      <div className="text-lg font-bold">95% / semaine</div>
                      <div className="text-xs text-neutral-500">Automatique chaque fin de semaine</div>
                    </div>
                    <button className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white">Configurer</button>
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
            {/* Gratuit */}
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
                <button className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50">
                  Créer un compte
                </button>
              </div>
            </Card>

            {/* Premium */}
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
              <button className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50">
                Voir un exemple
              </button>
              <CTA><MessageCircle className="h-4 w-4" /> Ouvrir un chat</CTA>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.45 }}>
            <Card className="p-6">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-orange-300 to-orange-400" />
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
                      <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] ring-1 ring-neutral-200">Skyrace</span>
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
                <li><a className="hover:underline" href="#courses">Trouver une course</a></li>
                <li><a className="hover:underline" href="#org">Espace organisateur</a></li>
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
                  <span key={l} className="rounded-full bg-neutral-100 px-3 py-1 text-xs ring-1 ring-neutral-200">{l}</span>
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
