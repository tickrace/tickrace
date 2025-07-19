// src/pages/NouvelleCourse.jsx
import React, { useState } from "react";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";
import { v4 as uuidv4 } from "uuid";

export default function NouvelleCourse() {
  const { session } = useUser();
  const user = session?.user;

  const [course, setCourse] = useState({
    nom: "",
    lieu: "",
    departement: "",
    presentation: "",
    image: null
  });

  const [formats, setFormats] = useState([
    {
      nom: "",
      image: null,
      date: "",
      heure_depart: "",
      presentation_parcours: "",
      gpx: null,
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
      reglement_pdf: null,
      nb_max_coureurs: "",
      age_minimum: "",
      hebergements: ""
    }
  ]);

  const handleCourseChange = (e) => {
    const { name, value, files } = e.target;
    setCourse((prev) => ({
      ...prev,
      [name]: files ? files[0] : value
    }));
  };

  const handleFormatChange = (index, e) => {
    const { name, value, files } = e.target;
    const updatedFormats = [...formats];
    updatedFormats[index][name] = files ? files[0] : value;
    setFormats(updatedFormats);
  };

  const addFormat = () => {
    setFormats([...formats, { ...formats[0] }]);
  };

  const uploadFile = async (bucket, file) => {
    const filename = `${uuidv4()}_${file.name}`;
    const { error } = await supabase.storage.from(bucket).upload(filename, file);
    if (error) throw error;
    const { data } = supabase.storage.from(bucket).getPublicUrl(filename);
    return data.publicUrl;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      let imageUrl = null;
      if (course.image) {
        imageUrl = await uploadFile("courses", course.image);
      }

      const { data: courseInserted, error: courseError } = await supabase
        .from("courses")
        .insert({
          nom: course.nom,
          lieu: course.lieu,
          departement: course.departement,
          presentation: course.presentation,
          image_url: imageUrl,
          organisateur_id: user.id
        })
        .select()
        .single();

      if (courseError) throw courseError;

      for (const f of formats) {
        const image_url = f.image ? await uploadFile("formats", f.image) : null;
        const gpx_url = f.gpx ? await uploadFile("formats", f.gpx) : null;
        const reglement_pdf_url = f.reglement_pdf ? await uploadFile("reglements", f.reglement_pdf) : null;

        await supabase.from("formats").insert({
          course_id: courseInserted.id,
          nom: f.nom,
          image_url,
          date: f.date,
          heure_depart: f.heure_depart,
          presentation_parcours: f.presentation_parcours,
          gpx_url,
          type_epreuve: f.type_epreuve,
          distance_km: f.distance_km,
          denivele_dplus: f.denivele_dplus,
          denivele_dmoins: f.denivele_dmoins,
          adresse_depart: f.adresse_depart,
          adresse_arrivee: f.adresse_arrivee,
          prix: f.prix,
          ravitaillements: f.ravitaillements,
          remise_dossards: f.remise_dossards,
          dotation: f.dotation,
          reglement_pdf_url,
          nb_max_coureurs: f.nb_max_coureurs,
          age_minimum: f.age_minimum,
          hebergements: f.hebergements
        });
      }

      alert("Épreuve créée !");
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la création");
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Nouvelle épreuve</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <input type="text" name="nom" placeholder="Nom de l’épreuve" value={course.nom} onChange={handleCourseChange} className="border p-2 w-full" />
        <input type="text" name="lieu" placeholder="Lieu" value={course.lieu} onChange={handleCourseChange} className="border p-2 w-full" />
        <input type="text" name="departement" placeholder="Département" value={course.departement} onChange={handleCourseChange} className="border p-2 w-full" />
        <textarea name="presentation" placeholder="Présentation" value={course.presentation} onChange={handleCourseChange} className="border p-2 w-full" />
        <input type="file" name="image" onChange={handleCourseChange} className="border p-2 w-full" />

        {formats.map((f, i) => (
          <div key={i} className="border p-4 mt-6 space-y-4 bg-gray-100">
            <h2 className="font-bold">Format {i + 1}</h2>
            <input type="text" name="nom" placeholder="Nom du format" value={f.nom} onChange={(e) => handleFormatChange(i, e)} className="border p-2 w-full" />
            <input type="file" name="image" onChange={(e) => handleFormatChange(i, e)} className="border p-2 w-full" />
            <input type="date" name="date" value={f.date} onChange={(e) => handleFormatChange(i, e)} className="border p-2 w-full" />
            <input type="time" name="heure_depart" value={f.heure_depart} onChange={(e) => handleFormatChange(i, e)} className="border p-2 w-full" />
            <textarea name="presentation_parcours" placeholder="Présentation parcours" value={f.presentation_parcours} onChange={(e) => handleFormatChange(i, e)} className="border p-2 w-full" />
            <input type="file" name="gpx" onChange={(e) => handleFormatChange(i, e)} className="border p-2 w-full" />
            <select name="type_epreuve" value={f.type_epreuve} onChange={(e) => handleFormatChange(i, e)} className="border p-2 w-full">
              <option value="trail">Trail</option>
              <option value="rando">Rando</option>
              <option value="route">Course sur route</option>
            </select>
            <input type="number" name="distance_km" placeholder="Distance (km)" value={f.distance_km} onChange={(e) => handleFormatChange(i, e)} className="border p-2 w-full" />
            <input type="number" name="denivele_dplus" placeholder="D+" value={f.denivele_dplus} onChange={(e) => handleFormatChange(i, e)} className="border p-2 w-full" />
            <input type="number" name="denivele_dmoins" placeholder="D-" value={f.denivele_dmoins} onChange={(e) => handleFormatChange(i, e)} className="border p-2 w-full" />
            <input type="text" name="adresse_depart" placeholder="Adresse départ" value={f.adresse_depart} onChange={(e) => handleFormatChange(i, e)} className="border p-2 w-full" />
            <input type="text" name="adresse_arrivee" placeholder="Adresse arrivée" value={f.adresse_arrivee} onChange={(e) => handleFormatChange(i, e)} className="border p-2 w-full" />
            <input type="number" name="prix" placeholder="Prix" value={f.prix} onChange={(e) => handleFormatChange(i, e)} className="border p-2 w-full" />
            <input type="text" name="ravitaillements" placeholder="Ravitaillements" value={f.ravitaillements} onChange={(e) => handleFormatChange(i, e)} className="border p-2 w-full" />
            <input type="text" name="remise_dossards" placeholder="Remise des dossards" value={f.remise_dossards} onChange={(e) => handleFormatChange(i, e)} className="border p-2 w-full" />
            <input type="text" name="dotation" placeholder="Dotation" value={f.dotation} onChange={(e) => handleFormatChange(i, e)} className="border p-2 w-full" />
            <input type="file" name="reglement_pdf" onChange={(e) => handleFormatChange(i, e)} className="border p-2 w-full" />
            <input type="number" name="nb_max_coureurs" placeholder="Nombre max coureurs" value={f.nb_max_coureurs} onChange={(e) => handleFormatChange(i, e)} className="border p-2 w-full" />
            <input type="number" name="age_minimum" placeholder="Âge minimum" value={f.age_minimum} onChange={(e) => handleFormatChange(i, e)} className="border p-2 w-full" />
            <input type="text" name="hebergements" placeholder="Hébergements" value={f.hebergements} onChange={(e) => handleFormatChange(i, e)} className="border p-2 w-full" />
          </div>
        ))}

        <button type="button" onClick={addFormat} className="bg-blue-600 text-white px-4 py-2 rounded">+ Ajouter un format</button>
        <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded">Créer l’épreuve</button>
      </form>
    </div>
  );
}
