// src/pages/ModifierCourse.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { v4 as uuidv4 } from "uuid";

export default function ModifierCourse() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);

  useEffect(() => {
    const fetchCourseAndFormats = async () => {
      const { data: courseData } = await supabase.from("courses").select("*").eq("id", id).single();
      const { data: formatsData } = await supabase.from("formats").select("*").eq("course_id", id);

      setCourse(courseData);
      setFormats(
        formatsData.map((f) => ({
          ...f,
          id: f.id || uuidv4(),
        }))
      );
    };

    fetchCourseAndFormats();
  }, [id]);

  const handleCourseChange = (e) => {
    const { name, value } = e.target;
    setCourse((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormatChange = (index, e) => {
    const { name, value } = e.target;
    setFormats((prev) => {
      const newFormats = [...prev];
      newFormats[index][name] = value;
      return newFormats;
    });
  };

  const ajouterFormat = () => {
    setFormats((prev) => [
      ...prev,
      {
        id: uuidv4(),
        nom: "",
        date: "",
        heure_depart: "",
        distance_km: "",
        denivele_dplus: "",
        denivele_dmoins: "",
      },
    ]);
  };

  const supprimerFormat = (index) => {
    setFormats((prev) => prev.filter((_, i) => i !== index));
  };

  const dupliquerFormat = (index) => {
    const formatToDuplicate = formats[index];
    const newFormat = {
      ...formatToDuplicate,
      id: uuidv4(),
      nom: `${formatToDuplicate.nom} (copie)`
    };
    const updatedFormats = [
      ...formats.slice(0, index + 1),
      newFormat,
      ...formats.slice(index + 1),
    ];
    setFormats(updatedFormats);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    await supabase
      .from("courses")
      .update({ nom: course.nom, lieu: course.lieu, departement: course.departement })
      .eq("id", id);

    await supabase.from("formats").delete().eq("course_id", id);

    for (const format of formats) {
      await supabase.from("formats").insert({
        ...format,
        course_id: id,
      });
    }

    alert("Épreuve mise à jour");
    navigate("/organisateur/mon-espace");
  };

  if (!course) return <div>Chargement...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Modifier l’épreuve</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <input name="nom" value={course.nom} onChange={handleCourseChange} className="border p-2 w-full" />
        <input name="lieu" value={course.lieu} onChange={handleCourseChange} className="border p-2 w-full" />
        <input name="departement" value={course.departement} onChange={handleCourseChange} className="border p-2 w-full" />

        <h2 className="text-xl font-semibold mt-6">Formats</h2>
        {formats.map((format, index) => (
          <div key={format.id} className="border p-4 my-4 bg-gray-50 rounded space-y-2">
            <input
              name="nom"
              placeholder="Nom du format"
              value={format.nom}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
            />
            <input
              type="date"
              name="date"
              value={format.date}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
            />
            <input
              type="time"
              name="heure_depart"
              value={format.heure_depart}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
            />
            <input
              name="distance_km"
              placeholder="Distance (km)"
              value={format.distance_km}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
            />
            <input
              name="denivele_dplus"
              placeholder="D+"
              value={format.denivele_dplus}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
            />
            <input
              name="denivele_dmoins"
              placeholder="D-"
              value={format.denivele_dmoins}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
            />
            <div className="flex gap-4">
              <button type="button" onClick={() => dupliquerFormat(index)} className="text-sm text-blue-600">Dupliquer</button>
              <button type="button" onClick={() => supprimerFormat(index)} className="text-sm text-red-600">Supprimer</button>
            </div>
          </div>
        ))}

        <button type="button" onClick={ajouterFormat} className="bg-blue-600 text-white px-4 py-2 rounded">
          + Ajouter un format
        </button>
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">
          ✅ Enregistrer les modifications
        </button>
      </form>
    </div>
  );
}
