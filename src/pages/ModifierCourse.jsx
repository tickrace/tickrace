// src/pages/ModifierCourse.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { v4 as uuidv4 } from "uuid";

export default function ModifierCourse() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);

  // Fichier image de la course (local uniquement)
  const [newImageFile, setNewImageFile] = useState(null);

  // -------- helpers
  const numOrNull = (v) =>
    v === "" || v === undefined || v === null ? null : Number(v);
  const intOrNull = (v) =>
    v === "" || v === undefined || v === null ? null : parseInt(v, 10);

  // -------- load
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        // 1) Course
        const { data: courseData, error: eCourse } = await supabase
          .from("courses")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (eCourse) throw eCourse;
        if (!courseData) throw new Error("Épreuve introuvable ou accès refusé.");

        // 2) Formats
        const { data: formatsData, error: eFormats } = await supabase
          .from("formats")
          .select("*")
          .eq("course_id", id)
          .order("date", { ascending: true });

        if (eFormats) throw eFormats;

        const seed = (formatsData || []).map((f) => ({
          ...f,
          localId: uuidv4(),
          nb_inscrits: 0,
          propose_repas: !!f?.prix_repas,
          // champs locaux (fichiers) pour ne pas écraser les URL en base :
          imageFile: null,
          gpxFile: null,
          fichier_reglement: null,
        }));

        // 3) Compteurs d'inscriptions (non bloquant)
        const withCounts = await Promise.all(
          seed.map(async (f) => {
            try {
              const { count, error: eCount } = await supabase
                .from("inscriptions")
                .select("id", { count: "exact", head: true })
                .eq("format_id", f.id);
              return { ...f, nb_inscrits: eCount ? 0 : (count || 0) };
            } catch {
              return { ...f, nb_inscrits: 0 };
            }
          })
        );

        setCourse(courseData);
        setFormats(withCounts);
      } catch (e) {
        setErr(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // -------- handlers
  const handleCourseChange = (e) => {
    const { name, value, files } = e.target;
    if (files && files[0]) {
      setNewImageFile(files[0]);
    } else {
      setCourse((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleFormatChange = (index, e) => {
    const { name, value, files, type, checked } = e.target;
    setFormats((prev) => {
      const updated = [...prev];
      const cur = { ...updated[index] };

      if (name === "gpx_url" && files?.[0]) {
        // on stocke le fichier séparément pour ne pas écraser gpx_url (string)
        cur.gpxFile = files[0];
      } else if (name === "imageFile" && files?.[0]) {
        cur.imageFile = files[0];
      } else if (name === "fichier_reglement" && files?.[0]) {
        cur.fichier_reglement = files[0];
      } else {
        cur[name] = type === "checkbox" ? !!checked : value;
      }

      updated[index] = cur;
      return updated;
    });
  };

  const addFormat = () => {
    setFormats((prev) => [
      ...prev,
      {
        localId: uuidv4(),
        id: undefined,
        course_id: id,

        nom: "",
        date: "",
        heure_depart: "",
        presentation_parcours: "",
        gpx_url: "", // l'URL finale ; le fichier sera dans gpxFile
        gpxFile: null,
        type_epreuve: "",
        distance_km: "",
        denivele_dplus: "",
        denivele_dmoins: "",
        adresse_depart: "",
        adresse_arrivee: "",
        prix: "",
        ravitaillements: "",
        remise_dossards: "",
        dotation: "",
        fichier_reglement: null,
        reglement_pdf_url: "",
        nb_max_coureurs: "",
        age_minimum: "",
        hebergements: "",
        imageFile: null,
        image_url: "",
        nb_inscrits: 0,
        propose_repas: false,
        prix_repas: "",
        stock_repas: "",
      },
    ]);
  };

  const duplicateFormat = (index) => {
    const o = formats[index];
    const duplicated = {
      ...o,
      localId: uuidv4(),
      id: undefined,
      nb_inscrits: 0,
      imageFile: null,
      gpxFile: null,
      fichier_reglement: null,
      propose_repas: !!o.prix_repas,
    };
    setFormats((prev) => [...prev, duplicated]);
  };

  const removeFormat = async (index) => {
    if (!window.confirm("Supprimer ce format ? Cette action est irréversible.")) return;
    const f = formats[index];

    if (f.id) {
      const { error } = await supabase.from("formats").delete().eq("id", f.id);
      if (error) {
        alert("Erreur lors de la suppression du format : " + error.message);
        return;
      }
    }
    setFormats((prev) => prev.filter((_, i) => i !== index));
  };

  // -------- submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr(null);

    try {
      // 1) upload image course si présente
      let imageCourseUrl = course?.image_url || null;
      if (newImageFile) {
        const filePath = `course-${Date.now()}.jpg`;
        const { data, error } = await supabase.storage.from("courses").upload(filePath, newImageFile);
        if (error) throw error;
        imageCourseUrl = supabase.storage.from("courses").getPublicUrl(data.path).data.publicUrl;
      }

      // 2) update course (payload whiteliste)
      const safeCourse = {
        nom: course?.nom ?? null,
        lieu: course?.lieu ?? null,
        departement: course?.departement ?? null,
        presentation: course?.presentation ?? null,
        image_url: imageCourseUrl,
      };
      {
        const { error } = await supabase.from("courses").update(safeCourse).eq("id", id);
        if (error) throw error;
      }

      // 3) upsert formats
      for (const f of formats) {
        // uploads éventuels
        let image_url = f.image_url || null;
        let gpx_url = f.gpx_url || null;
        let reglement_pdf_url = f.reglement_pdf_url || null;

        if (f.imageFile) {
          const p = `format-${Date.now()}-${(f.nom || "format").replace(/\s+/g, "-")}.jpg`;
          const { data, error } = await supabase.storage.from("formats").upload(p, f.imageFile);
          if (error) throw error;
          image_url = supabase.storage.from("formats").getPublicUrl(data.path).data.publicUrl;
        }

        if (f.gpxFile) {
          const p = `gpx-${Date.now()}-${(f.nom || "trace").replace(/\s+/g, "-")}.gpx`;
          const { data, error } = await supabase.storage.from("formats").upload(p, f.gpxFile);
          if (error) throw error;
          gpx_url = supabase.storage.from("formats").getPublicUrl(data.path).data.publicUrl;
        }

        if (f.fichier_reglement) {
          const p = `reglement-${Date.now()}-${(f.nom || "reglement").replace(/\s+/g, "-")}.pdf`;
          const { data, error } = await supabase.storage.from("reglements").upload(p, f.fichier_reglement);
          if (error) throw error;
          reglement_pdf_url = supabase.storage.from("reglements").getPublicUrl(data.path).data.publicUrl;
        }

        // calculs
        const prix = numOrNull(f.prix);
        const prix_repas = f.propose_repas ? numOrNull(f.prix_repas) : null;
        const prix_total_inscription = numOrNull(
          (prix || 0) + (f.propose_repas ? (prix_repas || 0) : 0)
        );

        // payload whitelisté
        const formatData = {
          course_id: id,
          nom: f.nom ?? null,
          date: f.date || null,
          heure_depart: f.heure_depart || null,
          presentation_parcours: f.presentation_parcours ?? null,
          gpx_url,
          type_epreuve: f.type_epreuve ?? null,
          distance_km: numOrNull(f.distance_km),
          denivele_dplus: intOrNull(f.denivele_dplus),
          denivele_dmoins: intOrNull(f.denivele_dmoins),
          adresse_depart: f.adresse_depart ?? null,
          adresse_arrivee: f.adresse_arrivee ?? null,
          prix,
          ravitaillements: f.ravitaillements ?? null,
          remise_dossards: f.remise_dossards ?? null,
          dotation: f.dotation ?? null,
          reglement_pdf_url,
          nb_max_coureurs: intOrNull(f.nb_max_coureurs),
          age_minimum: intOrNull(f.age_minimum),
          hebergements: f.hebergements ?? null,
          image_url,
          prix_repas: prix_repas,
          prix_total_repas: f.propose_repas ? numOrNull(prix_repas) : null,
          prix_total_inscription,
          stock_repas: f.propose_repas ? intOrNull(f.stock_repas) : 0,
        };

        if (f.id) {
          const { error } = await supabase.from("formats").update(formatData).eq("id", f.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("formats").insert(formatData);
          if (error) throw error;
        }
      }

      alert("Épreuve modifiée avec succès !");
      navigate("/organisateur/mon-espace");
    } catch (e) {
      console.error(e);
      setErr(e?.message ?? String(e));
    }
  };

  // -------- render
  if (loading) return <div className="p-6">Chargement…</div>;
  if (err) return <div className="p-6 text-red-600">Erreur : {err}</div>;
  if (!course) return <div className="p-6">Épreuve introuvable.</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Modifier l’épreuve</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <input
          name="nom"
          value={course.nom || ""}
          onChange={handleCourseChange}
          className="border p-2 w-full"
          placeholder="Nom de l’épreuve"
        />
        <input
          name="lieu"
          value={course.lieu || ""}
          onChange={handleCourseChange}
          className="border p-2 w-full"
          placeholder="Lieu"
        />
        <input
          name="departement"
          value={course.departement || ""}
          onChange={handleCourseChange}
          className="border p-2 w-full"
          placeholder="Département"
        />
        <textarea
          name="presentation"
          value={course.presentation || ""}
          onChange={handleCourseChange}
          className="border p-2 w-full"
          placeholder="Présentation"
        />
        <label className="block">
          Image de l’épreuve :
          <input type="file" name="image" onChange={handleCourseChange} />
        </label>

        <h2 className="text-xl font-semibold mt-6">Formats</h2>
        {formats.length === 0 && (
          <div className="text-sm text-gray-500">Aucun format pour l’instant.</div>
        )}

        {formats.map((f, index) => (
          <div key={f.localId} className="border p-4 space-y-2 bg-gray-50 rounded">
            <input
              name="nom"
              value={f.nom || ""}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
              placeholder="Nom du format"
            />

            <label className="block">
              Image du format :
              <input type="file" name="imageFile" onChange={(e) => handleFormatChange(index, e)} />
            </label>

            <input
              type="date"
              name="date"
              value={f.date || ""}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
            />
            <input
              type="time"
              name="heure_depart"
              value={f.heure_depart || ""}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
            />
            <textarea
              name="presentation_parcours"
              value={f.presentation_parcours || ""}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
              placeholder="Présentation du parcours"
            />

            {/* GPX */}
            <label className="block">
              Fichier GPX (trace du parcours) :
              <input type="file" name="gpx_url" accept=".gpx" onChange={(e) => handleFormatChange(index, e)} />
            </label>
            {f.gpx_url && (
              <div className="text-xs text-gray-600">
                Trace actuelle : <a href={f.gpx_url} target="_blank" rel="noreferrer" className="underline">ouvrir</a>
              </div>
            )}

            <input
              name="type_epreuve"
              value={f.type_epreuve || ""}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
              placeholder="Type d’épreuve"
            />
            <input
              name="distance_km"
              value={f.distance_km || ""}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
              placeholder="Distance (km)"
            />
            <input
              name="denivele_dplus"
              value={f.denivele_dplus || ""}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
              placeholder="D+"
            />
            <input
              name="denivele_dmoins"
              value={f.denivele_dmoins || ""}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
              placeholder="D-"
            />
            <input
              name="adresse_depart"
              value={f.adresse_depart || ""}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
              placeholder="Adresse de départ"
            />
            <input
              name="adresse_arrivee"
              value={f.adresse_arrivee || ""}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
              placeholder="Adresse d’arrivée"
            />
            <input
              name="prix"
              value={f.prix || ""}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
              placeholder="Prix (€)"
            />

            {/* Repas */}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="propose_repas"
                checked={!!f.propose_repas}
                onChange={(e) => handleFormatChange(index, e)}
              />
              Proposez-vous des repas ?
            </label>
            {f.propose_repas && (
              <>
                <input
                  name="stock_repas"
                  value={f.stock_repas || ""}
                  onChange={(e) => handleFormatChange(index, e)}
                  className="border p-2 w-full"
                  placeholder="Nombre total de repas disponibles"
                />
                <input
                  name="prix_repas"
                  value={f.prix_repas || ""}
                  onChange={(e) => handleFormatChange(index, e)}
                  className="border p-2 w-full"
                  placeholder="Prix d’un repas (€)"
                />
              </>
            )}

            <input
              name="ravitaillements"
              value={f.ravitaillements || ""}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
              placeholder="Ravitaillements"
            />
            <input
              name="remise_dossards"
              value={f.remise_dossards || ""}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
              placeholder="Remise des dossards"
            />
            <input
              name="dotation"
              value={f.dotation || ""}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
              placeholder="Dotation"
            />

            {/* PDF Règlement */}
            <label className="block">
              Règlement (PDF) :
              <input type="file" name="fichier_reglement" accept=".pdf" onChange={(e) => handleFormatChange(index, e)} />
            </label>
            {f.reglement_pdf_url && (
              <div className="text-xs text-gray-600">
                Règlement actuel :{" "}
                <a href={f.reglement_pdf_url} target="_blank" rel="noreferrer" className="underline">
                  ouvrir
                </a>
              </div>
            )}

            <input
              name="nb_max_coureurs"
              value={f.nb_max_coureurs || ""}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
              placeholder="Nombre max de coureurs"
            />
            <p className="text-sm text-gray-700">
              Inscriptions : {f.nb_inscrits} / {f.nb_max_coureurs || "non défini"}
              {f.nb_max_coureurs && f.nb_inscrits >= parseInt(f.nb_max_coureurs) && (
                <span className="text-red-600 font-bold"> — Limite atteinte</span>
              )}
            </p>
            <input
              name="age_minimum"
              value={f.age_minimum || ""}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
              placeholder="Âge minimum"
            />
            <textarea
              name="hebergements"
              value={f.hebergements || ""}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
              placeholder="Hébergements"
            />

            <div className="flex gap-4">
              <button type="button" onClick={() => duplicateFormat(index)} className="bg-blue-500 text-white px-3 py-1 rounded">
                Dupliquer
              </button>
              <button type="button" onClick={() => removeFormat(index)} className="bg-red-500 text-white px-3 py-1 rounded">
                Supprimer
              </button>
            </div>
          </div>
        ))}

        <div className="flex items-center gap-3">
          <button type="button" onClick={addFormat} className="bg-blue-600 text-white px-4 py-2 rounded">
            + Ajouter un format
          </button>
          <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">
            ✅ Enregistrer les modifications
          </button>
        </div>
      </form>
    </div>
  );
}
