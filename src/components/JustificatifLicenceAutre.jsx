// src/components/JustificatifLicenceAutre.jsx
import React from "react";

const FEDERATIONS = [
  { code: "FFA", label: "FFA (Athlé)" },
  { code: "FFC", label: "FFC (Cyclisme)" },
  { code: "FFTRI", label: "FFTRI (Triathlon)" },
  { code: "UFOLEP", label: "UFOLEP" },
  { code: "AUTRE", label: "Autre" },
];

export default function JustificatifLicenceAutre({
  federationCode = "AUTRE",
  licence = "",
  onChange,
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <label className="text-sm font-medium">Fédération</label>
        <select
          className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
          value={federationCode}
          onChange={(e) =>
            onChange?.({ federationCode: e.target.value, licence })
          }
        >
          {FEDERATIONS.map((f) => (
            <option key={f.code} value={f.code}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium">Numéro de licence</label>
        <input
          className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
          value={licence}
          onChange={(e) =>
            onChange?.({ federationCode, licence: e.target.value })
          }
          placeholder="Ex : 1234567"
        />
      </div>
    </div>
  );
}
