// src/pages/UpsertCourse.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "../supabase";
import { BookOpen, ArrowUpRight } from "lucide-react";
import GainPreview from "../components/GainPreview";

/* ---------- UI helpers ---------- */
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

/* ---------- Éditeur d’étapes relais ---------- */
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
        gpx_url: "",
        description: "",
        cut_off_minutes: "",
      },
    ]);

  const update = (id, patch) =>
    setEtapes(etapes.map((e) => (e._local_id === id ? { ...e, ...patch } : e)));
  const remove = (id) => {
    const next = etapes.filter((e) => e._local_id !== id);
    setEtapes(
      next.map((e, i) => ({
        ...e,
        ordre: i + 1,
        titre: `Relais ${i + 1}`,
      }))
    );
  };

  return (
    <div className="grid gap-4">
      {etapes.map((e) => (
        <div
          key={e._local_id}
          className="rounded-xl ring-1 ring-neutral-200 bg-neutral-50 p-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
            <Field label="Titre">
              <Input
                value={e.titre}
                onChange={(ev) =>
                  update(e._local_id, { titre: ev.target.value })
                }
              />
            </Field>
            <Field label="Sport">
              <select
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                value={e.sport}
                onChange={(ev) =>
                  update(e._local_id, { sport: ev.target.value })
                }
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
                onChange={(ev) =>
                  update(e._local_id, { distance_km: ev.target.value })
                }
              />
            </Field>
            <Field label="D+ (m)">
              <Input
                type="number"
                value={e.denivele_dplus}
                onChange={(ev) =>
                  update(e._local_id, { denivele_dplus: ev.target.value })
                }
              />
            </Field>
            <Field label="D- (m)">
              <Input
                type="number"
                value={e.denivele_dmoins}
                onChange={(ev) =>
                  update(e._local_id, { denivele_dmoins: ev.target.value })
                }
              />
            </Field>
            <Field label="Cut-off (min)">
              <Input
                type="number"
                value={e.cut_off_minutes}
                onChange={(ev) =>
                  update(e._local_id, { cut_off_minutes: ev.target.value })
                }
              />
            </Field>
          </div>
          <div className="grid gap-4 mt-3">
            <Field label="URL GPX (optionnel)">
              <Input
                value={e.gpx_url || ""}
                onChange={(ev) =>
                  update(e._local_id, { gpx_url: ev.target.value })
                }
                placeholder="https://…"
              />
            </Field>
            <Field label="Description (optionnel)">
              <Textarea
                value={e.description || ""}
                onChange={(ev) =>
                  update(e._local_id, { description: ev.target.value })
                }
              />
            </Field>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => remove(e._local_id)}
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
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

/* ---------- Éditeur des options du format (options_catalogue) ---------- */
function OptionsEditor({ options, setOptions }) {
  const add = () =>
    setOptions([
      ...options,
      {
        _local_id: uuidv4(),
        id: null,
        label: "",
        price_eur: "",
        description: "",
        is_active: true,
        max_qty_per_inscription: "1",
      },
    ]);

  const update = (id, patch) =>
    setOptions(options.map((o) => (o._local_id === id ? { ...o, ...patch } : o)));

  const remove = (id) =>
    setOptions(options.filter((o) => o._local_id !== id));

  return (
    <div className="grid gap-3">
      {options.map((o) => (
        <div
          key={o._local_id}
          className="rounded-xl bg-white ring-1 ring-neutral-200 p-3 grid gap-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Field label="Libellé" required>
              <Input
                value={o.label}
                onChange={(e) => update(o._local_id, { label: e.target.value })}
                placeholder="Ex. Repas d'après-course"
              />
            </Field>
            <Field label="Prix (€/unité)" required>
              <Input
                type="number"
                step="0.01"
                value={o.price_eur}
                onChange={(e) =>
                  update(o._local_id, { price_eur: e.target.value })
                }
                placeholder="Ex. 12"
              />
            </Field>
            <GainPreview
  basePriceEUR={Number(o.price_eur || 0)}
  defaultParticipants={200}
/>
            
            <Field label="Quantité max / inscription">
              <Input
                type="number"
                min={0}
                value={o.max_qty_per_inscription}
                onChange={(e) =>
                  update(o._local_id, {
                    max_qty_per_inscription: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Actif">
              <div className="flex items-center h-[38px]">
                <input
                  type="checkbox"
                  checked={o.is_active}
                  onChange={(e) =>
                    update(o._local_id, { is_active: e.target.checked })
                  }
                />
                <span className="ml-2 text-xs text-neutral-600">
                  Visible au moment de l’inscription
                </span>
              </div>
            </Field>
          </div>
          <Field label="Description (optionnel)">
            <Textarea
              rows={2}
              value={o.description || ""}
              onChange={(e) =>
                update(o._local_id, { description: e.target.value })
              }
              placeholder="Détails pratiques, contenu, horaires, etc."
            />
          </Field>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => remove(o._local_id)}
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
            >
              Supprimer cette option
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="rounded-xl bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110"
      >
        + Ajouter une option
      </button>
    </div>
  );
}

/* ---------- Page Upsert ---------- */
export default function UpsertCourse() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  // DEBUG : vérifier que la route utilise bien UpsertCourse.jsx
  useEffect(() => {
    console.log("[Tickrace DEBUG] UpsertCourse.jsx monté", {
      mode: isEdit ? "edition" : "creation",
      courseId: id || null,
      pathname: typeof window !== "undefined" ? window.location.pathname : null,
    });
  }, [isEdit, id]);

  const [course, setCourse] = useState({
    nom: "",
    lieu: "",
    departement: "",
    code_postal: "",
    presentation: "",
    imageFile: null,
    image_url: "",
  });

  const formatTemplate = () => ({
    id: uuidv4(),
    nom: "",
    imageFile: null,
    date: "",
    heure_depart: "",
    presentation_parcours: "",
    gpx_urlFile: null,
    gpx_url: null,
    fichier_reglementFile: null,
    reglement_pdf_url: null,
    type_epreuve: "trail",
    distance_km: "",
    denivele_dplus: "",
    denivele_dmoins: "",
    adresse_depart: "",
    adresse_arrivee: "",
    prix: "",
    // repas gardés en interne mais plus exposés en UI
    stock_repas: "",
    prix_repas: "",
    prix_total_inscription: "",
    ravitaillements: "",
    remise_dossards: "",
    dotation: "",
    nb_max_coureurs: "",
    age_minimum: "",
    hebergements: "",
    // Nouveaux / équipes
    type_format: "individuel",
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
    etapes: [],
    options: [], // options_catalogue liées à ce format
  });

  const [formats, setFormats] = useState([formatTemplate()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleCourseChange = (e) => {
    const { name, value, files } = e.target;
    setCourse((p) => ({
      ...p,
      [files ? name + "File" : name]: files ? files[0] : value,
    }));
  };
  const handleFormatChange = (index, e) => {
    const { name, value, files } = e.target;
    const up = [...formats];
    up[index][files ? name + "File" : name] = files ? files[0] : value;
    setFormats(up);
  };
  const addFormat = () => setFormats((p) => [...p, formatTemplate()]);
  const removeFormat = (localId) =>
    setFormats((p) => p.filter((f) => f.id !== localId));
  const updateFormat = (localId, patch) =>
    setFormats((p) =>
      p.map((f) => (f.id === localId ? { ...f, ...patch } : f))
    );

  useEffect(() => {
    (async () => {
      if (!isEdit) {
        setLoading(false);
        return;
      }
      setLoading(true);

      const { data: c } = await supabase
        .from("courses")
        .select("*")
        .eq("id", id)
        .single();

      const { data: fs } = await supabase
        .from("formats")
        .select("*")
        .eq("course_id", id)
        .order("created_at", { ascending: true });

      let etapesByFormat = {};
      let optionsByFormat = {};

      if (fs?.length) {
        const ids = fs.map((f) => f.id);

        // Étapes relais
        const { data: etapes } = await supabase
          .from("formats_etapes")
          .select("*")
          .in("format_id", ids)
          .order("ordre", { ascending: true });
        if (etapes) {
          etapesByFormat = etapes.reduce((acc, cur) => {
            (acc[cur.format_id] ||= []).push({
              ...cur,
              _local_id: uuidv4(),
            });
            return acc;
          }, {});
        }

        // Options catalogue
        const { data: opts } = await supabase
          .from("options_catalogue")
          .select("*")
          .in("format_id", ids);
        if (opts) {
          optionsByFormat = opts.reduce((acc, cur) => {
            (acc[cur.format_id] ||= []).push({
              _local_id: uuidv4(),
              id: cur.id,
              label: cur.label,
              price_eur: (cur.price_cents / 100).toString(),
              description: cur.description || "",
              is_active: cur.is_active,
              max_qty_per_inscription:
                cur.max_qty_per_inscription?.toString() || "1",
              image_url: cur.image_url || null,
            });
            return acc;
          }, {});
        }
      }

      setCourse({
        nom: c?.nom || "",
        lieu: c?.lieu || "",
        departement: c?.departement || "",
        code_postal: c?.code_postal || "",
        presentation: c?.presentation || "",
        imageFile: null,
        image_url: c?.image_url || "",
      });

      setFormats(
        (fs || []).map((f) => ({
          ...formatTemplate(),
          id: f.id,
          nom: f.nom || "",
          image_url: f.image_url || null,
          date: f.date || "",
          heure_depart: f.heure_depart || "",
          presentation_parcours: f.presentation_parcours || "",
          gpx_url: f.gpx_url || null,
          reglement_pdf_url: f.reglement_pdf_url || null,
          type_epreuve: ["trail", "rando", "route"].includes(
            f.type_epreuve || ""
          )
            ? f.type_epreuve
            : "trail",
          distance_km: f.distance_km ?? "",
          denivele_dplus: f.denivele_dplus ?? "",
          denivele_dmoins: f.denivele_dmoins ?? "",
          adresse_depart: f.adresse_depart || "",
          adresse_arrivee: f.adresse_arrivee || "",
          prix: f.prix ?? "",
          // champs repas gardés mais pas exposés
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
          options: optionsByFormat[f.id] || [],
        }))
      );
      setLoading(false);
    })();
  }, [id, isEdit]);

  const validate = () => {
    if (
      !course.nom?.trim() ||
      !course.lieu?.trim() ||
      !course.code_postal?.trim()
    ) {
      alert("Renseigne nom, lieu et code postal.");
      return false;
    }
    for (const f of formats) {
      if (!f.nom?.trim()) {
        alert("Chaque format doit avoir un nom.");
        return false;
      }
      if (
        f.type_epreuve &&
        !["trail", "rando", "route"].includes(f.type_epreuve)
      ) {
        alert(
          `Type d'épreuve invalide pour "${f.nom}". Utilise trail | rando | route.`
        );
        return false;
      }
      if (f.type_format === "relais" && (!f.etapes || f.etapes.length < 2)) {
        alert(`"${f.nom}" est en relais : ajoute au moins 2 étapes.`);
        return false;
      }
      if (
        f.inscription_ouverture &&
        f.inscription_fermeture &&
        new Date(f.inscription_ouverture) >=
          new Date(f.inscription_fermeture)
      ) {
        alert(`Fenêtre d'inscriptions invalide pour "${f.nom}".`);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) throw new Error("Utilisateur non connecté.");

      async function geocode(postal, ville) {
        try {
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(
              postal || ""
            )}&city=${encodeURIComponent(
              ville || ""
            )}&country=France&format=json&limit=1`
          );
          const d = await resp.json();
          if (d?.length)
            return {
              lat: parseFloat(d[0].lat),
              lng: parseFloat(d[0].lon),
            };
        } catch {}
        return { lat: null, lng: null };
      }

      async function syncOptions(formatId, optionsArr) {
        if (!formatId) return;
        const keptOptionIds = [];

        for (const opt of optionsArr || []) {
          const label = opt.label?.trim();
          if (!label) continue; // ignore lignes vides

          const priceFloat = opt.price_eur
            ? parseFloat(opt.price_eur.replace(",", "."))
            : 0;
          const price_cents = Number.isFinite(priceFloat)
            ? Math.round(priceFloat * 100)
            : 0;
          const maxQtyInt = opt.max_qty_per_inscription
            ? parseInt(opt.max_qty_per_inscription, 10)
            : 10;
          const max_qty_per_inscription = Number.isFinite(maxQtyInt)
            ? maxQtyInt
            : 10;

          const payloadOpt = {
            format_id: formatId,
            label,
            price_cents: price_cents < 0 ? 0 : price_cents,
            description: opt.description || null,
            image_url: opt.image_url || null,
            is_active: opt.is_active !== false,
            max_qty_per_inscription:
              max_qty_per_inscription < 0 ? 0 : max_qty_per_inscription,
          };

          let optionId = null;
          const looksUUID = typeof opt.id === "string" && opt.id.length > 20;
          if (looksUUID) {
            const { data: chkOpt } = await supabase
              .from("options_catalogue")
              .select("id")
              .eq("id", opt.id)
              .maybeSingle();
            if (chkOpt?.id) {
              const { error: upErr } = await supabase
                .from("options_catalogue")
                .update(payloadOpt)
                .eq("id", opt.id);
              if (upErr) throw upErr;
              optionId = opt.id;
            } else {
              const { data: insOpt, error: insOptErr } = await supabase
                .from("options_catalogue")
                .insert(payloadOpt)
                .select("id")
                .single();
              if (insOptErr) throw insOptErr;
              optionId = insOpt.id;
            }
          } else {
            const { data: insOpt, error: insOptErr } = await supabase
              .from("options_catalogue")
              .insert(payloadOpt)
              .select("id")
              .single();
            if (insOptErr) throw insOptErr;
            optionId = insOpt.id;
          }

          keptOptionIds.push(optionId);
        }

        // supprimer les options supprimées dans le formulaire
        const { data: existingOpts } = await supabase
          .from("options_catalogue")
          .select("id")
          .eq("format_id", formatId);
        const toDelete = (existingOpts || [])
          .map((o) => o.id)
          .filter((oid) => !keptOptionIds.includes(oid));
        if (toDelete.length) {
          await supabase.from("options_catalogue").delete().in("id", toDelete);
        }
      }

      const { lat, lng } = await geocode(course.code_postal, course.lieu);

      // Upload image course
      let imageCourseUrl = course.image_url || null;
      if (course.imageFile) {
        const { data, error } = await supabase.storage
          .from("courses")
          .upload(`course-${Date.now()}.jpg`, course.imageFile, {
            upsert: false,
          });
        if (error) throw error;
        imageCourseUrl = supabase.storage
          .from("courses")
          .getPublicUrl(data.path).data.publicUrl;
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

      // Formats
      const keptIds = [];
      for (const f of formats) {
        // uploads
        let imageFormatUrl = f.image_url || null;
        if (f.imageFile) {
          const { data, error } = await supabase.storage
            .from("formats")
            .upload(`format-${Date.now()}-${f.nom || "sans-nom"}.jpg`, f.imageFile, {
              upsert: false,
            });
          if (!error)
            imageFormatUrl = supabase.storage.from("formats").getPublicUrl(data.path).data.publicUrl;
        }
        let gpxUrl = f.gpx_url || null;
        if (f.gpx_urlFile) {
          const { data, error } = await supabase.storage
            .from("formats")
            .upload(`gpx-${Date.now()}-${f.nom || "sans-nom"}.gpx`, f.gpx_urlFile, {
              upsert: false,
            });
          if (!error)
            gpxUrl = supabase.storage.from("formats").getPublicUrl(data.path).data.publicUrl;
        }
        let reglementUrl = f.reglement_pdf_url || null;
        if (f.fichier_reglementFile) {
          const { data, error } = await supabase.storage
            .from("reglements")
            .upload(
              `reglement-${Date.now()}-${f.nom || "sans-nom"}.pdf`,
              f.fichier_reglementFile,
              { upsert: false }
            );
          if (!error)
            reglementUrl = supabase.storage.from("reglements").getPublicUrl(data.path).data.publicUrl;
        }

        const prix = f.prix ? parseFloat(f.prix) : 0;
        const prix_total_inscription = prix; // repas supprimés, on ne les additionne plus

        const payload = {
          course_id: courseId,
          nom: f.nom || "Format sans nom",
          image_url: imageFormatUrl,
          date: f.date || null,
          heure_depart: f.heure_depart || null,
          presentation_parcours: f.presentation_parcours || null,
          gpx_url: gpxUrl,
          type_epreuve: ["trail", "rando", "route"].includes(f.type_epreuve)
            ? f.type_epreuve
            : "trail",
          distance_km: f.distance_km ? parseFloat(f.distance_km) : null,
          denivele_dplus: f.denivele_dplus ? parseInt(f.denivele_dplus, 10) : null,
          denivele_dmoins: f.denivele_dmoins ? parseInt(f.denivele_dmoins, 10) : null,
          adresse_depart: f.adresse_depart || null,
          adresse_arrivee: f.adresse_arrivee || null,
          prix,
          // repas : on force à 0, on garde les colonnes par compat
          stock_repas: 0,
          prix_repas: 0,
          prix_total_inscription,
          ravitaillements: f.ravitaillements || null,
          remise_dossards: f.remise_dossards || null,
          dotation: f.dotation || null,
          reglement_pdf_url: reglementUrl,
          nb_max_coureurs: f.nb_max_coureurs ? parseInt(f.nb_max_coureurs, 10) : null,
          age_minimum: f.age_minimum ? parseInt(f.age_minimum, 10) : null,
          hebergements: f.hebergements || null,
          // nouveaux
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

        let formatId = null;
        const looksUUID = typeof f.id === "string" && f.id.length > 20;
        if (isEdit && looksUUID) {
          const { data: chk } = await supabase.from("formats").select("id").eq("id", f.id).maybeSingle();
          if (chk?.id) {
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

        // Étapes relais
        if (payload.type_format === "relais") {
          await supabase.from("formats_etapes").delete().eq("format_id", formatId);
          if (Array.isArray(f.etapes)) {
            for (const e of f.etapes) {
              const { error: eErr } = await supabase.from("formats_etapes").insert({
                format_id: formatId,
                ordre: e.ordre || 1,
                titre: e.titre || null,
                sport: e.sport || null,
                distance_km: e.distance_km !== "" && e.distance_km != null ? Number(e.distance_km) : null,
                denivele_dplus:
                  e.denivele_dplus !== "" && e.denivele_dplus != null ? Number(e.denivele_dplus) : null,
                denivele_dmoins:
                  e.denivele_dmoins !== "" && e.denivele_dmoins != null ? Number(e.denivele_dmoins) : null,
                gpx_url: e.gpx_url || null,
                description: e.description || null,
                cut_off_minutes:
                  e.cut_off_minutes !== "" && e.cut_off_minutes != null ? Number(e.cut_off_minutes) : null,
              });
              if (eErr) throw eErr;
            }
          }
        } else {
          await supabase.from("formats_etapes").delete().eq("format_id", formatId);
        }

        // Options catalogue
        await syncOptions(formatId, f.options || []);

        keptIds.push(formatId);
      }

      if (isEdit) {
        const { data: existing } = await supabase.from("formats").select("id").eq("course_id", id);
        const toDel = (existing || [])
          .map((r) => r.id)
          .filter((fid) => !keptIds.includes(fid));
        if (toDel.length) await supabase.from("formats").delete().in("id", toDel);
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

          {/* Lien vers le tuto (à placer juste sous le titre) */}
          <div className="mt-3">
            <Link
              to="/help/creer-une-course"
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 transition"
            >
              <BookOpen className="h-4 w-4" />
              Besoin d’aide ? Voir le tutoriel “Créer une course”
              <ArrowUpRight className="h-4 w-4 opacity-70" />
            </Link>

            <p className="mt-1 text-xs text-neutral-500">
              Étapes, checklist, options, chronométrage et publication.
            </p>
          </div>

          <p className="mt-2 text-neutral-600 text-base">
            Renseignez les informations générales, ajoutez vos formats et leurs
            options, puis publiez quand tout est prêt.
          </p>

          {/* BADGE DEBUG TEMPORAIRE */}
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
            <span>✅ UpsertCourse.jsx actif</span>
            <span className="text-[10px] uppercase tracking-wide">
              {isEdit ? "mode édition" : "mode création"}
            </span>
          </div>
        </div>
      </section>

      {/* Form */}
      <div className="mx-auto max-w-5xl px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Carte — Infos course */}
          <div className="rounded-2xl bg-white shadow-lg shadow-neutral-900/5 ring-1 ring-neutral-200">
            <div className="p-5 border-b border-neutral-200">
              <h2 className="text-lg sm:text-xl font-bold">
                Informations générales
              </h2>
              <p className="mt-1 text-sm text-neutral-600">
                Nom, lieu, présentation et visuel de l’épreuve.
              </p>
            </div>
            <div className="p-5 grid gap-4">
              <Field label="Nom de l'épreuve" required>
                <Input
                  name="nom"
                  value={course.nom}
                  onChange={handleCourseChange}
                  placeholder="Ex. Trail des Aiguilles"
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Lieu" required>
                  <Input
                    name="lieu"
                    value={course.lieu}
                    onChange={handleCourseChange}
                    placeholder="Ex. Chamonix"
                  />
                </Field>
                <Field label="Code postal" required>
                  <Input
                    name="code_postal"
                    value={course.code_postal}
                    onChange={handleCourseChange}
                    placeholder="Ex. 74400"
                  />
                </Field>
              </div>

              <Field label="Département">
                <select
                  name="departement"
                  value={course.departement}
                  onChange={handleCourseChange}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                >
                  <option value="">Sélectionnez un département</option>
                  <option value="01 - Ain">01 - Ain</option>
                  <option value="02 - Aisne">02 - Aisne</option>
                  <option value="03 - Allier">03 - Allier</option>
                  <option value="04 - Alpes-de-Haute-Provence">
                    04 - Alpes-de-Haute-Provence
                  </option>
                  <option value="05 - Hautes-Alpes">05 - Hautes-Alpes</option>
                  <option value="06 - Alpes-Maritimes">
                    06 - Alpes-Maritimes
                  </option>
                  <option value="07 - Ardèche">07 - Ardèche</option>
                  <option value="08 - Ardennes">08 - Ardennes</option>
                  <option value="09 - Ariège">09 - Ariège</option>
                  <option value="10 - Aube">10 - Aube</option>
                  <option value="11 - Aude">11 - Aude</option>
                  <option value="12 - Aveyron">12 - Aveyron</option>
                  <option value="13 - Bouches-du-Rhône">
                    13 - Bouches-du-Rhône
                  </option>
                  <option value="14 - Calvados">14 - Calvados</option>
                  <option value="15 - Cantal">15 - Cantal</option>
                  <option value="16 - Charente">16 - Charente</option>
                  <option value="17 - Charente-Maritime">
                    17 - Charente-Maritime
                  </option>
                  <option value="18 - Cher">18 - Cher</option>
                  <option value="19 - Corrèze">19 - Corrèze</option>
                  <option value="21 - Côte-d'Or">21 - Côte-d'Or</option>
                  <option value="22 - Côtes-d'Armor">22 - Côtes-d'Armor</option>
                  <option value="23 - Creuse">23 - Creuse</option>
                  <option value="24 - Dordogne">24 - Dordogne</option>
                  <option value="25 - Doubs">25 - Doubs</option>
                  <option value="26 - Drôme">26 - Drôme</option>
                  <option value="27 - Eure">27 - Eure</option>
                  <option value="28 - Eure-et-Loir">28 - Eure-et-Loir</option>
                  <option value="29 - Finistère">29 - Finistère</option>
                  <option value="2A - Corse-du-Sud">2A - Corse-du-Sud</option>
                  <option value="2B - Haute-Corse">2B - Haute-Corse</option>
                  <option value="30 - Gard">30 - Gard</option>
                  <option value="31 - Haute-Garonne">
                    31 - Haute-Garonne
                  </option>
                  <option value="32 - Gers">32 - Gers</option>
                  <option value="33 - Gironde">33 - Gironde</option>
                  <option value="34 - Hérault">34 - Hérault</option>
                  <option value="35 - Ille-et-Vilaine">
                    35 - Ille-et-Vilaine
                  </option>
                  <option value="36 - Indre">36 - Indre</option>
                  <option value="37 - Indre-et-Loire">
                    37 - Indre-et-Loire
                  </option>
                  <option value="38 - Isère">38 - Isère</option>
                  <option value="39 - Jura">39 - Jura</option>
                  <option value="40 - Landes">40 - Landes</option>
                  <option value="41 - Loir-et-Cher">41 - Loir-et-Cher</option>
                  <option value="42 - Loire">42 - Loire</option>
                  <option value="43 - Haute-Loire">43 - Haute-Loire</option>
                  <option value="44 - Loire-Atlantique">
                    44 - Loire-Atlantique
                  </option>
                  <option value="45 - Loiret">45 - Loiret</option>
                  <option value="46 - Lot">46 - Lot</option>
                  <option value="47 - Lot-et-Garonne">
                    47 - Lot-et-Garonne
                  </option>
                  <option value="48 - Lozère">48 - Lozère</option>
                  <option value="49 - Maine-et-Loire">
                    49 - Maine-et-Loire
                  </option>
                  <option value="50 - Manche">50 - Manche</option>
                  <option value="51 - Marne">51 - Marne</option>
                  <option value="52 - Haute-Marne">52 - Haute-Marne</option>
                  <option value="53 - Mayenne">53 - Mayenne</option>
                  <option value="54 - Meurthe-et-Moselle">
                    54 - Meurthe-et-Moselle
                  </option>
                  <option value="55 - Meuse">55 - Meuse</option>
                  <option value="56 - Morbihan">56 - Morbihan</option>
                  <option value="57 - Moselle">57 - Moselle</option>
                  <option value="58 - Nièvre">58 - Nièvre</option>
                  <option value="59 - Nord">59 - Nord</option>
                  <option value="60 - Oise">60 - Oise</option>
                  <option value="61 - Orne">61 - Orne</option>
                  <option value="62 - Pas-de-Calais">62 - Pas-de-Calais</option>
                  <option value="63 - Puy-de-Dôme">63 - Puy-de-Dôme</option>
                  <option value="64 - Pyrénées-Atlantiques">
                    64 - Pyrénées-Atlantiques
                  </option>
                  <option value="65 - Hautes-Pyrénées">
                    65 - Hautes-Pyrénées
                  </option>
                  <option value="66 - Pyrénées-Orientales">
                    66 - Pyrénées-Orientales
                  </option>
                  <option value="67 - Bas-Rhin">67 - Bas-Rhin</option>
                  <option value="68 - Haut-Rhin">68 - Haut-Rhin</option>
                  <option value="69 - Rhône">69 - Rhône</option>
                  <option value="70 - Haute-Saône">70 - Haute-Saône</option>
                  <option value="71 - Saône-et-Loire">
                    71 - Saône-et-Loire
                  </option>
                  <option value="72 - Sarthe">72 - Sarthe</option>
                  <option value="73 - Savoie">73 - Savoie</option>
                  <option value="74 - Haute-Savoie">74 - Haute-Savoie</option>
                  <option value="75 - Paris">75 - Paris</option>
                  <option value="76 - Seine-Maritime">
                    76 - Seine-Maritime
                  </option>
                  <option value="77 - Seine-et-Marne">
                    77 - Seine-et-Marne
                  </option>
                  <option value="78 - Yvelines">78 - Yvelines</option>
                  <option value="79 - Deux-Sèvres">79 - Deux-Sèvres</option>
                  <option value="80 - Somme">80 - Somme</option>
                  <option value="81 - Tarn">81 - Tarn</option>
                  <option value="82 - Tarn-et-Garonne">
                    82 - Tarn-et-Garonne
                  </option>
                  <option value="83 - Var">83 - Var</option>
                  <option value="84 - Vaucluse">84 - Vaucluse</option>
                  <option value="85 - Vendée">85 - Vendée</option>
                  <option value="86 - Vienne">86 - Vienne</option>
                  <option value="87 - Haute-Vienne">87 - Haute-Vienne</option>
                  <option value="88 - Vosges">88 - Vosges</option>
                  <option value="89 - Yonne">89 - Yonne</option>
                  <option value="90 - Territoire de Belfort">
                    90 - Territoire de Belfort
                  </option>
                  <option value="91 - Essonne">91 - Essonne</option>
                  <option value="92 - Hauts-de-Seine">
                    92 - Hauts-de-Seine
                  </option>
                  <option value="93 - Seine-Saint-Denis">
                    93 - Seine-Saint-Denis
                  </option>
                  <option value="94 - Val-de-Marne">94 - Val-de-Marne</option>
                  <option value="95 - Val-d'Oise">95 - Val-d'Oise</option>
                  <option value="971 - Guadeloupe">971 - Guadeloupe</option>
                  <option value="972 - Martinique">972 - Martinique</option>
                  <option value="973 - Guyane">973 - Guyane</option>
                  <option value="974 - La Réunion">974 - La Réunion</option>
                  <option value="976 - Mayotte">976 - Mayotte</option>
                </select>
              </Field>

              <Field label="Présentation">
                <Textarea
                  name="presentation"
                  value={course.presentation}
                  onChange={handleCourseChange}
                  placeholder="Décrivez votre épreuve, les paysages, l’ambiance, etc."
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
                <p className="mt-1 text-xs text-neutral-500">
                  JPEG/PNG recommandé, ~1600×900.
                </p>
              </Field>
            </div>
          </div>

          {/* Carte — Formats */}
          <div className="rounded-2xl bg-white shadow-lg shadow-neutral-900/5 ring-1 ring-neutral-200">
            <div className="p-5 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg sm:text-xl font-bold">
                  Formats de course
                </h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Ajoutez un ou plusieurs formats (10K, relais, rando, etc.),
                  avec leurs options.
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
                <div
                  key={f.id}
                  className="rounded-xl ring-1 ring-neutral-200 bg-neutral-50 p-4"
                >
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
                          onChange={(e) =>
                            updateFormat(f.id, {
                              type_format: e.target.value,
                            })
                          }
                        >
                          <option value="individuel">Individuel</option>
                          <option value="groupe">
                            Groupe (paiement groupé)
                          </option>
                          <option value="relais">
                            Relais / Ekiden / Multisport
                          </option>
                        </select>
                      </Field>
                      <Field label="Sport global (info)">
                        <select
                          className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                          value={f.sport_global || ""}
                          onChange={(e) =>
                            updateFormat(f.id, {
                              sport_global: e.target.value,
                            })
                          }
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

                    {/* Fenêtre inscriptions */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Field label="Ouverture des inscriptions">
                        <Input
                          type="datetime-local"
                          value={f.inscription_ouverture}
                          onChange={(e) =>
                            updateFormat(f.id, {
                              inscription_ouverture: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field label="Fermeture des inscriptions">
                        <Input
                          type="datetime-local"
                          value={f.inscription_fermeture}
                          onChange={(e) =>
                            updateFormat(f.id, {
                              inscription_fermeture: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field label="Fuseau horaire">
                        <Input
                          value={f.fuseau_horaire}
                          onChange={(e) =>
                            updateFormat(f.id, {
                              fuseau_horaire: e.target.value,
                            })
                          }
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
                            onChange={(e) =>
                              updateFormat(f.id, {
                                close_on_full: e.target.checked,
                              })
                            }
                          />
                        </div>
                      </Field>
                      <Field label="Activer liste d’attente">
                        <div className="flex items-center h-[38px]">
                          <input
                            type="checkbox"
                            checked={!!f.waitlist_enabled}
                            onChange={(e) =>
                              updateFormat(f.id, {
                                waitlist_enabled: e.target.checked,
                              })
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
                              updateFormat(f.id, {
                                quota_attente: Number(e.target.value),
                              })
                            }
                          />
                        </Field>
                      )}
                    </div>

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

                    {/* Tarifs – sans gestion spécifique des repas */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Field label="Prix (€/pers.)">
                        <Input
                          name="prix"
                          value={f.prix}
                          onChange={(e) => handleFormatChange(index, e)}
                          placeholder="Ex. 35"
                        />
                      </Field>
                      {f.type_format !== "individuel" && (
                        <Field label="Prix équipe (optionnel)">
                          <Input
                            value={f.prix_equipe}
                            onChange={(e) =>
                              updateFormat(f.id, {
                                prix_equipe: e.target.value,
                              })
                            }
                            placeholder="Ex. 120"
                          />
                        </Field>
                      )}
                    </div>

                    {/* Fichiers */}
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
                            Actuel :{" "}
                            <a href={f.gpx_url} target="_blank" rel="noreferrer">
                              {f.gpx_url}
                            </a>
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
                            <a
                              href={f.reglement_pdf_url}
                              target="_blank"
                              rel="noreferrer"
                            >
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

                    {/* Groupe/Relais */}
                    {f.type_format !== "individuel" && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Field label="Nombre de coureurs (équipe)">
                          <Input
                            value={f.team_size}
                            onChange={(e) =>
                              updateFormat(f.id, {
                                team_size: e.target.value,
                              })
                            }
                            placeholder="Ex. 6"
                          />
                        </Field>
                        <Field label="Taille min (optionnel)">
                          <Input
                            value={f.nb_coureurs_min}
                            onChange={(e) =>
                              updateFormat(f.id, {
                                nb_coureurs_min: e.target.value,
                              })
                            }
                          />
                        </Field>
                        <Field label="Taille max (optionnel)">
                          <Input
                            value={f.nb_coureurs_max}
                            onChange={(e) =>
                              updateFormat(f.id, {
                                nb_coureurs_max: e.target.value,
                              })
                            }
                          />
                        </Field>
                      </div>
                    )}

                    {f.type_format === "relais" && (
                      <div className="grid gap-3">
                        <div className="text-sm font-semibold text-neutral-700">
                          Étapes du relais
                        </div>
                        <EtapesRelaisEditor
                          etapes={f.etapes}
                          setEtapes={(next) =>
                            updateFormat(f.id, { etapes: next })
                          }
                        />
                      </div>
                    )}

                    {/* Options catalogue */}
                    <div className="mt-4 pt-4 border-t border-dashed border-neutral-300 grid gap-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-neutral-700">
                          Options (repas, tee-shirt, navette, etc.)
                        </div>
                      </div>
                      <OptionsEditor
                        options={f.options || []}
                        setOptions={(next) =>
                          updateFormat(f.id, { options: next })
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
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
