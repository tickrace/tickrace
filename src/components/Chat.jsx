// src/components/Chat.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";
import {
  Send,
  Search,
  Flag,
  MessageSquare,
  X,
  CornerDownRight,
  Trash2,
  Edit3,
  Save,
} from "lucide-react";
import clsx from "clsx";

const BAD_WORDS = ["con", "pute", "enculé", "merde"];
const IA_USER_ID = "00000000-0000-0000-0000-000000000000";

export default function Chat({ courseId, organisateurId }) {
  const { session } = useUser();
  const user = session?.user;

  const [messages, setMessages] = useState([]);
  const [profilesMap, setProfilesMap] = useState(new Map());
  const [rootsCounts, setRootsCounts] = useState(new Map());
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");

  const listRef = useRef(null);

  // Charger un profil et le stocker en cache
  async function ensureProfileInMap(userId) {
    if (userId === IA_USER_ID || profilesMap.has(userId)) return profilesMap.get(userId);
    const { data: prof } = await supabase
      .from("profils_utilisateurs")
      .select("user_id, prenom, nom")
      .eq("user_id", userId)
      .maybeSingle();
    if (prof) {
      setProfilesMap((prev) => {
        const m = new Map(prev);
        m.set(userId, { prenom: prof.prenom, nom: prof.nom });
        return m;
      });
      return { prenom: prof.prenom, nom: prof.nom };
    }
    return { prenom: "", nom: "" };
  }

  // ---- Chargement initial + Realtime
  useEffect(() => {
    let abort = false;

    const load = async () => {
      const { data: msgs, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("course_id", courseId)
        .order("created_at", { ascending: true });

      if (!abort && !error && msgs) {
        setMessages(msgs);

        const uniqueUserIds = Array.from(
          new Set(msgs.map((m) => m.user_id).filter((id) => id && id !== IA_USER_ID))
        );
        if (uniqueUserIds.length) {
          const { data: profs } = await supabase
            .from("profils_utilisateurs")
            .select("user_id, prenom, nom")
            .in("user_id", uniqueUserIds);
          if (profs) {
            const map = new Map();
            for (const p of profs) map.set(p.user_id, { prenom: p.prenom, nom: p.nom });
            setProfilesMap(map);
          }
        }
      }

      const { data: mv } = await supabase
        .from("chat_roots_with_counts")
        .select("id,replies_count")
        .eq("course_id", courseId);
      if (!abort && mv) {
        const map = new Map();
        mv.forEach((r) => map.set(r.id, r.replies_count));
        setRootsCounts(map);
      }
    };

    load();

    const channel = supabase
      .channel(`chat:${courseId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages", filter: `course_id=eq.${courseId}` },
        async (payload) => {
          setMessages((prev) => {
            if (payload.eventType === "INSERT") return [...prev, payload.new];
            if (payload.eventType === "UPDATE") {
              return prev.map((m) => (m.id === payload.new.id ? payload.new : m));
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((m) => m.id !== payload.old.id);
            }
            return prev;
          });

          const uid =
            payload.eventType === "DELETE" ? payload.old?.user_id : payload.new?.user_id;
          if (uid && uid !== IA_USER_ID && !profilesMap.has(uid)) {
            await ensureProfileInMap(uid);
          }
        }
      )
      .subscribe();

    return () => {
      abort = true;
      supabase.removeChannel(channel);
    };
  }, [courseId]); // eslint-disable-line

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  const roots = useMemo(() => messages.filter((m) => !m.parent_id), [messages]);

  const childrenByParent = useMemo(() => {
    const map = new Map();
    messages.forEach((m) => {
      if (m.parent_id) {
        if (!map.has(m.parent_id)) map.set(m.parent_id, []);
        map.get(m.parent_id).push(m);
      }
    });
    return map;
  }, [messages]);

  const filteredRoots = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roots;
    return roots.filter((m) => {
      const prof = profilesMap.get(m.user_id);
      const fullName = `${prof?.prenom || m.prenom || ""} ${prof?.nom || m.nom || ""}`.toLowerCase();
      return [m.message?.toLowerCase() || "", fullName].join(" ").includes(q);
    });
  }, [roots, search, profilesMap]);

  const checkModeration = (text) =>
    BAD_WORDS.some((w) => text.toLowerCase().includes(w));

  const canModerate = (m) => {
    if (!user) return false;
    if (user.id === m.user_id) return true;
    if (user.id === IA_USER_ID) return true;
    if (organisateurId && user.id === organisateurId) return true;
    return false;
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    if (!user) { alert("Connecte-toi pour écrire."); return; }

    const prof = await ensureProfileInMap(user.id);

    const toInsert = {
      course_id: courseId,
      parent_id: replyTo?.id ?? null,
      user_id: user.id,
      nom: prof.nom || null,
      prenom: prof.prenom || null,
      message: text,
      is_hidden: checkModeration(text),
      flagged: false,
    };

    const { error } = await supabase.from("chat_messages").insert(toInsert);
    if (error) { console.error(error); alert("Impossible d’envoyer le message."); return; }

    const at = text.match(/@IA\s*(.*)$/i);
    if (at && at[1]) {
      try {
        const { error: iaErr } = await supabase.functions.invoke("chat-ia", {
          body: {
            course_id: courseId,
            parent_id: replyTo?.id ?? null,
            prompt: at[1].trim(),
          },
        });
        if (iaErr) console.error("chat-ia invoke error", iaErr);
      } catch (e) {
        console.error("chat-ia invoke exception", e);
      }
    }

    setInput("");
    setReplyTo(null);
  };

  const handleFlag = async (msg) => {
    if (!user) return;
    const reason = prompt("Pourquoi signaler ce message ?") || "signalement utilisateur";
    const { error } = await supabase
      .from("chat_messages")
      .update({ flagged: true, flagged_reason: reason })
      .eq("id", msg.id);
    if (error) console.error(error);
  };

  const startEdit = (m) => { if (canModerate(m)) { setEditingId(m.id); setEditingText(m.message); } };
  const saveEdit = async (m) => {
    const text = editingText.trim();
    if (!text) return setEditingId(null);
    const { error } = await supabase
      .from("chat_messages")
      .update({ message: text, is_hidden: checkModeration(text) })
      .eq("id", m.id);
    if (error) { console.error(error); alert("Échec de la modification."); return; }
    setEditingId(null); setEditingText("");
  };
  const deleteMsg = async (m) => {
    if (!confirm("Supprimer ce message ?")) return;
    const { error } = await supabase.from("chat_messages").delete().eq("id", m.id);
    if (error) { console.error(error); alert("Échec de la suppression."); }
  };

  const formatWhen = (iso) =>
    new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));

  const Message = ({ m, depth = 0 }) => {
    const hidden = m.is_hidden;
    const isEditable = canModerate(m);
    const prof = profilesMap.get(m.user_id);
    const fullName =
      m.user_id === IA_USER_ID
        ? "IA Tickrace"
        : `${prof?.prenom || m.prenom || ""} ${prof?.nom || m.nom || ""}`.trim() || "Utilisateur";
    const initials =
      m.user_id === IA_USER_ID
        ? "IA"
        : ((prof?.prenom?.[0] || m.prenom?.[0] || "") + (prof?.nom?.[0] || m.nom?.[0] || "")).toUpperCase() || "?";

    return (
      <div className={clsx("rounded-xl p-3 mb-2", depth ? "ml-6 bg-neutral-50" : "bg-white shadow-sm")}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={clsx(
              "h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold",
              m.user_id === IA_USER_ID ? "bg-indigo-100 text-indigo-700" : "bg-neutral-200 text-neutral-700"
            )} title={fullName}>
              {initials}
            </div>
            <div>
              <div className="text-sm font-semibold flex items-center gap-2">
                {fullName}
                <span className="text-xs text-neutral-500">• {formatWhen(m.created_at)}</span>
                {m.user_id === IA_USER_ID && (
                  <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] bg-indigo-100 text-indigo-700 font-medium">IA</span>
                )}
                {!m.parent_id && rootsCounts.get(m.id) ? (
                  <span className="ml-2 text-[11px] text-neutral-500">· {rootsCounts.get(m.id)} réponse(s)</span>
                ) : null}
              </div>
              {editingId === m.id ? (
                <div className="mt-1">
                  <textarea className="w-full rounded-xl border border-neutral-200 p-2 text-sm" value={editingText} onChange={(e) => setEditingText(e.target.value)} />
                  <div className="flex gap-2 mt-1">
                    <button className="text-xs px-2 py-1 rounded bg-neutral-900 text-white flex items-center gap-1" onClick={() => saveEdit(m)}>
                      <Save size={14} /> Enregistrer
                    </button>
                    <button className="text-xs px-2 py-1 rounded bg-neutral-100" onClick={() => setEditingId(null)}>Annuler</button>
                  </div>
                </div>
              ) : hidden ? (
                <div className="text-xs italic text-neutral-500">Message masqué (modération automatique)</div>
              ) : (
                <div className="text-sm whitespace-pre-wrap">{m.message}</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button title="Répondre" className="p-1 rounded hover:bg-neutral-100" onClick={() => setReplyTo(m)}><CornerDownRight size={18} /></button>
            <button title="Signaler" className="p-1 rounded hover:bg-neutral-100" onClick={() => handleFlag(m)}><Flag size={18} /></button>
            {isEditable && editingId !== m.id && (
              <button title="Modifier" className="p-1 rounded hover:bg-neutral-100" onClick={() => startEdit(m)}><Edit3 size={18} /></button>
            )}
            {isEditable && (
              <button title="Supprimer" className="p-1 rounded hover:bg-neutral-100" onClick={() => deleteMsg(m)}><Trash2 size={18} /></button>
            )}
          </div>
        </div>
        {(childrenByParent.get(m.id) || [])
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
          .map((child) => <Message key={child.id} m={child} depth={depth + 1} />)}
      </div>
    );
  };

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold flex items-center gap-2"><MessageSquare size={20} /> Discussions</h3>
        <div className="relative">
          <input className="pl-8 pr-3 py-2 rounded-xl bg-white border border-neutral-200 text-sm" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Search size={16} className="absolute left-2 top-2.5 text-neutral-400" />
        </div>
      </div>
      <div ref={listRef} className="max-h-[420px] overflow-y-auto rounded-2xl bg-neutral-50 p-3 border border-neutral-100">
        {filteredRoots.length === 0 ? (
          <div className="text-sm text-neutral-500 p-4">Aucun message. Lance la discussion !</div>
        ) : (
          filteredRoots.map((m) => <Message key={m.id} m={m} />)
        )}
      </div>
      {replyTo && (
        <div className="mt-2 text-xs text-neutral-600 flex items-center gap-2">
          Réponse à{" "}
          <span className="font-semibold">
            {(() => {
              const p = profilesMap.get(replyTo.user_id);
              return `${p?.prenom || replyTo.prenom || ""} ${p?.nom || replyTo.nom || ""}`.trim() || "Utilisateur";
            })()}
          </span>
          <button className="p-1 rounded hover:bg-neutral-100" onClick={() => setReplyTo(null)}><X size={14} /></button>
        </div>
      )}
      <div className="mt-3 flex items-center gap-2">
        <textarea className="flex-1 min-h-[44px] max-h-[120px] rounded-2xl border border-neutral-200 bg-white p-3 text-sm" placeholder='Écrire… (astuce : "@IA peux-tu…")' value={input} onChange={(e) => setInput(e.target.value)} />
        <button onClick={handleSend} className="rounded-2xl bg-neutral-900 text-white px-4 py-2 text-sm font-semibold flex items-center gap-2"><Send size={16} /> Envoyer</button>
      </div>
    </section>
  );
}
