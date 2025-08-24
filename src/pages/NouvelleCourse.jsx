// src/pages/NouvelleCourse.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";

export default function NouvelleCourse() {
  const [course, setCourse] = useState({
    nom: "",
    lieu: "",
    departement: "",
    code_postal: "",
    presentation: "",
    imageFile: null,
  });

  const [formats, setFormats] = useState([{ id: uuidv4(), ...formatTemplate() }]);
  const navigate = useNavigate();

  // — Smoke tests (dev only)
  useEffect(() => {
    try {
      console.assert(typeof NouvelleCourse === "function", "NouvelleCourse should be a component");
      console.assert(Array.isArray(formats) && formats.length >= 1, "At least one format by default");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("Smoke tests failed:", e);
    }
  }, []); // eslint-disable-line

  function formatTemplate() {
    return {
      nom: "",
      imageFile: null,
      date: "",
      heure_depart: "",
      presentation_parcours: "",
      gpx_url: null,
      type_epreuve: "trail",
      distance_km: "",
      denivele_dplus: "",
      denivele_dmoins: "",
      adresse_depart: "",
      adresse_arrivee: "",
      prix: "",
      stock_repas: "",
      prix_repas: "",
      ravitaillements: "",
      remise_dossards: "",
      dotation: "",
      fichier_reglement: null,
      nb_max_coureurs: "",
      age_minimum: "",
      hebergements: "",
    };
  }

  const handleCourseChange = (e) => {
    const { name, value, files } = e.target;
    setCourse((prev) => ({
      ...prev,
      [name + (files ? "File" : "")]: files ? files[0] : value,
    }));
  };

  const handleFormatChange = (index, e) => {
    const { name, value, files } = e.target;
    const updated = [...formats];
    updated[index][name + (files ? "File" : "")] = files ? files[0] : value;
    setFormats(updated);
  };

  const addFormat = () => {
    setFormats((prev) => [...prev, { id: uuidv4(), ...formatTemplate() }]);
  };

  /** Géocodage via Nominatim */
  async function getLatLngFromPostalCode(codePostal, ville) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(
          codePostal || ""
        )}&city=${encodeURIComponent(ville || "")}&country=France&format=json&limit=1`
      );
      const data = await response.json();
      if (data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    } catch (err) {
      console.error("Erreur géocodage :", err);
    }
    return { lat: null, lng: null };
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return alert("Utilisateur non connecté.");

    const { lat, lng } = await getLatLngFromPostalCode(course.code_postal, course.lieu);

    // Upload image course
    let imageCourseUrl = null;
    if (course.imageFile) {
      const { data, error } = await supabase.storage
        .from("courses")
        .upload(`course-${Date.now()}.jpg`, course.imageFile);
      if (error) return alert("Erreur upload image course : " + error.message);
      imageCourseUrl = supabase.storage.from("courses").getPublicUrl(data.path).data.publicUrl;
    }

    // Insert course
    const { data: courseInserted, error: courseError } = await supabase
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
      .select()
      .single();

    if (courseError) {
      console.error("Erreur course:", courseError);
      return alert("Erreur enregistrement épreuve : " + courseError.message);
    }

    // Insert formats
    for (const format of formats) {
      let imageFormatUrl = null;
      let gpxUrl = null;
      let reglementUrl = null;

      // Image format (optionnelle)
      if (format.imageFile) {
        const { data, error } = await supabase.storage
          .from("formats")
          .upload(`format-${Date.now()}-${format.nom || "sans-nom"}.jpg`, format.imageFile);
        if (!error) {
          imageFormatUrl = supabase.storage.from("formats").getPublicUrl(data.path).data.publicUrl;
        }
      }

      // GPX (optionnel) → champ file = gpx_urlFile
      if (format.gpx_urlFile) {
        const { data, error } = await supabase.storage
          .from("formats")
          .upload(`gpx-${Date.now()}-${format.nom || "sans-nom"}.gpx`, format.gpx_urlFile);
        if (!error) {
          gpxUrl = supabase.storage.from("formats").getPublicUrl(data.path).data.publicUrl;
        }
      }

      // Règlement PDF (optionnel) → champ file = fichier_reglementFile
      if (format.fichier_reglementFile) {
        const { data, error } = await supabase.storage
          .from("reglements")
          .upload(
            `reglement-${Date.now()}-${format.nom || "sans-nom"}.pdf`,
            format.fichier_reglementFile
          );
        if (!error) {
          reglementUrl = supabase.storage
            .from("reglements")
            .getPublicUrl(data.path).data.publicUrl;
        }
      }

      const prix = format.prix ? parseFloat(format.prix) : 0;
      const prix_repas = format.prix_repas ? parseFloat(format.prix_repas) : 0;
      const prix_total_inscription = prix + (parseInt(format.stock_repas) > 0 ? prix_repas : 0);

      const { error: formatError } = await supabase.from("formats").insert({
        course_id: courseInserted.id,
        nom: format.nom || "Format sans nom",
        image_url: imageFormatUrl,
        date: format.date || null,
        heure_depart: format.heure_depart || null,
        presentation_parcours: format.presentation_parcours || null,
        gpx_url: gpxUrl,
        type_epreuve: ["trail", "rando", "route"].includes(format.type_epreuve)
          ? format.type_epreuve
          : "trail",
        distance_km: format.distance_km ? parseFloat(format.distance_km) : null,
        denivele_dplus: format.denivele_dplus ? parseInt(format.denivele_dplus) : null,
        denivele_dmoins: format.denivele_dmoins ? parseInt(format.denivele_dmoins) : null,
        adresse_depart: format.adresse_depart || null,
        adresse_arrivee: format.adresse_arrivee || null,
        prix: prix,
        stock_repas: format.stock_repas ? parseInt(format.stock_repas) : 0,
        prix_repas: prix_repas,
        prix_total_inscription,
        ravitaillements: format.ravitaillements || null,
        remise_dossards: format.remise_dossards || null,
        dotation: format.dotation || null,
        reglement_pdf_url: reglementUrl,
        nb_max_coureurs: format.nb_max_coureurs ? parseInt(format.nb_max_coureurs) : null,
        age_minimum: format.age_minimum ? parseInt(format.age_minimum) : null,
        hebergements: format.hebergements || null,
      });

      if (formatError) {
        console.error("Erreur format:", formatError);
        alert("Erreur enregistrement format : " + formatError.message);
        return;
      }
    }

    alert("Épreuve et formats enregistrés !");
    navigate("/organisateur/mon-espace");
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Header */}
      <section className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-7xl px-4 py-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            Créer une épreuve{" "}
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
                <Input name="nom" placeholder="Ex. Trail des Aiguilles" onChange={handleCourseChange} />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Lieu" required>
                  <Input name="lieu" placeholder="Ex. Chamonix" onChange={handleCourseChange} />
                </Field>
                <Field label="Code postal" required>
                  <Input name="code_postal" placeholder="Ex. 74400" onChange={handleCourseChange} />
                </Field>
              </div>

              <Field label="Département" required>
                <Input name="departement" placeholder="Ex. Haute-Savoie" onChange={handleCourseChange} />
              </Field>

              <Field label="Présentation">
                <Textarea
                  name="presentation"
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
                  Ajoutez un ou plusieurs formats (10K, 21K, 50K, rando, etc.).
                </p>
              </div>
              <button type="button" onClick={addFormat} className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:brightness-110">
                + Ajouter un format
              </button>
            </div>

            <div className="p-5 grid gap-6">
              {formats.map((f, index) => (
                <div key={f.id} className="rounded-xl ring-1 ring-neutral-200 bg-neutral-50 p-4">
                  <div className="grid gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Nom du format" required>
                        <Input name="nom" value={f.nom} onChange={(e) => handleFormatChange(index, e)} placeholder="Ex. 32K Skyrace" />
                      </Field>
                      <Field label="Image du format">
                        <input
                          type="file"
                          name="imageFile"
                          accept="image/*"
                          onChange={(e) => handleFormatChange(index, e)}
                          className="block w-full text-sm text-neutral-700 file:mr-3 file:rounded-xl file:border file:border-neutral-200 file:bg-white file:px-3 file:py-2 hover:file:bg-neutral-50"
                        />
                      </Field>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Field label="Date">
                        <Input type="date" name="date" value={f.date} onChange={(e) => handleFormatChange(index, e)} />
                      </Field>
                      <Field label="Heure de départ">
                        <Input type="time" name="heure_depart" value={f.heure_depart} onChange={(e) => handleFormatChange(index, e)} />
                      </Field>
                      <Field label="Type d'épreuve">
                        <Input name="type_epreuve" value={f.type_epreuve} onChange={(e) => handleFormatChange(index, e)} placeholder="trail | rando | route" />
                      </Field>
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
                        <Input name="distance_km" value={f.distance_km} onChange={(e) => handleFormatChange(index, e)} placeholder="Ex. 32.6" />
                      </Field>
                      <Field label="D+ (m)">
                        <Input name="denivele_dplus" value={f.denivele_dplus} onChange={(e) => handleFormatChange(index, e)} placeholder="Ex. 2630" />
                      </Field>
                      <Field label="D- (m)">
                        <Input name="denivele_dmoins" value={f.denivele_dmoins} onChange={(e) => handleFormatChange(index, e)} placeholder="Ex. 2600" />
                      </Field>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Adresse de départ">
                        <Input name="adresse_depart" value={f.adresse_depart} onChange={(e) => handleFormatChange(index, e)} />
                      </Field>
                      <Field label="Adresse d'arrivée">
                        <Input name="adresse_arrivee" value={f.adresse_arrivee} onChange={(e) => handleFormatChange(index, e)} />
                      </Field>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Field label="Prix (€)">
                        <Input name="prix" value={f.prix} onChange={(e) => handleFormatChange(index, e)} placeholder="Ex. 35" />
                      </Field>
                      <Field label="Stock repas">
                        <Input name="stock_repas" value={f.stock_repas} onChange={(e) => handleFormatChange(index, e)} placeholder="0 si pas de repas" />
                      </Field>
                      {parseInt(f.stock_repas) > 0 && (
                        <Field label="Prix du repas (€)">
                          <Input name="prix_repas" value={f.prix_repas} onChange={(e) => handleFormatChange(index, e)} placeholder="Ex. 10" />
                        </Field>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Field label="Ravitaillements">
                        <Input name="ravitaillements" value={f.ravitaillements} onChange={(e) => handleFormatChange(index, e)} placeholder="Ex. 3 ravitos" />
                      </Field>
                      <Field label="Remise des dossards">
                        <Input name="remise_dossards" value={f.remise_dossards} onChange={(e) => handleFormatChange(index, e)} placeholder="Ex. veille, 16–19h" />
                      </Field>
                      <Field label="Dotation">
                        <Input name="dotation" value={f.dotation} onChange={(e) => handleFormatChange(index, e)} placeholder="Ex. T-shirt finisher" />
                      </Field>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Fichier GPX (trace)">
                        <input
                          type="file"
                          name="gpx_url"
                          accept=".gpx"
                          onChange={(e) => handleFormatChange(index, e)}
                          className="block w-full text-sm text-neutral-700 file:mr-3 file:rounded-xl file:border file:border-neutral-200 file:bg-white file:px-3 file:py-2 hover:file:bg-neutral-50"
                        />
                      </Field>

                      <Field label="Règlement (PDF)">
                        <input
                          type="file"
                          name="fichier_reglement"
                          accept=".pdf"
                          onChange={(e) => handleFormatChange(index, e)}
                          className="block w-full text-sm text-neutral-700 file:mr-3 file:rounded-xl file:border file:border-neutral-200 file:bg-white file:px-3 file:py-2 hover:file:bg-neutral-50"
                        />
                      </Field>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Field label="Nombre max de coureurs">
                        <Input name="nb_max_coureurs" value={f.nb_max_coureurs} onChange={(e) => handleFormatChange(index, e)} placeholder="Ex. 500" />
                      </Field>
                      <Field label="Âge minimum">
                        <Input name="age_minimum" value={f.age_minimum} onChange={(e) => handleFormatChange(index, e)} placeholder="Ex. 18" />
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
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions globales */}
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white hover:brightness-110">
              ✅ Créer l’épreuve
            </button>
            <button type="button" onClick={addFormat} className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-50">
              + Ajouter un format
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- UI helpers ---------- */
function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-neutral-600">{label}{required && " *"}</span>
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
        props.className || ""
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
        props.className || ""
      ].join(" ")}
    />
  );
}
