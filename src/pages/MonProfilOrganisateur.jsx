// src/pages/MonProfilOrganisateur.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function MonProfilOrganisateur() {
  const [profil, setProfil] = useState({});
  const [message, setMessage] = useState("");

  const pays = ["France", "Belgique", "Suisse", "Espagne", "Italie", "Portugal", "Autre"];

  useEffect(() => {
    const fetchProfil = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) return;

      const { data, error } = await supabase
        .from("profils_utilisateurs")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (!error && data) {
        setProfil(data);
      }
    };

    fetchProfil();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfil((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) return;

    const { error } = await supabase
      .from("profils_utilisateurs")
      .upsert({ ...profil, user_id: user.id });

    setMessage(error ? "Erreur lors de la mise à jour." : "Profil mis à jour !");
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Mon profil organisateur</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-4">
          <input
            type="text"
            name="nom"
            placeholder="Nom"
            value={profil.nom || ""}
            onChange={handleChange}
            className="border p-2 w-1/2"
          />
          <input
            type="text"
            name="prenom"
            placeholder="Prénom"
            value={profil.prenom || ""}
            onChange={handleChange}
            className="border p-2 w-1/2"
          />
        </div>

        <input
          type="text"
          name="structure"
          placeholder="Structure / association / société"
          value={profil.structure || ""}
          onChange={handleChange}
          className="border p-2 w-full"
        />

        <input
          type="email"
          name="email"
          placeholder="Email"
          value={profil.email || ""}
          onChange={handleChange}
          className="border p-2 w-full"
        />

        <input
          type="text"
          name="telephone"
          placeholder="Téléphone"
          value={profil.telephone || ""}
          onChange={handleChange}
          className="border p-2 w-full"
        />

        <input
          type="text"
          name="adresse"
          placeholder="Adresse"
          value={profil.adresse || ""}
          onChange={handleChange}
          className="border p-2 w-full"
        />

        <div className="flex gap-4">
          <input
            type="text"
            name="code_postal"
            placeholder="Code postal"
            value={profil.code_postal || ""}
            onChange={handleChange}
            className="border p-2 w-1/2"
          />
          <input
            type="text"
            name="ville"
            placeholder="Ville"
            value={profil.ville || ""}
            onChange={handleChange}
            className="border p-2 w-1/2"
          />
        </div>

        <select
          name="pays"
          value={profil.pays || ""}
          onChange={handleChange}
          className="border p-2 w-full"
        >
          <option value="">-- Choisir un pays --</option>
          {pays.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <input
          type="text"
          name="site_web"
          placeholder="Site web (optionnel)"
          value={profil.site_web || ""}
          onChange={handleChange}
          className="border p-2 w-full"
        />

        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
          Sauvegarder
        </button>

        {message && <p className="text-sm text-green-700 mt-2">{message}</p>}
      </form>
    </div>
  );
}
