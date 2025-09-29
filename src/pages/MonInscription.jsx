import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../supabase";

export default function MonInscription() {
  const { inscriptionId } = useParams();
  const [loading, setLoading] = useState(true);
  const [insc, setInsc] = useState(null);
  const [format, setFormat] = useState(null);
  const [course, setCourse] = useState(null);
  const [options, setOptions] = useState([]);

  useEffect(() => {
    if (!inscriptionId) return;
    (async () => {
      setLoading(true);

      // Inscription
      const { data: i, error } = await supabase
        .from("inscriptions")
        .select("*")
        .eq("id", inscriptionId)
        .maybeSingle();
      if (error || !i) {
        setInsc(null);
        setFormat(null);
        setCourse(null);
        setOptions([]);
        setLoading(false);
        return;
      }
      setInsc(i);

      // Format + course
      if (i.format_id) {
        const { data: f } = await supabase
          .from("formats")
          .select("*")
          .eq("id", i.format_id)
          .maybeSingle();
        setFormat(f || null);

        if (f?.course_id) {
          const { data: c } = await supabase
            .from("courses")
            .select("*")
            .eq("id", f.course_id)
            .maybeSingle();
          setCourse(c || null);
        }
      }

      // Options confirmées
      const { data: opts } = await supabase
        .from("inscriptions_options")
        .select("quantity, prix_unitaire_cents, status, options_catalogue(label, description)")
        .eq("inscription_id", inscriptionId)
        .eq("status", "confirmed");
      setOptions(opts || []);

      setLoading(false);
    })();
  }, [inscriptionId]);

  const totalOptionsEur = useMemo(() => {
    return (options || []).reduce(
      (acc, o) => acc + Number(o.quantity || 0) * Number(o.prix_unitaire_cents || 0),
      0
    ) / 100;
  }, [options]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="h-6 w-64 bg-neutral-200 rounded animate-pulse mb-4" />
        <div className="h-24 bg-neutral-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!insc) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <p className="text-neutral-600">Inscription introuvable.</p>
        <Link to="/" className="text-orange-700 hover:underline">← Retour à l’accueil</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Link to="/" className="text-sm text-neutral-500 hover:text-neutral-800">← Accueil</Link>

      <h1 className="text-2xl sm:text-3xl font-bold mt-2">Mon inscription</h1>
      <p className="text-neutral-600 mt-1">
        {course?.nom ? `${course.nom}` : "—"}{format?.nom ? ` • ${format.nom}` : ""}
      </p>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Carte état & identité */}
        <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="p-5 border-b border-neutral-100">
            <h2 className="text-lg font-semibold">Détails</h2>
          </div>
          <div className="p-5 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-neutral-600">N° d’inscription</span>
              <span className="font-medium">{insc.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-600">État</span>
              <span className="font-medium">
                {insc.statut === "validé" ? "✅ Validée" :
                 insc.statut === "en attente" ? "⏳ En attente de paiement" :
                 insc.statut === "annulé" ? "❌ Annulée" : insc.statut || "—"}
              </span>
            </div>
            <div className="h-px bg-neutral-200 my-2" />
            <div>{insc.prenom} {insc.nom}</div>
            <div className="text-neutral-600">
              {insc.email || "—"}{insc.club ? ` • ${insc.club}` : ""}
            </div>
          </div>
        </section>

        {/* Carte Options */}
        <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="p-5 border-b border-neutral-100">
            <h2 className="text-lg font-semibold">Options confirmées</h2>
          </div>
          <div className="p-5 text-sm">
            {options.length === 0 ? (
              <div className="text-neutral-600">Aucune option confirmée.</div>
            ) : (
              <ul className="space-y-2">
                {options.map((o, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{o.options_catalogue?.label || "Option"}</div>
                      {o.options_catalogue?.description && (
                        <div className="text-neutral-600">{o.options_catalogue.description}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div>× {o.quantity}</div>
                      <div className="text-neutral-600">
                        {(Number(o.prix_unitaire_cents || 0) / 100).toFixed(2)} €
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {options.length > 0 && (
              <div className="mt-3 pt-3 border-t flex justify-between font-semibold">
                <span>Total options</span>
                <span>{totalOptionsEur.toFixed(2)} €</span>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Aide */}
      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white shadow-sm p-5 text-sm text-neutral-700">
        Besoin d’aide ? Contactez l’organisateur de l’épreuve depuis la page course.
      </div>
    </div>
  );
}
