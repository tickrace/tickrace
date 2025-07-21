// src/pages/ListeInscriptions.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";

export default function ListeInscriptions() {
  const { format_id } = useParams();
  const [inscrits, setInscrits] = useState([]);
  const [formatNom, setFormatNom] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [newInscription, setNewInscription] = useState({
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
    club: "",
    justificatif_type: "",
    contact_urgence_nom: "",
    contact_urgence_telephone: "",
    format_id,
    apparaitre_resultats: true,
  });

  useEffect(() => {
    const fetchData = async () => {
      const { data: format } = await supabase
        .from("formats")
        .select("nom")
        .eq("id", format_id)
        .single();

      setFormatNom(format?.nom || "");

      const { data: inscriptions } = await supabase
        .from("inscriptions")
        .select("*")
        .eq("format_id", format_id)
        .order("created_at", { ascending: false });

      setInscrits(inscriptions || []);
    };

    fetchData();
  }, [format_id]);

  const handleValidate = async (id) => {
    await supabase
      .from("inscriptions")
      .update({ statut: "validé" })
      .eq("id", id);

    setInscrits((prev) =>
      prev.map((i) => (i.id === id ? { ...i, statut: "validé" } : i))
    );
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNewInscription((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const { data, error } = await supabase
      .from("inscriptions")
      .insert({ ...newInscription })
      .select()
      .single();

    if (error) {
      alert("Erreur lors de l’ajout");
      console.error(error);
      return;
    }

    setInscrits((prev) => [data, ...prev]);
    setNewInscription({
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
      club: "",
      justificatif_type: "",
      contact_urgence_nom: "",
      contact_urgence_telephone: "",
      format_id,
      apparaitre_resultats: true,
    });
    setShowForm(false);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Inscriptions – {formatNom}</h1>

      <button
        onClick={() => setShowForm(!showForm)}
        className="mb-4 bg-blue-600 text-white px-4 py-2 rounded"
      >
        ➕ Ajouter un coureur manuellement
      </button>

      {showForm && (
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 mb-8 bg-gray-50 p-4 rounded border">
          <input name="nom" value={newInscription.nom} onChange={handleFormChange} placeholder="Nom" className="border p-2" />
          <input name="prenom" value={newInscription.prenom} onChange={handleFormChange} placeholder="Prénom" className="border p-2" />
          <input name="genre" value={newInscription.genre} onChange={handleFormChange} placeholder="Genre" className="border p-2" />
          <input type="date" name="date_naissance" value={newInscription.date_naissance} onChange={handleFormChange} className="border p-2" />
          <input name="nationalite" value={newInscription.nationalite} onChange={handleFormChange} placeholder="Nationalité" className="border p-2" />
          <input name="email" value={newInscription.email} onChange={handleFormChange} placeholder="Email" className="border p-2" />
          <input name="telephone" value={newInscription.telephone} onChange={handleFormChange} placeholder="Téléphone" className="border p-2" />
          <input name="adresse" value={newInscription.adresse} onChange={handleFormChange} placeholder="Adresse" className="border p-2" />
          <input name="adresse_complement" value={newInscription.adresse_complement} onChange={handleFormChange} placeholder="Complément d’adresse" className="border p-2" />
          <input name="code_postal" value={newInscription.code_postal} onChange={handleFormChange} placeholder="Code postal" className="border p-2" />
          <input name="ville" value={newInscription.ville} onChange={handleFormChange} placeholder="Ville" className="border p-2" />
          <input name="pays" value={newInscription.pays} onChange={handleFormChange} placeholder="Pays" className="border p-2" />
          <input name="club" value={newInscription.club} onChange={handleFormChange} placeholder="Club" className="border p-2" />
          <input name="justificatif_type" value={newInscription.justificatif_type} onChange={handleFormChange} placeholder="Licence ou PPS" className="border p-2" />
          <input name="contact_urgence_nom" value={newInscription.contact_urgence_nom} onChange={handleFormChange} placeholder="Nom contact urgence" className="border p-2" />
          <input name="contact_urgence_telephone" value={newInscription.contact_urgence_telephone} onChange={handleFormChange} placeholder="Tel contact urgence" className="border p-2" />
          <label className="col-span-2 flex items-center gap-2">
            <input type="checkbox" name="apparaitre_resultats" checked={newInscription.apparaitre_resultats} onChange={handleFormChange} />
            Afficher dans les résultats publics
          </label>
          <button type="submit" className="col-span-2 bg-green-600 text-white px-4 py-2 rounded">
            ✅ Enregistrer l’inscription
          </button>
        </form>
      )}

      {inscrits.length === 0 ? (
        <p>Aucune inscription pour ce format.</p>
      ) : (
        <table className="w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2">Nom</th>
              <th className="border p-2">Prénom</th>
              <th className="border p-2">Email</th>
              <th className="border p-2">Genre</th>
              <th className="border p-2">Naissance</th>
              <th className="border p-2">Club</th>
              <th className="border p-2">Créé le</th>
              <th className="border p-2">Statut</th>
              <th className="border p-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {inscrits.map((i) => (
              <tr key={i.id}>
                <td className="border p-2">{i.nom}</td>
                <td className="border p-2">{i.prenom}</td>
                <td className="border p-2">{i.email}</td>
                <td className="border p-2">{i.genre}</td>
                <td className="border p-2">{i.date_naissance}</td>
                <td className="border p-2">{i.club}</td>
                <td className="border p-2">{new Date(i.created_at).toLocaleString()}</td>
                <td className="border p-2">{i.statut}</td>
                <td className="border p-2">
                  {i.statut !== "validé" && (
                    <button
                      onClick={() => handleValidate(i.id)}
                      className="text-green-700 underline"
                    >
                      Valider
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
