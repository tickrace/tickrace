// Stripe paiement intégré – version test

import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";
import PPSVerifier from "../components/PPSVerifier";
import UploadPPS from "../components/UploadPPS";


export default function InscriptionCourse() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);
  const [inscriptions, setInscriptions] = useState([]);
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
          const { count } = await supabase
            .from("inscriptions")
            .select("*", { count: "exact", head: true })
            .eq("format_id", f.id);
          return { ...f, inscrits: count || 0 };
        })
      );

      setCourse(data);
      setFormats(formatsWithCount);
    };

    const fetchProfil = async () => {
      const session = await supabase.auth.getSession();
      const user = session.data?.session?.user;
      if (!user) return;

      const { data: profil } = await supabase
        .from("profils_utilisateurs")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (profil) {
        addInscription({
          ...defaultCoureur(),
          ...profil,
          coureur_id: user.id,
          prix_total_coureur: 0,
        });
      } else {
        addInscription(defaultCoureur());
      }
    };

    fetchCourseAndFormats();
    fetchProfil();
  }, [courseId]);

  const defaultCoureur = () => ({
    coureur_id: null,
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
    numero_licence: "",
    contact_urgence_nom: "",
    contact_urgence_telephone: "",
    nombre_repas: 0,
    prix_total_repas: 0,
    prix_total_coureur: 0,
    justificatif_url: "",
    pps_identifier: "",
    pps_expiry_date: "",
  });

  const addInscription = (inscription = defaultCoureur()) => {
    setInscriptions((prev) => [...prev, inscription]);
  };

  const removeInscription = (index) => {
    setInscriptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleChange = (index, e) => {
    const { name, value, type, checked } = e.target;
    const updated = [...inscriptions];
    updated[index][name] = type === "checkbox" ? checked : value;

    if (name === "format_id" || name === "nombre_repas") {
      const selectedFormat = formats.find((f) => f.id === updated[index].format_id);
      if (selectedFormat) {
        const prixRepas = selectedFormat.prix_repas || 0;
        const prixInscription = selectedFormat.prix || 0;
        const totalRepas = prixRepas * (parseInt(updated[index].nombre_repas) || 0);
        updated[index].prix_total_repas = totalRepas;
        updated[index].prix_total_coureur = prixInscription + totalRepas;
      }
    }

    setInscriptions(updated);
  };

  const handlePPSData = (data, index) => {
    const updated = [...inscriptions];
    updated[index].nom = data.last_name;
    updated[index].prenom = data.first_name;
    updated[index].date_naissance = data.birthdate;
    updated[index].genre = data.gender === "male" ? "Homme" : "Femme";
    updated[index].pps_identifier = data.pps_identifier || "";
    updated[index].pps_expiry_date = data.pps_expiry_date || "";
    updated[index].justificatif_type = "pps";
    setInscriptions(updated);
  };

  const prixTotalGlobal = inscriptions.reduce(
    (acc, insc) => acc + (insc.prix_total_coureur || 0),
    0
  );

  const handlePaiement = async () => {
    if (inscriptions.length === 0) {
      setMessage("Ajoutez au moins un coureur.");
      return;
    }

    const session = await supabase.auth.getSession();
    const user = session.data?.session?.user;
    if (!user) {
      setMessage("Vous devez être connecté pour payer.");
      return;
    }

    for (const inscription of inscriptions) {
      if (!inscription.format_id) {
        alert("Veuillez sélectionner un format pour chaque coureur.");
        return;
      }

      const selectedFormat = formats.find((f) => f.id === inscription.format_id);
      if (selectedFormat.inscrits >= selectedFormat.nb_max_coureurs) {
        alert(`Le format ${selectedFormat.nom} est complet.`);
        return;
      }

      const { error } = await supabase.from("inscriptions").insert([{
        ...inscription,
        statut: "en attente",
        course_id: courseId,
      }]);

      if (error) {
        console.error("Erreur insertion :", error);
        alert("Erreur lors de l'inscription");
        return;
      }
    }

    const infosCoureur = inscriptions[0];
    try {
      const response = await fetch(
        "https://pecotcxpcqfkwvyylvjv.functions.supabase.co/create-checkout-session",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: user.id,
            nom: infosCoureur.nom,
            prenom: infosCoureur.prenom,
            email: infosCoureur.email,
            montant_total: prixTotalGlobal,
            format_id: infosCoureur.format_id,
          }),
        }
      );

      const data = await response.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        setMessage("Erreur : impossible de créer la session de paiement.");
      }
    } catch (err) {
      console.error("Erreur Stripe :", err);
      setMessage("Une erreur est survenue.");
    }
  };

  if (!course || formats.length === 0)
    return <div className="p-6">Chargement...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Inscription à : {course.nom}</h1>
      <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
        {inscriptions.map((inscription, index) => {
          const selectedFormat = formats.find((f) => f.id === inscription.format_id);
          return (
            <div key={index} className="border p-4 rounded bg-gray-50 space-y-3">
              <h2 className="text-lg font-semibold flex justify-between">
                Coureur {index + 1}
                <button
                  type="button"
                  onClick={() => removeInscription(index)}
                  className="text-red-600 text-sm"
                >
                  Supprimer
                </button>
              </h2>

              {/* [Ajoute ici les champs du coureur comme nom, prénom, email, etc.] */}

              <label className="block font-semibold">Nombre de repas :</label>
              <input
                type="number"
                name="nombre_repas"
                value={inscription.nombre_repas}
                onChange={(e) => handleChange(index, e)}
                className="border p-2 w-full"
                min={0}
              />
              {selectedFormat?.prix_repas > 0 && (
                <p className="text-sm text-gray-600">
                  {selectedFormat.prix_repas} € par repas – Total :{" "}
                  {inscription.prix_total_repas.toFixed(2)} €
                </p>
              )}

              <p className="font-bold mt-2">
                Total coureur : {inscription.prix_total_coureur.toFixed(2)} €
              </p>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => addInscription()}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Ajouter un coureur
        </button>

        <div className="mt-4 font-bold text-lg">
          Prix total : {prixTotalGlobal.toFixed(2)} €
        </div>

        <button
          type="button"
          onClick={handlePaiement}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Confirmer et payer
        </button>

        {message && <p className="text-green-700 mt-4">{message}</p>}
      </form>
    </div>
  );
}
