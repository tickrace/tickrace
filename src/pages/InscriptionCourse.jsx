// src/pages/InscriptionCourse.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";

export default function InscriptionCourse() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);
  const [coureurs, setCoureurs] = useState([]);
  const [profil, setProfil] = useState({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchCourseAndFormats = async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*, formats(id, nom, prix, date, distance_km, denivele_dplus, nb_max_coureurs, stock_repas, prix_repas)")
        .eq("id", courseId)
        .single();

      if (error || !data) return;

      const formatsWithCount = await Promise.all(
        (data.formats || []).map(async (f) => {
          const { count, error: countError } = await supabase
            .from("inscriptions")
            .select("*", { count: "exact", head: true })
            .eq("format_id", f.id);

          return {
            ...f,
            inscrits: countError ? 0 : count,
          };
        })
      );

      setCourse(data);
      setFormats(formatsWithCount);
    };

    const fetchProfil = async () => {
      const session = await supabase.auth.getSession();
      const user = session.data?.session?.user;
      if (!user) return;

      const { data, error } = await supabase
        .from("profils_utilisateurs")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (!error && data) {
        setProfil(data);
        // Pré-remplir le premier coureur
        setCoureurs([
          {
            ...data,
            id: Date.now(),
            coureur_id: user.id, // le coureur connecté
            format_id: "",
            nombre_repas: 0,
          },
        ]);
      }
    };

    fetchCourseAndFormats();
    fetchProfil();
  }, [courseId]);

  const addCoureur = () => {
    setCoureurs((prev) => [
      ...prev,
      {
        id: Date.now(),
        coureur_id: null, // coureur externe
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
        numero_licence: "",
        format_id: "",
        nombre_repas: 0,
      },
    ]);
  };

  const removeCoureur = (id) => {
    setCoureurs((prev) => prev.filter((c) => c.id !== id));
  };

  const handleChange = (id, field, value) => {
    setCoureurs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const buildInscriptionPayload = (coureur) => {
    const selectedFormat = formats.find((f) => f.id === coureur.format_id);
    const prix_format = selectedFormat?.prix || 0;
    const prix_total_repas =
      (selectedFormat?.prix_repas || 0) * (coureur.nombre_repas || 0);
    const prix_total_coureur = prix_format + prix_total_repas;

    return {
      coureur_id: coureur.coureur_id,
      course_id: courseId,
      format_id: coureur.format_id,
      nom: coureur.nom,
      prenom: coureur.prenom,
      genre: coureur.genre,
      date_naissance: coureur.date_naissance,
      nationalite: coureur.nationalite,
      email: coureur.email,
      telephone: coureur.telephone,
      adresse: coureur.adresse,
      adresse_complement: coureur.adresse_complement,
      code_postal: coureur.code_postal,
      ville: coureur.ville,
      pays: coureur.pays,
      apparaitre_resultats: coureur.apparaitre_resultats,
      club: coureur.club,
      justificatif_type: coureur.justificatif_type,
      contact_urgence_nom: coureur.contact_urgence_nom,
      contact_urgence_telephone: coureur.contact_urgence_telephone,
      numero_licence: coureur.numero_licence,
      nombre_repas: coureur.nombre_repas,
      prix_total_repas,
      prix_total_coureur,
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    for (const c of coureurs) {
      if (!c.format_id) {
        alert("Veuillez sélectionner un format pour chaque coureur.");
        return;
      }
    }

    try {
      const payloads = coureurs.map(buildInscriptionPayload);
      const { error } = await supabase.from("inscriptions").insert(payloads);

      if (error) {
        console.error("Erreur insertion :", error);
        alert("Erreur lors de l'inscription");
        return;
      }

      setMessage("Inscriptions enregistrées avec succès !");
    } catch (err) {
      console.error("Erreur :", err);
    }
  };

  if (!course || formats.length === 0) return <div className="p-6">Chargement...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Inscription à : {course.nom}</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        {coureurs.map((coureur) => {
          const selectedFormat = formats.find((f) => f.id === coureur.format_id);
          return (
            <div key={coureur.id} className="border rounded p-4 bg-gray-50 space-y-3">
              <h2 className="font-semibold">Coureur</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={coureur.nom}
                  onChange={(e) => handleChange(coureur.id, "nom", e.target.value)}
                  placeholder="Nom"
                  className="border p-2 w-full"
                />
                <input
                  type="text"
                  value={coureur.prenom}
                  onChange={(e) => handleChange(coureur.id, "prenom", e.target.value)}
                  placeholder="Prénom"
                  className="border p-2 w-full"
                />
                <select
                  value={coureur.genre || ""}
                  onChange={(e) => handleChange(coureur.id, "genre", e.target.value)}
                  className="border p-2 w-full"
                >
                  <option value="">Genre</option>
                  <option value="Homme">Homme</option>
                  <option value="Femme">Femme</option>
                </select>
                <input
                  type="date"
                  value={coureur.date_naissance || ""}
                  onChange={(e) =>
                    handleChange(coureur.id, "date_naissance", e.target.value)
                  }
                  className="border p-2 w-full"
                />
                <input
                  type="text"
                  value={coureur.email}
                  onChange={(e) => handleChange(coureur.id, "email", e.target.value)}
                  placeholder="Email"
                  className="border p-2 w-full"
                />
                <input
                  type="text"
                  value={coureur.telephone}
                  onChange={(e) =>
                    handleChange(coureur.id, "telephone", e.target.value)
                  }
                  placeholder="Téléphone"
                  className="border p-2 w-full"
                />
                <input
                  type="text"
                  value={coureur.adresse}
                  onChange={(e) => handleChange(coureur.id, "adresse", e.target.value)}
                  placeholder="Adresse"
                  className="border p-2 w-full"
                />
                <input
                  type="text"
                  value={coureur.ville}
                  onChange={(e) => handleChange(coureur.id, "ville", e.target.value)}
                  placeholder="Ville"
                  className="border p-2 w-full"
                />
                <select
                  value={coureur.format_id}
                  onChange={(e) =>
                    handleChange(coureur.id, "format_id", e.target.value)
                  }
                  className="border p-2 w-full"
                >
                  <option value="">-- Sélectionnez un format --</option>
                  {formats.map((f) => (
                    <option
                      key={f.id}
                      value={f.id}
                      disabled={f.inscrits >= f.nb_max_coureurs}
                    >
                      {f.nom} - {f.date} - {f.distance_km} km ({f.inscrits}/{f.nb_max_coureurs})
                    </option>
                  ))}
                </select>
              </div>

              {Number(selectedFormat?.stock_repas) > 0 && (
                <div>
                  <label className="font-semibold">Nombre de repas :</label>
                  <input
                    type="number"
                    min="0"
                    max={selectedFormat.stock_repas}
                    value={coureur.nombre_repas}
                    onChange={(e) =>
                      handleChange(coureur.id, "nombre_repas", Number(e.target.value))
                    }
                    className="border p-2 w-full"
                  />
                  <p className="text-sm text-gray-600">
                    Prix unitaire : {selectedFormat.prix_repas} € — Total repas :{" "}
                    {(coureur.nombre_repas * selectedFormat.prix_repas).toFixed(2)} €
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={() => removeCoureur(coureur.id)}
                className="bg-red-500 text-white px-3 py-1 rounded mt-2"
              >
                Supprimer
              </button>
            </div>
          );
        })}

        <button
          type="button"
          onClick={addCoureur}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          + Ajouter un coureur
        </button>

        <button
          type="submit"
          className="bg-green-600 text-white px-6 py-2 rounded"
        >
          Confirmer les inscriptions
        </button>

        {message && <p className="text-green-700 mt-4">{message}</p>}
      </form>
    </div>
  );
}
