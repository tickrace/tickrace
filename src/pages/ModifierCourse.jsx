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
        formatsData.map(async (format) => {
          const { count } = await supabase
            .from("inscriptions")
            .select("*", { count: "exact", head: true })
            .eq("format_id", format.id);

          return {
            ...format,
            nb_inscrits: count || 0,
            localId: uuidv4(),
            propose_repas: format.prix_repas ? true : false,
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
      propose_repas: !!original.prix_repas,
    };
    setFormats((prev) => [...prev, duplicated]);
  };

  const removeFormat = async (index) => {
  if (!window.confirm("Supprimer ce format ? Cette action est irréversible.")) return;

  const formatToRemove = formats[index];

  // Si le format est déjà en base, le supprimer côté Supabase
  if (formatToRemove.id) {
    const { error } = await supabase
      .from("formats")
      .delete()
      .eq("id", formatToRemove.id);

    if (error) {
      alert("Erreur lors de la suppression du format : " + error.message);
      return;
    }
  }

  // Ensuite : suppression locale dans le state React
  setFormats((prev) => prev.filter((_, i) => i !== index));
};


  const handleSubmit = async (e) => {
    e.preventDefault();

    let imageCourseUrl = course.image_url;
    if (newImageFile) {
      const { data, error } = await supabase.storage
        .from("courses")
        .upload(`course-${Date.now()}.jpg`, newImageFile);
      if (!error) {
        imageCourseUrl = supabase.storage.from("courses").getPublicUrl(data.path).data.publicUrl;
      }
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
      let image_url = format.image_url;
      let gpx_url = format.gpx_url;
      let reglement_pdf_url = format.reglement_pdf_url;

      if (format.imageFile) {
        const { data } = await supabase.storage
          .from("formats")
          .upload(`format-${Date.now()}-${format.nom}.jpg`, format.imageFile);
        image_url = supabase.storage.from("formats").getPublicUrl(data.path).data.publicUrl;
      }
      if (format.gpx_url) {
        const { data } = await supabase.storage
          .from("formats")
          .upload(`gpx-${Date.now()}-${format.nom}.gpx`, format.gpx_url);
        gpx_url = supabase.storage.from("formats").getPublicUrl(data.path).data.publicUrl;
      }
      if (format.fichier_reglement) {
        const { data } = await supabase.storage
          .from("reglements")
          .upload(`reglement-${Date.now()}-${format.nom}.pdf`, format.fichier_reglement);
        reglement_pdf_url = supabase.storage.from("reglements").getPublicUrl(data.path).data.publicUrl;
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
        prix_total_repas: prix_repas,
        prix_total_inscription,
        stock_repas: format.propose_repas ? parseInt(format.stock_repas || 0) : 0,
      };

      delete formatData.localId;
      delete formatData.nb_inscrits;
      delete formatData.imageFile;
      delete formatData.gpx_url;
      delete formatData.fichier_reglement;
      delete formatData.propose_repas;

      if (format.id) {
        await supabase.from("formats").update(formatData).eq("id", format.id);
      } else {
        const { id: _, ...formatSansId } = formatData;
        await supabase.from("formats").insert(formatSansId);
      }
    }

    alert("Épreuve modifiée avec succès !");
    navigate("/organisateur/mon-espace");
  };

  if (!course) return <div>Chargement...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Modifier l’épreuve</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <input name="nom" value={course.nom} onChange={handleCourseChange} className="border p-2 w-full" placeholder="Nom de l’épreuve" />
        <input name="lieu" value={course.lieu} onChange={handleCourseChange} className="border p-2 w-full" placeholder="Lieu" />
        <input name="departement" value={course.departement} onChange={handleCourseChange} className="border p-2 w-full" placeholder="Département" />
        <textarea name="presentation" value={course.presentation} onChange={handleCourseChange} className="border p-2 w-full" placeholder="Présentation" />
        <input type="file" name="image" onChange={handleCourseChange} />

        <h2 className="text-xl font-semibold mt-6">Formats</h2>
        {formats.map((f, index) => (
          <div key={f.localId} className="border p-4 space-y-2 bg-gray-50">
            <input name="nom" value={f.nom} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" placeholder="Nom du format" />
            <input type="file" name="imageFile" onChange={(e) => handleFormatChange(index, e)} />
            <input type="date" name="date" value={f.date} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" />
            <input type="time" name="heure_depart" value={f.heure_depart} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" />
            <textarea name="presentation_parcours" value={f.presentation_parcours} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" placeholder="Présentation du parcours" />
            
            {/* GPX */}
            <label>
              Fichier GPX (trace du parcours) :
              <input type="file" name="gpx_url" accept=".gpx" onChange={(e) => handleFormatChange(index, e)} />
            </label>

            <input name="type_epreuve" value={f.type_epreuve} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" placeholder="Type d’épreuve" />
            <input name="distance_km" value={f.distance_km} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" placeholder="Distance (km)" />
            <input name="denivele_dplus" value={f.denivele_dplus} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" placeholder="D+" />
            <input name="denivele_dmoins" value={f.denivele_dmoins} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" placeholder="D-" />
            <input name="adresse_depart" value={f.adresse_depart} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" placeholder="Adresse de départ" />
            <input name="adresse_arrivee" value={f.adresse_arrivee} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" placeholder="Adresse d’arrivée" />
            <input name="prix" value={f.prix} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" placeholder="Prix (€)" />

            {/* Repas */}
            <label className="flex items-center gap-2">
              <input type="checkbox" name="propose_repas" checked={f.propose_repas || false} onChange={(e) => handleFormatChange(index, e)} /> Proposez-vous des repas ?
            </label>
            {f.propose_repas && (
              <>
                <input name="stock_repas" value={f.stock_repas || ""} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" placeholder="Nombre total de repas disponibles" />
                <input name="prix_repas" value={f.prix_repas || ""} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" placeholder="Prix d’un repas (€)" />
              </>
            )}

            <input name="ravitaillements" value={f.ravitaillements} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" placeholder="Ravitaillements" />
            <input name="remise_dossards" value={f.remise_dossards} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" placeholder="Remise des dossards" />
            <input name="dotation" value={f.dotation} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" placeholder="Dotation" />

            {/* PDF */}
            <label>
              Règlement (PDF) :
              <input type="file" name="fichier_reglement" accept=".pdf" onChange={(e) => handleFormatChange(index, e)} />
            </label>

            <input name="nb_max_coureurs" value={f.nb_max_coureurs} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" placeholder="Nombre max de coureurs" />
            <p className="text-sm text-gray-700">
              Inscriptions : {f.nb_inscrits} / {f.nb_max_coureurs || "non défini"}
              {f.nb_max_coureurs && f.nb_inscrits >= parseInt(f.nb_max_coureurs) && (
                <span className="text-red-600 font-bold"> — Limite atteinte</span>
              )}
            </p>
            <input name="age_minimum" value={f.age_minimum} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" placeholder="Âge minimum" />
            <textarea name="hebergements" value={f.hebergements} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" placeholder="Hébergements" />
            <div className="flex gap-4">
              <button type="button" onClick={() => duplicateFormat(index)} className="bg-blue-500 text-white px-3 py-1 rounded">Dupliquer</button>
              <button type="button" onClick={() => removeFormat(index)} className="bg-red-500 text-white px-3 py-1 rounded">Supprimer</button>
            </div>
          </div>
        ))}
        <button type="button" onClick={addFormat} className="bg-blue-600 text-white px-4 py-2 rounded">+ Ajouter un format</button>
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">✅ Enregistrer les modifications</button>
      </form>
    </div>
  );
}
