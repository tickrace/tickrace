import React, { useState } from "react";
import { supabase } from "../supabase";
import { useNavigate } from "react-router-dom";

export default function NouvelleCourse() {
  const [nom, setNom] = useState("");
  const [sousNom, setSousNom] = useState("");
  const [type, setType] = useState("");
  const [lieu, setLieu] = useState("");
  const [date, setDate] = useState("");
  const [prix, setPrix] = useState("");
  const [formats, setFormats] = useState([
    { nom: "", distance_km: "", denivele_dplus: "", denivele_dmoins: "", heure_depart: "", gpx_url: "", prix: "" },
  ]);
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setImage(file);
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
      { nom: "", distance_km: "", denivele_dplus: "", denivele_dmoins: "", heure_depart: "", gpx_url: "", prix: "" },
    ]);
  };

  const removeFormat = (index) => {
    const updated = formats.filter((_, i) => i !== index);
    setFormats(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Vérifier si l'utilisateur est connecté
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Veuillez vous connecter pour créer une épreuve.");
      return;
    }

    let image_url = null;

    // Upload image
    if (image) {
      const fileExt = image.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("course-images")
        .upload(fileName, image);

      if (uploadError) {
        setError("Échec de l'upload de l'image");
        return;
      }

      const { data: urlData } = supabase.storage
        .from("course-images")
        .getPublicUrl(uploadData.path);
      image_url = urlData.publicUrl;
    }

    // Insérer la course
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .insert([
        {
          nom,
          sous_nom: sousNom,
          type_epreuve: type,
          lieu,
          date,
          prix,
          image_url,
          organisateur_id: user.id,
        },
      ])
      .select()
      .single();

    if (courseError) {
      setError("Erreur lors de l’enregistrement de la course");
      return;
    }

    // Insérer les formats
    for (let format of formats) {
      const { error: formatError } = await supabase.from("formats").insert([
        {
          ...format,
          event_id: course.id,
        },
      ]);
      if (formatError) {
        setError("Erreur lors de l’ajout des formats.");
        return;
      }
    }

    navigate("/organisateur/espace");
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Créer une nouvelle épreuve</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <input type="text" placeholder="Nom de l’épreuve" value={nom} onChange={(e) => setNom(e.target.value)} required className="w-full border px-3 py-2" />
        <input type="text" placeholder="Sous-titre (facultatif)" value={sousNom} onChange={(e) => setSousNom(e.target.value)} className="w-full border px-3 py-2" />
        <input type="text" placeholder="Type (trail, route...)" value={type} onChange={(e) => setType(e.target.value)} required className="w-full border px-3 py-2" />
        <input type="text" placeholder="Lieu" value={lieu} onChange={(e) => setLieu(e.target.value)} required className="w-full border px-3 py-2" />
        <input type="date" placeholder="Date" value={date} onChange={(e) => setDate(e.target.value)} required className="w-full border px-3 py-2" />
        <input type="number" placeholder="Prix global (€)" value={prix} onChange={(e) => setPrix(e.target.value)} className="w-full border px-3 py-2" />

        <div>
          <label className="block mb-1">Image de l’épreuve</label>
          <input type="file" accept="image/*" onChange={handleImageChange} className="mb-2" />
          {imagePreview && <img src={imagePreview} alt="Prévisualisation" className="w-full max-w-sm mb-4" />}
        </div>

        <h2 className="text-xl font-semibold mt-8 mb-4">Formats</h2>
        {formats.map((format, index) => (
          <div key={index} className="border p-4 mb-4 rounded space-y-2">
            <input type="text" placeholder="Nom du format" value={format.nom} onChange={(e) => handleFormatChange(index, "nom", e.target.value)} className="w-full border px-3 py-2" />
            <input type="number" placeholder="Distance (km)" value={format.distance_km} onChange={(e) => handleFormatChange(index, "distance_km", e.target.value)} className="w-full border px-3 py-2" />
            <input type="number" placeholder="D+ (m)" value={format.denivele_dplus} onChange={(e) => handleFormatChange(index, "denivele_dplus", e.target.value)} className="w-full border px-3 py-2" />
            <input type="number" placeholder="D- (m)" value={format.denivele_dmoins} onChange={(e) => handleFormatChange(index, "denivele_dmoins", e.target.value)} className="w-full border px-3 py-2" />
            <input type="time" placeholder="Heure de départ" value={format.heure_depart} onChange={(e) => handleFormatChange(index, "heure_depart", e.target.value)} className="w-full border px-3 py-2" />
            <input type="text" placeholder="Lien GPX" value={format.gpx_url} onChange={(e) => handleFormatChange(index, "gpx_url", e.target.value)} className="w-full border px-3 py-2" />
            <input type="number" placeholder="Prix (€)" value={format.prix} onChange={(e) => handleFormatChange(index, "prix", e.target.value)} className="w-full border px-3 py-2" />
            {formats.length > 1 && (
              <button type="button" onClick={() => removeFormat(index)} className="text-red-600 text-sm mt-2">🗑 Supprimer ce format</button>
            )}
          </div>
        ))}

        <button type="button" onClick={addFormat} className="bg-gray-100 px-4 py-2 rounded border">+ Ajouter un format</button>

        {error && <p className="text-red-600">{error}</p>}

        <button type="submit" className="bg-black text-white px-6 py-3 rounded">Enregistrer l’épreuve</button>
      </form>
    </div>
  );
}
