export const JUSTIF_TYPES = [
  { value: "", label: "— Aucun —", requiresUpload: false, requiresLicence: false },

  { value: "certificat_medical", label: "Certificat médical (upload)", requiresUpload: true, requiresLicence: false },

  { value: "licence_ffa", label: "Licence FFA (numéro)", requiresUpload: false, requiresLicence: true },
  { value: "licence_ffc", label: "Licence FFC (numéro)", requiresUpload: false, requiresLicence: true },
  { value: "licence_autre", label: "Licence autre fédération (numéro)", requiresUpload: false, requiresLicence: true },

  { value: "attestation_assurance", label: "Attestation d’assurance (upload)", requiresUpload: true, requiresLicence: false },
  { value: "piece_identite", label: "Pièce d’identité (upload)", requiresUpload: true, requiresLicence: false },
];

export const getJustifMeta = (value) => JUSTIF_TYPES.find((t) => t.value === value) || JUSTIF_TYPES[0];

export const getAllowedCourseJustifs = (course) =>
  [course?.justif_type_1, course?.justif_type_2, course?.justif_type_3].filter(Boolean).filter((v) => v !== "");
