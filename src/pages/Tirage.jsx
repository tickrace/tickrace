// src/pages/Tirage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../supabase";
import { CalendarDays, ArrowRight, AlertCircle, Loader2, Mail, User } from "lucide-react";

/* ---------------- Utils ---------------- */
const parseDate = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const fmtDateTime = (d) => {
  const dt = typeof d === "string" ? parseDate(d) : d;
  if (!dt) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dt);
};

function isValidEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function Pill({ children }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 ring-1 ring-orange-200 px-3 py-1 text-xs text-orange-700">
      ✨ {children}
    </span>
  );
}

function Card({ children, className = "" }) {
  return <div className={`rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200 ${className}`}>{children}</div>;
}

export default function Tirage() {
  const { formatId } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [course, setCourse] = useState(null);
  const [format, setFormat] = useState(null);
  const [lottery, setLottery] = useState(null);

  // Form
  const [email, setEmail] = useState("");
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError("");
      setMsg("");

      try {
        // 1) Format
        const { data: f, error: eF } = await supabase
          .from("formats")
          .select("id, nom, date, heure_depart, course_id, prix, distance_km, denivele_dplus, denivele_dmoins, type_epreuve")
          .eq("id", formatId)
          .maybeSingle();

        if (eF || !f) {
          console.error("FORMAT_ERROR", eF);
          setError("Format introuvable.");
          setLoading(false);
          return;
        }
        setFormat(f);

        // 2) Course (nom + lieu pour contexte)
        const { data: c, error: eC } = await supabase
          .from("courses")
          .select("id, nom, lieu, departement, image_url, en_ligne")
          .eq("id", f.course_id)
          .maybeSingle();

        if (!eC && c) setCourse(c);

        // 3) Lottery settings (si table accessible)
        try {
          const { data: l, error: eL } = await supabase
            .from("format_lottery_settings")
            .select("format_id, enabled, pre_open_at, pre_close_at, pre_closed_at, draw_at, invite_ttl_hours")
            .eq("format_id", formatId)
            .maybeSingle();

          if (!eL && l) setLottery(l);
          else setLottery(null);
        } catch {
          setLottery(null);
        }

        setLoading(false);
      } catch (e) {
        console.error(e);
        setError("Erreur de chargement.");
        setLoading(false);
      }
    };

    run();
  }, [formatId]);

  const phase = useMemo(() => {
    const now = new Date();

    if (!lottery || lottery?.enabled !== true) {
      return { key: "disabled", label: "Tirage non activé" };
    }

    const openAt = parseDate(lottery.pre_open_at);
    const closeAt = parseDate(lottery.pre_closed_at || lottery.pre_close_at);
    const drawAt = parseDate(lottery.draw_at);

    if (openAt && now < openAt) return { key: "soon", label: "Préinscription bientôt" };
    if (closeAt && now > closeAt) {
      if (drawAt && now >= drawAt) return { key: "drawn", label: "Tirage effectué" };
      return { key: "closed", label: "Préinscriptions fermées" };
    }
    return { key: "open", label: "Préinscriptions ouvertes" };
  }, [lottery]);

  const onSubmit = async () => {
    setMsg("");
    const e = String(email || "").trim().toLowerCase();
    if (!format?.id) return setMsg("Format introuvable.");
    if (!isValidEmail(e)) return setMsg("Email invalide.");

    setSaving(true);
    try {
      // ✅ on n’envoie PAS "status" ici pour éviter une erreur si la colonne n’existe pas
      const payload = {
        course_id: format.course_id,
        format_id: format.id,
        email: e,
        prenom: prenom ? prenom.trim() : null,
        nom: nom ? nom.trim() : null,
      };

      const { error } = await supabase.from("format_preinscriptions").insert(payload);

      if (error) {
        if (error.code === "23505") {
          setMsg("Tu es déjà préinscrit(e) sur ce tirage.");
        } else {
          console.error("PREINSCRIPTION_ERROR", error);
          setMsg("Impossible d’enregistrer ta préinscription (accès restreint ?).");
        }
        return;
      }

      setMsg("✅ Préinscription enregistrée. Tu recevras un email si tu es invité(e).");
      setEmail("");
      setPrenom("");
      setNom("");
    } catch (e) {
      console.error(e);
      setMsg("Erreur lors de la préinscription.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 flex items-center gap-3 text-neutral-600">
        <Loader2 className="w-5 h-5 animate-spin" />
        Chargement du tirage…
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
        <h1 className="text-xl font-semibold">Tirage</h1>
        <p className="text-neutral-600 mt-2">{error}</p>
        <Link
          to="/courses"
          className="inline-flex mt-5 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
        >
          ← Retour aux épreuves
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold">Tirage au sort</h1>
            <Pill>{phase.label}</Pill>
          </div>

          <div className="mt-2 text-neutral-600">
            {course?.nom ? (
              <>
                Épreuve :{" "}
                <Link to={`/courses/${course.id}`} className="font-semibold text-neutral-900 hover:underline">
                  {course.nom}
                </Link>
                {course?.lieu ? ` — ${course.lieu}${course.departement ? ` (${course.departement})` : ""}` : ""}
              </>
            ) : (
              "Épreuve"
            )}
          </div>

          <div className="mt-2 text-neutral-700">
            <span className="font-semibold">{format?.nom}</span>
            {format?.date ? (
              <span className="ml-2 inline-flex items-center gap-1 text-sm text-neutral-600">
                <CalendarDays className="w-4 h-4" />
                {fmtDateTime(format.date)}
                {format.heure_depart ? ` • ${format.heure_depart}` : ""}
              </span>
            ) : null}
          </div>
        </div>

        {course?.id && (
          <Link
            to={`/courses/${course.id}`}
            className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-white text-sm font-semibold hover:bg-black"
          >
            Voir l’épreuve <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-4">
          <Card className="p-5">
            <h2 className="text-lg font-semibold">Comment ça marche</h2>
            <p className="mt-2 text-sm text-neutral-700 leading-relaxed">
              Certaines épreuves utilisent une phase de <strong>préinscription</strong> (liste de candidats), puis un{" "}
              <strong>tirage au sort</strong>. Si tu es sélectionné(e), tu reçois une invitation par email pour finaliser
              ton inscription.
            </p>

            <div className="mt-4 text-sm text-neutral-700 space-y-1">
              <div>
                <span className="text-neutral-500">Ouverture :</span>{" "}
                <strong>{lottery?.pre_open_at ? fmtDateTime(lottery.pre_open_at) : "—"}</strong>
              </div>
              <div>
                <span className="text-neutral-500">Clôture :</span>{" "}
                <strong>{(lottery?.pre_closed_at || lottery?.pre_close_at) ? fmtDateTime(lottery.pre_closed_at || lottery.pre_close_at) : "—"}</strong>
              </div>
              <div>
                <span className="text-neutral-500">Tirage :</span>{" "}
                <strong>{lottery?.draw_at ? fmtDateTime(lottery.draw_at) : "—"}</strong>
              </div>
            </div>

            {phase.key === "disabled" && (
              <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
                Ce format n’a pas de tirage activé (ou la table n’est pas accessible publiquement).
              </div>
            )}

            {phase.key === "soon" && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                La préinscription n’est pas encore ouverte.
              </div>
            )}

            {phase.key === "closed" && (
              <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
                Les préinscriptions sont terminées. Le tirage sera annoncé ici (et par email si tu as été invité(e)).
              </div>
            )}

            {phase.key === "drawn" && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                ✅ Le tirage a été effectué. Si tu as été sélectionné(e), tu as dû recevoir une invitation par email.
              </div>
            )}
          </Card>
        </div>

        <div className="lg:col-span-5">
          <Card className="p-5">
            <h2 className="text-lg font-semibold">Préinscription</h2>

            {phase.key !== "open" ? (
              <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
                La préinscription n’est pas disponible actuellement.
              </div>
            ) : (
              <>
                <p className="mt-2 text-sm text-neutral-700">
                  Renseigne ton email pour participer au tirage. Tu recevras une invitation si tu es sélectionné(e).
                </p>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-sm font-medium">Email *</label>
                    <div className="mt-1 relative">
                      <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-xl border border-neutral-300 pl-10 pr-3 py-2"
                        placeholder="ton@email.com"
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium">Prénom</label>
                      <div className="mt-1 relative">
                        <User className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          value={prenom}
                          onChange={(e) => setPrenom(e.target.value)}
                          className="w-full rounded-xl border border-neutral-300 pl-10 pr-3 py-2"
                          placeholder="Prénom"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Nom</label>
                      <input
                        value={nom}
                        onChange={(e) => setNom(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
                        placeholder="Nom"
                      />
                    </div>
                  </div>

                  {msg && (
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800">
                      {msg}
                    </div>
                  )}

                  <button
                    onClick={onSubmit}
                    disabled={saving}
                    className={[
                      "w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white",
                      saving ? "bg-neutral-400" : "bg-neutral-900 hover:bg-black",
                    ].join(" ")}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Enregistrement…
                      </>
                    ) : (
                      <>
                        Participer au tirage <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="text-xs text-neutral-500">
                    * L’organisation pourra te contacter uniquement pour cette épreuve.
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
