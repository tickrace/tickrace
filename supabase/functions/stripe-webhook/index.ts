// supabase/functions/stripe-webhook/index.ts
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-04-10" });
const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

// --- Resend via HTTP (pas de SDK Node)
async function sendResendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text: string }) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
  const from = "Tickrace <noreply@tickrace.com>";
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, text }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}

// --- Retry helper
async function sendWithRetry(fn: () => Promise<void>, max = 2) {
  let lastErr: any;
  for (let attempt = 0; attempt <= max; attempt++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      const wait = 500 * Math.pow(2, attempt);
      console.warn(`⚠️ Email fail attempt ${attempt+1}/${max+1}, retry in ${wait}ms`, e);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  console.error("❌ Email définitivement non envoyé", lastErr);
}

function pickMeta(md?: Record<string, string>) {
  const entries = Object.entries(md || {});
  const norm = (s: string) => s.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const get = (...names: string[]) => {
    const t = names.map(norm);
    for (const [k, v] of entries) if (t.includes(norm(k))) return v;
    return null;
  };
  return {
    inscription_id: get("inscription_id", "inscription id", "inscriptionid"),
    inscription_ids: get("inscription_ids", "inscription ids", "inscriptionids"),
    user_id:        get("user_id", "user id", "userid"),
    course_id:      get("course_id", "course id", "courseid"),
    prix_total:     get("prix_total", "prix total", "prixtotal"),
    trace_id:       get("trace_id", "trace id", "traceid"),
  };
}

serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig!, endpointSecret);
    console.log("✅ Webhook reçu :", event.type, "id:", event.id, "live:", event.livemode);
  } catch (e: any) {
    console.error("❌ Erreur de signature Stripe :", e?.message);
    return new Response("bad signature", { status: 400 });
  }

  // Helpers Stripe
  async function expandPI(piId: string) {
    // Récupère PI + charge + fees + destination (Connect)
    return await stripe.paymentIntents.retrieve(piId, {
      expand: [
        "latest_charge.balance_transaction",
        "charges.data.balance_transaction",
        "transfer_data.destination",
      ],
    });
  }

  function extractPaymentDetails(
    session: Stripe.Checkout.Session | null,
    pi: Stripe.PaymentIntent | null,
    charge: Stripe.Charge | null
  ) {
    // Valeurs par défaut
    let application_fee_amount: number | null = null;
    let destination_account_id: string | null = null; // acct_...
    let transfer_id: string | null = null;
    let charge_id: string | null = null;
    let receipt_url: string | null = null;
    let fee_total: number | null = null;
    let balance_transaction_id: string | null = null;
    let amount_total: number | null = null;
    let amount_subtotal: number | null = null;
    let currency: string | null = null;

    // Depuis session (amount_total/subtotal/currency)
    if (session) {
      amount_total = session.amount_total ?? null;
      amount_subtotal = session.amount_subtotal ?? null;
      currency = session.currency ?? null;
    }

    // Depuis PI (application_fee_amount, destination)
    if (pi) {
      // @ts-ignore - champs présents pour destination charges
      application_fee_amount = (pi as any).application_fee_amount ?? null;
      // @ts-ignore
      destination_account_id = (pi.transfer_data as any)?.destination ?? null;
    }

    // Depuis charge (receipt_url, transfer, fees via balance_transaction)
    if (charge) {
      charge_id = charge.id ?? null;
      // @ts-ignore
      receipt_url = charge.receipt_url ?? null;
      // @ts-ignore - sur destination charges, le champ "transfer" est sur la charge
      transfer_id = (charge.transfer as string) ?? null;

      const bt = charge.balance_transaction as any;
      if (bt) {
        balance_transaction_id = bt.id ?? null;
        fee_total = typeof bt.fee === "number" ? bt.fee : null; // en cents
        // fallback currency si besoin
        currency = currency ?? bt.currency ?? currency;
      }
    }

    return {
      application_fee_amount,
      destination_account_id,
      transfer_id,
      charge_id,
      receipt_url,
      fee_total,
      balance_transaction_id,
      amount_total,
      amount_subtotal,
      currency,
    };
  }

  async function processPayment(args: {
    inscription_id?: string | null;
    inscription_ids?: string[] | string | null;
    user_id?: string | null;
    prix_total?: string | number | null;
    payment_intent_id: string;
    fallbackEmail?: string | null;
    meta_source: "pi" | "session";
    trace_id?: string | null;
  }) {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Normalisation IDs
    let ids: string[] = [];
    if (args.inscription_id) ids = [args.inscription_id];
    else if (args.inscription_ids) {
      try { 
        ids = Array.isArray(args.inscription_ids) ? args.inscription_ids : JSON.parse(String(args.inscription_ids)); 
      } catch {}
    }

    // Fallback via trace_id if needed
    if (ids.length === 0 && args.trace_id) {
      console.log("🔍 Recherche des inscriptions par trace_id:", args.trace_id);
      const { data: found, error: findErr } = await supabase
        .from("inscriptions")
        .select("id")
        .eq("paiement_trace_id", args.trace_id);

      if (findErr) {
        console.warn("⚠️ Erreur recherche par trace_id :", findErr.message);
      } else if (found?.length) {
        ids = found.map(row => row.id);
        console.log(`✅ ${found.length} inscription(s) trouvée(s) via trace_id`);
      }
    }

    const montant_total_num = Number(args.prix_total ?? 0);
    const montant_total = Number.isFinite(montant_total_num) ? montant_total_num : null;

    // Idempotence
    const { data: exist } = await supabase
      .from("paiements")
      .select("id")
      .eq("stripe_payment_intent_id", args.payment_intent_id)
      .maybeSingle();
    if (exist) {
      console.log("ℹ️ Paiement déjà enregistré (idempotence):", exist.id);
      return new Response("ok", { status: 200 });
    }

    // --- Récup Stripe details (PI + charge + fees + destination + receipt)
    let session: Stripe.Checkout.Session | null = null;
    try {
      const list = await stripe.checkout.sessions.list({ payment_intent: args.payment_intent_id, limit: 1 });
      session = list.data?.[0] ?? null;
    } catch {}

    let pi: Stripe.PaymentIntent | null = null;
    try { pi = await expandPI(args.payment_intent_id); } catch {}

    let charge: Stripe.Charge | null = null;
    try { 
      // @ts-ignore
      charge = (pi?.charges?.data?.[0] as Stripe.Charge) ?? null; 
    } catch {}

    const details = extractPaymentDetails(session, pi, charge);
    // 🔁 Fallback robuste : si fee_total/BT manquent, on recharge la charge avec balance_transaction
try {
  let cid = details.charge_id;

  // Si on n'a pas d'id de charge, on le dérive depuis le PI basique
  if (!cid) {
    const piBasic = await stripe.paymentIntents.retrieve(args.payment_intent_id);
    // @ts-ignore
    cid = (piBasic.latest_charge as string) || (piBasic.charges?.data?.[0]?.id ?? null);
  }

  if (cid) {
    const full = await stripe.charges.retrieve(cid, { expand: ["balance_transaction"] });

    // Complète les champs manquants
    if (!details.charge_id) details.charge_id = full.id;
    // @ts-ignore
    if (!details.receipt_url && full.receipt_url) details.receipt_url = full.receipt_url;

    // @ts-ignore
    const bt = full.balance_transaction as any;
    if (bt) {
      if (details.fee_total == null && typeof bt.fee === "number") details.fee_total = bt.fee; // cents
      if (!details.balance_transaction_id && bt.id) details.balance_transaction_id = bt.id;
      // fallback currency
      // @ts-ignore
      if (!details.currency && (bt.currency || full.currency)) {
        // @ts-ignore
        details.currency = bt.currency || full.currency;
      }
    }
  }
} catch (e) {
  console.warn("⚠️ Fallback charge.retrieve pour fee_total a échoué:", e);
}


    // 1) Valider inscriptions
    const { error: updErr } = await supabase
      .from("inscriptions")
      .update({
        statut: "validé",
        paiement_trace_id: args.trace_id ?? null
      })
      .in("id", ids);

    if (updErr) {
      console.error("❌ Update inscriptions :", updErr.message);
      return new Response("update fail", { status: 500 });
    }
    console.log("✅ Inscriptions validées :", ids);

    // 2) Insérer paiement enrichi (destination charges)
    const paiementRow: any = {
      user_id: args.user_id ?? null,
      inscription_id: ids.length === 1 ? ids[0] : null,
      inscription_ids: ids.length > 1 ? ids : null,
      montant_total: montant_total ?? ((details.amount_total ?? 0) / 100.0),
      devise: (details.currency ?? "eur").toUpperCase(),
      stripe_payment_intent_id: args.payment_intent_id,
      status: "succeeded",
      reversement_effectue: false,
      type: ids.length > 1 ? "groupé" : "individuel",
      trace_id: args.trace_id ?? null,

      // Ajouts Connect
      charge_id: details.charge_id,
      application_fee_amount: details.application_fee_amount ?? null, // cents
      destination_account_id: details.destination_account_id,
      transfer_id: details.transfer_id,
      amount_subtotal: details.amount_subtotal ?? null,               // cents
      amount_total: details.amount_total ?? null,                     // cents
      fee_total: details.fee_total ?? null,                           // cents
      balance_transaction_id: details.balance_transaction_id,
      receipt_url: details.receipt_url ?? null,
    };

    const { error: payErr } = await supabase.from("paiements").insert(paiementRow);
    if (payErr) {
      console.error("❌ Insert paiement :", payErr.message);
      return new Response("insert fail", { status: 500 });
    }
    console.log("✅ Paiement enregistré :", { ...paiementRow, inscription_ids: ids });

    // 3) Email(s)
    const { data: inscriptions, error: inscErr } = await supabase
      .from("inscriptions")
      .select("id, nom, prenom, email, course_id, format_id")
      .in("id", ids);
    if (inscErr) console.warn("⚠️ Lecture inscriptions email :", inscErr.message);

    // caches
    const courseCache = new Map<string, { nom: string | null }>();
    const formatCache = new Map<string, { nom: string | null }>();
    async function getCourseName(id: string | null) {
      if (!id) return null;
      if (!courseCache.has(id)) {
        const { data } = await supabase.from("courses").select("nom").eq("id", id).maybeSingle();
        courseCache.set(id, { nom: data?.nom ?? null });
      }
      return courseCache.get(id)!.nom;
    }
    async function getFormatName(id: string | null) {
      if (!id) return null;
      if (!formatCache.has(id)) {
        const { data } = await supabase.from("formats").select("nom").eq("id", id).maybeSingle();
        formatCache.set(id, { nom: data?.nom ?? null });
      }
      return formatCache.get(id)!.nom;
    }

    for (const insc of inscriptions || []) {
      const to = (insc.email || args.fallbackEmail || "").trim();
      if (!to) { console.warn("⚠️ Pas d’email pour", insc.id); continue; }

      const courseNom = (await getCourseName(insc.course_id)) ?? "votre course";
      const formatNom = await getFormatName(insc.format_id);
      const amountTxt = ((montant_total ?? ((details.amount_total ?? 0) / 100.0)) as number).toFixed(2);
      const urlInscription = `https://www.tickrace.com/mon-inscription/${insc.id}`;

      const subject = "✅ Confirmation d'inscription";
      const text = `Bonjour ${[insc.prenom, insc.nom].filter(Boolean).join(" ") || ""},
Votre inscription à ${courseNom}${formatNom ? ` (${formatNom})` : ""} est confirmée.
Montant payé : ${amountTxt} EUR
${details.receipt_url ? `Reçu Stripe : ${details.receipt_url}\n` : ""}Voir mon inscription : ${urlInscription}
Sportivement,
L'équipe Tickrace`;

      const html = `
        <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; line-height:1.5; color:#111">
          <h2 style="margin:0 0 16px">Confirmation d'inscription</h2>
          <p>Bonjour ${[insc.prenom, insc.nom].filter(Boolean).join(" ") || ""},</p>
          <p>Votre inscription à <strong>${courseNom}${formatNom ? ` (${formatNom})` : ""}</strong> est <strong>confirmée</strong>.</p>
          <p>Montant payé : <strong>${amountTxt} EUR</strong></p>
          ${details.receipt_url ? `<p>Reçu Stripe : <a href="${details.receipt_url}">voir le reçu</a></p>` : ""}
          <p><a href="${urlInscription}" style="color:#6D28D9">Voir mon inscription</a></p>
          <p style="margin-top:24px">Sportivement,<br/>L'équipe Tickrace</p>
        </div>
      `;

      await sendWithRetry(() => sendResendEmail({ to, subject, html, text }), 2);
      console.log(`📧 Email envoyé à ${to} (inscription ${insc.id})`);
    }

    return new Response("ok", { status: 200 });
  }

  // ---- Handlers d’événements ----

  // Flux 1: checkout.session.completed
  if (event.type === "checkout.session.completed") {
    const s = event.data.object as Stripe.Checkout.Session;
    const md = pickMeta((s.metadata || {}) as any);
    console.log("🧾 session.metadata keys:", Object.keys((s.metadata || {}) as any));
    return await processPayment({
      inscription_id: md.inscription_id,
      inscription_ids: md.inscription_ids as any,
      user_id: md.user_id,
      prix_total: md.prix_total ?? (s.amount_total ?? 0) / 100,
      payment_intent_id: String(s.payment_intent || ""),
      fallbackEmail: (s.customer_details?.email || s.customer_email || "") as string,
      meta_source: "session",
      trace_id: md.trace_id,
    });
  }

  // Flux 2: charge.succeeded (sécu / redondance)
  if (event.type === "charge.succeeded") {
    const c = event.data.object as Stripe.Charge;
    const piId = String(c.payment_intent || "");
    console.log("💳 charge.id:", c.id, "pi:", piId);

    try {
      const pi = await stripe.paymentIntents.retrieve(piId);
      const md = pickMeta((pi.metadata || {}) as any);
      console.log("🧾 PI.metadata keys:", Object.keys(((pi as any).metadata || {}) as any));
      if (md.inscription_id || md.inscription_ids) {
        return await processPayment({
          inscription_id: md.inscription_id,
          inscription_ids: md.inscription_ids as any,
          user_id: md.user_id,
          prix_total: md.prix_total ?? (pi.amount ?? 0) / 100,
          payment_intent_id: piId,
          fallbackEmail: c.receipt_email || c.billing_details?.email || null,
          meta_source: "pi",
          trace_id: md.trace_id,
        });
      }
    } catch (e) {
      console.warn("⚠️ PI.metadata read failed:", e);
    }

    // dernier recours: session via PI
    try {
      const list = await stripe.checkout.sessions.list({ payment_intent: piId, limit: 1 });
      const s = list.data?.[0];
      if (s) {
        const md = pickMeta((s.metadata || {}) as any);
        console.log("🧾 session(by PI) metadata keys:", Object.keys((s.metadata || {}) as any));
        return await processPayment({
          inscription_id: md.inscription_id,
          inscription_ids: md.inscription_ids as any,
          user_id: md.user_id,
          prix_total: md.prix_total ?? (s.amount_total ?? 0) / 100,
          payment_intent_id: piId,
          fallbackEmail: (s.customer_details?.email || s.customer_email || "") as string,
          meta_source: "session",
          trace_id: md.trace_id,
        });
      }
    } catch (e) {
      console.warn("⚠️ session.byPI lookup failed:", e);
    }

    console.error("❌ Impossible de déterminer l'inscription depuis charge.succeeded");
    return new Response("missing meta", { status: 400 });
  }

  // Autres événements: noop
  return new Response("ok", { status: 200 });
});
