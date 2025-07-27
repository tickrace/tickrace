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

  useEffect(() => {
    const fetchCourseAndFormats = async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*, formats(id, nom, prix, date, distance_km, denivele_dplus, nb_max_coureurs, stock_repas, prix_repas)")
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

      const { data: profil } = await supabase
        .from("profils_utilisateurs")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (profil) {
        addInscription({
          ...defaultCoureur(),
          ...profil,
          coureur_id: user.id,
          prix_total_coureur: 0,
        });
      } else {
        addInscription(defaultCoureur());
      }
    };

    fetchCourseAndFormats();
    fetchProfil();
  }, [courseId]);

  const defaultCoureur = () => ({
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

  const addInscription = (inscription = defaultCoureur()) => {
    setInscriptions((prev) => [...prev, inscription]);
  };

  const removeInscription = (index) => {
    setInscriptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleChange = (index, e) => {
    const { name, value, type, checked } = e.target;
    const updated = [...inscriptions];
    updated[index][name] = type === "checkbox" ? checked : value;

    if (name === "format_id" || name === "nombre_repas") {
      const selectedFormat = formats.find((f) => f.id === updated[index].format_id);
      if (selectedFormat) {
        const prixRepas = selectedFormat.prix_repas || 0;
        const prixInscription = selectedFormat.prix || 0;
        const totalRepas = prixRepas * (parseInt(updated[index].nombre_repas) || 0);
        updated[index].prix_total_repas = totalRepas;
        updated[index].prix_total_coureur = prixInscription + totalRepas;
      }
    }

    setInscriptions(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    for (const inscription of inscriptions) {
      if (!inscription.format_id) {
        alert("Veuillez sélectionner un format pour chaque coureur.");
        return;
      }

      const selectedFormat = formats.find((f) => f.id === inscription.format_id);
      if (selectedFormat.inscrits >= selectedFormat.nb_max_coureurs) {
        alert(`Le format ${selectedFormat.nom} est complet.`);
        return;
      }

      const { error } = await supabase.from("inscriptions").insert([{
        ...inscription,
        course_id: courseId,
        format_id: inscription.format_id,
      }]);

      if (error) {
        console.error("Erreur insertion :", error);
        alert("Erreur lors de l'inscription");
        return;
      }

      try {
        await fetch("https://pecotcxpcqfkwvyylvjv.functions.supabase.co/send-inscription-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_KEY}`,
          },
          body: JSON.stringify({
            email: inscription.email,
            prenom: inscription.prenom,
            nom: inscription.nom,
            format_nom: selectedFormat.nom,
            course_nom: course.nom,
            date: selectedFormat.date,
          }),
        });
      } catch (e) {
        console.error("Erreur email :", e);
      }
    }

    setMessage("Inscriptions enregistrées ! Vous recevrez un email de confirmation.");
  };

  if (!course || formats.length === 0) return <div className="p-6">Chargement...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Inscription à : {course.nom}</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        {inscriptions.map((inscription, index) => {
          const selectedFormat = formats.find((f) => f.id === inscription.format_id);
          return (
            <div key={index} className="border p-4 rounded bg-gray-50 space-y-3">
              <h2 className="text-lg font-semibold">Coureur {index + 1}</h2>

              <div>
                <label className="font-semibold">Format :</label>
                <select
                  name="format_id"
                  value={inscription.format_id}
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input name="nom" placeholder="Nom" value={inscription.nom} onChange={(e) => handleChange(index, e)} className="border p-2 w-full" />
                <input name="prenom" placeholder="Prénom" value={inscription.prenom} onChange={(e) => handleChange(index, e)} className="border p-2 w-full" />
                <select name="genre" value={inscription.genre} onChange={(e) => handleChange(index, e)} className="border p-2 w-full">
                  <option value="">Genre</option>
                  <option value="Homme">Homme</option>
                  <option value="Femme">Femme</option>
                </select>
                <input type="date" name="date_naissance" value={inscription.date_naissance} onChange={(e) => handleChange(index, e)} className="border p-2 w-full" />
                <input name="nationalite" placeholder="Nationalité" value={inscription.nationalite} onChange={(e) => handleChange(index, e)} className="border p-2 w-full" />
                <input name="email" placeholder="Email" value={inscription.email} onChange={(e) => handleChange(index, e)} className="border p-2 w-full" />
                <input name="telephone" placeholder="Téléphone" value={inscription.telephone} onChange={(e) => handleChange(index, e)} className="border p-2 w-full" />
                <input name="adresse" placeholder="Adresse" value={inscription.adresse} onChange={(e) => handleChange(index, e)} className="border p-2 w-full" />
                <input name="adresse_complement" placeholder="Complément adresse" value={inscription.adresse_complement} onChange={(e) => handleChange(index, e)} className="border p-2 w-full" />
                <input name="code_postal" placeholder="Code postal" value={inscription.code_postal} onChange={(e) => handleChange(index, e)} className="border p-2 w-full" />
                <input name="ville" placeholder="Ville" value={inscription.ville} onChange={(e) => handleChange(index, e)} className="border p-2 w-full" />
                <input name="pays" placeholder="Pays" value={inscription.pays} onChange={(e) => handleChange(index, e)} className="border p-2 w-full" />
                <input name="club" placeholder="Club" value={inscription.club} onChange={(e) => handleChange(index, e)} className="border p-2 w-full" />
              </div>

              {/* Résultats */}
              <div>
                <label className="font-semibold">Résultats :</label>
                <div className="flex gap-4">
                  <label>
                    <input type="radio" name={`apparaitre_resultats-${index}`} checked={inscription.apparaitre_resultats === true} onChange={() => handleChange(index, { target: { name: "apparaitre_resultats", value: true } })} /> Oui
                  </label>
                  <label>
                    <input type="radio" name={`apparaitre_resultats-${index}`} checked={inscription.apparaitre_resultats === false} onChange={() => handleChange(index, { target: { name: "apparaitre_resultats", value: false } })} /> Non
                  </label>
                </div>
              </div>

              {/* Justificatif */}
              <div>
                <label className="font-semibold">Justificatif :</label>
                <select name="justificatif_type" value={inscription.justificatif_type} onChange={(e) => handleChange(index, e)} className="border p-2 w-full">
                  <option value="">-- Sélectionnez --</option>
                  <option value="licence">Licence FFA</option>
                  <option value="pps">PPS (Parcours Prévention Santé)</option>
                </select>
                {inscription.justificatif_type === "licence" && (
                  <input name="numero_licence" placeholder="Numéro de licence" value={inscription.numero_licence} onChange={(e) => handleChange(index, e)} className="border p-2 w-full mt-2" />
                )}
              </div>

              {/* Contact urgence */}
              <input name="contact_urgence_nom" placeholder="Contact urgence - Nom" value={inscription.contact_urgence_nom} onChange={(e) => handleChange(index, e)} className="border p-2 w-full" />
              <input name="contact_urgence_telephone" placeholder="Contact urgence - Téléphone" value={inscription.contact_urgence_telephone} onChange={(e) => handleChange(index, e)} className="border p-2 w-full" />

              {/* Repas */}
              {Number(selectedFormat?.stock_repas) > 0 && (
                <div>
                  <label className="font-semibold">Nombre de repas :</label>
                  <input type="number" min="0" max={selectedFormat.stock_repas} name="nombre_repas" value={inscription.nombre_repas} onChange={(e) => handleChange(index, e)} className="border p-2 w-full" />
                  <p className="text-sm text-gray-600">Prix unitaire : {selectedFormat.prix_repas} € — Total : {inscription.prix_total_coureur} €</p>
                </div>
              )}

              <button type="button" onClick={() => removeInscription(index)} className="bg-red-500 text-white px-3 py-1 rounded">Supprimer</button>
            </div>
          );
        })}

        <button type="button" onClick={() => addInscription()} className="bg-blue-500 text-white px-4 py-2 rounded">+ Ajouter un coureur</button>
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">Confirmer les inscriptions</button>
        {message && <p className="text-green-700 mt-4">{message}</p>}
      </form>
    </div>
  );
}
