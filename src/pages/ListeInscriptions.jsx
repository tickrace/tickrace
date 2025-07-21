import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";

export default function ListeInscriptions() {
  const { format_id: formatId } = useParams();
  const [inscriptions, setInscriptions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statutFilter, setStatutFilter] = useState("");

  useEffect(() => {
    if (formatId) {
      fetchInscriptions();
    }
  }, [formatId]);

  const fetchInscriptions = async () => {
    const { data, error } = await supabase
      .from("inscriptions")
      .select("*")
      .eq("format_id", formatId)
      .order("created_at", { ascending: true });

    if (!error) setInscriptions(data);
    else console.error("Erreur récupération inscriptions", error);
  };

  const handleChangeDossard = async (id, newDossard) => {
    const { error } = await supabase
      .from("inscriptions")
      .update({ dossard: newDossard })
      .eq("id", id);

    if (error) {
      alert("Erreur mise à jour du dossard");
      console.error(error);
    } else {
      fetchInscriptions();
    }
  };

  const filtered = inscriptions
    .filter((i) =>
      `${i.nom} ${i.prenom} ${i.email} ${i.ville}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    )
    .filter((i) => (statutFilter ? i.statut === statutFilter : true));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Liste des inscrits</h1>

      <div className="flex flex-wrap gap-4 mb-4">
        <input
          type="text"
          placeholder="Recherche..."
          className="border p-2 flex-1"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="border p-2"
          value={statutFilter}
          onChange={(e) => setStatutFilter(e.target.value)}
        >
          <option value="">Tous les statuts</option>
          <option value="en attente">En attente</option>
          <option value="validé">Validé</option>
          <option value="refusé">Refusé</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2">Dossard</th>
              <th className="border p-2">Nom</th>
              <th className="border p-2">Prénom</th>
              <th className="border p-2">Genre</th>
              <th className="border p-2">Date naissance</th>
              <th className="border p-2">Nationalité</th>
              <th className="border p-2">Email</th>
              <th className="border p-2">Téléphone</th>
              <th className="border p-2">Adresse</th>
              <th className="border p-2">Code postal</th>
              <th className="border p-2">Ville</th>
              <th className="border p-2">Pays</th>
              <th className="border p-2">Club</th>
              <th className="border p-2">Justificatif</th>
              <th className="border p-2">Licence</th>
              <th className="border p-2">Contact urgence</th>
              <th className="border p-2">Statut</th>
              <th className="border p-2">Date inscription</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => (
              <tr key={i.id} className="hover:bg-gray-50">
                <td className="border p-2">
                  <input
                    type="number"
                    className="border w-16 p-1"
                    value={i.dossard || ""}
                    onChange={(e) => handleChangeDossard(i.id, e.target.value)}
                  />
                </td>
                <td className="border p-2">{i.nom}</td>
                <td className="border p-2">{i.prenom}</td>
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
                <td className="border p-2">
                  {i.contact_urgence_nom} ({i.contact_urgence_telephone})
                </td>
                <td className="border p-2">{i.statut}</td>
                <td className="border p-2">
                  {new Date(i.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
