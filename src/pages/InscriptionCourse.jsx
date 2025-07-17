import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";

export default function InscriptionCourse() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [profil, setProfil] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage("Vous devez être connecté pour vous inscrire.");
        setLoading(false);
        return;
      }

      setUser(user);

      const { data: profilData, error: profilError } = await supabase
        .from("profils_coureurs")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profilError) {
        console.error("Erreur récupération profil coureur :", profilError.message);
      } else {
        setProfil(profilData);
      }

      const { data: courseData, error: courseError } = await supabase
        .from("courses")
        .select("*")
        .eq("id", courseId)
        .single();

      if (courseError) {
        console.error("Erreur récupération course :", courseError.message);
      } else {
        setCourse(courseData);
      }

      setLoading(false);
    };

    fetchData();
  }, [courseId]);

  const handleInscription = async () => {
    if (!user || !profil || !course) return;

    const { error } = await supabase.from("inscriptions").insert([
      {
        course_id: course.id,
        user_id: user.id,
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
      },
    ]);

    if (error) {
      console.error("Erreur lors de l'inscription :", error.message);
      setMessage("Une erreur est survenue lors de l'inscription.");
    } else {
      setMessage("Inscription réussie !");
    }
  };

  if (loading) return <p className="p-6">Chargement...</p>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Inscription à l’épreuve</h1>

      {course && (
        <div className="mb-4">
          <p className="text-lg font-semibold">{course.nom}</p>
          {course.sous_nom && <p className="text-gray-600">{course.sous_nom}</p>}
          <p className="text-sm">{course.lieu} – {new Date(course.date).toLocaleDateString()}</p>
        </div>
      )}

      {profil ? (
        <>
          <p className="mb-4">Vous êtes connecté en tant que <strong>{profil.prenom} {profil.nom}</strong>.</p>
          <button
            onClick={handleInscription}
            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Confirmer mon inscription
          </button>
        </>
      ) : (
        <p className="text-red-600">Aucun profil coureur trouvé. Veuillez compléter votre profil avant de vous inscrire.</p>
      )}

      {message && <p className="mt-4 text-blue-600">{message}</p>}
    </div>
  );
}
