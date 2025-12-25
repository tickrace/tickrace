// src/components/BenevolesChat.jsx
// Chat bénévoles (Supabase Realtime)
// Props :
// - courseId (uuid)
// - me: { id: uuid(auth.users), prenom?: string, nom?: string }
// Ref (optionnel) : focusAndPrefill(text)

import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import { Loader2, Send } from "lucide-react";

const safe = (s) => (s || "").toString().trim();

const Btn = ({ className = "", disabled, onClick, children }) => (
  <button
    disabled={disabled}
    onClick={onClick}
    className={[
      "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition",
      "bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed",
      className,
    ].join(" ")}
  >
    {children}
  </button>
);

const Input = React.forwardRef(function Input(props, ref) {
  return (
    <input
      ref={ref}
      {...props}
      className={[
        "flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none",
        "focus:ring-2 focus:ring-orange-300",
        props.className || "",
      ].join(" ")}
    />
  );
});

const BenevolesChat = React.forwardRef(function BenevolesChat({ courseId, me }, ref) {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const listRef = useRef(null);
  const inputRef = useRef(null);

  // Roster optionnel : affichage prénom/nom si lisible par RLS
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
      const rosterRes = await supabase
        .from("benevoles")
        .select("user_id, prenom, nom")
        .eq("course_id", courseId);

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
                        isMe
                          ? "border-neutral-900 bg-neutral-900 text-white"
                          : "border-neutral-200 bg-neutral-50 text-neutral-900",
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
        <Input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Écrire un message…"
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <Btn onClick={send} disabled={sending || !safe(text)}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Envoyer
        </Btn>
      </div>
    </div>
  );
});

export default BenevolesChat;
