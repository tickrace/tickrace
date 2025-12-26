// src/pages/ListeBenevoles.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";
import { Link } from "react-router-dom";
import {
  Users,
  Search,
  Copy,
  ExternalLink,
  RefreshCcw,
  Mail,
  Loader2,
  Download,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";

/* ------------------------------ UI Helpers ------------------------------ */

const Container = ({ children }) => (
  <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
);

const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200 ${className}`}>{children}</div>
);

const Pill = ({ tone = "gray", children }) => {
  const map = {
    gray: "bg-neutral-100 text-neutral-700 ring-neutral-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    orange: "bg-orange-50 text-orange-700 ring-orange-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
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

const Input = (props) => (
  <input
    {...props}
    className={[
      "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none",
      "focus:ring-2 focus:ring-orange-300",
      props.className || "",
    ].join(" ")}
  />
);

function fmtDateTime(d) {
  try {
    if (!d) return "—";
    const dd = new Date(d);
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(dd);
  } catch {
    return "—";
  }
}

function csvCell(s) {
  const v = (s ?? "").toString();
  return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

const safe = (s) => (s || "").toString().trim().toLowerCase();

/* ====================================================================== */

export default function ListeBenevoles() {
  const { session } = useUser();
  const userId = session?.user?.id || null;

  const [loading, setLoading] = useState(true);
  const [busyInvite, setBusyInvite] = useState(false);

  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("all");

  const [benevoles, setBenevoles] = useState([]);
  const [q, setQ] = useState("");

  const [selectedIds, setSelectedIds] = useState(new Set());

  const [toast, setToast] = useState("");
  const [err, setErr] = useState("");

  const publicLink = useMemo(() => {
    if (selectedCourseId === "all") return null;
    return `${window.location.origin}/benevole/${selectedCourseId}`;
  }, [selectedCourseId]);

  const stats = useMemo(() => {
    const total = benevoles.length;
    const active = benevoles.filter((b) => b.status === "active").length;
    const invited = benevoles.filter((b) => b.status === "invited").length;
    const registered = benevoles.filter((b) => b.status === "registered").length;
    const disabled = benevoles.filter((b) => b.status === "disabled").length;
    const relances = benevoles.reduce((acc, b) => acc + (b.invite_count || 0), 0);
    return { total, active, invited, registered, disabled, relances };
  }, [benevoles]);

  const filtered = useMemo(() => {
    const needle = safe(q);
    let list = benevoles;

    if (needle) {
      list = list.filter((b) => {
        const hay = [
          b?.prenom,
          b?.nom,
          b?.email,
          b?.telephone,
          b?.status,
          b?.course?.nom,
          b?.course?.lieu,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(needle);
      });
    }

    return list;
  }, [benevoles, q]);

  /* ------------------------------ Fetch ------------------------------ */

  const loadCourses = async () => {
    const { data, error } = await supabase
      .from("courses")
      .select("id, nom, lieu, created_at")
      .eq("organisateur_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  };

  const loadBenevoles = async (courseId, courseIdsAll) => {
    let query = supabase
      .from("benevoles")
      .select(
        `
        id, course_id, user_id,
        nom, prenom, email, telephone,
        created_at,
        status, invited_at, last_invite_at, invite_count,
        course:courses ( id, nom, lieu )
      `
      )
      .order("created_at", { ascending: false });

    if (courseId !== "all") {
      query = query.eq("course_id", courseId);
    } else if (courseIdsAll?.length) {
      query = query.in("course_id", courseIdsAll);
    } else {
      return [];
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  };

  const refresh = async () => {
    if (!userId) return;
    setLoading(true);
    setErr("");
    try {
      const c = await loadCourses();
      setCourses(c);

      const allIds = c.map((x) => x.id);
      const b = await loadBenevoles(selectedCourseId, allIds);
      setBenevoles(b);

      setSelectedIds(new Set());
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Erreur chargement");
      setCourses([]);
      setBenevoles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const allIds = courses.map((x) => x.id);
        const b = await loadBenevoles(selectedCourseId, allIds);
        setBenevoles(b);
        setSelectedIds(new Set());
      } catch (e) {
        console.error(e);
        setErr(e?.message || "Erreur chargement bénévoles");
        setBenevoles([]);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId]);

  /* ------------------------------ Selection ------------------------------ */

  function toggleAll() {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((r) => r.id)));
  }
  function toggleOne(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /* ------------------------------ Actions ------------------------------ */

  const copyLink = async () => {
    if (!publicLink) return;
    try {
      await navigator.clipboard.writeText(publicLink);
      setToast("Lien copié ✅");
      setTimeout(() => setToast(""), 1800);
    } catch {
      setToast("Impossible de copier le lien.");
      setTimeout(() => setToast(""), 1800);
    }
  };

  const inviteBenevoles = async () => {
    if (busyInvite) return;
    if (selectedCourseId === "all") {
      setToast("Sélectionne une épreuve pour inviter.");
      setTimeout(() => setToast(""), 2200);
      return;
    }

    setBusyInvite(true);
    setErr("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error("Session invalide.");

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-benevoles`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ courseId: selectedCourseId }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || `Erreur invitation (${res.status})`);

      const sent = (json.results || []).filter((r) => r.sent).length;
      const skipped = (json.results || []).filter((r) => r.skipped).length;

      setToast(`Invitations envoyées : ${sent}${skipped ? ` (ignorées: ${skipped})` : ""}`);
      setTimeout(() => setToast(""), 2600);

      const allIds = courses.map((x) => x.id);
      const b = await loadBenevoles(selectedCourseId, allIds);
      setBenevoles(b);
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Échec invitation");
    } finally {
      setBusyInvite(false);
    }
  };

  function exportCSV() {
    const headers = [
      "Course",
      "Lieu",
      "Nom",
      "Prénom",
      "Email",
      "Téléphone",
      "Statut",
      "Relances",
      "1ère invitation",
      "Dernière invitation",
      "Connecté",
      "Inscrit le",
    ];
    const lines = [headers.join(";")];

    filtered.forEach((b) => {
      const cols = [
        b.course?.nom || "",
        b.course?.lieu || "",
        b.nom || "",
        b.prenom || "",
        b.email || "",
        b.telephone || "",
        b.status || "",
        String(b.invite_count || 0),
        b.invited_at ? fmtDateTime(b.invited_at) : "",
        b.last_invite_at ? fmtDateTime(b.last_invite_at) : "",
        b.user_id ? "oui" : "non",
        b.created_at ? fmtDateTime(b.created_at) : "",
      ];
      lines.push(cols.map(csvCell).join(";"));
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "benevoles.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* ------------------------------ Render ------------------------------ */

  if (!userId) {
    return (
      <Container>
        <div className="py-10">
          <h1 className="text-2xl font-extrabold">Bénévoles</h1>
          <p className="mt-2 text-neutral-600">Connecte-toi pour accéder à tes bénévoles.</p>
        </div>
      </Container>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Container>
        {/* Header */}
        <div className="py-8 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">Bénévoles</h1>
              <p className="mt-1 text-sm text-neutral-600">
                Gestion simple : liste + invitation + lien vers l’espace bénévole.
              </p>
            </div>

            <Link
              to="/mon-espace"
              className="text-sm text-neutral-600 hover:text-neutral-900 underline underline-offset-4"
            >
              ← Retour à mon espace
            </Link>
          </div>

          {toast ? (
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
              {toast}
            </div>
          ) : null}

          {err ? (
            <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
              {err}
            </div>
          ) : null}

          {/* Filters */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <Card className="p-4 lg:col-span-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="inline-flex items-center gap-2">
                  <span className="text-sm text-neutral-700">Épreuve</span>
                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="rounded-xl border border-neutral-200 px-3 py-2 text-sm bg-white"
                  >
                    <option value="all">Toutes mes épreuves</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nom} — {c.lieu}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="relative w-full sm:ml-auto sm:max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Recherche (nom, email, statut, course...)"
                    className="pl-9"
                  />
                </div>

                <Btn variant="light" onClick={exportCSV} disabled={filtered.length === 0}>
                  <Download className="h-4 w-4" /> Export CSV
                </Btn>

                <Btn variant="light" onClick={refresh}>
                  <RefreshCcw className="h-4 w-4" /> Actualiser
                </Btn>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-neutral-600">
                <Pill tone="gray">
                  <Users className="h-4 w-4" /> {stats.total} total
                </Pill>
                <Pill tone="green">
                  <CheckCircle2 className="h-4 w-4" /> actifs {stats.active}
                </Pill>
                <Pill tone="blue">
                  <Mail className="h-4 w-4" /> invités {stats.invited}
                </Pill>
                <Pill tone="orange">
                  <AlertTriangle className="h-4 w-4" /> à inviter {stats.registered}
                </Pill>
                <Pill tone="gray">
                  <RefreshCcw className="h-4 w-4" /> relances {stats.relances}
                </Pill>
              </div>

              <div className="mt-3 flex items-center gap-3 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll}
                  />
                  <span>Sélectionner tout ({filtered.length})</span>
                </label>
                <div className="text-neutral-600">
                  Sélectionnés : <b>{selectedIds.size}</b>
                </div>
              </div>
            </Card>

            {/* Espace bénévole actions */}
            <Card className="p-4 lg:col-span-4">
              <div className="flex items-center justify-between">
                <div className="font-extrabold inline-flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" /> Espace bénévole
                </div>
                <Pill tone={selectedCourseId === "all" ? "orange" : "green"}>
                  {selectedCourseId === "all" ? "Sélectionne une course" : "Prêt"}
                </Pill>
              </div>

              <p className="mt-2 text-sm text-neutral-600">
                Copie le lien, ouvre l’espace bénévole (preview), et invite la liste.
              </p>

              <div className="mt-3">
                <div className="rounded-xl border border-neutral-200 bg-white p-3 text-xs text-neutral-700">
                  {publicLink ? (
                    <div className="flex items-start justify-between gap-2">
                      <span className="break-all">{publicLink}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          className="inline-flex items-center gap-1 text-neutral-700 hover:text-neutral-900"
                          onClick={copyLink}
                          title="Copier"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <a
                          href={publicLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-neutral-700 hover:text-neutral-900"
                          title="Ouvrir"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  ) : (
                    "Sélectionne une épreuve pour afficher le lien."
                  )}
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2">
                  <Btn
                    variant="dark"
                    onClick={inviteBenevoles}
                    disabled={busyInvite || selectedCourseId === "all"}
                    className="w-full"
                  >
                    {busyInvite ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                    Inviter les bénévoles
                  </Btn>

                  {selectedCourseId !== "all" ? (
                    <Link to={`/benevole/${selectedCourseId}`} className="w-full">
                      <Btn variant="light" className="w-full">
                        <ExternalLink className="h-4 w-4" />
                        Ouvrir l’espace bénévole (preview)
                        <ArrowRight className="h-4 w-4 opacity-70" />
                      </Btn>
                    </Link>
                    
                  ) : (
                    <Btn variant="light" disabled className="w-full">
                      <ExternalLink className="h-4 w-4" />
                      Ouvrir l’espace bénévole (preview)
                    </Btn>
                  )}
                  <Link to={`/organisateur/planning-benevoles/${selectedCourseId}`}>
  <Btn variant="light" disabled={selectedCourseId === "all"} className="w-full">
    <ClipboardList className="h-4 w-4" /> Gérer le planning
  </Btn>
</Link>

                </div>

                <p className="mt-2 text-xs text-neutral-500">
                  “Inviter” envoie un lien de connexion (magic link) vers l’espace bénévole de cette course.
                </p>
              </div>
            </Card>
          </div>
        </div>

        {/* Table */}
        <Card className="overflow-hidden">
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-700">
                <tr>
                  <th className="text-left px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filtered.length && filtered.length > 0}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="text-left px-4 py-3">Bénévole</th>
                  <th className="text-left px-4 py-3">Course</th>
                  <th className="text-left px-4 py-3">Contact</th>
                  <th className="text-left px-4 py-3">Statut</th>
                  <th className="text-left px-4 py-3">Invitations</th>
                  <th className="text-left px-4 py-3">Inscrit</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-neutral-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-neutral-600">
                      Chargement…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-neutral-600">
                      Aucun bénévole trouvé.
                    </td>
                  </tr>
                ) : (
                  filtered.map((b) => {
                    const isConnected = !!b.user_id;

                    const tone =
                      b.status === "active"
                        ? "green"
                        : b.status === "invited"
                        ? "blue"
                        : b.status === "registered"
                        ? "orange"
                        : "gray";

                    const label =
                      b.status === "active"
                        ? "Actif"
                        : b.status === "invited"
                        ? "Invité"
                        : b.status === "registered"
                        ? "À inviter"
                        : "Désactivé";

                    return (
                      <tr key={b.id} className="hover:bg-neutral-50/60">
                        <td className="px-4 py-3 align-top">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(b.id)}
                            onChange={() => toggleOne(b.id)}
                          />
                        </td>

                        <td className="px-4 py-3 align-top">
                          <div className="font-semibold">
                            {b.prenom} {b.nom}
                          </div>
                          <div className="mt-1">
                            {isConnected ? (
                              <Pill tone="green">
                                <CheckCircle2 className="h-4 w-4" /> connecté
                              </Pill>
                            ) : (
                              <Pill tone="orange">
                                <AlertTriangle className="h-4 w-4" /> pas connecté
                              </Pill>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3 align-top">
                          <div className="font-medium">{b.course?.nom || "—"}</div>
                          <div className="text-xs text-neutral-600">{b.course?.lieu || "—"}</div>
                        </td>

                        <td className="px-4 py-3 align-top">
                          <div>
                            {b.email ? (
                              <a href={`mailto:${b.email}`} className="text-orange-700 hover:underline">
                                {b.email}
                              </a>
                            ) : (
                              "—"
                            )}
                          </div>
                          <div className="text-xs text-neutral-700">
                            {b.telephone ? (
                              <a href={`tel:${b.telephone}`} className="hover:underline">
                                {b.telephone}
                              </a>
                            ) : (
                              "—"
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3 align-top">
                          <Pill tone={tone}>{label}</Pill>
                        </td>

                        <td className="px-4 py-3 align-top">
                          <div className="font-semibold">{b.invite_count || 0} relance(s)</div>
                          <div className="text-xs text-neutral-500">
                            Dernière : {b.last_invite_at ? fmtDateTime(b.last_invite_at) : "—"}
                          </div>
                          <div className="text-xs text-neutral-500">
                            1ère : {b.invited_at ? fmtDateTime(b.invited_at) : "—"}
                          </div>
                        </td>

                        <td className="px-4 py-3 align-top">
                          <div className="text-neutral-700">{b.created_at ? fmtDateTime(b.created_at) : "—"}</div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-neutral-200 bg-white px-4 py-3 text-xs text-neutral-500">
            Astuce : pour inviter, sélectionne une épreuve puis clique “Inviter les bénévoles”.
          </div>
        </Card>
      </Container>
    </div>
  );
}
