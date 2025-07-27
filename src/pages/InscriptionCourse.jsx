// src/pages/InscriptionCourse.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";

export default function InscriptionCourse() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);
  const [inscriptions, setInscriptions] = useState([
    {
      nom: "",
      prenom: "",
      genre: "Homme",
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
      format_id: "",
    },
  ]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchCourseAndFormats = async () => {
      const { data, error } = await supabase
        .from("courses")
        .select(
          "*, formats(id, nom, date, distance_km, denivele_dplus, nb_max_coureurs, stock_repas, prix, prix_repas)"
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

    fetchCourseAndFormats();
  }, [courseId]);

  const handleChange = (index, e) => {
    const { name, value, type, checked } = e.target;
    const updated = [...inscriptions];
    updated[index][name] = type === "checkbox" ? checked : value;

    // Recalcul du prix total coureur si format choisi
    if (name === "format_id" || name === "nombre_repas") {
      const selectedFormat = formats.find((f) => f.id === updated[index].format_id);
      const prixBase = selectedFormat ? selectedFormat.prix || 0 : 0;
      const prixRepas =
        selectedFormat && selectedFormat.prix_repas
          ? selectedFormat.prix_repas * (updated[index].nombre_repas || 0)
          : 0;
      updated[index].prix_total_repas = prixRepas;
      updated[index].prix_total_coureur = prixBase + prixRepas;
    }

    setInscriptions(updated);
  };

  const addCoureur = () => {
    setInscriptions((prev) => [
      ...prev,
      {
        nom: "",
        prenom: "",
        genre: "Homme",
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
        format_id: "",
      },
    ]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const session = await supabase.auth.getSession();
    const user = session.data?.session?.user;

    for (const inscription of inscriptions) {
      const selectedFormat = formats.find((f) => f.id === inscription.format_id);
      if (!selectedFormat) {
        alert("Veuillez sélectionner un format pour chaque coureur.");
        return;
      }

      const payload = {
        course_id: courseId,
        format_id: inscription.format_id,
        nom: inscription.nom,
        prenom: inscription.prenom,
        genre: inscription.genre,
        date_naissance: inscription.date_naissance,
        nationalite: inscription.nationalite,
        email: inscription.email,
        telephone: inscription.telephone,
        adresse: inscription.adresse,
        adresse_complement: inscription.adresse_complement,
        code_postal: inscription.code_postal,
        ville: inscription.ville,
        pays: inscription.pays,
        apparaitre_resultats: inscription.apparaitre_resultats,
        club: inscription.club,
        justificatif_type: inscription.justificatif_type,
        contact_urgence_nom: inscription.contact_urgence_nom,
        contact_urgence_telephone: inscription.contact_urgence_telephone,
        numero_licence: inscription.numero_licence,
        nombre_repas: inscription.nombre_repas,
        prix_total_repas: inscription.prix_total_repas,
        prix_total_coureur: inscription.prix_total_coureur,
      };

      if (user) payload.coureur_id = user.id; // On met coureur_id uniquement si connecté

      const { error } = await supabase.from("inscriptions").insert([payload]);
      if (error) {
        console.error("Erreur insertion :", error);
        alert("Erreur lors de l'inscription pour " + inscription.nom);
        return;
      }
    }

    setMessage("Inscriptions enregistrées avec succès !");
  };

  if (!course) return <div className="p-6">Chargement...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Inscription à : {course.nom}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {inscriptions.map((ins, index) => {
          const selectedFormat = formats.find((f) => f.id === ins.format_id);
          return (
            <div key={index} className="border rounded-lg p-4 bg-gray-50 space-y-3">
              <h2 className="text-lg font-semibold mb-2">
                Coureur {index + 1}
              </h2>
              <input name="nom" placeholder="Nom" value={ins.nom} onChange={(e) => handleChange(index, e)} className="border p-2 w-full" required />
              <input name="prenom" placeholder="Prénom" value={ins.prenom} onChange={(e) => handleChange(index, e)} className="border p-2 w-full" required />
              
              <label className="block">
                Genre :
                <select name="genre" value={ins.genre} onChange={(e) => handleChange(index, e)} className="border p-2 w-full">
                  <option value="Homme">Homme</option>
                  <option value="Femme">Femme</option>
                </select>
              </label>

              <input type="date" name="date_naissance" value={ins.date_naissance} onChange={(e) => handleChange(index, e)} className="border p-2 w-full" />
              <input name="nationalite" placeholder="Nationalité" value={ins.nationalite} onChange={(e) => handleChange(index, e)} className="border p-2 w-full" />
              <input name="email" placeholder="Email" type="email" value={ins.email} onChange={(e) => handleChange(index, e)} className="border p-2 w-full" />
              <input name="telephone" placeholder="Téléphone" value={ins.telephone} onChange={(e) => handleChange(index, e)} className="border p-2 w-full" />
              <input name="adresse" placeholder="Adresse" value={ins.adresse} onChange={(e) => handleChange(index, e)} className="border p-2 w-full" />
              <input name="adresse_complement" placeholder="Complément adresse" value={ins.adresse_complement} onChange={(e) => handleChange(index, e)} className="border p-2 w-full" />
              <input name="code_postal" placeholder="Code postal" value={ins.code_postal} onChange={(e) => handleChange(index, e)} className="border p-2 w-full" />
              <input name="ville" placeholder="Ville" value={ins.ville} onChange={(e) => handleChange(index, e)} className="border p-2 w-full" />
              <input name="pays" placeholder="Pays" value={ins.pays} onChange={(e) => handleChange(index, e)} className="border p-2 w-full" />
              <input name="club" placeholder="Club" value={ins.club} onChange={(e) => handleChange(index, e)} className="border p-2 w-full" />
              
              <label>
                Format :
                <select
                  name="format_id"
                  value={ins.format_id}
                  onChange={(e) => handleChange(index, e)}
                  className="border p-2 w-full"
                  required
                >
                  <option value="">-- Sélectionnez un format --</option>
                  {formats.map((f) => (
                    <option key={f.id} value={f.id} disabled={f.inscrits >= f.nb_max_coureurs}>
                      {f.nom} - {f.date} - {f.distance_km} km / {f.denivele_dplus} m D+
                    </option>
                  ))}
                </select>
              </label>

              {Number(selectedFormat?.stock_repas) > 0 && (
                <label>
                  Nombre de repas :
                  <input
                    type="number"
                    name="nombre_repas"
                    min="0"
                    max={selectedFormat.stock_repas}
                    value={ins.nombre_repas}
                    onChange={(e) => handleChange(index, e)}
                    className="border p-2 w-full"
                  />
                  <p className="text-sm text-gray-600">
                    Prix repas total : {ins.prix_total_repas} €  
                    — Total coureur : {ins.prix_total_coureur} €
                  </p>
                </label>
              )}
            </div>
          );
        })}

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
