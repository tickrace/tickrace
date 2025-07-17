import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";

export default function InscriptionCourse() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourseAndProfile = async () => {
      if (!courseId) {
        console.error("courseId est undefined !");
        setLoading(false);
        return;
      }

      // Récupérer la course
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

      // Récupérer l'utilisateur
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (user && user.id) {
        const { data: profileData, error: profileError } = await supabase
          .from("profils_coureurs")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (profileError) {
          console.error("Erreur récupération profil coureur :", profileError.message);
        } else {
          setProfile(profileData);
        }
      }

      setLoading(false);
    };

    fetchCourseAndProfile();
  }, [courseId]);

  if (loading) return <p className="p-6">Chargement...</p>;
  if (!course) return <p className="p-6">Course introuvable.</p>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Inscription à : {course.nom}</h1>

      {profile ? (
        <div className="bg-gray-50 border p-4 rounded">
          <p><strong>Nom :</strong> {profile.nom} {profile.prenom}</p>
          <p><strong>Email :</strong> {profile.email}</p>
          <p><strong>Genre :</strong> {profile.genre}</p>
          <p><strong>Date de naissance :</strong> {profile.date_naissance}</p>
          <p><strong>Nationalité :</strong> {profile.nationalite}</p>
          {/* Ajoute les autres champs ici selon le modèle */}
        </div>
      ) : (
        <p>Votre profil n’a pas encore été complété.</p>
      )}

      {/* Ajoute ici un bouton de validation ou un formulaire de confirmation si souhaité */}
    </div>
  );
}
