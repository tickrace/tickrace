// src/pages/ListeInscriptions.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { Download, Plus, X } from "lucide-react";
import ExportCSVModal from "../components/ExportCSVModal";

export default function ListeInscriptions() {
  const [inscriptions, setInscriptions] = useState([]);
  const [formats, setFormats] = useState([]);
  const [modalOpen, setModalOpen] = useState(null);
  const [nouvelleInscription, setNouvelleInscription] = useState({});
  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("");
  const [pageParFormat, setPageParFormat] = useState({});
  const lignesParPage = 10;

  useEffect(() => {
    fetchInscriptions();
  }, []);

  const fetchInscriptions = async () => {
    const { data, error } = await supabase
      .from("inscriptions")
      .select("*, formats (id, nom)");

    if (!error) {
      const inscriptionsValides = data.filter((i) => i.formats !== null);
      setInscriptions(inscriptionsValides);

      const formatsUniques = Array.from(
        new Map(inscriptionsValides.map((i) => [i.format_id, i.formats])).values()
      );
      setFormats(formatsUniques);
    }
  };

  const handleAjoutInscription = async () => {
    if (!nouvelleInscription.format_id || !nouvelleInscription.nom) return;

    const { error } = await supabase.from("inscriptions").insert([nouvelleInscription]);
    if (!error) {
      setNouvelleInscription({});
      setModalOpen(null);
      fetchInscriptions();
    }
  };

  const handleStatutChange = async (id, statut) => {
    await supabase.from("inscriptions").update({ statut }).eq("id", id);
    setInscriptions((prev) =>
      prev.map((i) => (i.id === id ? { ...i, statut } : i))
    );
  };

  const handleExportCSV = (formatId) => {
    const inscriptionsFiltrees = inscriptions.filter((i) => i.format_id === formatId);
    const colonnes = [
      "dossard",
      "nom",
      "prenom",
      "genre",
      "date_naissance",
      "nationalite",
      "email",
      "telephone",
      "adresse",
      "adresse_complement",
      "code_postal",
      "ville",
      "pays",
      "apparaitre_resultats",
      "club",
      "justificatif_type",
      "numero_licence",
      "contact_urgence_nom",
      "contact_urgence_telephone",
      "statut",
      "created_at",
      "nombre_repas",
      "prix_total_repas",
    ];

    const csvContent = [
      colonnes.join(","),
      ...inscriptionsFiltrees.map((i) =>
        colonnes.map((c) => `"${i[c] ?? ""}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `inscriptions_${formatId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const colonnes = [
    { key: "dossard", label: "Dossard" },
    { key: "nom", label: "Nom" },
    { key: "prenom", label: "Prénom" },
    { key: "genre", label: "Genre" },
    { key: "date_naissance", label: "Date de naissance" },
    { key: "nationalite", label: "Nationalité" },
    { key: "email", label: "Email" },
    { key: "telephone", label: "Téléphone" },
    { key: "adresse", label: "Adresse" },
    { key: "adresse_complement", label: "Complément d'adresse" },
    { key: "code_postal", label: "Code postal" },
    { key: "ville", label: "Ville" },
    { key: "pays", label: "Pays" },
    { key: "apparaitre_resultats", label: "Apparaît dans les résultats" },
    { key: "club", label: "Club" },
    { key: "justificatif_type", label: "Justificatif" },
    { key: "numero_licence", label: "Licence" },
    { key: "contact_urgence_nom", label: "Nom contact urgence" },
    { key: "contact_urgence_telephone", label: "Téléphone urgence" },
    { key: "statut", label: "Statut" },
    { key: "created_at", label: "Date inscription" },
    { key: "nombre_repas", label: "Repas" },
    { key: "prix_total_repas", label: "Prix repas (€)" },
  ];

  return (
    <div className="p-4">
      <h2 className="text-2xl font-semibold mb-4">Inscriptions</h2>
      {/* ... le reste du JSX est inchangé ... */}
    </div>
  );
}
