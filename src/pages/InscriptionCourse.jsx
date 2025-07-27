// src/pages/InscriptionCourse.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";

export default function InscriptionCourse() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);
  const [inscriptions, setInscriptions] = useState([]);
  const [message, setMessage] = useState("");

  const defaultCoureur = {
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
    prix_total_repas: 0,
    prix_total_coureur: 0,
  };

  useEffect(() => {
    const fetchCourseAndFormats = async () => {
      const { data, error } = await supabase
        .from("courses")
        .select(
          "*, formats(id, nom, date, distance_km, denivele_dplus, nb_max_coureurs, prix, stock_repas, prix_repas)"
        )
        .eq("id", courseId)
        .single();

      if (error || !data) return;

      const formatsWithCount = await Promise.all(
        (data.formats || []).map(async (f) => {
          const { count, error: countError } = await supabase
            .from("inscriptions")
            .select("*", { count: "exact", head: true })
            .eq("format_id", f.id);

          return {
            ...f,
            inscrits: countError ? 0 : count,
          };
        })
      );

      setCourse(data);
      setFormats(formatsWithCount);
    };

    fetchCourseAndFormats();
  }, [courseId]);

  const handleCoureurChange = (index, e) => {
    const { name, value, type, checked } = e.target;
    setInscriptions((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [name]: type === "checkbox" ? checked : value,
      };
      // Recalcul du prix total si format_id ou nombre_repas changent
      if (name === "format_id" || name === "nombre_repas") {
        updated[index] = calculatePrixTotal(updated[index]);
      }
      return updated;
    });
  };

  const calculatePrixTotal = (coureur) => {
    const format = formats.find((f) => f.id === coureur.format_id);
    if (!format) return coureur;
    const prix_repas = format.prix_repas || 0;
    const prix_format = format.prix || 0;
    const total_repas = coureur.nombre_repas * prix_repas;
    return {
      ...coureur,
      prix_total_repas: total_repas,
      prix_total_coureur: total_repas + prix_format,
    };
  };

  const addCoureur = () => {
    setInscriptions((prev) => [...prev, { ...defaultCoureur }]);
  };

  const removeCoureur = (index) => {
    setInscriptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (inscriptions.length === 0) {
      alert("Ajoutez au moins un coureur.");
      return;
    }

    const session = await supabase.auth.getSession();
    const user = session.data?.session?.user;

    const inscriptionsToSave = inscriptions.map((coureur, index) => ({
      ...coureur,
      course_id: courseId,
      coureur_id: index === 0 && user ? user.id : null, // seul le 1er coureur = user connecté
    }));

    const { error } = await supabase.from("inscriptions").insert(inscriptionsToSave);

    if (error) {
      console.error("Erreur inscription :", error);
      alert("Erreur lors de l'inscription");
      return;
    }

    setMessage("Inscriptions enregistrées ! Un email de confirmation sera envoyé.");
  };

  if (!course || formats.length === 0)
    return <div className="p-6">Chargement...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Inscription à : {course.nom}</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        {inscriptions.map((coureur, index) => (
          <div key={index} className="border p-4 rounded-lg bg-gray-50 space-y-3">
            <h3 className="font-semibold text-lg mb-2">Coureur {index + 1}</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                name="nom"
                placeholder="Nom"
                value={coureur.nom}
                onChange={(e) => handleCoureurChange(index, e)}
                className="border p-2 w-full"
              />
              <input
                name="prenom"
                placeholder="Prénom"
                value={coureur.prenom}
                onChange={(e) => handleCoureurChange(index, e)}
                className="border p-2 w-full"
              />
              <select
                name="genre"
                value={coureur.genre}
                onChange={(e) => handleCoureurChange(index, e)}
                className="border p-2 w-full"
              >
                <option value="">-- Genre --</option>
                <option value="Homme">Homme</option>
                <option value="Femme">Femme</option>
              </select>
              <input
                type="date"
                name="date_naissance"
                value={coureur.date_naissance}
                onChange={(e) => handleCoureurChange(index, e)}
                className="border p-2 w-full"
              />
              <input
                name="nationalite"
                placeholder="Nationalité"
                value={coureur.nationalite}
                onChange={(e) => handleCoureurChange(index, e)}
                className="border p-2 w-full"
              />
              <input
                name="email"
                placeholder="Email"
                value={coureur.email}
                onChange={(e) => handleCoureurChange(index, e)}
                className="border p-2 w-full"
              />
              <input
                name="telephone"
                placeholder="Téléphone"
                value={coureur.telephone}
                onChange={(e) => handleCoureurChange(index, e)}
                className="border p-2 w-full"
              />
              <input
                name="adresse"
                placeholder="Adresse"
                value={coureur.adresse}
                onChange={(e) => handleCoureurChange(index, e)}
                className="border p-2 w-full"
              />
              <input
                name="adresse_complement"
                placeholder="Complément d'adresse"
                value={coureur.adresse_complement}
                onChange={(e) => handleCoureurChange(index, e)}
                className="border p-2 w-full"
              />
              <input
                name="code_postal"
                placeholder="Code postal"
                value={coureur.code_postal}
                onChange={(e) => handleCoureurChange(index, e)}
                className="border p-2 w-full"
              />
              <input
                name="ville"
                placeholder="Ville"
                value={coureur.ville}
                onChange={(e) => handleCoureurChange(index, e)}
                className="border p-2 w-full"
              />
              <input
                name="pays"
                placeholder="Pays"
                value={coureur.pays}
                onChange={(e) => handleCoureurChange(index, e)}
                className="border p-2 w-full"
              />
            </div>

            <select
              name="format_id"
              value={coureur.format_id}
              onChange={(e) => handleCoureurChange(index, e)}
              className="border p-2 w-full"
              required
            >
              <option value="">-- Sélectionnez un format --</option>
              {formats.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nom} - {f.date} - {f.distance_km} km / {f.denivele_dplus} m D+
                </option>
              ))}
            </select>

            {Number(
              formats.find((f) => f.id === coureur.format_id)?.stock_repas || 0
            ) > 0 && (
              <div>
                <label>Nombre de repas :</label>
                <input
                  type="number"
                  name="nombre_repas"
                  value={coureur.nombre_repas}
                  onChange={(e) =>
                    handleCoureurChange(index, {
                      ...e,
                      target: { ...e.target, value: Number(e.target.value) },
                    })
                  }
                  className="border p-2 w-full"
                  min="0"
                  max={
                    formats.find((f) => f.id === coureur.format_id)?.stock_repas ||
                    0
                  }
                />
                <p className="text-sm text-gray-600">
                  Prix total repas : {coureur.prix_total_repas} € — Prix total :{" "}
                  {coureur.prix_total_coureur} €
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => removeCoureur(index)}
              className="bg-red-500 text-white px-4 py-1 rounded"
            >
              Supprimer ce coureur
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addCoureur}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          + Ajouter un coureur
        </button>

        <button
          type="submit"
          className="bg-green-600 text-white px-6 py-2 rounded mt-4"
        >
          Confirmer les inscriptions
        </button>

        {message && <p className="text-green-700 mt-4">{message}</p>}
      </form>
    </div>
  );
}
