// src/pages/InscriptionDetail.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../supabase";

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
function StatusBadge({ status }) {
  const s = (status || "").toLowerCase();
  const map = {
    paye: "bg-emerald-100 text-emerald-800",
    "en attente": "bg-amber-100 text-amber-800",
    en_attente: "bg-amber-100 text-amber-800",
    annule: "bg-rose-100 text-rose-800",
  };
  const txt = s === "paye" ? "Payé" : s === "annule" ? "Annulé" : "En attente";
  return (
    <span className={cls("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", map[s] || "bg-neutral-100 text-neutral-800")}>
      {txt}
    </span>
  );
}

export default function InscriptionDetail() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState(null);
  const [group, setGroup] = useState(null);
  const [format, setFormat] = useState(null);
  const [course, setCourse] = useState(null);
  const [options, setOptions] = useState([]);
  const [optionLabels, setOptionLabels] = useState(new Map());

  // champs éditables
  const [statut, setStatut] = useState("");
  const [dossard, setDossard] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        // Inscription
        const { data: insc, error } = await supabase
          .from("inscriptions")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        if (!alive) return;
        setRow(insc || null);
        setStatut(insc?.statut || "");
        setDossard(insc?.dossard ?? "");

        // Format
        if (insc?.format_id) {
          const { data: fmt } = await supabase
            .from("formats")
            .select("id, nom, date, nb_max_coureurs, course_id, propose_repas, prix_repas")
            .eq("id", insc.format_id)
            .maybeSingle();
          if (!alive) return;
          setFormat(fmt || null);

          // Course
          const cid = insc.course_id || fmt?.course_id;
          if (cid) {
            const { data: crs } = await supabase
              .from("courses")
              .select("id, nom, lieu, date, organisateur_id")
              .eq("id", cid)
              .maybeSingle();
            if (!alive) return;
            setCourse(crs || null);
          }
        }

        // Groupe
        if (insc?.member_of_group_id) {
          const { data: grp } = await supabase
            .from("inscriptions_groupes")
            .select("id, team_name, team_category, statut, members_count")
            .eq("id", insc.member_of_group_id)
            .maybeSingle();
          if (!alive) return;
          setGroup(grp || null);
        }

        // Options confirmées + labels
        const { data: opts } = await supabase
          .from("inscriptions_options")
          .select("inscription_id, option_id, quantity, prix_unitaire_cents, status")
          .eq("inscription_id", id)
          .eq("status", "confirmed");

        if (!alive) return;
        setOptions(opts || []);
        const ids = [...new Set((opts || []).map((o) => o.option_id))];
        if (ids.length > 0) {
          const { data: defs } = await supabase
            .from("options")
            .select("id, nom, name, label")
            .in("id", ids);
          if (!alive) return;
          const map = new Map();
          (defs || []).forEach((d) => {
            map.set(d.id, d.nom || d.name || d.label || `#${String(d.id).slice(0, 8)}`);
          });
          setOptionLabels(map);
        } else {
          setOptionLabels(new Map());
        }
      } catch (e) {
        console.error("LOAD_INSCRIPTION_DETAIL_ERROR", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const optionsView = useMemo(() => {
    if (!options?.length) return <span className="text-neutral-500">—</span>;
    return (
      <div className="flex flex-wrap gap-1.5">
        {options.map((o, i) => {
          const label = optionLabels.get(o.option_id) || `#${String(o.option_id).slice(0, 8)}`;
          return (
            <span key={o.option_id + i} className="inline-flex items-center rounded-full bg-neutral-100 text-neutral-800 px-2 py-0.5 text-xs ring-1 ring-neutral-200">
              {label}{o.quantity > 1 ? ` ×${o.quantity}` : ""}
            </span>
          );
        })}
      </div>
    );
  }, [options, optionLabels]);

  const saveStatut = async () => {
    try {
      const { error } = await supabase.from("inscriptions").update({ statut }).eq("id", id);
      if (error) throw error;
      alert("Statut mis à jour.");
    } catch (e) {
      console.error(e);
      alert("Impossible de mettre à jour le statut.");
    }
  };

  const saveDossard = async () => {
    try {
      const val = dossard === "" ? null : Number(dossard);
      if (val != null && (Number.isNaN(val) || val < 0)) {
        alert("Dossard invalide.");
        return;
      }
      const { error } = await supabase.from("inscriptions").update({ dossard: val }).eq("id", id);
      if (error) throw error;
      alert("Dossard mis à jour.");
    } catch (e) {
      console.error(e);
      alert("Impossible de mettre à jour le dossard.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link to={row?.course_id ? `/courses/${row.course_id}` : "/"} className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Retour
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold mt-1">Détail inscription</h1>
        <p className="text-neutral-600 mt-1">ID&nbsp;: <span className="font-mono">{id}</span></p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne 1 : Infos coureur */}
        <div className="lg:col-span-2 rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="px-5 py-4 border-b border-neutral-200">
            <h2 className="text-lg font-semibold">Coureur</h2>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <Field label="Nom">{row?.nom || "—"}</Field>
            <Field label="Prénom">{row?.prenom || "—"}</Field>
            <Field label="Email">
              {row?.email ? <a className="hover:underline" href={`mailto:${row.email}`}>{row.email}</a> : "—"}
            </Field>
            <Field label="Téléphone">{row?.telephone || "—"}</Field>
            <Field label="Adresse" className="sm:col-span-2">{row?.adresse || "—"}</Field>
            <Field label="Code postal">{row?.code_postal || "—"}</Field>
            <Field label="Ville">{row?.ville || "—"}</Field>
            <Field label="Pays">{row?.pays || "—"}</Field>
            <Field label="Genre">{row?.genre || "—"}</Field>
            <Field label="Date de naissance">{row?.date_naissance || "—"}</Field>
            <Field label="Nationalité">{row?.nationalite || "—"}</Field>
            <Field label="Club">{row?.club || "—"}</Field>
            <Field label="Licence / PPS">{row?.justificatif_numero || "—"}</Field>
            <Field label="Contact urgence (nom)">{row?.contact_urgence_nom || "—"}</Field>
            <Field label="Contact urgence (tél)">{row?.contact_urgence_tel || "—"}</Field>
          </div>
        </div>

        {/* Colonne 2 : Statut / gestion */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="px-5 py-4 border-b border-neutral-200">
              <h2 className="text-lg font-semibold">Statut & dossard</h2>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-neutral-600">Statut actuel</div>
                  <StatusBadge status={row?.statut} />
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={(statut || "").toLowerCase() === "en attente" ? "en_attente" : (statut || "")}
                    onChange={(e) => setStatut(e.target.value)}
                    className="rounded-lg border border-neutral-300 px-2 py-1"
                  >
                    <option value="en_attente">En attente</option>
                    <option value="paye">Payé</option>
                    <option value="annule">Annulé</option>
                  </select>
                  <button onClick={saveStatut} className="rounded-lg bg-neutral-900 text-white px-3 py-1.5 hover:bg-black">
                    Enregistrer
                  </button>
                </div>
              </div>

              <div className="h-px bg-neutral-200" />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-neutral-600">Dossard</div>
                  <div className="text-neutral-900 font-medium">{row?.dossard ?? "—"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    className="w-24 rounded-lg border border-neutral-300 px-2 py-1"
                    value={dossard ?? ""}
                    onChange={(e) => setDossard(e.target.value.replace(/[^\d]/g, ""))}
                    inputMode="numeric"
                    placeholder="—"
                  />
                  <button onClick={saveDossard} className="rounded-lg border border-neutral-300 px-3 py-1.5 hover:bg-neutral-50">
                    Mettre à jour
                  </button>
                </div>
              </div>

              <div className="h-px bg-neutral-200" />

              <Field label="Créée le">{formatDateTime(row?.created_at)}</Field>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="px-5 py-4 border-b border-neutral-200">
              <h2 className="text-lg font-semibold">Format / Groupe</h2>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <Field label="Course">
                {course ? (
                  <Link className="hover:underline" to={`/courses/${course.id}`}>
                    {course.nom || `Course #${course.id.slice(0, 8)}`} {course.lieu ? `— ${course.lieu}` : ""}
                  </Link>
                ) : "—"}
              </Field>
              <Field label="Format">
                {format ? `${format.nom}${format.date ? ` — ${format.date}` : ""}` : "—"}
              </Field>
              <Field label="Équipe">{row?.team_name || "—"}</Field>
              <Field label="Groupe">
                {group ? `${group.team_name || "Groupe"} — ${group.statut || "—"}` : "—"}
              </Field>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="px-5 py-4 border-b border-neutral-200">
              <h2 className="text-lg font-semibold">Options confirmées</h2>
            </div>
            <div className="p-5">{optionsView}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className }) {
  return (
    <div className={cls("min-w-0", className)}>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-0.5 text-neutral-900">{children}</div>
    </div>
  );
}
