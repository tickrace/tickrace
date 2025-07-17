import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";

export default function InscriptionCourse() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchCourseAndProfile = async () => {
      const { data: courseData, error: courseError } = await supabase
        .from("courses")
        .select("*")
        .eq("id", courseId)
        .single();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage("Vous devez être connecté pour vous inscrire.");
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profils_coureurs")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (courseError || profileError) {
        console.error("Erreur :", courseError || profileError);
        return;
      }

      setCourse(courseData);
      setProfile(profileData);
    };

    fetchCourseAndProfile();
  }, [courseId]);

  const handleInscription = async () => {
    if (!course || !profile) return;

    const { data, error } = await supabase.from("inscriptions").insert([
      {
        course_id: course.id,
        user_id: profile.user_id,
        nom: profile.nom,
        prenom: profile.prenom,
        genre: profile.genre,
        date_naissance: profile.date_naissance,
        nationalite: profile.nationalite,
        email: profile.email,
        telephone: profile.telephone,
        adresse: profile.adresse,
        code_postal: profile.code_postal,
        ville: profile.ville,
        pays: profile.pays,
        club: profile.club,
        justificatif: profile.justificatif,
        contact_urgence_nom: profile.contact_urgence_nom,
        contact_urgence_tel: profile.contact_urgence_tel,
        apparaitre_resultats: profile.apparaitre_resultats,
      },
    ]);

    if (error) {
      console.error("Erreur inscription :", error.message);
      setMessage("Une erreur est survenue lors de l'inscription.");
    } else {
      setMessage("Inscription réussie !");
    }
  };

  if (!course) return <p className="p-6">Chargement...</p>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Inscription à {course.nom}</h1>

      {profile ? (
        <>
          <p className="mb-4">Vous êtes sur le point de vous inscrire à cette course avec les informations de votre profil.</p>
          <button
            onClick={handleInscription}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Confirmer mon inscription
          </button>
        </>
      ) : (
        <p>Veuillez compléter votre profil coureur avant de vous inscrire.</p>
      )}

      {message && <p className="mt-4 text-sm text-green-600">{message}</p>}
    </div>
  );
}
