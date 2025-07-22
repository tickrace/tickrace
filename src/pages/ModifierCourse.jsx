// src/pages/ModifierCourse.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

export default function ModifierCourse() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCourse();
    fetchFormats();
  }, []);

  const fetchCourse = async () => {
    const { data } = await supabase.from("courses").select("*").eq("id", id).single();
    setCourse(data);
  };

  const fetchFormats = async () => {
    const { data } = await supabase.from("formats").select("*").eq("course_id", id);
    setFormats(data.map((f) => ({
      ...f,
      propose_repas: f.prix_repas && f.nombre_repas ? true : false,
    })));
  };

  const handleCourseChange = (e) => {
    const { name, value } = e.target;
    setCourse((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormatChange = (index, e) => {
    const { name, value, type, checked } = e.target;
    const newFormats = [...formats];
    const format = newFormats[index];

    if (name === "propose_repas") {
      format.propose_repas = checked;
      if (!checked) {
        format.prix_repas = null;
        format.nombre_repas = null;
      }
    } else {
      format[name] = type === "number" ? parseFloat(value) : value;
    }

    // recalcul du prix total
    const prixBase = parseFloat(format.prix) || 0;
    const prixRepas = format.propose_repas ? (parseFloat(format.prix_repas) || 0) * (parseInt(format.nombre_repas) || 0) : 0;
    format.prix_total_repas = prixRepas;
    format.prix_total_inscription = prixBase + prixRepas;

    setFormats(newFormats);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    await supabase.from("courses").update({
      nom: course.nom,
      lieu: course.lieu,
      departement: course.departement,
      presentation: course.presentation,
    }).eq("id", id);

    for (const f of formats) {
      await supabase.from("formats").update({
        nom: f.nom,
        date: f.date,
        heure_depart: f.heure_depart,
        prix: f.prix,
        prix_repas: f.propose_repas ? f.prix_repas : null,
        nombre_repas: f.propose_repas ? f.nombre_repas : null,
        prix_total_repas: f.propose_repas ? f.prix_total_repas : null,
        prix_total_inscription: f.propose_repas ? f.prix_total_inscription : f.prix,
      }).eq("id", f.id);
    }

    alert("Modifications enregistrées");
    navigate("/organisateur/mon-espace");
  };

  if (!course) return <p>Chargement...</p>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Modifier l’épreuve</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <input name="nom" value={course.nom} onChange={handleCourseChange} className="border p-2 w-full" placeholder="Nom" />
        <input name="lieu" value={course.lieu} onChange={handleCourseChange} className="border p-2 w-full" placeholder="Lieu" />
        <input name="departement" value={course.departement} onChange={handleCourseChange} className="border p-2 w-full" placeholder="Département" />
        <textarea name="presentation" value={course.presentation} onChange={handleCourseChange} className="border p-2 w-full" placeholder="Présentation" />

        <h2 className="text-lg font-semibold mt-6">Formats</h2>
        {formats.map((f, i) => (
          <div key={f.id} className="border p-4 my-4 space-y-2 bg-gray-50 rounded">
            <input name="nom" value={f.nom} onChange={(e) => handleFormatChange(i, e)} className="border p-2 w-full" placeholder="Nom format" />
            <input name="date" type="date" value={f.date || ""} onChange={(e) => handleFormatChange(i, e)} className="border p-2 w-full" />
            <input name="heure_depart" type="time" value={f.heure_depart || ""} onChange={(e) => handleFormatChange(i, e)} className="border p-2 w-full" />
            <input name="prix" value={f.prix || ""} onChange={(e) => handleFormatChange(i, e)} className="border p-2 w-full" placeholder="Prix (€)" />

            <label className="flex items-center space-x-2">
              <input type="checkbox" name="propose_repas" checked={f.propose_repas || false} onChange={(e) => handleFormatChange(i, e)} />
              <span>Proposez-vous des repas ?</span>
            </label>

            {f.propose_repas && (
              <>
                <input type="number" name="prix_repas" value={f.prix_repas || ""} onChange={(e) => handleFormatChange(i, e)} className="border p-2 w-full" placeholder="Prix du repas (€)" />
                <input type="number" name="nombre_repas" value={f.nombre_repas || ""} onChange={(e) => handleFormatChange(i, e)} className="border p-2 w-full" placeholder="Nombre de repas inclus" />
                <div className="text-sm text-gray-600">
                  Prix total repas : {f.prix_total_repas || 0} €<br />
                  Prix total inscription : {f.prix_total_inscription || f.prix} €
                </div>
              </>
            )}
          </div>
        ))}

        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">
          ✅ Enregistrer les modifications
        </button>
      </form>
    </div>
  );
}
