import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";

export default function ListeInscriptions() {
  const { formatId } = useParams();
  const [inscriptions, setInscriptions] = useState([]);
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState("");
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");

  useEffect(() => {
    if (!formatId) return;

    const fetchInscriptions = async () => {
      const { data, error } = await supabase
        .from("inscriptions")
        .select("*")
        .eq("format_id", formatId);

      if (!error) {
        setInscriptions(data);
      } else {
        console.error("Erreur récupération inscriptions", error);
      }
    };

    fetchInscriptions();
  }, [formatId]);

  const handleSort = (field) => {
    const direction = sortField === field && sortDirection === "asc" ? "desc" : "asc";
    setSortField(field);
    setSortDirection(direction);
  };

  const sortedFilteredInscriptions = inscriptions
    .filter((inscription) =>
      (inscription.nom?.toLowerCase().includes(search.toLowerCase()) ||
        inscription.prenom?.toLowerCase().includes(search.toLowerCase())) &&
      (statutFilter ? inscription.statut === statutFilter : true)
    )
    .sort((a, b) => {
      if (!sortField) return 0;
      if (a[sortField] < b[sortField]) return sortDirection === "asc" ? -1 : 1;
      if (a[sortField] > b[sortField]) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

  if (!formatId) return <div className="p-4">Format non défini.</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Liste des inscrits</h1>

      <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
        <input
          type="text"
          placeholder="Recherche nom ou prénom"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border px-3 py-2 rounded w-full md:w-1/3"
        />
        <select
          value={statutFilter}
          onChange={(e) => setStatutFilter(e.target.value)}
          className="border px-3 py-2 rounded w-full md:w-1/4"
        >
          <option value="">Tous les statuts</option>
          <option value="en attente">En attente</option>
          <option value="valide">Validé</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="cursor-pointer" onClick={() => handleSort("nom")}>Nom</th>
              <th className="cursor-pointer" onClick={() => handleSort("prenom")}>Prénom</th>
              <th>Genre</th>
              <th>Naissance</th>
              <th>Nationalité</th>
              <th>Email</th>
              <th>Téléphone</th>
              <th>Club</th>
              <th>Justificatif</th>
              <th>Contact urgence</th>
              <th>Statut</th>
              <th>Dossard</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedFilteredInscriptions.map((i) => (
              <tr key={i.id} className="border-t">
                <td>{i.nom}</td>
                <td>{i.prenom}</td>
                <td>{i.genre}</td>
                <td>{i.date_naissance}</td>
                <td>{i.nationalite}</td>
                <td>{i.email}</td>
                <td>{i.telephone}</td>
                <td>{i.club}</td>
                <td>{i.justificatif_type}</td>
                <td>{i.contact_urgence_nom} ({i.contact_urgence_telephone})</td>
                <td>{i.statut}</td>
                <td>
                  <input
                    type="text"
                    defaultValue={i.numero_dossard || ""}
                    onBlur={async (e) => {
                      const { error } = await supabase
                        .from("inscriptions")
                        .update({ numero_dossard: e.target.value })
                        .eq("id", i.id);
                      if (error) alert("Erreur mise à jour dossard");
                    }}
                    className="border px-1 py-0.5 w-20"
                  />
                </td>
                <td>
                  {i.statut !== "valide" && (
                    <button
                      onClick={async () => {
                        const { error } = await supabase
                          .from("inscriptions")
                          .update({ statut: "valide" })
                          .eq("id", i.id);
                        if (!error) {
                          setInscriptions((prev) =>
                            prev.map((ins) =>
                              ins.id === i.id ? { ...ins, statut: "valide" } : ins
                            )
                          );
                        }
                      }}
                      className="bg-green-600 text-white px-2 py-1 rounded"
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
