// src/pages/InscriptionCourse.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";
import { v4 as uuidv4 } from "uuid";

export default function InscriptionCourse() {
  const { courseId } = useParams();

  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);
  const [selectedFormatId, setSelectedFormatId] = useState("");

  // runners[0] = user connecté (pré-rempli et verrouillé sur coureur_id = user.id)
  // runners[1..n] = autres coureurs (coureur_id = null)
  const [runners, setRunners] = useState([]);
  const [message, setMessage] = useState("");

  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);

  // ----- Chargement course + formats + profil utilisateur -----
  useEffect(() => {
    const load = async () => {
      const session = await supabase.auth.getSession();
      const user = session.data?.session?.user || null;
      setUserId(user?.id || null);

      // 1) Course + formats
      const { data: courseData, error: courseErr } = await supabase
        .from("courses")
        .select(
          "*, formats(id, nom, date, distance_km, denivele_dplus, nb_max_coureurs, stock_repas, prix_repas, prix)"
        )
        .eq("id", courseId)
        .single();

      if (courseErr || !courseData) {
        console.error(courseErr);
        setLoading(false);
        return;
      }

      // Ajoute les compteurs d'inscrits par format
      const formatsWithCount = await Promise.all(
        (courseData.formats || []).map(async (f) => {
          const { count, error: countError } = await supabase
            .from("inscriptions")
            .select("*", { count: "exact", head: true })
            .eq("format_id", f.id);

          return { ...f, inscrits: countError ? 0 : count };
        })
      );

      setCourse(courseData);
      setFormats(formatsWithCount);

      // 2) Profil utilisateur (pour pré-remplir runners[0])
      if (user) {
        const { data: profil, error: profilErr } = await supabase
          .from("profils_utilisateurs")
          .select("*")
          .eq("user_id", user.id)
          .single();

        const ownerRunner = {
          _localId: uuidv4(),
          isOwner: true,
          coureur_id: user.id,
          nom: profil?.nom || "",
          prenom: profil?.prenom || "",
          genre: profil?.genre || "",
          date_naissance: profil?.date_naissance || "",
          nationalite: profil?.nationalite || "",
          email: profil?.email || user.email || "",
          telephone: profil?.telephone || "",
          adresse: profil?.adresse || "",
          adresse_complement: profil?.adresse_complement || "",
          code_postal: profil?.code_postal || "",
          ville: profil?.ville || "",
          pays: profil?.pays || "",
          apparaitre_resultats: profil?.apparaitre_resultats ?? true,
          club: profil?.club || "",
          justificatif_type: profil?.justificatif_type || "",
          numero_licence: profil?.numero_licence || "",
          contact_urgence_nom: profil?.contact_urgence_nom || "",
          contact_urgence_telephone: profil?.contact_urgence_telephone || "",
          nombre_repas: 0,
          prix_total_repas: 0,
          prix_total_coureur: 0,
        };

        setRunners([ownerRunner]);
      } else {
        // Pas connecté => on crée un premier bloc vide, coureur_id = null
        const anonymous = blankRunner();
        anonymous.isOwner = true; // le premier formulaire sera considéré "principal", mais sans coureur_id
        setRunners([anonymous]);
      }

      setLoading(false);
    };

    load();
  }, [courseId]);

  function blankRunner() {
    return {
      _localId: uuidv4(),
      isOwner: false,
      coureur_id: null,
      nom: "",
      prenom: "",
      genre: "",
      date_naissance: "",
      nationalite: "",
      email: "",
      telephone: "",
      adresse: "",
      adresse_complement: "",
      code_postal: "",
      ville: "",
      pays: "",
      apparaitre_resultats: true,
      club: "",
      justificatif_type: "",
      numero_licence: "",
      contact_urgence_nom: "",
      contact_urgence_telephone: "",
      nombre_repas: 0,
      prix_total_repas: 0,
      prix_total_coureur: 0,
    };
  }

  const handleAddRunner = () => {
    setRunners((prev) => [...prev, blankRunner()]);
  };

  const handleRemoveRunner = (id) => {
    setRunners((prev) => prev.filter((r) => r._localId !== id));
  };

  const handleRunnerChange = (id, field, value) => {
    setRunners((prev) =>
      prev.map((r) =>
        r._localId === id
          ? {
              ...r,
              [field]: field === "apparaitre_resultats" ? value === "true" : value,
            }
          : r
      )
    );
  };

  const computeTotals = (runner, format) => {
    const prix_repas = Number(format?.prix_repas || 0);
    const prix = Number(format?.prix || 0);
    const nbRepas = Number(runner.nombre_repas || 0);

    const prix_total_repas = nbRepas * prix_repas;
    const prix_total_coureur = prix + prix_total_repas;
    return { prix_total_repas, prix_total_coureur };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedFormatId) {
      alert("Veuillez sélectionner un format.");
      return;
    }

    const fmt = formats.find((f) => f.id === selectedFormatId);
    if (!fmt) {
      alert("Format invalide.");
      return;
    }

    // Vérifier capacité max
    if (fmt.inscrits + runners.length > fmt.nb_max_coureurs) {
      alert("Le format n'a pas assez de places disponibles pour toutes les personnes.");
      return;
    }

    // Préparer les lignes à insérer
    const payload = runners.map((runner) => {
      const totals = computeTotals(runner, fmt);

      // Si runner.isOwner ET userId existe => coureur_id = userId, sinon null
      const rCoureurId = runner.isOwner && userId ? userId : null;

      return {
        coureur_id: rCoureurId,
        course_id: courseId,
        format_id: selectedFormatId,

        nom: runner.nom,
        prenom: runner.prenom,
        genre: runner.genre,
        date_naissance: runner.date_naissance,
        nationalite: runner.nationalite,
        email: runner.email,
        telephone: runner.telephone,
        adresse: runner.adresse,
        adresse_complement: runner.adresse_complement,
        code_postal: runner.code_postal,
        ville: runner.ville,
        pays: runner.pays,
        apparaitre_resultats: runner.apparaitre_resultats,
        club: runner.club,
        justificatif_type: runner.justificatif_type,
        contact_urgence_nom: runner.contact_urgence_nom,
        contact_urgence_telephone: runner.contact_urgence_telephone,
        numero_licence: runner.numero_licence,

        nombre_repas: Number(runner.nombre_repas || 0),
        prix_total_repas: totals.prix_total_repas,
        prix_total_coureur: totals.prix_total_coureur,
      };
    });

    const { error } = await supabase.from("inscriptions").insert(payload);

    if (error) {
      console.error("Erreur insertion :", error);
      alert("Erreur lors de l'inscription");
      return;
    }

    // Envoi d'email (optionnel) au 1er coureur si connecté
    try {
      if (userId && runners[0]?.email) {
        await fetch(
          "https://pecotcxpcqfkwvyylvjv.functions.supabase.co/send-inscription-email",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_KEY}`,
            },
            body: JSON.stringify({
              email: runners[0].email,
              prenom: runners[0].prenom,
              nom: runners[0].nom,
              format_nom: fmt.nom,
              course_nom: course?.nom,
              date: fmt.date,
            }),
          }
        );
      }
    } catch (e) {
      console.error("Erreur email :", e);
    }

    setMessage("Inscriptions enregistrées ! Vous recevrez un email de confirmation.");
    // Réinitialiser les inscriptions supplémentaires
    setRunners((prev) => (prev.length > 0 ? [prev[0]] : []));
  };

  const selectedFormat = formats.find((f) => f.id === selectedFormatId);

  if (loading) return <div className="p-6">Chargement…</div>;
  if (!course || formats.length === 0) return <div className="p-6">Aucune donnée.</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold mb-4">
        Inscription à : {course.nom}
      </h1>

      {/* Choix du format */}
      <div className="mb-6">
        <label className="block font-semibold mb-1">Choix du format</label>
        <select
          className="border p-2 rounded w-full"
          value={selectedFormatId}
          onChange={(e) => setSelectedFormatId(e.target.value)}
          required
        >
          <option value="">-- Sélectionnez un format --</option>
          {formats.map((f) => (
            <option key={f.id} value={f.id} disabled={f.inscrits >= f.nb_max_coureurs}>
              {f.nom} — {f.date} — {f.distance_km} km / {f.denivele_dplus} m D+ (
              {f.inscrits}/{f.nb_max_coureurs})
            </option>
          ))}
        </select>
      </div>

      {/* Formulaires des coureurs */}
      <form onSubmit={handleSubmit} className="space-y-8">
        {runners.map((r, idx) => {
          const totals = selectedFormat ? computeTotals(r, selectedFormat) : { prix_total_repas: 0, prix_total_coureur: 0 };

          return (
          <div key={r._localId} className="border rounded-lg p-4 md:p-6 bg-white shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg md:text-xl font-semibold">
                {r.isOwner ? "Coureur connecté" : `Coureur supplémentaire #${idx}`}
              </h2>
              {!r.isOwner && (
                <button
                  type="button"
                  onClick={() => handleRemoveRunner(r._localId)}
                  className="text-red-600 text-sm hover:underline"
                >
                  Supprimer
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="border p-2 rounded w-full" placeholder="Nom"
                     value={r.nom} onChange={(e) => handleRunnerChange(r._localId, "nom", e.target.value)} />

              <input className="border p-2 rounded w-full" placeholder="Prénom"
                     value={r.prenom} onChange={(e) => handleRunnerChange(r._localId, "prenom", e.target.value)} />

              <select
                className="border p-2 rounded w-full"
                value={r.genre || ""}
                onChange={(e) => handleRunnerChange(r._localId, "genre", e.target.value)}
              >
                <option value="">Genre</option>
                <option value="H">Homme</option>
                <option value="F">Femme</option>
                <option value="Autre">Autre</option>
              </select>

              <input type="date" className="border p-2 rounded w-full" placeholder="Date de naissance"
                     value={r.date_naissance || ""} onChange={(e) => handleRunnerChange(r._localId, "date_naissance", e.target.value)} />

              <input className="border p-2 rounded w-full" placeholder="Nationalité"
                     value={r.nationalite || ""} onChange={(e) => handleRunnerChange(r._localId, "nationalite", e.target.value)} />

              <input type="email" className="border p-2 rounded w-full" placeholder="Email"
                     value={r.email} onChange={(e) => handleRunnerChange(r._localId, "email", e.target.value)} />

              <input className="border p-2 rounded w-full" placeholder="Téléphone"
                     value={r.telephone || ""} onChange={(e) => handleRunnerChange(r._localId, "telephone", e.target.value)} />

              <input className="border p-2 rounded w-full md:col-span-2" placeholder="Adresse"
                     value={r.adresse || ""} onChange={(e) => handleRunnerChange(r._localId, "adresse", e.target.value)} />

              <input className="border p-2 rounded w-full md:col-span-2" placeholder="Complément d'adresse"
                     value={r.adresse_complement || ""} onChange={(e) => handleRunnerChange(r._localId, "adresse_complement", e.target.value)} />

              <input className="border p-2 rounded w-full" placeholder="Code postal"
                     value={r.code_postal || ""} onChange={(e) => handleRunnerChange(r._localId, "code_postal", e.target.value)} />

              <input className="border p-2 rounded w-full" placeholder="Ville"
                     value={r.ville || ""} onChange={(e) => handleRunnerChange(r._localId, "ville", e.target.value)} />

              <input className="border p-2 rounded w-full" placeholder="Pays"
                     value={r.pays || ""} onChange={(e) => handleRunnerChange(r._localId, "pays", e.target.value)} />

              <select
                className="border p-2 rounded w-full"
                value={r.apparaitre_resultats ? "true" : "false"}
                onChange={(e) =>
                  handleRunnerChange(r._localId, "apparaitre_resultats", e.target.value === "true")
                }
              >
                <option value="true">Apparaître dans les résultats</option>
                <option value="false">Ne pas apparaître dans les résultats</option>
              </select>

              <input className="border p-2 rounded w-full" placeholder="Club"
                     value={r.club || ""} onChange={(e) => handleRunnerChange(r._localId, "club", e.target.value)} />

              <select
                className="border p-2 rounded w-full"
                value={r.justificatif_type || ""}
                onChange={(e) => handleRunnerChange(r._localId, "justificatif_type", e.target.value)}
              >
                <option value="">Justificatif (choisir)</option>
                <option value="licence">Licence</option>
                <option value="certificat">Certificat médical</option>
              </select>

              {r.justificatif_type === "licence" && (
                <input className="border p-2 rounded w-full"
                       placeholder="N° de licence"
                       value={r.numero_licence || ""}
                       onChange={(e) => handleRunnerChange(r._localId, "numero_licence", e.target.value)} />
              )}

              <input className="border p-2 rounded w-full" placeholder="Contact d'urgence - Nom"
                     value={r.contact_urgence_nom || ""}
                     onChange={(e) => handleRunnerChange(r._localId, "contact_urgence_nom", e.target.value)} />

              <input className="border p-2 rounded w-full" placeholder="Contact d'urgence - Téléphone"
                     value={r.contact_urgence_telephone || ""}
                     onChange={(e) => handleRunnerChange(r._localId, "contact_urgence_telephone", e.target.value)} />

              {!!selectedFormat && Number(selectedFormat.stock_repas) > 0 && (
                <>
                  <input
                    type="number"
                    min="0"
                    max={selectedFormat.stock_repas}
                    className="border p-2 rounded w-full"
                    placeholder="Nombre de repas"
                    value={r.nombre_repas}
                    onChange={(e) =>
                      handleRunnerChange(r._localId, "nombre_repas", Number(e.target.value))
                    }
                  />

                  <div className="text-sm text-gray-700 md:col-span-2">
                    Prix unitaire repas : {selectedFormat.prix_repas || 0} € — Total repas :{" "}
                    {totals.prix_total_repas.toFixed(2)} €
                  </div>
                </>
              )}
            </div>

            {!!selectedFormat && (
              <div className="mt-3 text-sm md:text-base font-semibold text-gray-800">
                Prix inscription : {Number(selectedFormat.prix || 0).toFixed(2)} € — Montant total
                coureur : {totals.prix_total_coureur.toFixed(2)} €
              </div>
            )}
          </div>
        )})}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleAddRunner}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Ajouter un(e) coureur(se)
          </button>

          <button
            type="submit"
            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Confirmer les inscriptions
          </button>
        </div>

        {message && (
          <p className="text-green-700 mt-4 font-medium">{message}</p>
        )}
      </form>
    </div>
  );
}
