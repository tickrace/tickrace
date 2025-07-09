import React, { useState } from "react";
import { supabase } from "../supabase";

export default function Organisateur() {
  const [formData, setFormData] = useState({
    nom: "",
    lieu: "",
    date: "",
    distance_km: "",
    denivele_dplus: "",
    denivele_dmoins: "",
    cote_itra: "",
  });
  const [imageFile, setImageFile] = useState(null);
  const [status, setStatus] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    setImageFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("⏳ Envoi en cours...");

    let image_url = "";

    if (imageFile) {
      const fileExt = imageFile.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `courses/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("courses")
        .upload(filePath, imageFile);

      if (uploadError) {
        console.error(uploadError);
        setStatus("❌ Erreur lors de l'upload de l'image.");
        return;
      }

      const { data } = supabase.storage.from("courses").getPublicUrl(filePath);
      image_url = data.publicUrl;
    }

    const { error } = await supabase.from("courses").insert([
      {
        ...formData,
        image_url,
      },
    ]);

    if (error) {
      console.error(error);
      setStatus("❌ Erreur lors de l'enregistrement.");
    } else {
      setStatus("✅ Course ajoutée avec succès !");
      setFormData({
        nom: "",
        lieu: "",
        date: "",
        distance_km: "",
        denivele_dplus: "",
        denivele_dmoins: "",
        cote_itra: "",
      });
      setImageFile(null);
    }
  };

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-xl font-bold mb-4">🎯 Ajouter une épreuve</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {[
          ["nom", "Nom de la course"],
          ["lieu", "Lieu"],
          ["date", "Date", "date"],
          ["distance_km", "Distance (km)", "number"],
          ["denivele_dplus", "D+ (m)", "number"],
          ["denivele_dmoins", "D- (m)", "number"],
          ["cote_itra", "Cote ITRA", "number"],
        ].map(([name, label, type = "text"]) => (
          <div key={name}>
            <label className="block mb-1 font-medium">{label}</label>
            <input
              type={type}
              name={name}
              value={formData[name]}
              onChange={handleChange}
              required
              className="w-full border p-2 rounded"
            />
          </div>
        ))}

        <div>
          <label className="block mb-1 font-medium">Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="w-full border p-2 rounded"
          />
        </div>

        <button
          type="submit"
          className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800"
        >
          ➕ Ajouter
        </button>
      </form>
      {status && <p className="mt-4">{status}</p>}
    </div>
  );
}
