import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";

export default function InscriptionCourse() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { session } = useUser();

  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);
  const [formData, setFormData] = useState({
    format_id: "",
    nom: "",
    prenom: "",
    genre: "",
    date_naissance: "",
    nationalite: "",
    email: "",
    telephone: "",
    adresse: "",
    adresse_complement: "",
    code_postal: "",
    ville: "",
    pays: "",
    apparaitre_resultats: true,
    club: "",
    justificatif_type: "",
    contact_urgence_nom: "",
    contact_urgence_telephone: "",
  });

  const [step, setStep] = useState(1); // 1 = formulaire, 2 = récap
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*, formats(*)")
        .eq("id", courseId)
        .single();
      if (!error) {
        setCourse(data);
        setFormats(data.formats || []);
      }
    };
    fetchData();
  }, [courseId]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const userId = session?.user?.id;
    if (!userId) {
      alert("Vous devez être connecté.");
      return;
    }

    const { error } = await supabase.from("inscriptions").insert({
      coureur_id: userId,
      course_id: courseId,
      ...formData,
    });

    setSubmitting(false);

    if (error) {
      console.error("Erreur d'inscription :", error.message);
      alert("Erreur lors de l'inscription.");
    } else {
      alert("Inscription réussie !");
      navigate("/");
    }
  };

  if (!course) return <div className="p-6">Chargement...</div>;

  const formatSelected = formats.find((f) => f.id === formData.format_id);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Inscription à {course.nom}</h1>

      {step === 1 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setStep(2);
          }}
          className="space-y-4"
        >
          <select
            name="format_id"
            value={formData.format_id}
            onChange={handleChange}
            required
            className="border p-2 w-full"
          >
            <option value="">-- Choisir un format --</option>
            {formats.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nom} ({f.date})
              </option>
            ))}
          </select>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input name="nom" placeholder="Nom" value={formData.nom} onChange={handleChange} className="border p-2" required />
            <input name="prenom" placeholder="Prénom" value={formData.prenom} onChange={handleChange} className="border p-2" required />
            <select name="genre" value={formData.genre} onChange={handleChange} className="border p-2" required>
              <option value="">Genre</option>
              <option value="Homme">Homme</option>
              <option value="Femme">Femme</option>
              <option value="Autre">Autre</option>
            </select>
            <input type="date" name="date_naissance" value={formData.date_naissance} onChange={handleChange} className="border p-2" required />
            <input name="nationalite" placeholder="Nationalité" value={formData.nationalite} onChange={handleChange} className="border p-2" required />
            <input name="email" placeholder="Email" value={formData.email} onChange={handleChange} className="border p-2" required />
            <input name="telephone" placeholder="Téléphone" value={formData.telephone} onChange={handleChange} className="border p-2" />
            <input name="adresse" placeholder="Adresse" value={formData.adresse} onChange={handleChange} className="border p-2" />
            <input name="adresse_complement" placeholder="Complément d'adresse" value={formData.adresse_complement} onChange={handleChange} className="border p-2" />
            <input name="code_postal" placeholder="Code postal" value={formData.code_postal} onChange={handleChange} className="border p-2" />
            <input name="ville" placeholder="Ville" value={formData.ville} onChange={handleChange} className="border p-2" />
            <input name="pays" placeholder="Pays" value={formData.pays} onChange={handleChange} className="border p-2" />
            <input name="club" placeholder="Club" value={formData.club} onChange={handleChange} className="border p-2" />
            <input name="justificatif_type" placeholder="Justificatif (PPS, licence…)" value={formData.justificatif_type} onChange={handleChange} className="border p-2" />
            <input name="contact_urgence_nom" placeholder="Contact urgence - Nom" value={formData.contact_urgence_nom} onChange={handleChange} className="border p-2" />
            <input name="contact_urgence_telephone" placeholder="Contact urgence - Téléphone" value={formData.contact_urgence_telephone} onChange={handleChange} className="border p-2" />
          </div>

          <label className="block mt-2">
            <input type="checkbox" name="apparaitre_resultats" checked={formData.apparaitre_resultats} onChange={handleChange} className="mr-2" />
            Accepter d'apparaître dans les résultats publics
          </label>

          <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded">
            ➡️ Voir le récapitulatif
          </button>
        </form>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">📝 Récapitulatif</h2>
          <ul className="text-gray-700 space-y-1">
            <li><strong>Format :</strong> {formatSelected?.nom} ({formatSelected?.date})</li>
            <li><strong>Nom :</strong> {formData.nom} {formData.prenom}</li>
            <li><strong>Genre :</strong> {formData.genre}</li>
            <li><strong>Naissance :</strong> {formData.date_naissance}</li>
            <li><strong>Nationalité :</strong> {formData.nationalite}</li>
            <li><strong>Email :</strong> {formData.email}</li>
            <li><strong>Téléphone :</strong> {formData.telephone}</li>
            <li><strong>Adresse :</strong> {formData.adresse}, {formData.ville}, {formData.code_postal}, {formData.pays}</li>
            <li><strong>Club :</strong> {formData.club}</li>
            <li><strong>Justificatif :</strong> {formData.justificatif_type}</li>
            <li><strong>Contact urgence :</strong> {formData.contact_urgence_nom} ({formData.contact_urgence_telephone})</li>
            <li><strong>Résultats publics :</strong> {formData.apparaitre_resultats ? "Oui" : "Non"}</li>
          </ul>

          <div className="flex gap-4 mt-4">
            <button onClick={() => setStep(1)} className="bg-gray-300 text-gray-800 px-4 py-2 rounded">⬅️ Modifier</button>
            <button onClick={handleSubmit} disabled={submitting} className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">
              ✅ Confirmer l'inscription
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
