import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function Courses() {
const [courses, setCourses] = useState([]);
const [loading, setLoading] = useState(true);
const BASE_IMAGE_URL =
"https://pecotcxpcqfkwvyylvjv.supabase.co/storage/v1/object/public/courses/";

useEffect(() => {
const fetchCourses = async () => {
const { data, error } = await supabase
.from("courses")
.select("id, nom, sous_nom, lieu, date, image_url");

  if (error) {
    console.error("Erreur de chargement des courses :", error.message);
  } else {
    setCourses(data);
  }

  setLoading(false);
};

fetchCourses();

}, []);

if (loading) return <p className="p-6">Chargement...</p>;

return (
<div className="p-6">
<h2 className="text-2xl font-bold mb-4">Toutes les courses</h2>
{courses.length === 0 ? (
<p>Aucune course enregistrée.</p>
) : (
<ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
{courses.map((course) => (
<li key={course.id} className="border p-4 rounded shadow hover:shadow-md transition" >
{course.image_url ? (
<img
src={${BASE_IMAGE_URL}${course.image_url}}
alt={Visuel de ${course.nom}}
className="w-full h-40 object-cover rounded mb-4"
onError={(e) => {
e.target.onerror = null;
e.target.src = "/default-thumbnail.jpg"; // Image fallback si non chargée
}}
/>
) : (
<div className="w-full h-40 bg-gray-200 rounded flex items-center justify-center text-gray-500 mb-4">
Aucune image
</div>
)}
<p className="font-semibold text-lg">{course.nom}</p>
{course.sous_nom && (
<p className="text-sm text-gray-600">{course.sous_nom}</p>
)}
<p className="text-sm text-gray-700">
{course.lieu} – {course.date}
</p>
</li>
))}
</ul>
)}
</div>
);
}