// src/pages/ModifierCourse.jsx
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import { useNavigate, useParams } from "react-router-dom";
// On essaie d'utiliser uuid si dispo, sinon fallback vers crypto.randomUUID
let uuidv4;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  uuidv4 = require("uuid").v4;
} catch {
  uuidv4 = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
}

export default function ModifierCourse() {
  const { id } = useParams(); // id de la course
  const navigate = useNavigate();

  // -------- States course (alignés avec NouvelleCourse) --------
  const [course, setCourse] = useState({
    nom: "",
    lieu: "",
    departement: "",
    code_postal: "",
    presentation: "",
    imageFile: null, // fichier sélectionné
    image_url: null, // URL existante (affichage)
  });

  // -------- States formats (alignés avec NouvelleCourse) --------
  const [formats, setFormats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const initialFormatIdsRef = useRef(new Set()); // pour détecter ceux supprimés

  // ---------- Helpers ----------
  const handleCourseChange = (e) => {
    const { name, value, files } = e.target;
    setCourse((prev) => ({
      ...prev,
      [name + (files ? "File" : "")]: files ? files[0] : value,
    }));
  };

  const handleFormatChange = (index, e) => {
    const { name, value, files } = e.target;
    setFormats((prev) => {
      const next = [...prev];
      next[index][name + (files ? "File" : "")] = files ? files[0] : value;
      return next;
    });
  };

  const addFormat = () => {
    setFormats((prev) => [
      ...prev,
      {
        id_local: uuidv4(), // id local pour la key React (ne pas confondre avec id DB)
        id: null, // si null => nouvel insert
        nom: "",
        imageFile: null,
        image_url: null,

        date: "",
        heure_depart: "",
        presentation_parcours: "",
        gpx_urlFile: null,
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
        prix_total_inscription: null,

        ravitaillements: "",
        remise_dossards: "",
        dotation: "",

        fichier_reglementFile: null,
        reglement_pdf_url: null,

        nb_max_coureurs: "",
        age_minimum: "",
        hebergements: "",
      },
    ]);
  };

  const removeFormat = (idx) => {
    setFormats((prev) => prev.filter((_, i) => i !== idx));
  };

  // ---------- Nominatim géocodage ----------
  async function getLatLngFromPostalCode(codePostal, ville) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(
          codePostal || ""
        )}&city=${encodeURIComponent(ville || "")}&country=France&format=json&limit=1`
      );
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    } catch (err) {
      console.error("Erreur géocodage :", err);
    }
    return { lat: null, lng: null };
  }

  // ---------- Fetch course + formats ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Course
        const { data: cData, error: cErr } = await supabase
          .from("courses")
          .select("*")
          .eq("id", id)
          .single();

        if (cErr) throw cErr;
        if (!cData) throw new Error("Épreuve introuvable.");

        setCourse((prev) => ({
          ...prev,
          nom: cData.nom || "",
          lieu: cData.lieu || "",
          departement: cData.departement || "",
          code_postal: cData.code_postal || "",
          presentation: cData.presentation || "",
          image_url: cData.image_url || null,
          imageFile: null,
          // lat/lng conservés côté DB; on les recalculera si besoin
        }));

        // Formats
        const { data: fData, error: fErr } = await supabase
          .from("formats")
          .select("*")
          .eq("course_id", id)
          .order("date", { ascending: true });

        if (fErr) throw fErr;

        const hydrated = (fData || []).map((f) => ({
          id_local: uuidv4(),
          id: f.id, // id DB
          nom: f.nom || "",
          imageFile: null,
          image_url: f.image_url || null,

          date: f.date || "",
          heure_depart: f.heure_depart || "",
          presentation_parcours: f.presentation_parcours || "",
          gpx_urlFile: null,
          gpx_url: f.gpx_url || null,

          type_epreuve: f.type_epreuve || "trail",
          distance_km: f.distance_km ?? "",
          denivele_dplus: f.denivele_dplus ?? "",
          denivele_dmoins: f.denivele_dmoins ?? "",
          adresse_depart: f.adresse_depart || "",
          adresse_arrivee: f.adresse_arrivee || "",

          prix: f.prix ?? "",
          stock_repas: f.stock_repas ?? "",
          prix_repas: f.prix_repas ?? "",
          prix_total_inscription: f.prix_total_inscription ?? null,

          ravitaillements: f.ravitaillements || "",
          remise_dossards: f.remise_dossards || "",
          dotation: f.dotation || "",

          fichier_reglementFile: null,
          reglement_pdf_url: f.reglement_pdf_url || null,

          nb_max_coureurs: f.nb_max_coureurs ?? "",
          age_minimum: f.age_minimum ?? "",
          hebergements: f.hebergements || "",
        }));

        if (!cancelled) {
          setFormats(hydrated);
          initialFormatIdsRef.current = new Set(hydrated.filter((x) => !!x.id).map((x) => x.id));
        }
      } catch (e) {
        console.error(e);
        alert(e.message || "Erreur de chargement.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  // ---------- Save handler ----------
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) {
        alert("Utilisateur non connecté.");
        setSaving(false);
        return;
      }

      // Re-géocode (comme NouvelleCourse)
      const { lat, lng } = await getLatLngFromPostalCode(course.code_postal, course.lieu);

      // Upload image de la course si modifiée
      let imageCourseUrl = course.image_url || null;
      if (course.imageFile) {
        const uploadPath = `course-${Date.now()}.jpg`;
        const { data, error } = await supabase.storage.from("courses").upload(uploadPath, course.imageFile);
        if (error) throw new Error("Erreur upload image course : " + error.message);
        imageCourseUrl = supabase.storage.from("courses").getPublicUrl(data.path).data.publicUrl;
      }

      // Update course
      const { error: cErr } = await supabase
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
          organisateur_id: userId, // on conserve
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (cErr) throw cErr;

      // --- Insert/Update formats ---
      const payloadInserts = [];
      const payloadUpdates = [];
      const currentIds = new Set();

      for (const f of formats) {
        // Uploads si nouveaux fichiers
        let imageFormatUrl = f.image_url || null;
        if (f.imageFile) {
          const { data, error } = await supabase.storage
            .from("formats")
            .upload(`format-${Date.now()}-${(f.nom || "format").replace(/\s+/g, "-")}.jpg`, f.imageFile);
          if (!error) {
            imageFormatUrl = supabase.storage.from("formats").getPublicUrl(data.path).data.publicUrl;
          }
        }

        let gpxUrl = f.gpx_url || null;
        if (f.gpx_urlFile) {
          const { data, error } = await supabase.storage
            .from("formats")
            .upload(`gpx-${Date.now()}-${(f.nom || "format").replace(/\s+/g, "-")}.gpx`, f.gpx_urlFile);
          if (!error) {
            gpxUrl = supabase.storage.from("formats").getPublicUrl(data.path).data.publicUrl;
          }
        }

        let reglementUrl = f.reglement_pdf_url || null;
        if (f.fichier_reglementFile) {
          const { data, error } = await supabase.storage
            .from("reglements")
            .upload(`reglement-${Date.now()}-${(f.nom || "format").replace(/\s+/g, "-")}.pdf`, f.fichier_reglementFile);
          if (!error) {
            reglementUrl = supabase.storage.from("reglements").getPublicUrl(data.path).data.publicUrl;
          }
        }

        const prix = f.prix ? parseFloat(f.prix) : 0;
        const prix_repas = f.prix_repas ? parseFloat(f.prix_repas) : 0;
        const prix_total_inscription = prix + (parseInt(f.stock_repas || "0", 10) > 0 ? prix_repas : 0);

        const common = {
          course_id: id,
          nom: f.nom || "Format sans nom",
          image_url: imageFormatUrl,
          date: f.date || null,
          heure_depart: f.heure_depart || null,
          presentation_parcours: f.presentation_parcours || null,
          gpx_url: gpxUrl,
          type_epreuve: ["trail", "rando", "route"].includes(f.type_epreuve) ? f.type_epreuve : "trail",
          distance_km: f.distance_km !== "" && f.distance_km != null ? parseFloat(f.distance_km) : null,
          denivele_dplus: f.denivele_dplus !== "" && f.denivele_dplus != null ? parseInt(f.denivele_dplus, 10) : null,
          denivele_dmoins: f.denivele_dmoins !== "" && f.denivele_dmoins != null ? parseInt(f.denivele_dmoins, 10) : null,
          adresse_depart: f.adresse_depart || null,
          adresse_arrivee: f.adresse_arrivee || null,
          prix,
          stock_repas: f.stock_repas !== "" && f.stock_repas != null ? parseInt(f.stock_repas, 10) : 0,
          prix_repas,
          prix_total_inscription,
          ravitaillements: f.ravitaillements || null,
          remise_dossards: f.remise_dossards || null,
          dotation: f.dotation || null,
          reglement_pdf_url: reglementUrl,
          nb_max_coureurs: f.nb_max_coureurs !== "" && f.nb_max_coureurs != null ? parseInt(f.nb_max_coureurs, 10) : null,
          age_minimum: f.age_minimum !== "" && f.age_minimum != null ? parseInt(f.age_minimum, 10) : null,
          hebergements: f.hebergements || null,
        };

        if (f.id) {
          // update
          currentIds.add(f.id);
          payloadUpdates.push({ id: f.id, ...common });
        } else {
          // insert
          payloadInserts.push(common);
        }
      }

      if (payloadUpdates.length > 0) {
        const { error: upErr } = await supabase.from("formats").upsert(payloadUpdates, { onConflict: "id" });
        if (upErr) throw upErr;
      }
      if (payloadInserts.length > 0) {
        const { error: insErr } = await supabase.from("formats").insert(payloadInserts);
        if (insErr) throw insErr;
      }

      // --- Delete formats supprimés ---
      const toDelete = [...initialFormatIdsRef.current].filter((fid) => !currentIds.has(fid));
      if (toDelete.length > 0) {
        const { error: delErr } = await supabase.from("formats").delete().in("id", toDelete);
        if (delErr) throw delErr;
      }

      alert("Épreuve et formats mis à jour !");
      navigate("/organisateur/mon-espace");
    } catch (err) {
      console.error(err);
      alert(err.message || "Erreur lors de l’enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Chargement…</h1>
        <p>Récupération de l’épreuve #{id}</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Modifier l’épreuve</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Champs course (identiques à NouvelleCourse) */}
        <input
          name="nom"
          placeholder="Nom de l'épreuve"
          value={course.nom}
          onChange={handleCourseChange}
          className="border p-2 w-full"
        />
        <input
          name="lieu"
          placeholder="Lieu"
          value={course.lieu}
          onChange={handleCourseChange}
          className="border p-2 w-full"
        />
        <input
          name="code_postal"
          placeholder="Code postal"
          value={course.code_postal}
          onChange={handleCourseChange}
          className="border p-2 w-full"
        />
        <input
          name="departement"
          placeholder="Département"
          value={course.departement}
          onChange={handleCourseChange}
          className="border p-2 w-full"
        />
        <textarea
          name="presentation"
          placeholder="Présentation"
          value={course.presentation}
          onChange={handleCourseChange}
          className="border p-2 w-full"
        />
        <label className="block">
          Image de l’épreuve :
          <input type="file" name="image" accept="image/*" onChange={handleCourseChange} />
        </label>
        {course.image_url && (
          <div className="mt-2">
            <img
              src={course.image_url}
              alt="course"
              className="w-full max-w-xl rounded border"
              style={{ objectFit: "cover" }}
            />
          </div>
        )}

        {/* Formats */}
        <h2 className="text-xl font-semibold mt-6">Formats de course</h2>

        {formats.map((f, index) => (
          <div key={f.id || f.id_local} className="border p-4 my-4 space-y-2 bg-gray-50 rounded">
            <div className="flex items-center justify-between">
              <strong>Format {index + 1}</strong>
              <button type="button" className="text-red-600" onClick={() => removeFormat(index)}>
                Supprimer
              </button>
            </div>

            <input
              name="nom"
              placeholder="Nom du format"
              value={f.nom}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
            />

            <label className="block">
              Image du format :
              <input type="file" name="image" accept="image/*" onChange={(e) => handleFormatChange(index, e)} />
            </label>
            {f.image_url && (
              <img
                src={f.image_url}
                alt="format"
                className="w-full max-w-xl rounded border"
                style={{ objectFit: "cover" }}
              />
            )}

            <input
              type="date"
              name="date"
              value={f.date || ""}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
            />
            <input
              type="time"
              name="heure_depart"
              value={f.heure_depart || ""}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
            />
            <textarea
              name="presentation_parcours"
              placeholder="Présentation du parcours"
              value={f.presentation_parcours}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
            />

            <label className="block">
              Fichier GPX (trace du parcours) :
              <input type="file" name="gpx_url" accept=".gpx" onChange={(e) => handleFormatChange(index, e)} />
            </label>
            {f.gpx_url && (
              <a
                className="text-blue-600 underline text-sm"
                href={f.gpx_url}
                target="_blank"
                rel="noreferrer"
              >
                Voir le GPX actuel
              </a>
            )}

            <input
              name="type_epreuve"
              placeholder="Type d'épreuve (trail, rando, route)"
              value={f.type_epreuve}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
            />
            <input
              name="distance_km"
              placeholder="Distance (km)"
              value={f.distance_km}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
            />
            <input
              name="denivele_dplus"
              placeholder="D+"
              value={f.denivele_dplus}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
            />
            <input
              name="denivele_dmoins"
              placeholder="D-"
              value={f.denivele_dmoins}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
            />
            <input
              name="adresse_depart"
              placeholder="Adresse de départ"
              value={f.adresse_depart}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
            />
            <input
              name="adresse_arrivee"
              placeholder="Adresse d'arrivée"
              value={f.adresse_arrivee}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
            />

            <input
              name="prix"
              placeholder="Prix (€)"
              value={f.prix}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
            />

            <input
              name="stock_repas"
              placeholder="Nombre total de repas, mettre 0 si pas de repas"
              value={f.stock_repas}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
            />
            {parseInt(f.stock_repas || "0", 10) > 0 && (
              <input
                name="prix_repas"
                placeholder="Prix d’un repas (€)"
                value={f.prix_repas}
                onChange={(e) => handleFormatChange(index, e)}
                className="border p-2 w-full"
              />
            )}

            <input
              name="ravitaillements"
              placeholder="Ravitaillements"
              value={f.ravitaillements}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
            />
            <input
              name="remise_dossards"
              placeholder="Remise des dossards"
              value={f.remise_dossards}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
            />
            <input
              name="dotation"
              placeholder="Dotation"
              value={f.dotation}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
            />

            <label className="block">
              Règlement (PDF) :
              <input type="file" name="fichier_reglement" accept=".pdf" onChange={(e) => handleFormatChange(index, e)} />
            </label>
            {f.reglement_pdf_url && (
              <a
                className="text-blue-600 underline text-sm"
                href={f.reglement_pdf_url}
                target="_blank"
                rel="noreferrer"
              >
                Voir le règlement actuel
              </a>
            )}

            <input
              name="nb_max_coureurs"
              placeholder="Nombre max de coureurs"
              value={f.nb_max_coureurs}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
            />
            <input
              name="age_minimum"
              placeholder="Âge minimum"
              value={f.age_minimum}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
            />
            <textarea
              name="hebergements"
              placeholder="Hébergements"
              value={f.hebergements}
              onChange={(e) => handleFormatChange(index, e)}
              className="border p-2 w-full"
            />
          </div>
        ))}

        <button type="button" onClick={addFormat} className="bg-blue-600 text-white px-4 py-2 rounded">
          + Ajouter un format
        </button>

        <button type="submit" disabled={saving} className="bg-green-600 text-white px-4 py-2 rounded">
          {saving ? "Enregistrement…" : "💾 Enregistrer les modifications"}
        </button>
      </form>
    </div>
  );
}
