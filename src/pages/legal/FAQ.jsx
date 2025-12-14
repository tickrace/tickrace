// src/pages/legal/FAQ.jsx
import React, { useMemo, useState } from "react";
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

/**
 * Version "safe" :
 * - pas de framer-motion / AnimatePresence
 * - pas de RegExp highlight
 * - accordéon simple
 * - filtres simples
 */

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

const CATEGORIES = [
  { key: "all", label: "Tout", icon: HelpCircle },
  { key: "coureurs", label: "Coureurs", icon: Users },
  { key: "organisateurs", label: "Organisateurs", icon: Settings },
  { key: "paiements", label: "Paiements", icon: CreditCard },
  { key: "annulations", label: "Annulations", icon: CalendarDays },
  { key: "chrono", label: "Chronométrage", icon: Timer },
  { key: "legal", label: "Légal & RGPD", icon: FileText },
  { key: "support", label: "Support", icon: Mail },
];

const FAQ_ITEMS = [
  // Coureurs
  {
    id: "c1",
    cat: "coureurs",
    icon: Users,
    q: "Dois-je créer un compte pour m’inscrire ?",
    a: [
      "Oui, dans la plupart des cas : le compte permet de retrouver tes inscriptions et tes justificatifs.",
      "Tu peux gérer ton inscription depuis l’espace “Mes inscriptions”.",
    ],
    tags: ["compte", "inscription"],
  },
  {
    id: "c2",
    cat: "coureurs",
    icon: CheckCircle2,
    q: "Je n’ai pas reçu l’email de confirmation, que faire ?",
    a: [
      "Vérifie les spams/indésirables, puis l’adresse email utilisée.",
      "Tu peux aussi retrouver l’état de ton inscription dans “Mes inscriptions”.",
      "Si besoin : support@tickrace.com.",
    ],
    tags: ["email", "confirmation"],
  },
  {
    id: "c3",
    cat: "coureurs",
    icon: FileText,
    q: "À quoi servent les justificatifs (licence / PPS) ?",
    a: [
      "Certains événements exigent un justificatif pour valider l’inscription (licence, PPS, etc.).",
      "Tickrace facilite l’ajout/gestion, mais l’organisateur reste responsable des règles sportives de son épreuve.",
    ],
    tags: ["pps", "licence", "justificatif"],
  },

  // Organisateurs
  {
    id: "o1",
    cat: "organisateurs",
    icon: BadgeEuro,
    q: "Combien coûte Tickrace en V1 ?",
    a: [
      "Tickrace prélève 5 % sur le montant des inscriptions.",
      "Tickrace prélève aussi 5 % sur les options organisateur (repas, t-shirt, tombola…).",
      "L’option prestataire chronométrage est facturée 1,30 € / coureur (sans commission Tickrace).",
    ],
    tags: ["commission", "5%", "options", "chrono"],
  },
  {
    id: "o2",
    cat: "organisateurs",
    icon: Shield,
    q: "Qui est responsable de l’événement ?",
    a: [
      "L’organisateur est seul responsable : autorisations, sécurité, assurances, conformité.",
      "Tickrace est une plateforme technique et un intermédiaire de paiement.",
    ],
    tags: ["responsabilité", "assurance"],
  },
  {
    id: "o3",
    cat: "organisateurs",
    icon: AlertTriangle,
    q: "Anti-fraude : que peut faire Tickrace ?",
    a: [
      "Tickrace peut demander des justificatifs et geler des fonds en cas de suspicion.",
      "En cas de fraude avérée : annulation de ventes, remboursements, résiliation d’accès, signalement.",
      "Voir “Charte organisateur & anti-fraude”.",
    ],
    tags: ["fraude", "charte"],
  },

  // Paiements
  {
    id: "p1",
    cat: "paiements",
    icon: CreditCard,
    q: "Comment fonctionne le paiement côté coureur ?",
    a: [
      "Le paiement est réalisé via un prestataire sécurisé (Stripe).",
      "Une fois confirmé, l’inscription est enregistrée. Si le paiement est en attente, l’inscription peut rester “pending”.",
    ],
    tags: ["stripe", "paiement"],
  },
  {
    id: "p2",
    cat: "paiements",
    icon: CreditCard,
    q: "Comment fonctionnent les reversements côté organisateur ?",
    a: [
      "Les reversements sont automatisés selon les modalités techniques de la plateforme et du prestataire de paiement.",
      "Les montants reversés correspondent aux sommes encaissées, déduction faite des commissions applicables.",
    ],
    tags: ["reversement", "stripe express"],
  },
  {
    id: "p3",
    cat: "paiements",
    icon: AlertTriangle,
    q: "Que se passe-t-il en cas de chargeback (rétrofacturation) ?",
    a: [
      "Le montant contesté peut être bloqué/déduit/compensé dans les reversements en attente jusqu’à résolution.",
      "Tickrace peut demander des éléments au coureur et/ou à l’organisateur pour répondre au litige.",
    ],
    tags: ["chargeback", "litige"],
  },

  // Annulations
  {
    id: "a1",
    cat: "annulations",
    icon: CalendarDays,
    q: "Quelle est la politique d’annulation (commune) ?",
    a: [
      "La politique d’annulation est commune en V1 : elle est définie par Tickrace.",
      "La commission Tickrace de 5 % est conservée en toutes circonstances.",
      "Le remboursement s’applique sur la base restante après déduction de cette commission.",
    ],
    tags: ["annulation", "barème"],
  },
  {
    id: "a2",
    cat: "annulations",
    icon: CalendarDays,
    q: "Quel est le barème de remboursement (annulation coureur) ?",
    a: [
      "J-30+ : 90 %",
      "J-15–29 : 70 %",
      "J-7–14 : 50 %",
      "J-3–6 : 30 %",
      "J-0–2 : 0 %",
      "Pourcentages appliqués après déduction de la commission Tickrace (5 %).",
    ],
    tags: ["remboursement", "barème"],
  },
  {
    id: "a3",
    cat: "annulations",
    icon: Info,
    q: "Les options (repas, t-shirt…) sont-elles remboursées ?",
    a: [
      "Certaines options peuvent être exclues du remboursement si la prestation a déjà été engagée (commande, personnalisation…).",
      "Les exclusions éventuelles sont indiquées au moment de l’inscription.",
    ],
    tags: ["options", "tshirt", "repas"],
  },

  // Chronométrage
  {
    id: "ch1",
    cat: "chrono",
    icon: Timer,
    q: "À quoi correspond l’option chronométrage (1,30 € / coureur) ?",
    a: [
      "C’est une prestation fournie par un prestataire tiers (matériel, puces, dispositif de chrono…).",
      "Tickrace agit comme intermédiaire technique et de facturation. Pas de commission Tickrace sur cette option.",
    ],
    tags: ["chrono", "prestataire", "1.30"],
  },
  {
    id: "ch2",
    cat: "chrono",
    icon: Timer,
    q: "Qui est responsable en cas d’erreur de chronométrage ?",
    a: [
      "Le prestataire de chronométrage est responsable de sa prestation.",
      "Tickrace ne peut être tenue responsable d’un dysfonctionnement du matériel ou d’une erreur de chrono.",
    ],
    tags: ["résultats", "erreur"],
  },

  // Legal
  {
    id: "l1",
    cat: "legal",
    icon: FileText,
    q: "Où trouver les CGV et documents légaux ?",
    a: [
      "Les CGV Coureurs, CGV Organisateurs, Remboursements, Charte organisateur, Mentions légales et Confidentialité sont accessibles via le footer.",
    ],
    tags: ["cgv", "legal", "rgpd"],
  },
  {
    id: "l2",
    cat: "legal",
    icon: Shield,
    q: "RGPD : quels sont mes droits ?",
    a: [
      "Tu disposes de droits d’accès, rectification, effacement, opposition, limitation et portabilité.",
      "Pour exercer tes droits : contact@tickrace.com.",
    ],
    tags: ["rgpd", "données"],
  },

  // Support
  {
    id: "s1",
    cat: "support",
    icon: Mail,
    q: "Comment contacter Tickrace ?",
    a: ["Support : support@tickrace.com", "Contact : contact@tickrace.com"],
    tags: ["support", "contact"],
  },
  {
    id: "s2",
    cat: "support",
    icon: HelpCircle,
    q: "J’ai un problème technique, que dois-je envoyer au support ?",
    a: [
      "Ton email d’inscription, le nom de la course, et une capture d’écran si possible.",
      "Indique aussi l’URL exacte et ce que tu attendais (ex : paiement validé, page blanche, erreur…).",
    ],
    tags: ["bug", "aide"],
  },
];

function Tabs({ active, setActive, counts }) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIES.map((c) => {
        const Icon = c.icon;
        const isOn = active === c.key;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => setActive(c.key)}
            className={`rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition inline-flex items-center gap-2 ${
              isOn
                ? "bg-neutral-900 text-white ring-neutral-900"
                : "bg-white text-neutral-800 ring-neutral-200 hover:bg-neutral-50"
            }`}
          >
            <Icon className="h-4 w-4 opacity-90" />
            {c.label}
            <span
              className={`ml-1 rounded-lg px-2 py-0.5 text-xs ${
                isOn ? "bg-white/15 text-white" : "bg-neutral-100 text-neutral-700"
              }`}
            >
              {counts[c.key] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function AccordionItem({ item, open, onToggle }) {
  const Icon = item.icon || HelpCircle;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <button type="button" onClick={onToggle} className="w-full text-left" aria-expanded={open}>
        <div className="flex items-start gap-4 px-5 py-4">
          <IconBadge>
            <Icon className="h-5 w-5" />
          </IconBadge>

          <div className="flex-1">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold text-neutral-900">{item.q}</h3>
              <span className="mt-1 text-neutral-500">
                {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </span>
            </div>

            {item.tags?.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.tags.slice(0, 6).map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 ring-1 ring-neutral-200"
                  >
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </button>

      {open ? (
        <div className="border-t border-neutral-200">
          <div className="px-5 py-4 text-sm leading-6 text-neutral-800 space-y-2">
            {Array.isArray(item.a) ? item.a.map((line, idx) => <p key={idx}>{line}</p>) : <p>{item.a}</p>}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function FAQ() {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState("all");
  const [openIds, setOpenIds] = useState(() => new Set());

  const counts = useMemo(() => {
    const base = {};
    for (const c of CATEGORIES) base[c.key] = 0;
    base.all = FAQ_ITEMS.length;
    for (const it of FAQ_ITEMS) base[it.cat] = (base[it.cat] ?? 0) + 1;
    return base;
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FAQ_ITEMS.filter((it) => {
      if (activeCat !== "all" && it.cat !== activeCat) return false;
      if (!q) return true;

      const hay = [
        it.q,
        ...(Array.isArray(it.a) ? it.a : [it.a]),
        ...(it.tags || []),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [activeCat, query]);

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
                Recherche + filtres + accordéon (version stable).
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

            <Tabs active={activeCat} setActive={setActiveCat} counts={counts} />

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
              />
            ))
          )}

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
