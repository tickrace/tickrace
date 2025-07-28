import React, { useState } from "react";
import { supabase } from "../supabase";

export default function UploadPPS({ onChange }) {
  const [ppsIdentifier, setPpsIdentifier] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [uploading, setUploading] = useState(false);
  const [fileUrl, setFileUrl] = useState("");

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const filename = `${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage
      .from("ppsjustificatifs")
      .upload(filename, file);

    if (error) {
      console.error("Erreur upload :", error);
      setUploading(false);
      return;
    }

    const url = supabase.storage
      .from("ppsjustificatifs")
      .getPublicUrl(filename).data.publicUrl;

    setFileUrl(url);
    setUploading(false);

    // Mettre à jour les données vers le parent
    onChange({
      pps_identifier: ppsIdentifier,
      pps_expiry_date: expiryDate,
      justificatif_url: url,
    });
  };

  const handleFieldChange = (field, value) => {
    const newValues = {
      pps_identifier: field === "pps_identifier" ? value : ppsIdentifier,
      pps_expiry_date: field === "pps_expiry_date" ? value : expiryDate,
      justificatif_url: fileUrl,
    };
    if (field === "pps_identifier") setPpsIdentifier(value);
    if (field === "pps_expiry_date") setExpiryDate(value);
    onChange(newValues);
  };

  return (
    <div className="space-y-2 mt-2">
      <input
        type="text"
        placeholder="Code PPS (ex : P73D3F3D5A4)"
        className="border p-2 w-full"
        value={ppsIdentifier}
        onChange={(e) => handleFieldChange("pps_identifier", e.target.value)}
      />
      <input
        type="date"
        className="border p-2 w-full"
        value={expiryDate}
        onChange={(e) => handleFieldChange("pps_expiry_date", e.target.value)}
      />
      <input
        type="file"
        accept="image/*,application/pdf"
        className="border p-2 w-full"
        onChange={handleUpload}
      />
      {uploading && <p className="text-sm text-gray-500">Upload en cours...</p>}
      {fileUrl && (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm">
          Voir justificatif
        </a>
      )}
    </div>
  );
}
