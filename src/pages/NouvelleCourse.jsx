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

  const [formats, setFormats] = useState([
    { id: uuidv4(), ...formatTemplate() },
  ]);

  const navigate = useNavigate();

  function formatTemplate() {
    return {
      nom: "",
      imageFile: null,
      date: "",
      heure_depart: "",
      presentation_parcours: "",
      fichier_gpx: null,
      type_epreuve: "trail",
      distance_km: "",
      denivele_dplus: "",
      denivele_dmoins: "",
      adresse_depart: "",
      adresse_arrivee: "",
      prix: "",
      stock_repas: "",
      prix_repas: "",
      ravitaillements: "",
      remise_dossards: "",
      dotation: "",
      fichier_reglement: null,
      nb_max_coureurs: "",
      age_minimum: "",
      hebergements: "",
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
    const { name, value, files } = e.target;
    const updatedFormats = [...formats];
    updatedFormats[index][name + (files ? "File" : "")] = files ? files[0] : value;
    setFormats(updatedFormats);
  };

  const addFormat = () => {
    setFormats((prev) => [...prev, { id: uuidv4(), ...formatTemplate() }]);
  };

  /** Récupération automatique lat/lng via Nominatim */
  async function getLatLngFromPostalCode(codePostal, ville) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?postalcode=${codePostal}&city=${ville}&country=France&format=json&limit=1`
      );
      const data = await response.json();
      if (data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        };
      }
    } catch (err) {
      console.error("Erreur géocodage :", err);
    }
    return { lat: null, lng: null };
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return alert("Utilisateur non connecté.");

    // --- Géocodage code postal ---
    const { lat, lng } = await getLatLngFromPostalCode(course.code_postal, course.lieu);

    // --- Upload image de la course ---
    let imageCourseUrl = null;
    if (course.imageFile) {
      const { data, error } = await supabase.storage
        .from("courses")
        .upload(`course-${Date.now()}.jpg`, course.imageFile);
      if (error) return alert("Erreur upload image course : " + error.message);
      imageCourseUrl = supabase.storage.from("courses").getPublicUrl(data.path).data.publicUrl;
    }

    // --- Insert course ---
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

    // --- Insert formats ---
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

      const prix = format.prix ? parseFloat(format.prix) : 0;
      const prix_repas = format.prix_repas ? parseFloat(format.prix_repas) : 0;
      const prix_total_inscription =
        prix + (parseInt(format.stock_repas) > 0 ? prix_repas : 0);

      const { error: formatError } = await supabase.from("formats").insert({
        course_id: courseInserted.id,
        nom: format.nom || "Format sans nom",
        image_url: imageFormatUrl,
        date: format.date || null,
        heure_depart: format.heure_depart || null,
        presentation_parcours: format.presentation_parcours || null,
        gpx_url: gpxUrl,
        type_epreuve: ["trail", "rando", "route"].includes(format.type_epreuve)
          ? format.type_epreuve
          : "trail",
        distance_km: format.distance_km ? parseFloat(format.distance_km) : null,
        denivele_dplus: format.denivele_dplus
          ? parseInt(format.denivele_dplus)
          : null,
        denivele_dmoins: format.denivele_dmoins
          ? parseInt(format.denivele_dmoins)
          : null,
        adresse_depart: format.adresse_depart || null,
        adresse_arrivee: format.adresse_arrivee || null,
        prix: prix,
        stock_repas: format.stock_repas ? parseInt(format.stock_repas) : 0,
        prix_repas: prix_repas,
        prix_total_inscription: prix_total_inscription,
        ravitaillements: format.ravitaillements || null,
        remise_dossards: format.remise_dossards || null,
        dotation: format.dotation || null,
        reglement_pdf_url: reglementUrl,
        nb_max_coureurs: format.nb_max_coureurs
          ? parseInt(format.nb_max_coureurs)
          : null,
        age_minimum: format.age_minimum ? parseInt(format.age_minimum) : null,
        hebergements: format.hebergements || null,
      });

      if (formatError) {
        console.error("Erreur format:", formatError);
        alert("Erreur enregistrement format : " + formatError.message);
        return;
      }
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
        {/* --- Formats --- */}
        <h2 className="text-xl font-semibold mt-6">Formats de course</h2>
        {formats.map((f, index) => (
          <div key={f.id} className="border p-4 my-4 space-y-2 bg-gray-50 rounded">
            {/* ... Reste des champs formats ... */}
          </div>
        ))}
        <button type="button" onClick={addFormat} className="bg-blue-600 text-white px-4 py-2 rounded">+ Ajouter un format</button>
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">✅ Créer l’épreuve</button>
      </form>
    </div>
  );
}
