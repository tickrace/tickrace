import React, { useState } from "react";
import { supabase } from "../supabase";

export default function Organisateur() {
  const [course, setCourse] = useState({
    nom: "",
    sous_nom: "",
    lieu: "",
    date: "",
    type: "",
    image_url: "",
  });

  const [formats, setFormats] = useState([
    {
      nom: "",
      distance_km: "",
      denivele_dplus: "",
      denivele_dmoins: "",
      cote_itra: "",
      heure_depart: "",
      prix: "",
      gpx_url: ""
    }
  ]);

  const [message, setMessage] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleCourseChange = (e) => {
    setCourse({ ...course, [e.target.name]: e.target.value });
  };

  const handleFormatChange = (index, e) => {
    const newFormats = [...formats];
    newFormats[index][e.target.name] = e.target.value;
    setFormats(newFormats);
  };

  const addFormat = () => {
    setFormats([
      ...formats,
      {
        nom: "",
        distance_km: "",
        denivele_dplus: "",
        denivele_dmoins: "",
        cote_itra: "",
        heure_depart: "",
        prix: "",
        gpx_url: ""
      }
    ]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    // Insertion de la course
    const { data: courseData, error: courseError } = await supabase
      .from("courses")
      .insert([course])
      .select()
      .single();

    if (courseError) {
      setMessage({ type: "error", text: "Erreur lors de l’enregistrement de la course." });
      return;
    }

    // Insertion des formats liés
    const formatsWithEventId = formats.map((f) => ({
      ...f,
      event_id: courseData.id,
    }));

    const { error: formatError } = await supabase
      .from("formats")
      .insert(formatsWithEventId);

    if (formatError) {
      setMessage({ type: "error", text: "Erreur lors de l’enregistrement des formats." });
      return;
    }

    setMessage({ type: "success", text: "Épreuve créée avec succès !" });
    setCourse({ nom: "", sous_nom: "", lieu: "", date: "", type: "", image_url: "" });
    setFormats([formats[0]]);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Créer une nouvelle épreuve</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block">Nom de l’épreuve</label>
          <input type="text" name="nom" value={course.nom} onChange={handleCourseChange} className="w-full border p-2" required />
        </div>
        <div>
          <label className="block">Sous-titre / nom complémentaire</label>
          <input type="text" name="sous_nom" value={course.sous_nom} onChange={handleCourseChange} className="w-full border p-2" />
        </div>
        <div>
          <label className="block">Lieu</label>
          <input type="text" name="lieu" value={course.lieu} onChange={handleCourseChange} className="w-full border p-2" required />
        </div>
        <div>
          <label className="block">Date</label>
          <input type="date" name="date" value={course.date} onChange={handleCourseChange} className="w-full border p-2" required />
        </div>
        <div>
          <label className="block">Type d’épreuve</label>
          <input type="text" name="type" value={course.type} onChange={handleCourseChange} className="w-full border p-2" />
        </div>

        <h2 className="text-xl font-semibold mt-6">Formats de course</h2>
        {formats.map((format, index) => (
          <div key={index} className="border p-4 mb-4">
            <input type="text" name="nom" placeholder="Nom du format" value={format.nom} onChange={(e) => handleFormatChange(index, e)} className="w-full border p-2 mb-2" />
            <input type="number" step="0.1" name="distance_km" placeholder="Distance (km)" value={format.distance_km} onChange={(e) => handleFormatChange(index, e)} className="w-full border p-2 mb-2" />
            <input type="number" name="denivele_dplus" placeholder="D+ (m)" value={format.denivele_dplus} onChange={(e) => handleFormatChange(index, e)} className="w-full border p-2 mb-2" />
            <input type="number" name="denivele_dmoins" placeholder="D- (m)" value={format.denivele_dmoins} onChange={(e) => handleFormatChange(index, e)} className="w-full border p-2 mb-2" />
            <input type="number" name="cote_itra" placeholder="Cote ITRA" value={format.cote_itra} onChange={(e) => handleFormatChange(index, e)} className="w-full border p-2 mb-2" />
            <input type="time" name="heure_depart" placeholder="Heure de départ" value={format.heure_depart} onChange={(e) => handleFormatChange(index, e)} className="w-full border p-2 mb-2" />
            <input type="number" step="0.1" name="prix" placeholder="Prix (€)" value={format.prix} onChange={(e) => handleFormatChange(index, e)} className="w-full border p-2 mb-2" />
            <input type="text" name="gpx_url" placeholder="Lien GPX" value={format.gpx_url} onChange={(e) => handleFormatChange(index, e)} className="w-full border p-2" />
          </div>
        ))}
        <button type="button" onClick={addFormat} className="bg-gray-200 px-3 py-1 rounded">+ Ajouter un format</button>

        <button type="submit" className="bg-black text-white px-4 py-2 rounded">
          Créer l’épreuve
        </button>
        {message && (
          <p className={`mt-2 ${message.type === "error" ? "text-red-500" : "text-green-600"}`}>
            {message.text}
          </p>
        )}
      </form>
    </div>
  );
}
