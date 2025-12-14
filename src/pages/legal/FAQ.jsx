// src/pages/FAQ.jsx
import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  HelpCircle,
  Search,
  ChevronDown,
  ChevronUp,
  CreditCard,
  CalendarDays,
  Shield,
  Timer,
  FileText,
  Users,
  Mail,
  AlertTriangle,
  BadgeEuro,
  Settings,
  CheckCircle2,
} from "lucide-react";

/* ----------------------------- UI helpers ----------------------------- */

const Container = ({ children }) => (
  <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">{children}</div>
);

const Pill = ({ children }) => (
  <span className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700 ring-1 ring-neutral-200">
    {children}
  </span>
);

const IconBadge = ({ children }) => (
  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-800 ring-1 ring-neutral-200">
    {children}
  </span>
);

function highlight(text, q) {
  if (!q) return text;
  const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(${safe})`, "gi");
  const parts = String(text).split(re);
  return parts.map((p, i) =>
    re.test(p) ? (
      <mark key={i} className="rounded bg-amber-100 px-1 py-0.5 text-neutral-900">
        {p}
      </mark>
    ) : (
      <React.Fragment key={i}>{p}</React.Fragment>
    )
  );
}

/* ----------------------------- Data model ----------------------------- */

const CATEGORIES = [
  { key: "coureurs", label: "Coureurs", icon: Users },
  { key: "organisateurs", label: "Organisateurs", icon: Settings },
  { key: "paiements", label: "Paiements", icon: CreditCard },
  { key: "annulations", label: "Annulations", icon: CalendarDays },
  { key: "chrono", label: "Chronométrage", icon: Timer },
  { key: "legal", label: "Légal & RGPD", icon: FileText },
  { key: "support", label: "Support", icon: Mail },
];

const FAQ_ITEMS = [
  // --- Coureurs
  {
    id: "c1",
    cat: "coureurs",
    icon: Users,
    q: "Dois-je créer un compte pour m’inscrire ?",
    a: [
      "Oui, dans la plupart des cas. Le compte permet de retrouver tes inscriptions, tes justificatifs, et de gérer une annulation si nécessaire.",
      "Si un événement active un parcours “inscription rapide”, Tickrace peut simplifier la création de compte, mais tu auras toujours un accès pour gérer ton inscription.",
    ],
    tags: ["compte", "inscription", "profil"],
  },
  {
    id: "c2",
    cat: "coureurs",
    icon: CheckCircle2,
    q: "Je n’ai pas reçu l’email de confirmation, que faire ?",
    a: [
      "Vérifie tes spams / indésirables, puis assure-toi que l’adresse utilisée à l’inscription est correcte.",
      "Tu peux aussi retrouver ta confirmation dans ton espace “Mes inscriptions”. Si besoin : support@tickrace.com.",
    ],
    tags: ["email", "confirmation"],
  },
  {
    id: "c3",
    cat: "coureurs",
    icon: FileText,
    q: "À quoi servent les justificatifs (licence / PPS) ?",
    a: [
      "Certains événements exigent un justificatif pour valider l’inscription (licence sportive, PPS, certificat, etc.).",
      "Tickrace facilite l’ajout et la gestion de ces justificatifs. L’organisateur reste responsable des règles sportives applicables à l’épreuve.",
    ],
    tags: ["pps", "licence", "justificatif"],
  },

  // --- Organisateurs
  {
    id: "o1",
    cat: "organisateurs",
    icon: BadgeEuro,
    q: "Combien coûte Tickrace en V1 ?",
    a: [
      "Tickrace prélève une commission de 5 % sur le montant des inscriptions.",
      "Tickrace prélève aussi 5 % sur les options organisateur (repas, t-shirt, tombola…).",
      "L’option prestataire chronométrage est facturée à 1,30 € / coureur (Tickrace ne prend aucune commission dessus).",
    ],
    tags: ["commission", "5%", "options", "chrono"],
  },
  {
    id: "o2",
    cat: "organisateurs",
    icon: Shield,
    q: "Qui est responsable de l’événement (sécurité, autorisations, assurances) ?",
    a: [
      "L’organisateur est seul responsable de l’événement : autorisations, sécurité, assurances, conformité.",
      "Tickrace est une plateforme technique et un intermédiaire de paiement : Tickrace n’est ni organisateur ni co-organisateur.",
    ],
    tags: ["responsabilité", "assurance"],
  },
  {
    id: "o3",
    cat: "organisateurs",
    icon: AlertTriangle,
    q: "Comment Tickrace lutte contre la fraude côté organisateur ?",
    a: [
      "Tickrace peut demander des justificatifs et geler des fonds en cas de suspicion (signalements, incohérences, activité anormale).",
      "En cas de fraude avérée, Tickrace peut annuler des ventes, rembourser les participants, résilier l’accès, et signaler aux autorités.",
      "Voir la page “Charte organisateur & anti-fraude”.",
    ],
    tags: ["fraude", "charte", "gel"],
  },

  // --- Paiements
  {
    id: "p1",
    cat: "paiements",
    icon: CreditCard,
    q: "Comment fonctionne le paiement côté coureur ?",
    a: [
      "Le paiement s’effectue via un prestataire sécurisé (Stripe). Une fois le paiement confirmé, l’inscription est enregistrée.",
      "Dans certains cas (paiement en attente), l’inscription peut rester en statut “pending” jusqu’à confirmation.",
    ],
    tags: ["stripe", "paiement", "pending"],
  },
  {
    id: "p2",
    cat: "paiements",
    icon: CreditCard,
    q: "Comment fonctionnent les reversements côté organisateur ?",
    a: [
      "Les reversements sont effectués automatiquement selon les modalités techniques de la plateforme et du prestataire de paiement.",
      "Les montants reversés correspondent aux sommes encaissées, déduction faite des commissions Tickrace applicables.",
    ],
    tags: ["reversement", "stripe express"],
  },
  {
    id: "p3",
    cat: "paiements",
    icon: AlertTriangle,
    q: "Que se passe-t-il en cas de chargeback (rétrofacturation) ?",
    a: [
      "En cas de litige bancaire (chargeback), le montant contesté peut être bloqué, déduit ou compensé dans les reversements en attente, jusqu’à résolution du dossier.",
      "Tickrace peut demander des éléments au coureur et/ou à l’organisateur pour répondre au litige.",
    ],
    tags: ["chargeback", "litige"],
  },

  // --- Annulations
  {
    id: "a1",
    cat: "annulations",
    icon: CalendarDays,
    q: "Quelle est la politique d’annulation Tickrace (commune) ?",
    a: [
      "La politique d’annulation est commune et définie par Tickrace. Elle s’applique à tous les événements en V1.",
      "La commission Tickrace de 5 % est conservée en toutes circonstances.",
      "Le remboursement éventuel se calcule sur la base restante après déduction de cette commission.",
    ],
    tags: ["annulation", "barème", "5%"],
  },
  {
    id: "a2",
    cat: "annulations",
    icon: CalendarDays,
    q: "Quel est le barème de remboursement en cas d’annulation par le coureur ?",
    a: [
      "J-30 et plus : 90 %",
      "J-15 à J-29 : 70 %",
      "J-7 à J-14 : 50 %",
      "J-3 à J-6 : 30 %",
      "J-0 à J-2 : 0 %",
      "Ces pourcentages s’appliquent après déduction de la commission Tickrace (5 %).",
    ],
    tags: ["barème", "remboursement"],
  },
  {
    id: "a3",
    cat: "annulations",
    icon: Info,
    q: "Les options (repas, t-shirt…) sont-elles remboursées ?",
    a: [
      "Certaines options peuvent être exclues du remboursement si la prestation a déjà été engagée (ex. production, personnalisation, commande).",
      "Les exclusions éventuelles sont indiquées au moment de l’inscription.",
    ],
    tags: ["options", "tshirt", "repas"],
  },

  // --- Chronométrage
  {
    id: "ch1",
    cat: "chrono",
    icon: Timer,
    q: "À quoi correspond l’option prestataire chronométrage (1,30 € / coureur) ?",
    a: [
      "C’est un service fourni par un prestataire tiers (matériel, puces, dispositif de chrono, etc.).",
      "Tickrace agit comme intermédiaire technique et de facturation. Tickrace ne prélève aucune commission sur cette option.",
    ],
    tags: ["chrono", "prestataire", "1.30"],
  },
  {
    id: "ch2",
    cat: "chrono",
    icon: Timer,
    q: "Qui est responsable en cas d’erreur de chronométrage ?",
    a: [
      "Le prestataire de chronométrage est seul responsable de la bonne exécution de sa prestation.",
      "Tickrace ne peut être tenue responsable d’un dysfonctionnement du matériel, d’une erreur de chrono ou d’un retard du prestataire.",
    ],
    tags: ["résultats", "erreur"],
  },

  // --- Légal & RGPD
  {
    id: "l1",
    cat: "legal",
    icon: FileText,
    q: "Où trouver les CGV et politiques Tickrace ?",
    a: [
      "Les CGV Coureurs, CGV Organisateurs, la Politique de remboursement, la Charte organisateur & anti-fraude, les Mentions légales et la Confidentialité (RGPD) sont accessibles via le footer.",
    ],
    tags: ["cgv", "legal", "rgpd"],
  },
  {
    id: "l2",
    cat: "legal",
    icon: Shield,
    q: "Comment Tickrace gère les données personnelles (RGPD) ?",
    a: [
      "Tickrace traite les données nécessaires à la gestion des comptes, inscriptions, paiements et événements.",
      "Les données peuvent être partagées avec l’organisateur et certains prestataires (ex. chronométrage) uniquement pour exécuter le service.",
      "Tu peux exercer tes droits (accès, rectification, suppression, etc.) via contact@tickrace.com.",
    ],
    tags: ["rgpd", "données", "privacy"],
  },

  // --- Support
  {
    id: "s1",
    cat: "support",
    icon: Mail,
    q: "Comment contacter Tickrace ?",
    a: [
      "Pour toute question : support@tickrace.com.",
      "Pour une demande générale : contact@tickrace.com.",
    ],
    tags: ["support", "contact"],
  },
  {
    id: "s2",
    cat: "support",
    icon: HelpCircle,
    q: "J’ai un problème technique sur mon inscription, qui contacter ?",
    a: [
      "Commence par vérifier ton espace “Mes inscriptions” (statut, paiement, options).",
      "Si le problème persiste : support@tickrace.com avec (1) ton email d’inscription, (2) le nom de la course, (3) une capture si possible.",
    ],
    tags: ["bug", "aide"],
  },
];

/* ----------------------------- Component ----------------------------- */

function CategoryTabs({ active, onChange, counts }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onChange("all")}
        className={`rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition ${
          active === "all"
            ? "bg-neutral-900 text-white ring-neutral-900"
            : "bg-white text-neutral-800 ring-neutral-200 hover:bg-neutral-50"
        }`}
      >
        Tout <span className="ml-2 rounded-lg bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">{counts.all}</span>
      </button>

      {CATEGORIES.map((c) => {
        const Icon = c.icon;
        const isOn = active === c.key;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onChange(c.key)}
            className={`rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition inline-flex items-center gap-2 ${
              isOn
                ? "bg-neutral-900 text-white ring-neutral-900"
                : "bg-white text-neutral-800 ring-neutral-200 hover:bg-neutral-50"
            }`}
          >
            <Icon className="h-4 w-4 opacity-90" />
            {c.label}
            <span className={`ml-1 rounded-lg px-2 py-0.5 text-xs ${isOn ? "bg-white/15 text-white" : "bg-neutral-100 text-neutral-700"}`}>
              {counts[c.key] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function AccordionItem({ item, open, onToggle, query }) {
  const Icon = item.icon || HelpCircle;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left"
        aria-expanded={open}
      >
        <div className="flex items-start gap-4 px-5 py-4">
          <IconBadge>
            <Icon className="h-5 w-5" />
          </IconBadge>

          <div className="flex-1">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold text-neutral-900">
                {highlight(item.q, query)}
              </h3>
              <span className="mt-1 text-neutral-500">
                {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </span>
            </div>

            {item.tags?.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.tags.slice(0, 5).map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 ring-1 ring-neutral-200"
                  >
                    {highlight(t, query)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="border-t border-neutral-200"
          >
            <div className="px-5 py-4 text-sm leading-6 text-neutral-800">
              {Array.isArray(item.a) ? (
                <ul className="space-y-2">
                  {item.a.map((line, idx) => (
                    <li key={idx}>
                      {typeof line === "string" ? (
                        <p>{highlight(line, query)}</p>
                      ) : (
                        line
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{highlight(item.a, query)}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQ() {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState("all");
  const [openIds, setOpenIds] = useState(() => new Set());

  const normalizedQuery = query.trim().toLowerCase();

  const counts = useMemo(() => {
    const base = { all: FAQ_ITEMS.length };
    for (const c of CATEGORIES) base[c.key] = 0;
    for (const it of FAQ_ITEMS) base[it.cat] = (base[it.cat] ?? 0) + 1;
    return base;
  }, []);

  const filtered = useMemo(() => {
    return FAQ_ITEMS.filter((it) => {
      if (activeCat !== "all" && it.cat !== activeCat) return false;
      if (!normalizedQuery) return true;

      const hay = [
        it.q,
        ...(Array.isArray(it.a) ? it.a : [it.a]),
        ...(it.tags || []),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(normalizedQuery);
    });
  }, [activeCat, normalizedQuery]);

  const openAll = () => setOpenIds(new Set(filtered.map((x) => x.id)));
  const closeAll = () => setOpenIds(new Set());

  const toggle = (id) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="border-b border-neutral-200 bg-white">
        <Container>
          <div className="py-10 space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Pill>
                <HelpCircle className="mr-2 inline h-4 w-4" />
                FAQ – Tickrace V1
              </Pill>
              <Pill>
                <Shield className="mr-2 inline h-4 w-4" />
                Politique claire (5% + barème commun)
              </Pill>
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Foire aux questions</h1>
              <p className="max-w-3xl text-sm text-neutral-600">
                Recherche + filtres + accordéon. Si tu veux, je te rajoute encore 20 questions “terrain” côté organisateur.
              </p>
            </div>

            {/* Search */}
            <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="flex items-center gap-3 px-4 py-3">
                <Search className="h-5 w-5 text-neutral-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher : annulation, remboursement, chrono, Stripe, t-shirt…"
                  className="w-full bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 outline-none"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="rounded-xl bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-200"
                  >
                    Effacer
                  </button>
                ) : null}
              </div>
            </div>

            {/* Tabs */}
            <CategoryTabs active={activeCat} onChange={setActiveCat} counts={counts} />

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openAll}
                className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
              >
                Tout ouvrir
              </button>
              <button
                type="button"
                onClick={closeAll}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-800 ring-1 ring-neutral-200 hover:bg-neutral-50"
              >
                Tout fermer
              </button>

              <div className="ml-auto text-sm text-neutral-600">
                {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
              </div>
            </div>
          </div>
        </Container>
      </div>

      {/* Content */}
      <Container>
        <div className="py-10 space-y-4">
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-700">
              <p className="font-semibold text-neutral-900">Aucun résultat</p>
              <p className="mt-1">
                Essaie un autre mot-clé (ex : “annulation”, “Stripe”, “chrono”, “t-shirt”…).
              </p>
            </div>
          ) : (
            filtered.map((item) => (
              <AccordionItem
                key={item.id}
                item={item}
                open={openIds.has(item.id)}
                onToggle={() => toggle(item.id)}
                query={normalizedQuery}
              />
            ))
          )}

          {/* Support card */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-6">
            <div className="flex items-start gap-3">
              <IconBadge>
                <Mail className="h-5 w-5" />
              </IconBadge>
              <div>
                <p className="text-sm font-semibold text-neutral-900">Besoin d’aide ?</p>
                <p className="mt-1 text-sm text-neutral-700">
                  Support : <strong>support@tickrace.com</strong> • Contact : <strong>contact@tickrace.com</strong>
                </p>
                <p className="mt-2 text-xs text-neutral-500">
                  Astuce : indique le nom de la course + ton email d’inscription + une capture d’écran.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
