import React, { useState } from "react";

export default function PPSVerifier({ onPPSData }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState(null);

  const extractPPSData = () => {
    setError(null);

    try {
      const parsedUrl = new URL(url);
      const dataParam = parsedUrl.searchParams.get("data");

      if (!dataParam) {
        setError("Paramètre 'data' manquant dans l'URL.");
        return;
      }

      const decodedData = atob(dataParam);
      const json = JSON.parse(decodedData);

      // Vérification minimum
      if (!json.first_name || !json.last_name) {
        setError("Données invalides ou incomplètes.");
        return;
      }

      onPPSData(json);
    } catch (err) {
      console.error("Erreur lors du décodage PPS :", err);
      setError("URL invalide ou donnée mal encodée.");
    }
  };

  return (
    <div className="mt-2">
      <label className="block font-medium">URL de vérification PPS :</label>
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://pps.athle.fr/courses/xxxx/verify?data=..."
        className="border p-2 w-full mt-1"
      />
      <button
        type="button"
        onClick={extractPPSData}
        className="mt-2 bg-blue-500 text-white px-4 py-1 rounded"
      >
        Charger données PPS
      </button>
      {error && <p className="text-red-600 mt-1">{error}</p>}
    </div>
  );
}
