// src/pages/InscriptionCourse.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../supabase";
import { v4 as uuidv4 } from "uuid";

export default function InscriptionCourse() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Inscription unique (on ne gère plus le groupé)
  const [inscription, setInscription] = useState(defaultCoureur());

  useEffect(() => {
    let mounted = true;

    async function fetchAll() {
      setLoading(true);

      // 1) Course + formats
      const { data, error } = await supabase
        .from("courses")
        .select(
          "*, formats(id, nom, prix, date, distance_km, denivele_dplus, nb_max_coureurs, stock_repas, prix_repas)"
        )
        .eq("id", courseId)
        .single();

      if (!mounted) return;

      if (!error && data) {
        // Compte inscrits par format
        const withCounts = await Promise.all(
          (data.formats || []).map(async (f) => {
            const { count } = await supabase
              .from("inscriptions")
              .select("*", { count: "exact", head: true })
              .eq("format_id", f.id);
            return { ...f, inscrits: count || 0 };
          })
        );
        setCourse(data);
        setFormats(withCounts);
      }

      // 2) Préremplir avec le profil s’il existe
      const session = await supabase.auth.getSession();
      const user = session.data?.session?.user;
      if (user) {
        const { data: profil } = await supabase
          .from("profils_utilisateurs")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profil) {
          const prefill = {
            ...defaultCoureur(),
            nom: profil.nom ?? "",
            prenom: profil.prenom ?? "",
            email: profil.email ?? user.email ?? "",
            genre: profil.genre ?? "",
            date_naissance: profil.date_naissance ?? "",
            nationalite: profil.nationalite ?? "",
            telephone: profil.telephone ?? "",
            adresse: profil.adresse ?? "",
            adresse_complement: profil.adresse_complement ?? "",
            code_postal: profil.code_postal ?? "",
            ville: profil.ville ?? "",
            pays: profil.pays ?? "",
            apparaitre_resultats:
              typeof profil.apparaitre_resultats === "boolean"
                ? profil.apparaitre_resultats
                : true,
            club: profil.club ?? "",
            justificatif_type: profil.justificatif_type ?? "",
            numero_licence: profil.numero_licence ?? "",
            pps_identifier: profil.pps_identifier ?? "",
            contact_urgence_nom: profil.contact_urgence_nom ?? "",
            contact_urgence_telephone: profil.contact_urgence_telephone ?? "",
            coureur_id: user.id,
            prix_total_coureur: 0,
          };
          setInscription(prefill);
        }
      }

      setLoading(false);
    }

    fetchAll();
    return () => {
      mounted = false;
    };
  }, [courseId]);

  // --- helpers ---
  function defaultCoureur() {
    return {
      coureur_id: null,
      format_id: "",
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
      pps_identifier: "",
      contact_urgence_nom: "",
      contact_urgence_telephone: "",
      nombre_repas: 0,
      prix_total_repas: 0,
      prix_total_coureur: 0,
    };
  }

  const selectedFormat = useMemo(
    () => formats.find((f) => f.id === inscription.format_id),
    [formats, inscription.format_id]
  );

  // recalculer prix quand format / nombre_repas change
  useEffect(() => {
    if (!selectedFormat) {
      setInscription((p) => ({ ...p, prix_total_repas: 0, prix_total_coureur: 0 }));
      return;
    }
    const prixRepas = Number(selectedFormat.prix_repas || 0);
    const prixInscription = Number(selectedFormat.prix || 0);
    const totalRepas = prixRepas * Number(inscription.nombre_repas || 0);
    const total = prixInscription + totalRepas;

    setInscription((prev) => ({
      ...prev,
      prix_total_repas: totalRepas,
      prix_total_coureur: total,
    }));
  }, [selectedFormat, inscription.nombre_repas]);

  function setField(name, value) {
    setInscription((prev) => ({ ...prev, [name]: value }));
  }

  // bouton principal
  async function handlePay() {
    if (submitting) return;
    setSubmitting(true);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const user = sess?.session?.user;

      if (!user) {
        alert("Veuillez vous connecter pour effectuer le paiement.");
        setSubmitting(false);
        return;
      }

      if (!inscription.format_id) {
        alert("Veuillez sélectionner un format.");
        setSubmitting(false);
        return;
      }

      if (selectedFormat?.inscrits >= selectedFormat?.nb_max_coureurs) {
        alert(`Le format ${selectedFormat.nom} est complet.`);
        setSubmitting(false);
        return;
      }

      // 0) Générer un trace_id
      const trace_id = uuidv4();
      console.log("🧭 TRACE_ID (client) :", trace_id);

      // 1) Insérer l’inscription en “en attente”
      const { data: inserted, error: insertErr } = await supabase
        .from("inscriptions")
        .insert([
          {
            ...inscription,
            course_id: courseId,
            format_id: inscription.format_id,
            statut: "en attente",
            paiement_trace_id: trace_id,
          },
        ])
        .select()
        .single();

      if (insertErr || !inserted) {
        console.error("❌ Erreur insertion inscription :", insertErr);
        alert("Erreur lors de l'enregistrement de l'inscription.");
        setSubmitting(false);
        return;
      }

      // 2) Email payeur
      const payerEmail =
        inscription.email ||
        user.email ||
        user.user_metadata?.email ||
        "";
      if (!payerEmail) {
        alert("Veuillez renseigner un email.");
        setSubmitting(false);
        return;
      }

      // 3) Montant
      const prixTotal = Number(inserted.prix_total_coureur || 0);

      // 4) Create Checkout Session
      const { data, error: fnError } = await supabase.functions.invoke(
        "create-checkout-session",
        {
          body: {
            user_id: user.id,
            course_id: courseId,
            prix_total: prixTotal,
            inscription_id: inserted.id,
            email: payerEmail,
            trace_id, // pour recoller dans le webhook
            successUrl: "https://www.tickrace.com/merci",
            cancelUrl: "https://www.tickrace.com/paiement-annule",
          },
        }
      );

      if (fnError) {
        console.error("❌ create-checkout-session error:", fnError);
        alert("Erreur lors de la création du paiement.");
        setSubmitting(false);
        return;
      }

      if (!data?.url) {
        console.error("❌ Pas d'URL de session renvoyée :", data);
        alert("Erreur lors de la création du paiement (pas d'URL).");
        setSubmitting(false);
        return;
      }

      window.location.href = data.url;
    } finally {
      // on laisse submitting à true jusqu’à la redirection
    }
  }

  // --- UI ---
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="h-7 w-64 bg-neutral-200 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-48 bg-neutral-100 rounded-2xl animate-pulse" />
            <div className="h-48 bg-neutral-100 rounded-2xl animate-pulse" />
          </div>
          <div className="h-64 bg-neutral-100 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!course || formats.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <p className="text-neutral-600">Aucun format disponible pour cette course.</p>
      </div>
    );
  }

  const placesRestantes =
    selectedFormat
      ? Math.max(
          0,
          Number(selectedFormat.nb_max_coureurs || 0) -
            Number(selectedFormat.inscrits || 0)
        )
      : null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link to={`/courses/${courseId}`} className="text-sm text-neutral-500 hover:text-neutral-800">
            ← Retour à la course
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold mt-1">{course.nom}</h1>
          <p className="text-neutral-600 mt-1">Inscription individuelle</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne formulaire */}
        <div className="lg:col-span-2 space-y-6">
          {/* Carte Format */}
          <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="p-5 border-b border-neutral-100">
              <h2 className="text-lg font-semibold">Choix du format</h2>
              <p className="text-sm text-neutral-500">
                Sélectionne le format. La capacité affichée tient compte des inscriptions existantes.
              </p>
            </div>
            <div className="p-5 space-y-3">
              <label className="block text-sm font-medium mb-1">Format</label>
              <select
                name="format_id"
                value={inscription.format_id}
                onChange={(e) => setField("format_id", e.target.value)}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:ring-2 focus:ring-black"
                required
              >
                <option value="">-- Sélectionnez un format --</option>
                {formats.map((f) => {
                  const full = Number(f.inscrits) >= Number(f.nb_max_coureurs || 0);
                  return (
                    <option key={f.id} value={f.id} disabled={full}>
                      {f.nom} — {f.date} — {f.distance_km} km / {f.denivele_dplus} m D+{" "}
                      {full ? " (complet)" : ""}
                    </option>
                  );
                })}
              </select>

              {selectedFormat && (
                <div className="text-sm text-neutral-600">
                  Capacité : {selectedFormat.inscrits}/{selectedFormat.nb_max_coureurs} —{" "}
                  <span className="font-medium">
                    {placesRestantes} place{placesRestantes > 1 ? "s" : ""} restante
                    {placesRestantes > 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Carte Infos coureur */}
          <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="p-5 border-b border-neutral-100">
              <h2 className="text-lg font-semibold">Informations coureur</h2>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  className="rounded-xl border border-neutral-300 px-3 py-2"
                  name="nom"
                  placeholder="Nom"
                  value={inscription.nom}
                  onChange={(e) => setField("nom", e.target.value)}
                />
                <input
                  className="rounded-xl border border-neutral-300 px-3 py-2"
                  name="prenom"
                  placeholder="Prénom"
                  value={inscription.prenom}
                  onChange={(e) => setField("prenom", e.target.value)}
                />
                <select
                  className="rounded-xl border border-neutral-300 px-3 py-2"
                  name="genre"
                  value={inscription.genre}
                  onChange={(e) => setField("genre", e.target.value)}
                >
                  <option value="">Genre</option>
                  <option value="Homme">Homme</option>
                  <option value="Femme">Femme</option>
                </select>
                <input
                  type="date"
                  className="rounded-xl border border-neutral-300 px-3 py-2"
                  name="date_naissance"
                  value={inscription.date_naissance}
                  onChange={(e) => setField("date_naissance", e.target.value)}
                />
                <input
                  className="rounded-xl border border-neutral-300 px-3 py-2"
                  name="nationalite"
                  placeholder="Nationalité"
                  value={inscription.nationalite}
                  onChange={(e) => setField("nationalite", e.target.value)}
                />
                <input
                  className="rounded-xl border border-neutral-300 px-3 py-2"
                  name="email"
                  placeholder="Email"
                  value={inscription.email}
                  onChange={(e) => setField("email", e.target.value)}
                />
                <input
                  className="rounded-xl border border-neutral-300 px-3 py-2"
                  name="telephone"
                  placeholder="Téléphone"
                  value={inscription.telephone}
                  onChange={(e) => setField("telephone", e.target.value)}
                />
                <input
                  className="rounded-xl border border-neutral-300 px-3 py-2 md:col-span-2"
                  name="adresse"
                  placeholder="Adresse"
                  value={inscription.adresse}
                  onChange={(e) => setField("adresse", e.target.value)}
                />
                <input
                  className="rounded-xl border border-neutral-300 px-3 py-2"
                  name="adresse_complement"
                  placeholder="Complément adresse"
                  value={inscription.adresse_complement}
                  onChange={(e) => setField("adresse_complement", e.target.value)}
                />
                <input
                  className="rounded-xl border border-neutral-300 px-3 py-2"
                  name="code_postal"
                  placeholder="Code postal"
                  value={inscription.code_postal}
                  onChange={(e) => setField("code_postal", e.target.value)}
                />
                <input
                  className="rounded-xl border border-neutral-300 px-3 py-2"
                  name="ville"
                  placeholder="Ville"
                  value={inscription.ville}
                  onChange={(e) => setField("ville", e.target.value)}
                />
                <input
                  className="rounded-xl border border-neutral-300 px-3 py-2"
                  name="pays"
                  placeholder="Pays"
                  value={inscription.pays}
                  onChange={(e) => setField("pays", e.target.value)}
                />
                <input
                  className="rounded-xl border border-neutral-300 px-3 py-2"
                  name="club"
                  placeholder="Club"
                  value={inscription.club}
                  onChange={(e) => setField("club", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Affichage des résultats</p>
                <div className="flex gap-4 text-sm text-neutral-700">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="apparaitre_resultats"
                      checked={inscription.apparaitre_resultats === true}
                      onChange={() => setField("apparaitre_resultats", true)}
                    />
                    Oui
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="apparaitre_resultats"
                      checked={inscription.apparaitre_resultats === false}
                      onChange={() => setField("apparaitre_resultats", false)}
                    />
                    Non
                  </label>
                </div>
              </div>
            </div>
          </section>

          {/* Carte Justificatif */}
          <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="p-5 border-b border-neutral-100">
              <h2 className="text-lg font-semibold">Justificatif</h2>
            </div>
            <div className="p-5 space-y-3">
              <select
                name="justificatif_type"
                value={inscription.justificatif_type}
                onChange={(e) => setField("justificatif_type", e.target.value)}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:ring-2 focus:ring-black"
              >
                <option value="">-- Sélectionnez --</option>
                <option value="licence">Licence FFA</option>
                <option value="pps">PPS (Parcours Prévention Santé)</option>
              </select>

              {inscription.justificatif_type === "licence" && (
                <input
                  className="rounded-xl border border-neutral-300 px-3 py-2 w-full"
                  name="numero_licence"
                  placeholder="Numéro de licence"
                  value={inscription.numero_licence}
                  onChange={(e) => setField("numero_licence", e.target.value)}
                />
              )}

              {inscription.justificatif_type === "pps" && (
                <input
                  className="rounded-xl border border-neutral-300 px-3 py-2 w-full"
                  name="pps_identifier"
                  placeholder="Identifiant PPS"
                  value={inscription.pps_identifier}
                  onChange={(e) => setField("pps_identifier", e.target.value)}
                />
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                <input
                  className="rounded-xl border border-neutral-300 px-3 py-2"
                  name="contact_urgence_nom"
                  placeholder="Contact urgence - Nom"
                  value={inscription.contact_urgence_nom}
                  onChange={(e) => setField("contact_urgence_nom", e.target.value)}
                />
                <input
                  className="rounded-xl border border-neutral-300 px-3 py-2"
                  name="contact_urgence_telephone"
                  placeholder="Contact urgence - Téléphone"
                  value={inscription.contact_urgence_telephone}
                  onChange={(e) => setField("contact_urgence_telephone", e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Carte Repas (si disponible sur le format) */}
          {selectedFormat && Number(selectedFormat.stock_repas) > 0 && (
            <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="p-5 border-b border-neutral-100">
                <h2 className="text-lg font-semibold">Repas</h2>
              </div>
              <div className="p-5 space-y-2">
                <label className="text-sm font-medium">
                  Nombre de repas (max {selectedFormat.stock_repas})
                </label>
                <input
                  type="number"
                  min="0"
                  max={selectedFormat.stock_repas}
                  name="nombre_repas"
                  value={inscription.nombre_repas}
                  onChange={(e) => setField("nombre_repas", Number(e.target.value))}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                />
                <p className="text-sm text-neutral-600">
                  Prix unitaire : {Number(selectedFormat.prix_repas || 0).toFixed(2)} € — Total repas :{" "}
                  {Number(inscription.prix_total_repas || 0).toFixed(2)} €
                </p>
              </div>
            </section>
          )}
        </div>

        {/* Colonne résumé / paiement */}
        <aside className="lg:col-span-1">
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm sticky top-6">
            <div className="p-5 border-b border-neutral-100">
              <h3 className="text-lg font-semibold">Résumé</h3>
              <p className="text-sm text-neutral-500">Vérifie les informations puis procède au paiement.</p>
            </div>

            <div className="p-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-600">Format</span>
                <span className="font-medium">
                  {selectedFormat ? selectedFormat.nom : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Inscription</span>
                <span className="font-medium">
                  {selectedFormat ? Number(selectedFormat.prix || 0).toFixed(2) : "0.00"} €
                </span>
              </div>
              {selectedFormat && Number(selectedFormat.stock_repas) > 0 && (
                <div className="flex justify-between">
                  <span className="text-neutral-600">
                    Repas × {Number(inscription.nombre_repas || 0)}
                  </span>
                  <span className="font-medium">
                    {Number(inscription.prix_total_repas || 0).toFixed(2)} €
                  </span>
                </div>
              )}

              <div className="h-px bg-neutral-200 my-2" />

              <div className="flex justify-between text-base">
                <span className="font-semibold">Total</span>
                <span className="font-bold">
                  {Number(inscription.prix_total_coureur || 0).toFixed(2)} €
                </span>
              </div>
            </div>

            <div className="p-5">
              <button
                type="button"
                onClick={handlePay}
                disabled={
                  submitting ||
                  !inscription.format_id ||
                  (selectedFormat && selectedFormat.inscrits >= selectedFormat.nb_max_coureurs)
                }
                className={`w-full rounded-xl px-4 py-3 text-white font-semibold transition
                  ${
                    submitting
                      ? "bg-neutral-400 cursor-not-allowed"
                      : "bg-neutral-900 hover:bg-black"
                  }`}
              >
                {submitting ? "Redirection vers Stripe…" : "Confirmer et payer"}
              </button>

              {selectedFormat && selectedFormat.inscrits >= selectedFormat.nb_max_coureurs && (
                <p className="text-xs text-red-600 mt-2">Ce format est complet.</p>
              )}

              <p className="text-xs text-neutral-500 mt-3">
                En confirmant, vous acceptez les conditions de l’épreuve et de Tickrace.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
