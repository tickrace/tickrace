// src/pages/TiragePublic.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CalendarDays, Loader2, Search, Info, AlertTriangle, CheckCircle2, Hash, Mail, BadgeCheck } from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "../supabase";

const Container = ({ children }) => (
  <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-8">{children}</div>
);

const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 ${className}`}>{children}</div>
);

const Input = (props) => (
  <input
    {...props}
    className={[
      "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm",
      "focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300",
      props.className || "",
    ].join(" ")}
  />
);

const Button = ({ children, className = "", disabled, onClick, type = "button" }) => (
  <button
    type={type}
    disabled={disabled}
    onClick={onClick}
    className={[
      "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition",
      "ring-1 ring-gray-200 bg-white text-gray-900 hover:bg-gray-50",
      "disabled:opacity-60 disabled:cursor-not-allowed",
      className,
    ].join(" ")}
  >
    {children}
  </button>
);

const fmtDT = (d) => {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    return dt.toLocaleString("fr-FR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return String(d);
  }
};

const badge = (status) => {
  const base = "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ring-1";
  if (status === "pending") return <span className={`${base} bg-gray-50 ring-gray-200 text-gray-700`}><Info className="h-4 w-4" /> pending</span>;
  if (status === "ranked") return <span className={`${base} bg-violet-50 ring-violet-200 text-violet-800`}><Hash className="h-4 w-4" /> ranked</span>;
  if (status === "invited" || status === "direct_invited") return <span className={`${base} bg-blue-50 ring-blue-200 text-blue-700`}><Mail className="h-4 w-4" /> {status}</span>;
  if (status === "registered") return <span className={`${base} bg-green-50 ring-green-200 text-green-700`}><BadgeCheck className="h-4 w-4" /> registered</span>;
  if (status === "expired") return <span className={`${base} bg-amber-50 ring-amber-200 text-amber-800`}><AlertTriangle className="h-4 w-4" /> expired</span>;
  if (status === "withdrawn") return <span className={`${base} bg-gray-50 ring-gray-200 text-gray-700`}><AlertTriangle className="h-4 w-4" /> withdrawn</span>;
  return <span className={`${base} bg-gray-50 ring-gray-200 text-gray-700`}>{status}</span>;
};

export default function TiragePublic() {
  const { id } = useParams(); // peut être courseId OU formatId
  const [sp] = useSearchParams();
  const inviteToken = sp.get("invite") || ""; // optionnel (reçu par email)
  const prefillEmail = sp.get("email") || "";

  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState(null); // "course" | "format"
  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);
  const [format, setFormat] = useState(null);
  const [settings, setSettings] = useState(null);

  const [email, setEmail] = useState(prefillEmail);
  const [statusRow, setStatusRow] = useState(null); // format_preinscriptions row enriched with rank/invite

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setStatusRow(null);

    try {
      // 1) try format
      const { data: f, error: fe } = await supabase
        .from("formats")
        .select("id, course_id, nom, date, heure_depart, nb_max_coureurs, is_team_event, team_size")
        .eq("id", id)
        .maybeSingle();

      if (fe) throw fe;

      if (f?.id) {
        setMode("format");
        setFormat(f);

        const { data: c, error: ce } = await supabase
          .from("courses")
          .select("id, nom, lieu")
          .eq("id", f.course_id)
          .single();
        if (ce) throw ce;
        setCourse(c);

        const { data: s, error: se } = await supabase
          .from("format_lottery_settings")
          .select("enabled, pre_open_at, pre_close_at, draw_at, invite_ttl_hours")
          .eq("format_id", f.id)
          .maybeSingle();
        if (se) throw se;
        setSettings(s);

        return;
      }

      // 2) else: course mode
      const { data: c2, error: ce2 } = await supabase
        .from("courses")
        .select("id, nom, lieu")
        .eq("id", id)
        .single();
      if (ce2) throw ce2;

      setMode("course");
      setCourse(c2);

      const { data: fs, error: fse } = await supabase
        .from("formats")
        .select("id, nom, date, heure_depart, nb_max_coureurs")
        .eq("course_id", c2.id)
        .order("date", { ascending: true });
      if (fse) throw fse;
      setFormats(fs || []);
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Impossible de charger la page tirage.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const checkStatus = async () => {
    if (!format?.id) return;
    const e = String(email || "").trim().toLowerCase();
    if (!e) return toast.error("Entre ton email.");

    try {
      setLoading(true);

      const { data: pre, error: pe } = await supabase
        .from("format_preinscriptions")
        .select(
          `
          id, email, status, created_at, withdrawn_at,
          lottery_ranks:lottery_ranks(rank, draw_id),
          lottery_invites:lottery_invites(invited_at, expires_at, used_at, batch_no)
        `
        )
        .eq("format_id", format.id)
        .ilike("email", e) // ok pour emails
        .maybeSingle();

      if (pe) throw pe;

      if (!pre?.id) {
        setStatusRow(null);
        toast("Aucune préinscription trouvée pour cet email.");
        return;
      }

      const rank = Array.isArray(pre.lottery_ranks) && pre.lottery_ranks.length ? pre.lottery_ranks[0].rank : null;
      const invite = Array.isArray(pre.lottery_invites) && pre.lottery_invites.length ? pre.lottery_invites[0] : null;
      setStatusRow({ ...pre, rank, invite });
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Erreur lors de la vérification.");
    } finally {
      setLoading(false);
    }
  };

  const inscriptionUrl = useMemo(() => {
    if (!course?.id || !format?.id) return "#";
    const u = new URL(`/inscription/${course.id}`, window.location.origin);
    u.searchParams.set("formatId", format.id);
    if (inviteToken) u.searchParams.set("invite", inviteToken);
    return u.pathname + u.search;
  }, [course?.id, format?.id, inviteToken]);

  if (loading) {
    return (
      <Container>
        <div className="flex items-center gap-3 text-gray-700">
          <Loader2 className="h-5 w-5 animate-spin" />
          <div>Chargement…</div>
        </div>
      </Container>
    );
  }

  // Mode course (landing)
  if (mode === "course") {
    return (
      <Container>
        <div className="mb-4">
          <div className="text-2xl font-semibold text-gray-900">Tirage au sort</div>
          <div className="text-sm text-gray-600 mt-1">
            <div className="font-medium text-gray-900">{course?.nom}</div>
            <div className="mt-1 inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4" /> {course?.lieu || "—"}
            </div>
          </div>
        </div>

        <Card>
          <div className="p-5">
            <div className="text-sm text-gray-700">
              Choisis ton format pour consulter ton statut de préinscription.
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              {(formats || []).map((f) => (
                <Link
                  key={f.id}
                  to={`/tirage/${f.id}`}
                  className="rounded-2xl ring-1 ring-gray-200 hover:ring-orange-300 bg-white p-4 transition"
                >
                  <div className="font-semibold text-gray-900">{f.nom || "Format"}</div>
                  <div className="text-sm text-gray-600 mt-1">{fmtDT(f.date)}</div>
                </Link>
              ))}
              {!formats?.length ? <div className="text-sm text-gray-600">Aucun format.</div> : null}
            </div>
          </div>
        </Card>
      </Container>
    );
  }

  // Mode format (status check)
  return (
    <Container>
      <div className="mb-4">
        <div className="text-2xl font-semibold text-gray-900">Résultat / Statut</div>
        <div className="text-sm text-gray-600 mt-1">
          <div className="font-medium text-gray-900">{course?.nom}</div>
          <div className="mt-1">
            <span className="text-gray-800 font-medium">{format?.nom || "Format"}</span>
            <span className="mx-2 text-gray-300">•</span>
            <span>{fmtDT(format?.date)}</span>
          </div>
        </div>
      </div>

      <Card>
        <div className="p-5">
          <div className="rounded-2xl bg-gray-50 ring-1 ring-gray-200 p-4 text-sm text-gray-700">
            <div className="font-semibold text-gray-900">Comment lire ton statut ?</div>
            <div className="mt-1">
              <div>• <b>pending</b> : tu es bien dans la liste, le tirage n’est pas lancé (ou pas encore pris en compte).</div>
              <div>• <b>ranked</b> : un rang t’a été attribué, mais tu n’es pas encore invité.</div>
              <div>• <b>invited</b> : tu as reçu un email avec un lien d’inscription (avec expiration).</div>
              <div>• <b>registered</b> : inscription finalisée.</div>
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="flex-1 relative">
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ton email de préinscription"
                className="pl-9"
              />
            </div>
            <Button onClick={checkStatus}>
              <Search className="h-4 w-4" /> Vérifier
            </Button>
          </div>

          {statusRow ? (
            <div className="mt-4 rounded-2xl ring-1 ring-gray-200 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-semibold text-gray-900">{statusRow.email}</div>
                {badge(statusRow.status)}
                {statusRow.rank ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-violet-50 ring-1 ring-violet-200 px-3 py-1 text-xs text-violet-800">
                    <Hash className="h-4 w-4" /> Rang {statusRow.rank}
                  </span>
                ) : null}
              </div>

              <div className="text-sm text-gray-700 mt-3 space-y-1">
                <div>Préinscription : <b>{fmtDT(statusRow.created_at)}</b></div>
                {statusRow.invite?.invited_at ? <div>Invitation : <b>{fmtDT(statusRow.invite.invited_at)}</b></div> : null}
                {statusRow.invite?.expires_at ? <div>Expiration : <b>{fmtDT(statusRow.invite.expires_at)}</b></div> : null}
              </div>

              {statusRow.status === "invited" || statusRow.status === "direct_invited" ? (
                <div className="mt-4">
                  {inviteToken ? (
                    <Link
                      to={inscriptionUrl}
                      className="inline-flex items-center gap-2 rounded-xl bg-orange-600 text-white px-4 py-2 text-sm font-semibold hover:bg-orange-700"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Finaliser mon inscription
                    </Link>
                  ) : (
                    <div className="rounded-xl bg-amber-50 ring-1 ring-amber-200 p-3 text-sm text-amber-900 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5" />
                      <div>
                        Pour finaliser, utilise le lien reçu par email (il contient ton token d’invitation).
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 text-sm text-gray-600">
              Entre ton email puis clique sur “Vérifier”.
            </div>
          )}

          <div className="mt-6 text-xs text-gray-500">
            Astuce : si tu es organisateur, utilise l’espace <Link className="underline text-orange-700" to={`/organisateur/tirage/${format?.id}`}>Tirage</Link>.
          </div>
        </div>
      </Card>
    </Container>
  );
}
