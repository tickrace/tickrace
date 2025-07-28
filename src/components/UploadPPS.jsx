import React, { useRef, useState } from "react";
import { supabase } from "../supabase";

export default function UploadPPS({ index, onUpload }) {
  const fileInputRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const fileExt = file.name.split(".").pop();
    const filePath = `pps_${index}_${Date.now()}.${fileExt}`;

    setUploading(true);

    const { error } = await supabase.storage
      .from("ppsjustificatifs")
      .upload(filePath, file);

    if (error) {
      alert("Erreur lors de l'upload du fichier : " + error.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage
      .from("ppsjustificatifs")
      .getPublicUrl(filePath);

    setPreviewUrl(data.publicUrl);
    onUpload(data.publicUrl);
    setUploading(false);
  };

  return (
    <div className="space-y-2">
      <label className="font-semibold">Upload du fichier PPS (image scannée) :</label>
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        ref={fileInputRef}
        className="border p-2 w-full"
      />
      {uploading && <p className="text-sm text-gray-500">Envoi en cours...</p>}
      {previewUrl && (
        <img
          src={previewUrl}
          alt="Justificatif PPS"
          className="mt-2 border rounded max-w-xs"
        />
      )}
    </div>
  );
}
