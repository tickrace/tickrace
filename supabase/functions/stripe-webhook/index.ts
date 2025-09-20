--- a/supabase/functions/stripe-webhook/index.ts
+++ b/supabase/functions/stripe-webhook/index.ts
@@ -1,17 +1,17 @@
 // deno-lint-ignore-file
 import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
 import Stripe from "https://esm.sh/stripe@13.0.0?target=deno&deno-std=0.192.0";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";
 import { Resend } from "https://esm.sh/resend@3.2.0?target=deno&deno-std=0.192.0";
 
 const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-04-10" });
 const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
 const TICKRACE_BASE_URL = Deno.env.get("TICKRACE_BASE_URL") || "https://www.tickrace.com";
 const resendApiKey = Deno.env.get("RESEND_API_KEY") || null;
 
 const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
 const resend = resendApiKey ? new Resend(resendApiKey) : null;
 
 const ALLOWLIST = ["https://www.tickrace.com","http://localhost:5173","http://127.0.0.1:5173"];
 const cors = (o: string | null) => ({
   "Access-Control-Allow-Origin": (o && ALLOWLIST.includes(o)) ? o : ALLOWLIST[0],
   "Vary": "Origin",
   "Access-Control-Allow-Methods": "POST, OPTIONS",
-  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature, prefer",
+  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature, prefer",
   "Access-Control-Max-Age": "86400",
   "Content-Type": "application/json",
 });
 const isUUID = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v as string);
@@ -54,6 +54,7 @@
     // Metadata consolidée
     md = { ...(md || {}), ...(pi.metadata || {}) };
-    const inscription_id = md["inscription_id"];
+    const inscription_id = md["inscription_id"]; // présent en individuel
     const course_id = md["course_id"];
     const user_id = md["user_id"];
     const trace_id = md["trace_id"];
+    const mode = md["mode"] || "individuel"; // 'individuel' | 'groupe' | 'relais'
+    const group_ids_csv = md["group_ids"] || "";
+    const inscription_ids_csv = md["inscription_ids"] || "";
+    const multi = md["multi"] === "1";
-    if (!isUUID(inscription_id) || !isUUID(course_id) || !isUUID(user_id) || !isUUID(trace_id)) {
-      return new Response(JSON.stringify({ error: "metadata invalide" }), { status: 400, headers });
-    }
+    if (!isUUID(course_id) || !isUUID(user_id) || !isUUID(trace_id)) {
+      return new Response(JSON.stringify({ error: "metadata invalide (course/user/trace)" }), { status: 400, headers });
+    }
+    // En individuel on exige inscription_id
+    if (mode === "individuel" && !isUUID(inscription_id)) {
+      return new Response(JSON.stringify({ error: "metadata invalide (inscription_id)" }), { status: 400, headers });
+    }
 
     // Montants
     const amountTotalCents = (session?.amount_total ?? (pi.amount ?? 0)) ?? 0;
@@ -97,39 +101,119 @@
-    // Commission Tickrace (5%) en cents
+    // Commission Tickrace (5%) en cents
     const platformFeeCents = Math.round(amountTotalCents * 0.05);
 
-    // Upsert paiements
-    const row = {
-      inscription_id,
-      montant_total: amountTotalCents / 100,
-      devise: pi.currency ?? "eur",
-      stripe_payment_intent_id: String(pi.id),
-      status: pi.status ?? "succeeded",
-      reversement_effectue: false,
-      user_id, type: "individuel",
-      inscription_ids: [inscription_id],
-      trace_id,
-      receipt_url: receiptUrl,
-      charge_id: chargeId,
-      destination_account_id: destinationAccount,
-      amount_subtotal: amountTotalCents,
-      amount_total: amountTotalCents,
-      fee_total: stripeFeeCents,              // frais Stripe (plateforme, SCT)
-      platform_fee_amount: platformFeeCents,  // 5% Tickrace
-      balance_transaction_id: balanceTxId,
-    };
+    // Upsert paiements (individuel vs équipe)
+    const row: any = {
+      inscription_id: mode === "individuel" ? inscription_id : null,
+      montant_total: amountTotalCents / 100,
+      devise: pi.currency ?? "eur",
+      stripe_payment_intent_id: String(pi.id),
+      status: pi.status ?? "succeeded",
+      reversement_effectue: false,
+      user_id,
+      type: mode, // 'individuel' | 'groupe' | 'relais'
+      inscription_ids: mode === "individuel"
+        ? [inscription_id]
+        : (inscription_ids_csv ? inscription_ids_csv.split(",") : []),
+      trace_id,
+      receipt_url: receiptUrl,
+      charge_id: chargeId,
+      destination_account_id: destinationAccount,
+      amount_subtotal: amountTotalCents,
+      amount_total: amountTotalCents,
+      fee_total: stripeFeeCents,              // frais Stripe (plateforme, SCT)
+      platform_fee_amount: platformFeeCents,  // 5% Tickrace
+      balance_transaction_id: balanceTxId,
+    };
 
     const { data: preByPI } = await supabase.from("paiements").select("id").eq("stripe_payment_intent_id", row.stripe_payment_intent_id).maybeSingle();
     if (preByPI?.id) await supabase.from("paiements").update(row).eq("id", preByPI.id);
     else {
       const { data: preByTrace } = await supabase.from("paiements").select("id").eq("trace_id", trace_id).maybeSingle();
       if (preByTrace?.id) await supabase.from("paiements").update(row).eq("id", preByTrace.id);
       else await supabase.from("paiements").insert(row);
     }
 
-    // Valider l’inscription
-    await supabase.from("inscriptions").update({ statut: "validé" }).eq("id", inscription_id);
+    // Valider inscriptions / groupes selon le mode
+    if (mode === "individuel") {
+      await supabase.from("inscriptions").update({ statut: "validé" }).eq("id", inscription_id);
+    } else {
+      // Marquer les groupes en payé
+      if (group_ids_csv) {
+        const groupIds = group_ids_csv.split(",").filter((x) => isUUID(x));
+        if (groupIds.length > 0) {
+          await supabase.from("inscriptions_groupes").update({ statut: "paye" }).in("id", groupIds);
+        }
+      }
+      // Marquer les inscriptions membres en validé
+      if (inscription_ids_csv) {
+        const ids = inscription_ids_csv.split(",").filter((x) => isUUID(x));
+        if (ids.length > 0) {
+          await supabase.from("inscriptions").update({ statut: "validé" }).in("id", ids);
+        }
+      }
+    }
 
     // Enqueue J+1 (si pas déjà en queue)
     const netToTransfer = Math.max(0, amountTotalCents - platformFeeCents - stripeFeeCents);
     const { data: payRow } = await supabase.from("paiements").select("id").eq("stripe_payment_intent_id", String(pi.id)).maybeSingle();
     if (payRow?.id && destinationAccount && netToTransfer > 0) {
       // Eviter doublons si déjà en file
       const { data: existsQ } = await supabase.from("payout_queue").select("id").eq("paiement_id", payRow.id).eq("status","pending").maybeSingle();
       if (!existsQ) {
         await supabase.from("payout_queue").insert({
           paiement_id: payRow.id,
           due_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(), // J+1
           amount_cents: netToTransfer,
           status: "pending",
         });
       }
     }
 
     // Email (optionnel)
     try {
-      if (resend) {
-        const { data: insc } = await supabase.from("inscriptions").select("id, email, nom, prenom").eq("id", inscription_id).single();
-        if (insc?.email) {
-          await resend.emails.send({
-            from: "Tickrace <no-reply@tickrace.com>",
-            to: insc.email,
-            subject: "Confirmation d’inscription",
-            html: `
-              <div style="font-family:Arial,sans-serif;">
-                <h2>Votre inscription est confirmée ✅</h2>
-                <p>Bonjour ${insc.prenom ?? ""} ${insc.nom ?? ""},</p>
-                <p>Votre numéro d’inscription : <strong>${insc.id}</strong></p>
-                <p><a href="${TICKRACE_BASE_URL}/mon-inscription/${insc.id}">${TICKRACE_BASE_URL}/mon-inscription/${insc.id}</a></p>
-              </div>
-            `,
-          });
-        }
-      }
+      if (resend) {
+        if (mode === "individuel") {
+          const { data: insc } = await supabase.from("inscriptions").select("id, email, nom, prenom").eq("id", inscription_id).maybeSingle();
+          if (insc?.email) {
+            await resend.emails.send({
+              from: "Tickrace <no-reply@tickrace.com>",
+              to: insc.email,
+              subject: "Confirmation d’inscription",
+              html: `
+                <div style="font-family:Arial,sans-serif;">
+                  <h2>Votre inscription est confirmée ✅</h2>
+                  <p>Bonjour ${insc.prenom ?? ""} ${insc.nom ?? ""},</p>
+                  <p>Votre numéro d’inscription : <strong>${insc.id}</strong></p>
+                  <p><a href="${TICKRACE_BASE_URL}/mon-inscription/${insc.id}">${TICKRACE_BASE_URL}/mon-inscription/${insc.id}</a></p>
+                </div>
+              `,
+            });
+          }
+        } else {
+          // Envoi simple au payeur : reçu + lien vers espace (à améliorer si tu veux)
+          const to = (session?.customer_details?.email) || (pi?.receipt_email) || null;
+          if (to) {
+            await resend.emails.send({
+              from: "Tickrace <no-reply@tickrace.com>",
+              to,
+              subject: "Confirmation d’inscription d’équipe",
+              html: `
+                <div style="font-family:Arial,sans-serif;">
+                  <h2>Vos équipes sont confirmées ✅</h2>
+                  <p>Merci pour votre paiement. Vos équipes sont enregistrées.</p>
+                  <p>Vous pourrez gérer les participants depuis votre espace Tickrace.</p>
+                </div>
+              `,
+            });
+          }
+        }
+      }
     } catch (e) { console.error("Resend error:", e); }
 
     return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
   } catch (e: any) {
     console.error("stripe-webhook (SCT) error:", e?.message ?? e, e?.stack);
     return new Response(JSON.stringify({ error: "Erreur serveur" }), { status: 500, headers });
   }
 });
