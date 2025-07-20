// src/pages/ModifierCourse.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { v4 as uuidv4 } from "uuid";

export default function ModifierCourse() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [course, setCourse] = useState({
    nom: "",
    lieu: "",
    departement: "",
    presentation: "",
    imageFile: null,
    image_url: "",
  });

  const [formats, setFormats] = useState([]);

  useEffect(() => {
    const fetchCourse = async () => {
      if (!id) return;

      const { data, error } = await supabase
        .from("courses")
        .select(`
          *,
          formats(
            id,
            nom,
            image_url,
            date,
            heure_depart,
            presentation_parcours,
            gpx_url,
            type_epreuve,
            distance_km,
            denivele_dplus,
            denivele_dmoins,
            adresse_depart,
            adresse_arrivee,
            prix,
            ravitaillements,
            remise_dossards,
            dotation,
            reglement_pdf_url,
            nb_max_coureurs,
            age_minimum,
            hebergements
          )
        `)
        .eq("id", id)
        .single();

      if (error) {
        console.error("Erreur chargement course:", error);
        setIsLoading(false);
        return;
      }

      setCourse({
        nom: data.nom || "",
        lieu: data.lieu || "",
        departement: data.departement || "",
        presentation: data.presentation || "",
        imageFile: null,
        image_url: data.image_url || "",
      });

      setFormats(
        (data.formats || []).map((f) => ({
          ...f,
          id: f.id || uuidv4(),
          imageFile: null,
          fichier_gpx: null,
          fichier_reglement: null,
        }))
      );

      setIsLoading(false);
    };

    fetchCourse();
  }, [id]);

  const handleCourseChange = (e) => {
    const { name, value, files } = e.target;
    if (files) {
      setCourse((prev) => ({ ...prev, [name + "File"]: files[0] }));
    } else {
      setCourse((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleFormatChange = (index, e) => {
    const { name, value, files } = e.target;
    setFormats((prev) => {
      const newFormats = [...prev];
      newFormats[index][name] = files ? files[0] : value;
      return newFormats;
    });
  };

  const addFormat = () => {
    setFormats((prev) => [
      ...prev,
      {
        id: uuidv4(),
        nom: "",
        image_url: null,
        imageFile: null,
        date: "",
        heure_depart: "",
        presentation_parcours: "",
        gpx_url: null,
        fichier_gpx: null,
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
        reglement_pdf_url: null,
        fichier_reglement: null,
        nb_max_coureurs: "",
        age_minimum: "",
        hebergements: "",
      },
    ]);
  };

  const handleSubmit = async () => {
    let imageCourseUrl = course.image_url;
    if (course.imageFile) {
      const { data, error } = await supabase.storage
        .from("courses")
        .upload(`course-${Date.now()}.jpg`, course.imageFile);
      if (!error) {
        imageCourseUrl = supabase.storage.from("courses").getPublicUrl(data.path).data.publicUrl;
      }
    }

    const { error: updateError } = await supabase
      .from("courses")
      .update({
        nom: course.nom,
        lieu: course.lieu,
        departement: course.departement,
        presentation: course.presentation,
        image_url: imageCourseUrl,
      })
      .eq("id", id);

    if (updateError) return alert("Erreur mise à jour course");

    for (const f of formats) {
      const formatToSave = { ...f };

      if (f.imageFile) {
        const { data, error } = await supabase.storage
          .from("formats")
          .upload(`format-${Date.now()}-${f.nom}.jpg`, f.imageFile);
        if (!error) formatToSave.image_url = supabase.storage.from("formats").getPublicUrl(data.path).data.publicUrl;
      }

      if (f.fichier_gpx) {
        const { data, error } = await supabase.storage
          .from("formats")
          .upload(`gpx-${Date.now()}-${f.nom}.gpx`, f.fichier_gpx);
        if (!error) formatToSave.gpx_url = supabase.storage.from("formats").getPublicUrl(data.path).data.publicUrl;
      }

      if (f.fichier_reglement) {
        const { data, error } = await supabase.storage
          .from("reglements")
          .upload(`reglement-${Date.now()}-${f.nom}.pdf`, f.fichier_reglement);
        if (!error) formatToSave.reglement_pdf_url = supabase.storage.from("reglements").getPublicUrl(data.path).data.publicUrl;
      }

      formatToSave.course_id = id;

      if (f.id && typeof f.id === "string" && f.id.length > 20) {
        await supabase.from("formats").update(formatToSave).eq("id", f.id);
      } else {
        await supabase.from("formats").insert(formatToSave);
      }
    }

    alert("Modifications enregistrées !");
    navigate("/organisateur/espace");
  };

  if (isLoading) return <p>Chargement...</p>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Modifier une épreuve</h1>
      <form className="space-y-6">
        <input name="nom" value={course.nom} placeholder="Nom de l'épreuve" onChange={handleCourseChange} className="border p-2 w-full" />
        <input name="lieu" value={course.lieu} placeholder="Lieu" onChange={handleCourseChange} className="border p-2 w-full" />
        <input name="departement" value={course.departement} placeholder="Département" onChange={handleCourseChange} className="border p-2 w-full" />
        <textarea name="presentation" value={course.presentation} placeholder="Présentation" onChange={handleCourseChange} className="border p-2 w-full" />
        <label className="block">
          Image actuelle : {course.image_url ? <img src={course.image_url} alt="Aperçu" className="w-64 h-auto" /> : "Aucune"}<br />
          Modifier l’image :
          <input type="file" name="image" accept="image/*" onChange={handleCourseChange} />
        </label>

        <h2 className="text-xl font-semibold mt-6">Formats de course</h2>
        {formats.map((f, index) => (
          <div key={f.id} className="border p-4 my-4 space-y-2 bg-gray-50 rounded">
            <input name="nom" placeholder="Nom du format" value={f.nom} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" />
            <input type="file" name="imageFile" onChange={(e) => handleFormatChange(index, e)} />
            <input type="date" name="date" value={f.date} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" />
            <input type="time" name="heure_depart" value={f.heure_depart} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" />
            <textarea name="presentation_parcours" placeholder="Présentation du parcours" value={f.presentation_parcours} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" />
            <input type="file" name="fichier_gpx" onChange={(e) => handleFormatChange(index, e)} />
            <input name="type_epreuve" placeholder="Type d'épreuve (trail, rando...)" value={f.type_epreuve} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" />
            <input name="distance_km" placeholder="Distance (km)" value={f.distance_km} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" />
            <input name="denivele_dplus" placeholder="D+" value={f.denivele_dplus} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" />
            <input name="denivele_dmoins" placeholder="D-" value={f.denivele_dmoins} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" />
            <input name="adresse_depart" placeholder="Adresse de départ" value={f.adresse_depart} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" />
            <input name="adresse_arrivee" placeholder="Adresse d'arrivée" value={f.adresse_arrivee} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" />
            <input name="prix" placeholder="Prix (€)" value={f.prix} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" />
            <input name="ravitaillements" placeholder="Ravitaillements" value={f.ravitaillements} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" />
            <input name="remise_dossards" placeholder="Remise des dossards" value={f.remise_dossards} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" />
            <input name="dotation" placeholder="Dotation" value={f.dotation} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" />
            <input type="file" name="fichier_reglement" onChange={(e) => handleFormatChange(index, e)} />
            <input name="nb_max_coureurs" placeholder="Nombre max de coureurs" value={f.nb_max_coureurs} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" />
            <input name="age_minimum" placeholder="Âge minimum" value={f.age_minimum} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" />
            <textarea name="hebergements" placeholder="Hébergements" value={f.hebergements} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" />
          </div>
        ))}

        <button type="button" onClick={addFormat} className="bg-blue-600 text-white px-4 py-2 rounded">+ Ajouter un format</button>
        <button type="button" onClick={handleSubmit} className="bg-green-600 text-white px-4 py-2 rounded">💾 Sauvegarder les modifications</button>
      </form>
    </div>
  );
}
