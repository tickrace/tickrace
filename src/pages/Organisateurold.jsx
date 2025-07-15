import React, { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function Organisateur() {
  const [nom, setNom] = useState("");
  const [sousNom, setSousNom] = useState("");
  const [lieu, setLieu] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [formats, setFormats] = useState([
    { nom: "", distance_km: "", denivele_dplus: "", denivele_dmoins: "", cote_itra: "", heure_depart: "", prix: "", gpx_url: "" },
  ]);
  const [message, setMessage] = useState("");
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
      }
    });
  }, []);

  const handleFormatChange = (index, field, value) => {
    const newFormats = [...formats];
    newFormats[index][field] = value;
    setFormats(newFormats);
  };

  const addFormat = () => {
    setFormats([...formats, { nom: "", distance_km: "", denivele_dplus: "", denivele_dmoins: "", cote_itra: "", heure_depart: "", prix: "", gpx_url: "" }]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("⏳ Enregistrement...");

    let imageUrl = "";
    if (imageFile) {
      const fileExt = imageFile.name.split(".").pop();
      const filePath = `courses/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("courses")
        .upload(filePath, imageFile);

      if (uploadError) {
        setMessage("❌ Erreur lors de l'upload de l'image.");
        return;
      }

      const { data: urlData } = supabase.storage.from("courses").getPublicUrl(filePath);
      imageUrl = urlData.publicUrl;
    }

    const { data: eventData, error: insertError } = await supabase
      .from("courses")
      .insert([
        {
          nom,
          sous_nom: sousNom,
          lieu,
          date,
          type,
          image_url: imageUrl,
          organisateur_id: userId,
        },
      ])
      .select()
      .single();

    if (insertError) {
      setMessage("❌ Erreur lors de l'enregistrement.");
      return;
    }

    // Enregistrer les formats liés
    const formatsToInsert = formats.map((f) => ({
      ...f,
      event_id: eventData.id,
    }));

    const { error: formatError } = await supabase.from("formats").insert(formatsToInsert);
    if (formatError) {
      setMessage("❌ Erreur lors de l'ajout des formats.");
      return;
    }

    setMessage("✅ Course et formats enregistrés !");
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Espace Organisateur</h1>
      <p className="mb-6">Créez et gérez vos courses.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="text" placeholder="Nom de l'épreuve" value={nom} onChange={(e) => setNom(e.target.value)} className="w-full border px-3 py-2 rounded" required />
        <input type="text" placeholder="Sous-titre (ex: édition 2025, trail nocturne…)" value={sousNom} onChange={(e) => setSousNom(e.target.value)} className="w-full border px-3 py-2 rounded" />
        <input type="text" placeholder="Lieu" value={lieu} onChange={(e) => setLieu(e.target.value)} className="w-full border px-3 py-2 rounded" required />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border px-3 py-2 rounded" required />
        <input type="text" placeholder="Type d'épreuve (trail, KV, etc.)" value={type} onChange={(e) => setType(e.target.value)} className="w-full border px-3 py-2 rounded" />
        <input type="file" onChange={(e) => setImageFile(e.target.files[0])} className="w-full" />

        <h2 className="text-lg font-semibold mt-6">Formats proposés</h2>
        {formats.map((format, index) => (
          <div key={index} className="border p-4 rounded mb-4">
            <input type="text" placeholder="Nom du format (ex: Trail 32 km)" value={format.nom} onChange={(e) => handleFormatChange(index, "nom", e.target.value)} className="w-full mb-2 border px-2 py-1 rounded" />
            <input type="number" placeholder="Distance (km)" value={format.distance_km} onChange={(e) => handleFormatChange(index, "distance_km", e.target.value)} className="w-full mb-2 border px-2 py-1 rounded" />
            <input type="number" placeholder="D+ (m)" value={format.denivele_dplus} onChange={(e) => handleFormatChange(index, "denivele_dplus", e.target.value)} className="w-full mb-2 border px-2 py-1 rounded" />
            <input type="number" placeholder="D- (m)" value={format.denivele_dmoins} onChange={(e) => handleFormatChange(index, "denivele_dmoins", e.target.value)} className="w-full mb-2 border px-2 py-1 rounded" />
            <input type="number" placeholder="Cote ITRA (optionnelle)" value={format.cote_itra} onChange={(e) => handleFormatChange(index, "cote_itra", e.target.value)} className="w-full mb-2 border px-2 py-1 rounded" />
            <input type="text" placeholder="Heure de départ" value={format.heure_depart} onChange={(e) => handleFormatChange(index, "heure_depart", e.target.value)} className="w-full mb-2 border px-2 py-1 rounded" />
            <input type="number" placeholder="Prix (€)" value={format.prix} onChange={(e) => handleFormatChange(index, "prix", e.target.value)} className="w-full mb-2 border px-2 py-1 rounded" />
            <input type="text" placeholder="Lien GPX (optionnel)" value={format.gpx_url} onChange={(e) => handleFormatChange(index, "gpx_url", e.target.value)} className="w-full mb-2 border px-2 py-1 rounded" />
          </div>
        ))}
        <button type="button" onClick={addFormat} className="bg-gray-200 px-3 py-1 rounded">+ Ajouter un format</button>

        <button type="submit" className="bg-black text-white px-4 py-2 rounded">Enregistrer</button>
        {message && <p className="mt-2">{message}</p>}
      </form>
    </div>
  );
}
