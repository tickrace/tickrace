// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno&deno-std=0.192.0&pin=v135";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1?target=deno&deno-std=0.192.0&pin=v135";

console.log("BUILD create-checkout-session 2025-09-22T21:00Z (no-meals, capacity-annulé, CORS+OPTIONS)");

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-04-10" });
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const ALLOWLIST = ["https://www.tickrace.com","http://localhost:5173","http://127.0.0.1:5173"];
function buildCorsHeaders(req: Request) {
  const origin = req.headers.get("origin");
  const allowOrigin = origin && ALLOWLIST.includes(origin) ? origin : ALLOWLIST[0];
  const reqMethod = req.headers.get("access-control-request-method") || "POST";
  const reqHeaders =
    req.headers.get("access-control-request-headers") ||
    "authorization, x-client-info, apikey, content-type, prefer";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": `${reqMethod}, OPTIONS`,
    "Access-Control-Allow-Headers": reqHeaders,
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
  };
}
const isUUID = (v: unknown) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v as string);

serve(async (req) => {
  const headers = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405, headers });

  try {
    const body = await req.json();

    // Champs communs / front
    const {
      user_id, course_id, email, successUrl, cancelUrl, trace_id: traceIn,
      // Individuel
      prix_total,               // ignoré (on recalcule serveur)
      inscription_id,
      // Équipes
      mode,                     // 'individuel' | 'groupe' | 'relais'
      format_id,
      team_name, team_size, members,
      teams,                    // [{ team_name, team_size, members: [...] }]
      // optionnel pour groupes/relais (si tu veux compter des options)
      options_total_eur
    } = body ?? {};

    if (!isUUID(user_id) || !isUUID(course_id) || !email) {
      return new Response(JSON.stringify({ error: "Paramètres invalides (user_id/course_id/email)" }), { status: 400, headers });
    }

    const trace_id = isUUID(traceIn) ? traceIn : crypto.randomUUID();

    // Organisateur -> compte connecté
    const { data: course, error: cErr } = await supabase
      .from("courses").select("organisateur_id, nom").eq("id", course_id).single();
    if (cErr || !course) return new Response(JSON.stringify({ error: "Course introuvable" }), { status: 404, headers });

    const { data: profil, error: pErr } = await supabase
      .from("profils_utilisateurs").select("stripe_account_id").eq("user_id", course.organisateur_id).maybeSingle();
    if (pErr) return new Response(JSON.stringify({ error: "Erreur lecture profil" }), { status: 500, headers });
    const destinationAccount = profil?.stripe_account_id ?? null;
    if (!destinationAccount) {
      return new Response(JSON.stringify({ error: "Organisateur non configuré Stripe", code: "ORGANISER_STRIPE_NOT_CONFIGURED" }), { status: 409, headers });
    }

    // ========== INDIVIDUEL ==========
    if (!mode || mode === "individuel") {
      if (!isUUID(inscription_id)) {
        return new Response(JSON.stringify({ error: "inscription_id manquant (individuel)" }), { status: 400, headers });
      }

      // 1) Lire l'inscription + format
      const { data: insc, error: insErr } = await supabase
        .from("inscriptions")
        .select("id, format_id")
        .eq("id", inscription_id)
        .single();
      if (insErr || !insc) return new Response(JSON.stringify({ error: "Inscription introuvable" }), { status: 404, headers });

      const { data: fmt, error: fErr } = await supabase
        .from("formats")
        .select("id, nom, prix")
        .eq("id", insc.format_id)
        .single();
      if (fErr || !fmt) return new Response(JSON.stringify({ error: "Format introuvable" }), { status: 404, headers });

      // 2) Recalcul serveur (anti-fraude) — REPAS SUPPRIMÉS
      //const baseEuros = Number(fmt.prix || 0);
// 2) Recalcul serveur (anti-fraude) — base hors options
     const baseEuros = Number(fmt.prix || 0) + Number(insc.nombre_repas || 0) * Number(fmt.prix_repas || 0);
      const baseCents = Math.round(baseEuros * 100);
      // 3) Total options (inscriptions_options en "pending")
      const { data: optsRows } = await supabase
        .from("inscriptions_options")
        .select("quantity, prix_unitaire_cents")
        .eq("inscription_id", inscription_id)
        .eq("status", "pending");

      const optionsCents = (optsRows || []).reduce((acc, r) => {
        const q = Number(r.quantity || 0);
        const pu = Number(r.prix_unitaire_cents || 0);
        return acc + q * pu;
      }, 0);

      //const unitAmount = Math.round(baseEuros * 100) + optionsCents;
      // 3b) Fallback: si aucune ligne en base, on prend la valeur envoyée par le front
     const extraFromClientCents = Math.max(0, Math.round(Number(options_total_eur || 0) * 100));
      const totalOptionsCents = optionsCents > 0 ? optionsCents : extraFromClientCents;

      const unitAmount = baseCents + totalOptionsCents;
      
      
      
      
      if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
        return new Response(JSON.stringify({ error: "Montant invalide (individuel)" }), { status: 400, headers });
      }

      // Pré-insert paiement
      await supabase.from("inscriptions").update({ paiement_trace_id: trace_id }).eq("id", inscription_id);
      await supabase.from("paiements").insert({
        inscription_id, user_id, montant_total: unitAmount / 100, devise: "eur",
        status: "created", type: "individuel", inscription_ids: [inscription_id],
        trace_id, amount_subtotal: unitAmount, amount_total: unitAmount,
       // destination_account_id: destinationAccount
       destination_account_id: destinationAccount,
        // pour audit / debugging
        options_total_eur: totalOptionsCents / 100,
      });

      const metadata: Record<string,string> = {
        inscription_id: String(inscription_id),
        user_id: String(user_id),
        course_id: String(course_id),
        trace_id,
        mode: "individuel",
      };

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{
          price_data: { currency: "eur", product_data: { name: `Inscription (${fmt.nom})` }, unit_amount: unitAmount },
          quantity: 1,
        }],
        customer_email: String(email),
        client_reference_id: trace_id,
        payment_intent_data: { transfer_group: `grp_${trace_id}`, metadata },
        success_url: (successUrl || "https://www.tickrace.com/merci")
          + "?session_id={CHECKOUT_SESSION_ID}&inscription_id=" + inscription_id + "&trace_id=" + trace_id,
        cancel_url: (cancelUrl || "https://www.tickrace.com/paiement-annule")
          + "?session_id={CHECKOUT_SESSION_ID}&inscription_id=" + inscription_id + "&trace_id=" + trace_id,
        metadata,
      });

      return new Response(JSON.stringify({ url: session.url, trace_id }), { status: 200, headers });
    }

    // ========== GROUPE / RELAIS ==========
    if (!isUUID(format_id)) {
      return new Response(JSON.stringify({ error: "format_id requis pour groupe/relais" }), { status: 400, headers });
    }
    if (!(mode === "groupe" || mode === "relais")) {
      return new Response(JSON.stringify({ error: "mode invalide (attendu: groupe|relais)" }), { status: 400, headers });
    }

    // Lecture format
    const { data: formatRow, error: fErr } = await supabase
      .from("formats")
      .select("id, nom, prix, prix_equipe, nb_max_coureurs, inscription_ouverture, inscription_fermeture, waitlist_enabled, team_size, nb_coureurs_min, nb_coureurs_max")
      .eq("id", format_id).single();
    if (fErr || !formatRow) return new Response(JSON.stringify({ error: "Format introuvable" }), { status: 404, headers });

    // Fenêtre d’inscription
    const now = new Date();
    const openAt = formatRow.inscription_ouverture ? new Date(formatRow.inscription_ouverture) : null;
    const closeAt = formatRow.inscription_fermeture ? new Date(formatRow.inscription_fermeture) : null;
    if (openAt && now < openAt) return new Response(JSON.stringify({ error: "Inscriptions non ouvertes" }), { status: 403, headers });
    if (closeAt && now > closeAt) return new Response(JSON.stringify({ error: "Inscriptions fermées" }), { status: 403, headers });

    // Normaliser équipes
    const normalizedTeams = Array.isArray(teams) && teams.length > 0
      ? teams
      : [{ team_name: team_name || "Équipe", team_size: Number(team_size || formatRow.team_size || 0), members: Array.isArray(members) ? members : [] }];

    // Validation rapide
    for (const t of normalizedTeams) {
      const size = Number(t.team_size || 0);
      if (!t.team_name || size <= 0) {
        return new Response(JSON.stringify({ error: "Chaque équipe doit avoir un nom et une taille > 0" }), { status: 400, headers });
      }
      if (!Array.isArray(t.members) || t.members.length !== size) {
        return new Response(JSON.stringify({ error: `L'équipe "${t.team_name}" doit avoir ${size} membres` }), { status: 400, headers });
      }
      const bad = t.members.find((m: any) => !m?.nom?.trim() || !m?.prenom?.trim());
      if (bad) {
        return new Response(JSON.stringify({ error: `L'équipe "${t.team_name}" a un membre sans nom/prénom` }), { status: 400, headers });
      }
    }

    // Capacité
    const { count: currentCount } = await supabase
      .from("inscriptions")
      .select("*", { count: "exact", head: true })
      .eq("format_id", format_id)
      .neq("statut", "annulé"); // <— correction d’orthographe
    const toAdd = normalizedTeams.reduce((acc: number, t: any) => acc + Number(t.team_size || 0), 0);
    const maxCap = Number(formatRow.nb_max_coureurs || 0) || Infinity;
    if ((currentCount || 0) + toAdd > maxCap && !formatRow.waitlist_enabled) {
      return new Response(JSON.stringify({ error: "Capacité atteinte (pas de liste d’attente)" }), { status: 409, headers });
    }

    // Total = coureurs + frais d’équipe + (optionnel) options_total_eur
    const pricePerRunner = Number(formatRow.prix || 0);
    const teamFee = Number(formatRow.prix_equipe || 0) || 0;
    const totalBaseEuros = normalizedTeams.reduce((sum: number, t: any) => sum + (Number(t.team_size || 0) * pricePerRunner + teamFee), 0);
    const extraOptionsEuros = Number(options_total_eur || 0);
    const unitAmount = Math.round((totalBaseEuros + extraOptionsEuros) * 100);
    if (unitAmount <= 0) return new Response(JSON.stringify({ error: "Montant total invalide" }), { status: 400, headers });

    // Créer groupes + inscriptions en attente
    const inscriptionIds: string[] = [];
    const groupIds: string[] = [];
    for (const t of normalizedTeams) {
      const { data: grp, error: gErr } = await supabase
        .from("inscriptions_groupes")
        .insert({
          format_id,
          nom_groupe: t.team_name,
          team_size: Number(t.team_size || 0),
          capitaine_user_id: user_id,
          statut: "en_attente",
          invitation_token: crypto.randomUUID(),
        })
        .select()
        .single();
      if (gErr || !grp) return new Response(JSON.stringify({ error: "Erreur création groupe" }), { status: 500, headers });
      groupIds.push(grp.id);

      for (const m of t.members) {
        const { data: insc, error: iErr } = await supabase
          .from("inscriptions")
          .insert({
            course_id,
            format_id,
            groupe_id: grp.id,
            coureur_id: null,
            nom: m.nom,
            prenom: m.prenom,
            email: m.email || email,
            statut: "en attente",
            prix_total_coureur: pricePerRunner,
          })
          .select()
          .single();
        if (iErr || !insc) return new Response(JSON.stringify({ error: "Erreur création inscription membre" }), { status: 500, headers });
        inscriptionIds.push(insc.id);
      }
    }

    // Pré-insert paiement
    await supabase.from("paiements").insert({
      inscription_id: null,
      user_id,
      montant_total: unitAmount / 100,
      devise: "eur",
      status: "created",
      type: mode, // 'groupe' | 'relais'
      inscription_ids: inscriptionIds,
      trace_id,
      amount_subtotal: unitAmount,
      amount_total: unitAmount,
      destination_account_id: destinationAccount,
      options_total_eur: extraOptionsEuros,
    });

    const metadata: Record<string,string> = {
      user_id: String(user_id),
      course_id: String(course_id),
      format_id: String(format_id),
      trace_id,
      mode,
      multi: Array.isArray(teams) && teams.length > 1 ? "1" : "0",
      group_ids: groupIds.join(","),
      inscription_ids: inscriptionIds.join(","),
      options_total_eur: String(extraOptionsEuros || 0),
    };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price_data: { currency: "eur", product_data: { name: mode === "relais" ? "Inscription relais (équipe)" : "Inscription groupe (équipe)" }, unit_amount: unitAmount },
        quantity: 1,
      }],
      customer_email: String(email),
      client_reference_id: trace_id,
      payment_intent_data: { transfer_group: `grp_${trace_id}`, metadata },
      success_url: (successUrl || "https://www.tickrace.com/merci")
        + "?session_id={CHECKOUT_SESSION_ID}&trace_id=" + trace_id,
      cancel_url: (cancelUrl || "https://www.tickrace.com/paiement-annule")
        + "?session_id={CHECKOUT_SESSION_ID}&trace_id=" + trace_id,
      metadata,
    });

    return new Response(JSON.stringify({ url: session.url, trace_id }), { status: 200, headers });
  } catch (e: any) {
    console.error("create-checkout-session (SCT) error:", e?.message ?? e, e?.stack);
    const debug = Deno.env.get("DEBUG") === "1";
    return new Response(JSON.stringify({ error: debug ? (e?.message ?? "Erreur serveur") : "Erreur serveur" }), { status: 500, headers });
  }
});
