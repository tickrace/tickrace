// src/pages/InscriptionCourse.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";

export default function InscriptionCourse() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);
  const [selectedFormatId, setSelectedFormatId] = useState("");
  const [inscriptions, setInscriptions] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchCourseAndFormats = async () => {
      const { data, error } = await supabase
        .from("courses")
        .select(
          "*, formats(id, nom, date, distance_km, denivele_dplus, nb_max_coureurs, stock_repas, prix_repas)"
        )
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

      const { data } = await supabase
        .from("profils_utilisateurs")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data) {
        // Par défaut, 1 coureur dans la liste
        setInscriptions([{ ...data, nombre_repas: 0 }]);
      }
    };

    fetchCourseAndFormats();
    fetchProfil();
  }, [courseId]);

  const handleFieldChange = (index, field, value) => {
    setInscriptions((prev) => {
      const updated = [...prev];
      updated[index][field] = value;
      return updated;
    });
  };

  const addCoureur = () => {
    setInscriptions((prev) => [
      ...prev,
      {
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
      },
    ]);
  };

  const removeCoureur = (index) => {
    setInscriptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFormatId) {
      alert("Veuillez sélectionner un format.");
      return;
    }

    const selectedFormat = formats.find((f) => f.id === selectedFormatId);
    if (selectedFormat.inscrits + inscriptions.length > selectedFormat.nb_max_coureurs) {
      alert("Nombre de coureurs supérieur au nombre de places restantes !");
      return;
    }

    const session = await supabase.auth.getSession();
    const user = session.data?.session?.user;
    if (!user) return;

    const inscriptionsToInsert = inscriptions.map((coureur) => ({
      coureur_id: user.id,
      course_id: courseId,
      format_id: selectedFormatId,
      nom: coureur.nom,
      prenom: coureur.prenom,
      genre: coureur.genre,
      date_naissance: coureur.date_naissance,
      nationalite: coureur.nationalite,
      email: coureur.email,
      telephone: coureur.telephone,
      adresse: coureur.adresse,
      adresse_complement: coureur.adresse_complement,
      code_postal: coureur.code_postal,
      ville: coureur.ville,
      pays: coureur.pays,
      apparaitre_resultats: coureur.apparaitre_resultats,
      club: coureur.club,
      justificatif_type: coureur.justificatif_type,
      contact_urgence_nom: coureur.contact_urgence_nom,
      contact_urgence_telephone: coureur.contact_urgence_telephone,
      numero_licence: coureur.numero_licence,
      nombre_repas: coureur.nombre_repas,
      prix_total_repas:
        selectedFormat.prix_repas && coureur.nombre_repas
          ? selectedFormat.prix_repas * coureur.nombre_repas
          : 0,
    }));

    const { error } = await supabase.from("inscriptions").insert(inscriptionsToInsert);
    if (error) {
      console.error("Erreur inscription :", error);
      alert("Erreur lors de l'inscription");
      return;
    }

    setMessage("Toutes les inscriptions ont été enregistrées !");
  };

  const selectedFormat = formats.find((f) => f.id === selectedFormatId);
  const totalPrix = inscriptions.reduce(
    (sum, c) =>
      sum +
      (selectedFormat?.prix_repas && c.nombre_repas
        ? selectedFormat.prix_repas * c.nombre_repas
        : 0),
    0
  );

  if (!course || formats.length === 0) return <div className="p-6">Chargement...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Inscription à : {course.nom}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="font-semibold">Choix du format :</label>
          <select
            className="border p-2 w-full mt-1"
            value={selectedFormatId}
            onChange={(e) => setSelectedFormatId(e.target.value)}
            required
          >
            <option value="">-- Sélectionnez un format --</option>
            {formats.map((f) => (
              <option key={f.id} value={f.id} disabled={f.inscrits >= f.nb_max_coureurs}>
                {f.nom} - {f.date} - {f.distance_km} km / {f.denivele_dplus} m D+ ({f.inscrits}/
                {f.nb_max_coureurs})
              </option>
            ))}
          </select>
        </div>

        {/* Liste des coureurs */}
        {inscriptions.map((c, index) => (
          <div key={index} className="border p-4 rounded-lg bg-gray-50 shadow-md space-y-3">
            <h2 className="text-lg font-semibold">Coureur {index + 1}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Nom"
                value={c.nom}
                onChange={(e) => handleFieldChange(index, "nom", e.target.value)}
                className="border p-2 w-full"
              />
              <input
                type="text"
                placeholder="Prénom"
                value={c.prenom}
                onChange={(e) => handleFieldChange(index, "prenom", e.target.value)}
                className="border p-2 w-full"
              />
              <input
                type="text"
                placeholder="Genre"
                value={c.genre}
                onChange={(e) => handleFieldChange(index, "genre", e.target.value)}
                className="border p-2 w-full"
              />
              <input
                type="date"
                value={c.date_naissance}
                onChange={(e) => handleFieldChange(index, "date_naissance", e.target.value)}
                className="border p-2 w-full"
              />
              <input
                type="text"
                placeholder="Email"
                value={c.email}
                onChange={(e) => handleFieldChange(index, "email", e.target.value)}
                className="border p-2 w-full"
              />
              <input
                type="text"
                placeholder="Téléphone"
                value={c.telephone}
                onChange={(e) => handleFieldChange(index, "telephone", e.target.value)}
                className="border p-2 w-full"
              />
              <input
                type="text"
                placeholder="Adresse"
                value={c.adresse}
                onChange={(e) => handleFieldChange(index, "adresse", e.target.value)}
                className="border p-2 w-full"
              />
              <input
                type="text"
                placeholder="Code postal"
                value={c.code_postal}
                onChange={(e) => handleFieldChange(index, "code_postal", e.target.value)}
                className="border p-2 w-full"
              />
              <input
                type="text"
                placeholder="Ville"
                value={c.ville}
                onChange={(e) => handleFieldChange(index, "ville", e.target.value)}
                className="border p-2 w-full"
              />
              <input
                type="number"
                placeholder="Nombre de repas"
                min="0"
                value={c.nombre_repas}
                onChange={(e) =>
                  handleFieldChange(index, "nombre_repas", Number(e.target.value))
                }
                className="border p-2 w-full"
              />
            </div>
            <button
              type="button"
              onClick={() => removeCoureur(index)}
              className="bg-red-500 text-white px-3 py-1 rounded mt-2"
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

        {/* Récapitulatif */}
        {inscriptions.length > 0 && selectedFormat && (
          <div className="mt-6 p-4 bg-gray-100 rounded-lg shadow-inner">
            <h2 className="text-lg font-bold mb-3">Récapitulatif des inscriptions</h2>
            <ul className="space-y-1 text-sm text-gray-800">
              {inscriptions.map((c, idx) => (
                <li key={idx}>
                  {c.nom} {c.prenom} — {c.nombre_repas} repas (
                  {selectedFormat.prix_repas * c.nombre_repas} €)
                </li>
              ))}
            </ul>
            <p className="mt-3 font-semibold">Total : {totalPrix} €</p>
          </div>
        )}

        <button
          type="submit"
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded mt-4"
        >
          Confirmer toutes les inscriptions
        </button>

        {message && <p className="text-green-700 mt-4">{message}</p>}
      </form>
    </div>
  );
}
