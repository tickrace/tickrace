import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

export default function Organisateur() {
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate("/login-organisateur");
      }
    };
    checkSession();
  }, []);
  
  // ... le reste du code
}
<button
  onClick={async () => {
    await supabase.auth.signOut();
    window.location.href = "/login-organisateur";
  }}
  className="bg-red-500 text-white px-4 py-2 rounded"
>
  Se déconnecter
</button>
import { supabase } from "../supabase";

// ...dans la fonction handleSubmit

const {
  data: { user },
  error: userError,
} = await supabase.auth.getUser();

if (userError || !user) {
  console.error("Utilisateur non connecté");
  return;
}

const { error: insertError } = await supabase
  .from("courses")
  .insert([
    {
      nom,
      lieu,
      date,
      // autres champs...
      organisateur_id: user.id,
    },
  ]);

import React, { useState } from "react";
import { supabase } from "../supabase";

export default function Organisateur() {
  const [data, setData] = useState({
    nom: "",
    sous_nom: "",
    lieu: "",
    date: "",
    image: null,
    image_url: "",
    description: "",
    formats: [
      {
        nom: "",
        distance_km: "",
        denivele_dplus: "",
        denivele_dmoins: "",
        prix: "",
        heure_depart: "",
        cote_itra: "",
      },
    ],
  });

  const [message, setMessage] = useState("");

  const handleInputChange = (e) => {
    setData({ ...data, [e.target.name]: e.target.value });
  };

  const handleFormatChange = (index, e) => {
    const newFormats = [...data.formats];
    newFormats[index][e.target.name] = e.target.value;
    setData({ ...data, formats: newFormats });
  };

  const addFormat = () => {
    setData({
      ...data,
      formats: [
        ...data.formats,
        {
          nom: "",
          distance_km: "",
          denivele_dplus: "",
          denivele_dmoins: "",
          prix: "",
          heure_depart: "",
          cote_itra: "",
        },
      ],
    });
  };

  const handleImageUpload = async () => {
    if (!data.image) return null;

    const file = data.image;
    const filePath = `courses/${Date.now()}_${file.name}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("courses")
      .upload(filePath, file);

    if (uploadError) {
      console.error("❌ Erreur upload :", uploadError.message);
      return null;
    }

    const { data: urlData } = supabase.storage.from("courses").getPublicUrl(filePath);
    return urlData.publicUrl;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("⏳ Enregistrement...");

    const uploadedImageUrl = await handleImageUpload();

    const { data: insertedEvent, error: insertError } = await supabase
      .from("events")
      .insert([
        {
          nom: data.nom,
          sous_nom: data.sous_nom,
          lieu: data.lieu,
          date: data.date,
          description: data.description,
          image_url: uploadedImageUrl || null,
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error("❌ Erreur insert event :", insertError.message);
      setMessage("❌ Erreur lors de l'enregistrement.");
      return;
    }

    const { error: formatsError } = await supabase.from("formats").insert(
      data.formats.map((format) => ({
        event_id: insertedEvent.id,
        nom: format.nom || "",
        distance_km: format.distance_km ? Number(format.distance_km) : null,
        denivele_dplus: format.denivele_dplus ? parseInt(format.denivele_dplus) : null,
        denivele_dmoins: format.denivele_dmoins ? parseInt(format.denivele_dmoins) : null,
        cote_itra: format.cote_itra ? parseInt(format.cote_itra) : null,
        heure_depart: format.heure_depart || null,
        prix: format.prix ? Number(format.prix) : null,
      }))
    );

    if (formatsError) {
      console.error("❌ Erreur insert formats :", formatsError.message);
      setMessage("❌ Erreur lors de l'enregistrement des formats.");
    } else {
      setMessage("✅ Épreuve enregistrée avec succès !");
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Espace Organisateur</h1>
      <p className="mb-4">Créez et gérez vos courses.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input name="nom" placeholder="Nom de l’épreuve" onChange={handleInputChange} className="w-full border p-2" />
        <input name="sous_nom" placeholder="Sous-nom" onChange={handleInputChange} className="w-full border p-2" />
        <input name="lieu" placeholder="Lieu" onChange={handleInputChange} className="w-full border p-2" />
        <input type="date" name="date" onChange={handleInputChange} className="w-full border p-2" />
        <textarea name="description" placeholder="Description" onChange={handleInputChange} className="w-full border p-2" />
        <input type="file" accept="image/*" onChange={(e) => setData({ ...data, image: e.target.files[0] })} className="w-full" />

        <h2 className="text-lg font-semibold mt-6">Formats</h2>
        {data.formats.map((format, index) => (
          <div key={index} className="border p-3 mb-3">
            <input name="nom" placeholder="Nom du format" value={format.nom} onChange={(e) => handleFormatChange(index, e)} className="w-full border p-2 mb-2" />
            <input name="distance_km" placeholder="Distance (km)" value={format.distance_km} onChange={(e) => handleFormatChange(index, e)} className="w-full border p-2 mb-2" />
            <input name="denivele_dplus" placeholder="D+" value={format.denivele_dplus} onChange={(e) => handleFormatChange(index, e)} className="w-full border p-2 mb-2" />
            <input name="denivele_dmoins" placeholder="D-" value={format.denivele_dmoins} onChange={(e) => handleFormatChange(index, e)} className="w-full border p-2 mb-2" />
            <input name="prix" placeholder="Prix (€)" value={format.prix} onChange={(e) => handleFormatChange(index, e)} className="w-full border p-2 mb-2" />
            <input name="heure_depart" placeholder="Heure de départ (ex: 08:30)" value={format.heure_depart} onChange={(e) => handleFormatChange(index, e)} className="w-full border p-2 mb-2" />
            <input name="cote_itra" placeholder="Côte ITRA" value={format.cote_itra} onChange={(e) => handleFormatChange(index, e)} className="w-full border p-2" />
          </div>
        ))}

        <button type="button" onClick={addFormat} className="bg-gray-200 px-4 py-2 rounded">➕ Ajouter un format</button>
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">✅ Enregistrer</button>
      </form>

      {message && <p className="mt-4">{message}</p>}
    </div>
  );
}
