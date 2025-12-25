// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") || "https://www.tickrace.com";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "Tickrace <support@tickrace.com>";

async function sendResendEmail(to: string, subject: string, html: string) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Resend error: ${r.status} ${txt}`);
  }
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await supabaseUserClient.auth.getUser();
    const user = u?.user;
    if (!user) return new Response("Unauthorized", { status: 401 });

    const body = await req.json().catch(() => ({}));
    const courseId = body.courseId as string | undefined;
    if (!courseId) return new Response("Missing courseId", { status: 400 });

    const supabaseSR = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ✅ Check course ownership (organisateur_id)
    const { data: course, error: cErr } = await supabaseSR
      .from("courses")
      .select("id, nom, organisateur_id")
      .eq("id", courseId)
      .maybeSingle();

    if (cErr || !course) return new Response("Course not found", { status: 404 });
    if (course.organisateur_id !== user.id) return new Response("Forbidden", { status: 403 });

    // ✅ Volunteers to invite
    const { data: benevoles, error: bErr } = await supabaseSR
      .from("benevoles")
      .select("id, email, prenom, nom, status, invite_count, last_invite_at")
      .eq("course_id", courseId)
      .in("status", ["registered", "invited"]);

    if (bErr) throw bErr;

    const redirectTo = `${SITE_URL}/benevole/${courseId}`;

    const results: any[] = [];
    for (const b of benevoles || []) {
      // petite règle anti-spam : pas + d'1 invite / 10 minutes
      const last = b.last_invite_at ? new Date(b.last_invite_at).getTime() : 0;
      const now = Date.now();
      if (last && now - last < 10 * 60 * 1000) {
        results.push({ id: b.id, email: b.email, skipped: true, reason: "recently_invited" });
        continue;
      }

      // 1) generate magic link (fallback signup)
      let actionLink = "";
      let genErr: any = null;

      const gen1 = await supabaseSR.auth.admin.generateLink({
        type: "magiclink",
        email: b.email,
        options: { redirectTo },
      });
      if (gen1.error) {
        genErr = gen1.error;
        const gen2 = await supabaseSR.auth.admin.generateLink({
          type: "signup",
          email: b.email,
          options: { redirectTo },
        });
        if (gen2.error) throw gen2.error;
        actionLink = gen2.data.properties.action_link;
      } else {
        actionLink = gen1.data.properties.action_link;
      }

      const subject = `Bienvenue dans l’équipe bénévoles — ${course.nom}`;
      const html = `
        <div style="font-family:Inter,system-ui,Arial;line-height:1.5">
          <h2>Bonjour ${b.prenom || ""} 👋</h2>
          <p>Tu as été invité(e) dans l’espace bénévoles de <b>${course.nom}</b>.</p>
          <p>
            <a href="${actionLink}" style="display:inline-block;padding:12px 16px;border-radius:12px;background:#111;color:#fff;text-decoration:none">
              Accéder à mon espace bénévole
            </a>
          </p>
          <p style="color:#666;font-size:12px">
            Si le bouton ne marche pas, copie/colle ce lien :<br/>
            ${actionLink}
          </p>
          <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
          <p style="color:#666;font-size:12px">
            Astuce : tu retrouveras ton planning, ta mission et le chat équipe directement dans la page.
          </p>
        </div>
      `;

      await sendResendEmail(b.email, subject, html);

      // Update volunteer
      await supabaseSR
        .from("benevoles")
        .update({
          invited_at: new Date().toISOString(),
          last_invite_at: new Date().toISOString(),
          invite_count: (b.invite_count || 0) + 1,
          status: "invited",
        })
        .eq("id", b.id);

      results.push({ id: b.id, email: b.email, sent: true, usedFallbackSignup: !!genErr });
    }

    return new Response(JSON.stringify({ ok: true, count: results.length, results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
