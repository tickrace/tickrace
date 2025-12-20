// src/pages/admin/AdminALaUne.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../../supabase";
import { useNavigate } from "react-router-dom";
import { Upload, Save, Eye } from "lucide-react";

const BUCKET = "courses"; // ✅ change si tu crées un bucket dédié (ex: "site")

function Input(props) {
  return (
    <input
      {...props}
      className={[
        "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none",
        "focus:ring-2 focus:ring-orange-300",
        props.className || "",
      ].join(" ")}
    />
  );
}

function Textarea(props) {
  return (
    <textarea
      {...props}
      rows={props.rows || 5}
      className={[
        "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none",
        "focus:ring-2 focus:ring-orange-300",
        props.className || "",
      ].join(" ")}
    />
  );
}

export default function AdminALaUne() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const [current, setCurrent] = useState(null);

  const [form, setForm] = useState({
    title: "",
    body: "",
    link_url: "",
    published_at: new Date().toISOString().slice(0, 10),
    imageFile: null,
    image_url: "",
    deactivateOthers: true,
    is_active: true,
  });

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess?.session?.user) {
        navigate("/login");
        return;
      }

      try {
        setLoading(true);
        const { data } = await supabase
          .from("home_a_la_une")
          .select("id, title, body, link_url, image_url, published_at, is_active")
          .order("published_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        setCurrent(data || null);

        if (data) {
          setForm((p) => ({
            ...p,
            title: data.title || "",
            body: data.body || "",
            link_url: data.link_url || "",
            published_at: data.published_at || new Date().toISOString().slice(0, 10),
            image_url: data.image_url || "",
            is_active: data.is_active !== false,
          }));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const onChange = (e) => {
    const { name, value, files, type, checked } = e.target;
    setForm((p) => ({
      ...p,
      [name]:
        type === "checkbox" ? checked : files ? files[0] : value,
    }));
  };

  const uploadImageIfNeeded = async () => {
    if (!form.imageFile) return form.image_url || null;

    const ext = (form.imageFile.name.split(".").pop() || "jpg").toLowerCase();
    const path = `home/alaune-${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(path, form.imageFile, { upsert: false });

    if (error) throw error;

    const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(data.path).data.publicUrl;
    return publicUrl;
  };

  const save = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      alert("Titre et texte sont obligatoires.");
      return;
    }

    try {
      setLoading(true);

      const image_url = await uploadImageIfNeeded();

      if (form.deactivateOthers) {
        await supabase.from("home_a_la_une").update({ is_active: false }).eq("is_active", true);
      }

      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        link_url: form.link_url?.trim() || null,
        published_at: form.published_at || new Date().toISOString().slice(0, 10),
        image_url: image_url || null,
        is_active: form.is_active !== false,
      };

      const { error } = await supabase.from("home_a_la_une").insert(payload);
      if (error) throw error;

      alert("✅ À LA UNE mise à jour !");
      navigate("/");
    } catch (e) {
      console.error(e);
      alert("Erreur : " + (e?.message || "inconnue"));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-neutral-50 p-8">Chargement…</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-2xl bg-white ring-1 ring-neutral-200 shadow-lg shadow-neutral-900/5">
          <div className="p-6 border-b border-neutral-200">
            <h1 className="text-2xl font-black">Admin — À LA UNE</h1>
            <p className="mt-1 text-sm text-neutral-600">
              Mets à jour le bloc “À LA UNE” de la page d’accueil sans modifier Home.jsx.
            </p>
          </div>

          <div className="p-6 grid gap-5">
            {current && (
              <div className="rounded-2xl bg-neutral-50 ring-1 ring-neutral-200 p-4">
                <div className="text-xs font-semibold text-neutral-500">Dernière Une</div>
                <div className="mt-1 font-bold">{current.title}</div>
                <div className="text-xs text-neutral-500">{current.published_at}</div>
                {current.image_url && (
                  <img
                    src={current.image_url}
                    alt="A la une"
                    className="mt-3 h-40 w-full object-cover rounded-xl ring-1 ring-neutral-200"
                  />
                )}
              </div>
            )}

            <div className="grid gap-2">
              <label className="text-xs font-semibold text-neutral-600">Date</label>
              <Input type="date" name="published_at" value={form.published_at} onChange={onChange} />
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-semibold text-neutral-600">Titre</label>
              <Input name="title" value={form.title} onChange={onChange} placeholder="Ex. Nouvelle actu partenaire / update produit…" />
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-semibold text-neutral-600">Texte</label>
              <Textarea name="body" value={form.body} onChange={onChange} placeholder="Quelques lignes (2–6 lignes) max pour rester punchy." />
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-semibold text-neutral-600">Lien (optionnel)</label>
              <Input name="link_url" value={form.link_url} onChange={onChange} placeholder="https://… ou /courses" />
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-semibold text-neutral-600">Photo</label>
              <input
                type="file"
                name="imageFile"
                accept="image/*"
                onChange={onChange}
                className="block w-full text-sm text-neutral-700 file:mr-3 file:rounded-xl file:border file:border-neutral-200 file:bg-white file:px-3 file:py-2 hover:file:bg-neutral-50"
              />
              <p className="text-xs text-neutral-500">
                Stockage dans le bucket “{BUCKET}” (chemin home/…).
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" name="deactivateOthers" checked={form.deactivateOthers} onChange={onChange} />
                Désactiver les anciennes “Une”
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" name="is_active" checked={form.is_active} onChange={onChange} />
                Actif
              </label>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={save}
                className="inline-flex items-center gap-2 rounded-2xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white hover:brightness-110"
              >
                <Save className="h-4 w-4" /> Publier la Une
              </button>

              <button
                type="button"
                onClick={() => navigate("/")}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-neutral-900 ring-1 ring-neutral-200 hover:bg-neutral-50"
              >
                <Eye className="h-4 w-4" /> Voir la home
              </button>
            </div>

            <div className="text-[11px] text-neutral-500">
              Note : si tu veux une sécurité admin stricte, on peut ajouter RLS + une table admins ou passer par Edge Function.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
