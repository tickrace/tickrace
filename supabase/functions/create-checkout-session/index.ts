--- a/supabase/functions/create-checkout-session/index.ts
+++ b/supabase/functions/create-checkout-session/index.ts
@@ -1,15 +1,24 @@
 // deno-lint-ignore-file
 import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
 import Stripe from "https://esm.sh/stripe@13.0.0?target=deno&deno-std=0.192.0";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";
 
 const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-04-10" });
 const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
 
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
 
 serve(async (req) => {
   const headers = cors(req.headers.get("origin"));
   if (req.method === "OPTIONS") return new Response("ok", { headers });
   if (req.method !== "POST") return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405, headers });
 
   try {
-    const body = await req.json();
-    const { user_id, course_id, prix_total, inscription_id, email, successUrl, cancelUrl, trace_id: traceIn } = body ?? {};
-    if (!isUUID(user_id) || !isUUID(course_id) || !isUUID(inscription_id) || !email) {
-      return new Response(JSON.stringify({ error: "Paramètres invalides" }), { status: 400, headers });
-    }
+    const body = await req.json();
+    // Nouveaux champs pour groupe/relais
+    const {
+      user_id, course_id, email, successUrl, cancelUrl, trace_id: traceIn,
+      // individuel (héritage)
+      prix_total, inscription_id,
+      // équipe(s)
+      mode,                 // 'groupe' | 'relais' | 'individuel' (défaut)
+      format_id,            // requis si mode != individuel
+      team_name, team_size, members, // pour 1 équipe
+      teams,                // pour plusieurs équipes: [{ team_name, team_size, members: [{nom,prenom,email?}] }]
+    } = body ?? {};
 
-    const prixNumber = Number(prix_total);
-    const unitAmount = Number.isFinite(prixNumber) ? Math.round(prixNumber * 100) : NaN;
-    if (!Number.isFinite(prixNumber) || unitAmount <= 0) {
-      return new Response(JSON.stringify({ error: "prix_total invalide" }), { status: 400, headers });
-    }
+    // Garde-fous généraux
+    if (!isUUID(user_id) || !isUUID(course_id) || !email) {
+      return new Response(JSON.stringify({ error: "Paramètres invalides (user_id/course_id/email)" }), { status: 400, headers });
+    }
 
     const trace_id = isUUID(traceIn) ? traceIn : crypto.randomUUID();
 
     // Récup organiser -> compte connecté (destination du transfer J+1)
     const { data: course, error: cErr } = await supabase.from("courses")
       .select("organisateur_id, nom").eq("id", course_id).single();
     if (cErr || !course) return new Response(JSON.stringify({ error: "Course introuvable" }), { status: 404, headers });
 
     const { data: profil, error: pErr } = await supabase.from("profils_utilisateurs")
       .select("stripe_account_id").eq("user_id", course.organisateur_id).maybeSingle();
     if (pErr) return new Response(JSON.stringify({ error: "Erreur lecture profil" }), { status: 500, headers });
     const destinationAccount = profil?.stripe_account_id ?? null;
     if (!destinationAccount) {
       return new Response(JSON.stringify({ error: "Organisateur non configuré Stripe", code: "ORGANISER_STRIPE_NOT_CONFIGURED" }), { status: 409, headers });
     }
 
-    // Marquer l'inscription + pré-insert paiement (status 'created')
-    await supabase.from("inscriptions").update({ paiement_trace_id: trace_id }).eq("id", inscription_id);
-    await supabase.from("paiements").insert({
-      inscription_id, user_id, montant_total: prixNumber, devise: "eur",
-      status: "created", type: "individuel", inscription_ids: [inscription_id],
-      trace_id, amount_subtotal: unitAmount, amount_total: unitAmount,
-      destination_account_id: destinationAccount
-    });
+    // ---------- BRANCHE 1 : INDIVIDUEL (comportement existant) ----------
+    if (!mode || mode === "individuel") {
+      if (!isUUID(inscription_id)) {
+        return new Response(JSON.stringify({ error: "inscription_id manquant (individuel)" }), { status: 400, headers });
+      }
+      const prixNumber = Number(prix_total);
+      const unitAmount = Number.isFinite(prixNumber) ? Math.round(prixNumber * 100) : NaN;
+      if (!Number.isFinite(prixNumber) || unitAmount <= 0) {
+        return new Response(JSON.stringify({ error: "prix_total invalide" }), { status: 400, headers });
+      }
+
+      // Marquer l'inscription + pré-insert paiement (status 'created')
+      await supabase.from("inscriptions").update({ paiement_trace_id: trace_id }).eq("id", inscription_id);
+      await supabase.from("paiements").insert({
+        inscription_id, user_id, montant_total: prixNumber, devise: "eur",
+        status: "created", type: "individuel", inscription_ids: [inscription_id],
+        trace_id, amount_subtotal: unitAmount, amount_total: unitAmount,
+        destination_account_id: destinationAccount
+      });
+
+      const metadata = {
+        inscription_id: String(inscription_id),
+        user_id: String(user_id),
+        course_id: String(course_id),
+        prix_total: String(prix_total),
+        trace_id,
+        mode: "individuel",
+      };
+
+      const session = await stripe.checkout.sessions.create({
+        mode: "payment",
+        payment_method_types: ["card"],
+        line_items: [{
+          price_data: {
+            currency: "eur",
+            product_data: { name: "Inscription à la course" },
+            unit_amount: unitAmount,
+          },
+          quantity: 1,
+        }],
+        customer_email: String(email),
+        payment_intent_data: {
+          transfer_group: `grp_${trace_id}`,
+          metadata,
+        },
+        success_url: (successUrl || "https://www.tickrace.com/merci") + "?session_id={CHECKOUT_SESSION_ID}&inscription_id="+inscription_id,
+        cancel_url: (cancelUrl || "https://www.tickrace.com/paiement-annule") + "?session_id={CHECKOUT_SESSION_ID}&inscription_id="+inscription_id,
+        metadata,
+      });
+
+      return new Response(JSON.stringify({ url: session.url, trace_id }), { status: 200, headers });
+    }
 
-    const metadata = {
-      inscription_id: String(inscription_id),
-      user_id: String(user_id),
-      course_id: String(course_id),
-      prix_total: String(prix_total),
-      trace_id,
-    };
+    // ---------- BRANCHE 2 : GROUPE / RELAIS ----------
+    if (!isUUID(format_id)) {
+      return new Response(JSON.stringify({ error: "format_id requis pour groupe/relais" }), { status: 400, headers });
+    }
+    if (!(mode === "groupe" || mode === "relais")) {
+      return new Response(JSON.stringify({ error: "mode invalide (attendu: groupe|relais)" }), { status: 400, headers });
+    }
+
+    // Lecture du format
+    const { data: formatRow, error: fErr } = await supabase
+      .from("formats")
+      .select("id, prix, prix_equipe, nb_max_coureurs, inscription_ouverture, inscription_fermeture, waitlist_enabled, team_size, nb_coureurs_min, nb_coureurs_max")
+      .eq("id", format_id).single();
+    if (fErr || !formatRow) {
+      return new Response(JSON.stringify({ error: "Format introuvable" }), { status: 404, headers });
+    }
+
+    // Fenêtre d'inscription (sécurité côté serveur)
+    const nowIso = new Date().toISOString();
+    if (formatRow.inscription_ouverture && nowIso < formatRow.inscription_ouverture) {
+      return new Response(JSON.stringify({ error: "Inscriptions non ouvertes" }), { status: 403, headers });
+    }
+    if (formatRow.inscription_fermeture && nowIso > formatRow.inscription_fermeture) {
+      return new Response(JSON.stringify({ error: "Inscriptions fermées" }), { status: 403, headers });
+    }
+
+    // Normaliser la liste d'équipes
+    const normalizedTeams = Array.isArray(teams) && teams.length > 0
+      ? teams
+      : [{ team_name: team_name || "Équipe", team_size: Number(team_size || formatRow.team_size || 0), members: Array.isArray(members) ? members : [] }];
+
+    // Validation basique des équipes
+    for (const t of normalizedTeams) {
+      const size = Number(t.team_size || 0);
+      if (!t.team_name || size <= 0) {
+        return new Response(JSON.stringify({ error: "Chaque équipe doit avoir un nom et une taille > 0" }), { status: 400, headers });
+      }
+      if (!Array.isArray(t.members) || t.members.length !== size) {
+        return new Response(JSON.stringify({ error: `L'équipe "${t.team_name}" doit avoir ${size} membres` }), { status: 400, headers });
+      }
+      const bad = t.members.find((m: any) => !m?.nom?.trim() || !m?.prenom?.trim());
+      if (bad) {
+        return new Response(JSON.stringify({ error: `L'équipe "${t.team_name}" a un membre sans nom/prénom` }), { status: 400, headers });
+      }
+    }
+
+    // Capacité actuelle (on compte les inscriptions non annulées)
+    const { count: currentCount } = await supabase
+      .from("inscriptions")
+      .select("*", { count: "exact", head: true })
+      .eq("format_id", format_id)
+      .neq("statut", "annulé");
+
+    const toAdd = normalizedTeams.reduce((acc, t) => acc + Number(t.team_size || 0), 0);
+    const maxCap = Number(formatRow.nb_max_coureurs || 0) || Infinity;
+    if ((currentCount || 0) + toAdd > maxCap && !formatRow.waitlist_enabled) {
+      return new Response(JSON.stringify({ error: "Capacité atteinte (pas de liste d’attente)" }), { status: 409, headers });
+    }
+
+    // Calcul du total (plateforme fait foi; simple: prix par coureur + éventuel prix_equipe par équipe)
+    const pricePerRunner = Number(formatRow.prix || 0);
+    const teamFee = Number(formatRow.prix_equipe || 0) || 0;
+    const totalEuros = normalizedTeams.reduce((sum, t) => sum + (Number(t.team_size || 0) * pricePerRunner + teamFee), 0);
+    const unitAmount = Math.round(totalEuros * 100);
+    if (unitAmount <= 0) {
+      return new Response(JSON.stringify({ error: "Montant total invalide" }), { status: 400, headers });
+    }
+
+    // 1) Créer les groupes (en attente) + inscriptions membres (en attente)
+    const inscriptionIds: string[] = [];
+    const groupIds: string[] = [];
+    for (const t of normalizedTeams) {
+      // Crée le groupe
+      const { data: grp, error: gErr } = await supabase
+        .from("inscriptions_groupes")
+        .insert({
+          format_id,
+          nom_groupe: t.team_name,
+          team_size: Number(t.team_size || 0),
+          capitaine_user_id: user_id,
+          statut: "en_attente",
+          invitation_token: crypto.randomUUID(),
+        })
+        .select()
+        .single();
+      if (gErr || !grp) {
+        return new Response(JSON.stringify({ error: "Erreur création groupe" }), { status: 500, headers });
+      }
+      groupIds.push(grp.id);
+
+      // Crée les inscriptions membres
+      for (const m of t.members) {
+        const { data: insc, error: iErr } = await supabase
+          .from("inscriptions")
+          .insert({
+            course_id,
+            format_id,
+            groupe_id: grp.id,
+            nom: m.nom,
+            prenom: m.prenom,
+            email: m.email || email, // fallback payeur
+            statut: "en attente",
+            prix_total_coureur: pricePerRunner,
+            // on pourra enrichir après paiement (dossard, etc.)
+          })
+          .select()
+          .single();
+        if (iErr || !insc) {
+          return new Response(JSON.stringify({ error: "Erreur création inscription membre" }), { status: 500, headers });
+        }
+        inscriptionIds.push(insc.id);
+      }
+    }
+
+    // 2) Pré-insert paiement (type groupe/relais)
+    await supabase.from("paiements").insert({
+      inscription_id: null,
+      user_id,
+      montant_total: totalEuros,
+      devise: "eur",
+      status: "created",
+      type: mode, // 'groupe' | 'relais'
+      inscription_ids: inscriptionIds,
+      trace_id,
+      amount_subtotal: unitAmount,
+      amount_total: unitAmount,
+      destination_account_id: destinationAccount
+    });
+
+    const metadata = {
+      user_id: String(user_id),
+      course_id: String(course_id),
+      format_id: String(format_id),
+      trace_id,
+      mode,
+      multi: Array.isArray(teams) && teams.length > 1 ? "1" : "0",
+      group_ids: groupIds.join(","),           // pour le webhook
+      inscription_ids: inscriptionIds.join(","),// pour le webhook
+    };
 
-    // ✅ SCT : Checkout sur la PLATEFORME (pas de stripeAccount)
-    // Pas d'application_fee_amount ici; la commission sera retenue lors du transfer.
-    const session = await stripe.checkout.sessions.create({
-      mode: "payment",
-      payment_method_types: ["card"],
-      line_items: [{
-        price_data: {
-          currency: "eur",
-          product_data: { name: "Inscription à la course" },
-          unit_amount: unitAmount,
-        },
-        quantity: 1,
-      }],
-      customer_email: String(email),
-      payment_intent_data: {
-        transfer_group: `grp_${trace_id}`,  // lien charge <-> transfer
-        metadata,
-      },
-      success_url: (successUrl || "https://www.tickrace.com/merci") + "?session_id={CHECKOUT_SESSION_ID}&inscription_id="+inscription_id,
-      cancel_url: (cancelUrl || "https://www.tickrace.com/paiement-annule") + "?session_id={CHECKOUT_SESSION_ID}&inscription_id="+inscription_id,
-      metadata,
-    });
+    // 3) Session Stripe (SCT plateforme)
+    const session = await stripe.checkout.sessions.create({
+      mode: "payment",
+      payment_method_types: ["card"],
+      line_items: [{
+        price_data: {
+          currency: "eur",
+          product_data: { name: mode === "relais" ? "Inscription relais (équipe)" : "Inscription groupe (équipe)" },
+          unit_amount: unitAmount,
+        },
+        quantity: 1,
+      }],
+      customer_email: String(email),
+      payment_intent_data: {
+        transfer_group: `grp_${trace_id}`,
+        metadata,
+      },
+      success_url: (successUrl || "https://www.tickrace.com/merci") + "?session_id={CHECKOUT_SESSION_ID}",
+      cancel_url: (cancelUrl || "https://www.tickrace.com/paiement-annule") + "?session_id={CHECKOUT_SESSION_ID}",
+      metadata,
+    });
 
     return new Response(JSON.stringify({ url: session.url, trace_id }), { status: 200, headers });
   } catch (e: any) {
     console.error("create-checkout-session (SCT) error:", e?.message ?? e, e?.stack);
     return new Response(JSON.stringify({ error: "Erreur serveur" }), { status: 500, headers });
   }
 });
