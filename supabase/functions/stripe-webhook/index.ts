import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { Link, useParams } from "react-router-dom";

export default function ListeInscriptions() {
  const { format_id } = useParams();
  const [formatNom, setFormatNom] = useState("");
  const [inscriptions, setInscriptions] = useState([]);
  const [optionsByInscription, setOptionsByInscription] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [statutFilter, setStatutFilter] = useState("");
  const [page, setPage] = useState(0);
  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    if (!format_id) return;
    (async () => {
      // Inscriptions + nom du format
      const { data, error } = await supabase
        .from("inscriptions")
        .select("*, formats(id, nom)")
        .eq("format_id", format_id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error(error);
        setInscriptions([]);
        setOptionsByInscription({});
        return;
      }

      const list = data || [];
      setInscriptions(list);
      setFormatNom(list?.[0]?.formats?.nom || "");

      // Options confirmées pour ces inscriptions
      const ids = list.map((r) => r.id);
      if (ids.length) {
        const { data: opts, error: e2 } = await supabase
          .from("inscriptions_options")
          .select("inscription_id, quantity, prix_unitaire_cents, status, options_catalogue(label)")
          .in("inscription_id", ids)
          .eq("status", "confirmed");

        if (!e2 && opts) {
          const map = {};
          for (const row of opts) {
            const key = row.inscription_id;
            if (!map[key]) map[key] = [];
            map[key].push({
              label: row.options_catalogue?.label || "Option",
              qty: Number(row.quantity || 0),
              pu: Number(row.prix_unitaire_cents || 0),
            });
          }
          setOptionsByInscription(map);
        } else {
          setOptionsByInscription({});
        }
      } else {
        setOptionsByInscription({});
      }
      setPage(0);
    })();
  }, [format_id]);

  const filtered = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return (inscriptions || []).filter((insc) => {
      const matchesSearch = !needle
        ? true
        : [
            insc?.nom,
            insc?.prenom,
            insc?.email,
            insc?.club,
            insc?.dossard,
            insc?.team_name,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(needle);
      const matchesStatut = !statutFilter || insc.statut === statutFilter;
      return matchesSearch && matchesStatut;
    });
  }, [inscriptions, searchTerm, statutFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice(
    page * ITEMS_PER_PAGE,
    (page + 1) * ITEMS_PER_PAGE
  );

  const handleUpdateChamp = async (id, field, value) => {
    const { error } = await supabase
      .from("inscriptions")
      .update({ [field]: value })
      .eq("id", id);
    if (error) {
      console.error(error);
      alert("Échec de la mise à jour.");
    } else {
      // Optimiste côté client
      setInscriptions((prev) =>
        prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
      );
    }
  };

  const renderEditable = (value, id, field, type = "text") => {
    if (field === "statut") {
      return (
        <select
          className="w-full border rounded px-2 py-1"
          value={value || ""}
          onChange={(e) => handleUpdateChamp(id, field, e.target.value)}
        >
          <option value="en attente">En attente</option>
          <option value="validé">Validé</option>
          <option value="refusé">Refusé</option>
          <option value="annulé">Annulé</option>
        </select>
      );
    }
    return (
      <input
        type={type}
        className="w-full border rounded px-2 py-1"
        defaultValue={value || ""}
        onBlur={(e) => {
          const v = type === "number" ? Number(e.target.value || 0) : e.target.value;
          if (v !== value) handleUpdateChamp(id, field, v);
        }}
      />
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Inscriptions</h1>
          {formatNom && (
            <span className="text-neutral-600">
              — Format : <strong>{formatNom}</strong>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            className="border rounded px-3 py-2 text-sm w-full md:w-64"
            placeholder="Recherche (nom, email, club…)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="border rounded px-3 py-2 text-sm"
            value={statutFilter}
            onChange={(e) => setStatutFilter(e.target.value)}
          >
            <option value="">Tous les statuts</option>
            <option value="en attente">En attente</option>
            <option value="validé">Validé</option>
            <option value="refusé">Refusé</option>
            <option value="annulé">Annulé</option>
          </select>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-700">
            <tr>
              <th className="text-left px-4 py-3">Nom</th>
              <th className="text-left px-4 py-3">Prénom</th>
              <th className="text-left px-4 py-3">Dossard</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Club</th>
              <th className="text-left px-4 py-3">Équipe</th>
              <th className="text-left px-4 py-3">Options (confirmées)</th>
              <th className="text-left px-4 py-3">Statut</th>
              <th className="text-left px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-neutral-600" colSpan={9}>
                  Aucune inscription trouvée.
                </td>
              </tr>
            ) : (
              paginated.map((insc) => {
                const opts = optionsByInscription[insc.id] || [];
                return (
                  <tr key={insc.id} className="odd:bg-neutral-50/50">
                    <td className="px-4 py-3">
                      {renderEditable(insc.nom, insc.id, "nom")}
                    </td>
                    <td className="px-4 py-3">
                      {renderEditable(insc.prenom, insc.id, "prenom")}
                    </td>
                    <td className="px-4 py-3 w-[100px]">
                      {renderEditable(insc.dossard, insc.id, "dossard", "number")}
                    </td>
                    <td className="px-4 py-3">
                      {renderEditable(insc.email, insc.id, "email")}
                    </td>
                    <td className="px-4 py-3">
                      {renderEditable(insc.club, insc.id, "club")}
                    </td>
                    <td className="px-4 py-3">
                      {/* essaye d'afficher un nom d'équipe si présent; sinon — */}
                      {insc.team_name || insc.equipe_nom || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {opts.length === 0 ? (
                        <span className="text-neutral-500">—</span>
                      ) : (
                        <ul className="list-disc pl-5 space-y-0.5">
                          {opts.map((o, i) => (
                            <li key={i}>
                              {o.label} × {o.qty}{" "}
                              <span className="text-neutral-500">
                                ({(o.pu / 100).toFixed(2)} €)
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-3 w-[160px]">
                      {renderEditable(insc.statut, insc.id, "statut")}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/details-coureur/${insc.id}`}
                        className="text-orange-700 hover:underline"
                      >
                        Détails
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <button
            className="rounded-xl border px-3 py-1 disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            ← Précédent
          </button>
          <div>
            Page {Math.min(page + 1, totalPages)} / {totalPages}
          </div>
          <button
            className="rounded-xl border px-3 py-1 disabled:opacity-50"
            onClick={() => setPage((p) => p + 1)}
            disabled={(page + 1) * ITEMS_PER_PAGE >= filtered.length}
          >
            Suivant →
          </button>
        </div>
      </div>
    </div>
  );
}
