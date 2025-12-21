// supabase/functions/generate-reglement/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Règlement COMMUN à tous les formats :
 * - answers.global + answers.meta uniquement
 * - answers.formats ignoré (si fourni)
 */
type Answers = {
  global?: Record<string, any>;
  meta?: Record<string, any>;
};

/* ------------------------------- CORS helpers ------------------------------ */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/* --------------------------------- Helpers -------------------------------- */

function safeStr(v: any) {
  return typeof v === "string" ? v.trim() : "";
}

function getAnswer(answers: Answers | null | undefined, key: string) {
  if (!answers) return undefined;
  return answers.global?.[key];
}

function boolish(v: any) {
  return v === true || v === "true" || v === 1;
}

function buildFormatsMarkdown(formats: any[]) {
  if (!formats?.length) return "_Aucun format renseigné._";

  const rows = formats.map((f) => {
    const nom = f.nom ?? "Format";
    const distance = f.distance_km ?? f.distance ?? "—";
    const dplus = f.denivele_positif ?? f.denivele_dplus ?? f.dplus ?? "—";
    const dminus = f.denivele_negatif ?? f.denivele_dmoins ?? f.dminus ?? "—";
    const depart = f.heure_depart ?? f.depart_heure ?? "";

    let prix = "—";
    if (f.prix_total_inscription != null) {
      const n = Number(f.prix_total_inscription);
      prix = Number.isFinite(n) ? `${n.toFixed(2)} €` : "—";
    } else if (f.prix != null) {
      const n = Number(f.prix);
      prix = Number.isFinite(n) ? `${n.toFixed(2)} €` : "—";
    } else if (f.prix_cents != null) {
      const n = Number(f.prix_cents);
      prix = Number.isFinite(n) ? `${(n / 100).toFixed(2)} €` : "—";
    }

    return `| ${nom} | ${distance} | ${dplus} | ${dminus} | ${depart || "—"} | ${prix} |`;
  });

  return [
    "| Format | Distance | D+ | D- | Départ | Tarif |",
    "|---|---:|---:|---:|---|---:|",
    ...rows,
  ].join("\n");
}

function section(title: string, body: string) {
  const b = (body || "").trim();
  if (!b) return "";
  return `\n## ${title}\n\n${b}\n`;
}

function bullet(lines: string[]) {
  const clean = (lines || []).map((s) => String(s || "").trim()).filter(Boolean);
  if (!clean.length) return "";
  return clean.map((l) => `- ${l}`).join("\n");
}

function normalizeAnswers(input: any): Answers {
  // force "global/meta only"
  const global = input?.global && typeof input.global === "object" ? input.global : {};
  const meta = input?.meta && typeof input.meta === "object" ? input.meta : {};
  return { global, meta: { version: meta.version ?? 1, ...meta } };
}

function buildReglementMarkdown(params: { course: any; formats: any[]; answers: Answers }) {
  const { course, formats, answers } = params;

  const courseName =
    safeStr(getAnswer(answers, "general.event_name_override")) ||
    safeStr(course?.nom) ||
    "Règlement";

  const lieu = safeStr(course?.lieu);
  const date = course?.date ? new Date(course.date).toLocaleDateString("fr-FR") : "";
  const orgaName =
    safeStr(getAnswer(answers, "general.organizer_name")) || safeStr(course?.organisateur_nom) || "";

  const contactEmail = safeStr(getAnswer(answers, "general.contact_email"));
  const contactPhone = safeStr(getAnswer(answers, "general.contact_phone"));

  const acceptance = boolish(getAnswer(answers, "general.acceptance_clause"));

  // Formats
  const includeFormats = boolish(getAnswer(answers, "formats.describe_in_reglement"));

  // Participation
  const requireJustif = boolish(getAnswer(answers, "eligibility.require_pps_or_licence"));
  const justifCustom = safeStr(getAnswer(answers, "eligibility.justificatif_rules_text"));
  const responsibility = boolish(getAnswer(answers, "eligibility.responsibility_clause"));
  const noVtt = boolish(getAnswer(answers, "eligibility.no_vtt_pacers"));
  const mutualAid = boolish(getAnswer(answers, "eligibility.mutual_aid"));

  // Horaires / BH
  const canChangeRoute = boolish(getAnswer(answers, "race.route_changes_allowed"));
  const cutoffEnabled = boolish(getAnswer(answers, "race.cutoff_enabled"));
  const cutoffNote = safeStr(getAnswer(answers, "race.cutoff_note"));
  const derouting = boolish(getAnswer(answers, "race.derouting_enabled"));
  const briefing = boolish(getAnswer(answers, "race.briefing_required"));

  // Matériel
  const gearEnabled = boolish(getAnswer(answers, "gear.mandatory_enabled"));
  const gearList = safeStr(getAnswer(answers, "gear.mandatory_list"));
  const gearRecEnabled = boolish(getAnswer(answers, "gear.recommended_enabled"));
  const gearRecList = safeStr(getAnswer(answers, "gear.recommended_list"));
  const weatherMayAdd = boolish(getAnswer(answers, "gear.weather_may_add_mandatory"));
  const ecoCup = boolish(getAnswer(answers, "gear.ecocup_required"));

  // Ravitos / assistance
  const assistOfficialOnly = boolish(getAnswer(answers, "aidstations.official_only"));
  const wildForbidden = boolish(getAnswer(answers, "aidstations.outside_forbidden"));
  const waterNoAssist = boolish(getAnswer(answers, "aidstations.water_points_no_assistance"));
  const selfSuff = boolish(getAnswer(answers, "aidstations.self_sufficiency_note"));
  const waste = boolish(getAnswer(answers, "aidstations.waste_management"));

  // Sécurité
  const abandonReport = boolish(getAnswer(answers, "safety.abandon_must_report"));
  const emergencyProc = boolish(getAnswer(answers, "safety.emergency_procedure"));
  const emergencyPhone = safeStr(getAnswer(answers, "safety.emergency_phone"));
  const medical = boolish(getAnswer(answers, "safety.first_aid_and_evacuations"));

  // Environnement
  const envCharte = boolish(getAnswer(answers, "environment.charte_enabled"));
  const protectedArea = boolish(getAnswer(answers, "environment.protected_area"));
  const protectedLink = safeStr(getAnswer(answers, "environment.protected_area_link"));
  const envDQ = boolish(getAnswer(answers, "environment.disqualification_for_damage"));

  // Classements
  const rankings = boolish(getAnswer(answers, "results.rankings_enabled"));
  const awards = boolish(getAnswer(answers, "results.awards_enabled"));
  const awardsText = safeStr(getAnswer(answers, "results.awards_text"));

  // Sanctions
  const sanctionsTable = boolish(getAnswer(answers, "sanctions.enable_table"));

  // Legal
  const imageRights = boolish(getAnswer(answers, "legal.image_rights_enabled"));
  const rgpd = boolish(getAnswer(answers, "legal.rgpd_enabled"));
  const rgpdEmail = safeStr(getAnswer(answers, "legal.rgpd_contact_email"));

  // Annulation / transfert
  const cancelPolicy = safeStr(getAnswer(answers, "cancellation.policy"));
  const cancelSchedule = safeStr(getAnswer(answers, "cancellation.schedule_text"));
  const bibTransfer = boolish(getAnswer(answers, "bib.transfer_allowed"));
  const bibTransferRules = safeStr(getAnswer(answers, "bib.transfer_rules"));
  const insuranceOffered = boolish(getAnswer(answers, "insurance.cancellation_offered"));
  const insuranceText = safeStr(getAnswer(answers, "insurance.cancellation_text"));

  // Force majeure
  const fm = boolish(getAnswer(answers, "force_majeure.enabled"));
  const fmPartial = boolish(getAnswer(answers, "force_majeure.partial_refund_possible"));

  const headerLines: string[] = [];
  if (acceptance)
    headerLines.push(
      "Toute inscription à l’une des épreuves implique l’acceptation expresse et sans réserve du présent règlement."
    );
  if (orgaName) headerLines.push(`Organisateur : **${orgaName}**.`);
  if (lieu || date) headerLines.push(`Lieu / date : **${[lieu, date].filter(Boolean).join(" • ")}**.`);
  if (contactEmail || contactPhone)
    headerLines.push(`Contact : ${[contactEmail, contactPhone].filter(Boolean).join(" • ")}.`);

  const intro = bullet(headerLines);

  const formatsMd = includeFormats ? section("Épreuves & formats", buildFormatsMarkdown(formats)) : "";

  const participation = section(
    "Conditions de participation",
    bullet([
      responsibility ? "La participation se fait sous l’entière responsabilité des participants." : "",
      requireJustif
        ? justifCustom ||
          "Les participants doivent fournir un justificatif valide (licence / PPS ou équivalent selon la réglementation en vigueur)."
        : "",
      noVtt ? "Les accompagnateurs (VTT, suiveurs) ne sont pas autorisés sur le parcours." : "",
      mutualAid
        ? "Les concurrents se doivent secours et entraide. Tout incident doit être signalé au poste le plus proche."
        : "",
    ])
  );

  const parcours = section(
    "Parcours, horaires et contrôles",
    bullet([
      canChangeRoute
        ? "L’organisateur se réserve le droit de modifier à tout moment le parcours, les horaires et/ou les barrières horaires pour des raisons de sécurité ou de force majeure."
        : "",
      cutoffEnabled
        ? cutoffNote ||
          "Des barrières horaires peuvent être mises en place. Elles sont communiquées aux participants avant l’épreuve."
        : "",
      derouting
        ? "Des itinéraires de délestage (déroutage) peuvent être appliqués aux concurrents attardés, selon décision de la direction de course."
        : "",
      briefing ? "Un briefing d’avant-course peut être organisé pour rappeler les consignes et points clés du règlement." : "",
    ])
  );

  const materiel = section(
    "Matériel",
    bullet([
      ecoCup ? "Éco-tasse obligatoire (zéro gobelet sur les ravitaillements)." : "",
      gearEnabled ? gearList || "Une liste de matériel obligatoire peut être exigée selon les formats et/ou les conditions météo." : "",
      weatherMayAdd
        ? "En fonction des conditions, la direction de course peut rendre obligatoire un équipement complémentaire pour des raisons de sécurité."
        : "",
      gearRecEnabled ? gearRecList || "" : "",
    ])
  );

  const ravitos = section(
    "Ravitaillements et assistance",
    bullet([
      assistOfficialOnly ? "L’assistance est autorisée uniquement sur les zones officielles de ravitaillement." : "",
      wildForbidden ? "Les ravitaillements sauvages sont interdits." : "",
      waterNoAssist ? "Sur les points d’eau, l’assistance est strictement interdite." : "",
      selfSuff ? "Les participants doivent être en capacité d’auto-ravitaillement entre les zones prévues." : "",
      waste
        ? "Les déchets doivent être conservés jusqu’aux zones prévues (ravitaillements/arrivée). Tout jet de détritus est sanctionnable."
        : "",
    ])
  );

  const securite = section(
    "Sécurité, secours et abandon",
    bullet([
      medical ? "Un dispositif de secours/médical est mis en place et adapté à la manifestation." : "",
      abandonReport ? "Tout abandon doit être signalé au plus vite à l’organisation (poste de contrôle, ravitaillement, PC course)." : "",
      emergencyProc
        ? `Procédure d’urgence : prévenir l’organisation${
            emergencyPhone ? ` au **${emergencyPhone}**` : ""
          } et/ou les secours (15/18/112) selon la situation.`
        : "",
    ])
  );

  const environnement = section(
    "Environnement & charte du trailer",
    bullet([
      envCharte
        ? "Respecter la faune et la flore, rester sur les sentiers, ne pas couper les lacets, emporter ses déchets, cohabiter avec les autres usagers."
        : "",
      protectedArea ? `Le parcours traverse une zone faisant l’objet de règles spécifiques${protectedLink ? ` : ${protectedLink}` : "."}` : "",
      envDQ ? "Tout comportement mettant gravement en péril l’environnement peut entraîner une disqualification." : "",
    ])
  );

  const classements = section(
    "Classements & récompenses",
    bullet([
      rankings ? "Un classement scratch et, le cas échéant, par catégorie est établi à l’issue de l’épreuve." : "",
      awards ? awardsText || "Une remise des prix peut être organisée selon les modalités communiquées par l’organisation." : "",
    ])
  );

  const sanctions = sanctionsTable
    ? section(
        "Contrôles & sanctions",
        [
          "La direction de course et ses représentants (chefs de poste, signaleurs, sécurité) veillent au respect du règlement.",
          "",
          "_Le tableau de pénalités peut être précisé par l’organisateur (jet de détritus, assistance hors zone, raccourci, absence matériel, etc.)._",
        ].join("\n")
      )
    : "";

  const legal = section(
    "Droit à l’image & données personnelles",
    bullet([
      imageRights
        ? "En participant, le coureur autorise l’organisateur (et ses partenaires) à utiliser son image/nom/voix dans le cadre de la promotion de l’événement, sur tout support."
        : "",
      rgpd ? `Les données personnelles sont traitées pour gérer les inscriptions et l’organisation de l’épreuve. Contact RGPD : **${rgpdEmail || "à renseigner"}**.` : "",
    ])
  );

  const annulation = section(
    "Annulation, remboursement, transfert de dossard",
    bullet([
      cancelPolicy === "insurance_only"
        ? "Aucun remboursement n’est effectué par l’organisation ; un remboursement peut être possible uniquement via une assurance annulation si elle a été souscrite."
        : cancelPolicy === "schedule"
        ? cancelSchedule || "Un barème de remboursement selon la date d’annulation est appliqué (à préciser)."
        : cancelPolicy === "partial"
        ? "Un remboursement partiel peut être proposé selon les conditions communiquées par l’organisateur."
        : cancelPolicy === "none"
        ? "Aucun remboursement n’est garanti (sauf décision exceptionnelle de l’organisation)."
        : "",
      insuranceOffered ? insuranceText || "Une assurance annulation est proposée au moment de l’inscription selon les conditions de l’assureur." : "",
      bibTransfer
        ? bibTransferRules || "Le transfert de dossard est autorisé selon la procédure et les conditions fixées par l’organisation."
        : "Tout engagement est personnel. Aucun transfert d’inscription n’est autorisé sauf mention contraire.",
    ])
  );

  const forceMajeure = fm
    ? section(
        "Force majeure / modification / annulation de l’épreuve",
        bullet([
          "En cas de force majeure, de conditions mettant en danger la sécurité des participants ou sur décision des autorités, l’organisation peut modifier, reporter ou annuler tout ou partie de l’événement.",
          fmPartial
            ? "Selon les circonstances, un report ou un remboursement partiel peut être proposé, calculé en fonction des frais irrécupérables déjà engagés."
            : "",
        ])
      )
    : "";

  const md =
    `# Règlement — ${courseName}\n\n` +
    (intro ? `${intro}\n` : "") +
    (formatsMd || "") +
    (participation || "") +
    (parcours || "") +
    (materiel || "") +
    (ravitos || "") +
    (securite || "") +
    (environnement || "") +
    (classements || "") +
    (sanctions || "") +
    (legal || "") +
    (annulation || "") +
    (forceMajeure || "") +
    `\n---\n\n_Document généré par Tickrace — l’organisateur peut le compléter et le modifier._\n`;

  return md;
}

/* ---------------------------------- Handler -------------------------------- */

serve(async (req) => {
  // ✅ CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const body = await req.json().catch(() => ({}));
    const course_id: string = body.course_id;

    // ✅ on normalise : uniquement global/meta (formats ignoré)
    const answers_in: Answers | undefined = body.answers ? normalizeAnswers(body.answers) : undefined;

    if (!course_id) {
      return jsonResponse({ error: "course_id manquant" }, 400);
    }

    // Course + formats
    const { data: course, error: courseErr } = await supabase
      .from("courses")
      .select("*")
      .eq("id", course_id)
      .single();

    if (courseErr || !course) {
      return jsonResponse({ error: "course introuvable", details: courseErr?.message }, 404);
    }

    const { data: formats, error: formatsErr } = await supabase
      .from("formats")
      .select("*")
      .eq("course_id", course_id);

    if (formatsErr) {
      // on continue quand même, mais sans formats
      // (ça n'empêche pas de générer un règlement)
    }

    // Charger ou upsert un draft reglement
    const { data: reglementExisting } = await supabase
      .from("reglements")
      .select("*")
      .eq("course_id", course_id)
      .maybeSingle();

    const existingAnswers = reglementExisting?.answers ? normalizeAnswers(reglementExisting.answers) : undefined;

    const answers: Answers = answers_in || existingAnswers || { global: {}, meta: { version: 1 } };

    const md = buildReglementMarkdown({
      course,
      formats: formats || [],
      answers,
    });

    // Upsert reglement draft
    const payload = {
      course_id,
      status: "draft",
      answers, // ✅ uniquement global/meta
      generated_md: md,
    };

    const { data: upserted, error: upErr } = await supabase
      .from("reglements")
      .upsert(payload, { onConflict: "course_id" })
      .select("*")
      .single();

    if (upErr) {
      return jsonResponse({ error: "upsert reglement échoué", details: upErr.message }, 400);
    }

    return jsonResponse({ ok: true, reglement: upserted, markdown: md }, 200);
  } catch (e) {
    return jsonResponse({ error: "Erreur interne", details: String(e) }, 500);
  }
});
