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
        .select("*, formats(id, nom, date, distance_km, denivele_dplus, prix, nb_max_coureurs, stock_repas, prix_repas)")
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

    fetchCourseAndFormats();
  }, [courseId]);

  const handleAddInscription = () => {
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
        prix_total_repas: 0,
        prix_total_inscription: 0,
      },
    ]);
  };

  const handleInscriptionChange = (index, e) => {
    const { name, value, type, checked } = e.target;
    const updated = [...inscriptions];
    updated[index][name] = type === "checkbox" ? checked : value;

    if (name === "nombre_repas") {
      const format = formats.find((f) => f.id === selectedFormatId);
      const prixRepas = Number(format?.prix_repas || 0);
      const prixBase = Number(format?.prix || 0);
      updated[index].nombre_repas = Number(value);
      updated[index].prix_total_repas = prixRepas * updated[index].nombre_repas;
      updated[index].prix_total_inscription =
        prixBase + updated[index].prix_total_repas;
    }
    setInscriptions(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFormatId) return alert("Veuillez sélectionner un format.");

    const format = formats.find((f) => f.id === selectedFormatId);
    if (!format) return;

    for (const ins of inscriptions) {
      const inscription = {
        course_id: courseId,
        format_id: selectedFormatId,
        ...ins,
        prix_total_repas: ins.prix_total_repas,
        prix_total_inscription: Number(format.prix || 0) + Number(ins.prix_total_repas),
      };

      const { error } = await supabase.from("inscriptions").insert([inscription]);
      if (error) {
        console.error("Erreur insertion :", error);
        alert("Erreur lors de l'inscription pour " + ins.nom);
        return;
      }
    }

    setMessage("Toutes les inscriptions ont été enregistrées !");
  };

  const selectedFormat = formats.find((f) => f.id === selectedFormatId);

  if (!course || formats.length === 0)
    return <div className="p-6">Chargement...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">
        Inscriptions à : {course.nom}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="font-semibold">Choix du format :</label>
          <select
            className="border p-2 w-full"
            value={selectedFormatId}
            onChange={(e) => setSelectedFormatId(e.target.value)}
            required
          >
            <option value="">-- Sélectionnez un format --</option>
            {formats.map((f) => (
              <option
                key={f.id}
                value={f.id}
                disabled={f.inscrits >= f.nb_max_coureurs}
              >
                {f.nom} - {f.date} - {f.distance_km} km / {f.denivele_dplus} m D+ (
                {f.inscrits}/{f.nb_max_coureurs})
              </option>
            ))}
          </select>
        </div>

        {/* Formulaires de coureurs */}
        {inscriptions.map((ins, idx) => (
          <div
            key={idx}
            className="border p-4 rounded bg-gray-50 space-y-2"
          >
            <h3 className="text-lg font-semibold">Coureur {idx + 1}</h3>
            <input name="nom" value={ins.nom} onChange={(e) => handleInscriptionChange(idx, e)} className="border p-2 w-full" placeholder="Nom" />
            <input name="prenom" value={ins.prenom} onChange={(e) => handleInscriptionChange(idx, e)} className="border p-2 w-full" placeholder="Prénom" />
            <input name="genre" value={ins.genre} onChange={(e) => handleInscriptionChange(idx, e)} className="border p-2 w-full" placeholder="Genre" />
            <input type="date" name="date_naissance" value={ins.date_naissance} onChange={(e) => handleInscriptionChange(idx, e)} className="border p-2 w-full" />
            <input name="nationalite" value={ins.nationalite} onChange={(e) => handleInscriptionChange(idx, e)} className="border p-2 w-full" placeholder="Nationalité" />
            <input type="email" name="email" value={ins.email} onChange={(e) => handleInscriptionChange(idx, e)} className="border p-2 w-full" placeholder="Email" />
            <input name="telephone" value={ins.telephone} onChange={(e) => handleInscriptionChange(idx, e)} className="border p-2 w-full" placeholder="Téléphone" />
            <input name="adresse" value={ins.adresse} onChange={(e) => handleInscriptionChange(idx, e)} className="border p-2 w-full" placeholder="Adresse" />
            <input name="adresse_complement" value={ins.adresse_complement} onChange={(e) => handleInscriptionChange(idx, e)} className="border p-2 w-full" placeholder="Complément d'adresse" />
            <input name="code_postal" value={ins.code_postal} onChange={(e) => handleInscriptionChange(idx, e)} className="border p-2 w-full" placeholder="Code postal" />
            <input name="ville" value={ins.ville} onChange={(e) => handleInscriptionChange(idx, e)} className="border p-2 w-full" placeholder="Ville" />
            <input name="pays" value={ins.pays} onChange={(e) => handleInscriptionChange(idx, e)} className="border p-2 w-full" placeholder="Pays" />
            <input name="club" value={ins.club} onChange={(e) => handleInscriptionChange(idx, e)} className="border p-2 w-full" placeholder="Club" />
            <input name="justificatif_type" value={ins.justificatif_type} onChange={(e) => handleInscriptionChange(idx, e)} className="border p-2 w-full" placeholder="Justificatif" />
            <input name="numero_licence" value={ins.numero_licence} onChange={(e) => handleInscriptionChange(idx, e)} className="border p-2 w-full" placeholder="Licence (si applicable)" />
            <input name="contact_urgence_nom" value={ins.contact_urgence_nom} onChange={(e) => handleInscriptionChange(idx, e)} className="border p-2 w-full" placeholder="Nom contact urgence" />
            <input name="contact_urgence_telephone" value={ins.contact_urgence_telephone} onChange={(e) => handleInscriptionChange(idx, e)} className="border p-2 w-full" placeholder="Téléphone contact urgence" />

            {/* Gestion des repas */}
            {Number(selectedFormat?.stock_repas) > 0 && (
              <div>
                <label className="font-semibold">Nombre de repas :</label>
                <input
                  type="number"
                  min="0"
                  max={selectedFormat.stock_repas}
                  value={ins.nombre_repas}
                  name="nombre_repas"
                  onChange={(e) => handleInscriptionChange(idx, e)}
                  className="border p-2 w-full"
                />
                <p className="text-sm text-gray-600">
                  Prix repas : {selectedFormat.prix_repas} € — Total repas : {ins.prix_total_repas} € — Total inscription : {ins.prix_total_inscription} €
                </p>
              </div>
            )}
          </div>
        ))}

        <button type="button" onClick={handleAddInscription} className="bg-blue-600 text-white px-4 py-2 rounded">
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
