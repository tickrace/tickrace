import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { Download, Plus, X } from "lucide-react";

export default function ListeInscriptions() {
  const [inscriptions, setInscriptions] = useState([]);
  const [filtreStatut, setFiltreStatut] = useState("");
  const [recherche, setRecherche] = useState("");
  const [modalOuverte, setModalOuverte] = useState(false);
  const [formatActif, setFormatActif] = useState(null);
  const [nouveauCoureur, setNouveauCoureur] = useState({
    nom: "",
    prenom: "",
    email: "",
    format_id: "",
  });
  const [pageActuelle, setPageActuelle] = useState({}); // format_id => page
  const pageTaille = 10;

  useEffect(() => {
    fetchInscriptions();
  }, []);

  const fetchInscriptions = async () => {
    const { data, error } = await supabase
      .from("inscriptions")
      .select("*, formats(id, nom)");

    if (error) {
      console.error("Erreur Supabase :", error);
    } else {
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
        prev.map((i) => (i.id === id ? { ...i, statut: nouveauStatut } : i))
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

  const formatsGroupes = {};

  inscriptionsFiltrees.forEach((i) => {
    const formatId = i.format_id;
    if (!formatId) return;
    if (!formatsGroupes[formatId]) {
      formatsGroupes[formatId] = {
        nom: i.formats?.nom || `Format ${formatId}`,
        lignes: [],
      };
    }
    formatsGroupes[formatId].lignes.push(i);
  });

  const ouvrirModal = (formatId) => {
    setFormatActif(formatId);
    setNouveauCoureur({ nom: "", prenom: "", email: "", format_id: formatId });
    setModalOuverte(true);
  };

  const ajouterCoureur = async () => {
    const { error } = await supabase.from("inscriptions").insert([nouveauCoureur]);
    if (!error) {
      setModalOuverte(false);
      fetchInscriptions();
    }
  };

  const changerPage = (formatId, direction) => {
    setPageActuelle((prev) => ({
      ...prev,
      [formatId]: Math.max(0, (prev[formatId] || 0) + direction),
    }));
  };

  const handleExportCSV = () => {
    const enTetes = [
      "Nom", "Prénom", "Email", "Format", "Statut",
    ];

    const lignes = inscriptionsFiltrees.map((i) => [
      i.nom || "",
      i.prenom || "",
      i.email || "",
      i.formats?.nom || "",
      i.statut || "",
    ]);

    const csvContent = [enTetes, ...lignes]
      .map((e) => e.map((v) => `"${(v + "").replace(/"/g, '""')}"`).join(";"))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inscriptions.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Liste des inscriptions</h1>

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

      {Object.entries(formatsGroupes).map(([formatId, { nom, lignes }]) => {
        const page = pageActuelle[formatId] || 0;
        const totalPages = Math.ceil(lignes.length / pageTaille);
        const affichage = lignes.slice(page * pageTaille, (page + 1) * pageTaille);

        return (
          <div key={formatId} className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold">{nom}</h2>
              <button
                onClick={() => ouvrirModal(formatId)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded flex items-center gap-2"
              >
                <Plus size={16} /> Ajouter un coureur
              </button>
            </div>

            <div className="overflow-auto">
              <table className="min-w-[600px] w-full table-auto border-collapse border">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="border px-2 py-1">Nom</th>
                    <th className="border px-2 py-1">Prénom</th>
                    <th className="border px-2 py-1">Email</th>
                    <th className="border px-2 py-1">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {affichage.map((i) => (
                    <tr key={i.id}>
                      <td className="border px-2 py-1">{i.nom}</td>
                      <td className="border px-2 py-1">{i.prenom}</td>
                      <td className="border px-2 py-1">{i.email}</td>
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
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-between mt-2 text-sm">
                <button
                  onClick={() => changerPage(formatId, -1)}
                  disabled={page === 0}
                  className="px-2 py-1 border rounded disabled:opacity-50"
                >
                  ◀ Précédent
                </button>
                <span>Page {page + 1} / {totalPages}</span>
                <button
                  onClick={() => changerPage(formatId, 1)}
                  disabled={page + 1 >= totalPages}
                  className="px-2 py-1 border rounded disabled:opacity-50"
                >
                  Suivant ▶
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {modalOuverte && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg w-[400px] relative">
            <button
              onClick={() => setModalOuverte(false)}
              className="absolute top-2 right-2 text-gray-500 hover:text-black"
            >
              <X />
            </button>
            <h3 className="text-lg font-semibold mb-4">Ajouter un coureur</h3>
            <input
              type="text"
              placeholder="Nom"
              value={nouveauCoureur.nom}
              onChange={(e) => setNouveauCoureur({ ...nouveauCoureur, nom: e.target.value })}
              className="border w-full mb-2 px-3 py-1 rounded"
            />
            <input
              type="text"
              placeholder="Prénom"
              value={nouveauCoureur.prenom}
              onChange={(e) => setNouveauCoureur({ ...nouveauCoureur, prenom: e.target.value })}
              className="border w-full mb-2 px-3 py-1 rounded"
            />
            <input
              type="email"
              placeholder="Email"
              value={nouveauCoureur.email}
              onChange={(e) => setNouveauCoureur({ ...nouveauCoureur, email: e.target.value })}
              className="border w-full mb-4 px-3 py-1 rounded"
            />
            <button
              onClick={ajouterCoureur}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded w-full"
            >
              Ajouter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
