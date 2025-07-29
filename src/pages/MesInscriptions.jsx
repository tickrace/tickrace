// src/pages/MesInscriptions.jsx

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase";

export default function MesInscriptions() {
  const [inscriptions, setInscriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInscriptions = async () => {
      const session = await supabase.auth.getSession();
      const user = session.data?.session?.user;
      if (!user) return;

      const { data, error } = await supabase
        .from("inscriptions")
        .select("id, format_id, course_id, nom, prenom, formats(nom, date), courses(nom)")
        .eq("coureur_id", user.id)
        .order("created_at", { ascending: false });

      if (!error) {
        setInscriptions(data);
      }
      setLoading(false);
    };

    fetchInscriptions();
  }, []);

  if (loading) return <div className="p-6">Chargement...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Mes Inscriptions</h1>
      {inscriptions.length === 0 ? (
        <p>Vous n'avez pas encore d'inscription.</p>
      ) : (
        <ul className="space-y-4">
          {inscriptions.map((insc) => (
            <li key={insc.id} className="border p-4 rounded bg-gray-50">
              <p className="font-semibold">
                {insc.courses?.nom} — {insc.formats?.nom} ({insc.formats?.date})
              </p>
              <p className="text-sm text-gray-600">
                {insc.prenom} {insc.nom}
              </p>
              <Link
                to={`/mon-inscription/${insc.id}`}
                className="inline-block mt-2 text-blue-600 hover:underline text-sm"
              >
                Voir ou modifier
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
