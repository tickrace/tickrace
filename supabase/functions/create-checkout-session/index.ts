// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno&deno-std=0.192.0&pin=v135";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1?target=deno&deno-std=0.192.0&pin=v135";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-04-10" });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const ALLOWLIST = [
  "https://www.tickrace.com",
  "https://tickrace.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWLIST.includes(origin) ? origin : ALLOWLIST[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, stripe-signature, prefer",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
    Vary: "Origin",
  };
}

const isUUID = (v: unknown) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v as string,
  );

serve(async (req) => {
  const headers = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Méthode non autorisée" }), {
      status: 405,
      headers,
    });
  }

  try {
    const body = await req.json();

    // Champs communs
    const mode = (body?.mode as string) || "individuel"; // 'individuel' | 'groupe' | 'relais'
    const course_id = body?.course_id as string;
    const format_id = body?.format_id as string;
    const user_id = body?.user_id as string;
    const email = (body?.email as string) || "";
    const successUrl = body?.successUrl || "https://www.tickrace.com/merci";
    const cancelUrl = body?.cancelUrl || "https://www.tickrace.com/paiement-annule";

    // Options: total (en EUR) fourni par le front (sélection format-level)
    const options_total_eur = Number(body?.options_total_eur || 0);
    const options_total_cents = Math.max(0, Math.round(options_total_eur * 100));

    // Individuel
    const inscription_id = body?.inscription_id as string | undefined;
    const trace_id =
      (body?.trace_id as string | undefined) ??
      crypto.randomUUID(); // pour corréler au paiement

    if (!isUUID(course_id) || !isUUID(format_id) || !isUUID(user_id)) {
      return new Response(JSON.stringify({ error: "payload invalide" }), {
        status: 400,
        headers,
      });
    }

    // Récupérer la course + format pour libellés et prix
    const { data: course, error: cErr } = await admin
      .from("courses")
      .select("id, nom")
      .eq("id", course_id)
      .maybeSingle();
    if (cErr || !course) {
      return new Response(JSON.stringify({ error: "course introuvable" }), {
        status: 404,
        headers,
      });
    }

    const { data: format, error: fErr } = await admin
      .from("formats")
      .select("id, nom, prix, prix_equipe")
      .eq("id", format_id)
      .maybeSingle();
    if (fErr || !format) {
      return new Response(JSON.stringify({ error: "format introuvable" }), {
        status: 404,
        headers,
      });
    }

    // ----------- BRANCHE INDIVIDUEL -----------
    if (mode === "individuel") {
      if (!isUUID(inscription_id || "")) {
        return new Response(
          JSON.stringify({ error: "inscription_id manquant/invalid" }),
          { status: 400, headers },
        );
      }
      if (!email) {
        return new Response(JSON.stringify({ error: "email requis" }), {
          status: 400,
          headers,
        });
      }

      const base_eur = Number(format.prix || 0);
      const base_cents = Math.max(0, Math.round(base_eur * 100));

      // line items: inscription + (facultatif) options
      const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Inscription — ${course.nom} / ${format.nom}`,
            },
            unit_amount: base_cents,
          },
          quantity: 1,
        },
      ];
      if (options_total_cents > 0) {
        line_items.push({
          price_data: {
            currency: "eur",
            product_data: {
              name: `Options — ${format.nom}`,
            },
            unit_amount: options_total_cents,
          },
          quantity: 1,
        });
      }

      // On marque l’inscription "en attente" + trace côté BDD si besoin (sécurisation)
      await admin
        .from("inscriptions")
        .update({
          statut: "en attente",
          paiement_trace_id: trace_id,
        })
        .eq("id", inscription_id);

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: email,
        line_items,
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          mode,
          course_id,
          format_id,
          user_id,
          inscription_id: inscription_id!,
          trace_id,
          options_total_eur: String(options_total_eur || 0),
        },
      });

      return new Response(JSON.stringify({ url: session.url }), {
        status: 200,
        headers,
      });
    }

    // ----------- BRANCHE GROUPE / RELAIS -----------
    // On attend soit un tableau `teams`, soit {team_name, team_size, members}
    const teamsInputRaw = Array.isArray(body?.teams)
      ? (body.teams as any[])
      : [
          {
            team_name: body?.team_name,
            team_size: body?.team_size,
            members: body?.members || [],
          },
        ];

    // Validation minimale
    if (!teamsInputRaw?.length) {
      return new Response(JSON.stringify({ error: "teams requis" }), {
        status: 400,
        headers,
      });
    }
    if (!email) {
      return new Response(JSON.stringify({ error: "email requis" }), {
        status: 400,
        headers,
      });
    }

    // Nettoyage + normalisation
    const teamsInput = teamsInputRaw.map((t, idx) => {
      const name = String(t?.team_name || `Équipe ${idx + 1}`);
      const size = Number(t?.team_size || 0);
      const members = Array.isArray(t?.members) ? t.members : [];
      return { team_name: name, team_size: size, members };
    });

    // Création des groupes + membres
    const createdGroupIds: string[] = [];
    const createdInscriptionIds: string[] = [];

    for (const t of teamsInput) {
      if (!t.team_name || !t.team_size || !Array.isArray(t.members)) {
        return new Response(
          JSON.stringify({ error: "teams: nom, taille, membres requis" }),
          { status: 400, headers },
        );
      }
      // Insert groupe — **SANS** colonne `category`
      const groupRow: any = {
        course_id,
        format_id,
        team_name: t.team_name,
        team_size: t.team_size,
        statut: "en attente",
        paiement_trace_id: trace_id,
      };

      const { data: g, error: gErr } = await admin
        .from("inscriptions_groupes")
        .insert([groupRow])
        .select("id")
        .single();

      if (gErr || !g?.id) {
        console.error("insert groupe error:", gErr);
        return new Response(JSON.stringify({ error: "insert groupe" }), {
          status: 400,
          headers,
        });
      }
      createdGroupIds.push(g.id);

      // Membres -> inscriptions unitaires (sans colonnes incertaines)
      for (const m of t.members) {
        const inscRow: any = {
          course_id,
          format_id,
          nom: (m?.nom || "").trim(),
          prenom: (m?.prenom || "").trim(),
          genre: m?.genre || null,
          date_naissance: m?.date_naissance || null,
          numero_licence: (m?.numero_licence || "").trim(),
          email: (m?.email || "").trim() || null,
          statut: "en attente",
          paiement_trace_id: trace_id,
          // Si tu as une FK vers le groupe, décommente le bon nom de colonne :
          // groupe_id: g.id,
          // inscriptions_groupe_id: g.id,
        };

        const { data: insc, error: iErr } = await admin
          .from("inscriptions")
          .insert([inscRow])
          .select("id")
          .single();

        if (iErr || !insc?.id) {
          console.error("insert membre error:", iErr);
          return new Response(JSON.stringify({ error: "insert membre" }), {
            status: 400,
            headers,
          });
        }
        createdInscriptionIds.push(insc.id);
      }
    }

    // Calcul montant estimé (base) pour le paiement
    const prixUnitaireEur = Number(format.prix || 0);
    const prixEquipeEur = Number(format.prix_equipe || 0);

    let totalBaseCents = 0;
    for (const t of teamsInput) {
      const teamBaseEur = prixUnitaireEur * Number(t.team_size || 0) + prixEquipeEur;
      totalBaseCents += Math.max(0, Math.round(teamBaseEur * 100));
    }
    const grandTotalCents = totalBaseCents + options_total_cents;

    if (grandTotalCents <= 0) {
      return new Response(JSON.stringify({ error: "Montant total nul" }), {
        status: 400,
        headers,
      });
    }

    // Line items (1 ligne base + 1 ligne options si > 0)
    const li: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: `Inscriptions — ${course.nom} / ${format.nom} (équipes)`,
          },
          unit_amount: totalBaseCents,
        },
        quantity: 1,
      },
    ];
    if (options_total_cents > 0) {
      li.push({
        price_data: {
          currency: "eur",
          product_data: {
            name: `Options — ${format.nom}`,
          },
          unit_amount: options_total_cents,
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: li,
      metadata: {
        mode,
        course_id,
        format_id,
        user_id,
        trace_id,
        group_ids: createdGroupIds.join(","),
        inscription_ids: createdInscriptionIds.join(","),
        options_total_eur: String(options_total_eur || 0),
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers,
    });
  } catch (e: any) {
    console.error("create-checkout-session error:", e?.message ?? e, e?.stack);
    return new Response(
      JSON.stringify({ error: "Erreur serveur", details: String(e?.message ?? e) }),
      { status: 500, headers },
    );
  }
});
