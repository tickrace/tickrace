import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { Download, Plus } from "lucide-react";

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
      .select(`*, formats ( id, nom )`);

    if (!error && data) {
      setInscriptions(data);
    }
  };

  const handleStatutChange = async (id, nouveauStatut) => {
    const { error } = await supabase
      .from("inscriptions")
      .update({ statut: nouveauStatut })
      .eq("id", id);

    if (!error) {
      setInscriptions((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, statut: nouveauStatut } : i
        )
      );
    }
  };

  const handleExportCSV = () => {
    const enTetes = [
      "Dossard", "Format", "Nom", "Prénom", "Genre", "Date naissance", "Nationalité", "Email", "Téléphone",
      "Adresse", "Adresse complément", "Code postal", "Ville", "Pays", "Apparaître résultats", "Club",
      "Justificatif", "N° Licence", "Contact urgence nom", "Contact urgence téléphone", "Statut",
      "Date inscription", "Nb repas", "Total repas (€)"
    ];

    const lignes = inscriptionsFiltrees.map((i) => [
      i.dossard || "",
      i.formats?.nom || "",
      i.nom || "",
      i.prenom || "",
      i.genre || "",
      i.date_naissance || "",
      i.nationalite || "",
      i.email || "",
      i.telephone || "",
      i.adresse || "",
      i.adresse_complement || "",
      i.code_postal || "",
      i.ville || "",
      i.pays || "",
      i.apparaitre_resultats ? "Oui" : "Non",
      i.club || "",
      i.justificatif_type || "",
      i.numero_licence || "",
      i.contact_urgence_nom || "",
      i.contact_urgence_telephone || "",
      i.statut || "",
      i.created_at ? new Date(i.created_at).toLocaleString() : "",
      i.nombre_repas || 0,
      i.prix_total_repas || 0
    ]);

    const csvContent = [enTetes, ...lignes]
      .map((e) => e.map((v) => `"${(v + "").replace(/"/g, '""')}"`).join(";"))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "liste_inscriptions.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const inscriptionsFiltrees = inscriptions.filter((i) =>
    (filtreStatut ? i.statut === filtreStatut : true) &&
    (recherche
      ? `${i.nom} ${i.prenom} ${i.email} ${i.ville}`.toLowerCase().includes(recherche.toLowerCase())
      : true)
  );

  const formatsGroupes = inscriptionsFiltrees.reduce((acc, curr) => {
    const formatNom = curr.formats?.nom || "Format inconnu";
    if (!acc[formatNom]) acc[formatNom] = [];
    acc[formatNom].push(curr);
    return acc;
  }, {});

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Liste des inscriptions</h1>

      <div className="flex flex-wrap gap-4 mb-4">
        <input
          type="text"
          placeholder="Rechercher par nom, ville, email..."
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

      {Object.entries(formatsGroupes).map(([formatNom, inscriptions]) => (
        <div key={formatNom} className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold">{formatNom}</h2>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded flex items-center gap-2">
              <Plus size={16} /> Ajouter un coureur
            </button>
          </div>

          <div className="overflow-auto">
            <table className="min-w-[1000px] w-full table-auto border-collapse border">
              <thead className="bg-gray-200">
                <tr>
                  <th className="border px-2 py-1">Dossard</th>
                  <th className="border px-2 py-1">Nom</th>
                  <th className="border px-2 py-1">Prénom</th>
                  <th className="border px-2 py-1">Genre</th>
                  <th className="border px-2 py-1">Date naissance</th>
                  <th className="border px-2 py-1">Nationalité</th>
                  <th className="border px-2 py-1">Email</th>
                  <th className="border px-2 py-1">Téléphone</th>
                  <th className="border px-2 py-1">Ville</th>
                  <th className="border px-2 py-1">Statut</th>
                  <th className="border px-2 py-1">Repas</th>
                  <th className="border px-2 py-1">Total repas</th>
                </tr>
              </thead>
              <tbody>
                {inscriptions.map((i) => (
                  <tr key={i.id} className="border-t">
                    <td className="border px-2 py-1">{i.dossard || ""}</td>
                    <td className="border px-2 py-1">{i.nom}</td>
                    <td className="border px-2 py-1">{i.prenom}</td>
                    <td className="border px-2 py-1">{i.genre}</td>
                    <td className="border px-2 py-1">{i.date_naissance}</td>
                    <td className="border px-2 py-1">{i.nationalite}</td>
                    <td className="border px-2 py-1">{i.email}</td>
                    <td className="border px-2 py-1">{i.telephone}</td>
                    <td className="border px-2 py-1">{i.ville}</td>
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
                    <td className="border px-2 py-1">{i.nombre_repas || 0}</td>
                    <td className="border px-2 py-1">{i.prix_total_repas || 0} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
