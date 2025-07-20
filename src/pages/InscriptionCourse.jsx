
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";

export default function InscriptionCourse() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);
  const [selectedFormatId, setSelectedFormatId] = useState("");
  const [profil, setProfil] = useState({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchCourseAndFormats = async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*, formats(*)")
        .eq("id", courseId)
        .single();

      if (!error && data) {
        setCourse(data);
        setFormats(data.formats || []);
      }
    };

    const fetchProfil = async () => {
      const session = await supabase.auth.getSession();
      const user = session.data?.session?.user;
      if (!user) return;

      const { data, error } = await supabase
        .from("profils_coureurs")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!error && data) {
        setProfil(data);
      }
    };

    fetchCourseAndFormats();
    fetchProfil();
  }, [courseId]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedFormatId) {
      alert("Veuillez sélectionner un format.");
      return;
    }

    const session = await supabase.auth.getSession();
    const user = session.data?.session?.user;
    if (!user) return;

    const selectedFormat = formats.find(f => f.id === selectedFormatId);

    const inscription = {
      coureur_id: user.id,
      course_id: courseId,
      format_id: selectedFormatId,
      nom: profil.nom,
      prenom: profil.prenom,
      genre: profil.genre,
      date_naissance: profil.date_naissance,
      nationalite: profil.nationalite,
      email: profil.email,
      telephone: profil.telephone,
      adresse: profil.adresse,
      adresse_complement: profil.adresse_complement,
      code_postal: profil.code_postal,
      ville: profil.ville,
      pays: profil.pays,
      apparaitre_resultats: profil.apparaitre_resultats,
      club: profil.club,
      justificatif_type: profil.justificatif_type,
      contact_urgence_nom: profil.contact_urgence_nom,
      contact_urgence_telephone: profil.contact_urgence_telephone,
    };

    if (profil.justificatif_type === "licence" && profil.numero_licence) {
      inscription.numero_licence = profil.numero_licence;
    }

    const { error } = await supabase.from("inscriptions").insert([inscription]);

    if (error) {
      console.error("Erreur lors de l'inscription :", error);
      alert("Erreur lors de l'inscription");
      return;
    }

    // Appel de l'email via Edge Function
    try {
      await fetch("https://pecotcxpcqfkwvyylvjv.functions.supabase.co/send-inscription-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: profil.email,
          prenom: profil.prenom,
          nom: profil.nom,
          format_nom: selectedFormat.nom,
          course_nom: course.nom,
          date: selectedFormat.date,
        }),
      });
    } catch (e) {
      console.error("Erreur envoi email :", e);
    }

    setMessage("Inscription enregistrée ! Vous recevrez un email de confirmation.");
  };

  if (!course || formats.length === 0) return <div className="p-6">Chargement...</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Inscription à : {course.nom}</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
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
              <option key={f.id} value={f.id}>
                {f.nom} - {f.date} - {f.distance_km} km / {f.denivele_dplus} m D+
              </option>
            ))}
          </select>
        </div>

        <h2 className="text-xl font-bold mt-6">Récapitulatif</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-800">
          <p><strong>Nom :</strong> {profil.nom}</p>
          <p><strong>Prénom :</strong> {profil.prenom}</p>
          <p><strong>Genre :</strong> {profil.genre}</p>
          <p><strong>Date de naissance :</strong> {profil.date_naissance}</p>
          <p><strong>Email :</strong> {profil.email}</p>
          <p><strong>Téléphone :</strong> {profil.telephone}</p>
          <p><strong>Adresse :</strong> {profil.adresse}</p>
          <p><strong>Code postal :</strong> {profil.code_postal}</p>
          <p><strong>Ville :</strong> {profil.ville}</p>
          <p><strong>Pays :</strong> {profil.pays}</p>
          <p><strong>Club :</strong> {profil.club}</p>
          <p><strong>Justificatif :</strong> {profil.justificatif_type}</p>
          {profil.justificatif_type === "licence" && (
            <p><strong>Licence :</strong> {profil.numero_licence}</p>
          )}
          <p><strong>Contact urgence :</strong> {profil.contact_urgence_nom} - {profil.contact_urgence_telephone}</p>
        </div>

        <button
          type="submit"
          className="bg-green-600 text-white px-6 py-2 rounded mt-4"
        >
          Confirmer mon inscription
        </button>

        {message && <p className="text-green-700 mt-4">{message}</p>}
      </form>
    </div>
  );
}
