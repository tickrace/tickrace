// supabase/functions/support-upsertcourse/index.ts
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabaseSR = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
      "access-control-allow-methods": "POST, OPTIONS",
    },
  });
}

async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const arr = Array.from(new Uint8Array(digest));
  return arr.map(b => b.toString(16).padStart(2, "0")).join("");
}

async function isAdmin(userId: string) {
  // table "admins" supposée existante chez toi
  const { data, error } = await supabaseSR.from("admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (error) return false;
  return !!data;
}

async function auditSafe(payload: any) {
  // best effort : ne casse pas la fonction si le schéma diffère
  try {
    await supabaseSR.from("admin_audit_logs").insert(payload);
  } catch (_) {
    // ignore
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true }, 200);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const auth = req.headers.get("authorization") || "";
    const jwt = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
    if (!jwt) return json({ error: "Missing Authorization bearer token" }, 401);

    const { data: userRes, error: userErr } = await supabaseSR.auth.getUser(jwt);
    if (userErr || !userRes?.user) return json({ error: "Invalid user token" }, 401);
    const caller = userRes.user;

    const okAdmin = await isAdmin(caller.id);
    if (!okAdmin) return json({ error: "Forbidden (admin only)" }, 403);

    const body = await req.json().catch(() => ({}));
    const token = String(body?.token || "");
    const action = String(body?.action || "");
    const payload = body?.payload ?? {};

    if (!token || token.length < 20) return json({ error: "Missing/invalid token" }, 400);
    if (!action) return json({ error: "Missing action" }, 400);

    const token_hash = await sha256Hex(token);

    // Charge session
    const { data: sess, error: sessErr } = await supabaseSR
      .from("support_sessions")
      .select("id, scope, status, organisateur_id, course_id, expires_at, revoked_at, ended_at, admin_id")
      .eq("token_hash", token_hash)
      .maybeSingle();

    if (sessErr || !sess) return json({ error: "Support session not found" }, 404);

    // Vérifs session
    if (sess.scope !== "upsertcourse") return json({ error: "Invalid scope" }, 403);
    if (sess.status === "revoked") return json({ error: "Session revoked" }, 403);
    if (sess.status === "ended") return json({ error: "Session ended" }, 403);
    if (sess.revoked_at) return json({ error: "Session revoked" }, 403);
    if (sess.ended_at) return json({ error: "Session ended" }, 403);

    const exp = new Date(sess.expires_at).getTime();
    if (Number.isFinite(exp) && Date.now() > exp) {
      return json({ error: "Session expired" }, 403);
    }

    // Active la session au 1er usage
    if (sess.status === "requested") {
      await supabaseSR
        .from("support_sessions")
        .update({
          status: "active",
          admin_id: caller.id,
          activated_at: new Date().toISOString(),
        })
        .eq("id", sess.id)
        .eq("status", "requested");
    }

    const orgId = sess.organisateur_id;

    // ---------------- Actions ----------------
    if (action === "courses.list") {
      const { data, error } = await supabaseSR
        .from("courses")
        .select("*")
        .eq("organisateur_id", orgId)
        .order("created_at", { ascending: false });

      if (error) return json({ error: error.message }, 400);

      await auditSafe({
        admin_id: caller.id,
        action: "support:courses.list",
        entity: "support_sessions",
        entity_id: sess.id,
        meta: { orgId },
      });

      return json({ ok: true, data });
    }

    if (action === "course.load") {
      const courseId = String(payload?.courseId || sess.course_id || "");
      if (!courseId) return json({ error: "Missing courseId" }, 400);

      const { data: course, error: cErr } = await supabaseSR
        .from("courses")
        .select("*")
        .eq("id", courseId)
        .eq("organisateur_id", orgId)
        .maybeSingle();

      if (cErr) return json({ error: cErr.message }, 400);
      if (!course) return json({ error: "Course not found for this organizer" }, 404);

      const { data: formats, error: fErr } = await supabaseSR
        .from("formats")
        .select("*")
        .eq("course_id", courseId)
        .order("created_at", { ascending: true });

      if (fErr) return json({ error: fErr.message }, 400);

      await auditSafe({
        admin_id: caller.id,
        action: "support:course.load",
        entity: "courses",
        entity_id: courseId,
        meta: { orgId },
      });

      return json({ ok: true, course, formats });
    }

    if (action === "course.save") {
      // payload: { courseId?, course, formats? }
      const courseId = payload?.courseId ? String(payload.courseId) : null;
      const coursePatch = payload?.course || {};
      const formats = Array.isArray(payload?.formats) ? payload.formats : null;

      // Force organisateur_id = orgId (on ignore ce que le front envoie)
      coursePatch.organisateur_id = orgId;

      let savedCourse: any = null;

      if (!courseId) {
        const { data, error } = await supabaseSR
          .from("courses")
          .insert(coursePatch)
          .select("*")
          .single();
        if (error) return json({ error: error.message }, 400);
        savedCourse = data;
      } else {
        // Vérifie ownership avant update
        const { data: existing, error: exErr } = await supabaseSR
          .from("courses")
          .select("id")
          .eq("id", courseId)
          .eq("organisateur_id", orgId)
          .maybeSingle();
        if (exErr) return json({ error: exErr.message }, 400);
        if (!existing) return json({ error: "Course not found for this organizer" }, 404);

        const { data, error } = await supabaseSR
          .from("courses")
          .update(coursePatch)
          .eq("id", courseId)
          .eq("organisateur_id", orgId)
          .select("*")
          .single();

        if (error) return json({ error: error.message }, 400);
        savedCourse = data;
      }

      // Formats: stratégie simple = replace
      if (formats) {
        const cid = savedCourse.id;

        // delete old formats
        const { error: delErr } = await supabaseSR
          .from("formats")
          .delete()
          .eq("course_id", cid);

        if (delErr) return json({ error: delErr.message }, 400);

        const rows = formats.map((f: any) => ({ ...f, course_id: cid }));
        if (rows.length) {
          const { error: insErr } = await supabaseSR
            .from("formats")
            .insert(rows);
          if (insErr) return json({ error: insErr.message }, 400);
        }
      }

      await auditSafe({
        admin_id: caller.id,
        action: "support:course.save",
        entity: "courses",
        entity_id: savedCourse.id,
        meta: { orgId, created: !courseId, formatsReplaced: !!formats },
      });

      return json({ ok: true, course: savedCourse });
    }

    if (action === "support.end") {
      await supabaseSR
        .from("support_sessions")
        .update({
          status: "ended",
          ended_at: new Date().toISOString(),
        })
        .eq("id", sess.id);

      await auditSafe({
        admin_id: caller.id,
        action: "support:end",
        entity: "support_sessions",
        entity_id: sess.id,
        meta: { orgId },
      });

      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e: any) {
    return json({ error: e?.message || "Unknown error" }, 500);
  }
});
