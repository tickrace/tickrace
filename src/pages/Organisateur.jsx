import React, { useState } from "react";
import { supabase } from "../supabase";

export default function Organisateur() {
  const [nom, setNom] = useState("");
  const [lieu, setLieu] = useState("");
  const [date, setDate] = useState("");
  const [distance, setDistance] = useState("");
  const [denivele, setDenivele] = useState("");
  const [deniveleMoins, setDeniveleMoins] = useState("");
  const [coteITRA, setCoteITRA] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [message, setMessage] = useState("");

  const handleImageUpload = async () => {
    if (!imageFile) return null;

    const fileName = `${Date.now()}.jpg`;
    const { data, error } = await supabase.storage
      .from("courses")
      .upload(`courses/${fileName}`, imageFile);

    if (error) {
      console.error("Erreur upload image :", error.message);
      setMessage("❌ Erreur lors de l'upload de l'image.");
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from("courses")
      .getPublicUrl(`courses/${fileName}`);

    return publicUrlData.publicUrl;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("⏳ Enregistrement...");

    const imageUrl = await handleImageUpload();

    const { error } = await supabase.from("courses").insert([
      {
        nom,
        lieu,
        date,
        distance_km: parseFloat(distance),
        denivele_dplus: parseFloat(denivele),
        denivele_dmoins: parseFloat(deniveleMoins),
        cote_itra: parseFloat(coteITRA),
        image_url: imageUrl,
      },
    ]);

    if (error) {
      console.error("Erreur insertion :", error.message);
      setMessage("❌ Erreur lors de l'enregistrement.");
    } else {
      setMessage("✅ Épreuve enregistrée avec succès !");
      // Réinitialiser les champs
      setNom("");
      setLieu("");
      setDate("");
      setDistance("");
      setDenivele("");
      setDeniveleMoins("");
      setCoteITRA("");
      setImageFile(null);
    }
  };

  return (
    <div>
      <h1>Espace Organisateur</h1>
      <p>Créez et gérez vos courses.</p>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Nom de la course"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Lieu"
          value={lieu}
          onChange={(e) => setLieu(e.target.value)}
          required
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <input
          type="number"
          placeholder="Distance (km)"
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
          required
        />
        <input
          type="number"
          placeholder="D+ (m)"
          value={denivele}
          onChange={(e) => setDenivele(e.target.value)}
          required
        />
        <input
          type="number"
          placeholder="D- (m)"
          value={deniveleMoins}
          onChange={(e) => setDeniveleMoins(e.target.value)}
          required
        />
        <input
          type="number"
          placeholder="Côte ITRA"
          value={coteITRA}
          onChange={(e) => setCoteITRA(e.target.value)}
          required
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files[0])}
        />
        <button type="submit">Enregistrer</button>
      </form>
      <p>{message}</p>
    </div>
  );
}
