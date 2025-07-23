// ... (imports et autres useState inchangés)
const [colonnesExport, setColonnesExport] = useState({});

const colonnesDisponibles = [
  { key: "nom", label: "Nom" },
  { key: "prenom", label: "Prénom" },
  { key: "genre", label: "Genre" },
  { key: "date_naissance", label: "Date de naissance" },
  { key: "nationalite", label: "Nationalité" },
  { key: "email", label: "Email" },
  { key: "telephone", label: "Téléphone" },
  { key: "adresse", label: "Adresse" },
  { key: "adresse_complement", label: "Complément" },
  { key: "code_postal", label: "Code postal" },
  { key: "ville", label: "Ville" },
  { key: "pays", label: "Pays" },
  { key: "apparaitre_resultats", label: "Résultats visibles" },
  { key: "club", label: "Club" },
  { key: "justificatif_type", label: "Justificatif" },
  { key: "numero_licence", label: "N° Licence" },
  { key: "contact_urgence_nom", label: "Contact urgence nom" },
  { key: "contact_urgence_telephone", label: "Contact urgence tél" },
  { key: "statut", label: "Statut" },
  { key: "dossard", label: "Dossard" },
  { key: "nombre_repas", label: "Nb repas" },
  { key: "prix_total_repas", label: "Prix repas (€)" },
];

const handleToggleColonne = (formatId, key) => {
  setColonnesExport((prev) => {
    const actuelles = prev[formatId] || [];
    return {
      ...prev,
      [formatId]: actuelles.includes(key)
        ? actuelles.filter((k) => k !== key)
        : [...actuelles, key],
    };
  });
};

const handleExportParFormat = (formatId, nomFormat, lignes) => {
  const selectedKeys = colonnesExport[formatId] || [];
  if (selectedKeys.length === 0) {
    alert("Veuillez sélectionner au moins une colonne.");
    return;
  }

  const enTetes = selectedKeys.map(
    (key) => colonnesDisponibles.find((col) => col.key === key)?.label || key
  );

  const contenu = lignes.map((i) =>
    selectedKeys.map((key) => {
      if (key === "apparaitre_resultats") return i[key] ? "Oui" : "Non";
      return i[key] || "";
    })
  );

  const csvContent = [enTetes, ...contenu]
    .map((e) => e.map((v) => `"${(v + "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `inscriptions_${nomFormat.replace(/\s+/g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
      {Object.entries(formatsGroupes).map(([formatId, { nom, lignes }]) => {
        const page = pageActuelle[formatId] || 0;
        const totalPages = Math.ceil(lignes.length / pageTaille);
        const affichage = lignes.slice(page * pageTaille, (page + 1) * pageTaille);

        return (
          <div key={formatId} className="mb-12 border-t pt-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold">{nom}</h2>
              <button
                onClick={() => ouvrirModal(formatId)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded flex items-center gap-2"
              >
                <Plus size={16} /> Ajouter un coureur
              </button>
            </div>

            <div className="mb-3">
              <p className="font-medium text-sm mb-1">Colonnes à exporter :</p>
              <div className="flex flex-wrap gap-3">
                {colonnesDisponibles.map(({ key, label }) => (
                  <label key={key} className="text-sm flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={colonnesExport[formatId]?.includes(key) || false}
                      onChange={() => handleToggleColonne(formatId, key)}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <button
                onClick={() => handleExportParFormat(formatId, nom, lignes)}
                className="mt-2 bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded text-sm"
              >
                Exporter ce format en CSV
              </button>
            </div>

            <div className="overflow-auto">
              <table className="min-w-[1600px] w-full table-auto border-collapse border text-sm">
                <thead className="bg-gray-200">
                  <tr>
                    {colonnesDisponibles.map(({ label }) => (
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
    </div>
  );
}

