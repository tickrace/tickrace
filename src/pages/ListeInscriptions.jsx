
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { Download, Plus, X } from "lucide-react";
import ExportCSVModal from "../components/ExportCSVModal";

export default function ListeInscriptions() {
  const [inscriptions, setInscriptions] = useState([]);
  const [formats, setFormats] = useState([]);
  const [modalOpen, setModalOpen] = useState(null);
  const [nouvelleInscription, setNouvelleInscription] = useState({});
  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("");
  const [pageParFormat, setPageParFormat] = useState({});
  const lignesParPage = 10;

  useEffect(() => {
    fetchInscriptions();
  }, []);

  const fetchInscriptions = async () => {
    const { data, error } = await supabase
      .from("inscriptions")
      .select("*, formats (id, nom)");

    if (!error) {
      setInscriptions(data);
      const formatsUniques = Array.from(
        new Map(data.map((i) => [i.format_id, i.formats])).values()
      );
      setFormats(formatsUniques);
    }
  };

  const handleAjoutInscription = async () => {
    if (!nouvelleInscription.format_id || !nouvelleInscription.nom) return;

    const { error } = await supabase.from("inscriptions").insert([nouvelleInscription]);
    if (!error) {
      setNouvelleInscription({});
      setModalOpen(null);
      fetchInscriptions();
    }
  };

  const handleStatutChange = async (id, statut) => {
    await supabase.from("inscriptions").update({ statut }).eq("id", id);
    setInscriptions((prev) =>
      prev.map((i) => (i.id === id ? { ...i, statut } : i))
    );
  };

  const handleExportCSV = (formatId) => {
    const inscriptionsFiltrees = inscriptions.filter((i) => i.format_id === formatId);
    const colonnes = [
      "dossard",
      "nom",
      "prenom",
      "genre",
      "date_naissance",
      "nationalite",
      "email",
      "telephone",
      "adresse",
      "adresse_complement",
      "code_postal",
      "ville",
      "pays",
      "apparaitre_resultats",
      "club",
      "justificatif_type",
      "numero_licence",
      "contact_urgence_nom",
      "contact_urgence_telephone",
      "statut",
      "created_at",
      "nombre_repas",
      "prix_total_repas",
    ];

    const csvContent = [
      colonnes.join(","),
      ...inscriptionsFiltrees.map((i) =>
        colonnes.map((c) => `"${i[c] ?? ""}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `inscriptions_${formatId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const colonnes = [
    { key: "dossard", label: "Dossard" },
    { key: "nom", label: "Nom" },
    { key: "prenom", label: "Prénom" },
    { key: "genre", label: "Genre" },
    { key: "date_naissance", label: "Date de naissance" },
    { key: "nationalite", label: "Nationalité" },
    { key: "email", label: "Email" },
    { key: "telephone", label: "Téléphone" },
    { key: "adresse", label: "Adresse" },
    { key: "adresse_complement", label: "Complément d'adresse" },
    { key: "code_postal", label: "Code postal" },
    { key: "ville", label: "Ville" },
    { key: "pays", label: "Pays" },
    { key: "apparaitre_resultats", label: "Apparaît dans les résultats" },
    { key: "club", label: "Club" },
    { key: "justificatif_type", label: "Justificatif" },
    { key: "numero_licence", label: "Licence" },
    { key: "contact_urgence_nom", label: "Nom contact urgence" },
    { key: "contact_urgence_telephone", label: "Téléphone urgence" },
    { key: "statut", label: "Statut" },
    { key: "created_at", label: "Date inscription" },
    { key: "nombre_repas", label: "Repas" },
    { key: "prix_total_repas", label: "Prix repas (€)" },
  ];

  return (
    <div className="p-4">
      <h2 className="text-2xl font-semibold mb-4">Inscriptions</h2>

      {formats.map((format) => {
        const inscriptionsFiltrees = inscriptions.filter(
          (i) =>
            i.format_id === format.id &&
            (filtreStatut ? i.statut === filtreStatut : true) &&
            `${i.nom} ${i.prenom}`.toLowerCase().includes(recherche.toLowerCase())
        );

        const page = pageParFormat[format.id] || 1;
        const deb = (page - 1) * lignesParPage;
        const inscriptionsPage = inscriptionsFiltrees.slice(deb, deb + lignesParPage);
        const [modalExportOpen, setModalExportOpen] = useState(false);
        return (
          <div key={format.id} className="mb-12 border p-4 rounded-lg bg-white shadow">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-bold">{format.nom}</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Rechercher..."
                  className="border px-2 py-1 rounded"
                  onChange={(e) => setRecherche(e.target.value)}
                />
                <select
  onChange={(e) => setFiltreStatut(e.target.value)}
  className="border px-2 py-1 rounded">
  <option value="">Tous statuts</option>
  <option value="en attente">En attente</option>
  <option value="validé">Validé</option>
  <option value="refusé">Refusé</option>
  <option value="annulé">Annulé</option>
</select>

                <button
                  onClick={() => handleExportCSV(format.id)}
                  className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
                >
                  <Download size={16} /> Export CSV
                </button>
<button
  onClick={() => setModalExportOpen(true)}
  className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
>
  <Download size={16} /> Export CSV selectif
</button>

                <button
                  onClick={() => setModalOpen(format.id)}
                  className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                >
                  <Plus size={16} /> Ajouter un coureur
                </button>
              </div>
            </div>

            <div className="overflow-auto">
              <table className="min-w-full text-sm border">
                <thead className="bg-gray-100">
                  <tr>
                    {colonnes.map((col) => (
                      <th key={col.key} className="px-2 py-1 border text-left whitespace-nowrap">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inscriptionsPage.map((i) => (
                    <tr key={i.id}>
                      {colonnes.map((col) => (
                        <td key={col.key} className="px-2 py-1 border whitespace-nowrap">
                         {col.key === "statut" ? (
  i.statut === "annulé" ? (
    <span className="text-red-600 font-semibold text-xs">Annulé</span>
  ) : (
    <select
      value={i.statut}
      onChange={(e) => handleStatutChange(i.id, e.target.value)}
      className="border px-1 py-0.5 rounded text-xs"
    >
      <option value="en attente">En attente</option>
      <option value="validé">Validé</option>
      <option value="refusé">Refusé</option>
      <option value="annulé">Annulé</option>
    </select>
)

                          ) : col.key === "dossard" ? (
                            <input
                              type="number"
                              value={i.dossard || ""}
                              onChange={async (e) => {
                                const val = parseInt(e.target.value);
                                await supabase
                                  .from("inscriptions")
                                  .update({ dossard: val })
                                  .eq("id", i.id);
                                setInscriptions((prev) =>
                                  prev.map((ins) =>
                                    ins.id === i.id ? { ...ins, dossard: val } : ins
                                  )
                                );
                              }}
                              className="border px-1 py-0.5 rounded w-16 text-xs"
                            />
                          ) : typeof i[col.key] === "boolean" ? (
                            i[col.key] ? "Oui" : "Non"
                          ) : (
                            i[col.key] || ""
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between mt-2 text-sm">
              <span>
                Page {page} / {Math.ceil(inscriptionsFiltrees.length / lignesParPage)}
              </span>
              <div className="flex gap-1">
                <button
                  disabled={page === 1}
                  onClick={() =>
                    setPageParFormat((prev) => ({ ...prev, [format.id]: page - 1 }))
                  }
                  className="px-2 py-1 border rounded disabled:opacity-50"
                >
                  Préc.
                </button>
                <button
                  disabled={page * lignesParPage >= inscriptionsFiltrees.length}
                  onClick={() =>
                    setPageParFormat((prev) => ({ ...prev, [format.id]: page + 1 }))
                  }
                  className="px-2 py-1 border rounded disabled:opacity-50"
                >
                  Suiv.
                </button>
              </div>
            </div>

            {modalOpen === format.id && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded shadow max-h-[90vh] overflow-auto">
                  <h3 className="text-lg font-semibold mb-2">Ajout d’un coureur</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {colonnes.map((col) => (
                      <div key={col.key}>
                        <label className="block text-gray-700 text-xs">{col.label}</label>
                        <input
                          type="text"
                          value={nouvelleInscription[col.key] || ""}
                          onChange={(e) =>
                            setNouvelleInscription((prev) => ({
                              ...prev,
                              [col.key]: e.target.value,
                              format_id: format.id,
                            }))
                          }
                          className="w-full border px-2 py-1 rounded"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-4">
                    <button
                      onClick={handleAjoutInscription}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                    >
                      Enregistrer
                    </button>
                    <button
                      onClick={() => setModalOpen(null)}
                      className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
