import React, { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function NouvelleCourse() {
  const [form, setForm] = useState({
    nom: "",
    lieu: "",
    date: "",
    image_url: "",
    formats: [
      {
        nom: "",
        distance_km: "",
        denivele_dplus: "",
        denivele_dmoins: "",
        cote_itra: "",
        heure_depart: "",
        prix: "",
        gpx_url: "",
      },
    ],
  });

  const [message, setMessage] = useState("");
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };
    getUser();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleFormatChange = (index, e) => {
    const updatedFormats = [...form.formats];
    updatedFormats[index][e.target.name] = e.target.value;
    setForm({ ...form, formats: updatedFormats });
  };

  const addFormat = () => {
    setForm({
      ...form,
      formats: [
        ...form.formats,
        {
          nom: "",
          distance_km: "",
          denivele_dplus: "",
          denivele_dmoins: "",
          cote_itra: "",
          heure_depart: "",
          prix: "",
          gpx_url: "",
        },
      ],
    });
  };

  const removeFormat = (index) => {
    const updatedFormats = form.formats.filter((_, i) => i !== index);
    setForm({ ...form, formats: updatedFormats });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("Enregistrement...");

    const { data: course, error } = await supabase
      .from("courses")
      .insert({
        nom: form.nom,
        lieu: form.lieu,
        date: form.date,
        image_url: form.image_url,
        organisateur_id: userId,
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      setMessage("❌ Erreur lors de l'enregistrement.");
      return;
    }

    const formatsToInsert = form.formats.map((f) => ({
      ...f,
      event_id: course.id,
    }));

    const { error: formatError } = await supabase.from("formats").insert(formatsToInsert);

    if (formatError) {
      console.error(formatError);
      setMessage("❌ Erreur lors de l'enregistrement des formats.");
      return;
    }

    setMessage("✅ Épreuve et formats enregistrés !");
    setForm({
      nom: "",
      lieu: "",
      date: "",
      image_url: "",
      formats: [
        {
          nom: "",
          distance_km: "",
          denivele_dplus: "",
          denivele_dmoins: "",
          cote_itra: "",
          heure_depart: "",
          prix: "",
          gpx_url: "",
        },
      ],
    });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Nouvelle épreuve</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="text" name="nom" placeholder="Nom" value={form.nom} onChange={handleChange} required className="border w-full px-3 py-2 rounded" />
        <input type="text" name="lieu" placeholder="Lieu" value={form.lieu} onChange={handleChange} required className="border w-full px-3 py-2 rounded" />
        <input type="date" name="date" placeholder="Date" value={form.date} onChange={handleChange} required className="border w-full px-3 py-2 rounded" />
        <input type="text" name="image_url" placeholder="URL de l'image" value={form.image_url} onChange={handleChange} className="border w-full px-3 py-2 rounded" />

        <h2 className="text-xl font-semibold mt-6">Formats</h2>
        {form.formats.map((format, index) => (
          <div key={index} className="border p-4 rounded mb-4 space-y-2">
            <input type="text" name="nom" placeholder="Nom du format" value={format.nom} onChange={(e) => handleFormatChange(index, e)} className="border w-full px-3 py-2 rounded" />
            <input type="number" name="distance_km" placeholder="Distance (km)" value={format.distance_km} onChange={(e) => handleFormatChange(index, e)} className="border w-full px-3 py-2 rounded" />
            <input type="number" name="denivele_dplus" placeholder="D+ (m)" value={format.denivele_dplus} onChange={(e) => handleFormatChange(index, e)} className="border w-full px-3 py-2 rounded" />
            <input type="number" name="denivele_dmoins" placeholder="D- (m)" value={format.denivele_dmoins} onChange={(e) => handleFormatChange(index, e)} className="border w-full px-3 py-2 rounded" />
            <input type="number" name="cote_itra" placeholder="Cote ITRA" value={format.cote_itra} onChange={(e) => handleFormatChange(index, e)} className="border w-full px-3 py-2 rounded" />
            <input type="time" name="heure_depart" placeholder="Heure de départ" value={format.heure_depart} onChange={(e) => handleFormatChange(index, e)} className="border w-full px-3 py-2 rounded" />
            <input type="number" name="prix" placeholder="Prix (€)" value={format.prix} onChange={(e) => handleFormatChange(index, e)} className="border w-full px-3 py-2 rounded" />
            <input type="text" name="gpx_url" placeholder="URL GPX" value={format.gpx_url} onChange={(e) => handleFormatChange(index, e)} className="border w-full px-3 py-2 rounded" />

            {form.formats.length > 1 && (
              <button type="button" onClick={() => removeFormat(index)} className="text-red-500 mt-2">Supprimer ce format</button>
            )}
          </div>
        ))}
        <button type="button" onClick={addFormat} className="bg-gray-200 px-4 py-2 rounded">+ Ajouter un format</button>
        <button type="submit" className="bg-black text-white px-4 py-2 rounded">Enregistrer</button>
        {message && <p className="mt-2">{message}</p>}
      </form>
    </div>
  );
}
