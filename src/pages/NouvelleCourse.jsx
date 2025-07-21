import React, { useState } from "react";
import { supabase } from "../supabase";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";

export default function NouvelleCourse() {
  const [course, setCourse] = useState({
    nom: "",
    lieu: "",
    departement: "",
    presentation: "",
    imageFile: null,
  });

  const [formats, setFormats] = useState([
    {
      id: uuidv4(),
      nom: "",
      imageFile: null,
      date: "",
      heure_depart: "",
      presentation_parcours: "",
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
      fichier_reglement: null,
      nb_max_coureurs: "",
      age_minimum: "",
      hebergements: "",
    },
  ]);

  const navigate = useNavigate();

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
    setFormats((prevFormats) => {
      const updatedFormats = [...prevFormats];
      const format = { ...updatedFormats[index] };
      format[name] = files ? files[0] : value;
      updatedFormats[index] = format;
      return updatedFormats;
    });
  };

  const addFormat = () => {
    setFormats((prev) => [
      ...prev,
      {
        id: uuidv4(),
        nom: "",
        imageFile: null,
        date: "",
        heure_depart: "",
        presentation_parcours: "",
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
        fichier_reglement: null,
        nb_max_coureurs: "",
        age_minimum: "",
        hebergements: "",
      },
    ]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const session = await supabase.auth.getSession();
    const userId = session.data?.session?.user?.id;
    if (!userId) return;

    let imageCourseUrl = null;
    if (course.imageFile) {
      const { data, error } = await supabase.storage
        .from("courses")
        .upload(`course-${Date.now()}.jpg`, course.imageFile);
      if (error) return alert("Erreur upload image course");
      imageCourseUrl = supabase.storage.from("courses").getPublicUrl(data.path).data.publicUrl;
    }

    const { data: courseInserted, error: courseError } = await supabase
      .from("courses")
      .insert({
        nom: course.nom,
        lieu: course.lieu,
        departement: course.departement,
        presentation: course.presentation,
        image_url: imageCourseUrl,
        organisateur_id: userId,
      })
      .select()
      .single();

    if (courseError) return alert("Erreur enregistrement épreuve");

    for (const format of formats) {
      let imageFormatUrl = null;
      let gpxUrl = null;
      let reglementUrl = null;

      if (format.imageFile) {
        const { data, error } = await supabase.storage
          .from("formats")
          .upload(`format-${Date.now()}-${format.nom}.jpg`, format.imageFile);
        if (!error) {
          imageFormatUrl = supabase.storage.from("formats").getPublicUrl(data.path).data.publicUrl;
        }
      }

      if (format.fichier_gpx) {
        const { data, error } = await supabase.storage
          .from("formats")
          .upload(`gpx-${Date.now()}-${format.nom}.gpx`, format.fichier_gpx);
        if (!error) {
          gpxUrl = supabase.storage.from("formats").getPublicUrl(data.path).data.publicUrl;
        }
      }

      if (format.fichier_reglement) {
        const { data, error } = await supabase.storage
          .from("reglements")
          .upload(`reglement-${Date.now()}-${format.nom}.pdf`, format.fichier_reglement);
        if (!error) {
          reglementUrl = supabase.storage.from("reglements").getPublicUrl(data.path).data.publicUrl;
        }
      }

      await supabase.from("formats").insert({
        course_id: courseInserted.id,
        nom: format.nom,
        image_url: imageFormatUrl,
        date: format.date,
        heure_depart: format.heure_depart,
        presentation_parcours: format.presentation_parcours,
        gpx_url: gpxUrl,
        type_epreuve: format.type_epreuve,
        distance_km: format.distance_km,
        denivele_dplus: format.denivele_dplus,
        denivele_dmoins: format.denivele_dmoins,
        adresse_depart: format.adresse_depart,
        adresse_arrivee: format.adresse_arrivee,
        prix: format.prix,
        ravitaillements: format.ravitaillements,
        remise_dossards: format.remise_dossards,
        dotation: format.dotation,
        reglement_pdf_url: reglementUrl,
        nb_max_coureurs: format.nb_max_coureurs,
        age_minimum: format.age_minimum,
        hebergements: format.hebergements,
      });
    }

    alert("Épreuve et formats enregistrés !");
    navigate("/organisateur/mon-espace");
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Créer une nouvelle épreuve</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <input name="nom" placeholder="Nom de l'épreuve" onChange={handleCourseChange} className="border p-2 w-full" />
        <input name="lieu" placeholder="Lieu" onChange={handleCourseChange} className="border p-2 w-full" />
        <input name="departement" placeholder="Département" onChange={handleCourseChange} className="border p-2 w-full" />
        <textarea name="presentation" placeholder="Présentation" onChange={handleCourseChange} className="border p-2 w-full" />
        <label className="block">
          Image de l’épreuve :
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
            <input name="type_epreuve" placeholder="Type d'épreuve" value={f.type_epreuve} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" />
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
            <input name="nb_max_coureurs" placeholder="Nombre max" value={f.nb_max_coureurs} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" />
            <input name="age_minimum" placeholder="Âge minimum" value={f.age_minimum} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" />
            <textarea name="hebergements" placeholder="Hébergements" value={f.hebergements} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" />
          </div>
        ))}
        <button type="button" onClick={addFormat} className="bg-blue-600 text-white px-4 py-2 rounded">+ Ajouter un format</button>
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">✅ Créer l’épreuve</button>
      </form>
    </div>
  );
}
