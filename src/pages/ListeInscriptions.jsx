// ⚠️ Ce fichier est très long (tableau large), je vais te l’envoyer en 2 parties pour faciliter la lisibilité.
// Voici la **Partie 1/2** (jusqu’à <tbody>) :

import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { Download } from "lucide-react";

export default function ListeInscriptions() {
  const [inscriptions, setInscriptions] = useState([]);
  const [filtreStatut, setFiltreStatut] = useState("");
  const [recherche, setRecherche] = useState("");

  useEffect(() => {
    fetchInscriptions();
  }, []);

  const fetchInscriptions = async () => {
    const { data, error } = await supabase
      .from("inscriptions")
      .select("*, formats(id, nom)");

    if (!error) {
      setInscriptions(data);
    } else {
      console.error("Erreur Supabase :", error);
    }
  };

  const handleStatutChange = async (id, nouveauStatut) => {
    const { error } = await supabase
      .from("inscriptions")
      .update({ statut: nouveauStatut })
      .eq("id", id);

    if (!error) {
      setInscriptions((prev) =>
        prev.map((i) => (i.id === id ? { ...i, statut: nouveauStatut } : i))
      );
    }
  };

  const handleDossardChange = async (id, dossard) => {
    const { error } = await supabase
      .from("inscriptions")
      .update({ dossard })
      .eq("id", id);

    if (!error) {
      setInscriptions((prev) =>
        prev.map((i) => (i.id === id ? { ...i, dossard } : i))
      );
    }
  };

  const inscriptionsFiltrees = inscriptions.filter((i) =>
    (filtreStatut ? i.statut === filtreStatut : true) &&
    (recherche
      ? `${i.nom} ${i.prenom} ${i.email} ${i.ville || ""}`
          .toLowerCase()
          .includes(recherche.toLowerCase())
      : true)
  );

  const handleExportCSV = () => {
    const enTetes = [
      "Nom", "Prénom", "Genre", "Date naissance", "Nationalité", "Email", "Téléphone",
      "Adresse", "Adresse complément", "Code postal", "Ville", "Pays",
      "Apparaître résultats", "Club", "Justificatif", "N° Licence",
      "Contact urgence nom", "Contact urgence téléphone", "Statut",
      "Dossard", "Repas", "Prix repas (€)", "Format"
    ];

    const lignes = inscriptionsFiltrees.map((i) => [
      i.nom, i.prenom, i.genre, i.date_naissance, i.nationalite, i.email, i.telephone,
      i.adresse, i.adresse_complement, i.code_postal, i.ville, i.pays,
      i.apparaitre_resultats ? "Oui" : "Non", i.club, i.justificatif_type, i.numero_licence,
      i.contact_urgence_nom, i.contact_urgence_telephone, i.statut,
      i.dossard, i.nombre_repas, i.prix_total_repas, i.formats?.nom
    ]);

    const csvContent = [enTetes, ...lignes]
      .map((e) => e.map((v) => `"${(v || "").toString().replace(/"/g, '""')}"`).join(";"))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inscriptions_completes.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Inscriptions détaillées</h1>

      <div className="flex flex-wrap gap-4 mb-4">
        <input
          type="text"
          placeholder="Rechercher..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="border px-3 py-2 rounded w-full md:w-1/2"
        />
        <select
          value={filtreStatut}
          onChange={(e) => setFiltreStatut(e.target.value)}
          className="border px-3 py-2 rounded"
        >
          <option value="">Tous les statuts</option>
          <option value="en attente">En attente</option>
          <option value="validée">Validée</option>
          <option value="refusée">Refusée</option>
        </select>
        <button
          onClick={handleExportCSV}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center gap-2"
        >
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div className="overflow-auto">
        <table className="min-w-[1600px] w-full table-auto border-collapse border text-sm">
          <thead className="bg-gray-200">
            <tr>
              {[
                "Nom", "Prénom", "Genre", "Date naissance", "Nationalité", "Email", "Téléphone",
                "Adresse", "Adresse complément", "Code postal", "Ville", "Pays",
                "Apparaître", "Club", "Justificatif", "Licence",
                "Urgence nom", "Urgence tél.", "Statut", "Dossard", "Repas", "Prix repas (€)", "Format"
              ].map((label) => (
                <th key={label} className="border px-2 py-1">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {inscriptionsFiltrees.map((i) => (
              <tr key={i.id} className="border-t">
                <td className="border px-2 py-1">{i.nom}</td>
                <td className="border px-2 py-1">{i.prenom}</td>
                <td className="border px-2 py-1">{i.genre}</td>
                <td className="border px-2 py-1">{i.date_naissance}</td>
                <td className="border px-2 py-1">{i.nationalite}</td>
                <td className="border px-2 py-1">{i.email}</td>
                <td className="border px-2 py-1">{i.telephone}</td>
                <td className="border px-2 py-1">{i.adresse}</td>
                <td className="border px-2 py-1">{i.adresse_complement}</td>
                <td className="border px-2 py-1">{i.code_postal}</td>
                <td className="border px-2 py-1">{i.ville}</td>
                <td className="border px-2 py-1">{i.pays}</td>
                <td className="border px-2 py-1">
                  {i.apparaitre_resultats ? "Oui" : "Non"}
                </td>
                <td className="border px-2 py-1">{i.club}</td>
                <td className="border px-2 py-1">{i.justificatif_type}</td>
                <td className="border px-2 py-1">{i.numero_licence}</td>
                <td className="border px-2 py-1">{i.contact_urgence_nom}</td>
                <td className="border px-2 py-1">{i.contact_urgence_telephone}</td>
                <td className="border px-2 py-1">
                  <select
                    value={i.statut}
                    onChange={(e) => handleStatutChange(i.id, e.target.value)}
                    className="border rounded px-1"
                  >
                    <option value="en attente">En attente</option>
                    <option value="validée">Validée</option>
                    <option value="refusée">Refusée</option>
                  </select>
                </td>
                <td className="border px-2 py-1">
                  <input
                    type="number"
                    value={i.dossard || ""}
                    onChange={(e) =>
                      handleDossardChange(i.id, parseInt(e.target.value) || null)
                    }
                    className="border rounded px-1 w-20"
                  />
                </td>
                <td className="border px-2 py-1">{i.nombre_repas || 0}</td>
                <td className="border px-2 py-1">{i.prix_total_repas || 0} €</td>
                <td className="border px-2 py-1">{i.formats?.nom}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

