import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";

export default function ListeInscriptions() {
  const { courseId } = useParams();
  const [inscriptions, setInscriptions] = useState([]);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("");
  const [sortKey, setSortKey] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("asc");

  useEffect(() => {
    fetchInscriptions();
  }, [courseId]);

  const fetchInscriptions = async () => {
    const { data, error } = await supabase
      .from("inscriptions")
      .select("*")
      .eq("course_id", courseId);
    if (!error) setInscriptions(data);
  };

  const updateDossard = async (id, dossard) => {
    await supabase.from("inscriptions").update({ numero_dossard: dossard }).eq("id", id);
    fetchInscriptions();
  };

  const toggleValidation = async (id, statut) => {
    const newStatut = statut === "valide" ? "en attente" : "valide";
    await supabase.from("inscriptions").update({ statut: newStatut }).eq("id", id);
    fetchInscriptions();
  };

  const filtered = inscriptions
    .filter((i) =>
      `${i.nom} ${i.prenom} ${i.email}`.toLowerCase().includes(search.toLowerCase())
    )
    .filter((i) => (filterStatut ? i.statut === filterStatut : true))
    .sort((a, b) => {
      if (!a[sortKey] || !b[sortKey]) return 0;
      return sortOrder === "asc"
        ? a[sortKey].localeCompare(b[sortKey])
        : b[sortKey].localeCompare(a[sortKey]);
    });

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Liste des inscrits</h1>

      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <input
          type="text"
          placeholder="Recherche..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border p-2 flex-1"
        />
        <select
          value={filterStatut}
          onChange={(e) => setFilterStatut(e.target.value)}
          className="border p-2"
        >
          <option value="">Tous les statuts</option>
          <option value="valide">Validé</option>
          <option value="en attente">En attente</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border text-sm">
          <thead>
            <tr>
              {[
                "nom",
                "prenom",
                "email",
                "genre",
                "date_naissance",
                "nationalite",
                "telephone",
                "adresse",
                "ville",
                "pays",
                "club",
                "justificatif_type",
                "numero_licence",
                "contact_urgence_nom",
                "contact_urgence_telephone",
                "statut",
                "numero_dossard",
                "created_at",
              ].map((key) => (
                <th
                  key={key}
                  className="border p-1 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort(key)}
                >
                  {key.replace(/_/g, " ")} {sortKey === key ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                </th>
              ))}
              <th className="border p-1">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => (
              <tr key={i.id} className="border-t">
                <td className="border px-2 py-1">{i.nom}</td>
                <td className="border px-2 py-1">{i.prenom}</td>
                <td className="border px-2 py-1">{i.email}</td>
                <td className="border px-2 py-1">{i.genre}</td>
                <td className="border px-2 py-1">{i.date_naissance}</td>
                <td className="border px-2 py-1">{i.nationalite}</td>
                <td className="border px-2 py-1">{i.telephone}</td>
                <td className="border px-2 py-1">{i.adresse}</td>
                <td className="border px-2 py-1">{i.ville}</td>
                <td className="border px-2 py-1">{i.pays}</td>
                <td className="border px-2 py-1">{i.club}</td>
                <td className="border px-2 py-1">{i.justificatif_type}</td>
                <td className="border px-2 py-1">{i.numero_licence}</td>
                <td className="border px-2 py-1">{i.contact_urgence_nom}</td>
                <td className="border px-2 py-1">{i.contact_urgence_telephone}</td>
                <td className="border px-2 py-1">{i.statut}</td>
                <td className="border px-2 py-1">
                  <input
                    type="text"
                    defaultValue={i.numero_dossard || ""}
                    onBlur={(e) => updateDossard(i.id, e.target.value)}
                    className="border p-1 w-20"
                  />
                </td>
                <td className="border px-2 py-1 text-xs">{i.created_at?.slice(0, 16)}</td>
                <td className="border px-2 py-1">
                  <button
                    onClick={() => toggleValidation(i.id, i.statut)}
                    className="text-xs bg-blue-600 text-white px-2 py-1 rounded"
                  >
                    {i.statut === "valide" ? "Invalider" : "Valider"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
