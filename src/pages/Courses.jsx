// Page des événements avec formats associés
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function Courses() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      const { data, error } = await supabase
        .from("events")
        .select(`*, formats(*)`)
        .order("date", { ascending: true });

      if (error) {
        console.error("Erreur de chargement :", error);
      } else {
        setEvents(data);
      }

      setLoading(false);
    };

    fetchEvents();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Toutes les épreuves</h1>

      {loading ? (
        <p>Chargement...</p>
      ) : (
        events.map((event) => (
          <div key={event.id} className="mb-8 border-b pb-6">
            <h2 className="text-xl font-semibold">{event.nom}</h2>
            {event.sous_nom && <p className="italic text-sm text-gray-600">{event.sous_nom}</p>}
            <p className="text-sm text-gray-700">📍 {event.lieu} - 📅 {event.date}</p>
            {event.image_url && (
              <img
                src={event.image_url}
                alt={event.nom}
                className="w-full h-64 object-cover my-3 rounded"
              />
            )}
            {event.description && <p className="mb-3">{event.description}</p>}

            {event.formats && event.formats.length > 0 && (
              <div>
                <h3 className="font-semibold mt-3">Formats :</h3>
                <ul className="list-disc ml-5">
                  {event.formats.map((format) => (
                    <li key={format.id} className="mt-1">
                      <span className="font-bold">{format.nom}</span> - {format.distance_km} km, {format.denivele_dplus} D+, {format.denivele_dmoins} D-, {format.prix} €
                      {format.heure_depart && ` - départ à ${format.heure_depart}`}
                      {format.cote_itra && ` - ITRA ${format.cote_itra}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
