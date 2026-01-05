// src/pages/MesInscriptions.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";
import { Link, useNavigate } from "react-router-dom";

/* Utils */
const formatDate = (d) =>
  d
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(typeof d === "string" ? new Date(d) : d)
    : "";

/* UI atoms */
const Container = ({ children }) => (
  <div className="mx-auto w-full max-w-4xl px-4 py-8">{children}</div>
);

const Skeleton = () => (
  <div className="min-h-screen bg-neutral-50 text-neutral-900">
    <section className="bg-white border-b border-neutral-200">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="h-6 w-48 bg-neutral-100 rounded mb-2" />
        <div className="h-4 w-80 bg-neutral-100 rounded" />
      </div>
    </section>
    <Container>
      <div className="grid gap-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-2xl ring-1 ring-neutral-200 bg-white p-5">
            <div className="h-5 w-1/3 bg-neutral-100 rounded mb-2" />
            <div className="h-4 w-2/3 bg-neutral-100 rounded mb-1" />
            <div className="h-4 w-1/2 bg-neutral-100 rounded" />
          </div>
        ))}
      </div>
    </Container>
  </div>
);

function EmptyState() {
  return (
    <div className="rounded-2xl ring-1 ring-neutral-200 bg-white p-10 text-center">
      <h3 className="text-lg font-semibold">Aucune inscription pour le moment</h3>
      <p className="mt-1 text-neutral-600">Parcourez les épreuves et trouvez votre prochaine course.</p>
      <Link
        to="/courses"
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
      >
        Explorer les courses
      </Link>
    </div>
  );
}

function StatusPill({ statut }) {
  const s = String(statut || "").toLowerCase();

  const cfg = (() => {
    if (["paye", "payé"].includes(s)) return { cls: "bg-green-50 ring-green-200 text-green-800", label: "Payé" };
    if (["valide", "validé", "confirme", "confirmé"].includes(s))
      return { cls: "bg-green-50 ring-green-200 text-green-800", label: "Validé" };
    if (["en attente", "en_attente", "pending"].includes(s))
      return { cls: "bg-amber-50 ring-amber-200 text-amber-900", label: "En attente" };
    if (["annule", "annulé", "cancelled"].includes(s))
      return { cls: "bg-gray-100 ring-gray-200 text-gray-700", label: "Annulé" };
    return { cls: "bg-gray-100 ring-gray-200 text-gray-700", label: statut || "—" };
  })();

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs ring-1 ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

export default function MesInscriptions() {
  const { session } = useUser();
  const navigate = useNavigate();

  const [inscriptions, setInscriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pour éviter de casser le site si la requête “riche” échoue (RLS, relation, etc.)
  const safeCourseId = (ins) => ins?.format?.course?.id || ins?.format?.course_id || ins?.course_id || null;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const sess = session ?? (await supabase.auth.getSession()).data?.session;
        if (!sess?.user) {
          navigate(`/login?next=${encodeURIComponent("/mesinscriptions")}`);
          return;
        }
        const rows = await fetchInscriptions(sess.user);
        if (!cancelled) setInscriptions(rows);
      } catch (e) {
        console.error("MesInscriptions init error:", e);
        if (!cancelled) setInscriptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function fetchInscriptions(user) {
    const uid = user.id;
    const uemail = user.email || "";

    // 1) inscriptions où tu es le coureur
    const { data: asRunner, error: e1 } = await supabase.from("inscriptions").select("id").eq("coureur_id", uid);
    if (e1) console.warn("asRunner error:", e1?.message);

    // 2) inscriptions payées par toi (via paiements) — ⚠️ si user_id n’existe pas en table paiements, on ignore
    let pays = [];
    try {
      const r = await supabase.from("paiements").select("inscription_id, inscription_ids").eq("user_id", uid);
      if (r.error) console.warn("pays error:", r.error?.message);
      pays = r.data || [];
    } catch (e) {
      console.warn("paiements user_id query skipped:", e);
    }

    const paidIds = new Set();
    for (const p of pays || []) {
      if (p?.inscription_id) paidIds.add(p.inscription_id);
      if (Array.isArray(p?.inscription_ids)) {
        for (const x of p.inscription_ids) if (x) paidIds.add(x);
      }
    }

    // 3) groupes où tu es capitaine
    const { data: groups, error: e3 } = await supabase
      .from("inscriptions_groupes")
      .select("id")
      .eq("capitaine_user_id", uid);
    if (e3) console.warn("groups error:", e3?.message);

    let groupInscr = [];
    if (groups?.length) {
      const gIds = groups.map((g) => g.id);

      // a) ancien modèle : groupe_id
      const { data: d3a, error: e3a } = await supabase.from("inscriptions").select("id").in("groupe_id", gIds);
      if (e3a) console.warn("groupInscr (groupe_id) error:", e3a?.message);

      // b) nouveau modèle : member_of_group_id
      const { data: d3b, error: e3b } = await supabase
        .from("inscriptions")
        .select("id")
        .in("member_of_group_id", gIds);
      if (e3b) console.warn("groupInscr (member_of_group_id) error:", e3b?.message);

      groupInscr = [...(d3a || []), ...(d3b || [])];
    }

    // 4) inscriptions liées à ton email
    let emailInscr = [];
    if (uemail) {
      const { data: d4, error: e4 } = await supabase.from("inscriptions").select("id").eq("email", uemail);
      if (e4) console.warn("emailInscr error:", e4?.message);
      emailInscr = d4 || [];
    }

    // Déduplication
    const ids = new Set();
    for (const r of asRunner || []) if (r?.id) ids.add(r.id);
    for (const id of paidIds) if (id) ids.add(id);
    for (const r of groupInscr || []) if (r?.id) ids.add(r.id);
    for (const r of emailInscr || []) if (r?.id) ids.add(r.id);

    const finalIds = Array.from(ids);
    if (finalIds.length === 0) return [];

    // Requête riche (relations). Si ça plante (RLS/relations), fallback en mode “simple”
    const richSelect = `
      id, statut, created_at, email, course_id, format_id, team_name, groupe_id, member_of_group_id,
      format:format_id (
        id, nom, distance_km, denivele_dplus, date, type_format, course_id,
        course:course_id ( id, nom, lieu, image_url )
      )
    `;

    const { data: rich, error: eRich } = await supabase
      .from("inscriptions")
      .select(richSelect)
      .in("id", finalIds)
      .order("created_at", { ascending: false });

    if (!eRich) return rich || [];

    console.error("MesInscriptions rich query failed, fallback:", eRich.message);

    // Fallback minimal (évite page blanche)
    const { data: basic, error: eBasic } = await supabase
      .from("inscriptions")
      .select("id, statut, created_at, email, course_id, format_id, team_name, groupe_id, member_of_group_id")
      .in("id", finalIds)
      .order("created_at", { ascending: false });

    if (eBasic) {
      console.error("MesInscriptions basic query failed:", eBasic.message);
      return [];
    }

    // On tente de recharger formats + courses séparément pour l’affichage (best-effort)
    const formatIds = [...new Set((basic || []).map((x) => x.format_id).filter(Boolean))];
    const courseIds = [...new Set((basic || []).map((x) => x.course_id).filter(Boolean))];

    const [formatsRes, coursesRes] = await Promise.all([
      formatIds.length
        ? supabase
            .from("formats")
            .select("id, nom, distance_km, denivele_dplus, date, type_format, course_id")
            .in("id", formatIds)
        : Promise.resolve({ data: [], error: null }),
      courseIds.length ? supabase.from("courses").select("id, nom, lieu, image_url").in("id", courseIds) : Promise.resolve({ data: [], error: null }),
    ]);

    const formatsMap = new Map((formatsRes.data || []).map((f) => [f.id, f]));
    const coursesMap = new Map((coursesRes.data || []).map((c) => [c.id, c]));

    return (basic || []).map((ins) => {
      const fmt = formatsMap.get(ins.format_id) || null;
      const c = coursesMap.get(ins.course_id || fmt?.course_id) || null;
      return {
        ...ins,
        format: fmt
          ? {
              ...fmt,
              course: c || null,
            }
          : null,
      };
    });
  }

  const list = useMemo(() => inscriptions || [], [inscriptions]);

  if (loading) return <Skeleton />;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Header */}
      <section className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-7xl px-4 py-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-neutral-900">
            Mes Inscriptions{" "}
            <span className="font-black">
              <span className="text-orange-600">Tick</span>Race
            </span>
          </h1>
          <p className="mt-2 text-neutral-600 text-base">Retrouvez vos inscriptions (solo, équipe, et paiements).</p>
        </div>
      </section>

      <Container>
        {list.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="grid gap-5">
            {list.map((inscription) => {
              const id = inscription.id;
              const format = inscription.format || null;
              const course = format?.course || null;

              const groupId = inscription.member_of_group_id || inscription.groupe_id || null;

              const isTeam =
                !!groupId ||
                (format?.type_format && String(format.type_format).toLowerCase() !== "individuel") ||
                !!inscription.team_name;

              const detailUrl = groupId ? `/mon-inscription-equipe/${groupId}` : `/mon-inscription/${id}`;
              const courseId = safeCourseId(inscription);

              return (
                <li
                  key={id}
                  className="overflow-hidden rounded-2xl ring-1 ring-neutral-200 bg-white shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col md:flex-row">
                    {/* Cover */}
                    <div className="md:w-48 flex-shrink-0 bg-neutral-100">
                      {course?.image_url ? (
                        <img
                          src={course.image_url}
                          alt={course?.nom || "Course"}
                          className="h-36 md:h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-36 md:h-full w-full grid place-items-center text-sm text-neutral-400">
                          Pas d’image
                        </div>
                      )}
                    </div>

                    {/* Body */}
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-semibold leading-snug">{format?.nom || "Format"}</h2>
                          <p className="text-sm text-neutral-600">
                            {course?.nom ? `${course.nom}${course?.lieu ? ` — ${course.lieu}` : ""}` : "Course"}
                          </p>
                        </div>
                        <StatusPill statut={inscription.statut} />
                      </div>

                      <div className="mt-2 text-sm text-neutral-700 flex flex-wrap gap-x-4 gap-y-1">
                        {format?.distance_km != null && <span>🏁 {format.distance_km} km</span>}
                        {format?.denivele_dplus != null && <span>⛰️ {format.denivele_dplus} m D+</span>}
                        {format?.date && <span>📅 {formatDate(format.date)}</span>}
                        {isTeam && <span>👥 Inscription équipe</span>}
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-2">
                        <Link
                          to={courseId ? `/courses/${courseId}` : "/courses"}
                          className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                        >
                          Voir la page
                        </Link>

                        <Link
                          to={detailUrl}
                          className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:brightness-110"
                        >
                          {isTeam ? "Voir l’inscription équipe" : "Voir / Modifier"}
                        </Link>
                      </div>

                      {/* debug doux (utile sans casser) */}
                      <div className="mt-3 text-[11px] text-neutral-400">
                        ID: {id}
                        {groupId ? ` • Groupe: ${groupId}` : ""}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Container>
    </div>
  );
}
