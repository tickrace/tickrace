import React, { useState } from "react";
import { supabase } from "../supabase";

export default function Organisateur() {
  const [eventData, setEventData] = useState({
    nom: "",
    sous_nom: "",
    lieu: "",
    date: "",
    imageFile: null,
    description: "",
  });

  const [formats, setFormats] = useState([]);
  const [formatTemp, setFormatTemp] = useState({
    nom: "",
    distance_km: "",
    denivele_dplus: "",
    denivele_dmoins: "",
    cote_itra: "",
    heure_depart: "",
    prix: "",
    gpx_url: "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleEventChange = (e) => {
    const { name, value, files } = e.target;
    setEventData((prev) => ({
      ...prev,
      [name]: files ? files[0] : value,
    }));
  };

  const handleFormatChange = (e) => {
    const { name, value } = e.target;
    setFormatTemp((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const addFormat = () => {
    setFormats([...formats, formatTemp]);
    setFormatTemp({
      nom: "",
      distance_km: "",
      denivele_dplus: "",
      denivele_dmoins: "",
      cote_itra: "",
      heure_depart: "",
      prix: "",
      gpx_url: "",
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      let image_url = null;

      if (eventData.imageFile) {
        const file = eventData.imageFile;
        const filePath = `events/${Date.now()}_${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from("courses")
          .upload(filePath, file);

        if (uploadError) throw new Error("Échec de l’upload de l’image");

        const { data } = supabase.storage
          .from("courses")
          .getPublicUrl(filePath);

        image_url = data.publicUrl;
      }

      const { data: eventInserted, error: insertError } = await supabase
        .from("events")
        .insert([
          {
            nom: eventData.nom,
            sous_nom: eventData.sous_nom,
            lieu: eventData.lieu,
            date: eventData.date,
            image_url,
            description: eventData.description,
          },
        ])
        .select()
        .single();

      if (insertError) throw insertError;

      const event_id = eventInserted.id;

      for (const f of formats) {
        const { error: formatError } = await supabase.from("formats").insert([
          {
            ...f,
            event_id,
          },
        ]);

        if (formatError) throw formatError;
      }

      setMessage("✅ Événement et formats enregistrés avec succès !");
      setEventData({
        nom: "",
        sous_nom: "",
        lieu: "",
        date: "",
        imageFile: null,
        description: "",
      });
      setFormats([]);
    } catch (err) {
      console.error(err);
      setMessage("❌ Erreur lors de l'enregistrement.");
    }

    setLoading(false);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Espace Organisateur</h1>
      <p className="mb-6">Créez un événement avec plusieurs formats de course.</p>

      <form onSubmit={handleSubmit} className="space-y-6 bg-gray-50 p-4 rounded shadow">
        <h2 className="text-xl font-semibold">Événement principal</h2>
        <input name="nom" placeholder="Nom de l'événement" className="w-full" value={eventData.nom} onChange={handleEventChange} required />
        <input name="sous_nom" placeholder="Sous-titre" className="w-full" value={eventData.sous_nom} onChange={handleEventChange} />
        <input name="lieu" placeholder="Lieu" className="w-full" value={eventData.lieu} onChange={handleEventChange} required />
        <input name="date" type="date" className="w-full" value={eventData.date} onChange={handleEventChange} required />
        <input name="imageFile" type="file" accept="image/*" className="w-full" onChange={handleEventChange} />
        <textarea name="description" placeholder="Description" className="w-full" value={eventData.description} onChange={handleEventChange} />

        <div className="mt-6">
          <h2 className="text-xl font-semibold">Ajout d’un format</h2>
          <div className="grid grid-cols-2 gap-2">
            <input name="nom" placeholder="Nom du format (ex: Trail 25K)" value={formatTemp.nom} onChange={handleFormatChange} />
            <input name="distance_km" placeholder="Distance (km)" value={formatTemp.distance_km} onChange={handleFormatChange} />
            <input name="denivele_dplus" placeholder="D+ (m)" value={formatTemp.denivele_dplus} onChange={handleFormatChange} />
            <input name="denivele_dmoins" placeholder="D- (m)" value={formatTemp.denivele_dmoins} onChange={handleFormatChange} />
            <input name="cote_itra" placeholder="Cote ITRA" value={formatTemp.cote_itra} onChange={handleFormatChange} />
            <input name="heure_depart" type="time" placeholder="Heure départ" value={formatTemp.heure_depart} onChange={handleFormatChange} />
            <input name="prix" placeholder="Prix (€)" value={formatTemp.prix} onChange={handleFormatChange} />
            <input name="gpx_url" placeholder="URL GPX (facultatif)" value={formatTemp.gpx_url} onChange={handleFormatChange} />
          </div>
          <button type="button" onClick={addFormat} className="mt-2 px-4 py-1 bg-blue-600 text-white rounded">
            ➕ Ajouter ce format
          </button>
        </div>

        {formats.length > 0 && (
          <div className="mt-4">
            <h3 className="font-bold">Formats ajoutés :</h3>
            <ul className="list-disc ml-5">
              {formats.map((f, idx) => (
                <li key={idx}>{f.nom} - {f.distance_km} km</li>
              ))}
            </ul>
          </div>
        )}

        <button type="submit" disabled={loading} className="bg-green-600 text-white px-4 py-2 rounded">
          {loading ? "Enregistrement..." : "✅ Enregistrer l’événement"}
        </button>

        {message && <p className="mt-2 text-sm">{message}</p>}
      </form>
    </div>
  );
}
