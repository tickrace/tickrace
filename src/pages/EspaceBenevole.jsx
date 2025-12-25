// src/pages/EspaceBenevole.jsx
// ✅ Version ultra clean (Supabase) — layout 2 colonnes (desktop) + stack (mobile)
// - Auth (magic link / OTP fallback)
// - Liaison benevole.user_id auto au 1er login
// - Affichage "Ma mission" + actions (confirmer / refuser / check-in)
// - Planning équipe (couverture par poste)
// - Chat équipe en temps réel (Realtime) + envoi + scroll
// - Export calendrier (ICS) pour tes missions
// - ✅ FIX: pas de courses.date -> on affiche une "prochaine date" via formats.date (si dispo)
//
// Pré-requis tables : benevoles, benevoles_postes, benevoles_creneaux, benevoles_affectations, benevoles_chat_messages
// Pré-requis RLS : le bénévole doit pouvoir SELECT postes/creneaux/affectations/chat pour sa course

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";
import {
  CalendarDays,
  MapPin,
  UserCheck,
  MessageCircle,
  Phone,
  Mail,
  Download,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Send,
  Loader2,
  Info,
  XCircle,
} from "lucide-react";

/* ----------------------------- UI Helpers ----------------------------- */

const Container = ({ children }) => (
  <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
);

const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200 ${className}`}>{children}</div>
);

const Pill = ({ tone = "orange", children }) => {
  const map = {
    orange: "bg-orange-50 text-orange-700 ring-orange-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    gray: "bg-neutral-100 text-neutral-700 ring-neutral-200",
  };
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ring-1 ${map[tone]}`}>
      {children}
    </span>
  );
};

const Btn = ({ variant = "dark", className = "", ...props }) => {
  const variants = {
    dark: "bg-neutral-900 text-white hover:bg-neutral-800",
    light: "bg-white text-neutral-900 ring-1 ring-neutral-200 hover:bg-neutral-50",
    orange: "bg-orange-600 text-white hover:bg-orange-500",
    subtle: "bg-neutral-100 text-neutral-900 hover:bg-neutral-200",
    danger: "bg-red-600 text-white hover:bg-red-500",
  };
  return (
    <button
      {...props}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        className,
      ].join(" ")}
    />
  );
};

const Line = () => <div className="h-px w-full bg-neutral-200" />;

const fmtDate = (d) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(date);
};

const fmtTime = (d) => {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", { timeStyle: "short" }).format(date);
};

const safe = (s) => (s || "").toString().trim();

/* ----------------------------- ICS Export ----------------------------- */

function toICSDateUTC(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function downloadICS(filename, icsContent) {
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function buildICS({ course, benevole, missions }) {
  const uidBase = `${course?.id || "course"}-${benevole?.id || "benevole"}`;

  const events = missions
    .filter((m) => m?.creneau?.start_at && m?.creneau?.end_at)
    .map((m, idx) => {
      const dtStart = toICSDateUTC(m.creneau.start_at);
      const dtEnd = toICSDateUTC(m.creneau.end_at);

      const summary = `Bénévolat — ${safe(course?.nom)} — ${safe(m?.poste?.titre)}`;
      const location = safe(m?.poste?.lieu || course?.lieu);
      const description = [
        `Course: ${safe(course?.nom)}`,
        `Mission: ${safe(m?.poste?.titre)}`,
        m?.creneau?.label ? `Créneau: ${safe(m?.creneau?.label)}` : null,
        location ? `Lieu: ${location}` : null,
        m?.poste?.description ? `Consignes: ${safe(m?.poste?.description)}` : null,
      ]
        .filter(Boolean)
        .join("\\n");

      return [
        "BEGIN:VEVENT",
        `UID:${uidBase}-${idx}@tickrace.com`,
        `DTSTAMP:${toICSDateUTC(new Date())}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${summary}`,
        location ? `LOCATION:${location}` : null,
        `DESCRIPTION:${description}`,
        "END:VEVENT",
      ]
        .filter(Boolean)
        .join("\r\n");
    });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tickrace//Espace Benevole//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

/* ----------------------------- Main Page ----------------------------- */

export default function EspaceBenevole() {
  const { courseId } = useParams();

  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState(false);

  const [sessionUser, setSessionUser] = useState(null);

  const [course, setCourse] = useState(null);
  const [nextDate, setNextDate] = useState(null); // ✅ prochaine date via formats.date
  const [benevole, setBenevole] = useState(null);

  const [postes, setPostes] = useState([]);
  const [planningStats, setPlanningStats] = useState([]);
  const [myMissions, setMyMissions] = useState([]);

  const [infoBlock, setInfoBlock] = useState({
    rendez_vous_lieu: null,
    rendez_vous_heure: null,
    consignes_url: null,
    contact_email: "support@tickrace.com",
    contact_tel: null,
  });

  const [authEmail, setAuthEmail] = useState("");
  const [authSending, setAuthSending] = useState(false);

  const [err, setErr] = useState("");

  const chatRef = useRef(null);

  const statusChip = useMemo(() => {
    const status = myMissions?.[0]?.status || "assigned";
    if (status === "checked_in") {
      return (
        <Pill tone="green">
          <UserCheck className="h-4 w-4" /> Présence validée
        </Pill>
      );
    }
    if (status === "confirmed") {
      return (
        <Pill tone="green">
          <CheckCircle2 className="h-4 w-4" /> Mission confirmée
        </Pill>
      );
    }
    if (myMissions.length === 0) {
      return (
        <Pill tone="gray">
          <Info className="h-4 w-4" /> En attente d’affectation
        </Pill>
      );
    }
    return (
      <Pill tone="orange">
        <AlertTriangle className="h-4 w-4" /> Action requise
      </Pill>
    );
  }, [myMissions]);

  const contactMailTo = useMemo(() => {
    const email = infoBlock.contact_email || "support@tickrace.com";
    const subject = encodeURIComponent(
      `Bénévole — ${course?.nom || "Course"} — ${benevole?.prenom || ""} ${benevole?.nom || ""}`
    );
    const body = encodeURIComponent(
      `Bonjour,\n\nJe suis bénévole sur ${course?.nom || "la course"}.\n\nMa demande : \n\nMerci !`
    );
    return `mailto:${email}?subject=${subject}&body=${body}`;
  }, [infoBlock.contact_email, course?.nom, benevole?.prenom, benevole?.nom]);

  /* ----------------------------- Data Loading ----------------------------- */

  const refreshAll = async () => {
    setLoading(true);
    setErr("");

    try {
      const { data: sess } = await supabase.auth.getSession();
      const user = sess?.session?.user || null;
      setSessionUser(user);

      // 1) Course (public) ✅ FIX: pas de date ici
      const { data: c, error: cErr } = await supabase
        .from("courses")
        .select("id, nom, lieu, image_url")
        .eq("id", courseId)
        .maybeSingle();

      if (cErr || !c) throw cErr || new Error("Course introuvable.");
      setCourse(c);

      // 1bis) Prochaine date via formats.date (si dispo)
      // ⚠️ Si ton champ n'est pas "date", remplace-le ici (ex: start_at / date_depart)
      const { data: f, error: fErr } = await supabase
        .from("formats")
        .select("id, date")
        .eq("course_id", courseId);

      if (!fErr && f?.length) {
        const now = Date.now();
        const dates = f
          .map((x) => (x?.date ? new Date(x.date).getTime() : null))
          .filter((t) => Number.isFinite(t));

        const future = dates.filter((t) => t >= now).sort((a, b) => a - b);
        const past = dates.filter((t) => t < now).sort((a, b) => b - a);
        const chosen = future[0] ?? past[0] ?? null;
        setNextDate(chosen ? new Date(chosen).toISOString() : null);
      } else {
        setNextDate(null);
      }

      if (!user) {
        setLoading(false);
        return;
      }

      // 2) Bénévole row par course + email
      const email = user.email;
      if (!email) throw new Error("Email utilisateur indisponible.");

      const { data: b, error: bErr } = await supabase
        .from("benevoles")
        .select("*")
        .eq("course_id", courseId)
        .eq("email", email)
        .maybeSingle();

      if (bErr || !b) {
        throw new Error("Ton email n’est pas enregistré comme bénévole sur cette course.");
      }

      // 3) Liaison user_id si manquant
      if (!b.user_id) {
        const { error: upErr } = await supabase
          .from("benevoles")
          .update({ user_id: user.id, status: "active" })
          .eq("id", b.id);

        if (upErr) {
          console.warn("Unable to attach user_id:", upErr);
        } else {
          b.user_id = user.id;
          b.status = "active";
        }
      }
      setBenevole(b);

      // 4) Postes (planning équipe)
      const { data: p, error: pErr } = await supabase
        .from("benevoles_postes")
        .select("id, course_id, titre, lieu, description, capacite, ordre")
        .eq("course_id", courseId)
        .order("ordre", { ascending: true });

      if (pErr) throw pErr;
      setPostes(p || []);

      // 5) Affectations (stats équipe)
      const { data: aAll, error: aAllErr } = await supabase
        .from("benevoles_affectations")
        .select("id, poste_id, status")
        .eq("course_id", courseId);

      if (aAllErr) throw aAllErr;

      const isFilled = (st) => ["assigned", "confirmed", "checked_in"].includes(st);

      const countByPoste = new Map();
      (aAll || []).forEach((a) => {
        if (!a?.poste_id) return;
        if (!isFilled(a.status)) return;
        countByPoste.set(a.poste_id, (countByPoste.get(a.poste_id) || 0) + 1);
      });

      const stats = (p || []).map((poste) => ({
        id: poste.id,
        poste: poste.titre,
        lieu: poste.lieu || "",
        filled: countByPoste.get(poste.id) || 0,
        need: Math.max(0, poste.capacite || 0),
      }));
      setPlanningStats(stats);

      // 6) Mes missions (affectations join poste/creneau)
      const { data: my, error: myErr } = await supabase
        .from("benevoles_affectations")
        .select(
          `
          id, status, note, created_at,
          poste: benevoles_postes ( id, titre, lieu, description ),
          creneau: benevoles_creneaux ( id, label, start_at, end_at, ordre )
        `
        )
        .eq("course_id", courseId)
        .eq("benevole_id", b.id)
        .order("created_at", { ascending: true });

      if (myErr) throw myErr;

      const mySorted = (my || []).slice().sort((x, y) => {
        const ox = x?.creneau?.ordre ?? 9999;
        const oy = y?.creneau?.ordre ?? 9999;
        if (ox !== oy) return ox - oy;
        const sx = x?.creneau?.start_at ? new Date(x.creneau.start_at).getTime() : 0;
        const sy = y?.creneau?.start_at ? new Date(y.creneau.start_at).getTime() : 0;
        return sx - sy;
      });

      setMyMissions(mySorted);
    } catch (e) {
      setErr(e?.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refreshAll();
    });

    return () => sub?.subscription?.unsubscribe?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  /* ----------------------------- Actions ----------------------------- */

  const updateMissionStatus = async (affId, status) => {
    if (!affId) return;
    setBusyAction(true);
    setErr("");

    setMyMissions((prev) => prev.map((m) => (m.id === affId ? { ...m, status } : m)));

    const { error } = await supabase.from("benevoles_affectations").update({ status }).eq("id", affId);

    if (error) {
      await refreshAll();
      setErr("Impossible de mettre à jour le statut. Réessaie.");
    } else {
      await refreshAll();
    }

    setBusyAction(false);
  };

  const exportMyCalendar = () => {
    if (!course || !benevole) return;
    if (!myMissions || myMissions.length === 0) {
      setErr("Aucune mission à exporter.");
      return;
    }
    const ics = buildICS({ course, benevole, missions: myMissions });
    downloadICS(`tickrace-benevole-${course.id}.ics`, ics);
  };

  const requestMagicLink = async () => {
    const email = safe(authEmail);
    if (!email.includes("@")) return;

    setAuthSending(true);
    setErr("");

    try {
      const redirectTo = `${window.location.origin}/benevole/${courseId}`;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
    } catch (e) {
      setErr(e?.message || "Impossible d’envoyer le lien.");
    } finally {
      setAuthSending(false);
    }
  };

  /* ----------------------------- Render States ----------------------------- */

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="border-b border-neutral-200 bg-white">
          <Container>
            <div className="py-6">
              <div className="flex items-center gap-2 text-neutral-600">
                <Loader2 className="h-4 w-4 animate-spin" /> Chargement de l’espace bénévole…
              </div>
            </div>
          </Container>
        </div>
      </div>
    );
  }

  // Not logged in -> OTP block
  if (!sessionUser) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="border-b border-neutral-200 bg-white">
          <Container>
            <div className="py-6">
              <h1 className="text-2xl font-extrabold tracking-tight">Espace Bénévole</h1>
              <p className="mt-1 text-neutral-600">
                {course?.nom ? (
                  <>
                    <span className="font-semibold">{course.nom}</span> · {course?.lieu || "—"} ·{" "}
                    {nextDate ? fmtDate(nextDate) : "—"}
                  </>
                ) : (
                  "Course"
                )}
              </p>
            </div>
          </Container>
        </div>

        <Container>
          <div className="py-10 max-w-xl">
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <ShieldCheck className="h-5 w-5 text-neutral-900" />
                </div>
                <div>
                  <div className="text-lg font-extrabold">Connexion bénévole</div>
                  <p className="mt-1 text-sm text-neutral-600">
                    Clique sur le lien reçu par email. Sinon, saisis ton email pour recevoir un nouveau lien de connexion.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <input
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="ton@email.com"
                  className="flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                />
                <Btn variant="dark" disabled={authSending || !safe(authEmail).includes("@")} onClick={requestMagicLink}>
                  {authSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Envoyer
                </Btn>
              </div>

              {err ? (
                <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
                  {err}
                </div>
              ) : (
                <div className="mt-3 text-xs text-neutral-500">
                  Astuce : utilise le même email que celui que tu as donné lors de l’inscription bénévole.
                </div>
              )}
            </Card>
          </div>
        </Container>
      </div>
    );
  }

  // Logged in but error (RLS, not volunteer, etc.)
  if (err && !benevole) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="border-b border-neutral-200 bg-white">
          <Container>
            <div className="py-6">
              <h1 className="text-2xl font-extrabold tracking-tight">Espace Bénévole</h1>
              <p className="mt-1 text-neutral-600">
                <span className="font-semibold">{course?.nom || "Course"}</span>
              </p>
            </div>
          </Container>
        </div>

        <Container>
          <div className="py-10 max-w-2xl">
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <div className="text-lg font-extrabold text-red-700">Accès impossible</div>
                  <p className="mt-1 text-sm text-neutral-700">{err}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Btn variant="light" onClick={() => window.location.reload()}>
                      Réessayer
                    </Btn>
                    <a href={contactMailTo}>
                      <Btn variant="dark">
                        <Mail className="h-4 w-4" /> Contacter le support
                      </Btn>
                    </a>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </Container>
      </div>
    );
  }

  /* ----------------------------- Main Layout ----------------------------- */

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header sticky */}
      <div className="sticky top-0 z-20 border-b border-neutral-200 bg-white/80 backdrop-blur">
        <Container>
          <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-extrabold tracking-tight">{course?.nom || "Course"}</h1>
                {statusChip}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-600">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" /> {nextDate ? fmtDate(nextDate) : "—"}
                </span>
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> {course?.lieu || "—"}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Clock3 className="h-4 w-4" /> RDV{" "}
                  {infoBlock.rendez_vous_heure ? infoBlock.rendez_vous_heure : "—"} —{" "}
                  {infoBlock.rendez_vous_lieu ? infoBlock.rendez_vous_lieu : "Accueil bénévoles"}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Btn variant="light" onClick={exportMyCalendar} disabled={!myMissions?.length}>
                <Download className="h-4 w-4" />
                Ajouter au calendrier
              </Btn>
              <a href={contactMailTo}>
                <Btn variant="light">
                  <Mail className="h-4 w-4" />
                  Contacter l’orga
                </Btn>
              </a>
            </div>
          </div>
        </Container>
      </div>

      <Container>
        <div className="grid grid-cols-1 gap-6 py-8 lg:grid-cols-12">
          {/* LEFT column */}
          <div className="space-y-6 lg:col-span-7">
            {/* Profile */}
            <Card className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-xs font-semibold text-neutral-500">Connecté(e) en tant que</div>
                  <div className="text-lg font-extrabold">
                    {benevole?.prenom} {benevole?.nom}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-600">
                    <span className="inline-flex items-center gap-2">
                      <Mail className="h-4 w-4" /> {benevole?.email}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Phone className="h-4 w-4" /> {benevole?.telephone}
                    </span>
                  </div>
                </div>

                <Pill tone="gray">
                  <ShieldCheck className="h-4 w-4" /> Espace bénévole sécurisé
                </Pill>
              </div>
            </Card>

            {/* My missions */}
            <Card className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  <h2 className="text-lg font-extrabold">Ma mission</h2>
                </div>
                <Pill
                  tone={
                    myMissions.length
                      ? ["confirmed", "checked_in"].includes(myMissions[0]?.status)
                        ? "green"
                        : "orange"
                      : "gray"
                  }
                >
                  {myMissions.length === 0
                    ? "En attente"
                    : myMissions[0]?.status === "checked_in"
                    ? "Présent"
                    : myMissions[0]?.status === "confirmed"
                    ? "Confirmée"
                    : "À confirmer"}
                </Pill>
              </div>

              {err ? (
                <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
                  {err}
                </div>
              ) : null}

              <div className="mt-4 space-y-3">
                {myMissions.length === 0 ? (
                  <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                    <div className="font-bold">Aucune mission attribuée pour le moment</div>
                    <p className="mt-1 text-sm text-neutral-600">
                      L’organisateur va te positionner bientôt. Tu peux utiliser le chat pour proposer une aide sur un poste.
                    </p>
                    <div className="mt-3">
                      <Btn
                        variant="light"
                        onClick={() => {
                          chatRef.current?.focusAndPrefill?.("Je suis dispo, besoin d’aide sur quel poste ? ");
                        }}
                      >
                        <MessageCircle className="h-4 w-4" /> Proposer mon aide
                      </Btn>
                    </div>
                  </div>
                ) : (
                  myMissions.map((m) => {
                    const poste = m?.poste || {};
                    const cr = m?.creneau || null;
                    const labelCreneau =
                      cr?.label ||
                      (cr?.start_at && cr?.end_at ? `${fmtTime(cr.start_at)} → ${fmtTime(cr.end_at)}` : "Créneau à définir");

                    return (
                      <div key={m.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="text-xl font-extrabold">{poste?.titre || "Mission"}</div>

                            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-600">
                              <span className="inline-flex items-center gap-2">
                                <Clock3 className="h-4 w-4" /> {labelCreneau}
                              </span>
                              <span className="inline-flex items-center gap-2">
                                <MapPin className="h-4 w-4" /> {poste?.lieu || course?.lieu || "—"}
                              </span>
                            </div>

                            {poste?.description ? (
                              <p className="mt-3 text-sm text-neutral-700">{poste.description}</p>
                            ) : (
                              <p className="mt-3 text-sm text-neutral-700">Consignes à venir. Utilise le chat si tu as une question.</p>
                            )}
                          </div>

                          <div className="flex shrink-0 flex-row gap-2 sm:flex-col">
                            {m.status === "assigned" ? (
                              <>
                                <Btn
                                  variant="dark"
                                  className="min-w-[150px]"
                                  disabled={busyAction}
                                  onClick={() => updateMissionStatus(m.id, "confirmed")}
                                >
                                  <CheckCircle2 className="h-4 w-4" /> Je confirme
                                </Btn>
                                <Btn
                                  variant="light"
                                  className="min-w-[150px]"
                                  disabled={busyAction}
                                  onClick={() => updateMissionStatus(m.id, "declined")}
                                >
                                  <AlertTriangle className="h-4 w-4" /> Je ne peux pas
                                </Btn>
                              </>
                            ) : m.status === "confirmed" ? (
                              <>
                                <Btn
                                  variant="orange"
                                  className="min-w-[150px]"
                                  disabled={busyAction}
                                  onClick={() => updateMissionStatus(m.id, "checked_in")}
                                >
                                  <UserCheck className="h-4 w-4" /> Je suis arrivé
                                </Btn>
                                <Btn
                                  variant="light"
                                  className="min-w-[150px]"
                                  onClick={() => {
                                    chatRef.current?.focusAndPrefill?.(`@orga J’ai une question sur "${poste?.titre || "ma mission"}" : `);
                                  }}
                                >
                                  <MessageCircle className="h-4 w-4" /> Prévenir
                                </Btn>
                              </>
                            ) : m.status === "checked_in" ? (
                              <Btn
                                variant="dark"
                                className="min-w-[150px]"
                                onClick={() => {
                                  chatRef.current?.focusAndPrefill?.(
                                    `✅ Je suis en poste "${poste?.titre || "mission"}". Besoin de quelque chose ? `
                                  );
                                }}
                              >
                                <MessageCircle className="h-4 w-4" /> Message
                              </Btn>
                            ) : (
                              <Btn
                                variant="light"
                                className="min-w-[150px]"
                                onClick={() => {
                                  chatRef.current?.focusAndPrefill?.("Je suis finalement dispo, je peux aider. ");
                                }}
                              >
                                <MessageCircle className="h-4 w-4" /> Recontacter
                              </Btn>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>

            {/* Team planning */}
            <Card className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  <h2 className="text-lg font-extrabold">Planning de l’équipe</h2>
                </div>
                <Pill tone="gray">Vue d’ensemble</Pill>
              </div>

              <div className="mt-4 space-y-3">
                {planningStats.length === 0 ? (
                  <div className="text-sm text-neutral-600">Aucun poste n’est configuré pour le moment.</div>
                ) : (
                  planningStats.map((p) => {
                    const ratio = p.need > 0 ? Math.min(100, Math.round((p.filled / p.need) * 100)) : 0;
                    const ok = p.need > 0 ? p.filled >= p.need : true;

                    return (
                      <div key={p.id} className="rounded-xl border border-neutral-200 bg-white p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-bold">{p.poste}</div>
                            <div className="mt-0.5 text-sm text-neutral-600">{p.lieu || course?.lieu || "—"}</div>
                          </div>
                          <Pill tone={ok ? "green" : "orange"}>
                            {ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                            {p.filled}/{p.need} {ok ? "OK" : "Manque"}
                          </Pill>
                        </div>

                        <div className="mt-2">
                          <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100 ring-1 ring-neutral-200">
                            <div className="h-full bg-neutral-900" style={{ width: `${ratio}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>

            {/* Infos / checklist */}
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                <h2 className="text-lg font-extrabold">Infos & checklist</h2>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-neutral-200 bg-white p-3">
                  <div className="text-xs font-semibold text-neutral-500">À prévoir</div>
                  <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                    <li>• Gilet jaune</li>
                    <li>• Lampe frontale</li>
                    <li>• Vêtements pluie</li>
                    <li>• Téléphone chargé</li>
                  </ul>
                </div>

                <div className="rounded-xl border border-neutral-200 bg-white p-3">
                  <div className="text-xs font-semibold text-neutral-500">Consignes rapides</div>
                  <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                    <li>• Arriver 10 min avant</li>
                    <li>• Signaler toute urgence</li>
                    <li>• Respecter le plan de poste</li>
                    <li>• Garder le site propre</li>
                  </ul>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {infoBlock.consignes_url ? (
                  <a href={infoBlock.consignes_url} target="_blank" rel="noreferrer">
                    <Btn variant="light">
                      <Download className="h-4 w-4" />
                      Télécharger consignes PDF
                    </Btn>
                  </a>
                ) : (
                  <Btn
                    variant="light"
                    onClick={() => {
                      chatRef.current?.focusAndPrefill?.("@orga Peux-tu partager les consignes / le PDF bénévoles ? ");
                    }}
                  >
                    <Download className="h-4 w-4" />
                    Demander les consignes
                  </Btn>
                )}

                <Btn
                  variant="subtle"
                  onClick={() => {
                    chatRef.current?.focusAndPrefill?.("Je signale un souci : ");
                  }}
                >
                  <AlertTriangle className="h-4 w-4" />
                  Signaler un souci
                </Btn>
              </div>
            </Card>
          </div>

          {/* RIGHT column (chat + shortcuts) */}
          <div className="space-y-6 lg:col-span-5">
            <Card className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  <h2 className="text-lg font-extrabold">Chat équipe</h2>
                </div>
                <Pill tone="gray">Global</Pill>
              </div>

              <div className="mt-4">
                <BenevolesChat ref={chatRef} courseId={courseId} me={{ id: sessionUser?.id, prenom: benevole?.prenom, nom: benevole?.nom }} />
                <p className="mt-2 text-xs text-neutral-500">
                  Astuce : utilise le chat pour signaler un retard, une urgence, ou un manque de matériel.
                </p>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="font-extrabold">Raccourcis</div>
                <Pill tone="gray">Jour J</Pill>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <Btn
                  variant="orange"
                  className="w-full"
                  disabled={!myMissions?.length || busyAction}
                  onClick={() => {
                    const first = myMissions?.[0];
                    if (!first) return;
                    if (first.status === "checked_in") return;
                    updateMissionStatus(first.id, "checked_in");
                  }}
                >
                  <UserCheck className="h-4 w-4" /> Je suis arrivé
                </Btn>

                <Btn variant="light" className="w-full" onClick={() => chatRef.current?.focusAndPrefill?.("Je signale un souci : ")}>
                  <AlertTriangle className="h-4 w-4" /> Signaler un souci
                </Btn>

                <a href={contactMailTo} className="w-full">
                  <Btn variant="light" className="w-full">
                    <Mail className="h-4 w-4" /> Email orga
                  </Btn>
                </a>

                <Btn variant="light" className="w-full" onClick={exportMyCalendar} disabled={!myMissions?.length}>
                  <Download className="h-4 w-4" /> Calendrier (ICS)
                </Btn>
              </div>

              <Line />

              <div className="pt-3 text-sm text-neutral-600">
                En cas d’urgence : contacte l’orga via email, ou poste un message “@orga URGENCE …” dans le chat.
              </div>
            </Card>
          </div>
        </div>
      </Container>
    </div>
  );
}

/* ----------------------------- Chat Component ----------------------------- */

const BenevolesChat = React.forwardRef(function BenevolesChat({ courseId, me }, ref) {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const listRef = useRef(null);
  const inputRef = useRef(null);

  const [nameByUserId, setNameByUserId] = useState({});

  const scrollBottom = (behavior = "smooth") => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  };

  React.useImperativeHandle(ref, () => ({
    focusAndPrefill: (prefill) => {
      inputRef.current?.focus?.();
      setText((prev) => (prev ? prev : prefill));
      setTimeout(() => scrollBottom("smooth"), 50);
    },
  }));

  const displayName = (userId) => {
    if (!userId) return "Membre";
    if (userId === me?.id) return me?.prenom || "Moi";
    return nameByUserId[userId] || "Membre";
  };

  const loadInitial = async () => {
    setLoading(true);
    try {
      // roster (best effort)
      const rosterRes = await supabase.from("benevoles").select("user_id, prenom, nom").eq("course_id", courseId);

      if (!rosterRes.error && rosterRes.data) {
        const map = {};
        rosterRes.data.forEach((b) => {
          if (!b.user_id) return;
          const name = [safe(b.prenom), safe(b.nom)].filter(Boolean).join(" ").trim();
          if (name) map[b.user_id] = name;
        });
        setNameByUserId(map);
      }

      // messages
      const { data, error } = await supabase
        .from("benevoles_chat_messages")
        .select("id, user_id, message, created_at")
        .eq("course_id", courseId)
        .order("created_at", { ascending: true })
        .limit(200);

      if (error) throw error;
      setMessages(data || []);
      setTimeout(() => scrollBottom("auto"), 50);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitial();

    const channel = supabase
      .channel(`benevoles_chat_${courseId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "benevoles_chat_messages",
          filter: `course_id=eq.${courseId}`,
        },
        (payload) => {
          const row = payload.new;
          if (!row?.id) return;

          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });

          setTimeout(() => scrollBottom("smooth"), 50);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const send = async () => {
    const t = safe(text);
    if (!t) return;
    if (!me?.id) return;

    setSending(true);
    setText("");

    const optimisticId = crypto.randomUUID();
    const optimistic = {
      id: optimisticId,
      user_id: me.id,
      message: t,
      created_at: new Date().toISOString(),
      __optimistic: true,
    };

    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => scrollBottom("smooth"), 50);

    const { error } = await supabase.from("benevoles_chat_messages").insert({
      course_id: courseId,
      user_id: me.id,
      message: t,
    });

    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      alert("Impossible d’envoyer le message.");
    }

    setSending(false);
  };

  return (
    <div className="space-y-3">
      <div ref={listRef} className="h-[420px] overflow-auto rounded-2xl border border-neutral-200 bg-white p-3">
        {loading ? (
          <div className="flex items-center gap-2 text-neutral-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement du chat…
          </div>
        ) : messages.length === 0 ? (
          <div className="text-sm text-neutral-500">Aucun message pour le moment.</div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => {
              const isMe = m.user_id === me?.id;
              return (
                <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] ${isMe ? "text-right" : ""}`}>
                    <div className="text-xs text-neutral-500">
                      <span className="font-semibold text-neutral-700">{displayName(m.user_id)}</span> ·{" "}
                      {m.created_at ? new Date(m.created_at).toLocaleString("fr-FR") : ""}
                    </div>
                    <div
                      className={[
                        "mt-1 rounded-2xl border px-3 py-2 text-sm whitespace-pre-wrap",
                        isMe ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-neutral-50 text-neutral-900",
                      ].join(" ")}
                    >
                      {m.message}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Écrire un message…"
          className="flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <Btn variant="dark" onClick={send} disabled={sending || !safe(text)}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Envoyer
        </Btn>
      </div>
    </div>
  );
});
