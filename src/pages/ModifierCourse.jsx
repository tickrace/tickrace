// src/pages/ModifierCourse.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

export default function ModifierCourse() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchData = async () => {
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

    fetchData();
  }, [courseId]);

  const handleCourseChange = (e) => {
    const { name, value } = e.target;
    setCourse((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormatChange = (index, e) => {
    const { name, value } = e.target;
    const newFormats = [...formats];
    newFormats[index][name] = value;
    setFormats(newFormats);
  };

  const handleFormatFileChange = (index, e) => {
    const file = e.target.files[0];
    if (!file) return;

    const field = e.target.name;
    const newFormats = [...formats];
    newFormats[index][field] = file;
    setFormats(newFormats);
  };

  const uploadFile = async (bucket, file, path) => {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: true,
    });
    return error ? null : path;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const updates = { ...course };
    if (course.image && course.image instanceof File) {
      const path = `${course.id}/${course.image.name}`;
      const uploaded = await uploadFile("courses", course.image, path);
      if (uploaded) updates.image = path;
    }

    const { error: updateError } = await supabase
      .from("courses")
      .update(updates)
      .eq("id", course.id);

    // Update formats
    for (const f of formats) {
      const updatedFormat = { ...f };

      if (f.image && f.image instanceof File) {
        const path = `${course.id}/${f.image.name}`;
        const uploaded = await uploadFile("formats", f.image, path);
        if (uploaded) updatedFormat.image = path;
      }

      if (f.fichier_gpx && f.fichier_gpx instanceof File) {
        const path = `${course.id}/${f.fichier_gpx.name}`;
        const uploaded = await uploadFile("formats", f.fichier_gpx, path);
        if (uploaded) updatedFormat.fichier_gpx = path;
      }

      if (updatedFormat.id) {
        await supabase.from("formats").update(updatedFormat).eq("id", updatedFormat.id);
      }
    }

    if (!updateError) {
      setMessage("Épreuve mise à jour !");
      navigate("/organisateur/espace");
    } else {
      setMessage("Erreur lors de la mise à jour.");
    }
  };

  if (!course) return <p>Chargement...</p>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Modifier l’épreuve</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          name="nom"
          value={course.nom || ""}
          onChange={handleCourseChange}
          placeholder="Nom de l’épreuve"
          className="border p-2 w-full"
        />
        <input
          type="text"
          name="lieu"
          value={course.lieu || ""}
          onChange={handleCourseChange}
          placeholder="Lieu"
          className="border p-2 w-full"
        />
        <input
          type="text"
          name="departement"
          value={course.departement || ""}
          onChange={handleCourseChange}
          placeholder="Département"
          className="border p-2 w-full"
        />
        <textarea
          name="presentation"
          value={course.presentation || ""}
          onChange={handleCourseChange}
          placeholder="Présentation"
          className="border p-2 w-full"
        />
        <input
          type="file"
          name="image"
          accept="image/*"
          onChange={(e) => setCourse({ ...course, image: e.target.files[0] })}
          className="border p-2 w-full"
        />

        <h2 className="text-xl font-semibold mt-6">Formats</h2>
        {formats.map((f, index) => (
          <div key={index} className="border p-4 space-y-2">
            <input
              type="text"
              name="nom"
              value={f.nom || ""}
              onChange={(e) => handleFormatChange(index, e)}
              placeholder="Nom du format"
              className="border p-2 w-full"
            />
            <input
              type="file"
              name="image"
              accept="image/*"
              onChange={(e) => handleFormatFileChange(index, e)}
              className="border p-2 w-full"
            />
            <input
              type="file"
              name="fichier_gpx"
              accept=".gpx"
              onChange={(e) => handleFormatFileChange(index, e)}
              className="border p-2 w-full"
            />
            <textarea
              name="presentation"
              value={f.presentation || ""}
              onChange={(e) => handleFormatChange(index, e)}
              placeholder="Présentation du parcours"
              className="border p-2 w-full"
            />
          </div>
        ))}

        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
          Sauvegarder les modifications
        </button>
        {message && <p className="text-green-700">{message}</p>}
      </form>
    </div>
  );
}
