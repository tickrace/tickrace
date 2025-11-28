// src/pages/admin/AdminCategories.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../../supabase";
import { Plus, Save, Trash2 } from "lucide-react";

function parseIntOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

export default function AdminCategories() {
  const [federations, setFederations] = useState([]);
  const [selectedFedCode, setSelectedFedCode] = useState("FFA");
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const emptyForm = {
    id: null,
    code: "",
    label: "",
    sex: "ALL",
    age_min: "",
    age_max: "",
    birthyear_min: "",
    birthyear_max: "",
    season_start_month: "",
    is_master: false,
    master_level: "",
    sort_order: "",
    is_active: true,
  };

  const [form, setForm] = useState(emptyForm);

  // Chargement des fédérations
  useEffect(() => {
    const fetchFeds = async () => {
      const { data, error } = await supabase
        .from("federations")
        .select("*")
        .order("code", { ascending: true });

      if (error) {
        console.error(error);
        setError(error.message);
      } else {
        setFederations(data || []);
        if (!selectedFedCode && data && data.length > 0) {
          setSelectedFedCode(data[0].code);
        }
      }
    };
    fetchFeds();
  }, []);

  // Chargement des catégories pour la fédé sélectionnée
  useEffect(() => {
    if (!selectedFedCode) return;

    const fetchCategories = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("federation_categories")
        .select("*")
        .eq("federation_code", selectedFedCode)
        .order("sort_order", { ascending: true })
        .order("label", { ascending: true });

      if (error) {
        console.error(error);
        setError(error.message);
        setCategories([]);
      } else {
        setCategories(data || []);
      }
      setLoading(false);
    };

    fetchCategories();
  }, [selectedFedCode]);

  const handleEdit = (cat) => {
    setForm({
      id: cat.id,
      code: cat.code || "",
      label: cat.label || "",
      sex: cat.sex || "ALL",
      age_min: cat.age_min ?? "",
      age_max: cat.age_max ?? "",
      birthyear_min: cat.birthyear_min ?? "",
      birthyear_max: cat.birthyear_max ?? "",
      season_start_month: cat.season_start_month ?? "",
      is_master: cat.is_master ?? false,
      master_level: cat.master_level ?? "",
      sort_order: cat.sort_order ?? "",
      is_active: cat.is_active ?? true,
    });
  };

  const handleNew = () => {
    setForm(emptyForm);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedFedCode) return;

    setSaving(true);
    setError(null);

    const payload = {
      federation_code: selectedFedCode,
      code: form.code.trim(),
      label: form.label.trim(),
      sex: form.sex,
      age_min: parseIntOrNull(form.age_min),
      age_max: parseIntOrNull(form.age_max),
      birthyear_min: parseIntOrNull(form.birthyear_min),
      birthyear_max: parseIntOrNull(form.birthyear_max),
      season_start_month: parseIntOrNull(form.season_start_month),
      is_master: !!form.is_master,
      master_level: form.master_level.trim() || null,
      sort_order: parseIntOrNull(form.sort_order),
      is_active: !!form.is_active,
    };

    try {
      let error;
      if (form.id) {
        const { error: err } = await supabase
          .from("federation_categories")
          .update(payload)
          .eq("id", form.id);
        error = err;
      } else {
        const { error: err } = await supabase
          .from("federation_categories")
          .insert(payload);
        error = err;
      }

      if (error) {
        console.error(error);
        setError(error.message);
      } else {
        const { data, error: err2 } = await supabase
          .from("federation_categories")
          .select("*")
          .eq("federation_code", selectedFedCode)
          .order("sort_order", { ascending: true })
          .order("label", { ascending: true });

        if (err2) {
          console.error(err2);
          setError(err2.message);
        } else {
          setCategories(data || []);
          setForm(emptyForm);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat) => {
    if (!window.confirm(`Supprimer la catégorie "${cat.label}" ?`)) return;
    const { error } = await supabase
      .from("federation_categories")
      .delete()
      .eq("id", cat.id);

    if (error) {
      console.error(error);
      setError(error.message);
    } else {
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      if (form.id === cat.id) {
        setForm(emptyForm);
      }
    }
  };

  const currentFed = federations.find((f) => f.code === selectedFedCode);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Gestion des catégories d&apos;âge
          </h1>
          <p className="text-sm text-neutral-500">
            Fédérations &rarr; Catégories &rarr; liaison automatique avec les inscriptions.
          </p>
        </div>
      </div>

      {/* Choix de la fédération */}
      <div className="mb-6 flex items-center gap-4">
        <div>
          <label className="block text-xs font-medium text-neutral-500 mb-1">
            Fédération
          </label>
          <select
            className="border rounded-md px-3 py-2 text-sm bg-white"
            value={selectedFedCode || ""}
            onChange={(e) => setSelectedFedCode(e.target.value)}
          >
            {federations.map((fed) => (
              <option key={fed.code} value={fed.code}>
                {fed.code} - {fed.name}
              </option>
            ))}
          </select>
        </div>

        {currentFed && (
          <div className="text-xs text-neutral-500">
            Saison : débute en{" "}
            <span className="font-medium">
              {currentFed.season_start_month || 1}/
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-2">
        {/* Liste des catégories */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Catégories ({categories.length})
            </h2>
            <button
              onClick={handleNew}
              className="inline-flex items-center gap-2 rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50"
            >
              <Plus className="h-4 w-4" />
              Nouvelle
            </button>
          </div>

          <div className="border border-neutral-200 rounded-xl overflow-hidden">
            <table className="min-w-full text-xs">
              <thead className="bg-neutral-50 text-neutral-500">
                <tr>
                  <th className="px-3 py-2 text-left">Ordre</th>
                  <th className="px-3 py-2 text-left">Code</th>
                  <th className="px-3 py-2 text-left">Libellé</th>
                  <th className="px-3 py-2 text-left">Master</th>
                  <th className="px-3 py-2 text-center">Actif</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-neutral-400">
                      Chargement...
                    </td>
                  </tr>
                )}
                {!loading && categories.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-neutral-400">
                      Aucune catégorie pour cette fédération.
                    </td>
                  </tr>
                )}
                {!loading &&
                  categories.map((cat) => (
                    <tr
                      key={cat.id}
                      className="border-t border-neutral-100 hover:bg-neutral-50 cursor-pointer"
                      onClick={() => handleEdit(cat)}
                    >
                      <td className="px-3 py-2 text-neutral-500">
                        {cat.sort_order ?? ""}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {cat.code}
                      </td>
                      <td className="px-3 py-2">
                        {cat.label}
                        {cat.master_level && (
                          <span className="ml-1 text-[10px] rounded-full bg-neutral-100 px-1.5 py-0.5">
                            {cat.master_level}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-neutral-500">
                        {cat.is_master ? "Oui" : "Non"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-flex h-2.5 w-2.5 rounded-full ${
                            cat.is_active ? "bg-emerald-500" : "bg-neutral-300"
                          }`}
                        />
                      </td>
                      <td
                        className="px-3 py-2 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => handleDelete(cat)}
                          className="inline-flex items-center justify-center rounded-md border border-neutral-200 p-1 hover:bg-red-50 hover:border-red-200"
                          title="Supprimer"
                        >
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Formulaire d’édition / création */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-3">
            {form.id ? "Modifier la catégorie" : "Nouvelle catégorie"}
          </h2>

          <form
            onSubmit={handleSave}
            className="space-y-4 border border-neutral-200 rounded-xl p-4 bg-white"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">
                  Code
                </label>
                <input
                  name="code"
                  value={form.code}
                  onChange={handleChange}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="SE, JU, M1..."
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">
                  Ordre d&apos;affichage
                </label>
                <input
                  name="sort_order"
                  value={form.sort_order}
                  onChange={handleChange}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  type="number"
                  placeholder="ex: 10"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">
                Libellé
              </label>
              <input
                name="label"
                value={form.label}
                onChange={handleChange}
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Seniors, Cadets U18, Masters M1..."
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">
                  Sexe
                </label>
                <select
                  name="sex"
                  value={form.sex}
                  onChange={handleChange}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="ALL">Mixte / Tous</option>
                  <option value="M">Hommes</option>
                  <option value="F">Femmes</option>
                  <option value="X">Autre</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">
                  Mois début saison (option)
                </label>
                <input
                  name="season_start_month"
                  value={form.season_start_month}
                  onChange={handleChange}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  type="number"
                  min="1"
                  max="12"
                  placeholder="Vide = fédé"
                />
              </div>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-neutral-600">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={form.is_active}
                    onChange={handleChange}
                    className="rounded border-neutral-300"
                  />
                  Actif
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">
                  Âge min (option)
                </label>
                <input
                  name="age_min"
                  value={form.age_min}
                  onChange={handleChange}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  type="number"
                  placeholder="ex: 18"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">
                  Âge max (option)
                </label>
                <input
                  name="age_max"
                  value={form.age_max}
                  onChange={handleChange}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  type="number"
                  placeholder="ex: 34"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">
                  Année naissance min (option)
                </label>
                <input
                  name="birthyear_min"
                  value={form.birthyear_min}
                  onChange={handleChange}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  type="number"
                  placeholder="ex: 1992"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">
                  Année naissance max (option)
                </label>
                <input
                  name="birthyear_max"
                  value={form.birthyear_max}
                  onChange={handleChange}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  type="number"
                  placeholder="ex: 2003"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="checkbox"
                  name="is_master"
                  checked={form.is_master}
                  onChange={handleChange}
                  className="rounded border-neutral-300"
                />
                <span className="text-xs font-medium text-neutral-600">
                  Catégorie Masters
                </span>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">
                  Niveau Master (M0, M1...)
                </label>
                <input
                  name="master_level"
                  value={form.master_level}
                  onChange={handleChange}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="M0, M1, M2..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleNew}
                className="text-xs text-neutral-500 hover:text-neutral-800"
              >
                Réinitialiser
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md bg-neutral-900 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
