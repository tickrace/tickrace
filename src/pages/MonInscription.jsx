// src/pages/MonInscription.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../supabase";
import { ArrowLeft, Clock, MapPin, Calendar, Ticket, AlertTriangle } from "lucide-react";

export default function MonInscription() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [insc, setInsc] = useState(null);
  const [course, setCourse] = useState(null);
  const [format, setFormat] = useState(null);
  const [opts, setOpts] = useState([]); // {option_id,label,quantity,unit_cents,total_eur,status}

  const [loading, setLoading] = useState(true);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [credit, setCredit] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);

      // 1) Inscription brute (pas d'embed)
      const { data: ins, error: e1 } = await supabase
        .from("inscriptions")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (e1 || !ins) {
        alert("Impossible de charger l'inscription.");
        navigate("/mesinscriptions");
        return;
      }
      setInsc(ins);

      // 2) Course
      let c = null;
      if (ins.course_id) {
        const { data: cRow } = await supabase
          .from("courses")
          .select("id,nom,lieu,departement")
          .eq("id", ins.course_id)
          .maybeSingle();
        c = cRow || null;
      }
      setCourse(c);

      // 3) Format
      let f = null;
      if (ins.format_id) {
        const { data: fRow } = await supabase
          .from("formats")
          .select("id,nom,date,heure_depart,distance_km,denivele_dplus,denivele_dmoins,type_format,prix,prix_equipe")
          .eq("id", ins.format_id)
          .maybeSingle();
        f = fRow || null;
      }
      setFormat(f);

      // 4) Options : on récupère inscriptions_options puis on résout les labels via options_catalogue
      const { data: ioRows } = await supabase
        .from("inscriptions_options")
        .select("option_id, quantity, prix_unitaire_cents, status")
        .eq("inscription_id", id);

      let out = [];
      if (ioRows && ioRows.length) {
        const optIds = [...new Set(ioRows.map(r => r.option_id).filter(Boolean))];
        let labels = {};
        if (optIds.length) {
          const { data: cat } = await supabase
            .from("options_catalogue")
            .select("id,label,price_cents")
            .in("id", optIds);
          if (cat) {
            for (const o of cat) labels[o.id] = { label: o.label, price_cents: o.price_cents };
          }
        }
        out = ioRows.map(r => {
          const unit = Number(r.prix_unitaire_cents ?? labels[r.option_id]?.price_cents ?? 0);
          return {
            option_id: r.option_id,
            label: labels[r.option_id]?.label || "Option",
            quantity: Number(r.quantity || 0),
            unit_cents: unit,
            total_eur: ((unit * Number(r.quantity || 0)) / 100).toFixed(2),
            status: r.status || "pending",
          };
        });
      }
      setOpts(out);

      setLoading(false);
    })();
  }, [id, navigate]);

  async function reloadOnlyInscription() {
    const { data: ins } = await supabase.from("inscriptions").select("*").eq("id", id).maybeSingle();
    if (ins) setInsc(ins);
  }

  // Annulation via RPC (nom exact du param : p_inscription_id)
  async function handleAnnuler() {
    if (!window.confirm("Confirmer l’annulation de cette inscription ?")) return;
    setCancelLoading(true);
    const { data, error } = await supabase.rpc("calculer_credit_annulation", {
      p_inscription_id: id,
    });
    setCancelLoading(false);
    if (error) {
      console.error(error);
      alert("Impossible d’annuler : " + error.message);
      return;
    }
    const res = Array.isArray(data) ? data[0] : data;
    setCredit(res);
    await reloadOnlyInscription();
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-neutral-600">
        Chargement de votre inscription…
      </div>
    );
  }

  if (!insc) return null;

  const f = format;
  const c = course;

  return (
    <div className="min-h-screen bg-neutral-50 p-4 sm:p-8">
      {/* Retour */}
      <div className="mb-6">
        <Link
          to="/mesinscriptions"
          className="inline-flex items-center gap-2 text-sm font-medium text-neutral-700 hover:text-neutral-900"
        >
          <ArrowLeft size={18} />
          Retour à mes inscriptions
        </Link>
      </div>

      {/* HEADER */}
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-6 mb-8 border border-neutral-200">
        <h1 className="text-2xl font-black text-neutral-900">
          {c?.nom || "Épreuve"}
        </h1>
        <p className="text-neutral-600 mt-1 text-sm">{c?.lieu || "—"}</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="flex items-center gap-2 text-neutral-700">
            <Calendar size={18} />
            <span className="text-sm">{f?.date || "?"}</span>
          </div>
          <div className="flex items-center gap-2 text-neutral-700">
            <Clock size={18} />
            <span className="text-sm">{f?.heure_depart || "--:--"}</span>
          </div>
          <div className="flex items-center gap-2 text-neutral-700">
            <MapPin size={18} />
            <span className="text-sm">{c?.lieu || "—"}</span>
          </div>
          <div className="flex items-center gap-2 text-neutral-700">
            <Ticket size={18} />
            <span className="text-sm font-semibold">{insc.statut}</span>
          </div>
        </div>
      </div>

      {/* BLOC INSCRIPTION */}
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-6 border border-neutral-200">
        <h2 className="text-xl font-bold text-neutral-900 mb-4">
          Détails de votre inscription
        </h2>

        {/* Infos personnelles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <Info label="Nom" value={insc.nom} />
          <Info label="Prénom" value={insc.prenom} />
          <Info label="Email" value={insc.email} />
          <Info label="Téléphone" value={insc.telephone} />
        </div>

        {/* Format */}
        <h3 className="text-lg font-semibold text-neutral-900 mt-6 mb-3">
          Format choisi
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 pl-1">
          <Info label="Format" value={f?.nom} />
          <Info label="Distance" value={f?.distance_km != null ? `${f.distance_km} km` : "—"} />
          <Info label="D+" value={f?.denivele_dplus != null ? `${f.denivele_dplus} m` : "—"} />
        </div>

        {/* Options */}
        {opts.length > 0 && (
          <>
            <h3 className="text-lg font-semibold text-neutral-900 mt-6 mb-3">
              Options choisies
            </h3>
            <div className="space-y-2">
              {opts.map(o => (
                <div
                  key={o.option_id}
                  className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 flex justify-between items-center"
                >
                  <div className="text-sm">
                    <span className="font-medium text-neutral-900">{o.label}</span>
                    <span className="text-neutral-600"> — {o.quantity}×</span>
                    {o.status && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-800">
                        {o.status}
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-neutral-900">
                    {o.total_eur} €
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Statut */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">Statut</h3>
          <div
            className={`inline-block px-4 py-2 rounded-xl text-sm font-semibold
              ${insc.statut === "annulé" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}
          >
            {insc.statut}
          </div>
        </div>

        {/* Bouton annulation */}
        {insc.statut !== "annulé" && (
          <div className="mt-8">
            <button
              onClick={handleAnnuler}
              disabled={cancelLoading}
              className="rounded-xl bg-red-600 text-white text-sm px-5 py-3 font-semibold hover:bg-red-700 disabled:opacity-60 inline-flex items-center gap-2"
            >
              <AlertTriangle size={18} />
              {cancelLoading ? "Annulation…" : "Annuler mon inscription"}
            </button>
          </div>
        )}

        {/* Résultat crédit */}
        {credit && (
          <div className="mt-10 p-5 rounded-xl bg-orange-50 border border-orange-200">
            <h3 className="text-lg font-bold text-neutral-900 mb-3">
              Crédit généré après annulation
            </h3>
            <ul className="text-sm text-neutral-800 space-y-1">
              {"pourcentage" in credit && (
                <li>Pourcentage : {Number(credit.pourcentage) * 100}%</li>
              )}
              {"remboursement_inscription_eur" in credit && (
                <li>Remboursement inscription : {credit.remboursement_inscription_eur} €</li>
              )}
              {"remboursement_repas_eur" in credit && (
                <li>Remboursement repas : {credit.remboursement_repas_eur} €</li>
              )}
              {"frais_annulation_eur" in credit && (
                <li>Frais d'annulation : {credit.frais_annulation_eur} €</li>
              )}
              {"total_credit_eur" in credit && (
                <li className="font-semibold">Crédit total : {credit.total_credit_eur} €</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs font-semibold text-neutral-500">{label}</span>
      <span className="text-sm text-neutral-800 font-medium">{value ?? "—"}</span>
    </div>
  );
}
