// src/pages/Organisateur.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function Organisateur() {
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState(null);
  const [courses, setCourses] = useState([]);

  const [formData, setFormData] = useState({
    nom: "",
    sous_nom: "",
    lieu: "",
    type: "",
    date: "",
    distance_km: "",
    denivele_dplus: "",
    denivele_dmoins: "",
    cote_itra: "",
    prix: "",
    image_url: "",
  });

  // Charger l'utilisateur connecté
  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      if (user) fetchCourses(user.id);
    };
    fetchUser();
  }, []);

  // Récupérer les courses déjà créées
  const fetchCourses = async (organisateurId) => {
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .eq("organisateur_id", organisateurId);
    if (!error) {
      setCourses(data);
    }
  };

  // Upload image
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const filePath = `courses/${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage
      .from("courses")
      .upload(filePath, file);

    if (error) {
      setMessage({ type: "error", text: "❌ Erreur lors de l'upload de l'image." });
    } else {
      const url = supabase.storage.from("courses").getPublicUrl(filePath).data.publicUrl;
      setFormData({ ...formData, image_url: url });
      setMessage({ type: "success", text: "✅ Upload réussi !" });
    }
  };

  // Soumettre le formulaire
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (!user) {
      setMessage({ type: "error", text: "Utilisateur non connecté." });
      return;
    }

    const { error } = await supabase.from("courses").insert({
      ...formData,
      organisateur_id: user.id,
    });

    if (error) {
      setMessage({ type: "error", text: "❌ Erreur lors de l'enregistrement." });
    } else {
      setMessage({ type: "success", text: "✅ Course enregistrée avec succès." });
      setFormData({
        nom: "",
        sous_nom: "",
        lieu: "",
        type: "",
        date: "",
        distance_km: "",
        denivele_dplus: "",
        denivele_dmoins: "",
        cote_itra: "",
        prix: "",
        image_url: "",
      });
      fetchCourses(user.id);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Espace Organisateur</h1>
      {user && (
        <button onClick={handleLogout} className="mb-4 text-sm text-blue-600 underline">
          Déconnexion
        </button>
      )}
      <p className="mb-6 text-gray-700">Créez et gérez vos courses.</p>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4">
        <input type="text" placeholder="Nom de l’épreuve" value={formData.nom} onChange={(e) => setFormData({ ...formData, nom: e.target.value })} required />
        <input type="text" placeholder="Sous-nom ou édition" value={formData.sous_nom} onChange={(e) => setFormData({ ...formData, sous_nom: e.target.value })} />
        <input type="text" placeholder="Lieu" value={formData.lieu} onChange={(e) => setFormData({ ...formData, lieu: e.target.value })} required />
        <input type="text" placeholder="Type (ex: trail, skyrace…)" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} />
        <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required />
        <input type="number" placeholder="Distance (km)" value={formData.distance_km} onChange={(e) => setFormData({ ...formData, distance_km: e.target.value })} />
        <input type="number" placeholder="Dénivelé positif (m)" value={formData.denivele_dplus} onChange={(e) => setFormData({ ...formData, denivele_dplus: e.target.value })} />
        <input type="number" placeholder="Dénivelé négatif (m)" value={formData.denivele_dmoins} onChange={(e) => setFormData({ ...formData, denivele_dmoins: e.target.value })} />
        <input type="number" placeholder="Cote ITRA" value={formData.cote_itra} onChange={(e) => setFormData({ ...formData, cote_itra: e.target.value })} />
        <input type="number" placeholder="Prix (€)" value={formData.prix} onChange={(e) => setFormData({ ...formData, prix: e.target.value })} />
        <input type="file" accept="image/*" onChange={handleImageUpload} />
        <button type="submit" className="bg-black text-white px-4 py-2 rounded">Enregistrer</button>
        {message && <p className={`${message.type === "error" ? "text-red-600" : "text-green-600"}`}>{message.text}</p>}
      </form>

      {courses.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xl font-bold mb-2">Mes épreuves</h2>
          <ul className="space-y-2">
            {courses.map((course) => (
              <li key={course.id} className="border p-3 rounded">
                <strong>{course.nom}</strong> - {course.date} - {course.lieu}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
