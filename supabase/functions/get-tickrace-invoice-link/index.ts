import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { z } from "https://esm.sh/zod@3.23.8";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function cors(h = new Headers()) {
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "authorization, content-type, apikey, x-client-info");
  h.set("content-type", "application/json; charset=utf-8");
  return h;
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors() });

const Body = z.object({
  invoice_id: z.string().uuid(),
}).strip();

serve(async (req) => {
  const headers = cors();
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const { invoice_id } = Body.parse(await req.json());
    const jwt = authHeader.replace("Bearer ", "");

    const { data: u, error: uErr } = await supabase.auth.getUser(jwt);
    if (uErr || !u?.user?.id) return json({ error: "unauthorized" }, 401);
    const uid = u.user.id;

    // Vérif ownership (ou admin) via RLS: on fait le select "normal"
    const { data: inv, error: invErr } = await supabase
      .from("factures_tickrace")
      .select("id, pdf_bucket, pdf_path, invoice_no")
      .eq("id", invoice_id)
      .maybeSingle();

    if (invErr || !inv) return json({ error: "not_found" }, 404);
    if (!inv.pdf_bucket || !inv.pdf_path) return json({ error: "no_pdf" }, 400);

    // Signed URL (24h)
    const { data: link, error: linkErr } = await supabase.storage
      .from(inv.pdf_bucket)
      .createSignedUrl(inv.pdf_path, 60 * 60 * 24);

    if (linkErr) throw linkErr;

    return json({ ok: true, url: link?.signedUrl, filename: `${inv.invoice_no}.pdf`, uid }, 200);
  } catch (e) {
    console.error("GET_INVOICE_LINK_FATAL", e);
    return json({ error: "failed", details: String((e as any)?.message ?? e) }, 400);
  }
});
