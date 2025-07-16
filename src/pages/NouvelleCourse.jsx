import React, { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { useNavigate } from "react-router-dom";

export default function NouvelleCourse() {
  const [user, setUser] = useState(null);
  const [course, setCourse] = useState({
    nom: "",
    sous_nom: "",
    lieu: "",
    date: "",
    type_epreuve: "",
    image: null,
  });
  const [formats, setFormats] = useState([
    {
      nom: "",
      distance_km: "",
      denivele_dplus: "",
      denivele_dmoins: "",
      heure_depart: "",
      prix: "",
      gpx_url: "",
    },
  ]);
  const [imagePreview, setImagePreview] = useState(null);
  const [message, setMessage] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const session = supabase.auth.getSession().then(({ data }) => {
      setUser(data?.session?.user || null);
    });
  }, []);

  const handleCourseChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "image") {
      setCourse((prev) => ({ ...prev, image: files[0] }));
      setImagePreview(URL.createObjectURL(files[0]));
    } else {
      setCourse((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleFormatChange = (index, e) => {
    const { name, value } = e.target;
    const updatedFormats = [...formats];
    updatedFormats[index][name] = value;
    setFormats(updatedFormats);
  };

  const addFormat = () => {
    setFormats([
      ...formats,
      {
        nom: "",
        distance_km: "",
        denivele_dplus: "",
        denivele_dmoins: "",
        heure_depart: "",
        prix: "",
        gpx_url: "",
      },
    ]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    setMessage(null);

    let imageUrl = null;

    if (course.image) {
      const { data, error } = await supabase.storage
        .from("images")
        .upload(`courses/${Date.now()}_${course.image.name}`, course.image);

      if (error) {
        setMessage({ type: "error", text: "Erreur lors de l’upload de l’image." });
        return;
      }

      const { data: publicUrl } = supabase.storage
        .from("images")
        .getPublicUrl(data.path);

      imageUrl = publicUrl.publicUrl;
    }

    const { data: newCourse, error: courseError } = await supabase
      .from("courses")
      .insert([
        {
          ...course,
          image_url: imageUrl,
          organisateur_id: user.id,
        },
      ])
      .select()
      .single();

    if (courseError) {
      setMessage({ type: "error", text: "Erreur lors de l’enregistrement de la course." });
      return;
    }

    const formatsWithEventId = formats.map((f) => ({
      ...f,
      event_id: newCourse.id,
    }));

    const { error: formatError } = await supabase
      .from("formats")
      .insert(formatsWithEventId);

    if (formatError) {
      setMessage({ type: "error", text: "Course créée mais erreur sur les formats." });
    } else {
      setMessage({ type: "success", text: "Course enregistrée avec succès." });
      navigate("/organisateur/espace");
    }
  };

  if (!user) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <p>Veuillez vous connecter pour accéder à cette page.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Nouvelle course</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* CHAMPS PRINCIPAUX */}
        <div className="space-y-2">
          <input type="text" name="nom" placeholder="Nom de l’épreuve" className="w-full border px-3 py-2 rounded" onChange={handleCourseChange} required />
          <input type="text" name="sous_nom" placeholder="Sous-nom" className="w-full border px-3 py-2 rounded" onChange={handleCourseChange} />
          <input type="text" name="lieu" placeholder="Lieu" className="w-full border px-3 py-2 rounded" onChange={handleCourseChange} required />
          <input type="date" name="date" className="w-full border px-3 py-2 rounded" onChange={handleCourseChange} required />
          <input type="text" name="type_epreuve" placeholder="Type d’épreuve" className="w-full border px-3 py-2 rounded" onChange={handleCourseChange} />
          <input type="file" name="image" accept="image/*" className="w-full" onChange={handleCourseChange} />
          {imagePreview && <img src={imagePreview} alt="Aperçu" className="mt-2 w-64 h-auto" />}
        </div>

        {/* FORMATS MULTIPLES */}
        <div>
          <h2 className="text-xl font-semibold mb-2">Formats</h2>
          {formats.map((format, index) => (
            <div key={index} className="border p-4 mb-4 rounded space-y-2">
              <input type="text" name="nom" placeholder="Nom du format" className="w-full border px-3 py-2 rounded" value={format.nom} onChange={(e) => handleFormatChange(index, e)} required />
              <input type="number" step="0.1" name="distance_km" placeholder="Distance (km)" className="w-full border px-3 py-2 rounded" value={format.distance_km} onChange={(e) => handleFormatChange(index, e)} />
              <input type="number" name="denivele_dplus" placeholder="D+ (m)" className="w-full border px-3 py-2 rounded" value={format.denivele_dplus} onChange={(e) => handleFormatChange(index, e)} />
              <input type="number" name="denivele_dmoins" placeholder="D- (m)" className="w-full border px-3 py-2 rounded" value={format.denivele_dmoins} onChange={(e) => handleFormatChange(index, e)} />
              <input type="time" name="heure_depart" className="w-full border px-3 py-2 rounded" value={format.heure_depart} onChange={(e) => handleFormatChange(index, e)} />
              <input type="number" step="0.01" name="prix" placeholder="Prix (€)" className="w-full border px-3 py-2 rounded" value={format.prix} onChange={(e) => handleFormatChange(index, e)} />
              <input type="text" name="gpx_url" placeholder="Lien GPX (optionnel)" className="w-full border px-3 py-2 rounded" value={format.gpx_url} onChange={(e) => handleFormatChange(index, e)} />
            </div>
          ))}
          <button type="button" onClick={addFormat} className="text-blue-600 hover:underline">
            + Ajouter un format
          </button>
        </div>

        {/* SUBMIT */}
        <button type="submit" className="bg-black text-white px-6 py-2 rounded">
          Enregistrer
        </button>
        {message && (
          <p className={`text-sm ${message.type === "error" ? "text-red-500" : "text-green-600"}`}>
            {message.text}
          </p>
        )}
      </form>
    </div>
  );
}
