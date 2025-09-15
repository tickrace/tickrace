// src/pages/UpsertCourse.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "../supabase";

/* ---------- UI helpers (reprennent ton style) ---------- */
function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-neutral-600">
        {label}
        {required && " *"}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
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
      rows={props.rows || 4}
      {...props}
      className={[
        "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none",
        "focus:ring-2 focus:ring-orange-300",
        props.className || "",
      ].join(" ")}
    />
  );
}

/* ---------- Étapes relais ---------- */
function EtapesRelaisEditor({ etapes, setEtapes }) {
  const add = () =>
    setEtapes([
      ...etapes,
      {
        _local_id: uuidv4(),
        ordre: etapes.length + 1,
        titre: `Relais ${etapes.length + 1}`,
        sport: "",
        distance_km: "",
        denivele_dplus: "",
        denivele_dmoins: "",
        gpx_url: "", // on laissera URL libre ici; si besoin d'upload par étape, on le fera plus tard
        description: "",
        cut_off_minutes: "",
      },
    ]);
  const update = (_local_id, patch) =>
    setEtapes(etapes.map((e) => (e._local_id === _local_id ? { ...e, ...patch } : e)));
  const remove = (_local_id) => {
    const next = etapes.filter((e) => e._local_id !== _local_id);
    setEtapes(next.map((e, i) => ({ ...e, ordre: i + 1, titre: `Relais ${i + 1}` })));
  };
  const move = (i, dir) => {
    const next = [...etapes];
    const swap = dir === "up" ? i - 1 : i + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[i], next[swap]] = [next[swap], next[i]];
    setEtapes(next.map((e, idx) => ({ ...e, ordre: idx + 1, titre: `Relais ${idx + 1}` })));
  };

  return (
    <div className="grid gap-4">
      {etapes.map((e, i) => (
        <div key={e._local_id} className="rounded-xl ring-1 ring-neutral-200 bg-neutral-50 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
            <Field label="Titre">
              <Input value={e.titre} onChange={(ev) => update(e._local_id, { titre: ev.target.value })} />
            </Field>
            <Field label="Sport">
              <select
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                value={e.sport}
                onChange={(ev) => update(e._local_id, { sport: ev.target.value })}
              >
                <option value="">—</option>
                <option>Course à pied</option>
                <option>Trail</option>
                <option>VTT</option>
                <option>Natation</option>
                <option>Canoë</option>
                <option>Autre</option>
              </select>
            </Field>
            <Field label="Distance (km)">
              <Input
                type="number"
                step="0.1"
                value={e.distance_km}
                onChange={(ev) => update(e._local_id, { distance_km: ev.target.value })}
              />
            </Field>
            <Field label="D+ (m)">
              <Input
                type="number"
                value={e.denivele_dplus}
                onChange={(ev) => update(e._local_id, { denivele_dplus: ev.target.value })}
              />
            </Field>
            <Field label="D- (m)">
              <Input
                type="number"
                value={e.denivele_dmoins}
                onChange={(ev) => update(e._local_id, { denivele_dmoins: ev.target.value })}
              />
            </Field>
            <Field label="Cut-off (min)">
              <Input
                type="number"
                value={e.cut_off_minutes}
                onChange={(ev) => update(e._local_id, { cut_off_minutes: ev.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 mt-3">
            <Field label="URL GPX (optionnel)">
              <Input
                value={e.gpx_url || ""}
                onChange={(ev) => update(e._local_id, { gpx_url: ev.target.value })}
                placeholder="https://…"
              />
            </Field>
            <Field label="Description (optionnel)">
              <Textarea
                value={e.description || ""}
                onChange={(ev) => update(e._local_id, { description: ev.target.value })}
              />
            </Field>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => move(i, "up")}
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm hover:bg-neutral-50"
            >
              ↑ Monter
            </button>
            <button
              type="button"
              onClick={() => move(i, "down")}
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm hover:bg-neutral-50"
            >
              ↓ Descendre
            </button>
            <button
              type="button"
              onClick={() => remove(e._local_id)}
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100"
            >
              Supprimer l’étape
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
      >
        + Ajouter une étape
      </button>
    </div>
  );
}

/* ---------- Page Upsert ---------- */

export default function UpsertCourse() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  // Course (design et champs d’origine)
  const [course, setCourse] = useState({
    nom: "",
    lieu: "",
    departement: "",
    code_postal: "",
    presentation: "",
    imageFile: null, // upload image course → bucket `courses`
    image_url: "", // utile en édition
  });

  // Format template (reprend ton historique + nos ajouts)
  const formatTemplate = () => ({
    id: uuidv4(), // clé locale
    nom: "",
    imageFile: null, // upload image format → bucket `formats`
    date: "",
    heure_depart: "",
    presentation_parcours: "",
    // GPX
    gpx_urlFile: null, // upload (bucket `formats`)
    gpx_url: null, // URL enregistrée (édition)
    // Règlement
    fichier_reglementFile: null, // upload (bucket `reglements`)
    reglement_pdf_url: null, // URL enregistrée (édition)

    // Historiques
    type_epreuve: "trail", // "trail" | "rando" | "route"
    distance_km: "",
    denivele_dplus: "",
    denivele_dmoins: "",
    adresse_depart: "",
    adresse_arrivee: "",
    prix: "",
    stock_repas: "",
    prix_repas: "",
    prix_total_inscription: "", // calculé à l’insert/update côté front
    ravitaillements: "",
    remise_dossards: "",
    dotation: "",
    nb_max_coureurs: "",
    age_minimum: "",
    hebergements: "",

    // Nouveaux champs
    type_format: "individuel", // 'individuel' | 'groupe' | 'relais'
    sport_global: "",
    team_size: "",
    nb_coureurs_min: "",
    nb_coureurs_max: "",
    prix_equipe: "",
    inscription_ouverture: "",
    inscription_fermeture: "",
    fuseau_horaire: "Europe/Paris",
    close_on_full: true,
    waitlist_enabled: false,
    quota_attente: 0,

    // Étapes (si relais)
    etapes: [],
  });

  const [formats, setFormats] = useState([formatTemplate()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* ---------- Helpers handlers ---------- */
  const handleCourseChange = (e) => {
    const { name, value, files } = e.target;
    setCourse((prev) => ({
      ...prev,
      [files ? name + "File" : name]: files ? files[0] : value,
    }));
  };
  const handleFormatChange = (index, e) => {
    const { name, value, files } = e.target;
    const updated = [...formats];
    updated[index][files ? name + "File" : name] = files ? files[0] : value;
    setFormats(updated);
  };
  const addFormat = () => setFormats((prev) => [...prev, formatTemplate()]);
  const removeFormat = (idLocal) => setFormats((prev) => prev.filter((f) => f.id !== idLocal));
  const updateFormat = (idLocal, patch) =>
    setFormats((prev) => prev.map((f) => (f.id === idLocal ? { ...f, ...patch } : f)));

  /* ---------- Load (édition) ---------- */
  useEffect(() => {
    let aborted = false;
    (async () => {
      if (!isEdit) {
        setLoading(false);
        return;
      }
      setLoading(true);
      // Course
      const { data: c, error: e1 } = await supabase.from("courses").select("*").eq("id", id).single();
      if (e1) {
        console.error(e1);
        setLoading(false);
        return;
      }
      // Formats
      const { data: fs, error: e2 } = await supabase
        .from("formats")
        .select("*")
        .eq("course_id", id)
        .order("created_at", { ascending: true });

      // Étapes
      let etapesByFormat = {};
      if (!e2 && fs?.length) {
        const ids = fs.map((f) => f.id);
        const { data: etapes, error: e3 } = await supabase
          .from("formats_etapes")
          .select("*")
          .in("format_id", ids)
          .order("ordre", { ascending: true });
        if (!e3 && etapes) {
          etapesByFormat = etapes.reduce((acc, cur) => {
            acc[cur.format_id] = acc[cur.format_id] || [];
            acc[cur.format_id].push({ ...cur, _local_id: uuidv4() });
            return acc;
          }, {});
        }
      }

      if (!aborted) {
        setCourse({
          nom: c.nom || "",
          lieu: c.lieu || "",
          departement: c.departement || "",
          code_postal: c.code_postal || "",
          presentation: c.presentation || "",
          imageFile: null,
          image_url: c.image_url || "",
        });

        setFormats(
          (fs || []).map((f) => ({
            ...formatTemplate(),
            id: f.id, // on utilise l’ID réel en édition (pour update)
            nom: f.nom || "",
            imageFile: null,
            image_url: f.image_url || null,
            date: f.date || "",
            heure_depart: f.heure_depart || "",
            presentation_parcours: f.presentation_parcours || "",
            gpx_urlFile: null,
            gpx_url: f.gpx_url || null,
            fichier_reglementFile: null,
            reglement_pdf_url: f.reglement_pdf_url || null,

            type_epreuve: ["trail", "rando", "route"].includes(f.type_epreuve || "")
              ? f.type_epreuve
              : "trail",
            distance_km: f.distance_km ?? "",
            denivele_dplus: f.denivele_dplus ?? "",
            denivele_dmoins: f.denivele_dmoins ?? "",
            adresse_depart: f.adresse_depart || "",
            adresse_arrivee: f.adresse_arrivee || "",
            prix: f.prix ?? "",
            stock_repas: f.stock_repas ?? "",
            prix_repas: f.prix_repas ?? "",
            prix_total_inscription: f.prix_total_inscription ?? "",
            ravitaillements: f.ravitaillements || "",
            remise_dossards: f.remise_dossards || "",
            dotation: f.dotation || "",
            nb_max_coureurs: f.nb_max_coureurs ?? "",
            age_minimum: f.age_minimum ?? "",
            hebergements: f.hebergements || "",

            type_format: f.type_format || "individuel",
            sport_global: f.sport_global || "",
            team_size: f.team_size ?? "",
            nb_coureurs_min: f.nb_coureurs_min ?? "",
            nb_coureurs_max: f.nb_coureurs_max ?? "",
            prix_equipe: f.prix_equipe ?? "",
            inscription_ouverture: f.inscription_ouverture
              ? new Date(f.inscription_ouverture).toISOString().slice(0, 16)
              : "",
            inscription_fermeture: f.inscription_fermeture
              ? new Date(f.inscription_fermeture).toISOString().slice(0, 16)
              : "",
            fuseau_horaire: f.fuseau_horaire || "Europe/Paris",
            close_on_full: !!f.close_on_full,
            waitlist_enabled: !!f.waitlist_enabled,
            quota_attente: f.quota_attente ?? 0,

            etapes: etapesByFormat[f.id] || [],
          }))
        );
        setLoading(false);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [id, isEdit]);

  /* ---------- Validation ---------- */
  const validate = () => {
    if (!course.nom?.trim() || !course.lieu?.trim() || !course.code_postal?.trim()) {
      alert("Merci de renseigner le nom, le lieu et le code postal.");
      return false;
    }
    for (const f of formats) {
      if (!f.nom?.trim()) {
        alert("Chaque format doit avoir un nom.");
        return false;
      }
      if (f.type_epreuve && !["trail", "rando", "route"].includes(f.type_epreuve)) {
        alert(`Type d'épreuve invalide pour "${f.nom}". Utilise trail | rando | route.`);
        return false;
      }
      if (f.type_format === "relais" && (!f.etapes || f.etapes.length < 2)) {
        alert(`Le format "${f.nom}" est en relais : ajoute au moins 2 étapes.`);
        return false;
      }
      if (f.inscription_ouverture && f.inscription_fermeture) {
        if (new Date(f.inscription_ouverture) >= new Date(f.inscription_fermeture)) {
          alert(`Fenêtre d'inscriptions invalide pour "${f.nom}".`);
          return false;
        }
      }
    }
    return true;
  };

  /* ---------- Submit ---------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      // Session
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) {
        alert("Utilisateur non connecté.");
        setSaving(false);
        return;
      }

      // Géocodage rapide (comme avant) — on laisse identique
      async function getLatLngFromPostalCode(postal, ville) {
        try {
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(
              postal || ""
            )}&city=${encodeURIComponent(ville || "")}&country=France&format=json&limit=1`
          );
          const data = await resp.json();
          if (data?.length) {
            return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
          }
        } catch (err) {
          console.error("Erreur géocodage :", err);
        }
        return { lat: null, lng: null };
      }
      const { lat, lng } = await getLatLngFromPostalCode(course.code_postal, course.lieu);

      // Upload image course
      let imageCourseUrl = course.image_url || null;
      if (course.imageFile) {
        const { data, error } = await supabase.storage
          .from("courses")
          .upload(`course-${Date.now()}.jpg`, course.imageFile, { upsert: false });
        if (error) throw new Error("Upload image course : " + error.message);
        imageCourseUrl = supabase.storage.from("courses").getPublicUrl(data.path).data.publicUrl;
      }

      // Upsert course
      let courseId = id;
      if (!isEdit) {
        const { data: cIns, error: cErr } = await supabase
          .from("courses")
          .insert({
            nom: course.nom,
            lieu: course.lieu,
            departement: course.departement,
            code_postal: course.code_postal,
            lat,
            lng,
            presentation: course.presentation,
            image_url: imageCourseUrl,
            organisateur_id: userId,
          })
          .select("id")
          .single();
        if (cErr) throw cErr;
        courseId = cIns.id;
      } else {
        const { error: cUpErr } = await supabase
          .from("courses")
          .update({
            nom: course.nom,
            lieu: course.lieu,
            departement: course.departement,
            code_postal: course.code_postal,
            lat,
            lng,
            presentation: course.presentation,
            image_url: imageCourseUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("id", courseId);
        if (cUpErr) throw cUpErr;
      }

      // Traiter formats (create or update). On conserve les IDs gardés pour supprimer le reste.
      const keptIds = [];

      for (const f of formats) {
        // Uploads optionnels (image format, GPX, règlement)
        let imageFormatUrl = f.image_url || null;
        if (f.imageFile) {
          const { data, error } = await supabase.storage
            .from("formats")
            .upload(`format-${Date.now()}-${f.nom || "sans-nom"}.jpg`, f.imageFile, { upsert: false });
          if (!error) imageFormatUrl = supabase.storage.from("formats").getPublicUrl(data.path).data.publicUrl;
        }

        let gpxUrl = f.gpx_url || null;
        if (f.gpx_urlFile) {
          const { data, error } = await supabase.storage
            .from("formats")
            .upload(`gpx-${Date.now()}-${f.nom || "sans-nom"}.gpx`, f.gpx_urlFile, { upsert: false });
          if (!error) gpxUrl = supabase.storage.from("formats").getPublicUrl(data.path).data.publicUrl;
        }

        let reglementUrl = f.reglement_pdf_url || null;
        if (f.fichier_reglementFile) {
          const { data, error } = await supabase.storage
            .from("reglements")
            .upload(`reglement-${Date.now()}-${f.nom || "sans-nom"}.pdf`, f.fichier_reglementFile, {
              upsert: false,
            });
          if (!error)
            reglementUrl = supabase.storage.from("reglements").getPublicUrl(data.path).data.publicUrl;
        }

        const prix = f.prix ? parseFloat(f.prix) : 0;
        const prix_repas = f.prix_repas ? parseFloat(f.prix_repas) : 0;
        const prix_total_inscription =
          prix + (parseInt(f.stock_repas || "0", 10) > 0 ? prix_repas : 0);

        const payload = {
          course_id: courseId,
          nom: f.nom || "Format sans nom",
          image_url: imageFormatUrl,
          date: f.date || null,
          heure_depart: f.heure_depart || null,
          presentation_parcours: f.presentation_parcours || null,
          gpx_url: gpxUrl,
          type_epreuve: ["trail", "rando", "route"].includes(f.type_epreuve) ? f.type_epreuve : "trail",
          distance_km: f.distance_km ? parseFloat(f.distance_km) : null,
          denivele_dplus: f.denivele_dplus ? parseInt(f.denivele_dplus, 10) : null,
          denivele_dmoins: f.denivele_dmoins ? parseInt(f.denivele_dmoins, 10) : null,
          adresse_depart: f.adresse_depart || null,
          adresse_arrivee: f.adresse_arrivee || null,
          prix,
          stock_repas: f.stock_repas ? parseInt(f.stock_repas, 10) : 0,
          prix_repas,
          prix_total_inscription,
          ravitaillements: f.ravitaillements || null,
          remise_dossards: f.remise_dossards || null,
          dotation: f.dotation || null,
          reglement_pdf_url: reglementUrl,
          nb_max_coureurs: f.nb_max_coureurs ? parseInt(f.nb_max_coureurs, 10) : null,
          age_minimum: f.age_minimum ? parseInt(f.age_minimum, 10) : null,
          hebergements: f.hebergements || null,

          // Nouveaux champs
          type_format: f.type_format || "individuel",
          sport_global: f.sport_global || null,
          team_size:
            f.type_format === "relais"
              ? f.team_size
                ? Number(f.team_size)
                : f.etapes?.length || null
              : f.team_size
              ? Number(f.team_size)
              : null,
          nb_coureurs_min: f.nb_coureurs_min ? Number(f.nb_coureurs_min) : null,
          nb_coureurs_max: f.nb_coureurs_max ? Number(f.nb_coureurs_max) : null,
          prix_equipe: f.prix_equipe ? Number(f.prix_equipe) : null,
          inscription_ouverture: f.inscription_ouverture
            ? new Date(f.inscription_ouverture).toISOString()
            : null,
          inscription_fermeture: f.inscription_fermeture
            ? new Date(f.inscription_fermeture).toISOString()
            : null,
          fuseau_horaire: f.fuseau_horaire || "Europe/Paris",
          close_on_full: !!f.close_on_full,
          waitlist_enabled: !!f.waitlist_enabled,
          quota_attente: f.quota_attente ?? 0,
        };

        // Create or Update
        let formatId = null;
        const looksRealUUID = typeof f.id === "string" && f.id.length > 20; // suffit
        if (isEdit && looksRealUUID) {
          // update + check exist
          const { data: check } = await supabase
            .from("formats")
            .select("id")
            .eq("id", f.id)
            .maybeSingle();
          if (check?.id) {
            const { error: upErr } = await supabase.from("formats").update(payload).eq("id", f.id);
            if (upErr) throw upErr;
            formatId = f.id;
          } else {
            const { data: ins, error: insErr } = await supabase
              .from("formats")
              .insert(payload)
              .select("id")
              .single();
            if (insErr) throw insErr;
            formatId = ins.id;
          }
        } else {
          const { data: ins, error: insErr } = await supabase
            .from("formats")
            .insert(payload)
            .select("id")
            .single();
          if (insErr) throw insErr;
          formatId = ins.id;
        }

        // Étapes (si relais) : delete + insert
        if (payload.type_format === "relais") {
          await supabase.from("formats_etapes").delete().eq("format_id", formatId);
          if (Array.isArray(f.etapes)) {
            for (const e of f.etapes) {
              const { error: eErr } = await supabase.from("formats_etapes").insert({
                format_id: formatId,
                ordre: e.ordre || 1,
                titre: e.titre || null,
                sport: e.sport || null,
                distance_km:
                  e.distance_km !== "" && e.distance_km != null ? Number(e.distance_km) : null,
                denivele_dplus:
                  e.denivele_dplus !== "" && e.denivele_dplus != null
                    ? Number(e.denivele_dplus)
                    : null,
                denivele_dmoins:
                  e.denivele_dmoins !== "" && e.denivele_dmoins != null
                    ? Number(e.denivele_dmoins)
                    : null,
                gpx_url: e.gpx_url || null,
                description: e.description || null,
                cut_off_minutes:
                  e.cut_off_minutes !== "" && e.cut_off_minutes != null
                    ? Number(e.cut_off_minutes)
                    : null,
              });
              if (eErr) throw eErr;
            }
          }
        } else {
          // Nettoie si on a rebasculé depuis relais
          await supabase.from("formats_etapes").delete().eq("format_id", formatId);
        }

        keptIds.push(formatId);
      }

      // Supprimer les formats enlevés côté front (édition)
      if (isEdit) {
        const { data: existing } = await supabase.from("formats").select("id").eq("course_id", id);
        const toDelete = (existing || [])
          .map((r) => r.id)
          .filter((fid) => !keptIds.includes(fid));
        if (toDelete.length) {
          await supabase.from("formats").delete().in("id", toDelete);
        }
      }

      alert(isEdit ? "Épreuve mise à jour !" : "Épreuve créée !");
      navigate("/organisateur/mon-espace");
    } catch (err) {
      console.error(err);
      alert("Erreur à l’enregistrement : " + (err?.message || "inconnue"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900 p-8">
        Chargement…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Header */}
      <section className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-7xl px-4 py-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            {isEdit ? "Modifier l’épreuve" : "Créer une épreuve"}{" "}
            <span className="font-black">
              <span className="text-orange-600">Tick</span>Race
            </span>
          </h1>
          <p className="mt-2 text-neutral-600 text-base">
            Renseignez les informations générales, ajoutez vos formats et publiez quand tout est prêt.
          </p>
        </div>
      </section>

      {/* Form */}
      <div className="mx-auto max-w-5xl px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Carte — Infos course */}
          <div className="rounded-2xl bg-white shadow-lg shadow-neutral-900/5 ring-1 ring-neutral-200">
            <div className="p-5 border-b border-neutral-200">
              <h2 className="text-lg sm:text-xl font-bold">Informations générales</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Nom, lieu, présentation et visuel de l’épreuve.
              </p>
            </div>
            <div className="p-5 grid gap-4">
              <Field label="Nom de l'épreuve" required>
                <Input
                  name="nom"
                  value={course.nom}
                  placeholder="Ex. Trail des Aiguilles"
                  onChange={handleCourseChange}
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Lieu" required>
                  <Input
                    name="lieu"
                    value={course.lieu}
                    placeholder="Ex. Chamonix"
                    onChange={handleCourseChange}
                  />
                </Field>
                <Field label="Code postal" required>
                  <Input
                    name="code_postal"
                    value={course.code_postal}
                    placeholder="Ex. 74400"
                    onChange={handleCourseChange}
                  />
                </Field>
              </div>

              <Field label="Département">
                <Input
                  name="departement"
                  value={course.departement}
                  placeholder="Ex. Haute-Savoie"
                  onChange={handleCourseChange}
                />
              </Field>

              <Field label="Présentation">
                <Textarea
                  name="presentation"
                  value={course.presentation}
                  placeholder="Décrivez votre épreuve, les paysages, l’ambiance, etc."
                  onChange={handleCourseChange}
                />
              </Field>

              <Field label="Image de l’épreuve">
                <input
                  type="file"
                  name="image"
                  accept="image/*"
                  onChange={handleCourseChange}
                  className="block w-full text-sm text-neutral-700 file:mr-3 file:rounded-xl file:border file:border-neutral-200 file:bg-white file:px-3 file:py-2 hover:file:bg-neutral-50"
                />
                <p className="mt-1 text-xs text-neutral-500">JPEG/PNG recommandé, ~1600×900.</p>
              </Field>
            </div>
          </div>

          {/* Carte — Formats */}
          <div className="rounded-2xl bg-white shadow-lg shadow-neutral-900/5 ring-1 ring-neutral-200">
            <div className="p-5 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg sm:text-xl font-bold">Formats de course</h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Ajoutez un ou plusieurs formats (10K, 21K, relais, rando, etc.).
                </p>
              </div>
              <button
                type="button"
                onClick={addFormat}
                className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
              >
                + Ajouter un format
              </button>
            </div>

            <div className="p-5 grid gap-6">
              {formats.map((f, index) => (
                <div key={f.id} className="rounded-xl ring-1 ring-neutral-200 bg-neutral-50 p-4">
                  {/* En-tête Format */}
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-semibold text-neutral-700">
                      Format #{index + 1}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFormat(f.id)}
                      className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
                    >
                      Supprimer ce format
                    </button>
                  </div>

                  <div className="grid gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Nom du format" required>
                        <Input
                          name="nom"
                          value={f.nom}
                          onChange={(e) => handleFormatChange(index, e)}
                          placeholder="Ex. 32K Skyrace"
                        />
                      </Field>
                      <Field label="Image du format">
                        <input
                          type="file"
                          name="image"
                          accept="image/*"
                          onChange={(e) => handleFormatChange(index, e)}
                          className="block w-full text-sm text-neutral-700 file:mr-3 file:rounded-xl file:border file:border-neutral-200 file:bg-white file:px-3 file:py-2 hover:file:bg-neutral-50"
                        />
                      </Field>
                    </div>

                    {/* Type d'épreuve (trail/rando/route) + Type format (individuel/groupe/relais) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Field label="Type d'épreuve (trail | rando | route)">
                        <Input
                          name="type_epreuve"
                          value={f.type_epreuve}
                          onChange={(e) => handleFormatChange(index, e)}
                          placeholder="trail | rando | route"
                        />
                      </Field>
                      <Field label="Type d’inscription">
                        <select
                          className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                          value={f.type_format}
                          onChange={(e) => updateFormat(f.id, { type_format: e.target.value })}
                        >
                          <option value="individuel">Individuel</option>
                          <option value="groupe">Groupe (paiement groupé)</option>
                          <option value="relais">Relais / Ekiden / Multisport</option>
                        </select>
                      </Field>
                      <Field label="Sport global (info)">
                        <select
                          className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                          value={f.sport_global || ""}
                          onChange={(e) => updateFormat(f.id, { sport_global: e.target.value })}
                        >
                          <option value="">—</option>
                          <option>Course à pied</option>
                          <option>Trail</option>
                          <option>VTT</option>
                          <option>Natation</option>
                          <option>Triathlon</option>
                          <option>Multisport</option>
                          <option>Autre</option>
                        </select>
                      </Field>
                    </div>

                    {/* Date/heure */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Field label="Date">
                        <Input
                          type="date"
                          name="date"
                          value={f.date}
                          onChange={(e) => handleFormatChange(index, e)}
                        />
                      </Field>
                      <Field label="Heure de départ">
                        <Input
                          type="time"
                          name="heure_depart"
                          value={f.heure_depart}
                          onChange={(e) => handleFormatChange(index, e)}
                        />
                      </Field>
                      <Field label="Participants max">
                        <Input
                          name="nb_max_coureurs"
                          value={f.nb_max_coureurs}
                          onChange={(e) => handleFormatChange(index, e)}
                          placeholder="Ex. 500"
                        />
                      </Field>
                    </div>

                    {/* Fenêtre d’inscriptions */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Field label="Ouverture des inscriptions">
                        <Input
                          type="datetime-local"
                          value={f.inscription_ouverture}
                          onChange={(e) => updateFormat(f.id, { inscription_ouverture: e.target.value })}
                        />
                      </Field>
                      <Field label="Fermeture des inscriptions">
                        <Input
                          type="datetime-local"
                          value={f.inscription_fermeture}
                          onChange={(e) => updateFormat(f.id, { inscription_fermeture: e.target.value })}
                        />
                      </Field>
                      <Field label="Fuseau horaire">
                        <Input
                          value={f.fuseau_horaire}
                          onChange={(e) => updateFormat(f.id, { fuseau_horaire: e.target.value })}
                          placeholder="Europe/Paris"
                        />
                      </Field>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Field label="Fermer auto. quand plein">
                        <div className="flex items-center h-[38px]">
                          <input
                            type="checkbox"
                            checked={!!f.close_on_full}
                            onChange={(e) => updateFormat(f.id, { close_on_full: e.target.checked })}
                          />
                        </div>
                      </Field>
                      <Field label="Activer liste d’attente">
                        <div className="flex items-center h-[38px]">
                          <input
                            type="checkbox"
                            checked={!!f.waitlist_enabled}
                            onChange={(e) =>
                              updateFormat(f.id, { waitlist_enabled: e.target.checked })
                            }
                          />
                        </div>
                      </Field>
                      {f.waitlist_enabled && (
                        <Field label="Taille max liste d’attente">
                          <Input
                            type="number"
                            value={f.quota_attente}
                            onChange={(e) =>
                              updateFormat(f.id, { quota_attente: Number(e.target.value) })
                            }
                          />
                        </Field>
                      )}
                    </div>

                    {/* Parcours */}
                    <Field label="Présentation du parcours">
                      <Textarea
                        name="presentation_parcours"
                        value={f.presentation_parcours}
                        onChange={(e) => handleFormatChange(index, e)}
                        placeholder="Infos techniques, points remarquables, etc."
                      />
                    </Field>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Field label="Distance (km)">
                        <Input
                          name="distance_km"
                          value={f.distance_km}
                          onChange={(e) => handleFormatChange(index, e)}
                          placeholder="Ex. 32.6"
                        />
                      </Field>
                      <Field label="D+ (m)">
                        <Input
                          name="denivele_dplus"
                          value={f.denivele_dplus}
                          onChange={(e) => handleFormatChange(index, e)}
                          placeholder="Ex. 2630"
                        />
                      </Field>
                      <Field label="D- (m)">
                        <Input
                          name="denivele_dmoins"
                          value={f.denivele_dmoins}
                          onChange={(e) => handleFormatChange(index, e)}
                          placeholder="Ex. 2600"
                        />
                      </Field>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Adresse de départ">
                        <Input
                          name="adresse_depart"
                          value={f.adresse_depart}
                          onChange={(e) => handleFormatChange(index, e)}
                        />
                      </Field>
                      <Field label="Adresse d'arrivée">
                        <Input
                          name="adresse_arrivee"
                          value={f.adresse_arrivee}
                          onChange={(e) => handleFormatChange(index, e)}
                        />
                      </Field>
                    </div>

                    {/* Prix & repas */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Field label="Prix (€/pers.)">
                        <Input
                          name="prix"
                          value={f.prix}
                          onChange={(e) => handleFormatChange(index, e)}
                          placeholder="Ex. 35"
                        />
                      </Field>

                      {/* Option prix équipe si groupe/relais */}
                      {f.type_format !== "individuel" && (
                        <Field label="Prix équipe (optionnel)">
                          <Input
                            value={f.prix_equipe}
                            onChange={(e) => updateFormat(f.id, { prix_equipe: e.target.value })}
                            placeholder="Ex. 120"
                          />
                        </Field>
                      )}

                      <Field label="Stock repas">
                        <Input
                          name="stock_repas"
                          value={f.stock_repas}
                          onChange={(e) => handleFormatChange(index, e)}
                          placeholder="0 si pas de repas"
                        />
                      </Field>
                    </div>

                    {parseInt(f.stock_repas || "0", 10) > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Field label="Prix du repas (€)">
                          <Input
                            name="prix_repas"
                            value={f.prix_repas}
                            onChange={(e) => handleFormatChange(index, e)}
                            placeholder="Ex. 10"
                          />
                        </Field>
                      </div>
                    )}

                    {/* Fichiers GPX + Règlement */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Fichier GPX (trace)">
                        <input
                          type="file"
                          name="gpx_url"
                          accept=".gpx"
                          onChange={(e) => handleFormatChange(index, e)}
                          className="block w-full text-sm text-neutral-700 file:mr-3 file:rounded-xl file:border file:border-neutral-200 file:bg-white file:px-3 file:py-2 hover:file:bg-neutral-50"
                        />
                        {f.gpx_url && (
                          <div className="text-xs text-neutral-600 mt-1 break-all">
                            Actuel : <a href={f.gpx_url} target="_blank" rel="noreferrer">{f.gpx_url}</a>
                          </div>
                        )}
                      </Field>

                      <Field label="Règlement (PDF)">
                        <input
                          type="file"
                          name="fichier_reglement"
                          accept=".pdf"
                          onChange={(e) => handleFormatChange(index, e)}
                          className="block w-full text-sm text-neutral-700 file:mr-3 file:rounded-xl file:border file:border-neutral-200 file:bg-white file:px-3 file:py-2 hover:file:bg-neutral-50"
                        />
                        {f.reglement_pdf_url && (
                          <div className="text-xs text-neutral-600 mt-1 break-all">
                            Actuel :{" "}
                            <a href={f.reglement_pdf_url} target="_blank" rel="noreferrer">
                              {f.reglement_pdf_url}
                            </a>
                          </div>
                        )}
                      </Field>
                    </div>

                    {/* Logistique */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Field label="Ravitaillements">
                        <Input
                          name="ravitaillements"
                          value={f.ravitaillements}
                          onChange={(e) => handleFormatChange(index, e)}
                          placeholder="Ex. 3 ravitos"
                        />
                      </Field>
                      <Field label="Remise des dossards">
                        <Input
                          name="remise_dossards"
                          value={f.remise_dossards}
                          onChange={(e) => handleFormatChange(index, e)}
                          placeholder="Ex. veille, 16–19h"
                        />
                      </Field>
                      <Field label="Dotation">
                        <Input
                          name="dotation"
                          value={f.dotation}
                          onChange={(e) => handleFormatChange(index, e)}
                          placeholder="Ex. T-shirt finisher"
                        />
                      </Field>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Field label="Âge minimum">
                        <Input
                          name="age_minimum"
                          value={f.age_minimum}
                          onChange={(e) => handleFormatChange(index, e)}
                          placeholder="Ex. 18"
                        />
                      </Field>
                    </div>

                    <Field label="Hébergements (optionnel)">
                      <Textarea
                        name="hebergements"
                        value={f.hebergements}
                        onChange={(e) => handleFormatChange(index, e)}
                        placeholder="Infos hébergements, partenaires, etc."
                      />
                    </Field>

                    {/* Groupe/Relais : tailles */}
                    {f.type_format !== "individuel" && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Field label="Nombre de coureurs (équipe)">
                          <Input
                            value={f.team_size}
                            onChange={(e) => updateFormat(f.id, { team_size: e.target.value })}
                            placeholder="Ex. 6"
                          />
                        </Field>
                        <Field label="Taille min (optionnel)">
                          <Input
                            value={f.nb_coureurs_min}
                            onChange={(e) => updateFormat(f.id, { nb_coureurs_min: e.target.value })}
                          />
                        </Field>
                        <Field label="Taille max (optionnel)">
                          <Input
                            value={f.nb_coureurs_max}
                            onChange={(e) => updateFormat(f.id, { nb_coureurs_max: e.target.value })}
                          />
                        </Field>
                      </div>
                    )}

                    {/* Étapes si relais */}
                    {f.type_format === "relais" && (
                      <div className="grid gap-3">
                        <div className="text-sm font-semibold text-neutral-700">
                          Étapes du relais
                        </div>
                        <EtapesRelaisEditor
                          etapes={f.etapes}
                          setEtapes={(next) => updateFormat(f.id, { etapes: next })}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions globales */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-70"
            >
              {isEdit ? "💾 Mettre à jour l’épreuve" : "✅ Créer l’épreuve"}
            </button>
            <button
              type="button"
              onClick={addFormat}
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              + Ajouter un format
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
