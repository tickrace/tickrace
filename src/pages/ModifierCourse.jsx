// src/pages/ModifierCourse.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { v4 as uuidv4 } from "uuid";

export default function ModifierCourse() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);
  const [newImageFile, setNewImageFile] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: courseData } = await supabase
        .from("courses")
        .select("*")
        .eq("id", id)
        .single();

      const { data: formatsData } = await supabase
        .from("formats")
        .select("*, id")
        .eq("course_id", id);

      const formatsWithInscrits = await Promise.all(
        (formatsData || []).map(async (format) => {
          const { count } = await supabase
            .from("inscriptions")
            .select("*", { count: "exact", head: true })
            .eq("format_id", format.id);

          return {
            ...format,
            nb_inscrits: count || 0,
            localId: uuidv4(),
            propose_repas: !!format.prix_repas,
            imageFile: null,
            gpxFile: null,
            fichier_reglement: null,
          };
        })
      );

      setCourse(courseData);
      setFormats(formatsWithInscrits);
    };

    fetchData();
  }, [id]);

  const handleCourseChange = (e) => {
    const { name, value, files } = e.target;
    if (files) setNewImageFile(files[0]);
    else setCourse((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormatChange = (index, e) => {
    const { name, value, files, type, checked } = e.target;
    setFormats((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [name]: type === "checkbox" ? checked : files ? files[0] : value,
      };
      return updated;
    });
  };

  const addFormat = () => {
    setFormats((prev) => [
      ...prev,
      {
        localId: uuidv4(),
        nom: "",
        date: "",
        heure_depart: "",
        presentation_parcours: "",
        gpx_url: "",
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
    const original = formats[index];
    const duplicated = {
      ...original,
      localId: uuidv4(),
      id: undefined,
      nb_inscrits: 0,
      imageFile: null,
      gpxFile: null,
      fichier_reglement: null,
      propose_repas: !!original.prix_repas,
    };
    setFormats((prev) => [...prev, duplicated]);
  };

  const removeFormat = async (index) => {
    if (!window.confirm("Supprimer ce format ? Cette action est irréversible.")) return;
    const formatToRemove = formats[index];
    if (formatToRemove.id) {
      await supabase.from("formats").delete().eq("id", formatToRemove.id);
    }
    setFormats((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadToBucket = async (bucket, path, file, contentType) => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: true, contentType });
    if (error) throw error;
    return supabase.storage.from(bucket).getPublicUrl(data.path).data.publicUrl;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let imageCourseUrl = course.image_url;
      if (newImageFile instanceof File) {
        const path = `courses/${id}/cover-${Date.now()}.jpg`;
        imageCourseUrl = await uploadToBucket("courses", path, newImageFile, newImageFile.type);
      }

      await supabase
        .from("courses")
        .update({
          nom: course.nom,
          lieu: course.lieu,
          departement: course.departement,
          presentation: course.presentation,
          image_url: imageCourseUrl,
        })
        .eq("id", id);

      for (const format of formats) {
        let image_url = format.image_url || null;
        let gpx_url = format.gpx_url || null;
        let reglement_pdf_url = format.reglement_pdf_url || null;

        if (format.imageFile instanceof File) {
          const safeName = (format.nom || "format").replace(/[^\w-]+/g, "_");
          const path = `formats/${id}/${format.id || format.localId}/image-${Date.now()}-${safeName}.jpg`;
          image_url = await uploadToBucket("formats", path, format.imageFile, format.imageFile.type);
        }

        if (format.gpxFile instanceof File) {
          const safeName = (format.nom || "format").replace(/[^\w-]+/g, "_");
          const path = `formats/${id}/${format.id || format.localId}/trace-${Date.now()}-${safeName}.gpx`;
          gpx_url = await uploadToBucket("formats", path, format.gpxFile, "application/gpx+xml");
        }

        if (format.fichier_reglement instanceof File) {
          const safeName = (format.nom || "format").replace(/[^\w-]+/g, "_");
          const path = `reglements/${id}/${format.id || format.localId}/reglement-${Date.now()}-${safeName}.pdf`;
          reglement_pdf_url = await uploadToBucket("reglements", path, format.fichier_reglement, "application/pdf");
        }

        const prix = parseFloat(format.prix || 0);
        const prix_repas = format.propose_repas ? parseFloat(format.prix_repas || 0) : 0;
        const prix_total_inscription = prix + prix_repas;

        const formatData = {
          ...format,
          course_id: id,
          image_url,
          gpx_url,
          reglement_pdf_url,
          prix,
          prix_repas: format.propose_repas ? prix_repas : null,
          prix_total_inscription,
          stock_repas: format.propose_repas ? parseInt(format.stock_repas || 0, 10) : 0,
        };

        delete formatData.localId;
        delete formatData.nb_inscrits;
        delete formatData.imageFile;
        delete formatData.gpxFile;
        delete formatData.fichier_reglement;
        delete formatData.propose_repas;

        if (format.id) {
          await supabase.from("formats").update(formatData).eq("id", format.id);
        } else {
          const { id: _omit, ...formatSansId } = formatData;
          await supabase.from("formats").insert(formatSansId);
        }
      }

      alert("Épreuve modifiée avec succès !");
      navigate("/organisateur/mon-espace");
    } catch (err) {
      alert("Erreur lors de l’enregistrement : " + (err.message || err));
    }
  };

  if (!course) return <div>Chargement...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* HEADER */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold text-gray-900">Modifier l’épreuve</h1>
        <p className="mt-2 text-lg text-orange-600 font-medium">
          Ajustez les détails de votre course et ses formats avant publication
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-2xl shadow">
        {/* Infos générales */}
        <div className="grid gap-4">
          <input name="nom" value={course.nom} onChange={handleCourseChange} className="border p-3 rounded w-full" placeholder="Nom de l’épreuve" />
          <input name="lieu" value={course.lieu} onChange={handleCourseChange} className="border p-3 rounded w-full" placeholder="Lieu" />
          <input name="departement" value={course.departement} onChange={handleCourseChange} className="border p-3 rounded w-full" placeholder="Département" />
          <textarea name="presentation" value={course.presentation} onChange={handleCourseChange} className="border p-3 rounded w-full" placeholder="Présentation" />
          <input type="file" name="image" accept="image/*" onChange={handleCourseChange} className="w-full" />
        </div>

        {/* Formats */}
        <h2 className="text-2xl font-semibold mt-8">Formats</h2>
        {formats.map((f, index) => (
          <div key={f.localId} className="border p-4 space-y-3 bg-gray-50 rounded-xl">
            <input name="nom" value={f.nom} onChange={(e) => handleFormatChange(index, e)} className="border p-2 rounded w-full" placeholder="Nom du format" />
            <input type="file" name="imageFile" accept="image/*" onChange={(e) => handleFormatChange(index, e)} className="w-full" />
            <input type="date" name="date" value={f.date || ""} onChange={(e) => handleFormatChange(index, e)} className="border p-2 rounded w-full" />
            <input type="time" name="heure_depart" value={f.heure_depart || ""} onChange={(e) => handleFormatChange(index, e)} className="border p-2 rounded w-full" />
            <textarea name="presentation_parcours" value={f.presentation_parcours || ""} onChange={(e) => handleFormatChange(index, e)} className="border p-2 rounded w-full" placeholder="Présentation du parcours" />

            <label className="block text-sm font-medium text-gray-700">
              Fichier GPX :
              <input type="file" name="gpxFile" accept=".gpx,application/gpx+xml" onChange={(e) => handleFormatChange(index, e)} className="mt-1" />
            </label>

            <input name="distance_km" value={f.distance_km || ""} onChange={(e) => handleFormatChange(index, e)} className="border p-2 rounded w-full" placeholder="Distance (km)" />
            <input name="denivele_dplus" value={f.denivele_dplus || ""} onChange={(e) => handleFormatChange(index, e)} className="border p-2 rounded w-full" placeholder="D+" />
            <input name="denivele_dmoins" value={f.denivele_dmoins || ""} onChange={(e) => handleFormatChange(index, e)} className="border p-2 rounded w-full" placeholder="D-" />
            <input name="prix" value={f.prix || ""} onChange={(e) => handleFormatChange(index, e)} className="border p-2 rounded w-full" placeholder="Prix (€)" />

            {/* Actions format */}
            <div className="flex gap-3 mt-3">
              <button type="button" onClick={() => duplicateFormat(index)} className="bg-blue-500 text-white px-3 py-1 rounded">Dupliquer</button>
              <button type="button" onClick={() => removeFormat(index)} className="bg-red-500 text-white px-3 py-1 rounded">Supprimer</button>
            </div>
          </div>
        ))}

        <div className="flex gap-3">
          <button type="button" onClick={addFormat} className="bg-blue-600 text-white px-4 py-2 rounded">+ Ajouter un format</button>
          <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">✅ Enregistrer</button>
        </div>
      </form>
    </div>
  );
}
