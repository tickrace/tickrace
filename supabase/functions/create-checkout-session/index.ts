// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno&deno-std=0.192.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-04-10" });
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// --- CORS identique à ta version ---
const ALLOWLIST = ["https://www.tickrace.com","http://localhost:5173","http://127.0.0.1:5173"];
const cors = (o: string | null) => ({
  "Access-Control-Allow-Origin": (o && ALLOWLIST.includes(o)) ? o : ALLOWLIST[0],
  "Vary": "Origin",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
});
const isUUID = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v as string);

// Petite vue util si présente dans ta base (voir message précédent)
type VFormatStats = { format_id: string; confirmed_count: number; waitlist_count: number; cancelled_count: number };

serve(async (req) => {
  const headers = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405, headers });

  try {
    // ---- Payload ----
    const body = await req.json();

    // Commun
    const {
      user_id, course_id, email, successUrl, cancelUrl, trace_id: traceIn,
      // Individuel (legacy)
      inscription_id, prix_total,
      // Nouveaux pour groupe/relais
      mode = "individuel",              // 'individuel' | 'groupe' | 'relais'
      format_id,                         // requis pour groupe/relais
      team_size,                         // requis pour groupe/relais (si non précisé -> fallback formats.team_size)
      team_name,                         // optionnel
      groupe_id: groupeIdIn              // optionnel: si un groupe existe déjà
    } = body ?? {};

    // --- Validations basiques ---
    if (!isUUID(user_id) || !isUUID(course_id) || !email) {
      return new Response(JSON.stringify({ error: "Paramètres invalides (user_id/course_id/email)" }), { status: 400, headers });
    }

    // Récup organiser -> compte connecté (destination du transfer J+1)
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

    const trace_id = isUUID(traceIn) ? traceIn : crypto.randomUUID();

    // ===============================
    // MODE INDIVIDUEL (comportement inchangé)
    // ===============================
    if (mode === "individuel") {
      if (!isUUID(inscription_id)) {
        return new Response(JSON.stringify({ error: "inscription_id manquant (individuel)" }), { status: 400, headers });
      }
      const prixNumber = Number(prix_total);
      const unitAmount = Number.isFinite(prixNumber) ? Math.round(prixNumber * 100) : NaN;
      if (!Number.isFinite(prixNumber) || unitAmount <= 0) {
        return new Response(JSON.stringify({ error: "prix_total invalide" }), { status: 400, headers });
      }

      // Marquer l'inscription + pré-insert paiement
      await supabase.from("inscriptions").update({ paiement_trace_id: trace_id }).eq("id", inscription_id);
      await supabase.from("paiements").insert({
        inscription_id, user_id, montant_total: prixNumber, devise: "eur",
        status: "created", type: "individuel", inscription_ids: [inscription_id],
        trace_id, amount_subtotal: unitAmount, amount_total: unitAmount,
        destination_account_id: destinationAccount
      });

      const metadata = {
        mode: "individuel",
        inscription_id: String(inscription_id),
        user_id: String(user_id),
        course_id: String(course_id),
        prix_total: String(prix_total),
        trace_id,
      };

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "eur",
            product_data: { name: "Inscription à la course" },
            unit_amount: unitAmount,
          },
          quantity: 1,
        }],
        customer_email: String(email),
        payment_intent_data: {
          transfer_group: `grp_${trace_id}`,
          metadata,
        },
        success_url: (successUrl || "https://www.tickrace.com/merci") + "?session_id={CHECKOUT_SESSION_ID}&inscription_id=" + inscription_id,
        cancel_url: (cancelUrl || "https://www.tickrace.com/paiement-annule") + "?session_id={CHECKOUT_SESSION_ID}&inscription_id=" + inscription_id,
        metadata,
      });

      return new Response(JSON.stringify({ url: session.url, trace_id }), { status: 200, headers });
    }

    // =======================================
    // MODES GROUPE / RELAIS (nouveaux)
    // =======================================
    // Requiert un format_id
    if (!isUUID(format_id)) {
      return new Response(JSON.stringify({ error: "format_id manquant (groupe/relais)" }), { status: 400, headers });
    }

    // Charge le format
    const { data: f, error: fErr } = await supabase.from("formats").select("*").eq("id", format_id).single();
    if (fErr || !f) return new Response(JSON.stringify({ error: "Format introuvable" }), { status: 404, headers });

    // Fenêtre d’inscriptions
    const now = new Date();
    if (f.inscription_ouverture && new Date(f.inscription_ouverture) > now)
      return new Response(JSON.stringify({ error: "registration_not_open" }), { status: 400, headers });
    if (f.inscription_fermeture && new Date(f.inscription_fermeture) < now)
      return new Response(JSON.stringify({ error: "registration_closed" }), { status: 400, headers });

    // Capacité
    let qty = Number.isFinite(Number(team_size)) && Number(team_size) > 0 ? Number(team_size) : (f.team_size || 1);
    if (f.nb_max_coureurs) {
      const { data: stats } = await supabase.from<VFormatStats>("v_format_stats").select("*").eq("format_id", format_id).maybeSingle();
      const confirmed = stats?.confirmed_count ?? 0;
      // Si pas de waitlist, bloquer si dépassement
      if (confirmed + qty > f.nb_max_coureurs && !f.waitlist_enabled) {
        return new Response(JSON.stringify({ error: "sold_out" }), { status: 400, headers });
      }
    }

    // Prix calculé côté serveur (sécurisé)
    const unitAmount = Math.round(Number(f.prix || 0) * 100);
    if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
      return new Response(JSON.stringify({ error: "Format sans prix" }), { status: 400, headers });
    }
    const equipeAmount = f.prix_equipe ? Math.round(Number(f.prix_equipe) * 100) : 0;
    const totalCents = unitAmount * qty + equipeAmount;

    // Créer/valider le groupe (table existante `inscriptions_groupes`)
    let groupe_id = isUUID(groupeIdIn) ? groupeIdIn : null;
    if (!groupe_id) {
      const { data: grp, error: gErr } = await supabase
        .from("inscriptions_groupes")
        .insert({
          format_id,
          nom_groupe: team_name || "Équipe",
          team_size: qty,
          capitaine_user_id: user_id,
          statut: "en_attente",         // sera mis à 'paye' au webhook
        })
        .select("id")
        .single();
      if (gErr) return new Response(JSON.stringify({ error: "Erreur création groupe" }), { status: 500, headers });
      groupe_id = grp.id;
    }

    // Pré-insert paiement (type groupe)
    await supabase.from("paiements").insert({
      inscription_id: null,
      user_id,
      montant_total: totalCents / 100,
      devise: "eur",
      status: "created",
      type: "groupe",                // ou 'relais' si tu veux distinguer (facultatif)
      inscription_ids: [],           // les inscriptions seront créées au webhook
      trace_id,
      amount_subtotal: totalCents,
      amount_total: totalCents,
      destination_account_id: destinationAccount,
    });

    const metadata = {
      mode: String(mode),          // 'groupe' | 'relais'
      user_id: String(user_id),
      course_id: String(course_id),
      format_id: String(format_id),
      groupe_id: String(groupe_id),
      team_size: String(qty),
      trace_id,
    };

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: "eur",
          product_data: { name: f.nom || "Inscription (équipe)" },
          unit_amount: unitAmount,
        },
        quantity: qty,
      },
    ];
    if (equipeAmount > 0) {
      line_items.push({
        price_data: {
          currency: "eur",
          product_data: { name: `${f.nom} — Frais d’équipe` },
          unit_amount: equipeAmount,
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items,
      customer_email: String(email),
      payment_intent_data: {
        transfer_group: `grp_${trace_id}`,
        metadata,
      },
      success_url: (successUrl || "https://www.tickrace.com/merci") + `?session_id={CHECKOUT_SESSION_ID}&groupe_id=${groupe_id}&format_id=${format_id}`,
      cancel_url: (cancelUrl || "https://www.tickrace.com/paiement-annule") + `?session_id={CHECKOUT_SESSION_ID}&groupe_id=${groupe_id}&format_id=${format_id}`,
      metadata,
    });

    return new Response(JSON.stringify({ url: session.url, trace_id, groupe_id, total_cents: totalCents }), { status: 200, headers });

  } catch (e: any) {
    console.error("create-checkout-session error:", e?.message ?? e, e?.stack);
    return new Response(JSON.stringify({ error: "Erreur serveur" }), { status: 500, headers });
  }
});
