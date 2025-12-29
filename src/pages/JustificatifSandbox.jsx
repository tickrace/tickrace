// src/pages/JustificatifSandbox.jsx
import React, { useState } from "react";
import JustificatifField from "../components/justificatifs/JustificatifField";

export default function JustificatifSandbox() {
  // Simule un “legacy state” comme InscriptionCourse
  const [legacy, setLegacy] = useState({
    justificatif_type: "pps",
    justificatif_payload: {},
    numero_licence: "",
    pps_identifier: "",
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sandbox justificatifs</h1>
        <p className="text-neutral-600">
          Page de test locale pour valider tous les types sans toucher à InscriptionCourse.
        </p>
      </div>

      <JustificatifField
        legacy={legacy}
        setLegacy={setLegacy}
        title="Justificatif"
        subtitle="Test de l’adapter legacy → router → legacy"
        defaultType="pps"
        required={true}
        showDebug={true}
        // allowedTypes={["pps", "licence_ffa"]} // optionnel
      />
    </div>
  );
}
