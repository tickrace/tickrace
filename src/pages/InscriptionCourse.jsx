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

  // Charger la course et les formats
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
          return { ...f, inscrits: count };
        })
      );

      setCourse(data);
      setFormats(formatsWithCount);
    };

    const fetchProfil = async () => {
      const session = await supabase.auth.getSession();
      const user = session.data?.session?.user;
      if (!user) {
        // Si pas connecté, un formulaire vide
        setCoureurs([createEmptyCoureur()]);
        return;
      }

      const { data, error } = await supabase
        .from("profils_utilisateurs")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (!error && data) {
        setCoureurs([
          {
            ...createEmptyCoureur(),
            ...data,
            coureur_id: user.id,
          },
        ]);
      } else {
        setCoureurs([createEmptyCoureur()]);
      }
    };

    fetchCourseAndFormats();
    fetchProfil();
  }, [courseId]);

  const createEmptyCoureur = () => ({
    coureur_id: null,
    format_id: "",
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
    nombre_repas: 0,
    prix_total_repas: 0,
    prix_total_coureur: 0,
  });

  const handleCoureurChange = (index, field, value) => {
    setCoureurs((prev) => {
      const updated = [...prev];
      updated[index][field] = value;

      if (field === "nombre_repas" || field === "format_id") {
        const format = formats.find((f) => f.id === updated[index].format_id);
        if (format) {
          const prixRepas = format.prix_repas || 0;
          const prixInscription = format.prix || 0;
          const totalRepas = prixRepas * (updated[index].nombre_repas || 0);
          updated[index].prix_total_repas = totalRepas;
          updated[index].prix_total_coureur = prixInscription + totalRepas;
        }
      }
      return updated;
    });
  };

  const addCoureur = () => setCoureurs((prev) => [...prev, createEmptyCoureur()]);
  const removeCoureur = (index) =>
    setCoureurs((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      for (const coureur of coureurs) {
        if (!coureur.format_id) {
          alert("Veuillez sélectionner un format pour chaque coureur.");
          return;
        }

        await supabase.from("inscriptions").insert([{
          ...coureur,
          course_id: courseId,
        }]);
      }
      setMessage("Inscriptions enregistrées avec succès !");
    } catch (err) {
      console.error("Erreur lors de l'inscription :", err);
      alert("Erreur lors de l'inscription");
    }
  };

  if (!course || formats.length === 0)
    return <div className="p-6">Chargement...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Inscription à : {course.nom}</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        {coureurs.map((c, index) => {
          const format = formats.find((f) => f.id === c.format_id);
          return (
            <div key={index} className="border p-4 rounded bg-gray-50 space-y-4">
              <h2 className="font-semibold">Coureur {index + 1}</h2>

              {/* Format */}
              <select
                className="border p-2 w-full"
                value={c.format_id}
                onChange={(e) =>
                  handleCoureurChange(index, "format_id", e.target.value)
                }
              >
                <option value="">-- Choisir un format --</option>
                {formats.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nom} - {f.date} ({f.distance_km} km / {f.denivele_dplus}m D+)
                  </option>
                ))}
              </select>

              {/* Infos coureur */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  className="border p-2"
                  placeholder="Nom"
                  value={c.nom}
                  onChange={(e) => handleCoureurChange(index, "nom", e.target.value)}
                />
                <input
                  className="border p-2"
                  placeholder="Prénom"
                  value={c.prenom}
                  onChange={(e) => handleCoureurChange(index, "prenom", e.target.value)}
                />
                <select
                  className="border p-2"
                  value={c.genre}
                  onChange={(e) => handleCoureurChange(index, "genre", e.target.value)}
                >
                  <option value="">Genre</option>
                  <option value="Homme">Homme</option>
                  <option value="Femme">Femme</option>
                </select>
                <input
                  type="date"
                  className="border p-2"
                  value={c.date_naissance || ""}
                  onChange={(e) => handleCoureurChange(index, "date_naissance", e.target.value)}
                />
                <input
                  className="border p-2"
                  placeholder="Nationalité"
                  value={c.nationalite}
                  onChange={(e) => handleCoureurChange(index, "nationalite", e.target.value)}
                />
                <input
                  type="email"
                  className="border p-2"
                  placeholder="Email"
                  value={c.email}
                  onChange={(e) => handleCoureurChange(index, "email", e.target.value)}
                />
                <input
                  className="border p-2"
                  placeholder="Téléphone"
                  value={c.telephone}
                  onChange={(e) => handleCoureurChange(index, "telephone", e.target.value)}
                />
                <input
                  className="border p-2"
                  placeholder="Adresse"
                  value={c.adresse}
                  onChange={(e) => handleCoureurChange(index, "adresse", e.target.value)}
                />
                <input
                  className="border p-2"
                  placeholder="Complément d'adresse"
                  value={c.adresse_complement}
                  onChange={(e) => handleCoureurChange(index, "adresse_complement", e.target.value)}
                />
                <input
                  className="border p-2"
                  placeholder="Code postal"
                  value={c.code_postal}
                  onChange={(e) => handleCoureurChange(index, "code_postal", e.target.value)}
                />
                <input
                  className="border p-2"
                  placeholder="Ville"
                  value={c.ville}
                  onChange={(e) => handleCoureurChange(index, "ville", e.target.value)}
                />
                <input
                  className="border p-2"
                  placeholder="Pays"
                  value={c.pays}
                  onChange={(e) => handleCoureurChange(index, "pays", e.target.value)}
                />
              </div>

              {/* Club et autres infos */}
              <input
                className="border p-2 w-full"
                placeholder="Club"
                value={c.club}
                onChange={(e) => handleCoureurChange(index, "club", e.target.value)}
              />
              <input
                className="border p-2 w-full"
                placeholder="Contact d'urgence (Nom)"
                value={c.contact_urgence_nom}
                onChange={(e) => handleCoureurChange(index, "contact_urgence_nom", e.target.value)}
              />
              <input
                className="border p-2 w-full"
                placeholder="Téléphone urgence"
                value={c.contact_urgence_telephone}
                onChange={(e) => handleCoureurChange(index, "contact_urgence_telephone", e.target.value)}
              />

              {/* Repas */}
              {Number(format?.stock_repas) > 0 && (
                <div>
                  <label>Nombre de repas :</label>
                  <input
                    type="number"
                    min="0"
                    max={format.stock_repas}
                    value={c.nombre_repas}
                    onChange={(e) =>
                      handleCoureurChange(index, "nombre_repas", Number(e.target.value))
                    }
                    className="border p-2 w-full"
                  />
                  <p className="text-sm text-gray-700">
                    Prix total coureur : {c.prix_total_coureur.toFixed(2)} €
                  </p>
                </div>
              )}

              {/* Supprimer coureur */}
              {coureurs.length > 1 && (
                <button
                  type="button"
                  className="bg-red-600 text-white px-3 py-1 rounded"
                  onClick={() => removeCoureur(index)}
                >
                  Supprimer ce coureur
                </button>
              )}
            </div>
          );
        })}

        {/* Boutons */}
        <button
          type="button"
          className="bg-blue-600 text-white px-4 py-2 rounded"
          onClick={addCoureur}
        >
          + Ajouter un coureur
        </button>
        <button
          type="submit"
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Confirmer l'inscription
        </button>
      </form>

      {message && <p className="text-green-700 mt-4">{message}</p>}
    </div>
  );
}
