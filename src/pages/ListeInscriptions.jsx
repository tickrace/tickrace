import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { Download, Plus, X } from "lucide-react";

export default function ListeInscriptions() {
  const [inscriptions, setInscriptions] = useState([]);
  const [filtreStatut, setFiltreStatut] = useState("");
  const [recherche, setRecherche] = useState("");
  const [modalOuverte, setModalOuverte] = useState(false);
  const [formatActif, setFormatActif] = useState(null);
  const [formatsData, setFormatsData] = useState({});
  const [nouveauCoureur, setNouveauCoureur] = useState({});
  const [pageActuelle, setPageActuelle] = useState({});
  const pageTaille = 10;

  useEffect(() => {
    fetchInscriptions();
    fetchFormats();
  }, []);

  const fetchInscriptions = async () => {
    const { data, error } = await supabase
      .from("inscriptions")
      .select("*, formats(id, nom, prix_repas)");

    if (!error) setInscriptions(data);
  };

  const fetchFormats = async () => {
    const { data, error } = await supabase
      .from("formats")
      .select("id, nom, prix_repas");

    if (!error) {
      const map = {};
      data.forEach((f) => {
        map[f.id] = f;
      });
      setFormatsData(map);
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
    setNouveauCoureur({
      nom: "",
      prenom: "",
      email: "",
      genre: "",
      date_naissance: "",
      nationalite: "",
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
      statut: "en attente",
      numero_licence: "",
      dossard: null,
      nombre_repas: 0,
      prix_total_repas: 0,
      format_id: formatId,
    });
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
          <div key={formatId} className="mb-10">
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
              <table className="min-w-[1600px] w-full table-auto border-collapse border text-sm">
                <thead className="bg-gray-200">
                  <tr>
                    {[
                      "Nom", "Prénom", "Genre", "Date naissance", "Nationalité", "Email", "Téléphone",
                      "Adresse", "Adresse complément", "Code postal", "Ville", "Pays",
                      "Apparaître", "Club", "Justificatif", "Licence",
                      "Urgence nom", "Urgence tél.", "Statut", "Dossard", "Repas", "Prix repas (€)"
                    ].map((label) => (
                      <th key={label} className="border px-2 py-1">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {affichage.map((i) => (
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
                      <td className="border px-2 py-1">{i.apparaitre_resultats ? "Oui" : "Non"}</td>
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

      {/* Modal d'ajout manuel */}
      {modalOuverte && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center z-50 overflow-y-auto">
          <div className="bg-white p-6 rounded-lg w-[600px] relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setModalOuverte(false)}
              className="absolute top-2 right-2 text-gray-500 hover:text-black"
            >
              <X />
            </button>
            <h3 className="text-lg font-semibold mb-4">Ajouter un coureur</h3>

            {[
              { name: "nom", label: "Nom" },
              { name: "prenom", label: "Prénom" },
              { name: "email", label: "Email", type: "email" },
              { name: "genre", label: "Genre" },
              { name: "date_naissance", label: "Date de naissance", type: "date" },
              { name: "nationalite", label: "Nationalité" },
              { name: "telephone", label: "Téléphone" },
              { name: "adresse", label: "Adresse" },
              { name: "adresse_complement", label: "Complément" },
              { name: "code_postal", label: "Code postal" },
              { name: "ville", label: "Ville" },
              { name: "pays", label: "Pays" },
              { name: "club", label: "Club" },
              { name: "justificatif_type", label: "Justificatif" },
              { name: "contact_urgence_nom", label: "Contact urgence nom" },
              { name: "contact_urgence_telephone", label: "Contact urgence téléphone" },
              { name: "numero_licence", label: "N° Licence" },
              { name: "dossard", label: "Dossard", type: "number" },
            ].map(({ name, label, type }) => (
              <input
                key={name}
                type={type || "text"}
                placeholder={label}
                value={nouveauCoureur[name] || ""}
                onChange={(e) =>
                  setNouveauCoureur({ ...nouveauCoureur, [name]: e.target.value })
                }
                className="border w-full mb-2 px-3 py-1 rounded"
              />
            ))}

            <div className="flex items-center mb-2">
              <input
                type="checkbox"
                checked={nouveauCoureur.apparaitre_resultats}
                onChange={(e) =>
                  setNouveauCoureur({ ...nouveauCoureur, apparaitre_resultats: e.target.checked })
                }
                className="mr-2"
              />
              <label>Apparaître dans les résultats</label>
            </div>

            <input
              type="number"
              placeholder="Nombre de repas"
              value={nouveauCoureur.nombre_repas || 0}
              onChange={(e) => {
                const n = parseInt(e.target.value) || 0;
                const prix = formatsData[formatActif]?.prix_repas || 0;
                setNouveauCoureur({
                  ...nouveauCoureur,
                  nombre_repas: n,
                  prix_total_repas: n * prix,
                });
              }}
              className="border w-full mb-4 px-3 py-1 rounded"
            />

            <p className="text-sm mb-2">
              Prix total repas : <strong>{nouveauCoureur.prix_total_repas} €</strong>
            </p>

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

