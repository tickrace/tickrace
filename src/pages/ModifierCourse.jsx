// src/pages/ModifierCourse.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../supabase";
import { v4 as uuidv4 } from "uuid";

const emptyFormat = () => ({
  id: null, // null => nouveau format
  nom: "",
  prix: 0,
  date: "",
  distance_km: "",
  denivele_dplus: "",
  nb_max_coureurs: "",
  stock_repas: 0,          // si tu n'utilises pas, laisse 0
  prix_repas: 0,           // si tu n'utilises pas, laisse 0
  // champs optionnels si présents dans ta table:
  // nombre_repas: 0,
  // prix_total_repas: 0,
  // prix_total_inscription: 0,
});

export default function ModifierCourse() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);
  const [newImageFile, setNewImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  // garde mémoire des formats initiaux pour détecter ceux supprimés
  const initialFormatIdsRef = useRef(new Set());

  const validCourse = useMemo(() => !!course && !!course.id, [course]);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      setLoading(true);
      setError(null);
      try {
        if (!id) {
          throw new Error("Identifiant d’épreuve manquant dans l’URL.");
        }

        // 1) Course
        const { data: courseData, error: courseErr } = await supabase
          .from("courses")
          .select("*")
          .eq("id", id)
          .single();

        if (courseErr) throw courseErr;
        if (!courseData) throw new Error("Épreuve introuvable.");

        // 2) Formats
        const { data: formatsData, error: formatsErr } = await supabase
          .from("formats")
          .select("*")
          .eq("course_id", id)
          .order("date", { ascending: true });

        if (formatsErr) throw formatsErr;

        if (!cancelled) {
          setCourse(courseData);
          const safeFormats =
            (formatsData || []).map((f) => ({
              ...emptyFormat(),
              ...f,
            })) || [];
          setFormats(safeFormats);
          initialFormatIdsRef.current = new Set(
            safeFormats.filter((f) => !!f.id).map((f) => f.id)
          );
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setError(e.message || "Erreur de chargement.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // ------------------ handlers ------------------

  const handleCourseChange = (field, value) => {
    setCourse((prev) => ({ ...prev, [field]: value }));
  };

  const handleFormatChange = (idx, field, value) => {
    setFormats((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const addFormat = () => {
    setFormats((prev) => [...prev, { ...emptyFormat(), course_id: id }]);
  };

  const removeFormat = (idx) => {
    setFormats((prev) => prev.filter((_, i) => i !== idx));
  };

  const onSelectImage = (file) => {
    setNewImageFile(file || null);
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    } else {
      setImagePreview(null);
    }
  };

  // Upload image vers bucket 'courses' et retourne l'URL publique si ton bucket est public
  const uploadImageIfNeeded = async () => {
    if (!newImageFile) return course?.image_url || null;
    const fileExt = newImageFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${id}/${uuidv4()}.${fileExt}`;

    const { error: upErr } = await supabase.storage
      .from("courses")
      .upload(path, newImageFile, {
        upsert: false,
        contentType: newImageFile.type || "image/*",
      });

    if (upErr) throw upErr;

    const { data } = supabase.storage.from("courses").getPublicUrl(path);
    const publicUrl = data?.publicUrl || null;
    return publicUrl;
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (!validCourse) throw new Error("Épreuve invalide.");

      // 1) Image
      const image_url = await uploadImageIfNeeded();

      // 2) Update course
      const coursePayload = {
        ...course,
        image_url: image_url ?? course?.image_url ?? null,
        updated_at: new Date().toISOString(),
      };

      const { error: updErr } = await supabase
        .from("courses")
        .update(coursePayload)
        .eq("id", course.id);

      if (updErr) throw updErr;

      // 3) Upsert formats restants
      const withCourseId = formats.map((f) => ({
        ...f,
        course_id: id,
        prix: f.prix === "" ? 0 : Number(f.prix),
        distance_km:
          f.distance_km === "" || f.distance_km === null
            ? null
            : Number(f.distance_km),
        denivele_dplus:
          f.denivele_dplus === "" || f.denivele_dplus === null
            ? null
            : Number(f.denivele_dplus),
        nb_max_coureurs:
          f.nb_max_coureurs === "" || f.nb_max_coureurs === null
            ? null
            : Number(f.nb_max_coureurs),
        stock_repas:
          f.stock_repas === "" || f.stock_repas === null
            ? 0
            : Number(f.stock_repas),
        prix_repas:
          f.prix_repas === "" || f.prix_repas === null
            ? 0
            : Number(f.prix_repas),
      }));

      if (withCourseId.length > 0) {
        const { error: upsertErr } = await supabase.from("formats").upsert(
          withCourseId.map((f) => {
            // Supprime les clefs non-colonnes si besoin
            const { __typename, ...rest } = f;
            return rest;
          }),
          { onConflict: "id" }
        );
        if (upsertErr) throw upsertErr;
      }

      // 4) Delete formats supprimés
      const currentIds = new Set(withCourseId.filter((f) => !!f.id).map((f) => f.id));
      const toDelete = [...initialFormatIdsRef.current].filter(
        (fid) => !currentIds.has(fid)
      );
      if (toDelete.length > 0) {
        const { error: delErr } = await supabase
          .from("formats")
          .delete()
          .in("id", toDelete);
        if (delErr) throw delErr;
      }

      // succès => on peut rafraîchir l’état "initial"
      initialFormatIdsRef.current = new Set(
        withCourseId.filter((f) => !!f.id).map((f) => f.id)
      );

      alert("Épreuve et formats sauvegardés avec succès.");
      navigate("/mon-espace-organisateur"); // ajuste la route si besoin
    } catch (e) {
      console.error(e);
      setError(e.message || "Erreur lors de l’enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  // ------------------ Render ------------------

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Chargement…</h2>
        <p>Récupération de l’épreuve #{id}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, maxWidth: 720 }}>
        <h2>Impossible d’afficher la page</h2>
        <p style={{ color: "crimson" }}>{error}</p>
        <p>
          <Link to="/mon-espace-organisateur">Retour à mon espace organisateur</Link>
        </p>
      </div>
    );
  }

  if (!course) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Épreuve introuvable</h2>
        <p>
          L’identifiant “{id}” ne correspond à aucune épreuve.
          <br />
          <Link to="/mon-espace-organisateur">Retour</Link>
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <h1>Modifier l’épreuve</h1>
        <code style={{ opacity: 0.6 }}>#{course.id}</code>
      </div>

      <section style={{ marginTop: 16 }}>
        <h2>Informations générales</h2>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span>Nom</span>
            <input
              type="text"
              value={course.nom || ""}
              onChange={(e) => handleCourseChange("nom", e.target.value)}
              placeholder="Nom de l’épreuve"
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span>Lieu</span>
            <input
              type="text"
              value={course.lieu || ""}
              onChange={(e) => handleCourseChange("lieu", e.target.value)}
              placeholder="Ville / Site"
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span>Date (si unique / principale)</span>
            <input
              type="date"
              value={course.date || ""}
              onChange={(e) => handleCourseChange("date", e.target.value)}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span>Tarifs (info libre)</span>
            <input
              type="text"
              value={course.tarifs || ""}
              onChange={(e) => handleCourseChange("tarifs", e.target.value)}
              placeholder="Ex : de 20€ à 50€"
            />
          </label>
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
          <span>Description</span>
          <textarea
            rows={5}
            value={course.description || ""}
            onChange={(e) => handleCourseChange("description", e.target.value)}
            placeholder="Description courte de l’épreuve"
          />
        </label>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr", marginTop: 12 }}>
          <div>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span>Image de couverture</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => onSelectImage(e.target.files?.[0] || null)}
              />
            </label>
            <p style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
              Bucket Supabase : <code>courses</code>
            </p>
          </div>

          <div>
            <span>Aperçu</span>
            <div
              style={{
                marginTop: 8,
                width: "100%",
                aspectRatio: "16/9",
                border: "1px solid #ddd",
                borderRadius: 8,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#fafafa",
              }}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : course.image_url ? (
                <img src={course.image_url} alt="course" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ opacity: 0.6 }}>Pas d’image</span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2>Formats</h2>
          <button type="button" onClick={addFormat}>+ Ajouter un format</button>
        </div>

        {formats.length === 0 && (
          <p style={{ opacity: 0.7, marginTop: 8 }}>Aucun format pour le moment.</p>
        )}

        <div style={{ display: "grid", gap: 16, marginTop: 12 }}>
          {formats.map((f, idx) => (
            <div key={f.id || `new-${idx}`} style={{ padding: 12, border: "1px solid #e5e5e5", borderRadius: 8 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                <strong>Format {idx + 1}</strong>
                <div style={{ display: "flex", gap: 8 }}>
                  {f.id && <code style={{ opacity: 0.6 }}>id: {f.id}</code>}
                  <button type="button" onClick={() => removeFormat(idx)} title="Supprimer ce format">
                    Supprimer
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr 1fr" , marginTop: 12}}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span>Nom du format</span>
                  <input
                    type="text"
                    value={f.nom || ""}
                    onChange={(e) => handleFormatChange(idx, "nom", e.target.value)}
                    placeholder="Ex : 32 km / 1300 D+"
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span>Prix (€)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={f.prix ?? 0}
                    onChange={(e) => handleFormatChange(idx, "prix", e.target.value)}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span>Date</span>
                  <input
                    type="date"
                    value={f.date || ""}
                    onChange={(e) => handleFormatChange(idx, "date", e.target.value)}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span>Distance (km)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={f.distance_km ?? ""}
                    onChange={(e) => handleFormatChange(idx, "distance_km", e.target.value)}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span>D+ (m)</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={f.denivele_dplus ?? ""}
                    onChange={(e) => handleFormatChange(idx, "denivele_dplus", e.target.value)}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span>Places max</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={f.nb_max_coureurs ?? ""}
                    onChange={(e) => handleFormatChange(idx, "nb_max_coureurs", e.target.value)}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span>Stock repas (optionnel)</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={f.stock_repas ?? 0}
                    onChange={(e) => handleFormatChange(idx, "stock_repas", e.target.value)}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span>Prix repas (€)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={f.prix_repas ?? 0}
                    onChange={(e) => handleFormatChange(idx, "prix_repas", e.target.value)}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        <button type="button" onClick={handleSave} disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer les modifications"}
        </button>
        <Link to="/mon-espace-organisateur">
          <button type="button" disabled={saving}>Annuler</button>
        </Link>
      </div>
    </div>
  );
}
