// src/pages/MonEspaceOrganisateur.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import CardEpreuve from "../components/CardEpreuve";

export default function MonEspaceOrganisateur() {
  const [courses, setCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCourses = async () => {
      const session = await supabase.auth.getSession();
      const userId = session.data?.session?.user?.id;
      if (!userId) return;

      const { data, error } = await supabase
        .from("courses")
        .select("*, formats(*)")
        .eq("organisateur_id", userId)
        .order("created_at", { ascending: false });

      if (!error) setCourses(data);
      setIsLoading(false);
    };
    fetchCourses();
  }, []);

  if (isLoading) return <p className="p-4">Chargement...</p>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">🎽 Mon espace organisateur</h1>
        <button
          onClick={() => navigate("/nouvelle-course")}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          + Nouvelle épreuve
        </button>
      </div>

      {courses.length === 0 ? (
        <p>Aucune épreuve encore créée.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {courses.map((course) => (
            <CardEpreuve key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}
