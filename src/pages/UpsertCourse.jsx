// src/pages/UpsertCourse.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import {
  Loader2,
  Image as ImageIcon,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

/** ===== Helpers ===== */

const initialCourse = {
  nom: "",
  lieu: "",
  departement: "",
  code_postal: "",
  presentation: "",
  image_url: "",
  lat: null,
  lng: null,
  en_ligne: false,
};

const makeInitialFormat = () => ({
  id: crypto.randomUUID(), // clé locale temporaire
  nom: "",
  date: "",
  heure_depart: "",
  image_url: "",
  presentation_parcours: "",
  gpx_url: "",
  type_epreuve: "", // texte libre si tu l’utilises déjà
  distance_km: "",
  denivele_dplus: "",
  denivele_dmoins: "",
  adresse_depart: "",
  adresse_arrivee: "",
  prix: "",
  // Nouveaux champs
  type_format: "individuel", // 'individuel' | 'groupe' | 'relais'
  sport_global: "",
  team_size: "",
  nb_coureurs_min: "",
  nb_coureurs_max: "",
  prix_equipe: "",
  inscription_ouverture: "",
  inscription_fermeture: "",
  fuseau_horaire: "Europe/Paris",
  close_on_full: true,
  waitlist_enabled: false,
  quota_attente: 0,
  // Étapes (si relais)
  etapes: [],
});

const defaultSports = [
  "Course à pied",
  "Trail",
  "VTT",
  "Natation",
  "Triathlon",
  "Multisport",
  "Autre",
];

/** Éditeur d’étapes pour formats relais */
function EtapesRelaisEditor({ etapes, setEtapes }) {
  const add = () =>
    setEtapes([
      ...etapes,
      {
        _local_id: crypto.randomUUID(),
        ordre: etapes.length + 1,
        titre: `Relais ${etapes.length + 1}`,
        sport: "",
        distance_km: "",
        denivele_dplus: "",
        denivele_dmoins: "",
        gpx_url: "",
        description: "",
        cut_off_minutes: "",
      },
    ]);

  const update = (_local_id, patch) =>
    setEtapes(etapes.map((e) => (e._local_id === _local_id ? { ...e, ...patch } : e)));

  const remove = (_local_id) => {
    const next = etapes.filter((e) => e._local_id !== _local_id);
    setEtapes(next.map((e, i) => ({ ...e, ordre: i + 1, titre: `Relais ${i + 1}` })));
  };

  const move = (index, dir) => {
    const next = [...etapes];
    const swap = dir === "up" ? index - 1 : index + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    setEtapes(next.map((e, i) => ({ ...e, ordre: i + 1, titre: `Relais ${i + 1}` })));
  };

  return (
    <div className="space-y-3">
      {etapes.map((e, i) => (
        <div key={e._local_id} className="rounded-2xl border p-4 grid gap-3 md:grid-cols-6">
          <input
            className="md:col-span-2 input"
            value={e.titre}
            onChange={(ev) => update(e._local_id, { titre: ev.target.value })}
            placeholder="Relais 1"
          />
          <select
            className="md:col-span-1 select"
            value={e.sport}
            onChange={(ev) => update(e._local_id, { sport: ev.target.value })}
          >
            <option value="">Sport…</option>
            <option>Trail</option>
            <option>Course à pied</option>
            <option>VTT</option>
            <option>Natation</option>
            <option>Canoë</option>
            <option>Autre</option>
          </select>
          <input
            className="md:col-span-1 input"
            type="number"
            step="0.1"
            placeholder="Distance (km)"
            value={e.distance_km}
            onChange={(ev) => update(e._local_id, { distance_km: ev.target.value })}
          />
          <input
            className="md:col-span-1 input"
            type="number"
            placeholder="D+"
            value={e.denivele_dplus}
            onChange={(ev) => update(e._local_id, { denivele_dplus: ev.target.value })}
          />
          <input
            className="md:col-span-1 input"
            type="number"
            placeholder="D-"
            value={e.denivele_dmoins}
            onChange={(ev) => update(e._local_id, { denivele_dmoins: ev.target.value })}
          />
          <input
            className="md:col-span-3 input"
            placeholder="URL GPX (optionnel)"
            value={e.gpx_url}
            onChange={(ev) => update(e._local_id, { gpx_url: ev.target.value })}
          />
          <input
            className="md:col-span-1 input"
            type="number"
            placeholder="Cut-off (min)"
            value={e.cut_off_minutes}
            onChange={(ev) => update(e._local_id, { cut_off_minutes: ev.target.value })}
          />
          <textarea
            className="md:col-span-6 textarea"
            placeholder="Description (optionnel)"
            value={e.description}
            onChange={(ev) => update(e._local_id, { description: ev.target.value })}
          />
          <div className="flex items-center gap-2">
            <button type="button" className="btn-subtle" onClick={() => move(i, "up")}>
              <ChevronUp size={16} />
            </button>
            <button type="button" className="btn-subtle" onClick={() => move(i, "down")}>
              <ChevronDown size={16} />
            </button>
            <button type="button" className="btn-danger" onClick={() => remove(e._local_id)}>
              <Trash2 size={16} /> Supprimer
            </button>
          </div>
        </div>
      ))}
      <button type="button" className="btn" onClick={add}>
        <Plus size={16} /> Ajouter une étape
      </button>
    </div>
  );
}

/** ===== Page principale ===== */

export default function UpsertCourse() {
  const { id } = useParams(); // si présent => mode édition
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [course, setCourse] = useState(initialCourse);
  const [formats, setFormats] = useState([makeInitialFormat()]);
  const [newImageFile, setNewImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  // Chargement en mode édition
  useEffect(() => {
    if (!isEdit) {
      setLoading(false);
      return;
    }
    let abort = false;

    (async () => {
      setLoading(true);

      // 1) Course
      const { data: courseData, error: e1 } = await supabase
        .from("courses")
        .select("*")
        .eq("id", id)
        .single();
      if (e1) {
        console.error(e1);
        if (!abort) setLoading(false);
        return;
      }

      // 2) Formats
      const { data: formatsData, error: e2 } = await supabase
        .from("formats")
        .select("*, id")
        .eq("course_id", id)
        .order("created_at", { ascending: true });

      // 3) Étapes des formats (si table dispo)
      let etapesByFormat = {};
      if (!e2 && formatsData && formatsData.length > 0) {
        const ids = formatsData.map((f) => f.id);
        const { data: etapes, error: e3 } = await supabase
          .from("formats_etapes")
          .select("*")
          .in("format_id", ids)
          .order("ordre", { ascending: true });
        if (!e3 && etapes) {
          etapesByFormat = etapes.reduce((acc, cur) => {
            acc[cur.format_id] = acc[cur.format_id] || [];
            acc[cur.format_id].push({ ...cur, _local_id: crypto.randomUUID() });
            return acc;
          }, {});
        }
      }

      if (!abort) {
        setCourse({
          nom: courseData.nom || "",
          lieu: courseData.lieu || "",
          departement: courseData.departement || "",
          code_postal: courseData.code_postal || "",
          presentation: courseData.presentation || "",
          image_url: courseData.image_url || "",
          lat: courseData.lat ?? null,
          lng: courseData.lng ?? null,
          en_ligne: courseData.en_ligne ?? false,
        });
        setImagePreview(courseData.image_url || "");

        setFormats(
          (formatsData || []).map((f) => ({
            ...makeInitialFormat(),
            ...f,
            // Normalisation pour les champs possiblement null
            inscription_ouverture: f.inscription_ouverture
              ? new Date(f.inscription_ouverture).toISOString().slice(0, 16)
              : "",
            inscription_fermeture: f.inscription_fermeture
              ? new Date(f.inscription_fermeture).toISOString().slice(0, 16)
              : "",
            fuseau_horaire: f.fuseau_horaire || "Europe/Paris",
            close_on_full: !!f.close_on_full,
            waitlist_enabled: !!f.waitlist_enabled,
            quota_attente: f.quota_attente ?? 0,
            etapes: etapesByFormat[f.id] || [],
          }))
        );

        setLoading(false);
      }
    })();

    return () => {
      abort = true;
    };
  }, [id, isEdit]);

  /** Gestion formats */
  const addFormat = () => setFormats([...formats, makeInitialFormat()]);
  const removeFormat = (localId) => setFormats(formats.filter((f) => f.id !== localId));
  const updateFormat = (localId, patch) =>
    setFormats(formats.map((f) => (f.id === localId ? { ...f, ...patch } : f)));

  /** Image course */
  const handleCourseImageChange = (file) => {
    setNewImageFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target.result);
      reader.readAsDataURL(file);
    } else {
      setImagePreview("");
    }
  };

  const uploadImageToBucket = async (file) => {
    if (!file) return null;
    const ext = file.name.split(".").pop();
    const path = `course_${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage
      .from("courses")
      .upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: pub } = supabase.storage.from("courses").getPublicUrl(path);
    return pub?.publicUrl || null;
  };

  /** Validation minimale */
  const validate = () => {
    if (!course.nom?.trim() || !course.lieu?.trim()) {
      alert("Merci de renseigner au minimum le nom et le lieu de la course.");
      return false;
    }
    for (const f of formats) {
      if (!f.nom?.trim()) {
        alert("Chaque format doit avoir un nom.");
        return false;
      }
      if (f.type_format === "relais") {
        if (!f.etapes || f.etapes.length < 2) {
          alert(`Le format "${f.nom}" est en mode Relais : ajoute au moins 2 étapes.`);
          return false;
        }
      }
      if (f.inscription_ouverture && f.inscription_fermeture) {
        if (new Date(f.inscription_ouverture) >= new Date(f.inscription_fermeture)) {
          alert(`Fenêtre d'inscriptions invalide pour le format "${f.nom}".`);
          return false;
        }
      }
    }
    return true;
  };

  /** Submit */
  const onSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      // 1) Upload image course si nécessaire
      let image_url = course.image_url || null;
      if (newImageFile) {
        image_url = await uploadImageToBucket(newImageFile);
      }

      // 2) Upsert course
      let courseId = id;
      if (!isEdit) {
        const { data: cIns, error: cErr } = await supabase
          .from("courses")
          .insert({ ...course, image_url })
          .select("id")
          .single();
        if (cErr) throw cErr;
        courseId = cIns.id;
      } else {
        const { error: cUpErr } = await supabase
          .from("courses")
          .update({ ...course, image_url, updated_at: new Date().toISOString() })
          .eq("id", courseId);
        if (cUpErr) throw cUpErr;
      }

      // 3) Gérer formats : insert/update + étapes
      const keptFormatIds = [];
      for (const f of formats) {
        const payload = {
          course_id: courseId,
          nom: f.nom,
          image_url: f.image_url || null,
          date: f.date || null,
          heure_depart: f.heure_depart || null,
          presentation_parcours: f.presentation_parcours || null,
          gpx_url: f.gpx_url || null,
          type_epreuve: f.type_epreuve || null,
          distance_km: f.distance_km !== "" ? Number(f.distance_km) : null,
          denivele_dplus: f.denivele_dplus !== "" ? Number(f.denivele_dplus) : null,
          denivele_dmoins: f.denivele_dmoins !== "" ? Number(f.denivele_dmoins) : null,
          adresse_depart: f.adresse_depart || null,
          adresse_arrivee: f.adresse_arrivee || null,
          prix: f.prix !== "" ? Number(f.prix) : null,
          nb_max_coureurs: f.nb_max_coureurs !== "" ? Number(f.nb_max_coureurs) : null,
          age_minimum: f.age_minimum !== "" ? Number(f.age_minimum) : null,
          hebergements: f.hebergements || null,
          // Nouveaux champs
          type_format: f.type_format || "individuel",
          sport_global: f.sport_global || null,
          team_size:
            f.type_format === "relais"
              ? f.team_size
                ? Number(f.team_size)
                : f.etapes?.length || null
              : f.team_size
              ? Number(f.team_size)
              : null,
          nb_coureurs_min: f.nb_coureurs_min !== "" ? Number(f.nb_coureurs_min) : null,
          nb_coureurs_max: f.nb_coureurs_max !== "" ? Number(f.nb_coureurs_max) : null,
          prix_equipe: f.prix_equipe !== "" ? Number(f.prix_equipe) : null,
          inscription_ouverture: f.inscription_ouverture
            ? new Date(f.inscription_ouverture).toISOString()
            : null,
          inscription_fermeture: f.inscription_fermeture
            ? new Date(f.inscription_fermeture).toISOString()
            : null,
          fuseau_horaire: f.fuseau_horaire || "Europe/Paris",
          close_on_full: !!f.close_on_full,
          waitlist_enabled: !!f.waitlist_enabled,
          quota_attente: f.quota_attente ?? 0,
        };

        let formatId = null;

        // Heuristique : si id ressemble à un UUID et existe en base => update
        const looksLikeUUID = typeof f.id === "string" && f.id.includes("-");
        if (isEdit && looksLikeUUID) {
          const { data: fCheck, error: fCheckErr } = await supabase
            .from("formats")
            .select("id")
            .eq("id", f.id)
            .maybeSingle();

          if (!fCheckErr && fCheck?.id) {
            // UPDATE
            const { error: fUpErr } = await supabase
              .from("formats")
              .update(payload)
              .eq("id", f.id);
            if (fUpErr) throw fUpErr;
            formatId = f.id;

            // Étapes
            if (payload.type_format === "relais") {
              await supabase.from("formats_etapes").delete().eq("format_id", formatId);
              if (Array.isArray(f.etapes)) {
                for (const e of f.etapes) {
                  const { error: eErr } = await supabase.from("formats_etapes").insert({
                    format_id: formatId,
                    ordre: e.ordre || 1,
                    titre: e.titre || null,
                    sport: e.sport || null,
                    distance_km:
                      e.distance_km !== "" && e.distance_km != null
                        ? Number(e.distance_km)
                        : null,
                    denivele_dplus:
                      e.denivele_dplus !== "" && e.denivele_dplus != null
                        ? Number(e.denivele_dplus)
                        : null,
                    denivele_dmoins:
                      e.denivele_dmoins !== "" && e.denivele_dmoins != null
                        ? Number(e.denivele_dmoins)
                        : null,
                    gpx_url: e.gpx_url || null,
                    description: e.description || null,
                    cut_off_minutes:
                      e.cut_off_minutes !== "" && e.cut_off_minutes != null
                        ? Number(e.cut_off_minutes)
                        : null,
                  });
                  if (eErr) throw eErr;
                }
              }
            } else {
              // Si plus relais, nettoyer les étapes
              await supabase.from("formats_etapes").delete().eq("format_id", formatId);
            }
          } else {
            // INSERT
            const { data: fIns, error: fInsErr } = await supabase
              .from("formats")
              .insert(payload)
              .select("id")
              .single();
            if (fInsErr) throw fInsErr;
            formatId = fIns.id;

            if (payload.type_format === "relais" && Array.isArray(f.etapes)) {
              for (const e of f.etapes) {
                const { error: eErr } = await supabase.from("formats_etapes").insert({
                  format_id: formatId,
                  ordre: e.ordre || 1,
                  titre: e.titre || null,
                  sport: e.sport || null,
                  distance_km:
                    e.distance_km !== "" && e.distance_km != null
                      ? Number(e.distance_km)
                      : null,
                  denivele_dplus:
                    e.denivele_dplus !== "" && e.denivele_dplus != null
                      ? Number(e.denivele_dplus)
                      : null,
                  denivele_dmoins:
                    e.denivele_dmoins !== "" && e.denivele_dmoins != null
                      ? Number(e.denivele_dmoins)
                      : null,
                  gpx_url: e.gpx_url || null,
                  description: e.description || null,
                  cut_off_minutes:
                    e.cut_off_minutes !== "" && e.cut_off_minutes != null
                      ? Number(e.cut_off_minutes)
                      : null,
                });
                if (eErr) throw eErr;
              }
            }
          }
        } else {
          // CREATE (nouveau format)
          const { data: fIns, error: fInsErr } = await supabase
            .from("formats")
            .insert(payload)
            .select("id")
            .single();
          if (fInsErr) throw fInsErr;
          formatId = fIns.id;

          if (payload.type_format === "relais" && Array.isArray(f.etapes)) {
            for (const e of f.etapes) {
              const { error: eErr } = await supabase.from("formats_etapes").insert({
                format_id: formatId,
                ordre: e.ordre || 1,
                titre: e.titre || null,
                sport: e.sport || null,
                distance_km:
                  e.distance_km !== "" && e.distance_km != null
                    ? Number(e.distance_km)
                    : null,
                denivele_dplus:
                  e.denivele_dplus !== "" && e.denivele_dplus != null
                    ? Number(e.denivele_dplus)
                    : null,
                denivele_dmoins:
                  e.denivele_dmoins !== "" && e.denivele_dmoins != null
                    ? Number(e.denivele_dmoins)
                    : null,
                gpx_url: e.gpx_url || null,
                description: e.description || null,
                cut_off_minutes:
                  e.cut_off_minutes !== "" && e.cut_off_minutes != null
                    ? Number(e.cut_off_minutes)
                    : null,
              });
              if (eErr) throw eErr;
            }
          }
        }

        if (formatId) keptFormatIds.push(formatId);
      }

      // 4) En édition : supprimer les formats supprimés côté front
      if (isEdit) {
        const { data: existingIds } = await supabase
          .from("formats")
          .select("id")
          .eq("course_id", courseId);
        const toDelete = (existingIds || [])
          .map((r) => r.id)
          .filter((fid) => !keptFormatIds.includes(fid));
        if (toDelete.length > 0) {
          // Supprime aussi les étapes via ON DELETE CASCADE
          await supabase.from("formats").delete().in("id", toDelete);
        }
      }

      // 5) Succès → rediriger vers la page publique
      navigate(`/courses/${courseId}`);
    } catch (err) {
      console.error(err);
      alert("Échec de l’enregistrement. Regarde la console pour le détail.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2">
        <Loader2 className="animate-spin" /> Chargement…
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      <button className="btn-subtle mb-4" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Retour
      </button>
      <h1 className="text-2xl font-bold mb-4">
        {isEdit ? "Modifier l’épreuve" : "Créer une nouvelle épreuve"}
      </h1>

      <form onSubmit={onSubmit} className="space-y-8">
        {/* Bloc course */}
        <section className="rounded-2xl border p-4 space-y-4">
          <h2 className="text-xl font-semibold">Informations course</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Nom *</label>
              <input
                className="input"
                value={course.nom}
                onChange={(e) => setCourse({ ...course, nom: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Lieu *</label>
              <input
                className="input"
                value={course.lieu}
                onChange={(e) => setCourse({ ...course, lieu: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Département</label>
              <input
                className="input"
                value={course.departement || ""}
                onChange={(e) => setCourse({ ...course, departement: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Code postal</label>
              <input
                className="input"
                value={course.code_postal || ""}
                onChange={(e) => setCourse({ ...course, code_postal: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Présentation</label>
              <textarea
                className="textarea"
                value={course.presentation || ""}
                onChange={(e) => setCourse({ ...course, presentation: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Image de l’épreuve</label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleCourseImageChange(e.target.files?.[0])}
                />
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="preview"
                    className="h-20 rounded-lg object-cover border"
                  />
                ) : (
                  <div className="h-20 w-20 border rounded-lg flex items-center justify-center text-gray-400">
                    <ImageIcon />
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Bloc formats */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Formats</h2>
            <button type="button" className="btn" onClick={addFormat}>
              <Plus size={16} /> Ajouter un format
            </button>
          </div>

          {formats.map((f, idx) => (
            <div key={f.id} className="rounded-2xl border p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Format {idx + 1}</h3>
                <button type="button" className="btn-danger" onClick={() => removeFormat(f.id)}>
                  <Trash2 size={16} /> Supprimer ce format
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Nom du format *</label>
                  <input
                    className="input"
                    value={f.nom}
                    onChange={(e) => updateFormat(f.id, { nom: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Type d’épreuve</label>
                  <select
                    className="select"
                    value={f.type_format}
                    onChange={(e) => updateFormat(f.id, { type_format: e.target.value })}
                  >
                    <option value="individuel">Individuel</option>
                    <option value="groupe">Groupe (paiement groupé)</option>
                    <option value="relais">Relais / Ekiden / Multisport</option>
                  </select>
                </div>

                <div>
                  <label className="label">Sport global</label>
                  <select
                    className="select"
                    value={f.sport_global || ""}
                    onChange={(e) => updateFormat(f.id, { sport_global: e.target.value })}
                  >
                    <option value="">—</option>
                    {defaultSports.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dates */}
                <div>
                  <label className="label">Date</label>
                  <input
                    type="date"
                    className="input"
                    value={f.date || ""}
                    onChange={(e) => updateFormat(f.id, { date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Heure de départ</label>
                  <input
                    type="time"
                    className="input"
                    value={f.heure_depart || ""}
                    onChange={(e) => updateFormat(f.id, { heure_depart: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Distance (km)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="input"
                    value={f.distance_km}
                    onChange={(e) => updateFormat(f.id, { distance_km: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">D+</label>
                    <input
                      type="number"
                      className="input"
                      value={f.denivele_dplus}
                      onChange={(e) =>
                        updateFormat(f.id, { denivele_dplus: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="label">D-</label>
                    <input
                      type="number"
                      className="input"
                      value={f.denivele_dmoins}
                      onChange={(e) =>
                        updateFormat(f.id, { denivele_dmoins: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Prix (€/pers.)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={f.prix}
                    onChange={(e) => updateFormat(f.id, { prix: e.target.value })}
                  />
                </div>

                {/* Prix équipe (optionnel) */}
                {f.type_format !== "individuel" && (
                  <div>
                    <label className="label">Prix équipe (optionnel)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      value={f.prix_equipe}
                      onChange={(e) => updateFormat(f.id, { prix_equipe: e.target.value })}
                    />
                  </div>
                )}

                <div>
                  <label className="label">Participants max</label>
                  <input
                    type="number"
                    className="input"
                    value={f.nb_max_coureurs || ""}
                    onChange={(e) =>
                      updateFormat(f.id, { nb_max_coureurs: e.target.value })
                    }
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="label">Présentation du parcours</label>
                  <textarea
                    className="textarea"
                    value={f.presentation_parcours || ""}
                    onChange={(e) =>
                      updateFormat(f.id, { presentation_parcours: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="label">URL GPX</label>
                  <input
                    className="input"
                    value={f.gpx_url || ""}
                    onChange={(e) => updateFormat(f.id, { gpx_url: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Type épreuve (texte libre)</label>
                  <input
                    className="input"
                    value={f.type_epreuve || ""}
                    onChange={(e) => updateFormat(f.id, { type_epreuve: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Adresse départ</label>
                  <input
                    className="input"
                    value={f.adresse_depart || ""}
                    onChange={(e) => updateFormat(f.id, { adresse_depart: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Adresse arrivée</label>
                  <input
                    className="input"
                    value={f.adresse_arrivee || ""}
                    onChange={(e) => updateFormat(f.id, { adresse_arrivee: e.target.value })}
                  />
                </div>

                {/* Fenêtre d’inscriptions */}
                <div className="md:col-span-2 grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="label">Ouverture des inscriptions</label>
                    <input
                      type="datetime-local"
                      className="input"
                      value={f.inscription_ouverture || ""}
                      onChange={(e) =>
                        updateFormat(f.id, { inscription_ouverture: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Fermeture des inscriptions</label>
                    <input
                      type="datetime-local"
                      className="input"
                      value={f.inscription_fermeture || ""}
                      onChange={(e) =>
                        updateFormat(f.id, { inscription_fermeture: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Fuseau horaire</label>
                    <input
                      className="input"
                      placeholder="Europe/Paris"
                      value={f.fuseau_horaire || "Europe/Paris"}
                      onChange={(e) =>
                        updateFormat(f.id, { fuseau_horaire: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="md:col-span-2 grid gap-4 md:grid-cols-3">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!f.close_on_full}
                      onChange={(e) =>
                        updateFormat(f.id, { close_on_full: e.target.checked })
                      }
                    />
                    Fermer automatiquement quand plein
                  </label>

                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!f.waitlist_enabled}
                      onChange={(e) =>
                        updateFormat(f.id, { waitlist_enabled: e.target.checked })
                      }
                    />
                    Activer liste d’attente
                  </label>

                  {f.waitlist_enabled && (
                    <div>
                      <label className="label">Taille max liste d’attente</label>
                      <input
                        type="number"
                        className="input"
                        value={f.quota_attente ?? 0}
                        onChange={(e) =>
                          updateFormat(f.id, { quota_attente: Number(e.target.value) })
                        }
                      />
                    </div>
                  )}
                </div>

                {/* Champs groupe/relais */}
                {f.type_format !== "individuel" && (
                  <>
                    <div>
                      <label className="label">Nombre de coureurs (équipe)</label>
                      <input
                        type="number"
                        className="input"
                        value={f.team_size || ""}
                        onChange={(e) => updateFormat(f.id, { team_size: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">Taille min (optionnel)</label>
                        <input
                          type="number"
                          className="input"
                          value={f.nb_coureurs_min || ""}
                          onChange={(e) =>
                            updateFormat(f.id, { nb_coureurs_min: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="label">Taille max (optionnel)</label>
                        <input
                          type="number"
                          className="input"
                          value={f.nb_coureurs_max || ""}
                          onChange={(e) =>
                            updateFormat(f.id, { nb_coureurs_max: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Éditeur d’étapes si relais */}
              {f.type_format === "relais" && (
                <div className="pt-2 border-t">
                  <h4 className="font-medium mb-3">Étapes du relais</h4>
                  <EtapesRelaisEditor
                    etapes={f.etapes}
                    setEtapes={(next) => updateFormat(f.id, { etapes: next })}
                  />
                </div>
              )}
            </div>
          ))}
        </section>

        <div className="flex justify-end gap-3">
          <button type="button" className="btn-subtle" onClick={() => navigate(-1)}>
            Annuler
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="animate-spin" size={16} /> Enregistrement…
              </>
            ) : (
              <>
                <Save size={16} /> Enregistrer
              </>
            )}
          </button>
        </div>
      </form>

      {/* Styles utilitaires si tu n'as pas Tailwind partout */}
      <style>{`
        .label{display:block;font-weight:600;margin-bottom:6px}
        .input,.select,.textarea{width:100%;border:1px solid #e5e7eb;border-radius:12px;padding:10px}
        .textarea{min-height:100px}
        .btn{display:inline-flex;align-items:center;gap:8px;border:1px solid #e5e7eb;border-radius:12px;padding:8px 12px}
        .btn-primary{background:black;color:white;border-color:black}
        .btn-danger{background:#fee2e2;color:#b91c1c;border-color:#fecaca}
        .btn-subtle{background:#f3f4f6}
      `}</style>
    </div>
  );
}
