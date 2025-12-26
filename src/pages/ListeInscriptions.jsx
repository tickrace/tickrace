// src/pages/ListeInscriptions.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { supabase } from "../supabase";
import AssignBibModal from "../components/AssignBibModal";
import { computeCategoryForAthlete } from "../utils/ageCategories";

/* ----------------------------- Utils ----------------------------- */
function cls(...xs) {
  return xs.filter(Boolean).join(" ");
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
function useDebounced(value, delay = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
function StatusBadge({ status }) {
  const s = (status || "").toLowerCase();
  const map = {
    paye: "bg-emerald-100 text-emerald-800",
    "payé": "bg-emerald-100 text-emerald-800",
    en_attente: "bg-amber-100 text-amber-800",
    "en attente": "bg-amber-100 text-amber-800",
    annule: "bg-rose-100 text-rose-800",
    "annulé": "bg-rose-100 text-rose-800",
  };
  const txt = ["paye", "payé"].includes(s)
    ? "Payé"
    : ["annule", "annulé"].includes(s)
    ? "Annulé"
    : "En attente";
  return (
    <span
      className={cls(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        map[s] || "bg-neutral-100 text-neutral-800"
      )}
    >
      {txt}
    </span>
  );
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/* -------------------------- Modale Email -------------------------- */
function EmailModal({ open, onClose, recipients, onSend }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("Bonjour,\n\n…\n");
  useEffect(() => {
    if (!open) {
      setSubject("");
      setMessage("Bonjour,\n\n…\n");
    }
  }, [open]);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl ring-1 ring-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Envoyer un email</h3>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-800 text-sm"
          >
            Fermer
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="text-xs text-neutral-600">
            Destinataires : <b>{recipients.length}</b> adresse
            {recipients.length > 1 ? "s" : ""} unique
            {recipients.length > 1 ? "s" : ""}
          </div>
          <div>
            <label className="text-sm font-medium">Sujet</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
              placeholder="Sujet de l’email"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={10}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 font-mono text-sm"
            />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm hover:bg-white"
          >
            Annuler
          </button>
          <button
            onClick={() =>
              onSend({ subject, html: message.replace(/\n/g, "<br/>") })
            }
            className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------- Modale Waitlist (Invites) ---------------------- */
function InviteWaitlistModal({
  open,
  onClose,
  courseId,
  formatId,
  formatLabel,
  onDone,
}) {
  const [limit, setLimit] = useState(10);
  const [validHours, setValidHours] = useState(72);
  const [loading, setLoading] = useState(false);
  const [invites, setInvites] = useState([]); // {email, invite_token, invite_expires_at}
  const [sending, setSending] = useState(false);

  const BASE = window.location.origin;

  useEffect(() => {
    if (!open) {
      setLimit(10);
      setValidHours(72);
      setLoading(false);
      setInvites([]);
      setSending(false);
    }
  }, [open]);

  if (!open) return null;

  const invite = async () => {
    if (!formatId) return alert("Format introuvable.");
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("invite_waitlist", {
        p_format_id: formatId,
        p_limit: Number(limit || 10),
        p_valid_hours: Number(validHours || 72),
      });
      if (error) throw error;
      setInvites(data || []);
      if ((data || []).length === 0) {
        alert("Aucune entrée à inviter (liste vide ou déjà invitée récemment).");
      }
      onDone?.();
    } catch (e) {
      console.error("INVITE_WAITLIST_ERROR", e);
      alert("Erreur : impossible d’inviter la liste d’attente.");
    } finally {
      setLoading(false);
    }
  };

  const copyAllLinks = async () => {
    const lines = (invites || []).map((x) => {
      const url = `${BASE}/inscription/${courseId}?format=${formatId}&invite=${x.invite_token}`;
      return `${x.email};${url}`;
    });
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      alert("Copié dans le presse-papiers (email;url).");
    } catch {
      alert("Impossible de copier (navigateur).");
    }
  };

  // Envoi "simple" via la function existante organiser-send-emails (1 email = 1 invite, personnalisé)
  const sendEmails = async () => {
    if (!invites?.length) return alert("Aucune invitation générée.");
    const subject = `Invitation : une place s'est libérée (${formatLabel || "format"})`;
    const batches = chunk(invites, 5); // petit throttle
    setSending(true);

    try {
      for (const b of batches) {
        const res = await Promise.allSettled(
          b.map((x) => {
            const url = `${BASE}/inscription/${courseId}?format=${formatId}&invite=${x.invite_token}`;
            const exp = x.invite_expires_at
              ? new Date(x.invite_expires_at).toLocaleString("fr-FR")
              : null;

            const html = `
              <div style="font-family:Arial,sans-serif;line-height:1.5">
                <p>Bonjour,</p>
                <p>Une place est disponible. Vous pouvez finaliser votre inscription via ce lien :</p>
                <p><a href="${url}">${url}</a></p>
                ${
                  exp
                    ? `<p style="color:#666;font-size:12px">Lien valable jusqu’au : <b>${exp}</b></p>`
                    : ""
                }
                <p style="color:#666;font-size:12px">Si vous ne souhaitez plus être sur liste d’attente, ignorez ce message.</p>
                <p>Sportivement,<br/>Tickrace</p>
              </div>
            `;

            return supabase.functions.invoke("organiser-send-emails", {
              body: { subject, html, to: [x.email] },
            });
          })
        );

        const failures = res.filter(
          (r) =>
            r.status === "rejected" ||
            (r.status === "fulfilled" && r.value?.error)
        );
        if (failures.length) {
          console.warn("WAITLIST_SEND_FAIL", failures);
          // on continue quand même
        }
      }

      alert("Envoi terminé (voir console si certains emails ont échoué).");
    } catch (e) {
      console.error("WAITLIST_SEND_ERROR", e);
      alert("Erreur lors de l’envoi des emails.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl ring-1 ring-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Inviter la liste d’attente</h3>
            <div className="text-xs text-neutral-600 mt-0.5">
              Format : <b>{formatLabel || formatId || "—"}</b>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-800 text-sm"
          >
            Fermer
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium">Combien inviter</label>
              <input
                type="number"
                min={1}
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Validité (heures)</label>
              <input
                type="number"
                min={1}
                value={validHours}
                onChange={(e) => setValidHours(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={invite}
                disabled={loading || !courseId || !formatId}
                className={cls(
                  "w-full rounded-xl px-4 py-2 text-sm font-semibold text-white",
                  loading || !courseId || !formatId
                    ? "bg-neutral-400 cursor-not-allowed"
                    : "bg-neutral-900 hover:bg-black"
                )}
              >
                {loading ? "Invitation…" : "Générer les invitations"}
              </button>
            </div>
          </div>

          {invites.length > 0 && (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <b>{invites.length}</b> invitation{invites.length > 1 ? "s" : ""} générée
                  {invites.length > 1 ? "s" : ""}.
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={copyAllLinks}
                    className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs sm:text-sm hover:bg-neutral-50"
                  >
                    Copier email;url
                  </button>
                  <button
                    onClick={sendEmails}
                    disabled={sending}
                    className={cls(
                      "rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-white",
                      sending ? "bg-neutral-400" : "bg-emerald-600 hover:bg-emerald-500"
                    )}
                  >
                    {sending ? "Envoi…" : "Envoyer les emails"}
                  </button>
                </div>
              </div>

              <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-neutral-200 bg-white">
                <table className="min-w-full text-xs">
                  <thead className="bg-neutral-100 text-neutral-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Email</th>
                      <th className="px-3 py-2 text-left">Expiration</th>
                      <th className="px-3 py-2 text-left">Lien</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invites.map((x, i) => {
                      const url = `${BASE}/inscription/${courseId}?format=${formatId}&invite=${x.invite_token}`;
                      return (
                        <tr key={`${x.email}-${i}`} className="border-t">
                          <td className="px-3 py-2">{x.email}</td>
                          <td className="px-3 py-2">
                            {x.invite_expires_at
                              ? new Date(x.invite_expires_at).toLocaleString("fr-FR")
                              : "—"}
                          </td>
                          <td className="px-3 py-2">
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-700 underline break-all"
                            >
                              Ouvrir
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-2 text-[11px] text-neutral-500">
                Astuce : si tu veux du “vrai tracking” (email délivré, cliqué, etc.), on branchera une Edge Function dédiée.
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm hover:bg-white"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------- Modale Ajout Coureur ---------------------- */
function AddRunnerModal({ open, onClose, onCreated, courseId, formatId }) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    nom: "",
    prenom: "",
    email: "",
    genre: "",
    date_naissance: "",
    nationalite: "",
    telephone: "",
    adresse: "",
    adresse_complement: "",
    code_postal: "",
    ville: "",
    pays: "",
    club: "",
    justificatif_type: "",
    numero_licence: "",
    pps_identifier: "",
    contact_urgence_nom: "",
    contact_urgence_telephone: "",
    apparaitre_resultats: true,
    statut: "en_attente",
    team_name: "",
    dossard: "",
  });
  useEffect(() => {
    if (!open) {
      setSaving(false);
      setF({
        nom: "",
        prenom: "",
        email: "",
        genre: "",
        date_naissance: "",
        nationalite: "",
        telephone: "",
        adresse: "",
        adresse_complement: "",
        code_postal: "",
        ville: "",
        pays: "",
        club: "",
        justificatif_type: "",
        numero_licence: "",
        pps_identifier: "",
        contact_urgence_nom: "",
        contact_urgence_telephone: "",
        apparaitre_resultats: true,
        statut: "en_attente",
        team_name: "",
        dossard: "",
      });
    }
  }, [open]);
  if (!open) return null;
  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setF((p) => ({ ...p, [name]: type === "checkbox" ? checked : value }));
  };
  const save = async () => {
    if (!formatId) {
      alert("Format introuvable.");
      return;
    }
    if (!f.nom.trim() || !f.prenom.trim()) {
      alert("Nom et prénom requis.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...f,
        nom: f.nom.trim(),
        prenom: f.prenom.trim(),
        email: f.email?.trim() || null,
        course_id: courseId || null,
        format_id: formatId,
        team_name: f.team_name?.trim() || null,
        dossard: f.dossard !== "" ? Number(f.dossard) : null,
      };
      const { error } = await supabase.from("inscriptions").insert(payload);
      if (error) throw error;
      onCreated?.();
      onClose();
      alert("Coureur ajouté.");
    } catch (e) {
      console.error(e);
      alert("Erreur d’ajout.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl ring-1 ring-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Ajouter un coureur</h3>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-800 text-sm"
          >
            Fermer
          </button>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            name="nom"
            value={f.nom}
            onChange={onChange}
            className="rounded-xl border px-3 py-2"
            placeholder="Nom *"
          />
          <input
            name="prenom"
            value={f.prenom}
            onChange={onChange}
            className="rounded-xl border px-3 py-2"
            placeholder="Prénom *"
          />
          <input
            name="email"
            value={f.email}
            onChange={onChange}
            className="rounded-xl border px-3 py-2 md:col-span-2"
            placeholder="Email"
          />
          <div className="grid grid-cols-2 gap-3 md:col-span-2">
            <select
              name="genre"
              value={f.genre}
              onChange={onChange}
              className="rounded-xl border px-3 py-2"
            >
              <option value="">Genre</option>
              <option>Homme</option>
              <option>Femme</option>
            </select>
            <input
              type="date"
              name="date_naissance"
              value={f.date_naissance}
              onChange={onChange}
              className="rounded-xl border px-3 py-2"
            />
          </div>
          <input
            name="numero_licence"
            value={f.numero_licence}
            onChange={onChange}
            className="rounded-xl border px-3 py-2"
            placeholder="N° licence / PPS"
          />
          <input
            name="club"
            value={f.club}
            onChange={onChange}
            className="rounded-xl border px-3 py-2"
            placeholder="Club"
          />
          <input
            name="telephone"
            value={f.telephone}
            onChange={onChange}
            className="rounded-xl border px-3 py-2 md:col-span-2"
            placeholder="Téléphone"
          />
          <input
            name="adresse"
            value={f.adresse}
            onChange={onChange}
            className="rounded-xl border px-3 py-2 md:col-span-2"
            placeholder="Adresse"
          />
          <input
            name="adresse_complement"
            value={f.adresse_complement}
            onChange={onChange}
            className="rounded-xl border px-3 py-2"
            placeholder="Complément"
          />
          <input
            name="code_postal"
            value={f.code_postal}
            onChange={onChange}
            className="rounded-xl border px-3 py-2"
            placeholder="Code postal"
          />
          <input
            name="ville"
            value={f.ville}
            onChange={onChange}
            className="rounded-xl border px-3 py-2"
            placeholder="Ville"
          />
          <input
            name="pays"
            value={f.pays}
            onChange={onChange}
            className="rounded-xl border px-3 py-2"
            placeholder="Pays"
          />
          <input
            name="justificatif_type"
            value={f.justificatif_type}
            onChange={onChange}
            className="rounded-xl border px-3 py-2"
            placeholder="Type justificatif"
          />
          <input
            name="pps_identifier"
            value={f.pps_identifier}
            onChange={onChange}
            className="rounded-xl border px-3 py-2"
            placeholder="Identifiant PPS"
          />
          <input
            name="contact_urgence_nom"
            value={f.contact_urgence_nom}
            onChange={onChange}
            className="rounded-xl border px-3 py-2"
            placeholder="Contact urgence - Nom"
          />
          <input
            name="contact_urgence_telephone"
            value={f.contact_urgence_telephone}
            onChange={onChange}
            className="rounded-xl border px-3 py-2"
            placeholder="Contact urgence - Téléphone"
          />
          <input
            name="team_name"
            value={f.team_name}
            onChange={onChange}
            className="rounded-xl border px-3 py-2"
            placeholder="Équipe (si applicable)"
          />
          <input
            name="dossard"
            value={f.dossard}
            onChange={onChange}
            className="rounded-xl border px-3 py-2"
            placeholder="Dossard (optionnel)"
          />
          <div className="flex items-center gap-2 md:col-span-2">
            <input
              id="apres"
              type="checkbox"
              name="apparaitre_resultats"
              checked={f.apparaitre_resultats}
              onChange={onChange}
            />
            <label htmlFor="apres" className="text-sm">
              Apparaître dans les résultats
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3 md:col-span-2">
            <select
              name="statut"
              value={f.statut}
              onChange={onChange}
              className="rounded-xl border px-3 py-2"
            >
              <option value="en_attente">En attente</option>
              <option value="paye">Payé</option>
              <option value="annule">Annulé</option>
            </select>
            <div className="text-xs text-neutral-600 flex items-center">
              Format : <b className="ml-1">{formatId || "—"}</b>
            </div>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border px-4 py-2 text-sm hover:bg-white"
          >
            Annuler
          </button>
          <button
            onClick={save}
            disabled={saving}
            className={cls(
              "rounded-xl px-4 py-2 text-sm font-semibold text-white",
              saving ? "bg-neutral-400" : "bg-neutral-900 hover:bg-black"
            )}
          >
            {saving ? "Ajout…" : "Ajouter"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------- Modale Ajout Équipe ---------------------- */
function AddTeamModal({
  open,
  onClose,
  onCreated,
  courseId,
  formatId,
  defaultSize = 2,
}) {
  const emptyMember = () => ({
    nom: "",
    prenom: "",
    genre: "",
    date_naissance: "",
    numero_licence: "",
    email: "",
  });
  const [saving, setSaving] = useState(false);
  const [teamName, setTeamName] = useState("Équipe");
  const [size, setSize] = useState(defaultSize || 2);
  const [members, setMembers] = useState(
    Array.from({ length: defaultSize || 2 }, emptyMember)
  );

  useEffect(() => {
    if (!open) {
      setSaving(false);
      setTeamName("Équipe");
      setSize(defaultSize || 2);
      setMembers(Array.from({ length: defaultSize || 2 }, emptyMember));
    }
  }, [open, defaultSize]);

  if (!open) return null;

  const setMember = (i, k, v) =>
    setMembers((prev) => {
      const c = [...prev];
      c[i] = { ...c[i], [k]: v };
      return c;
    });
  const applySize = (n) => {
    n = Math.max(1, Number(n || 1));
    setSize(n);
    setMembers((prev) => {
      const arr = [...prev];
      if (n > arr.length)
        arr.push(...Array.from({ length: n - arr.length }, emptyMember));
      else if (n < arr.length) arr.length = n;
      return arr;
    });
  };

  const save = async () => {
    if (!formatId) return alert("Format introuvable.");
    if (!teamName.trim()) return alert("Nom d’équipe requis.");
    if (
      members.some(
        (m) =>
          !m.nom?.trim() ||
          !m.prenom?.trim() ||
          !m.genre ||
          !m.date_naissance ||
          !m.numero_licence?.trim()
      )
    ) {
      return alert(
        "Tous les membres doivent avoir nom, prénom, sexe, date de naissance et N° licence/PPS."
      );
    }
    setSaving(true);
    try {
      // 1) Groupe
      const { data: group, error: gerr } = await supabase
        .from("inscriptions_groupes")
        .insert({
          team_name: teamName.trim(),
          team_category: null,
          statut: "en_attente",
          members_count: members.length,
        })
        .select("id")
        .single();
      if (gerr) throw gerr;

      // 2) Membres
      const rows = members.map((m) => ({
        course_id: courseId || null,
        format_id: formatId,
        member_of_group_id: group.id,
        team_name: teamName.trim(),
        nom: m.nom.trim(),
        prenom: m.prenom.trim(),
        genre: m.genre,
        date_naissance: m.date_naissance,
        numero_licence: m.numero_licence?.trim(),
        email: m.email?.trim() || null,
        statut: "en_attente",
      }));
      const { error: ierr } = await supabase
        .from("inscriptions")
        .insert(rows);
      if (ierr) throw ierr;

      onCreated?.();
      onClose();
      alert("Équipe ajoutée.");
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l’ajout de l’équipe.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-xl ring-1 ring-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Ajouter une équipe</h3>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-800 text-sm"
          >
            Fermer
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              className="rounded-xl border px-3 py-2"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Nom d’équipe *"
            />
            <input
              type="number"
              min={1}
              className="rounded-xl border px-3 py-2"
              value={size}
              onChange={(e) => applySize(e.target.value)}
              placeholder="Taille"
            />
            <div className="text-xs text-neutral-600 flex items-center">
              Format : <b className="ml-1">{formatId || "—"}</b>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-600">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Nom *</th>
                  <th className="px-3 py-2">Prénom *</th>
                  <th className="px-3 py-2">Sexe *</th>
                  <th className="px-3 py-2">Date de naissance *</th>
                  <th className="px-3 py-2">N° licence / PPS *</th>
                  <th className="px-3 py-2">Email</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2">{i + 1}</td>
                    <td className="px-3 py-2">
                      <input
                        className="w-44 rounded-xl border px-2 py-1"
                        value={m.nom}
                        onChange={(e) => setMember(i, "nom", e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className="w-44 rounded-xl border px-2 py-1"
                        value={m.prenom}
                        onChange={(e) => setMember(i, "prenom", e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="rounded-xl border px-2 py-1"
                        value={m.genre}
                        onChange={(e) => setMember(i, "genre", e.target.value)}
                      >
                        <option value="">—</option>
                        <option>Homme</option>
                        <option>Femme</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        className="rounded-xl border px-2 py-1"
                        value={m.date_naissance}
                        onChange={(e) =>
                          setMember(i, "date_naissance", e.target.value)
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className="w-52 rounded-xl border px-2 py-1"
                        value={m.numero_licence}
                        onChange={(e) =>
                          setMember(i, "numero_licence", e.target.value)
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className="w-60 rounded-xl border px-2 py-1"
                        value={m.email}
                        onChange={(e) => setMember(i, "email", e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border px-4 py-2 text-sm hover:bg-white"
          >
            Annuler
          </button>
          <button
            onClick={save}
            disabled={saving}
            className={cls(
              "rounded-xl px-4 py-2 text-sm font-semibold text-white",
              saving ? "bg-neutral-400" : "bg-neutral-900 hover:bg-black"
            )}
          >
            {saving ? "Ajout…" : "Créer l’équipe"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------- Modale Export CSV ---------------------- */
function ExportCsvModal({ open, onClose, rows, columns, filenameBase = "inscriptions" }) {
  if (!open) return null;
  const csvEscape = (v) => {
    if (v == null) return "";
    const s = String(v);
    if (s.includes('"') || s.includes(";") || s.includes("\n"))
      return `"${s.replaceAll('"', '""')}"`;
    return s;
  };
  const exportCsv = () => {
    const visible = columns.filter((c) => c.visible);
    const header = visible.map((c) => csvEscape(c.label)).join(";");
    const lines = rows.map((r) =>
      visible
        .map((c) => {
          const v =
            typeof c.accessor === "function" ? c.accessor(r) : r[c.key];
          return csvEscape(v);
        })
        .join(";")
    );
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `${filenameBase}-${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    onClose?.();
  };
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl ring-1 ring-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Exporter en CSV</h3>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-800 text-sm"
          >
            Fermer
          </button>
        </div>
        <div className="p-5">
          <div className="text-sm font-medium mb-2">Colonnes à inclure</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {columns.map((c, i) => (
              <label
                key={c.key}
                className="inline-flex items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={c.visible}
                  onChange={(e) => c.onToggle?.(i, e.target.checked)}
                />
                {c.label}
              </label>
            ))}
          </div>
        </div>
        <div className="px-5 py-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm hover:bg-white"
          >
            Annuler
          </button>
          <button
            onClick={exportCsv}
            className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            Exporter
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------- Page ListeInscriptions ----------------------- */
export default function ListeInscriptions() {
  const { courseId: routeParam } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const [resolvedCourseId, setResolvedCourseId] = useState(null);
  const initialFormatId = searchParams.get("formatId") || "";
  const [formatId, setFormatId] = useState(initialFormatId);

  const [statut, setStatut] = useState(searchParams.get("statut") || "all");
  const [q, setQ] = useState(searchParams.get("q") || "");
  const debouncedQ = useDebounced(q, 400);
  const [sortBy, setSortBy] = useState(
    searchParams.get("sortBy") || "created_at"
  );
  const [sortDir, setSortDir] = useState(
    searchParams.get("sortDir") || "desc"
  );

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  const [formats, setFormats] = useState([]);
  const [formatType, setFormatType] = useState("individuel");
  const [defaultTeamSize, setDefaultTeamSize] = useState(2);

  const [groupMap, setGroupMap] = useState(new Map());
  const [optionsMap, setOptionsMap] = useState(new Map());
  const [optionLabelMap, setOptionLabelMap] = useState(new Map());

  // UI
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;
  const [selected, setSelected] = useState(new Set());
  const [showEmail, setShowEmail] = useState(false);
  const [showAddRunner, setShowAddRunner] = useState(false);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showAssignBib, setShowAssignBib] = useState(false);

  // ✅ Waitlist UI
  const [showInviteWaitlist, setShowInviteWaitlist] = useState(false);
  const [waitlistCount, setWaitlistCount] = useState(null); // null=unknown
  const [waitlistLoading, setWaitlistLoading] = useState(false);

  // Fédérations & catégories
  const [federations, setFederations] = useState([]);
  const [federationCode, setFederationCode] = useState("FFA");
  const [previewCategories, setPreviewCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesApplying, setCategoriesApplying] = useState(false);
  const [categoriesError, setCategoriesError] = useState(null);

  const updateQS = useCallback(
    (next) => {
      const sp = new URLSearchParams(searchParams.toString());
      Object.entries(next).forEach(([k, v]) => {
        if (v === "" || v == null) sp.delete(k);
        else sp.set(k, String(v));
      });
      setSearchParams(sp, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  /* -------- Auto-détection courseId ⇄ formatId -------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!routeParam) {
        setResolvedCourseId(null);
        return;
      }
      const { data: fmtByCourse } = await supabase
        .from("formats")
        .select("id")
        .eq("course_id", routeParam)
        .limit(1);
      if (!alive) return;

      if (fmtByCourse && fmtByCourse.length > 0) {
        setResolvedCourseId(routeParam);
      } else {
        const { data: fmt } = await supabase
          .from("formats")
          .select("id, course_id")
          .eq("id", routeParam)
          .maybeSingle();
        if (!alive) return;
        if (fmt?.course_id) {
          setResolvedCourseId(fmt.course_id);
          if (!initialFormatId) {
            setFormatId(fmt.id);
            const sp = new URLSearchParams(searchParams.toString());
            sp.set("formatId", fmt.id);
            setSearchParams(sp, { replace: true });
          }
        } else {
          setResolvedCourseId(null);
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeParam]);

  /* ---------------- Charger Formats (libellé + type) ---------------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      const base = supabase
        .from("formats")
        .select(
          "id, nom, date, course_id, type_format, team_size, nb_coureurs_min, nb_coureurs_max"
        )
        .order("date", { ascending: true });
      const { data, error } = resolvedCourseId
        ? await base.eq("course_id", resolvedCourseId)
        : await base;
      if (!alive) return;
      if (!error && data) {
        setFormats(data);
        if (formatId) {
          const f = data.find((x) => x.id === formatId);
          if (f) {
            setFormatType(f.type_format || "individuel");
            setDefaultTeamSize(f.team_size || f.nb_coureurs_min || 2);
          }
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [resolvedCourseId, formatId]);

  const formatObj = useMemo(
    () => (formatId ? formats.find((f) => f.id === formatId) : null),
    [formats, formatId]
  );
  const formatLabel = formatObj
    ? `${formatObj.nom}${formatObj.date ? ` — ${formatObj.date}` : ""}`
    : formatId || "—";

  /* ---------------- Waitlist count (format courant) ---------------- */
  const loadWaitlistCount = useCallback(async () => {
    if (!resolvedCourseId || !formatId) {
      setWaitlistCount(null);
      return;
    }
    setWaitlistLoading(true);
    try {
      // On compte les entrées actives (non consommées)
      const { count, error } = await supabase
        .from("waitlist")
        .select("id", { count: "exact", head: true })
        .eq("course_id", resolvedCourseId)
        .eq("format_id", formatId)
        .is("consumed_at", null);

      if (error) {
        console.warn("WAITLIST_COUNT_ERROR", error);
        setWaitlistCount(null);
      } else {
        setWaitlistCount(count ?? 0);
      }
    } catch (e) {
      console.warn("WAITLIST_COUNT_CATCH", e);
      setWaitlistCount(null);
    } finally {
      setWaitlistLoading(false);
    }
  }, [resolvedCourseId, formatId]);

  useEffect(() => {
    loadWaitlistCount();
  }, [loadWaitlistCount]);

  /* ---------------- Charger la liste des fédérations ---------------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("federations")
        .select("code, name, season_start_month")
        .order("code", { ascending: true });
      if (!alive) return;
      if (!error && data) {
        setFederations(data);
        if (!federationCode && data.length > 0) {
          setFederationCode(data[0].code);
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------- Colonnes du tableur ------------------------- */
  const [columns, setColumns] = useState([
    { key: "id", label: "ID", visible: false },
    {
      key: "created_at",
      label: "Créé le",
      visible: true,
      accessor: (r) => formatDateTime(r.created_at),
    },
    { key: "statut", label: "Statut", visible: true },
    { key: "nom", label: "Nom", visible: true },
    { key: "prenom", label: "Prénom", visible: true },
    { key: "dossard", label: "Dossard", visible: true },
    { key: "email", label: "Email", visible: true },
    { key: "genre", label: "Genre", visible: false },
    { key: "date_naissance", label: "Naissance", visible: false },
    { key: "numero_licence", label: "N° licence/PPS", visible: true },
    { key: "club", label: "Club", visible: false },
    { key: "telephone", label: "Téléphone", visible: false },
    { key: "adresse", label: "Adresse", visible: false },
    { key: "adresse_complement", label: "Complément", visible: false },
    { key: "code_postal", label: "Code postal", visible: false },
    { key: "ville", label: "Ville", visible: false },
    { key: "pays", label: "Pays", visible: false },
    {
      key: "apparaitre_resultats",
      label: "Résultats (oui/non)",
      visible: false,
      accessor: (r) => (r.apparaitre_resultats ? "Oui" : "Non"),
    },
    { key: "justificatif_type", label: "Type justificatif", visible: false },
    { key: "pps_identifier", label: "Identifiant PPS", visible: false },
    { key: "contact_urgence_nom", label: "Nom contact urgence", visible: false },
    {
      key: "contact_urgence_telephone",
      label: "Tél. contact urgence",
      visible: false,
    },
    { key: "team_name", label: "Équipe", visible: true },
    { key: "member_of_group_id", label: "Groupe ID", visible: false },
    {
      key: "federation_code",
      label: "Fédé catégorie",
      visible: false,
    },
    {
      key: "categorie_age_code",
      label: "Catégorie (code)",
      visible: false,
    },
    {
      key: "categorie_age_label",
      label: "Catégorie d’âge",
      visible: true,
    },
  ]);
  const toggleCol = (i, vis) =>
    setColumns((prev) =>
      prev.map((c, idx) => (idx === i ? { ...c, visible: vis } : c))
    );

  /* ---------------------- Charger Inscriptions ---------------------- */
  const load = useCallback(async () => {
    setLoading(true);
    setSelected(new Set());
    try {
      if (!formatId) {
        setRows([]);
        setTotal(0);
        setLoading(false);
        return;
      }
      if (
        resolvedCourseId &&
        formatObj?.course_id &&
        formatObj.course_id !== resolvedCourseId
      ) {
        setRows([]);
        setTotal(0);
        setLoading(false);
        return;
      }

      let query = supabase
        .from("inscriptions")
        .select(
          "id, created_at, statut, course_id, format_id, member_of_group_id, team_name," +
            "nom, prenom, email, genre, date_naissance, nationalite, telephone, adresse, adresse_complement, code_postal, ville, pays, apparaitre_resultats, club, justificatif_type, numero_licence, pps_identifier, contact_urgence_nom, contact_urgence_telephone, dossard," +
            "federation_code, categorie_age_code, categorie_age_label",
          { count: "exact" }
        );

      if (resolvedCourseId) query = query.eq("course_id", resolvedCourseId);
      query = query.eq("format_id", formatId);

      if (statut && statut !== "all") {
        const s = (statut || "").toLowerCase();
        const SET = {
          paye: ["paye", "payé", "paid", "validé", "confirmé", "confirmed"],
          annule: ["annule", "annulé", "canceled", "cancelled"],
          en_attente: ["en_attente", "en attente", "pending", "attente"],
        };
        const key =
          s === "paye" ? "paye" : s === "annule" ? "annule" : "en_attente";
        query = query.in("statut", SET[key]);
      }

      if (debouncedQ) {
        query = query.or(
          [
            `nom.ilike.%${debouncedQ}%`,
            `prenom.ilike.%${debouncedQ}%`,
            `email.ilike.%${debouncedQ}%`,
            `team_name.ilike.%${debouncedQ}%`,
            `numero_licence.ilike.%${debouncedQ}%`,
            `club.ilike.%${debouncedQ}%`,
            `ville.ilike.%${debouncedQ}%`,
            `dossard::text.ilike.%${debouncedQ}%`,
          ].join(",")
        );
      }

      if (sortBy === "nom")
        query = query.order("nom", {
          ascending: sortDir === "asc",
          nullsFirst: false,
        });
      else if (sortBy === "statut")
        query = query.order("statut", {
          ascending: sortDir === "asc",
          nullsFirst: false,
        });
      else
        query = query.order("created_at", {
          ascending: sortDir === "asc",
          nullsFirst: false,
        });

      const { data, error, count } = await query;
      if (error) throw error;

      setRows(data || []);
      setTotal(count || (data?.length || 0));

      // Groupes
      const grpIds = [
        ...new Set((data || []).map((r) => r.member_of_group_id).filter(Boolean)),
      ];
      if (grpIds.length) {
        const { data: groups } = await supabase
          .from("inscriptions_groupes")
          .select("id, team_name, team_category, statut, members_count")
          .in("id", grpIds);
        const m = new Map();
        (groups || []).forEach((g) => m.set(g.id, g));
        setGroupMap(m);
      } else setGroupMap(new Map());

      // Options confirmées
      const ids = (data || []).map((r) => r.id);
      if (ids.length) {
        const { data: opts } = await supabase
          .from("inscriptions_options")
          .select(
            "inscription_id, option_id, quantity, prix_unitaire_cents, status"
          )
          .in("inscription_id", ids)
          .eq("status", "confirmed");
        const m = new Map();
        (opts || []).forEach((o) => {
          if (!m.has(o.inscription_id)) m.set(o.inscription_id, []);
          m.get(o.inscription_id).push(o);
        });
        setOptionsMap(m);
        const optionIds = [...new Set((opts || []).map((o) => o.option_id))];
        if (optionIds.length) {
          const { data: defs } = await supabase
            .from("options_catalogue")
            .select("id, label")
            .in("id", optionIds);
          const mm = new Map();
          (defs || []).forEach((d) =>
            mm.set(d.id, d.label || `#${String(d.id).slice(0, 8)}`)
          );
          setOptionLabelMap(mm);
        } else setOptionLabelMap(new Map());
      } else {
        setOptionsMap(new Map());
        setOptionLabelMap(new Map());
      }
    } catch (e) {
      console.error("LOAD_INSC_ERROR", e);
    } finally {
      setLoading(false);
    }
  }, [formatId, resolvedCourseId, formatObj, statut, debouncedQ, sortBy, sortDir]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    updateQS({ formatId, statut, q, sortBy, sortDir });
  }, [formatId, statut, q, sortBy, sortDir]); // eslint-disable-line

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [formatId, statut, debouncedQ, sortBy, sortDir]);

  // Pagination (client)
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE;
  const pageRows = rows.slice(from, to);

  // Sélection
  const allChecked =
    pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));
  const toggleRow = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) pageRows.forEach((r) => next.delete(r.id));
      else pageRows.forEach((r) => next.add(r.id));
      return next;
    });

  const recipients = useMemo(() => {
    const emails = new Set();
    rows.forEach((r) => {
      if (selected.has(r.id) && r.email)
        emails.add(r.email.trim().toLowerCase());
    });
    return Array.from(emails);
  }, [rows, selected]);

  // Edition inline
  const updateStatut = async (row, newStatut) => {
    const prev = row.statut;
    setRows((rs) =>
      rs.map((r) => (r.id === row.id ? { ...r, statut: newStatut } : r))
    );
    const { error } = await supabase
      .from("inscriptions")
      .update({ statut: newStatut })
      .eq("id", row.id);
    if (error) {
      setRows((rs) =>
        rs.map((r) => (r.id === row.id ? { ...r, statut: prev } : r))
      );
      alert("Impossible de mettre à jour le statut.");
    }
  };
  const updateField = async (row, key, value) => {
    const prev = row[key];
    setRows((rs) =>
      rs.map((r) => (r.id === row.id ? { ...r, [key]: value } : r))
    );
    const payload =
      key === "dossard" && value !== ""
        ? { dossard: Number(value) }
        : { [key]: value === "" ? null : value };
    const { error } = await supabase
      .from("inscriptions")
      .update(payload)
      .eq("id", row.id);
    if (error) {
      setRows((rs) =>
        rs.map((r) => (r.id === row.id ? { ...r, [key]: prev } : r))
      );
      alert("Sauvegarde impossible.");
    }
  };

  // Effacer dossards (sélection ou tout filtré)
  const clearBibNumbers = async (scope = "selected") => {
    const ids =
      scope === "selected" ? Array.from(selected) : rows.map((r) => r.id);
    if (ids.length === 0) return alert("Aucun coureur concerné.");
    const confirm = window.confirm(
      `Effacer le dossard de ${ids.length} coureur(s) ?`
    );
    if (!confirm) return;
    try {
      const batches = chunk(ids, 500).map((part) =>
        supabase.from("inscriptions").update({ dossard: null }).in("id", part)
      );
      const res = await Promise.allSettled(batches);
      const ok = res.filter((r) => r.status === "fulfilled").length;
      if (ok === batches.length) {
        alert("Dossards effacés.");
        load();
      } else {
        alert("Certains effacements ont échoué (voir console).");
        console.warn(res);
        load();
      }
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l’effacement des dossards.");
    }
  };

  const visibleColumns = columns
    .map((c, i) => ({ ...c, onToggle: (idx, vis) => toggleCol(idx, vis) }))
    .filter(Boolean);

  /* ---------------------- Catégories d'âge : calcul ---------------------- */
  const handleComputeCategories = async () => {
    if (!formatId || rows.length === 0) return;
    setCategoriesLoading(true);
    setCategoriesError(null);
    setPreviewCategories([]);

    try {
      const [fedRes, catRes] = await Promise.all([
        supabase
          .from("federations")
          .select("*")
          .eq("code", federationCode)
          .maybeSingle(),
        supabase
          .from("federation_categories")
          .select("*")
          .eq("federation_code", federationCode)
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
      ]);

      if (fedRes.error) throw fedRes.error;
      if (catRes.error) throw catRes.error;

      const federation = fedRes.data;
      const categories = catRes.data || [];
      if (!federation) {
        setCategoriesError("Fédération introuvable.");
        return;
      }
      if (categories.length === 0) {
        setCategoriesError("Aucune catégorie active pour cette fédération.");
        return;
      }

      const eventDate = formatObj?.date
        ? new Date(formatObj.date)
        : new Date();

      const preview = rows.map((ins) => {
        const sex =
          ins.genre === "Homme"
            ? "M"
            : ins.genre === "Femme"
            ? "F"
            : "ALL";

        const cat = computeCategoryForAthlete({
          birthDate: ins.date_naissance,
          eventDate,
          sex,
          categories,
          federationSeasonStartMonth: federation.season_start_month || 1,
        });

        return {
          inscriptionId: ins.id,
          nom: ins.nom,
          prenom: ins.prenom,
          dossard: ins.dossard,
          birthYear: ins.date_naissance
            ? new Date(ins.date_naissance).getFullYear()
            : null,
          currentCode: ins.categorie_age_code || null,
          currentLabel: ins.categorie_age_label || null,
          newCode: cat ? cat.code : null,
          newLabel: cat ? cat.label : null,
        };
      });

      setPreviewCategories(preview);
    } catch (e) {
      console.error(e);
      setCategoriesError("Erreur lors du calcul des catégories.");
    } finally {
      setCategoriesLoading(false);
    }
  };

  const handleApplyCategories = async () => {
    if (!previewCategories.length) return;
    setCategoriesApplying(true);
    try {
      const withCat = previewCategories.filter((p) => p.newCode);
      for (const row of withCat) {
        const { error } = await supabase
          .from("inscriptions")
          .update({
            federation_code: federationCode,
            categorie_age_code: row.newCode,
            categorie_age_label: row.newLabel,
          })
          .eq("id", row.inscriptionId);
        if (error) {
          console.error(
            "Erreur update catégorie pour inscription",
            row.inscriptionId,
            error
          );
        }
      }
      await load();
      setPreviewCategories([]);
      alert("Catégories d’âge appliquées aux inscrits.");
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l’application des catégories.");
    } finally {
      setCategoriesApplying(false);
    }
  };

  const previewChangedCount = useMemo(
    () =>
      previewCategories.filter(
        (p) => p.newCode && p.newCode !== p.currentCode
      ).length,
    [previewCategories]
  );

  const currentFed = federations.find((f) => f.code === federationCode);

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {resolvedCourseId ? (
            <Link
              to={`/courses/${resolvedCourseId}`}
              className="text-sm text-neutral-500 hover:text-neutral-800"
            >
              ← Retour à la course
            </Link>
          ) : (
            <Link
              to="/"
              className="text-sm text-neutral-500 hover:text-neutral-800"
            >
              ← Accueil
            </Link>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold mt-1">Inscriptions</h1>
          <p className="text-neutral-600 mt-1">
            {total} résultat{total > 1 ? "s" : ""} —{" "}
            {formatObj ? formatObj.nom : `Format ${formatId || "?"}`}{" "}
            {formatObj?.date ? `(${formatObj.date})` : ""}
          </p>

          {/* ✅ mini ligne waitlist */}
          <div className="mt-2 text-xs text-neutral-600">
            Liste d’attente :{" "}
            {waitlistLoading ? (
              <span className="text-neutral-500">chargement…</span>
            ) : waitlistCount == null ? (
              <span className="text-neutral-500">—</span>
            ) : (
              <b>{waitlistCount}</b>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowEmail(true)}
            disabled={recipients.length === 0}
            className={cls(
              "rounded-xl px-4 py-2 text-sm font-semibold",
              recipients.length === 0
                ? "bg-neutral-300 text-neutral-600 cursor-not-allowed"
                : "bg-neutral-900 text-white hover:bg-black"
            )}
          >
            Email aux sélectionnés ({recipients.length})
          </button>

          {/* ✅ bouton waitlist */}
          <button
            onClick={() => setShowInviteWaitlist(true)}
            disabled={!resolvedCourseId || !formatId}
            className={cls(
              "rounded-xl border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50",
              (!resolvedCourseId || !formatId) && "opacity-60 cursor-not-allowed"
            )}
            title="Inviter des personnes depuis la liste d’attente"
          >
            Inviter liste d’attente
            {typeof waitlistCount === "number" ? ` (${waitlistCount})` : ""}
          </button>

          <button
            onClick={() => setShowAddRunner(true)}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
          >
            + Ajouter un coureur
          </button>

          {(formatType === "groupe" || formatType === "relais") && (
            <button
              onClick={() => setShowAddTeam(true)}
              className="rounded-xl border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
            >
              + Ajouter une équipe
            </button>
          )}

          <button
            onClick={() => setShowExport(true)}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
          >
            Export CSV {selected.size > 0 ? `(${selected.size})` : "(tout)"}
          </button>

          <button
            onClick={() => {
              load();
              loadWaitlistCount();
            }}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
          >
            Rafraîchir
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-sm font-medium">Statut</label>
          <select
            value={statut}
            onChange={(e) => setStatut(e.target.value)}
            className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
          >
            <option value="all">Tous</option>
            <option value="paye">Payé</option>
            <option value="en_attente">En attente</option>
            <option value="annule">Annulé</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium">Recherche</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
            placeholder="Nom, prénom, email, équipe, licence, ville, dossard…"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Tri</label>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-xl border border-neutral-300 px-3 py-2"
            >
              <option value="created_at">Date</option>
              <option value="nom">Nom</option>
              <option value="statut">Statut</option>
            </select>
            <select
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value)}
              className="rounded-xl border border-neutral-300 px-3 py-2"
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>
        </div>
      </div>

      {/* Blocs gestion dossards & catégories */}
      <div className="mb-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bloc Dossards */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-neutral-800">
              Gestion des dossards
            </h2>
            <span className="text-xs text-neutral-500">
              {selected.size} sélectionné{selected.size > 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-xs text-neutral-500 mb-3">
            Utilisez ces actions pour attribuer ou effacer les dossards sur le
            périmètre filtré.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowAssignBib(true)}
              className="rounded-xl border border-neutral-300 px-4 py-2 text-xs sm:text-sm hover:bg-neutral-50"
            >
              Attribuer des dossards{" "}
              {selected.size > 0 ? `(${selected.size})` : ""}
            </button>

            <div className="relative inline-flex">
              <button
                onClick={() => clearBibNumbers("selected")}
                className="rounded-l-xl border border-neutral-300 px-4 py-2 text-xs sm:text-sm hover:bg-neutral-50"
              >
                Effacer dossards (sélection)
              </button>
              <button
                onClick={() => clearBibNumbers("all")}
                className="rounded-r-xl border-t border-b border-r border-neutral-300 px-3 py-2 text-xs sm:text-sm hover:bg-neutral-50"
              >
                Tout filtré
              </button>
            </div>
          </div>
        </div>

        {/* Bloc Catégories d'âge */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-neutral-800">
              Catégories d&apos;âge
            </h2>
            {currentFed && (
              <span className="text-xs text-neutral-500">
                Saison : début{" "}
                <b>{currentFed.season_start_month || 1}/</b>
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500 mb-3">
            Choisissez une fédération pour pré-calculer les catégories d&apos;âge
            des inscrits du format courant, puis appliquez-les dans la base.
          </p>

          <div className="flex flex-wrap items-end gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">
                Fédération
              </label>
              <select
                value={federationCode}
                onChange={(e) => setFederationCode(e.target.value)}
                className="rounded-xl border border-neutral-300 px-3 py-2 text-sm bg-white"
              >
                {federations.length === 0 && (
                  <option value="FFA">FFA - Athlétisme</option>
                )}
                {federations.map((fed) => (
                  <option key={fed.code} value={fed.code}>
                    {fed.code} — {fed.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleComputeCategories}
              disabled={categoriesLoading || rows.length === 0}
              className={cls(
                "rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold",
                rows.length === 0
                  ? "bg-neutral-200 text-neutral-500 cursor-not-allowed"
                  : "bg-neutral-900 text-white hover:bg-black",
                categoriesLoading && "opacity-70 cursor-wait"
              )}
            >
              {categoriesLoading ? "Calcul en cours…" : "Pré-calculer"}
            </button>

            <button
              type="button"
              onClick={handleApplyCategories}
              disabled={
                categoriesApplying ||
                previewCategories.length === 0 ||
                rows.length === 0
              }
              className={cls(
                "rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold",
                previewCategories.length === 0
                  ? "bg-neutral-200 text-neutral-500 cursor-not-allowed"
                  : "bg-emerald-600 text-white hover:bg-emerald-500",
                categoriesApplying && "opacity-70 cursor-wait"
              )}
            >
              {categoriesApplying
                ? "Application…"
                : `Appliquer aux inscrits${
                    previewChangedCount ? ` (${previewChangedCount} changés)` : ""
                  }`}
            </button>
          </div>

          {categoriesError && (
            <div className="mb-2 text-xs text-red-600">{categoriesError}</div>
          )}

          {previewCategories.length > 0 && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-neutral-500">
                  Prévisualisation sur {previewCategories.length} inscrit
                  {previewCategories.length > 1 ? "s" : ""}.
                </span>
                {previewChangedCount > 0 && (
                  <span className="text-xs font-medium text-emerald-700">
                    {previewChangedCount} catégorie
                    {previewChangedCount > 1 ? "s" : ""} modifiée
                  </span>
                )}
              </div>
              <div className="max-h-56 overflow-auto border border-neutral-200 rounded-xl bg-neutral-50">
                <table className="min-w-full text-[11px]">
                  <thead className="bg-neutral-100 text-neutral-600">
                    <tr>
                      <th className="px-2 py-1 text-left">Dossard</th>
                      <th className="px-2 py-1 text-left">Nom</th>
                      <th className="px-2 py-1 text-left">Année</th>
                      <th className="px-2 py-1 text-left">Actuelle</th>
                      <th className="px-2 py-1 text-left">Proposée</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewCategories.map((row) => (
                      <tr
                        key={row.inscriptionId}
                        className="border-t border-neutral-200"
                      >
                        <td className="px-2 py-1">{row.dossard || "—"}</td>
                        <td className="px-2 py-1">
                          {row.nom} {row.prenom}
                        </td>
                        <td className="px-2 py-1">{row.birthYear || "—"}</td>
                        <td className="px-2 py-1 text-neutral-500">
                          {row.currentCode
                            ? `${row.currentCode} – ${row.currentLabel}`
                            : "—"}
                        </td>
                        <td className="px-2 py-1 font-medium">
                          {row.newCode ? (
                            row.newCode === row.currentCode ? (
                              <span className="text-neutral-700">
                                {row.newCode} – {row.newLabel}
                              </span>
                            ) : (
                              <span className="text-emerald-700">
                                {row.newCode} – {row.newLabel}
                              </span>
                            )
                          ) : (
                            <span className="text-red-500">
                              Aucune catégorie
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Colonnes visibles */}
      <div className="mb-3 rounded-xl border border-neutral-200 bg-white p-3">
        <div className="text-sm font-medium mb-2">Colonnes affichées</div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {columns.map((c, i) => (
            <label key={c.key} className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={c.visible}
                onChange={(e) => toggleCol(i, e.target.checked)}
              />{" "}
              {c.label}
            </label>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-2 bg-neutral-50 border-b border-neutral-200 text-sm flex items-center gap-3">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={allChecked} onChange={toggleAll} />
            Tout sélectionner (page)
          </label>
          <div className="text-neutral-500">
            {selected.size} sélectionné{selected.size > 1 ? "s" : ""}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full text-sm">
            <thead>
              <tr className="text-left text-neutral-600">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                  />
                </th>
                {columns
                  .filter((c) => c.visible)
                  .map((c) => (
                    <th
                      key={c.key}
                      className={cls(
                        "px-4 py-3",
                        ["nom", "statut", "created_at"].includes(c.key)
                          ? "cursor-pointer"
                          : ""
                      )}
                      onClick={() => {
                        if (["nom", "statut", "created_at"].includes(c.key)) {
                          setSortBy(c.key);
                          setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                        }
                      }}
                    >
                      {c.label}
                    </th>
                  ))}
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3">
                      <div className="h-4 w-4 rounded bg-neutral-100" />
                    </td>
                    {columns
                      .filter((c) => c.visible)
                      .map((c, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 w-28 rounded bg-neutral-100" />
                        </td>
                      ))}
                    <td className="px-4 py-3">
                      <div className="h-6 w-20 rounded bg-neutral-100" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.filter((c) => c.visible).length + 2}
                    className="px-4 py-6 text-center text-neutral-600"
                  >
                    Aucun résultat — ajustez vos filtres.
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => (
                  <tr key={r.id} className="hover:bg-neutral-50/60">
                    <td className="px-4 py-3 align-top">
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggleRow(r.id)}
                      />
                    </td>

                    {columns
                      .filter((c) => c.visible)
                      .map((c) => {
                        const content =
                          typeof c.accessor === "function"
                            ? c.accessor(r)
                            : r[c.key];

                        // champs éditables inline
                        if (
                          [
                            "numero_licence",
                            "club",
                            "email",
                            "telephone",
                            "team_name",
                            "dossard",
                          ].includes(c.key)
                        ) {
                          return (
                            <td key={c.key} className="px-4 py-2 align-top">
                              <input
                                className="w-40 rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                                value={content ?? ""}
                                onChange={(e) =>
                                  updateField(r, c.key, e.target.value)
                                }
                                placeholder={c.key === "dossard" ? "—" : ""}
                              />
                            </td>
                          );
                        }

                        if (c.key === "statut") {
                          const v =
                            (r.statut || "").toLowerCase() === "en attente"
                              ? "en_attente"
                              : r.statut || "";
                          return (
                            <td key={c.key} className="px-4 py-2 align-top">
                              <div className="flex items-center gap-2">
                                <StatusBadge status={r.statut} />
                                <select
                                  value={v}
                                  onChange={(e) =>
                                    updateStatut(r, e.target.value)
                                  }
                                  className="rounded-lg border border-neutral-300 px-2 py-1 text-xs"
                                >
                                  <option value="en_attente">En attente</option>
                                  <option value="paye">Payé</option>
                                  <option value="annule">Annulé</option>
                                </select>
                              </div>
                            </td>
                          );
                        }

                        return (
                          <td key={c.key} className="px-4 py-2 align-top">
                            {content ?? "—"}
                          </td>
                        );
                      })}

                    <td className="px-4 py-2 align-top">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={`/details-coureur/${r.id}`}
                          className="inline-flex items-center rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                        >
                          Fiche
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-neutral-200 flex items-center justify-between text-sm">
          <div className="text-neutral-600">
            {total} résultat{total > 1 ? "s" : ""} • {PAGE_SIZE} par page
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className={cls(
                "rounded-lg border px-3 py-1.5",
                page <= 1
                  ? "text-neutral-400 border-neutral-200 cursor-not-allowed"
                  : "hover:bg-neutral-50"
              )}
            >
              Précédent
            </button>
            <span className="text-neutral-600">
              Page {page} / {pageCount}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount}
              className={cls(
                "rounded-lg border px-3 py-1.5",
                page >= pageCount
                  ? "text-neutral-400 border-neutral-200 cursor-not-allowed"
                  : "hover:bg-neutral-50"
              )}
            >
              Suivant
            </button>
          </div>
        </div>
      </div>

      {/* Modales */}
      <EmailModal
        open={showEmail}
        onClose={() => setShowEmail(false)}
        recipients={recipients}
        onSend={({ subject, html }) => {
          if (recipients.length === 0)
            return alert("Aucun destinataire sélectionné.");
          if (!subject?.trim()) return alert("Le sujet est requis.");
          if (!html?.trim()) return alert("Le message est requis.");
          supabase.functions
            .invoke("organiser-send-emails", {
              body: { subject, html, to: recipients },
            })
            .then(({ error }) => {
              if (error) {
                console.error("organiser-send-emails", error);
                alert("Erreur d’envoi.");
              } else {
                alert(`Email envoyé à ${recipients.length} destinataire(s).`);
                setShowEmail(false);
              }
            })
            .catch(() => alert("Erreur d’envoi."));
        }}
      />

      <InviteWaitlistModal
        open={showInviteWaitlist}
        onClose={() => setShowInviteWaitlist(false)}
        courseId={resolvedCourseId}
        formatId={formatId}
        formatLabel={formatLabel}
        onDone={() => loadWaitlistCount()}
      />

      <AddRunnerModal
        open={showAddRunner}
        onClose={() => setShowAddRunner(false)}
        onCreated={() => load()}
        courseId={resolvedCourseId}
        formatId={formatId}
      />

      <AddTeamModal
        open={showAddTeam}
        onClose={() => setShowAddTeam(false)}
        onCreated={() => load()}
        courseId={resolvedCourseId}
        formatId={formatId}
        defaultSize={defaultTeamSize}
      />

      <AssignBibModal
        open={showAssignBib}
        onClose={() => setShowAssignBib(false)}
        rows={rows}
        selectedIds={Array.from(selected)}
        onDone={() => {
          setShowAssignBib(false);
          load();
        }}
      />

      <ExportCsvModal
        open={showExport}
        onClose={() => setShowExport(false)}
        rows={selected.size > 0 ? rows.filter((r) => selected.has(r.id)) : rows}
        columns={visibleColumns}
        filenameBase={`inscriptions-${(formatObj?.nom || "format")
          .toString()
          .toLowerCase()
          .replace(/\s+/g, "-")}`}
      />
    </div>
  );
}
