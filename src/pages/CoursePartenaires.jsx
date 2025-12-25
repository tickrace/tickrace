// src/pages/CoursePartenaires.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";
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
  Loader2,
  Eye,
} from "lucide-react";

/* ------------------------------ UI ------------------------------ */
const Container = ({ children }) => (
  <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
);

const cleanUrl = (v) => {
  const s = (v || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
};

const isValidHttpUrl = (v) => {
  if (!v) return true;
  try {
    const u = new URL(cleanUrl(v));
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

const MAX_LOGO_MB = 2;

export default function CoursePartenaires() {
  // ✅ IMPORTANT : la route est /organisateur/partenaires/:courseId
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { session } = useUser();

  const [course, setCourse] = useState(null);
  const [items, setItems] = useState([]);
  const [logoUrls, setLogoUrls] = useState({}); // { logo_path: signedUrl }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    nom: "",
    site_url: "",
    type: "partenaire", // "partenaire" | "sponsor"
    is_active: true,
    logoFile: null,
    logoPreview: "",
  });

  const previewUrlRef = useRef("");

  const resetForm = () => {
    if (previewUrlRef.current) {
      try {
        URL.revokeObjectURL(previewUrlRef.current);
      } catch {}
      previewUrlRef.current = "";
    }
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

  const closeModal = () => {
    setOpen(false);
    resetForm();
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (p) => {
    resetForm();
    setEditing(p);
    setForm({
      nom: p.nom || "",
      site_url: p.site_url || "",
      type: p.type || "partenaire",
      is_active: p.is_active !== false,
      logoFile: null,
      logoPreview: p.logo_path ? logoUrls[p.logo_path] || "" : "",
    });
    setOpen(true);
  };

  const onPickLogo = (file) => {
    if (!file) return;

    // Validation simple
    const isImg = /^image\//i.test(file.type);
    const sizeMb = file.size / (1024 * 1024);

    if (!isImg) {
      alert("Le logo doit être une image (png/jpg/webp/svg).");
      return;
    }
    if (sizeMb > MAX_LOGO_MB) {
      alert(`Logo trop lourd. Taille max : ${MAX_LOGO_MB} MB.`);
      return;
    }

    // preview
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setForm((f) => ({ ...f, logoFile: file, logoPreview: url }));
  };

  const mustBeOwner = async (c, userId) => {
    if (!c || !userId) return false;
    return c.organisateur_id === userId;
  };

  const fetchAll = async () => {
    if (!courseId) return;
    setLoading(true);

    try {
      const sess = session?.user
        ? { data: { session } }
        : await supabase.auth.getSession();

      const user = sess.data?.session?.user;
      if (!user) {
        navigate("/login");
        return;
      }

      // Course
      const { data: c, error: ec } = await supabase
        .from("courses")
        .select("id, nom, en_ligne, organisateur_id")
        .eq("id", courseId)
        .single();

      if (ec || !c) {
        console.error("Erreur course:", ec);
        setCourse(null);
        setItems([]);
        return;
      }

      // ✅ Sécurité UX : si pas owner, on sort (évite 403 RLS incompréhensible)
      const owner = await mustBeOwner(c, user.id);
      if (!owner) {
        alert("Accès refusé : tu n'es pas l'organisateur de cette course.");
        navigate("/organisateur/mon-espace");
        return;
      }

      setCourse(c);

      // Partenaires
      const { data, error } = await supabase
        .from("course_partenaires")
        .select("id, course_id, nom, site_url, logo_path, type, ordre, is_active, created_at")
        .eq("course_id", courseId)
        .order("ordre", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Erreur partenaires:", error);
        setItems([]);
        return;
      }

      const list = data || [];
      setItems(list);

      // Préparer des signed URLs (marche même si bucket privé)
      const paths = Array.from(new Set(list.map((p) => p.logo_path).filter(Boolean)));
      if (paths.length) {
        const next = {};
        await Promise.all(
          paths.map(async (path) => {
            try {
              const { data: signed, error: es } = await supabase.storage
                .from("courses")
                .createSignedUrl(path, 60 * 60); // 1h

              if (!es && signed?.signedUrl) next[path] = signed.signedUrl;
              else {
                // fallback publicUrl (si bucket public)
                const pub = supabase.storage.from("courses").getPublicUrl(path).data?.publicUrl;
                if (pub) next[path] = pub;
              }
            } catch {}
          })
        );
        setLogoUrls(next);
      } else {
        setLogoUrls({});
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, session?.user?.id]);

  // Liste enrichie (logoUrl)
  const itemsWithUrl = useMemo(() => {
    return (items || []).map((p) => ({
      ...p,
      logoUrl: p.logo_path ? logoUrls[p.logo_path] || "" : "",
    }));
  }, [items, logoUrls]);

  const uploadLogoIfNeeded = async () => {
    if (!form.logoFile) return null;

    const ext = (form.logoFile.name.split(".").pop() || "png").toLowerCase();
    const safeExt = ["png", "jpg", "jpeg", "webp", "svg"].includes(ext) ? ext : "png";
    const fileName = `${Date.now()}_${Math.random().toString(16).slice(2)}.${safeExt}`;
    const path = `partners/${courseId}/${fileName}`;

    const { error } = await supabase.storage.from("courses").upload(path, form.logoFile, {
      cacheControl: "3600",
      upsert: false,
      contentType: form.logoFile.type || undefined,
    });

    if (error) throw error;
    return path;
  };

  const deleteLogoIfExists = async (path) => {
    if (!path) return;
    try {
      await supabase.storage.from("courses").remove([path]);
    } catch {}
  };

  const save = async () => {
    const nom = (form.nom || "").trim();
    if (!nom) return alert("Le nom est obligatoire.");
    if (!isValidHttpUrl(form.site_url)) return alert("Le lien doit être une URL valide (http/https).");

    setSaving(true);
    try {
      // Upload logo si nécessaire
      const newLogoPath = await uploadLogoIfNeeded();

      const payload = {
        course_id: courseId,
        nom,
        site_url: form.site_url ? cleanUrl(form.site_url) : null,
        type: form.type,
        is_active: !!form.is_active,
      };

      // On ne met logo_path que si on a uploadé un nouveau logo
      if (newLogoPath) payload.logo_path = newLogoPath;

      if (!editing) {
        const nextOrdre = items.length ? Math.max(...items.map((x) => Number(x.ordre || 0))) + 1 : 0;
        payload.ordre = nextOrdre;

        const { error } = await supabase.from("course_partenaires").insert(payload);
        if (error) throw error;
      } else {
        // Si on remplace le logo, on supprime l’ancien logo (best-effort)
        const oldLogo = editing.logo_path;

        const { error } = await supabase
          .from("course_partenaires")
          .update(payload)
          .eq("id", editing.id);

        if (error) throw error;

        if (newLogoPath && oldLogo && oldLogo !== newLogoPath) {
          await deleteLogoIfExists(oldLogo);
        }
      }

      closeModal();
      await fetchAll();
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l’enregistrement (logo ou base). Vérifie tes policies Storage/RLS.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Supprimer "${p.nom}" ?`)) return;

    try {
      const { error } = await supabase.from("course_partenaires").delete().eq("id", p.id);
      if (error) throw error;

      // best-effort suppression storage
      if (p.logo_path) await deleteLogoIfExists(p.logo_path);

      await fetchAll();
    } catch (e) {
      console.error(e);
      alert("Suppression impossible (RLS ?).");
    }
  };

  const swapOrder = async (a, b) => {
    if (!a || !b) return;
    setReordering(true);
    try {
      const ao = Number(a.ordre || 0);
      const bo = Number(b.ordre || 0);

      const [r1, r2] = await Promise.all([
        supabase.from("course_partenaires").update({ ordre: bo }).eq("id", a.id),
        supabase.from("course_partenaires").update({ ordre: ao }).eq("id", b.id),
      ]);

      if (r1.error || r2.error) throw r1.error || r2.error;

      await fetchAll();
    } catch (e) {
      console.error(e);
      alert("Impossible de réordonner.");
    } finally {
      setReordering(false);
    }
  };

  const moveUp = async (idx) => {
    if (idx <= 0 || reordering) return;
    await swapOrder(items[idx], items[idx - 1]);
  };

  const moveDown = async (idx) => {
    if (idx >= items.length - 1 || reordering) return;
    await swapOrder(items[idx], items[idx + 1]);
  };

  if (!courseId) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <Container>
          <div className="py-10 text-sm text-neutral-700">
            Course inconnue (paramètre manquant).
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Container>
        <div className="py-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-700 hover:text-neutral-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Retour
              </button>

              <h1 className="mt-3 text-2xl font-extrabold text-neutral-900">Partenaires & Sponsors</h1>
              <p className="mt-1 text-sm text-neutral-600">
                Course : <span className="font-bold">{course?.nom || courseId}</span>
              </p>

              {course?.id && (
                <button
                  onClick={() => navigate(`/courses/${course.id}`)}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-extrabold text-neutral-800 hover:bg-neutral-50"
                >
                  <Eye className="h-4 w-4" />
                  Voir la page publique
                </button>
              )}
            </div>

            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-2xl bg-orange-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-orange-700 transition"
              disabled={loading}
            >
              <Plus className="h-4 w-4" />
              Ajouter
            </button>
          </div>

          <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4">
            {loading ? (
              <div className="inline-flex items-center gap-2 text-sm text-neutral-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Chargement…
              </div>
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
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-white border border-neutral-200 flex items-center justify-center">
                          <ImageIcon className="h-5 w-5 text-neutral-400" />
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="truncate text-sm font-extrabold text-neutral-900">{p.nom}</div>

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
                            <span className="truncate max-w-[70vw] sm:max-w-[420px]">{p.site_url}</span>
                          </a>
                        ) : (
                          <div className="mt-1 text-xs text-neutral-500">Pas de lien</div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => moveUp(idx)}
                        disabled={idx <= 0 || reordering}
                        className={[
                          "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-extrabold",
                          idx <= 0 || reordering
                            ? "border-neutral-200 bg-white text-neutral-300 cursor-not-allowed"
                            : "border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50",
                        ].join(" ")}
                        title="Monter"
                      >
                        <MoveUp className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => moveDown(idx)}
                        disabled={idx >= items.length - 1 || reordering}
                        className={[
                          "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-extrabold",
                          idx >= items.length - 1 || reordering
                            ? "border-neutral-200 bg-white text-neutral-300 cursor-not-allowed"
                            : "border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50",
                        ].join(" ")}
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
              <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
              <div className="relative w-full max-w-xl rounded-3xl bg-white p-5 shadow-2xl border border-neutral-200">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-extrabold text-neutral-900">
                      {editing ? "Modifier" : "Ajouter"} un partenaire
                    </h2>
                    <p className="mt-1 text-sm text-neutral-600">Nom + logo + lien optionnel</p>
                  </div>
                  <button onClick={closeModal} className="rounded-xl border border-neutral-200 bg-white p-2 hover:bg-neutral-50">
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
                    <p className="mt-1 text-xs text-neutral-500">Tu peux coller sans https://, on le rajoute automatiquement.</p>
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
                        <div className="text-xs text-neutral-600">Aperçu du logo</div>
                      </div>
                    )}
                    <p className="mt-1 text-xs text-neutral-500">Taille max : {MAX_LOGO_MB} MB.</p>
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
                      onClick={closeModal}
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-extrabold text-neutral-800 hover:bg-neutral-50 disabled:opacity-60"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={save}
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-2xl bg-orange-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-orange-700 disabled:opacity-60"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Enregistrer
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 text-xs text-neutral-500">
            Astuce : décoche “Visible” pour préparer tes partenaires avant publication.
          </div>
        </div>
      </Container>
    </div>
  );
}
