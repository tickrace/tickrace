import React, { useState } from "react";

export default function PPSVerifier({ onPPSData }) {
  const [ppsUrl, setPpsUrl] = useState("");
  const [decodedData, setDecodedData] = useState(null);

  const handleExtract = () => {
    try {
      const url = new URL(ppsUrl);
      const base64Data = url.searchParams.get("data");
      if (!base64Data) throw new Error("Données manquantes dans l'URL.");

      const jsonStr = atob(base64Data);
      const data = JSON.parse(jsonStr);

      setDecodedData(data);

      const gender = data.gender === "male" ? "Homme" : "Femme";

      // Renvoi des données au parent
      onPPSData({
        first_name: data.first_name,
        last_name: data.last_name,
        birthdate: data.birthdate,
        gender,
        pps_identifier: data.pps_identifier,
        pps_expiry_date: data.expiry_date,
      });
    } catch (err) {
      alert("Erreur de lecture du QR code : " + err.message);
    }
  };

  return (
    <div className="space-y-2 mt-2">
      <input
        type="text"
        placeholder="Collez ici l'URL du QR code PPS"
        value={ppsUrl}
        onChange={(e) => setPpsUrl(e.target.value)}
        className="border p-2 w-full"
      />
      <button
        type="button"
        onClick={handleExtract}
        className="bg-gray-800 text-white px-3 py-1 rounded"
      >
        Extraire données PPS
      </button>

      {decodedData && (
        <div className="text-sm text-gray-700 mt-2">
          <p>Prénom : {decodedData.first_name}</p>
          <p>Nom : {decodedData.last_name}</p>
          <p>Date de naissance : {decodedData.birthdate}</p>
          <p>Genre : {decodedData.gender}</p>
          <p>N° PPS : {decodedData.pps_identifier}</p>
          <p>Expire le : {decodedData.expiry_date}</p>
        </div>
      )}
    </div>
  );
}
