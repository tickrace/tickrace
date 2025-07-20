// src/pages/InscriptionCourse.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

export default function InscriptionCourse() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);
  const [selectedFormat, setSelectedFormat] = useState("");
  const [formData, setFormData] = useState({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchCourseAndProfil = async () => {
      const session = await supabase.auth.getSession();
      const user = session.data?.session?.user;
      if (!user) return;

      const { data: courseData, error: courseError } = await supabase
        .from("courses")
        .select("*, formats(*)")
        .eq("id", courseId)
        .single();

      if (!courseError && courseData) {
        setCourse(courseData);
        setFormats(courseData.formats || []);
      }

      const { data: profilData, error: profilError } = await supabase
        .from("profils_coureurs")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!profilError && profilData) {
        setFormData((prev) => ({
          ...prev,
          ...profilData,
        }));
      }
    };

    fetchCourseAndProfil();
  }, [courseId]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const session = await supabase.auth.getSession();
    const user = session.data?.session?.user;
    if (!user || !selectedFormat) {
      setMessage("Veuillez sélectionner un format.");
      return;
    }

    const inscription = {
      ...formData,
      coureur_id: user.id,
      course_id: courseId,
      format_id: selectedFormat,
    };

    const { error } = await supabase.from("inscriptions").insert(inscription);

    if (error) {
      console.error("Erreur lors de l'inscription :", error);
      setMessage("Erreur lors de l'inscription.");
    } else {
      setMessage("Inscription réussie !");
      setTimeout(() => navigate("/monprofilcoureur"), 2000);
    }
  };

  if (!course) return <div className="p-6">Chargement...</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Inscription à {course.nom}</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <select
          name="format_id"
          value={selectedFormat}
          onChange={(e) => setSelectedFormat(e.target.value)}
          className="border p-2 w-full rounded"
        >
          <option value="">-- Choisir un format --</option>
          {formats.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nom} ({f.date})
            </option>
          ))}
        </select>

        <input type="text" name="nom" placeholder="Nom" value={formData.nom || ""} onChange={handleChange} className="border p-2 w-full rounded" />
        <input type="text" name="prenom" placeholder="Prénom" value={formData.prenom || ""} onChange={handleChange} className="border p-2 w-full rounded" />
        <input type="date" name="date_naissance" value={formData.date_naissance || ""} onChange={handleChange} className="border p-2 w-full rounded" />
        <input type="text" name="nationalite" placeholder="Nationalité" value={formData.nationalite || ""} onChange={handleChange} className="border p-2 w-full rounded" />
        <input type="email" name="email" placeholder="Email" value={formData.email || ""} onChange={handleChange} className="border p-2 w-full rounded" />
        <input type="text" name="telephone" placeholder="Téléphone" value={formData.telephone || ""} onChange={handleChange} className="border p-2 w-full rounded" />
        <input type="text" name="adresse" placeholder="Adresse" value={formData.adresse || ""} onChange={handleChange} className="border p-2 w-full rounded" />
        <input type="text" name="adresse_complement" placeholder="Complément d'adresse" value={formData.adresse_complement || ""} onChange={handleChange} className="border p-2 w-full rounded" />
        <input type="text" name="code_postal" placeholder="Code postal" value={formData.code_postal || ""} onChange={handleChange} className="border p-2 w-full rounded" />
        <input type="text" name="ville" placeholder="Ville" value={formData.ville || ""} onChange={handleChange} className="border p-2 w-full rounded" />
        <input type="text" name="pays" placeholder="Pays" value={formData.pays || ""} onChange={handleChange} className="border p-2 w-full rounded" />
        <input type="text" name="club" placeholder="Club" value={formData.club || ""} onChange={handleChange} className="border p-2 w-full rounded" />

        <div>
          <p className="font-semibold mb-1">Résultats :</p>
          <label className="mr-4">
            <input type="radio" name="apparaitre_resultats" checked={formData.apparaitre_resultats === true} onChange={() => setFormData({ ...formData, apparaitre_resultats: true })} /> Oui
          </label>
          <label>
            <input type="radio" name="apparaitre_resultats" checked={formData.apparaitre_resultats === false} onChange={() => setFormData({ ...formData, apparaitre_resultats: false })} /> Non
          </label>
        </div>

        <div>
          <p className="font-semibold mb-1">Justificatif :</p>
          <label className="block mb-1">
            <input type="radio" name="justificatif_type" value="licence" checked={formData.justificatif_type === "licence"} onChange={handleChange} /> Licence
          </label>
          <label className="block mb-1">
            <input type="radio" name="justificatif_type" value="pps" checked={formData.justificatif_type === "pps"} onChange={handleChange} /> PPS
          </label>
        </div>

        {formData.justificatif_type === "licence" && (
          <input type="text" name="numero_licence" placeholder="N° de licence" value={formData.numero_licence || ""} onChange={handleChange} className="border p-2 w-full rounded" />
        )}

        <input type="text" name="contact_urgence_nom" placeholder="Nom du contact d'urgence" value={formData.contact_urgence_nom || ""} onChange={handleChange} className="border p-2 w-full rounded" />
        <input type="text" name="contact_urgence_telephone" placeholder="Téléphone du contact d'urgence" value={formData.contact_urgence_telephone || ""} onChange={handleChange} className="border p-2 w-full rounded" />

        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Valider l'inscription</button>
        {message && <p className="mt-2 text-green-600 font-semibold">{message}</p>}
      </form>
    </div>
  );
}
