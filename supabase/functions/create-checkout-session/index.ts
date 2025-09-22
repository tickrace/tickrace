// supabase/functions/create-checkout-session/index.ts
// Deno + Stripe Edge Function (TypeScript)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "https://esm.sh/stripe@16.4.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";

type TeamPayload = {
  team_name: string;
  team_size: number;
  category?: string | null;
  members?: Array<{ nom:string; prenom:string; genre?:string; date_naissance?:string; email?:string }>;
};

type Body =
  | {
      // Individuel
      user_id: string;
      course_id: string;
      format_id?: string; // facultatif en individuel, on le lit via inscription
      inscription_id: string;
      email: string;
      trace_id?: string;
      prix_total?: number; // ignoré (on recalcule côté serveur)
      successUrl?: string;
      cancelUrl?: string;
      mode?: "individuel";
    }
  | {
      // Groupe / Relais
      user_id: string;
      course_id: string;
      format_id: string;
      inscription_id: string; // draft déjà créé côté client
      email: string;
      trace_id?: string;
      successUrl?: string;
      cancelUrl?: string;
      mode: "groupe" | "relais";
      // soit plusieurs équipes :
      teams?: TeamPayload[];
      // soit une seule :
      team_name?: string;
      team_size?: number;
      category?: string | null;
      members?: TeamPayload["members"];
    };

const SITE_URL = Deno.env.get("SITE_URL") || "https://www.tickrace.com";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

function ok(json: any, status = 200) {
  return new Response(JSON.stringify(json), {
    headers: { "content-type": "application/json" },
    status,
  });
}
function bad(msg: string, status = 400) {
  return ok({ error: msg }, status);
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return bad("Method not allowed", 405);
    const body = (await req.json()) as Body;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    // Charge l’inscription
    const { data: inscription, error: insErr } = await supabase
      .from("inscriptions")
      .select("*")
      .eq("id", (body as any).inscription_id)
      .single();

    if (insErr || !inscription) {
      return bad("Inscription introuvable.");
    }

    // Récup format (prix, prix_repas, prix_equipe)
    const formatId = (body as any).format_id || inscription.format_id;
    const { data: format, error: fmtErr } = await supabase
      .from("formats")
      .select("id, nom, prix, prix_repas, prix_equipe")
      .eq("id", formatId)
      .single();

    if (fmtErr || !format) return bad("Format introuvable.");

    // Récup course (nom pour libellés)
    const { data: course, error: courseErr } = await supabase
      .from("courses")
      .select("id, nom")
      .eq("id", (body as any).course_id)
      .single();

    if (courseErr || !course) return bad("Course introuvable.");

    // Récup options en 'pending' liées à l’inscription
    const { data: pendingOptions, error: optErr } = await supabase
      .from("inscriptions_options")
      .select("option_id, quantity, prix_unitaire_cents, status")
      .eq("inscription_id", inscription.id)
      .eq("status", "pending");

    if (optErr) return bad("Erreur lecture options/pending.");

    // Construit les line items
    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    // --- Base inscription (individuel ou par participant) ---
    // Individuel : 1 × format.prix
    // Groupe/Relais : somme(team_size × format.prix) + (prix_equipe par équipe)
    let totalCents = 0;

    const addCents = (c: number) => (totalCents += Math.max(0, Math.round(c)));

    if (inscription && (!("mode" in body) || body.mode === "individuel")) {
      const baseCents = Math.round(Number(format.prix || 0) * 100);
      if (baseCents > 0) {
        line_items.push({
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: baseCents,
            product_data: {
              name: `Inscription – ${course.nom} – ${format.nom}`,
            },
          },
        });
        addCents(baseCents);
      }
      // Repas (si nombre_repas > 0)
      const qtyRepas = Number(inscription.nombre_repas || 0);
      const prixRepasCents = Math.round(Number(format.prix_repas || 0) * 100);
      if (qtyRepas > 0 && prixRepasCents > 0) {
        line_items.push({
          quantity: qtyRepas,
          price_data: {
            currency: "eur",
            unit_amount: prixRepasCents,
            product_data: {
              name: `Repas – ${course.nom} – ${format.nom}`,
            },
          },
        });
        addCents(qtyRepas * prixRepasCents);
      }
    } else {
      // Groupe / Relais
      let teams: TeamPayload[] = [];
      if (Array.isArray((body as any).teams)) {
        teams = (body as any).teams!;
      } else if ((body as any).team_size && (body as any).team_name) {
        teams = [
          {
            team_name: (body as any).team_name,
            team_size: Number((body as any).team_size),
            category: (body as any).category ?? null,
            members: (body as any).members ?? [],
          },
        ];
      }
      const prixParticipantCents = Math.round(Number(format.prix || 0) * 100);
      const prixEquipeCents = Math.round(Number(format.prix_equipe || 0) * 100);

      // Par équipe : team_size × format.prix + prix_equipe
      for (const t of teams) {
        const taille = Math.max(0, Number(t.team_size || 0));
        const sousTotalEquipe =
          taille * prixParticipantCents + (prixEquipeCents || 0);
        if (sousTotalEquipe > 0) {
          line_items.push({
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: sousTotalEquipe,
              product_data: {
                name: `Inscription ${body.mode} – ${t.team_name} – ${course.nom} – ${format.nom}`,
              },
            },
          });
          addCents(sousTotalEquipe);
        }
      }
      // (On n’a pas de repas par équipe ici par défaut ; à étendre si nécessaire)
    }

    // --- Options payantes (pending) ---
    for (const row of pendingOptions || []) {
      const qty = Math.max(0, Number(row.quantity || 0));
      const unitCents =
        Number.isFinite(Number(row.prix_unitaire_cents))
          ? Math.max(0, Math.round(Number(row.prix_unitaire_cents)))
          : 0;
      if (qty > 0 && unitCents > 0) {
        line_items.push({
          quantity: qty,
          price_data: {
            currency: "eur",
            unit_amount: unitCents,
            product_data: {
              name: `Option – ${course.nom} – ${format.nom}`,
            },
          },
        });
        addCents(qty * unitCents);
      }
    }

    if (line_items.length === 0 || totalCents <= 0) {
      return bad("Montant nul : aucune ligne valorisée.");
    }

    const success_url =
      (body as any).successUrl || `${SITE_URL}/merci?ins=${inscription.id}`;
    const cancel_url =
      (body as any).cancelUrl || `${SITE_URL}/paiement-annule?ins=${inscription.id}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: (body as any).email,
      metadata: {
        inscription_id: String(inscription.id),
        course_id: String((body as any).course_id),
        user_id: String((body as any).user_id),
        trace_id: (body as any).trace_id || "",
        mode: (body as any).mode || "individuel",
      },
      line_items,
      success_url,
      cancel_url,
      allow_promotion_codes: true,
    });

    // Marque l’inscription en "en attente" si pas déjà
    await supabase
      .from("inscriptions")
      .update({ statut: "en attente" })
      .eq("id", inscription.id);

    return ok({ url: session.url });
  } catch (e) {
    console.error("create-checkout-session error:", e);
    return bad("Erreur serveur.", 500);
  }
});
