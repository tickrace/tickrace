// src/pages/Merci.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "../supabase";

export default function Merci() {
  const [sp] = useSearchParams();
  const sessionId = sp.get("session_id");
  const inscriptionId = sp.get("inscription_id");

  const [verifying, setVerifying] = useState(true);
  const [verifyErr, setVerifyErr] = useState(null);
  const [inscription, setInscription] = useState(null);

  // Vérifie la session de paiement côté edge + charge le récap
  useEffect(() => {
    let abort = false;
    (async () => {
      if (!sessionId || !inscriptionId) {
        setVerifying(false);
        setVerifyErr("Paramètres manquants.");
        return;
      }
      try {
        setVerifying(true);
        setVerifyErr(null);

        // 1) Vérification Stripe Checkout (serveur)
        const { error } = await supabase.functions.invoke("verify-checkout-session", {
          body: { session_id: sessionId, inscription_id: inscriptionId },
        });
        if (error) throw new Error(error.message || "Erreur de vérification.");

        // 2) Récup détail inscription pour l’affichage
        const { data, error: fetchErr } = await supabase
          .from("inscriptions")
          .select(`
            *,
            format:format_id (
              id, nom, date, heure_depart, distance_km, denivele_dplus,
              course:course_id ( id, nom, lieu, departement, image_url )
            )
          `)
          .eq("id", inscriptionId)
          .maybeSingle();

        if (fetchErr) throw new Error(fetchErr.message);
        if (!abort) setInscription(data || null);
      } catch (e) {
        if (!abort) setVerifyErr(e?.message ?? String(e));
      } finally {
        if (!abort) setVerifying(false);
      }
    })();
    return () => { abort = true; };
  }, [sessionId, inscriptionId]);

  const course = inscription?.format?.course || null;
  const format = inscription?.format || null;

  const fmtDate = (d) =>
    d
      ? new Intl.DateTimeFormat("fr-FR", {
          weekday: "short",
          day: "2-digit",
          month: "long",
          year: "numeric",
        }).format(typeof d === "string" ? new Date(d) : d)
      : "";

  const qrUrl = useMemo(() => {
    const url = `${window.location.origin}/mon-inscription/${inscriptionId ?? ""}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(url)}`;
  }, [inscriptionId]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Bandeau / hero compact */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-neutral-900 text-white px-3 py-1 text-[11px] ring-1 ring-black/10">
          Paiement confirmé
        </div>
        <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900">
          Merci pour ton inscription 🎉
        </h1>
        <p className="mt-2 text-neutral-600">
          Prépare tes chaussures —{" "}
          <span className="font-semibold text-orange-600">
            on s’occupe de tout le reste
          </span>
          .
        </p>
      </div>

      {/* Carte principale */}
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        {/* Illustration course */}
        <div className="relative">
          {course?.image_url ? (
            <img
              src={course.image_url}
              alt={`Image de ${course?.nom}`}
              className="h-44 w-full object-cover"
            />
          ) : (
            <div className="h-28 w-full bg-neutral-100" />
          )}
          {format?.date && (
            <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 text-[12px] font-semibold ring-1 ring-neutral-200">
              {fmtDate(format.date)}{format?.heure_depart ? ` • ${format.heure_depart}` : ""}
            </span>
          )}
        </div>

        {/* Contenu */}
        <div className="p-5">
          {/* États */}
          {verifying ? (
            <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
              Vérification de votre paiement…
            </div>
          ) : verifyErr ? (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              {verifyErr}
            </div>
          ) : (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              Inscription validée ! Un e-mail de confirmation a été envoyé.
            </div>
          )}

          {/* Résumé inscription */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Info label="Épreuve" value={course?.nom || "—"} />
            <Info label="Lieu" value={course ? `${course.lieu} (${course.departement})` : "—"} />
            <Info label="Format" value={format?.nom || "—"} />
            <Info
              label="Distance / D+"
              value={
                format
                  ? `${Number(format.distance_km || 0)} km • ${Number(format.denivele_dplus || 0)} m D+`
                  : "—"
              }
            />
            <Info label="Nom" value={`${inscription?.prenom ?? "—"} ${inscription?.nom ?? ""}`} />
            <Info label="E-mail" value={inscription?.email || "—"} />
          </div>

          {/* QR + CTA */}
          <div className="mt-5 flex flex-col sm:flex-row items-center gap-4">
            <div className="rounded-xl border border-neutral-200 p-3">
              <img
                src={qrUrl}
                alt="QR vers mon inscription"
                width={160}
                height={160}
                className="block"
                loading="lazy"
              />
            </div>
            <div className="flex-1">
              <p className="text-sm text-neutral-600">
                Garde ce QR : il pointe vers le récapitulatif de ton inscription.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to={`/mon-inscription/${inscriptionId || ""}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
                >
                  Voir / modifier mon inscription
                </Link>
                <Link
                  to="/courses"
                  className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
                >
                  Découvrir d’autres courses
                </Link>
                {course?.id && (
                  <Link
                    to={`/courses/${course.id}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
                  >
                    Voir la page de l’épreuve
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Aide / support */}
          <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-sm text-neutral-700">
              Besoin d’aide ? Contacte l’organisateur depuis la page de l’épreuve
              ou écris-nous : <a className="underline" href="mailto:support@tickrace.app">support@tickrace.app</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ——— Petits sous-composants ——— */
function Info({ label, value }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3">
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className="text-sm font-semibold text-neutral-900">{value}</div>
    </div>
  );
}
