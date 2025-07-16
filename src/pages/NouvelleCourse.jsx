// src/pages/NouvelleCourse.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { useNavigate } from "react-router-dom";

export default function NouvelleCourse() {
  const [nom, setNom] = useState("");
  const [sousNom, setSousNom] = useState("");
  const [lieu, setLieu] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [formats, setFormats] = useState([
    {
      nom: "",
      distance_km: "",
      denivele_dplus: "",
      denivele_dmoins: "",
      heure_depart: "",
      prix: "",
      gpx_url: "",
    },
  ]);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleFormatChange = (index, field, value) => {
    const updatedFormats = [...formats];
    updatedFormats[index][field] = value;
    setFormats(updatedFormats);
  };

  const addFormat = () => {
    setFormats([
      ...formats,
      {
        nom: "",
        distance_km: "",
        denivele_dplus: "",
        denivele_dmoins: "",
        heure_depart: "",
        prix: "",
        gpx_url: "",
      },
    ]);
  };

  const removeFormat = (index) => {
    const updatedFormats = formats.filter((_, i) => i !== index);
    setFormats(updatedFormats);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("Enregistrement...");

    let imageUrl = null;

    if (imageFile) {
      const { data, error } = await supabase.storage
        .from("courses")
        .upload(`course-${Date.now()}`, imageFile);

      if (error) {
        setMessage("Erreur lors de l'upload de l’image.");
        return;
      }

      const { data: urlData } = supabase.storage
        .from("courses")
        .getPublicUrl(data.path);

      imageUrl = urlData.publicUrl;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Vous devez être connecté.");
      return;
    }

    const { data: courseData, error: courseError } = await supabase
      .from("courses")
      .insert([
        {
          nom,
          sous_nom: sousNom,
          lieu,
          date,
          type_epreuve: type,
          image_url: imageUrl,
          organisateur_id: user.id,
        },
      ])
      .select()
      .single();

    if (courseError) {
      console.error(courseError);
      setMessage("Erreur lors de l’enregistrement de la course.");
      return;
    }

    const formatsWithCourse = formats.map((f) => ({
      ...f,
      event_id: courseData.id,
    }));

    const { error: formatError } = await supabase.from("formats").insert(formatsWithCourse);

    if (formatError) {
      console.error(formatError);
      setMessage("Course enregistrée, mais erreur lors de l’enregistrement des formats.");
    } else {
      setMessage("Course et formats enregistrés avec succès !");
      navigate("/organisateur/espace");
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Nouvelle course</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block font-medium">Nom de l’épreuve</label>
          <input type="text" value={nom} onChange={(e) => setNom(e.target.value)} className="w-full border p-2 rounded" required />
        </div>

        <div>
          <label className="block font-medium">Sous-nom</label>
          <input type="text" value={sousNom} onChange={(e) => setSousNom(e.target.value)} className="w-full border p-2 rounded" />
        </div>

        <div>
          <label className="block font-medium">Lieu</label>
          <input type="text" value={lieu} onChange={(e) => setLieu(e.target.value)} className="w-full border p-2 rounded" required />
        </div>

        <div>
          <label className="block font-medium">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border p-2 rounded" required />
        </div>

        <div>
          <label className="block font-medium">Type d’épreuve</label>
          <input type="text" value={type} onChange={(e) => setType(e.target.value)} className="w-full border p-2 rounded" />
        </div>

        <div>
          <label className="block font-medium">Image (JPG/PNG)</label>
          <input type="file" accept="image/*" onChange={handleImageChange} className="w-full" />
          {imagePreview && <img src={imagePreview} alt="Prévisualisation" className="mt-2 h-32 object-cover rounded" />}
        </div>

        <hr className="my-4" />
        <h2 className="text-xl font-semibold mb-2">Formats de course</h2>

        {formats.map((format, index) => (
          <div key={index} className="border p-4 rounded mb-4 space-y-2 bg-gray-50">
            <input type="text" placeholder="Nom du format" value={format.nom} onChange={(e) => handleFormatChange(index, "nom", e.target.value)} className="w-full border p-2 rounded" required />
            <input type="number" placeholder="Distance (km)" value={format.distance_km} onChange={(e) => handleFormatChange(index, "distance_km", e.target.value)} className="w-full border p-2 rounded" required />
            <input type="number" placeholder="D+ (m)" value={format.denivele_dplus} onChange={(e) => handleFormatChange(index, "denivele_dplus", e.target.value)} className="w-full border p-2 rounded" />
            <input type="number" placeholder="D- (m)" value={format.denivele_dmoins} onChange={(e) => handleFormatChange(index, "denivele_dmoins", e.target.value)} className="w-full border p-2 rounded" />
            <input type="time" placeholder="Heure départ" value={format.heure_depart} onChange={(e) => handleFormatChange(index, "heure_depart", e.target.value)} className="w-full border p-2 rounded" />
            <input type="number" placeholder="Prix (€)" value={format.prix} onChange={(e) => handleFormatChange(index, "prix", e.target.value)} className="w-full border p-2 rounded" />
            <input type="text" placeholder="Lien GPX (URL)" value={format.gpx_url} onChange={(e) => handleFormatChange(index, "gpx_url", e.target.value)} className="w-full border p-2 rounded" />
            {formats.length > 1 && (
              <button type="button" onClick={() => removeFormat(index)} className="text-red-600 underline">Supprimer ce format</button>
            )}
          </div>
        ))}

        <button type="button" onClick={addFormat} className="bg-gray-200 px-4 py-2 rounded">+ Ajouter un format</button>

        <div>
          <button type="submit" className="bg-black text-white px-6 py-2 rounded">Enregistrer</button>
        </div>

        {message && <p className="mt-4 text-sm">{message}</p>}
      </form>
    </div>
  );
}
