// src/pages/InscriptionCourse.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";

export default function InscriptionCourse() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);
  const [coureurs, setCoureurs] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchCourseAndFormats = async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*, formats(id, nom, date, prix, distance_km, denivele_dplus, nb_max_coureurs, stock_repas, prix_repas)")
        .eq("id", courseId)
        .single();

      if (error || !data) return;

      const formatsWithCount = await Promise.all(
        (data.formats || []).map(async (f) => {
          const { count } = await supabase
            .from("inscriptions")
            .select("*", { count: "exact", head: true })
            .eq("format_id", f.id);

          return { ...f, inscrits: count || 0 };
        })
      );

      setCourse(data);
      setFormats(formatsWithCount);
    };

    const fetchProfil = async () => {
      const session = await supabase.auth.getSession();
      const user = session.data?.session?.user;
      if (!user) return;

      const { data, error } = await supabase
        .from("profils_utilisateurs")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (!error && data) {
        setCoureurs([
          {
            ...data,
            coureur_id: user.id,
            format_id: "",
            nombre_repas: 0,
            prix_total_coureur: 0,
          },
        ]);
      }
    };

    fetchCourseAndFormats();
    fetchProfil();
  }, [courseId]);

  const handleCoureurChange = (index, field, value) => {
    const updated = [...coureurs];
    updated[index][field] = value;

    // Recalcul du prix total coureur
    if (field === "format_id" || field === "nombre_repas") {
      const format = formats.find((f) => f.id === updated[index].format_id);
      const prix = format ? Number(format.prix || 0) : 0;
      const prixRepas = format && format.prix_repas ? Number(format.prix_repas) * Number(updated[index].nombre_repas || 0) : 0;
      updated[index].prix_total_coureur = prix + prixRepas;
    }

    setCoureurs(updated);
  };

  const addCoureur = () => {
    setCoureurs((prev) => [
      ...prev,
      {
        coureur_id: null,
        nom: "",
        prenom: "",
        genre: "",
        date_naissance: "",
        nationalite: "",
        email: "",
        telephone: "",
        adresse: "",
        adresse_complement: "",
        code_postal: "",
        ville: "",
        pays: "",
        apparaitre_resultats: true,
        club: "",
        justificatif_type: "",
        contact_urgence_nom: "",
        contact_urgence_telephone: "",
        numero_licence: "",
        format_id: "",
        nombre_repas: 0,
        prix_total_coureur: 0,
      },
    ]);
  };

  const removeCoureur = (index) => {
    setCoureurs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    for (const coureur of coureurs) {
      if (!coureur.format_id) {
        alert("Veuillez sélectionner un format pour chaque coureur.");
        return;
      }
    }

    const { error } = await supabase.from("inscriptions").insert(coureurs.map((c) => ({
      ...c,
      course_id: courseId,
    })));

    if (error) {
      console.error("Erreur insertion :", error);
      alert("Erreur lors de l'inscription");
      return;
    }

    setMessage("Inscriptions enregistrées avec succès !");
  };

  if (!course || formats.length === 0) return <div className="p-6">Chargement...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Inscription à : {course.nom}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {coureurs.map((c, index) => (
          <fieldset key={index} className="border p-4 rounded-lg bg-gray-50 space-y-4">
            <legend className="font-bold text-lg">Coureur {index + 1}</legend>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="text" value={c.nom || ""} onChange={(e) => handleCoureurChange(index, "nom", e.target.value)} placeholder="Nom" className="border p-2 w-full" />
              <input type="text" value={c.prenom || ""} onChange={(e) => handleCoureurChange(index, "prenom", e.target.value)} placeholder="Prénom" className="border p-2 w-full" />
              
              <select value={c.genre || ""} onChange={(e) => handleCoureurChange(index, "genre", e.target.value)} className="border p-2 w-full">
                <option value="">Genre</option>
                <option value="Homme">Homme</option>
                <option value="Femme">Femme</option>
              </select>
              <input type="date" value={c.date_naissance || ""} onChange={(e) => handleCoureurChange(index, "date_naissance", e.target.value)} className="border p-2 w-full" />
              
              <input type="text" value={c.nationalite || ""} onChange={(e) => handleCoureurChange(index, "nationalite", e.target.value)} placeholder="Nationalité" className="border p-2 w-full" />
              <input type="email" value={c.email || ""} onChange={(e) => handleCoureurChange(index, "email", e.target.value)} placeholder="Email" className="border p-2 w-full" />
              <input type="tel" value={c.telephone || ""} onChange={(e) => handleCoureurChange(index, "telephone", e.target.value)} placeholder="Téléphone" className="border p-2 w-full" />
            </div>

            <div>
              <label className="font-semibold">Format :</label>
              <select
                className="border p-2 w-full mt-1"
                value={c.format_id || ""}
                onChange={(e) => handleCoureurChange(index, "format_id", e.target.value)}
              >
                <option value="">-- Sélectionnez un format --</option>
                {formats.map((f) => (
                  <option key={f.id} value={f.id} disabled={f.inscrits >= f.nb_max_coureurs}>
                    {f.nom} - {f.date} - {f.distance_km} km / {f.denivele_dplus} m D+ ({f.inscrits}/{f.nb_max_coureurs}) - {f.prix} €
                  </option>
                ))}
              </select>
            </div>

            {Number(c.nombre_repas) >= 0 && (
              <div>
                <label className="font-semibold">Repas :</label>
                <input
                  type="number"
                  min="0"
                  max={formats.find((f) => f.id === c.format_id)?.stock_repas || 0}
                  value={c.nombre_repas}
                  onChange={(e) => handleCoureurChange(index, "nombre_repas", e.target.value)}
                  className="border p-2 w-full mt-1"
                />
                <p className="text-sm text-gray-600">
                  Total repas : {formats.find((f) => f.id === c.format_id)?.prix_repas || 0} € × {c.nombre_repas} = {(formats.find((f) => f.id === c.format_id)?.prix_repas || 0) * (c.nombre_repas || 0)} €
                </p>
              </div>
            )}

            <p className="text-right font-bold">
              Prix total : {c.prix_total_coureur.toFixed(2)} €
            </p>

            {index > 0 && (
              <button
                type="button"
                onClick={() => removeCoureur(index)}
                className="bg-red-600 text-white px-3 py-1 rounded"
              >
                Supprimer ce coureur
              </button>
            )}
          </fieldset>
        ))}

        <button type="button" onClick={addCoureur} className="bg-blue-600 text-white px-4 py-2 rounded">
          + Ajouter un coureur
        </button>
        <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded">
          Confirmer les inscriptions
        </button>

        {message && <p className="text-green-700 mt-4">{message}</p>}
      </form>
    </div>
  );
}
