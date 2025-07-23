import React, { useState } from "react";
import { X, Download } from "lucide-react";

export default function ExportCSVModal({
  isOpen,
  onClose,
  colonnes,
  donnees,
  nomFichier = "export.csv",
}) {
  const [selection, setSelection] = useState(colonnes.map((c) => c.key));

  const toggleColonne = (key) => {
    setSelection((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const exporterCSV = () => {
    const lignes = [];
    const entetes = colonnes
      .filter((c) => selection.includes(c.key))
      .map((c) => c.label);
    lignes.push(entetes);

    donnees.forEach((item) => {
      const ligne = colonnes
        .filter((c) => selection.includes(c.key))
        .map((c) => {
          const val = item[c.key];
          if (val === null || val === undefined) return "";
          if (typeof val === "boolean") return val ? "Oui" : "Non";
          if (val instanceof Date) return val.toISOString().split("T")[0];
          return String(val).replace(/"/g, '""'); // Escape quotes
        });
      lignes.push(ligne);
    });

    const contenu = lignes.map((l) => l.join(";")).join("\n");
    const blob = new Blob([contenu], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomFichier;
    a.click();
    URL.revokeObjectURL(url);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded w-full max-w-md max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Sélection des colonnes</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-red-600">
            <X />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm mb-4">
          {colonnes.map((c) => (
            <label key={c.key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selection.includes(c.key)}
                onChange={() => toggleColonne(c.key)}
              />
              {c.label}
            </label>
          ))}
        </div>

        <button
          onClick={exporterCSV}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded w-full flex justify-center items-center gap-2"
        >
          <Download size={16} />
          Exporter les données
        </button>
      </div>
    </div>
  );
}
