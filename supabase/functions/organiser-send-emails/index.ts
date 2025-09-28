// ...imports & setup identiques à ta version précédente...

serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });

  try {
    const body = await req.json();
    const {
      format_id,
      inscription_ids,   // <--- NEW: string[] | null
      subject,
      html,
      reply_to,
      test_email,
      only_status,
      extra_vars = {},
    } = body ?? {};

    if ((!format_id && !(inscription_ids?.length)) || !subject || !html) {
      return new Response(JSON.stringify({ error: "format_id OU inscription_ids requis, ainsi que subject/html" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    // Récup format + course si format_id fourni (sert pour variables)
    let format: any = null;
    if (format_id) {
      const { data: f } = await admin
        .from("formats")
        .select("id, nom, course_id, course:course_id(id, nom, lieu)")
        .eq("id", format_id)
        .maybeSingle();
      format = f;
    }

    // Récipiendaires
    let recipients: any[] = [];
    if (test_email) {
      recipients = [{ email: test_email, nom: "Test", prenom: "Test", groupe: null }];
    } else if (inscription_ids?.length) {
      const { data } = await admin
        .from("inscriptions")
        .select("id, nom, prenom, email, groupe:groupe_id(nom_groupe), format_id")
        .in("id", inscription_ids);
      recipients = (data || []).filter((r) => r?.email);
    } else {
      let q = admin
        .from("inscriptions")
        .select("id, nom, prenom, email, statut, groupe:groupe_id(nom_groupe), format_id")
        .eq("format_id", format_id);
      if (only_status) q = q.eq("statut", only_status);
      const { data } = await q;
      recipients = (data || []).filter((r) => r?.email);
    }

    let sent = 0;
    const formatNom = format?.nom || "";
    const courseNom = format?.course?.nom || "";
    const courseLieu = format?.course?.lieu || "";

    for (const r of recipients) {
      const vars = {
        prenom: r?.prenom || "",
        nom: r?.nom || "",
        email: r?.email || "",
        team_name: r?.groupe?.nom_groupe || "",
        format_nom: formatNom,
        course_nom: courseNom,
        course_lieu: courseLieu,
        ...extra_vars,
      };
      const renderedSubject = render(subject, vars);
      const renderedHtml = render(html, vars);
      try {
        await resend.emails.send({
          from: "Tickrace <noreply@tickrace.com>",
          to: r.email,
          subject: renderedSubject,
          html: renderedHtml,
          reply_to: reply_to || undefined,
        });
        sent++;
      } catch {
        // continuer
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, total: recipients.length }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Bad Request", details: String(e) }), {
      status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }
});
