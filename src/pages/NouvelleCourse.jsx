import React, { useState } from "react";
import { supabase } from "../supabase";
import { useNavigate } from "react-router-dom";

export default function NouvelleCourse() {
  const [nom, setNom] = useState("");
  const [sousNom, setSousNom] = useState("");
  const [lieu, setLieu] = useState("");
  const [date, setDate] = useState("");
  const [typeEpreuve, setTypeEpreuve] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [formats, setFormats] = useState([
    { nom: "", distance_km: "", denivele_dplus: "", denivele_dmoins: "", prix: "", heure_depart: "" },
  ]);
  const [message, setMessage] = useState(null);
  const navigate = useNavigate();

  const handleAddFormat = () => {
    setFormats([
      ...formats,
      { nom: "", distance_km: "", denivele_dplus: "", denivele_dmoins: "", prix: "", heure_depart: "" },
    ]);
  };

  const handleFormatChange = (index, field, value) => {
    const updatedFormats = [...formats];
    updatedFormats[index][field] = value;
    setFormats(updatedFormats);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setImageFile(file);
    if (file) {
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage({ type: "error", text: "Vous devez être connecté pour créer une course." });
      return;
    }

    let imageUrl = null;

    if (imageFile) {
      const fileExt = imageFile.name.split(".").pop();
      const fileName = `${Date.now()}_${imageFile.name}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("courses")
        .upload(filePath, imageFile);

      if (uploadError) {
        setMessage({ type: "error", text: "Erreur lors de l’upload de l’image." });
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("courses")
        .getPublicUrl(filePath);

      imageUrl = publicUrlData.publicUrl;
    }

    const { data: course, error: courseError } = await supabase
      .from("courses")
      .insert([
        {
          nom,
          sous_nom: sousNom,
          lieu,
          date,
          type_epreuve: typeEpreuve,
          image_url: imageUrl,
          organisateur_id: user.id,
        },
      ])
      .select()
      .single();

    if (courseError) {
      setMessage({ type: "error", text: "Erreur lors de l’enregistrement de la course." });
      return;
    }

    const formatsToInsert = formats.map((f) => ({
      ...f,
      event_id: course.id,
      image_url: imageUrl,
    }));

    const { error: formatError } = await supabase.from("formats").insert(formatsToInsert);

    if (formatError) {
      setMessage({ type: "error", text: "Erreur lors de l’enregistrement des formats." });
      return;
    }

    setMessage({ type: "success", text: "Épreuve créée avec succès." });
    navigate("/organisateur/espace");
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Nouvelle course</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="text" placeholder="Nom de l’épreuve" value={nom} onChange={(e) => setNom(e.target.value)} className="w-full border p-2 rounded" required />
        <input type="text" placeholder="Sous-nom" value={sousNom} onChange={(e) => setSousNom(e.target.value)} className="w-full border p-2 rounded" />
        <input type="text" placeholder="Lieu" value={lieu} onChange={(e) => setLieu(e.target.value)} className="w-full border p-2 rounded" required />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border p-2 rounded" required />
        <input type="text" placeholder="Type d’épreuve" value={typeEpreuve} onChange={(e) => setTypeEpreuve(e.target.value)} className="w-full border p-2 rounded" />

        <label className="block">
          Image (JPG/PNG)
          <input type="file" accept="image/*" onChange={handleImageChange} className="mt-1" />
        </label>

        {imagePreview && (
          <div className="mt-2">
            <img src={imagePreview} alt="Prévisualisation" className="max-w-xs rounded" />
          </div>
        )}

        <h2 className="text-lg font-semibold mt-6">Formats</h2>
        {formats.map((format, index) => (
          <div key={index} className="border p-4 rounded space-y-2 bg-gray-50 mt-2">
            <input type="text" placeholder="Nom du format" value={format.nom} onChange={(e) => handleFormatChange(index, "nom", e.target.value)} className="w-full border p-2 rounded" required />
            <input type="number" step="0.1" placeholder="Distance (km)" value={format.distance_km} onChange={(e) => handleFormatChange(index, "distance_km", e.target.value)} className="w-full border p-2 rounded" />
            <input type="number" placeholder="D+ (m)" value={format.denivele_dplus} onChange={(e) => handleFormatChange(index, "denivele_dplus", e.target.value)} className="w-full border p-2 rounded" />
            <input type="number" placeholder="D- (m)" value={format.denivele_dmoins} onChange={(e) => handleFormatChange(index, "denivele_dmoins", e.target.value)} className="w-full border p-2 rounded" />
            <input type="text" placeholder="Heure départ" value={format.heure_depart} onChange={(e) => handleFormatChange(index, "heure_depart", e.target.value)} className="w-full border p-2 rounded" />
            <input type="number" placeholder="Prix (€)" value={format.prix} onChange={(e) => handleFormatChange(index, "prix", e.target.value)} className="w-full border p-2 rounded" />
          </div>
        ))}
        <button type="button" onClick={handleAddFormat} className="bg-blue-500 text-white px-4 py-2 rounded">
          + Ajouter un format
        </button>

        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">
          Créer l’épreuve
        </button>

        {message && (
          <p className={`mt-4 text-sm ${message.type === "error" ? "text-red-500" : "text-green-600"}`}>
            {message.text}
          </p>
        )}
      </form>
    </div>
  );
}
