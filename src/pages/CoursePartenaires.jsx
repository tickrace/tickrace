import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "../supabase";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Pencil,
  MoveUp,
  MoveDown,
  Link as LinkIcon,
  Image as ImageIcon,
  Save,
  X,
} from "lucide-react";

const Container = ({ children }) => (
  <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
);

const cleanUrl = (v) => {
  const s = (v || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
};

export default function CoursePartenaires() {
  const { id: courseId } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    nom: "",
    site_url: "",
    type: "partenaire",
    is_active: true,
    logoFile: null,
    logoPreview: "",
  });

  const itemsWithUrl = useMemo(() => {
    return (items || []).map((p) => {
      const logoUrl =
        p.logo_path
          ? supabase.storage.from("courses").getPublicUrl(p.logo_path).data.publicUrl
          : null;
      return { ...p, logoUrl };
    });
  }, [items]);

  const fetchAll = async () => {
    setLoading(true);

    const session = await supabase.auth.getSession();
    const user = session.data?.session?.user;
    if (!user) {
      navigate("/login");
      return;
    }

    const { data: c, error: ec } = await supabase
      .from("courses")
      .select("id, nom, organisateur_id")
      .eq("id", courseId)
      .single();

    if (ec || !c) {
      console.error(ec);
      setCourse(null);
      setItems([]);
      setLoading(false);
      return;
    }

    setCourse(c);

    const { data, error } = await supabase
      .from("course_partenaires")
      .select("id, nom, site_url, logo_path, type, ordre, is_active, created_at")
      .eq("course_id", courseId)
      .order("ordre", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) console.error(error);
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!courseId) return;
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const resetForm = () => {
    setEditing(null);
    setForm({
      nom: "",
      site_url: "",
      type: "partenaire",
      is_active: true,
      logoFile: null,
      logoPreview: "",
    });
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      nom: p.nom || "",
      site_url: p.site_url || "",
      type: p.type || "partenaire",
      is_active: p.is_active !== false,
      logoFile: null,
      logoPreview: p.logo_path
        ? supabase.storage.from("courses").getPublicUrl(p.logo_path).data.publicUrl
        : "",
    });
    setOpen(true);
  };

  const onPickLogo = (file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setForm((f) => ({ ...f, logoFile: file, logoPreview: url }));
  };

  const uploadLogoIfNeeded = async () => {
    if (!form.logoFile) return null;

    const ext = (form.logoFile.name.split(".").pop() || "png").toLowerCase();
    const fileName = `${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;
    const path = `partners/${courseId}/${fileName}`;

    const { error } = await supabase.storage
      .from("courses")
      .upload(path, form.logoFile, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) throw error;
    return path;
  };

  const save = async () => {
    const nom = (form.nom || "").trim();
    if (!nom) return;

    try {
      const logo_path = await uploadLogoIfNeeded();
      const payload = {
        course_id: courseId,
        nom,
        site_url: form.site_url ? cleanUrl(form.site_url) : null,
        type: form.type,
        is_active: !!form.is_active,
        ...(logo_path ? { logo_path } : {}),
      };

      if (!editing) {
        const nextOrdre = items.length ? Math.max(...items.map((x) => x.ordre || 0)) + 1 : 0;
        payload.ordre = nextOrdre;

        const { error } = await supabase.from("course_partenaires").insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("course_partenaires")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      }

      setOpen(false);
      resetForm();
      await fetchAll();
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l’enregistrement (logo ou base). Vérifie tes policies Storage/RLS.");
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Supprimer "${p.nom}" ?`)) return;

    const { error } = await supabase.from("course_partenaires").delete().eq("id", p.id);
    if (error) {
      console.error(error);
      alert("Suppression impossible.");
      return;
    }
    await fetchAll();
  };

  const swapOrder = async (a, b) => {
    // swap ordre entre a et b
    const { error: e1 } = await supabase
      .from("course_partenaires")
      .update({ ordre: b.ordre })
      .eq("id", a.id);

    const { error: e2 } = await supabase
      .from("course_partenaires")
      .update({ ordre: a.ordre })
      .eq("id", b.id);

    if (e1 || e2) {
      console.error(e1 || e2);
      alert("Impossible de réordonner.");
      return;
    }
    await fetchAll();
  };

  const moveUp = async (idx) => {
    if (idx <= 0) return;
    await swapOrder(items[idx], items[idx - 1]);
  };

  const moveDown = async (idx) => {
    if (idx >= items.length - 1) return;
    await swapOrder(items[idx], items[idx + 1]);
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <Container>
        <div className="py-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-700 hover:text-neutral-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Retour
              </button>

              <h1 className="mt-3 text-2xl font-extrabold text-neutral-900">
                Partenaires & Sponsors
              </h1>
              <p className="mt-1 text-sm text-neutral-600">
                Course : <span className="font-bold">{course?.nom || courseId}</span>
              </p>
            </div>

            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-2xl bg-orange-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-orange-700 transition"
            >
              <Plus className="h-4 w-4" />
              Ajouter
            </button>
          </div>

          <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4">
            {loading ? (
              <div className="text-sm text-neutral-600">Chargement…</div>
            ) : itemsWithUrl.length === 0 ? (
              <div className="text-sm text-neutral-600">
                Aucun partenaire pour l’instant. Clique sur “Ajouter”.
              </div>
            ) : (
              <div className="grid gap-3">
                {itemsWithUrl.map((p, idx) => (
                  <div
                    key={p.id}
                    className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {p.logoUrl ? (
                        <img
                          src={p.logoUrl}
                          alt={p.nom}
                          className="h-12 w-12 rounded-xl object-contain bg-white border border-neutral-200"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-white border border-neutral-200 flex items-center justify-center">
                          <ImageIcon className="h-5 w-5 text-neutral-400" />
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="truncate text-sm font-extrabold text-neutral-900">
                            {p.nom}
                          </div>
                          <span className="rounded-full bg-white border border-neutral-200 px-2 py-0.5 text-[11px] font-bold text-neutral-700">
                            {p.type === "sponsor" ? "Sponsor" : "Partenaire"}
                          </span>
                          {!p.is_active && (
                            <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[11px] font-bold text-neutral-700">
                              Masqué
                            </span>
                          )}
                        </div>

                        {p.site_url ? (
                          <a
                            href={p.site_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900"
                          >
                            <LinkIcon className="h-3.5 w-3.5" />
                            {p.site_url}
                          </a>
                        ) : (
                          <div className="mt-1 text-xs text-neutral-500">Pas de lien</div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => moveUp(idx)}
                        className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-extrabold text-neutral-800 hover:bg-neutral-50"
                        title="Monter"
                      >
                        <MoveUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => moveDown(idx)}
                        className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-extrabold text-neutral-800 hover:bg-neutral-50"
                        title="Descendre"
                      >
                        <MoveDown className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => openEdit(p)}
                        className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-extrabold text-neutral-800 hover:bg-neutral-50"
                      >
                        <Pencil className="h-4 w-4" />
                        Modifier
                      </button>

                      <button
                        onClick={() => remove(p)}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-extrabold text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Supprimer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modal */}
          {open && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-black/40"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
              />
              <div className="relative w-full max-w-xl rounded-3xl bg-white p-5 shadow-2xl border border-neutral-200">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-extrabold text-neutral-900">
                      {editing ? "Modifier" : "Ajouter"} un partenaire
                    </h2>
                    <p className="mt-1 text-sm text-neutral-600">
                      Nom + logo + lien optionnel
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setOpen(false);
                      resetForm();
                    }}
                    className="rounded-xl border border-neutral-200 bg-white p-2 hover:bg-neutral-50"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-4 grid gap-3">
                  <label className="block">
                    <span className="text-xs font-bold text-neutral-600">Nom *</span>
                    <input
                      value={form.nom}
                      onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                      className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                      placeholder="Ex : Esprit Trail"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold text-neutral-600">Type</span>
                    <select
                      value={form.type}
                      onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                      className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                    >
                      <option value="partenaire">Partenaire</option>
                      <option value="sponsor">Sponsor</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold text-neutral-600">Lien (optionnel)</span>
                    <input
                      value={form.site_url}
                      onChange={(e) => setForm((f) => ({ ...f, site_url: e.target.value }))}
                      className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                      placeholder="https://..."
                    />
                    <p className="mt-1 text-xs text-neutral-500">
                      Tu peux coller sans https://, on le rajoute automatiquement.
                    </p>
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold text-neutral-600">Logo (optionnel)</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => onPickLogo(e.target.files?.[0])}
                      className="mt-1 block w-full text-sm"
                    />
                    {form.logoPreview && (
                      <div className="mt-3 flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                        <img
                          src={form.logoPreview}
                          alt="Preview logo"
                          className="h-16 w-16 rounded-2xl object-contain bg-white border border-neutral-200"
                        />
                        <div className="text-xs text-neutral-600">
                          Aperçu du logo
                        </div>
                      </div>
                    )}
                  </label>

                  <label className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                    />
                    Visible sur la page publique
                  </label>

                  <div className="mt-2 flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        setOpen(false);
                        resetForm();
                      }}
                      className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-extrabold text-neutral-800 hover:bg-neutral-50"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={save}
                      className="inline-flex items-center gap-2 rounded-2xl bg-orange-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-orange-700"
                    >
                      <Save className="h-4 w-4" />
                      Enregistrer
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 text-xs text-neutral-500">
            Astuce : tu peux mettre “Masqué” (checkbox) pour préparer tes partenaires avant publication.
          </div>
        </div>
      </Container>
    </div>
  );
}
