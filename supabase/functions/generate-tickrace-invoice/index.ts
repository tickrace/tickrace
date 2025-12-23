import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { PDFDocument, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { z } from "https://esm.sh/zod@3.23.8";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const FACTURES_BUCKET = Deno.env.get("FACTURES_BUCKET") || "factures";
const DEFAULT_VAT_BP = Number(Deno.env.get("TICKRACE_DEFAULT_VAT_BP") || "0"); // ex 2000 pour 20%

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
  period_from: z.string().min(10), // YYYY-MM-DD
  period_to: z.string().min(10),   // YYYY-MM-DD
  vat_bp: z.number().int().min(0).max(10000).optional(),
}).strip();

function eur(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

async function buildPdf(params: {
  invoice_no: string;
  org_name: string;
  period_from: string;
  period_to: string;
  subtotal_cents: number;
  vat_bp: number;
  vat_cents: number;
  total_cents: number;
  lines: Array<{ label: string; amount_cents: number }>;
}) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = 800;
  const left = 50;

  const draw = (txt: string, size = 11, isBold = false) => {
    page.drawText(txt, { x: left, y, size, font: isBold ? bold : font });
    y -= size + 6;
  };

  draw("TickRace", 20, true);
  draw("Facture de commission plateforme", 12, true);
  y -= 8;

  draw(`Facture : ${params.invoice_no}`, 12, true);
  draw(`Organisateur : ${params.org_name || "—"}`);
  draw(`Période : ${params.period_from} → ${params.period_to}`);
  y -= 10;

  draw("Détail (commission TickRace)", 12, true);
  y -= 4;

  for (const l of params.lines) {
    draw(`• ${l.label} — ${eur(l.amount_cents)}`, 11, false);
    if (y < 120) break; // simple garde-fou
  }

  y -= 12;
  draw(`Sous-total : ${eur(params.subtotal_cents)}`, 12, true);
  draw(`TVA : ${(params.vat_bp / 100).toFixed(2)}%  — ${eur(params.vat_cents)}`, 12, true);
  draw(`Total : ${eur(params.total_cents)}`, 14, true);

  const bytes = await doc.save();
  return bytes;
}

serve(async (req) => {
  const headers = cors();
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const body = Body.parse(await req.json());
    const periodFrom = body.period_from;
    const periodTo = body.period_to;
    const vatBp = typeof body.vat_bp === "number" ? body.vat_bp : DEFAULT_VAT_BP;

    // Qui appelle ?
    const jwt = authHeader.replace("Bearer ", "");
    const { data: u, error: uErr } = await supabase.auth.getUser(jwt);
    if (uErr || !u?.user?.id) return json({ error: "unauthorized" }, 401);
    const organisateurId = u.user.id;

    // Profil (nom)
    const { data: prof } = await supabase
      .from("profils_utilisateurs")
      .select("organisation_nom, structure")
      .eq("user_id", organisateurId)
      .maybeSingle();

    const orgName = (prof?.organisation_nom || prof?.structure || "").toString();

    // Ledger -> commission TickRace sur période (on somme tickrace_fee_cents)
    // Période inclusif sur occurred_at
    const { data: led, error: ledErr } = await supabase
      .from("organisateur_ledger")
      .select("course_id, tickrace_fee_cents, occurred_at")
      .eq("organisateur_id", organisateurId)
      .eq("status", "confirmed")
      .gte("occurred_at", `${periodFrom}T00:00:00+00`)
      .lte("occurred_at", `${periodTo}T23:59:59+00`);

    if (ledErr) throw ledErr;

    const byCourse = new Map<string, number>();
    for (const r of led || []) {
      const cid = r.course_id || "unknown";
      const v = Number(r.tickrace_fee_cents || 0);
      if (!v) continue;
      byCourse.set(cid, (byCourse.get(cid) || 0) + v);
    }

    const courseIds = [...byCourse.keys()].filter((x) => x !== "unknown");
    let coursesMap = new Map<string, string>();
    if (courseIds.length) {
      const { data: cs } = await supabase.from("courses").select("id, nom").in("id", courseIds);
      for (const c of cs || []) coursesMap.set(c.id, c.nom || c.id);
    }

    const lines = [...byCourse.entries()]
      .filter(([, amount]) => amount !== 0)
      .map(([courseId, amount]) => ({
        course_id: courseId === "unknown" ? null : courseId,
        label: courseId === "unknown" ? "—" : (coursesMap.get(courseId) || courseId),
        amount_cents: amount,
      }))
      .sort((a, b) => b.amount_cents - a.amount_cents);

    const subtotal = lines.reduce((s, l) => s + Number(l.amount_cents || 0), 0);
    const vat = Math.round(subtotal * (vatBp / 10000));
    const total = subtotal + vat;

    // Numéro facture (RPC)
    const { data: invoiceNo, error: noErr } = await supabase.rpc("next_tickrace_invoice_no", {
      p_organisateur_id: organisateurId,
      p_date: periodFrom,
    });
    if (noErr) throw noErr;

    // Génère PDF
    const pdfBytes = await buildPdf({
      invoice_no: invoiceNo,
      org_name: orgName,
      period_from: periodFrom,
      period_to: periodTo,
      subtotal_cents: subtotal,
      vat_bp: vatBp,
      vat_cents: vat,
      total_cents: total,
      lines: lines.map((l) => ({ label: l.label, amount_cents: l.amount_cents })),
    });

    // Upload (bucket privé conseillé)
    const pdfPath = `${organisateurId}/${invoiceNo}.pdf`;
    const up = await supabase.storage
      .from(FACTURES_BUCKET)
      .upload(pdfPath, new Blob([pdfBytes], { type: "application/pdf" }), { upsert: true });

    if (up.error) throw up.error;

    // Insert facture
    const { data: inv, error: invErr } = await supabase
      .from("factures_tickrace")
      .insert({
        organisateur_id: organisateurId,
        period_from: periodFrom,
        period_to: periodTo,
        invoice_no: invoiceNo,
        status: "issued",
        currency: "eur",
        subtotal_cents: subtotal,
        vat_rate_bp: vatBp,
        vat_cents: vat,
        total_cents: total,
        lines,
        pdf_bucket: FACTURES_BUCKET,
        pdf_path: pdfPath,
      })
      .select("*")
      .single();

    if (invErr) throw invErr;

    return json({ ok: true, invoice: inv }, 200);
  } catch (e) {
    console.error("GENERATE_INVOICE_FATAL", e);
    return json({ error: "failed", details: String((e as any)?.message ?? e) }, 400);
  }
});
