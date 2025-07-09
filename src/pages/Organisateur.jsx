import React, { useState } from "react";
import { supabase } from "../supabase";

const Organisateur = () => {
  const [nom, setNom] = useState("");
  const [lieu, setLieu] = useState("");
  const [date, setDate] = useState("");
  const [distance, setDistance] = useState("");
  const [deniveleDplus, setDeniveleDplus] = useState("");
  const [deniveleDmoins, setDeniveleDmoins] = useState("");
  const [coteItra, setCoteItra] = useState("");
  const [image, setImage] = useState(null);
  const [etat, setEtat] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEtat("⏳ Enregistrement...");

    // 1. Upload image
    let imageUrl = "";
    if (image) {
      const fileName = Date.now() + "-" + image.name;
      const { error: uploadError } = await supabase.storage
        .from("courses")
        .upload("courses/" + fileName, image);

      if (uploadError) {
        setEtat("❌ Erreur lors de l'upload de l'image.");
        return;
      }

      const { data } = supabase.storage
        .from("courses")
        .getPublicUrl("courses/" + fileName);

      imageUrl = data.publicUrl;
    }

    // 2. Enregistrement dans Supabase
    const { error } = await supabase.from("courses").insert([
      {
        nom,
        lieu,
        date,
        distance_km: distance,
        denivele_dplus: deniveleDplus,
        denivele_dmoins: deniveleDmoins,
        cote_itra: coteItra,
        image_url: imageUrl,
      },
    ]);

    if (error) {
      setEtat("❌ Erreur lors de l'enregistrement.");
    } else {
      setEtat("✅ Enregistrement réussi !");
      setNom("");
      setLieu("");
      setDate("");
      setDistance("");
      setDeniveleDplus("");
      setDeniveleDmoins("");
      setCoteItra("");
      setImage(null);
    }
  };

  return (
    <div style={{ padding: "1rem" }}>
      <h1>Espace Organisateur</h1>
      <p>Créez et gérez vos courses.</p>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Nom"
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
          placeholder="Date"
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
          placeholder="D+"
          value={deniveleDplus}
          onChange={(e) => setDeniveleDplus(e.target.value)}
          required
        />
        <input
          type="number"
          placeholder="D-"
          value={deniveleDmoins}
          onChange={(e) => setDeniveleDmoins(e.target.value)}
          required
        />
        <input
          type="number"
          placeholder="Cote ITRA"
          value={coteItra}
          onChange={(e) => setCoteItra(e.target.value)}
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImage(e.target.files[0])}
        />
        <button type="submit">Envoyer</button>
      </form>
      {etat && <p>{etat}</p>}
    </div>
  );
};

export default Organisateur;
