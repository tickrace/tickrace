import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";

export default function ListeInscriptions() {
  const { courseId } = useParams();
  const [inscriptions, setInscriptions] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortKey, setSortKey] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");

  useEffect(() => {
    if (!courseId) return;

    const fetchInscriptions = async () => {
      const { data, error } = await supabase
        .from("inscriptions")
        .select("*")
        .eq("course_id", courseId);

      if (!error) setInscriptions(data);
      else console.error("Erreur récupération inscriptions", error);
    };

    fetchInscriptions();
  }, [courseId]);

  const handleDossardChange = async (id, value) => {
    const { error } = await supabase
      .from("inscriptions")
      .update({ numero_dossard: value })
      .eq("id", id);

    if (error) {
      alert("Erreur lors de l’attribution du dossard");
    } else {
      setInscriptions((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, numero_dossard: value } : i
        )
      );
    }
  };

  const handleValidation = async (id) => {
    const { error } = await supabase
      .from("inscriptions")
      .update({ statut: "validée" })
      .eq("id", id);

    if (error) {
      alert("Erreur lors de la validation");
    } else {
      setInscriptions((prev) =>
        prev.map((i) => (i.id === id ? { ...i, statut: "validée" } : i))
      );
    }
  };

  const filtered = inscriptions
    .filter((i) => {
      const full = `${i.nom} ${i.prenom} ${i.email}`.toLowerCase();
      return full.includes(search.toLowerCase());
    })
    .filter((i) => !statusFilter || i.statut === statusFilter)
    .sort((a, b) => {
      if (!sortKey) return 0;
      const aVal = a[sortKey] || "";
      const bVal = b[sortKey] || "";
      return sortOrder === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });

  if (!courseId) return <div className="p-6">Course ID non défini</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Liste des inscrits</h1>

      <div className="flex flex-wrap gap-4 mb-4">
        <input
          type="text"
          placeholder="Recherche par nom, prénom, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border p-2 flex-1 min-w-[200px]"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border p-2"
        >
          <option value="">Tous les statuts</option>
          <option value="en attente">En attente</option>
          <option value="validée">Validée</option>
        </select>
      </div>

      <div className="overflow-auto">
        <table className="min-w-[1200px] w-full text-sm border">
          <thead>
            <tr className="bg-gray-100">
              {[
                "prenom", "nom", "genre", "date_naissance", "nationalite",
                "email", "telephone", "adresse", "code_postal", "ville", "pays",
                "club", "justificatif_type", "numero_licence",
                "contact_urgence_nom", "contact_urgence_telephone",
                "statut", "numero_dossard", "created_at"
              ].map((key) => (
                <th
                  key={key}
                  className="border p-2 cursor-pointer whitespace-nowrap"
                  onClick={() =>
                    setSortKey(key) ||
                    setSortOrder(sortKey === key && sortOrder === "asc" ? "desc" : "asc")
                  }
                >
                  {key}
                  {sortKey === key && (sortOrder === "asc" ? " ↑" : " ↓")}
                </th>
              ))}
              <th className="border p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => (
              <tr key={i.id} className="hover:bg-gray-50">
                <td className="border p-2">{i.prenom}</td>
                <td className="border p-2">{i.nom}</td>
                <td className="border p-2">{i.genre}</td>
                <td className="border p-2">{i.date_naissance}</td>
                <td className="border p-2">{i.nationalite}</td>
                <td className="border p-2">{i.email}</td>
                <td className="border p-2">{i.telephone}</td>
                <td className="border p-2">{i.adresse}</td>
                <td className="border p-2">{i.code_postal}</td>
                <td className="border p-2">{i.ville}</td>
                <td className="border p-2">{i.pays}</td>
                <td className="border p-2">{i.club}</td>
                <td className="border p-2">{i.justificatif_type}</td>
                <td className="border p-2">{i.numero_licence}</td>
                <td className="border p-2">{i.contact_urgence_nom}</td>
                <td className="border p-2">{i.contact_urgence_telephone}</td>
                <td className="border p-2">{i.statut}</td>
                <td className="border p-2">
                  <input
                    type="text"
                    value={i.numero_dossard || ""}
                    onChange={(e) =>
                      handleDossardChange(i.id, e.target.value)
                    }
                    className="border px-2 py-1 w-20"
                  />
                </td>
                <td className="border p-2">{new Date(i.created_at).toLocaleString()}</td>
                <td className="border p-2">
                  {i.statut !== "validée" && (
                    <button
                      className="bg-green-600 text-white px-2 py-1 rounded"
                      onClick={() => handleValidation(i.id)}
                    >
                      Valider
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
