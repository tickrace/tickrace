import React, { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { useNavigate } from "react-router-dom";

export default function NouvelleCourse() {
  const [nom, setNom] = useState("");
  const [sousNom, setSousNom] = useState("");
  const [type, setType] = useState("");
  const [lieu, setLieu] = useState("");
  const [date, setDate] = useState("");
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

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        navigate("/organisateur/login");
      }
    };
    checkAuth();
  }, [navigate]);

  const handleFormatChange = (index, field, value) => {
    const newFormats = [...formats];
    newFormats[index][field] = value;
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
        heure_depart: "",
        prix: "",
        gpx_url: "",
      },
    ]);
  };

  const removeFormat = (index) => {
    if (formats.length > 1) {
      setFormats(formats.filter((_, i) => i !== index));
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("⏳ Enregistrement…");

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      setMessage("❌ Utilisateur non authentifié.");
      return;
    }

    let imageUrl = null;
    if (imageFile) {
      const fileExt = imageFile.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `courses/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(filePath, imageFile);

      if (uploadError) {
        setMessage("❌ Échec de l'upload d'image.");
        return;
      }

      const { data: urlData } = supabase.storage
        .from("images")
        .getPublicUrl(filePath);

      imageUrl = urlData?.publicUrl;
    }

    const { data: courseData, error: courseError } = await supabase
      .from("courses")
      .insert({
        organisateur_id: user.id,
        nom,
        sous_nom: sousNom,
        type_epreuve: type,
        lieu,
        date,
        image_url: imageUrl,
      })
      .select()
      .single();

    if (courseError) {
      setMessage("❌ Erreur lors de l'enregistrement de la course.");
      return;
    }

    const eventId = courseData.id;

    const formattedFormats = formats.map((f) => ({
      ...f,
      event_id: eventId,
    }));

    const { error: formatsError } = await supabase
      .from("formats")
      .insert(formattedFormats);

    if (formatsError) {
      setMessage("❌ Erreur lors de l'enregistrement des formats.");
      return;
    }

    setMessage("✅ Épreuve créée !");
    navigate("/organisateur/espace");
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Nouvelle épreuve</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Nom"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          required
          className="w-full border px-3 py-2 rounded"
        />
        <input
          type="text"
          placeholder="Sous-titre"
          value={sousNom}
          onChange={(e) => setSousNom(e.target.value)}
          className="w-full border px-3 py-2 rounded"
        />
        <input
          type="text"
          placeholder="Type (trail, skyrunning, etc)"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full border px-3 py-2 rounded"
        />
        <input
          type="text"
          placeholder="Lieu"
          value={lieu}
          onChange={(e) => setLieu(e.target.value)}
          required
          className="w-full border px-3 py-2 rounded"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="w-full border px-3 py-2 rounded"
        />

        <label className="block mt-4 text-sm font-medium">Image d’illustration</label>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          className="w-full"
        />
        {imagePreview && (
          <img src={imagePreview} alt="Preview" className="h-32 object-cover mt-2" />
        )}

        <h2 className="text-xl font-semibold mt-6 mb-2">Formats</h2>
        {formats.map((format, index) => (
          <div key={index} className="space-y-2 border p-4 rounded mb-4 bg-gray-50">
            <input
              type="text"
              placeholder="Nom du format"
              value={format.nom}
              onChange={(e) =>
                handleFormatChange(index, "nom", e.target.value)
              }
              className="w-full border px-3 py-2 rounded"
            />
            <input
              type="number"
              placeholder="Distance (km)"
              value={format.distance_km}
              onChange={(e) =>
                handleFormatChange(index, "distance_km", e.target.value)
              }
              className="w-full border px-3 py-2 rounded"
            />
            <input
              type="number"
              placeholder="D+"
              value={format.denivele_dplus}
              onChange={(e) =>
                handleFormatChange(index, "denivele_dplus", e.target.value)
              }
              className="w-full border px-3 py-2 rounded"
            />
            <input
              type="number"
              placeholder="D-"
              value={format.denivele_dmoins}
              onChange={(e) =>
                handleFormatChange(index, "denivele_dmoins", e.target.value)
              }
              className="w-full border px-3 py-2 rounded"
            />
            <input
              type="time"
              placeholder="Heure de départ"
              value={format.heure_depart}
              onChange={(e) =>
                handleFormatChange(index, "heure_depart", e.target.value)
              }
              className="w-full border px-3 py-2 rounded"
            />
            <input
              type="number"
              placeholder="Prix (€)"
              value={format.prix}
              onChange={(e) =>
                handleFormatChange(index, "prix", e.target.value)
              }
              className="w-full border px-3 py-2 rounded"
            />
            <input
              type="url"
              placeholder="Lien GPX"
              value={format.gpx_url}
              onChange={(e) =>
                handleFormatChange(index, "gpx_url", e.target.value)
              }
              className="w-full border px-3 py-2 rounded"
            />
            {formats.length > 1 && (
              <button
                type="button"
                onClick={() => removeFormat(index)}
                className="text-red-600 text-sm mt-1"
              >
                Supprimer ce format
              </button>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={addFormat}
          className="bg-gray-200 px-4 py-2 rounded"
        >
          + Ajouter un format
        </button>

        <button type="submit" className="bg-black text-white px-4 py-2 rounded">
          Enregistrer
        </button>
        {message && <p className="mt-2 text-sm">{message}</p>}
      </form>
    </div>
  );
}
