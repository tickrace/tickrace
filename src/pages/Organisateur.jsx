import React, { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function Organisateur() {
  const [session, setSession] = useState(null);
  const [nom, setNom] = useState("");
  const [sousNom, setSousNom] = useState("");
  const [lieu, setLieu] = useState("");
  const [date, setDate] = useState("");
  const [typeEpreuve, setTypeEpreuve] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session?.user ? session : null);
    };
    getSession();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    let imageUrl = null;

    if (imageFile) {
      const fileExt = imageFile.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `courses/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("tickrace")
        .upload(filePath, imageFile);

      if (uploadError) {
        setLoading(false);
        setMessage({ type: "error", text: "Erreur lors de l’upload de l’image." });
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("tickrace")
        .getPublicUrl(filePath);
      imageUrl = publicUrlData.publicUrl;
    }

    const { data, error } = await supabase
      .from("courses")
      .insert([
        {
          nom,
          sous_nom: sousNom,
          lieu,
          date,
          type_epreuve: typeEpreuve,
          image_url: imageUrl,
          organisateur_id: session.user.id,
        },
      ]);

    if (error) {
      setMessage({ type: "error", text: "Erreur lors de l’enregistrement de la course." });
    } else {
      setMessage({ type: "success", text: "Course enregistrée avec succès !" });
      setNom("");
      setSousNom("");
      setLieu("");
      setDate("");
      setTypeEpreuve("");
      setImageFile(null);
    }

    setLoading(false);
  };

  if (!session) {
    return (
      <div className="p-6">
        <p>Veuillez vous connecter pour accéder à cet espace.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Nouvelle course</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Nom de l’épreuve</label>
          <input
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            className="w-full border px-3 py-2 rounded"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Sous-nom</label>
          <input
            type="text"
            value={sousNom}
            onChange={(e) => setSousNom(e.target.value)}
            className="w-full border px-3 py-2 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Lieu</label>
          <input
            type="text"
            value={lieu}
            onChange={(e) => setLieu(e.target.value)}
            className="w-full border px-3 py-2 rounded"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border px-3 py-2 rounded"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Type d’épreuve</label>
          <input
            type="text"
            value={typeEpreuve}
            onChange={(e) => setTypeEpreuve(e.target.value)}
            className="w-full border px-3 py-2 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Image (JPG/PNG)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files[0])}
            className="w-full"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-black text-white px-4 py-2 rounded"
        >
          {loading ? "Enregistrement..." : "Créer la course"}
        </button>

        {message && (
          <p className={`mt-2 text-sm ${message.type === "error" ? "text-red-600" : "text-green-600"}`}>
            {message.text}
          </p>
        )}
      </form>
    </div>
  );
}
