// src/pages/ModifierCourse.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

export default function ModifierCourse() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    const fetchCourse = async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Erreur chargement course :", error.message);
      } else {
        setCourse(data);
        setPreviewUrl(data.image_url || null);
      }

      const { data: formatData } = await supabase
        .from("formats")
        .select("*")
        .eq("event_id", id);

      setFormats(formatData || []);
      setLoading(false);
    };

    fetchCourse();
  }, [id]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleFormatChange = (index, field, value) => {
    const newFormats = [...formats];
    newFormats[index][field] = value;
    setFormats(newFormats);
  };

  const handleAddFormat = () => {
    setFormats([
      ...formats,
      {
        nom: "",
        distance_km: "",
        denivele_dplus: "",
        denivele_dmoins: "",
        prix: "",
        heure_depart: "",
        event_id: id,
      },
    ]);
  };

  const handleSave = async () => {
    let imageUrl = course.image_url;

    if (imageFile) {
      const fileExt = imageFile.name.split(".").pop();
      const fileName = `${Date.now()}_${imageFile.name}`;
      const filePath = `courses/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("courses")
        .upload(filePath, imageFile);

      if (uploadError) {
        console.error("Erreur upload image :", uploadError.message);
        return;
      }

      const { data } = supabase.storage.from("courses").getPublicUrl(filePath);
      imageUrl = data.publicUrl;
    }

    const { error: updateError } = await supabase
      .from("courses")
      .update({ ...course, image_url: imageUrl })
      .eq("id", id);

    if (updateError) {
      console.error("Erreur update course :", updateError.message);
      return;
    }

    for (const format of formats) {
      if (format.id) {
        await supabase.from("formats").update(format).eq("id", format.id);
      } else {
        await supabase.from("formats").insert({ ...format, event_id: id });
      }
    }

    navigate("/organisateur/espace");
  };

  if (loading) return <p className="p-6">Chargement...</p>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Modifier l’épreuve</h2>

      <div className="space-y-4">
        <input
          type="text"
          placeholder="Nom"
          className="w-full border p-2 rounded"
          value={course.nom}
          onChange={(e) => setCourse({ ...course, nom: e.target.value })}
        />
        <input
          type="text"
          placeholder="Sous-nom"
          className="w-full border p-2 rounded"
          value={course.sous_nom}
          onChange={(e) => setCourse({ ...course, sous_nom: e.target.value })}
        />
        <input
          type="text"
          placeholder="Lieu"
          className="w-full border p-2 rounded"
          value={course.lieu}
          onChange={(e) => setCourse({ ...course, lieu: e.target.value })}
        />
        <input
          type="date"
          className="w-full border p-2 rounded"
          value={course.date}
          onChange={(e) => setCourse({ ...course, date: e.target.value })}
        />
        <input
          type="text"
          placeholder="Type d’épreuve"
          className="w-full border p-2 rounded"
          value={course.type_epreuve}
          onChange={(e) => setCourse({ ...course, type_epreuve: e.target.value })}
        />

        <div>
          <label className="block mb-1">Image</label>
          <input type="file" accept="image/*" onChange={handleImageChange} />
          {previewUrl && <img src={previewUrl} alt="preview" className="w-48 mt-2" />}
        </div>

        <h3 className="text-xl font-semibold mt-6 mb-2">Formats</h3>
        {formats.map((format, index) => (
          <div key={index} className="border p-3 mb-3 rounded space-y-2">
            <input
              type="text"
              placeholder="Nom"
              className="w-full border p-2 rounded"
              value={format.nom}
              onChange={(e) => handleFormatChange(index, "nom", e.target.value)}
            />
            <input
              type="number"
              placeholder="Distance (km)"
              className="w-full border p-2 rounded"
              value={format.distance_km}
              onChange={(e) => handleFormatChange(index, "distance_km", e.target.value)}
            />
            <input
              type="number"
              placeholder="D+"
              className="w-full border p-2 rounded"
              value={format.denivele_dplus}
              onChange={(e) => handleFormatChange(index, "denivele_dplus", e.target.value)}
            />
            <input
              type="number"
              placeholder="D-"
              className="w-full border p-2 rounded"
              value={format.denivele_dmoins}
              onChange={(e) => handleFormatChange(index, "denivele_dmoins", e.target.value)}
            />
            <input
              type="text"
              placeholder="Heure départ"
              className="w-full border p-2 rounded"
              value={format.heure_depart}
              onChange={(e) => handleFormatChange(index, "heure_depart", e.target.value)}
            />
            <input
              type="number"
              placeholder="Prix (€)"
              className="w-full border p-2 rounded"
              value={format.prix}
              onChange={(e) => handleFormatChange(index, "prix", e.target.value)}
            />
          </div>
        ))}
        <button
          onClick={handleAddFormat}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          + Ajouter un format
        </button>

        <button
          onClick={handleSave}
          className="mt-6 bg-black text-white px-6 py-2 rounded"
        >
          Enregistrer les modifications
        </button>
      </div>
    </div>
  );
}
