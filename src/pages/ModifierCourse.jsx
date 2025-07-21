import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { v4 as uuidv4 } from "uuid";

export default function ModifierCourse() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState({
    nom: "",
    lieu: "",
    departement: "",
    presentation: "",
    image_url: "",
    imageFile: null,
  });

  const [formats, setFormats] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: courseData, error: courseError } = await supabase
        .from("courses")
        .select("*")
        .eq("id", id)
        .single();

      if (courseError || !courseData) {
        alert("Erreur chargement de l'épreuve");
        return;
      }

      setCourse({
        ...courseData,
        imageFile: null,
      });

      const { data: formatsData } = await supabase
        .from("formats")
        .select("*")
        .eq("course_id", id);

      setFormats(
        formatsData.map((f) => ({
          ...f,
          imageFile: null,
          fichier_gpx: null,
          fichier_reglement: null,
          tempId: uuidv4(),
        }))
      );
    };

    fetchData();
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
        tempId: uuidv4(),
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

    let imageCourseUrl = course.image_url;
    if (course.imageFile) {
      const { data, error } = await supabase.storage
        .from("courses")
        .upload(`course-${Date.now()}.jpg`, course.imageFile);
      if (!error) {
        imageCourseUrl = supabase.storage
          .from("courses")
          .getPublicUrl(data.path).data.publicUrl;
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

    if (updateError) return alert("Erreur mise à jour de l’épreuve");

    for (const format of formats) {
      let imageFormatUrl = format.image_url || null;
      let gpxUrl = format.gpx_url || null;
      let reglementUrl = format.reglement_pdf_url || null;

      if (format.imageFile) {
        const { data, error } = await supabase.storage
          .from("formats")
          .upload(`format-${Date.now()}-${format.nom}.jpg`, format.imageFile);
        if (!error) {
          imageFormatUrl = supabase.storage
            .from("formats")
            .getPublicUrl(data.path).data.publicUrl;
        }
      }

      if (format.fichier_gpx) {
        const { data, error } = await supabase.storage
          .from("formats")
          .upload(`gpx-${Date.now()}-${format.nom}.gpx`, format.fichier_gpx);
        if (!error) {
          gpxUrl = supabase.storage
            .from("formats")
            .getPublicUrl(data.path).data.publicUrl;
        }
      }

      if (format.fichier_reglement) {
        const { data, error } = await supabase.storage
          .from("reglements")
          .upload(`reglement-${Date.now()}-${format.nom}.pdf`, format.fichier_reglement);
        if (!error) {
          reglementUrl = supabase.storage
            .from("reglements")
            .getPublicUrl(data.path).data.publicUrl;
        }
      }

      if (format.id) {
        await supabase.from("formats").update({
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
        }).eq("id", format.id);
      } else {
        await supabase.from("formats").insert({
          course_id: id,
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
    }

    alert("Épreuve mise à jour !");
    navigate("/organisateur/mon-espace");
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Modifier l’épreuve</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <input name="nom" value={course.nom} onChange={handleCourseChange} placeholder="Nom" className="border p-2 w-full" />
        <input name="lieu" value={course.lieu} onChange={handleCourseChange} placeholder="Lieu" className="border p-2 w-full" />
        <input name="departement" value={course.departement} onChange={handleCourseChange} placeholder="Département" className="border p-2 w-full" />
        <textarea name="presentation" value={course.presentation} onChange={handleCourseChange} placeholder="Présentation" className="border p-2 w-full" />
        <label className="block">
          Nouvelle image de l’épreuve :
          <input type="file" name="image" accept="image/*" onChange={handleCourseChange} />
        </label>

        <h2 className="text-xl font-semibold mt-6">Formats</h2>
        {formats.map((f, index) => (
          <div key={f.tempId} className="border p-4 my-4 space-y-2 bg-gray-100 rounded">
            <input name="nom" placeholder="Nom" value={f.nom} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" />
            <input type="file" name="imageFile" onChange={(e) => handleFormatChange(index, e)} />
            <input type="date" name="date" value={f.date} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" />
            <input type="time" name="heure_depart" value={f.heure_depart} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" />
            <textarea name="presentation_parcours" value={f.presentation_parcours} onChange={(e) => handleFormatChange(index, e)} placeholder="Parcours" className="border p-2 w-full" />
            <input type="file" name="fichier_gpx" onChange={(e) => handleFormatChange(index, e)} />
            <input name="type_epreuve" value={f.type_epreuve} onChange={(e) => handleFormatChange(index, e)} placeholder="Type" className="border p-2 w-full" />
            <input name="distance_km" value={f.distance_km} onChange={(e) => handleFormatChange(index, e)} placeholder="Distance (km)" className="border p-2 w-full" />
            <input name="denivele_dplus" value={f.denivele_dplus} onChange={(e) => handleFormatChange(index, e)} placeholder="D+" className="border p-2 w-full" />
            <input name="denivele_dmoins" value={f.denivele_dmoins} onChange={(e) => handleFormatChange(index, e)} placeholder="D-" className="border p-2 w-full" />
            <input name="adresse_depart" value={f.adresse_depart} onChange={(e) => handleFormatChange(index, e)} placeholder="Départ" className="border p-2 w-full" />
            <input name="adresse_arrivee" value={f.adresse_arrivee} onChange={(e) => handleFormatChange(index, e)} placeholder="Arrivée" className="border p-2 w-full" />
            <input name="prix" value={f.prix} onChange={(e) => handleFormatChange(index, e)} placeholder="Prix" className="border p-2 w-full" />
            <input name="ravitaillements" value={f.ravitaillements} onChange={(e) => handleFormatChange(index, e)} placeholder="Ravitaillements" className="border p-2 w-full" />
            <input name="remise_dossards" value={f.remise_dossards} onChange={(e) => handleFormatChange(index, e)} placeholder="Remise dossards" className="border p-2 w-full" />
            <input name="dotation" value={f.dotation} onChange={(e) => handleFormatChange(index, e)} placeholder="Dotation" className="border p-2 w-full" />
            <input type="file" name="fichier_reglement" onChange={(e) => handleFormatChange(index, e)} />
            <input name="nb_max_coureurs" value={f.nb_max_coureurs} onChange={(e) => handleFormatChange(index, e)} placeholder="Max coureurs" className="border p-2 w-full" />
            <input name="age_minimum" value={f.age_minimum} onChange={(e) => handleFormatChange(index, e)} placeholder="Âge minimum" className="border p-2 w-full" />
            <textarea name="hebergements" value={f.hebergements} onChange={(e) => handleFormatChange(index, e)} placeholder="Hébergements" className="border p-2 w-full" />
          </div>
        ))}

        <button type="button" onClick={addFormat} className="bg-blue-600 text-white px-4 py-2 rounded">
          + Ajouter un format
        </button>

        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">
          ✅ Enregistrer les modifications
        </button>
      </form>
    </div>
  );
}
