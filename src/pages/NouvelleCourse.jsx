// src/pages/NouvelleCourse.jsx
import React, { useState } from "react";
import { supabase } from "../supabase";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";

export default function NouvelleCourse() {
  const [course, setCourse] = useState({
    nom: "",
    lieu: "",
    departement: "",
    code_postal: "",
    presentation: "",
    imageFile: null,
  });

  const [formats, setFormats] = useState([formatTemplate()]);
  const navigate = useNavigate();

  function formatTemplate() {
    return {
      localId: uuidv4(),
      nom: "",
      imageFile: null,
      date: "",
      heure_depart: "",
      presentation_parcours: "",
      fichier_gpx: null,
      gpx_url: "",
      type_epreuve: "trail",
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
      propose_repas: false,
      prix_repas: "",
      stock_repas: "",
    };
  }

  const handleCourseChange = (e) => {
    const { name, value, files } = e.target;
    setCourse((prev) => ({
      ...prev,
      [name + (files ? "File" : "")]: files ? files[0] : value,
    }));
  };

  const handleFormatChange = (index, e) => {
    const { name, value, files, type, checked } = e.target;
    const updated = [...formats];
    updated[index] = {
      ...updated[index],
      [name]: type === "checkbox" ? checked : files ? files[0] : value,
    };
    setFormats(updated);
  };

  const addFormat = () => setFormats((prev) => [...prev, formatTemplate()]);

  /** Géocodage via Nominatim */
  async function getLatLngFromPostalCode(codePostal, ville) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?postalcode=${codePostal}&city=${ville}&country=France&format=json&limit=1`
      );
      const data = await res.json();
      if (data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    } catch (e) {
      console.error("Erreur géocodage :", e);
    }
    return { lat: null, lng: null };
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return alert("Utilisateur non connecté.");

    const { lat, lng } = await getLatLngFromPostalCode(course.code_postal, course.lieu);

    // Upload image principale
    let imageCourseUrl = null;
    if (course.imageFile) {
      const { data, error } = await supabase.storage
        .from("courses")
        .upload(`course-${Date.now()}.jpg`, course.imageFile);
      if (!error) {
        imageCourseUrl = supabase.storage.from("courses").getPublicUrl(data.path).data.publicUrl;
      }
    }

    // Insert course
    const { data: courseInserted, error: courseError } = await supabase
      .from("courses")
      .insert({
        nom: course.nom,
        lieu: course.lieu,
        departement: course.departement,
        code_postal: course.code_postal,
        lat,
        lng,
        presentation: course.presentation,
        image_url: imageCourseUrl,
        organisateur_id: userId,
      })
      .select()
      .single();

    if (courseError) {
      console.error("Erreur course:", courseError);
      return alert("Erreur enregistrement épreuve : " + courseError.message);
    }

    // Insert formats
    for (const format of formats) {
      let image_url = null;
      let gpx_url = "";
      let reglement_pdf_url = "";

      // Upload image format
      if (format.imageFile) {
        const { data } = await supabase.storage
          .from("formats")
          .upload(`format-${Date.now()}-${format.nom}.jpg`, format.imageFile);
        image_url = supabase.storage.from("formats").getPublicUrl(data.path).data.publicUrl;
      }

      // Upload fichier GPX
      if (format.fichier_gpx) {
        const { data } = await supabase.storage
          .from("formats")
          .upload(`gpx-${Date.now()}-${format.nom}.gpx`, format.fichier_gpx);
        gpx_url = supabase.storage.from("formats").getPublicUrl(data.path).data.publicUrl;
      }

      // Upload règlement PDF
      if (format.fichier_reglement) {
        const { data } = await supabase.storage
          .from("reglements")
          .upload(`reglement-${Date.now()}-${format.nom}.pdf`, format.fichier_reglement);
        reglement_pdf_url = supabase.storage.from("reglements").getPublicUrl(data.path).data.publicUrl;
      }

      const prix = parseFloat(format.prix || 0);
      const prix_repas = format.propose_repas ? parseFloat(format.prix_repas || 0) : 0;
      const prix_total_inscription = prix + prix_repas;

      await supabase.from("formats").insert({
        course_id: courseInserted.id,
        nom: format.nom,
        image_url,
        date: format.date || null,
        heure_depart: format.heure_depart || null,
        presentation_parcours: format.presentation_parcours || null,
        gpx_url,
        type_epreuve: format.type_epreuve,
        distance_km: format.distance_km || null,
        denivele_dplus: format.denivele_dplus || null,
        denivele_dmoins: format.denivele_dmoins || null,
        adresse_depart: format.adresse_depart || null,
        adresse_arrivee: format.adresse_arrivee || null,
        prix,
        prix_repas,
        prix_total_inscription,
        ravitaillements: format.ravitaillements || null,
        remise_dossards: format.remise_dossards || null,
        dotation: format.dotation || null,
        reglement_pdf_url,
        nb_max_coureurs: format.nb_max_coureurs || null,
        age_minimum: format.age_minimum || null,
        hebergements: format.hebergements || null,
        stock_repas: format.propose_repas ? parseInt(format.stock_repas || 0) : 0,
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
        <input name="code_postal" placeholder="Code postal" onChange={handleCourseChange} className="border p-2 w-full" />
        <input name="departement" placeholder="Département" onChange={handleCourseChange} className="border p-2 w-full" />
        <textarea name="presentation" placeholder="Présentation" onChange={handleCourseChange} className="border p-2 w-full" />
        <label className="block">
          Image de l’épreuve :
          <input type="file" name="image" accept="image/*" onChange={handleCourseChange} />
        </label>

        {/* Formats */}
        <h2 className="text-xl font-semibold mt-6">Formats de course</h2>
        {formats.map((f, index) => (
          <div key={f.localId} className="border p-4 my-4 space-y-2 bg-gray-50 rounded">
            <input name="nom" placeholder="Nom du format" value={f.nom} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" />
            <input type="file" name="imageFile" onChange={(e) => handleFormatChange(index, e)} />
            <input type="date" name="date" value={f.date} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" />
            <input type="time" name="heure_depart" value={f.heure_depart} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" />
            <textarea name="presentation_parcours" placeholder="Présentation du parcours" value={f.presentation_parcours} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" />

            {/* GPX avec explication */}
            <label>
              Trace GPX (format .gpx) :
              <input type="file" name="fichier_gpx" accept=".gpx" onChange={(e) => handleFormatChange(index, e)} />
            </label>

            <input name="type_epreuve" placeholder="Type d'épreuve (trail, rando, route)" value={f.type_epreuve} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" />
            <input name="distance_km" placeholder="Distance (km)" value={f.distance_km} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" />

            {/* PDF avec explication */}
            <label>
              Règlement PDF :
              <input type="file" name="fichier_reglement" accept="application/pdf" onChange={(e) => handleFormatChange(index, e)} />
            </label>
          </div>
        ))}
        <button type="button" onClick={addFormat} className="bg-blue-600 text-white px-4 py-2 rounded">+ Ajouter un format</button>
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">✅ Créer l’épreuve</button>
      </form>
    </div>
  );
}
