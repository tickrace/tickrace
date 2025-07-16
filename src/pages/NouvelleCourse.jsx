import React, { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { useNavigate } from "react-router-dom";

export default function NouvelleCourse() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    nom: "",
    sous_nom: "",
    lieu: "",
    date: "",
    type_epreuve: "",
  });

  const [formats, setFormats] = useState([
    { nom: "", distance_km: "", denivele_dplus: "", denivele_dmoins: "", prix: "" },
  ]);

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUserId(data.user.id);
      } else {
        setMessage({ type: "error", text: "Veuillez vous connecter." });
      }
    });
  }, []);

  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleFormatChange = (index, e) => {
    const updated = [...formats];
    updated[index][e.target.name] = e.target.value;
    setFormats(updated);
  };

  const addFormat = () => {
    setFormats([...formats, { nom: "", distance_km: "", denivele_dplus: "", denivele_dmoins: "", prix: "" }]);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const uploadImage = async () => {
    if (!imageFile) return null;
    const fileName = `courses/${Date.now()}-${imageFile.name}`;
    const { data, error } = await supabase.storage.from("tickrace").upload(fileName, imageFile);
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("tickrace").getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const image_url = await uploadImage();

      const { data: courseData, error: courseError } = await supabase
        .from("courses")
        .insert([
          {
            ...form,
            organisateur_id: userId,
            image_url,
          },
        ])
        .select()
        .single();

      if (courseError) throw courseError;

      for (const format of formats) {
        const { error: formatError } = await supabase.from("formats").insert([
          {
            ...format,
            event_id: courseData.id,
          },
        ]);
        if (formatError) throw formatError;
      }

      setMessage({ type: "success", text: "Course créée avec succès." });
      navigate("/organisateur/espace");
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Erreur lors de la création." });
    }

    setLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Nouvelle course</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="text" name="nom" placeholder="Nom de l’épreuve" className="w-full border px-3 py-2 rounded" value={form.nom} onChange={handleFormChange} required />
        <input type="text" name="sous_nom" placeholder="Sous-nom" className="w-full border px-3 py-2 rounded" value={form.sous_nom} onChange={handleFormChange} />
        <input type="text" name="lieu" placeholder="Lieu" className="w-full border px-3 py-2 rounded" value={form.lieu} onChange={handleFormChange} required />
        <input type="date" name="date" className="w-full border px-3 py-2 rounded" value={form.date} onChange={handleFormChange} required />
        <select name="type_epreuve" className="w-full border px-3 py-2 rounded" value={form.type_epreuve} onChange={handleFormChange} required>
          <option value="">Type d’épreuve</option>
          <option value="trail">Trail</option>
          <option value="ultra">Ultra</option>
          <option value="vertical">Vertical</option>
        </select>

        <div>
          <label className="block mb-1 font-medium">Image (JPG/PNG)</label>
          <input type="file" accept="image/*" onChange={handleImageChange} className="mb-2" />
          {imagePreview && <img src={imagePreview} alt="Prévisualisation" className="w-48 mt-2 rounded shadow" />}
        </div>

        <h2 className="text-lg font-semibold mt-6">Formats</h2>
        {formats.map((format, index) => (
          <div key={index} className="grid grid-cols-2 md:grid-cols-5 gap-2 border p-2 rounded mb-2">
            <input name="nom" placeholder="Nom format" value={format.nom} onChange={(e) => handleFormatChange(index, e)} className="border px-2 py-1 rounded" required />
            <input name="distance_km" placeholder="Distance (km)" type="number" value={format.distance_km} onChange={(e) => handleFormatChange(index, e)} className="border px-2 py-1 rounded" />
            <input name="denivele_dplus" placeholder="D+" type="number" value={format.denivele_dplus} onChange={(e) => handleFormatChange(index, e)} className="border px-2 py-1 rounded" />
            <input name="denivele_dmoins" placeholder="D-" type="number" value={format.denivele_dmoins} onChange={(e) => handleFormatChange(index, e)} className="border px-2 py-1 rounded" />
            <input name="prix" placeholder="Prix (€)" type="number" value={format.prix} onChange={(e) => handleFormatChange(index, e)} className="border px-2 py-1 rounded" />
          </div>
        ))}
        <button type="button" onClick={addFormat} className="text-blue-600 underline">
          + Ajouter un format
        </button>

        <button type="submit" disabled={loading} className="bg-black text-white px-4 py-2 rounded">
          {loading ? "Chargement..." : "Créer la course"}
        </button>

        {message && (
          <p className={`mt-2 text-sm ${message.type === "error" ? "text-red-500" : "text-green-600"}`}>
            {message.text}
          </p>
        )}
      </form>
    </div>
  );
}
