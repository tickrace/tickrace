import React, { useState } from "react";
import { supabase } from "../supabase";

export default function Organisateur() {
  const [formData, setFormData] = useState({
    nom: "",
    sous_titre: "",
    type: "",
    lieu: "",
    date: "",
    distance_km: "",
    denivele_dplus: "",
    denivele_dmoins: "",
    cote_itra: "",
    prix: "",
    gpx_url: "",
    image: null,
  });

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "image") {
      setFormData({ ...formData, image: files[0] });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("⏳ Enregistrement...");
    setLoading(true);

    let image_url = "";

    if (formData.image) {
      const fileExt = formData.image.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `courses/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("courses")
        .upload(filePath, formData.image);

      if (uploadError) {
        setMessage("❌ Erreur lors de l'upload de l'image.");
        setLoading(false);
        return;
      }

      const { data: imageData } = supabase.storage
        .from("courses")
        .getPublicUrl(filePath);
      image_url = imageData.publicUrl;
    }

    const { error } = await supabase.from("courses").insert([
      {
        nom: formData.nom,
        sous_titre: formData.sous_titre,
        type: formData.type,
        lieu: formData.lieu,
        date: formData.date,
        distance_km: parseFloat(formData.distance_km),
        denivele_dplus: parseInt(formData.denivele_dplus),
        denivele_dmoins: parseInt(formData.denivele_dmoins),
        cote_itra: parseInt(formData.cote_itra),
        prix: parseFloat(formData.prix),
        gpx_url: formData.gpx_url,
        image_url: image_url,
      },
    ]);

    if (error) {
      console.error(error);
      setMessage("❌ Erreur lors de l'enregistrement.");
    } else {
      setMessage("✅ Épreuve enregistrée avec succès !");
      setFormData({
        nom: "",
        sous_titre: "",
        type: "",
        lieu: "",
        date: "",
        distance_km: "",
        denivele_dplus: "",
        denivele_dmoins: "",
        cote_itra: "",
        prix: "",
        gpx_url: "",
        image: null,
      });
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: "600px", margin: "auto" }}>
      <h1>Espace Organisateur</h1>
      <p>Créez et gérez vos courses.</p>
      <form onSubmit={handleSubmit}>
        <input type="text" name="nom" placeholder="Nom de l’épreuve" value={formData.nom} onChange={handleChange} required />
        <input type="text" name="sous_titre" placeholder="Sous-titre" value={formData.sous_titre} onChange={handleChange} />
        <input type="text" name="type" placeholder="Type de course (trail, KV...)" value={formData.type} onChange={handleChange} />
        <input type="text" name="lieu" placeholder="Lieu" value={formData.lieu} onChange={handleChange} required />
        <input type="date" name="date" value={formData.date} onChange={handleChange} required />
        <input type="number" name="distance_km" placeholder="Distance (km)" value={formData.distance_km} onChange={handleChange} />
        <input type="number" name="denivele_dplus" placeholder="D+" value={formData.denivele_dplus} onChange={handleChange} />
        <input type="number" name="denivele_dmoins" placeholder="D-" value={formData.denivele_dmoins} onChange={handleChange} />
        <input type="number" name="cote_itra" placeholder="Cote ITRA" value={formData.cote_itra} onChange={handleChange} />
        <input type="number" name="prix" placeholder="Tarif (€)" value={formData.prix} onChange={handleChange} />
        <input type="url" name="gpx_url" placeholder="Lien GPX" value={formData.gpx_url} onChange={handleChange} />
        <input type="file" name="image" accept="image/*" onChange={handleChange} />
        <button type="submit" disabled={loading}>Enregistrer</button>
      </form>
      <p>{message}</p>
    </div>
  );
}
