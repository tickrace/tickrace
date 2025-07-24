import React, { useState, useEffect } from "react";
import Papa from "papaparse";

const ExportCSVModal = ({
  isOpen,
  onClose,
  colonnes = [],
  donnees = [],
  nomFichier = "export.csv",
}) => {
  const [selectedCols, setSelectedCols] = useState([]);

  useEffect(() => {
    if (isOpen && colonnes.length > 0) {
      setSelectedCols(colonnes); // tout sélectionné par défaut
    }
  }, [isOpen, colonnes]);

  const handleToggleCol = (col) => {
    setSelectedCols((prev) =>
      prev.includes(col)
        ? prev.filter((c) => c !== col)
        : [...prev, col]
    );
  };

  const handleExport = () => {
    const filteredData = donnees.map((item) => {
      const row = {};
      selectedCols.forEach((col) => {
        let value = item[col];
        if (value === null || value === undefined) value = "";
        row[col] = value;
      });
      return row;
    });

    const csv = Papa.unparse(filteredData, {
      quotes: true,
      skipEmptyLines: true,
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomFichier;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Exporter en CSV</h2>
        <p className="text-sm mb-2">Colonnes à inclure dans l’export :</p>
        <div className="max-h-64 overflow-y-auto mb-4 border p-2 rounded">
          {colonnes.map((col) => (
            <label key={col} className="flex items-center space-x-2 mb-1">
              <input
                type="checkbox"
                checked={selectedCols.includes(col)}
                onChange={() => handleToggleCol(col)}
              />
              <span className="text-sm">{col}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1 bg-gray-300 rounded hover:bg-gray-400"
          >
            Annuler
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Exporter
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportCSVModal;
