if (event.type === "checkout.session.completed") {
  const session = event.data.object;
  const user_id = session.metadata?.user_id;
  const format_id = session.metadata?.format_id;
  const course_id = session.metadata?.course_id;
  const montant_total = session.amount_total / 100;
  const stripe_payment_intent_id = session.payment_intent;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 🧠 Correction : récupérer toutes les inscriptions en attente liées à cet utilisateur
  const { data: inscriptions, error: errIns } = await supabase
    .from("inscriptions")
    .select("id, email, nom, prenom")
    .eq("coureur_id", user_id)
    .eq("statut", "en attente");

  if (errIns || !inscriptions || inscriptions.length === 0) {
    console.error("❌ Aucune inscription trouvée pour ce paiement.");
    return new Response("Inscriptions manquantes", {
      status: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  const inscriptionIds = inscriptions.map((i) => i.id);

  // ✅ Mettre à jour TOUS les statuts
  const { error: errUpdate } = await supabase
    .from("inscriptions")
    .update({ statut: "validée" })
    .in("id", inscriptionIds);

  if (errUpdate) {
    console.error("❌ Erreur update inscriptions :", errUpdate.message);
    return new Response("Erreur update", {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  // ✅ Insérer le paiement groupé
  const paiementData = {
  user_id,
  inscription_ids: inscriptionIds,
  montant_total,
  devise: "EUR",
  stripe_payment_intent_id,
  status: "succeeded",
  reversement_effectue: false,
};

if (inscriptionIds.length === 1) {
  paiementData["inscription_id"] = inscriptionIds[0];
  paiementData["type"] = "individuel";
} else {
  paiementData["inscription_id"] = null;
  paiementData["type"] = "groupé";
}

const { error: errPaiement } = await supabase
  .from("paiements")
  .insert(paiementData);


  if (errPaiement) {
    console.error("❌ Erreur insertion paiement :", errPaiement.message);
    return new Response("Erreur paiement", {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  console.log(`✅ Paiement groupé confirmé : ${montant_total} € pour ${inscriptionIds.length} inscriptions`);

  // ✅ Envoi d’un email à chaque coureur inscrit
  for (const i of inscriptions) {
    const lien = `https://www.tickrace.com/mon-inscription/${i.id}`;
    const html = `
      <p>Bonjour ${i.prenom} ${i.nom},</p>
      <p>Votre inscription est confirmée 🎉</p>
      <p><strong>Numéro d'inscription :</strong> ${i.id}</p>
      <p>👉 <a href="${lien}">Voir mon inscription</a></p>
      <p>Merci pour votre confiance et à bientôt sur la ligne de départ !</p>
      <p>L'équipe Tickrace</p>
    `;

    try {
      await resend.emails.send({
        from: "Tickrace <inscription@tickrace.com>",
        to: i.email,
        subject: "Votre inscription est confirmée ✔️",
        html,
      });
      console.log(`📧 Email envoyé à ${i.email}`);
    } catch (e) {
      console.error(`❌ Erreur Resend vers ${i.email} :`, e.message);
    }
  }
}
