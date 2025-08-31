// src/pages/ListeBenevoles.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";
import { Link, useSearchParams } from "react-router-dom";

export default function ListeBenevoles() {
  const { session } = useUser();
  const userId = session?.user?.id || null;

  const [searchParams, setSearchParams] = useSearchParams();
  const wantedCourse = searchParams.get("course"); // UUID optionnel

  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [rows, setRows] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("all");
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(null); // id en cours de sauvegarde

  useEffect(() => {
    if (!userId) return;
    let abort = false;

    async function run() {
      setLoading(true);

      // 1) Épreuves de l'organisateur
      const { data: cList, error: eCourses } = await supabase
        .from("courses")
        .select("id, nom, lieu")
        .eq("organisateur_id", userId)
        .order("created_at", { ascending: false });

      if (eCourses) {
        console.error(eCourses);
        setCourses([]);
      } else {
        setCourses(cList || []);
        // Pré-sélection via ?course=<id> si l'id appartient bien à l'orga
        if (wantedCourse && (cList || []).some((c) => c.id === wantedCourse)) {
          setSelectedCourseId(wantedCourse);
        }
      }

      // 2) Demandes bénévoles (RLS filtre déjà sur les courses de l'orga)
      const { data: bi, error: eBI } = await supabase
        .from("benevoles_inscriptions")
        .select(`
          id, course_id, benevole_id, statut, message, notes_internes, created_at,
          benevole:benevole_id ( id, nom, prenom, email, telephone ),
          course:course_id ( id, nom, lieu )
        `)
        .order("created_at", { ascending: false });

      if (eBI) {
        console.error(eBI);
        setRows([]);
      } else {
        setRows(bi || []);
      }

      if (!abort) setLoading(false);
    }

    run();
    return () => {
      abort = true;
    };
  }, [userId, wantedCourse]);

  // Synchronise l'URL quand on change le filtre (facilite le partage du lien)
  useEffect(() => {
    const sp = new URLSearchParams(searchParams);
    if (selectedCourseId === "all") {
      if (sp.has("course")) {
        sp.delete("course");
        setSearchParams(sp, { replace: true });
      }
    } else {
      if (sp.get("course") !== selectedCourseId) {
        sp.set("course", selectedCourseId);
        setSearchParams(sp, { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId]);

  // Filtrage client (course + recherche texte)
  const filtered = useMemo(() => {
    const list = rows.filter((r) => {
      if (selectedCourseId !== "all" && r.course_id !== selectedCourseId) return false;
      if (!q.trim()) return true;
      const needle = q.trim().toLowerCase();
      const hay = [
        r?.benevole?.nom,
        r?.benevole?.prenom,
        r?.benevole?.email,
        r?.benevole?.telephone,
        r?.message,
        r?.course?.nom,
        r?.course?.lieu,
        r?.notes_internes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
    return list;
  }, [rows, selectedCourseId, q]);

  async function updateStatut(rowId, statut) {
    setSaving(rowId);
    const { error } = await supabase
      .from("benevoles_inscriptions")
      .update({ statut })
      .eq("id", rowId);
    if (error) {
      alert("Impossible de mettre à jour le statut.");
      console.error(error);
    } else {
      setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, statut } : r)));
    }
    setSaving(null);
  }

  async function updateNotes(rowId, notes_internes) {
    setSaving(rowId);
    const { error } = await supabase
      .from("benevoles_inscriptions")
      .update({ notes_internes })
      .eq("id", rowId);
    if (error) {
      alert("Impossible d’enregistrer les notes.");
      console.error(error);
    } else {
      setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, notes_internes } : r)));
    }
    setSaving(null);
  }

  function exportCSV() {
    const headers = [
      "Date",
      "Épreuve",
      "Lieu",
      "Nom",
      "Prénom",
      "Email",
      "Téléphone",
      "Statut",
      "Message",
      "Notes internes",
    ];
    const lines = [headers.join(";")];

    filtered.forEach((r) => {
      const cols = [
        fmtDate(r.created_at),
        r.course?.nom || "",
        r.course?.lieu || "",
        r.benevole?.nom || "",
        r.benevole?.prenom || "",
        r.benevole?.email || "",
        r.benevole?.telephone || "",
        r.statut || "",
        clean(r.message),
        clean(r.notes_internes),
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

  if (!userId) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-xl font-semibold">Bénévoles</h1>
        <p className="mt-2 text-neutral-600">Connectez-vous pour accéder à vos demandes.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Bénévoles</h1>
        <Link
          to="/mon-espace"
          className="text-sm text-neutral-600 hover:text-neutral-900 underline underline-offset-4"
        >
          ← Retour à mon espace
        </Link>
      </div>

      {/* Filtres */}
      <div className="mt-4 flex flex-col md:flex-row gap-3 md:items-center">
        <label className="inline-flex items-center gap-2">
          <span className="text-sm text-neutral-700">Épreuve</span>
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          >
            <option value="all">Toutes mes épreuves</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom} — {c.lieu}
              </option>
            ))}
          </select>
        </label>

        <div className="md:ml-auto flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Recherche (nom, email, tel, message...)"
            className="w-full md:w-80 rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          />
          <button
            onClick={exportCSV}
            className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Tableau */}
      <div className="mt-4 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-700">
            <tr>
              <th className="text-left px-4 py-3 w-[140px]">Date</th>
              <th className="text-left px-4 py-3">Épreuve</th>
              <th className="text-left px-4 py-3">Bénévole</th>
              <th className="text-left px-4 py-3">Contact</th>
              <th className="text-left px-4 py-3">Message</th>
              <th className="text-left px-4 py-3 w-[140px]">Statut</th>
              <th className="text-left px-4 py-3 w-[220px]">Notes internes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-neutral-600" colSpan={7}>
                  Chargement…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-neutral-600" colSpan={7}>
                  Aucune demande trouvée.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="odd:bg-neutral-50/40">
                  <td className="px-4 py-3">{fmtDate(r.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.course?.nom || "—"}</div>
                    <div className="text-xs text-neutral-600">{r.course?.lieu || "—"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {r.benevole?.prenom} {r.benevole?.nom}
                    </div>
                    <div className="text-xs text-neutral-600">#{r.benevole_id?.slice(0, 8)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      {r.benevole?.email ? (
                        <a
                          href={`mailto:${r.benevole.email}`}
                          className="text-orange-700 hover:underline"
                        >
                          {r.benevole.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </div>
                    <div className="text-xs">
                      {r.benevole?.telephone ? (
                        <a href={`tel:${r.benevole.telephone}`} className="hover:underline">
                          {r.benevole.telephone}
                        </a>
                      ) : (
                        "—"
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-pre-line">
                    {r.message || <span className="text-neutral-500">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      disabled={saving === r.id}
                      value={r.statut}
                      onChange={(e) => updateStatut(r.id, e.target.value)}
                      className="rounded-xl border border-neutral-200 px-2 py-1 text-sm"
                    >
                      <option value="nouveau">nouveau</option>
                      <option value="valide">valide</option>
                      <option value="refuse">refuse</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <textarea
                      defaultValue={r.notes_internes || ""}
                      onBlur={(e) => {
                        const val = e.target.value;
                        if (val !== (r.notes_internes || "")) {
                          updateNotes(r.id, val);
                        }
                      }}
                      placeholder="Ajouter une note interne…"
                      rows={2}
                      className="w-full rounded-xl border border-neutral-200 px-2 py-1 text-sm"
                    />
                    {saving === r.id && (
                      <div className="mt-1 text-[11px] text-neutral-500">Enregistrement…</div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs text-neutral-500">
        Conseil : le statut <strong>valide</strong> peut déclencher un email manuel depuis votre
        messagerie (copiez l’adresse) en attendant la V1.5 (emails .ics automatiques).
      </div>
    </div>
  );
}

/* ===== Helpers ===== */

function fmtDate(d) {
  try {
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

function clean(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function csvCell(s) {
  const v = (s ?? "").toString();
  if (/[;"\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
