// src/pages/admin/AdminContact.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase";
import {
  Inbox,
  Search,
  RefreshCw,
  Mail,
  Link as LinkIcon,
  User,
  Building2,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Clock3,
  Tag,
  ChevronRight,
} from "lucide-react";

const Container = ({ children, className = "" }) => (
  <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>
    {children}
  </div>
);

function Pill({ children, tone = "neutral" }) {
  const map = {
    neutral: "bg-neutral-100 text-neutral-800 ring-neutral-200",
    blue: "bg-blue-50 text-blue-800 ring-blue-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    rose: "bg-rose-50 text-rose-800 ring-rose-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${map[tone]}`}>
      {children}
    </span>
  );
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function roleTone(role) {
  if (role === "organisateur") return "blue";
  if (role === "partenaire") return "amber";
  if (role === "presse") return "rose";
  if (role === "coureur") return "neutral";
  return "neutral";
}

function statusTone(status) {
  if (status === "new") return "amber";
  if (status === "in_progress") return "blue";
  if (status === "done") return "green";
  if (status === "spam") return "rose";
  return "neutral";
}

export default function AdminContact() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);

  const [status, setStatus] = useState("all"); // all/new/in_progress/done/spam
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(30);

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ type: "idle", msg: "" });

  const [adminNote, setAdminNote] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data?.session || null);
      setLoading(false);

      supabase.auth.onAuthStateChange((_event, sess) => {
        setSession(sess || null);
      });
    })();
  }, []);

  const canFetch = !!session?.access_token;

  const filteredCountLabel = useMemo(() => {
    const s = status === "all" ? "Tous" : status;
    const qq = q.trim() ? ` • “${q.trim()}”` : "";
    return `${s}${qq}`;
  }, [status, q]);

  async function fetchList() {
    if (!canFetch) return;
    setBusy(true);
    setNotice({ type: "idle", msg: "" });
    try {
      const payload = {
        status: status === "all" ? null : status,
        q: q.trim() || null,
        limit,
      };

      const { data, error } = await supabase.functions.invoke("admin-contact-list", {
        body: payload,
      });

      if (error) throw error;
      setItems(data?.items || []);
      // reset selection if missing
      if (selected && !(data?.items || []).some((x) => x.id === selected.id)) {
        setSelected(null);
        setAdminNote("");
      }
    } catch (e) {
      console.error(e);
      setNotice({
        type: "error",
        msg: "Impossible de charger les messages (droits admin ?).",
      });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!canFetch) return;
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canFetch]);

  function pick(item) {
    setSelected(item);
    setAdminNote(item?.meta?.admin_note || "");
  }

  async function updateMessage(nextStatus) {
    if (!selected) return;
    setBusy(true);
    setNotice({ type: "idle", msg: "" });
    try {
      const { data, error } = await supabase.functions.invoke("admin-contact-update", {
        body: {
          id: selected.id,
          status: nextStatus,
          admin_note: adminNote || null,
        },
      });
      if (error) throw error;

      // refresh list & selected
      await fetchList();
      const updated = (data?.item) || null;
      if (updated) {
        setSelected(updated);
        setAdminNote(updated?.meta?.admin_note || "");
      }

      setNotice({ type: "success", msg: "Mis à jour ✅" });
    } catch (e) {
      console.error(e);
      setNotice({ type: "error", msg: "Échec de mise à jour." });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-neutral-50" />;
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <Container className="py-10">
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-neutral-700 mt-0.5" />
              <div>
                <h1 className="text-lg font-bold text-neutral-900">Admin — Contact</h1>
                <p className="mt-1 text-sm text-neutral-600">
                  Connecte-toi d’abord pour accéder à l’interface admin.
                </p>
              </div>
            </div>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="border-b border-neutral-200 bg-white">
        <Container className="py-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-600">
                <Inbox className="h-4 w-4" />
                Admin • Messages contact
              </div>
              <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">
                Boîte de réception Contact
              </h1>
              <p className="mt-1 text-sm text-neutral-600">
                {items.length} message(s) • {filteredCountLabel}
              </p>
            </div>

            <button
              onClick={fetchList}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 transition disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
              Actualiser
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-1">
              <label className="text-xs font-semibold text-neutral-700">Statut</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
              >
                <option value="all">Tous</option>
                <option value="new">Nouveaux</option>
                <option value="in_progress">En cours</option>
                <option value="done">Traités</option>
                <option value="spam">Spam</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-neutral-700">Recherche</label>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-orange-300">
                <Search className="h-4 w-4 text-neutral-500" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="nom, email, sujet, message..."
                  className="w-full bg-transparent text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={fetchList}
                  disabled={busy}
                  className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-neutral-800 disabled:opacity-60"
                >
                  Filtrer
                </button>
              </div>
            </div>

            <div className="md:col-span-1">
              <label className="text-xs font-semibold text-neutral-700">Limite</label>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
              >
                <option value={20}>20</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="mt-3">
            <button
              onClick={fetchList}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 transition disabled:opacity-60"
            >
              <Tag className="h-4 w-4" />
              Appliquer
            </button>
          </div>

          {notice.type !== "idle" ? (
            <div
              className={[
                "mt-4 rounded-xl border p-3 text-sm",
                notice.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-rose-200 bg-rose-50 text-rose-800",
              ].join(" ")}
            >
              <div className="flex items-start gap-2">
                {notice.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                )}
                <p>{notice.msg}</p>
              </div>
            </div>
          ) : null}
        </Container>
      </div>

      <Container className="py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* LIST */}
          <div className="lg:col-span-3 rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-neutral-200 px-4 py-3 text-sm font-bold text-neutral-900">
              Messages
            </div>

            {items.length === 0 ? (
              <div className="p-6 text-sm text-neutral-600">Aucun message.</div>
            ) : (
              <div className="divide-y divide-neutral-200">
                {items.map((it) => (
                  <button
                    key={it.id}
                    onClick={() => pick(it)}
                    className={[
                      "w-full text-left px-4 py-3 hover:bg-neutral-50 transition",
                      selected?.id === it.id ? "bg-orange-50" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Pill tone={roleTone(it.role)}>{it.role}</Pill>
                          <Pill tone={statusTone(it.status)}>{it.status}</Pill>
                          <span className="text-xs text-neutral-500 inline-flex items-center gap-1">
                            <Clock3 className="h-3.5 w-3.5" />
                            {formatDateTime(it.created_at)}
                          </span>
                        </div>

                        <div className="mt-1 font-semibold text-neutral-900 truncate">
                          {it.sujet || "—"}
                        </div>

                        <div className="mt-1 text-sm text-neutral-600 truncate">
                          {it.nom} • {it.email} • {it.categorie}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-neutral-400 mt-1" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* DETAIL */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-neutral-900">Détail</div>
                  <div className="text-xs text-neutral-500">
                    {selected ? `ID: ${selected.id}` : "Sélectionne un message"}
                  </div>
                </div>
                {selected ? <Pill tone={statusTone(selected.status)}>{selected.status}</Pill> : null}
              </div>

              {!selected ? (
                <div className="mt-4 text-sm text-neutral-600">
                  Clique un message à gauche pour l’ouvrir.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={roleTone(selected.role)}>{selected.role}</Pill>
                    <Pill tone="neutral">{selected.categorie}</Pill>
                    <span className="text-xs text-neutral-500">{formatDateTime(selected.created_at)}</span>
                  </div>

                  <div className="space-y-2 text-sm text-neutral-800">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-neutral-500" />
                      <span className="font-semibold">{selected.nom}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-neutral-500" />
                      <a className="font-semibold hover:underline" href={`mailto:${selected.email}`}>
                        {selected.email}
                      </a>
                    </div>
                    {selected.telephone ? (
                      <div className="text-neutral-700">☎ {selected.telephone}</div>
                    ) : null}
                    {selected.organisation ? (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-neutral-500" />
                        <span>{selected.organisation}</span>
                      </div>
                    ) : null}
                    {selected.lien ? (
                      <div className="flex items-center gap-2">
                        <LinkIcon className="h-4 w-4 text-neutral-500" />
                        <a className="hover:underline" href={selected.lien} target="_blank" rel="noreferrer">
                          {selected.lien}
                        </a>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                    <div className="text-xs font-semibold text-neutral-700">Message</div>
                    <div className="mt-1 whitespace-pre-wrap text-sm text-neutral-800">
                      {selected.message}
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="text-xs font-semibold text-neutral-700">Note interne (meta)</div>
                    <textarea
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      placeholder="Note interne (non envoyée au demandeur)"
                      className="mt-1 w-full min-h-[90px] rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      disabled={busy}
                      onClick={() => updateMessage("new")}
                      className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-neutral-50 disabled:opacity-60"
                    >
                      Nouveau
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => updateMessage("in_progress")}
                      className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-neutral-50 disabled:opacity-60"
                    >
                      En cours
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => updateMessage("done")}
                      className="rounded-xl bg-neutral-900 px-3 py-2 text-sm font-bold text-white hover:bg-neutral-800 disabled:opacity-60"
                    >
                      Traité
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => updateMessage("spam")}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800 hover:bg-rose-100 disabled:opacity-60"
                    >
                      Spam
                    </button>
                  </div>

                  <div className="pt-2 text-xs text-neutral-500">
                    Réponds par email : clique l’email ci-dessus (Reply-To est déjà bon côté Resend).
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-bold text-neutral-900">Note</div>
              <p className="mt-2 text-sm text-neutral-600">
                Cette page utilise des Edge Functions admin. Si tu n’es pas dans l’allowlist
                (<code className="px-1 rounded bg-neutral-100">ADMIN_EMAILS</code>), tu verras une erreur.
              </p>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
