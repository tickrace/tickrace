import React, { useMemo, useState } from "react";
import { supabase } from "../supabase";
import TipTapEmailEditor from "./TipTapEmailEditor";

const VARS = [
  { k: "prenom", l: "Prénom" },
  { k: "nom", l: "Nom" },
  { k: "email", l: "Email" },
  { k: "team_name", l: "Nom équipe" },
  { k: "format_nom", l: "Nom du format" },
  { k: "course_nom", l: "Nom de la course" },
  { k: "course_lieu", l: "Lieu de la course" },
];

export default function SendEmailModal({ open, onClose, formatId, selectedIds = [] }) {
  const [subject, setSubject] = useState("Infos course — {{format_nom}}");
  const [html, setHtml]     = useState("<p>Bonjour {{prenom}},</p><p>…</p>");
  const [replyTo, setReplyTo] = useState("");
  const [onlyStatus, setOnlyStatus] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState(null);

  const disabled = useMemo(
    () => !subject.trim() || !html.trim() || (!formatId && selectedIds.length === 0),
    [subject, html, formatId, selectedIds]
  );

  if (!open) return null;

  const insertVar = (v) => setHtml((prev) => `${prev}${prev.endsWith(" ") ? "" : " "}{{${v}}}`);

  async function sendEmails() {
    setSending(true); setMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("organiser-send-emails", {
        body: {
          format_id: formatId || null,
          inscription_ids: selectedIds.length ? selectedIds : null,
          subject,
          html,
          reply_to: replyTo || undefined,
          only_status: selectedIds.length ? undefined : (onlyStatus || undefined),
          test_email: testEmail || undefined,
          extra_vars: {},
        },
      });
      if (error) throw error;
      setMsg({ type: "success", text: `Emails envoyés : ${data?.sent || 0} / ${data?.total || 0}` });
    } catch (e) {
      setMsg({ type: "error", text: e?.message || String(e) });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-2 sm:p-6">
      <div className="w-full sm:max-w-3xl bg-white rounded-2xl shadow-2xl ring-1 ring-neutral-200 overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-neutral-900 text-white px-3 py-1 text-[11px]">
              Email — Inscriptions {selectedIds.length ? "(sélection ciblée)" : ""}
            </div>
            <h3 className="mt-2 text-lg font-bold">Message aux inscrits</h3>
            <p className="text-sm text-neutral-600">Utilise les variables pour personnaliser.</p>
          </div>
          <button onClick={onClose} className="h-9 w-9 grid place-items-center rounded-xl hover:bg-neutral-100">✕</button>
        </div>

        <div className="px-4 sm:px-5 py-5 space-y-4">
          {msg && (
            <div className={`rounded-xl p-3 text-sm ${msg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
              {msg.text}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm">
              Objet
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300"
                placeholder="Ex : Infos départ & retrait dossards"
              />
            </label>
            <label className="text-sm">
              Répondre à (optionnel)
              <input
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                placeholder="orga@exemple.com"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            {VARS.map((v) => (
              <button key={v.k} type="button" onClick={() => insertVar(v.k)}
                className="text-xs rounded-full border border-neutral-300 px-2 py-1 bg-neutral-50 hover:bg-neutral-100">
                {{ }} {v.l}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-neutral-200">
            <TipTapEmailEditor value={html} onChange={setHtml} />
          </div>

          {!selectedIds.length && (
            <div className="grid sm:grid-cols-3 gap-3">
              <label className="text-sm">
                Filtrer par statut
                <select
                  value={onlyStatus}
                  onChange={(e) => setOnlyStatus(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                >
                  <option value="">Tous</option>
                  <option value="validé">Validé</option>
                  <option value="en attente">En attente</option>
                  <option value="annulé">Annulé</option>
                  <option value="refusé">Refusé</option>
                </select>
              </label>
              <label className="text-sm sm:col-span-2">
                Envoyer en mode test (1 adresse)
                <input
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  placeholder="toi@exemple.com"
                />
                <p className="text-[11px] text-neutral-500 mt-1">Si rempli, l’email ne partira qu’à cette adresse.</p>
              </label>
            </div>
          )}
        </div>

        <div className="px-4 sm:px-5 py-4 border-t border-neutral-200 flex items-center justify-between">
          <div className="text-xs text-neutral-500">
            {selectedIds.length ? `${selectedIds.length} destinataire(s) sélectionné(s)` : "Tous les inscrits du format (selon filtre)"}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50">Annuler</button>
            <button
              onClick={sendEmails}
              disabled={disabled || sending}
              className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${disabled || sending ? "bg-neutral-400 cursor-not-allowed" : "bg-orange-500 hover:brightness-110"}`}
            >
              {sending ? "Envoi…" : "Envoyer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
