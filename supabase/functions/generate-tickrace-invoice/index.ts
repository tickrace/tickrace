import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { z } from "https://esm.sh/zod@3.23.8";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FACTURES_BUCKET = Deno.env.get("FACTURES_BUCKET") || "factures";
const DEFAULT_VAT_BP = Number(Deno.env.get("TICKRACE_DEFAULT_VAT_BP") || "0");
const INTERNAL_INVOICE_KEY = Deno.env.get("INTERNAL_INVOICE_KEY") || "";

// --- LEGAL / BRAND
const LEGAL_NAME = Deno.env.get("TICKRACE_LEGAL_NAME") || "TickRace";
const LEGAL_ADDRESS = Deno.env.get("TICKRACE_LEGAL_ADDRESS") || "";
const LEGAL_SIRET = Deno.env.get("TICKRACE_LEGAL_SIRET") || "";
const LEGAL_VAT = Deno.env.get("TICKRACE_LEGAL_VAT") || "";
const LEGAL_EMAIL = Deno.env.get("TICKRACE_LEGAL_EMAIL") || "support@tickrace.com";
const LEGAL_WEBSITE = Deno.env.get("TICKRACE_LEGAL_WEBSITE") || "https://www.tickrace.com";

// Logo : priorité Storage bucket/path, sinon URL
const LOGO_BUCKET = Deno.env.get("TICKRACE_LOGO_BUCKET") || "";
const LOGO_PATH = Deno.env.get("TICKRACE_LOGO_PATH") || "";
const LOGO_URL = Deno.env.get("TICKRACE_LOGO_URL") || "";

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
  period_from: z.string().min(10),
  period_to: z.string().min(10),
  vat_bp: z.coerce.number().int().min(0).max(10000).optional(),
  organisateur_id: z.string().uuid().optional(),
  course_id: z.string().uuid().optional(),
  paiement_id: z.string().uuid().optional(),
}).strip();

// WinAnsi-safe
function pdfSafe(input: unknown) {
  return String(input ?? "")
    .replaceAll("→", "->")
    .replaceAll("—", "-")
    .replaceAll("–", "-")
    .replaceAll("\u00A0", " ")
    .replaceAll("\u202F", " ")
    .replaceAll("“", '"')
    .replaceAll("”", '"')
    .replaceAll("’", "'")
    .replaceAll("…", "...");
}

// Money sans toLocaleString (évite \u202F)
function eur(cents: number) {
  const v = Number(cents || 0) / 100;
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  const fixed = abs.toFixed(2);
  const [intPart, decPart] = fixed.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${grouped},${decPart} €`;
}

function todayFR() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

async function loadLogoBytes(): Promise<Uint8Array | null> {
  try {
    // A) Storage bucket/path
    if (LOGO_BUCKET && LOGO_PATH) {
      const dl = await supabase.storage.from(LOGO_BUCKET).download(LOGO_PATH);
      if (dl.error) {
        console.warn("LOGO_DOWNLOAD_ERROR", dl.error);
      } else {
        const ab = await dl.data.arrayBuffer();
        return new Uint8Array(ab);
      }
    }

    // B) URL publique
    if (LOGO_URL) {
      const r = await fetch(LOGO_URL);
      if (!r.ok) {
        console.warn("LOGO_FETCH_NOT_OK", r.status);
        return null;
      }
      const ab = await r.arrayBuffer();
      return new Uint8Array(ab);
    }

    return null;
  } catch (e) {
    console.warn("LOGO_LOAD_FATAL", e);
    return null;
  }
}

function looksLikePng(bytes: Uint8Array) {
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  return bytes?.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4E &&
    bytes[3] === 0x47;
}

async function buildPdf(params: {
  invoice_no: string;
  org_name: string;
  org_email?: string | null;
  org_phone?: string | null;
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

  const W = page.getWidth();
  const H = page.getHeight();
  const M = 48;
  const contentW = W - M * 2;

  const safe = (s: unknown) => pdfSafe(s);

  const drawText = (
    txt: unknown,
    x: number,
    y: number,
    size = 11,
    isBold = false,
    color = rgb(0, 0, 0),
  ) => {
    page.drawText(safe(txt), { x, y, size, font: isBold ? bold : font, color });
  };

  const textWidth = (txt: unknown, size = 11, isBold = false) => {
    const f = isBold ? bold : font;
    return f.widthOfTextAtSize(safe(txt), size);
  };

  const drawRight = (
    txt: unknown,
    xRight: number,
    y: number,
    size = 11,
    isBold = false,
    color = rgb(0, 0, 0),
  ) => {
    const w = textWidth(txt, size, isBold);
    drawText(txt, xRight - w, y, size, isBold, color);
  };

  const hr = (y: number, thickness = 1, color = rgb(0.86, 0.86, 0.86)) => {
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness, color });
  };

  const box = (
    x: number,
    y: number,
    w: number,
    h: number,
    fill = rgb(0.975, 0.975, 0.975),
    border = rgb(0.90, 0.90, 0.90),
  ) => {
    page.drawRectangle({ x, y, width: w, height: h, color: fill, borderColor: border, borderWidth: 1 });
  };

  // ---------- Header (logo + titre) ----------
  const top = H - M;

  // Logo
  const logoBytes = await loadLogoBytes();
  let headerLeftX = M;
  if (logoBytes) {
    try {
      const img = looksLikePng(logoBytes) ? await doc.embedPng(logoBytes) : await doc.embedJpg(logoBytes);
      const maxH = 38;
      const scale = maxH / img.height;
      const w = img.width * scale;
      const h = img.height * scale;

      page.drawImage(img, { x: M, y: top - h + 6, width: w, height: h });
      headerLeftX = M + w + 12;
    } catch (e) {
      console.warn("LOGO_EMBED_ERROR", e);
    }
  }

  drawText(LEGAL_NAME, headerLeftX, top - 8, 18, true);
  drawText("Facture - Commission plateforme", headerLeftX, top - 28, 11, true, rgb(0.15, 0.15, 0.15));

  // Infos facture à droite
  const infoX = W - M;
  drawRight(`Facture : ${params.invoice_no}`, infoX, top - 10, 12, true);
  drawRight(`Date : ${todayFR()}`, infoX, top - 28, 10, false, rgb(0.25, 0.25, 0.25));
  drawRight(`Periode : ${params.period_from} - ${params.period_to}`, infoX, top - 44, 10, false, rgb(0.25, 0.25, 0.25));

  hr(top - 58);

  // ---------- Parties blocks ----------
  const blockYTop = top - 78;
  const blockH = 110;
  const gap = 14;
  const blockW = (contentW - gap) / 2;

  // Emetteur
  box(M, blockYTop - blockH, blockW, blockH);
  drawText("Emetteur", M + 12, blockYTop - 18, 10, true, rgb(0.25, 0.25, 0.25));
  drawText(LEGAL_NAME, M + 12, blockYTop - 38, 12, true);

  let ey = blockYTop - 56;
  if (LEGAL_ADDRESS) { drawText(LEGAL_ADDRESS, M + 12, ey, 9, false, rgb(0.25, 0.25, 0.25)); ey -= 14; }
  if (LEGAL_SIRET)   { drawText(`SIRET : ${LEGAL_SIRET}`, M + 12, ey, 9, false, rgb(0.25, 0.25, 0.25)); ey -= 14; }
  if (LEGAL_VAT)     { drawText(`TVA : ${LEGAL_VAT}`, M + 12, ey, 9, false, rgb(0.25, 0.25, 0.25)); ey -= 14; }
  drawText(`Email : ${LEGAL_EMAIL}`, M + 12, ey, 9, false, rgb(0.25, 0.25, 0.25));

  // Client
  const clientX = M + blockW + gap;
  box(clientX, blockYTop - blockH, blockW, blockH);
  drawText("Client", clientX + 12, blockYTop - 18, 10, true, rgb(0.25, 0.25, 0.25));
  drawText(params.org_name || "-", clientX + 12, blockYTop - 38, 12, true);

  let cy = blockYTop - 56;
  drawText("Organisateur", clientX + 12, cy, 9, false, rgb(0.25, 0.25, 0.25));
  cy -= 14;
  if (params.org_email) { drawText(`Email : ${params.org_email}`, clientX + 12, cy, 9, false, rgb(0.25, 0.25, 0.25)); cy -= 14; }
  if (params.org_phone) { drawText(`Tel : ${params.org_phone}`, clientX + 12, cy, 9, false, rgb(0.25, 0.25, 0.25)); cy -= 14; }

  // ---------- Table ----------
  let y = blockYTop - blockH - 28;

  drawText("Designation", M, y, 11, true);
  drawRight("Montant", W - M, y, 11, true);
  hr(y - 8);

  y -= 28;

  const rowH = 18;
  const maxRows = 18;

  const lines = params.lines?.length
    ? params.lines
    : [{ label: "Commission TickRace", amount_cents: params.subtotal_cents }];

  let count = 0;
  for (const l of lines) {
    if (count >= maxRows) break;

    if (count % 2 === 0) {
      page.drawRectangle({
        x: M,
        y: y - 4,
        width: contentW,
        height: rowH,
        color: rgb(0.985, 0.985, 0.985),
      });
    }

    drawText(l.label || "-", M, y, 10, false, rgb(0.10, 0.10, 0.10));
    drawRight(eur(Number(l.amount_cents || 0)), W - M, y, 10, true, rgb(0.10, 0.10, 0.10));

    y -= rowH;
    count++;
  }

  hr(y + 8);

  // ---------- Totaux ----------
  y -= 18;

  const totalsXRight = W - M;
  const labelXRight = totalsXRight - 130;

  const tLabel = (t: string, yy: number) => drawRight(t, labelXRight, yy, 11, false, rgb(0.25, 0.25, 0.25));
  const tVal = (t: string, yy: number, bolded = true) => drawRight(t, totalsXRight, yy, 11, bolded);

  tLabel("Sous-total", y);
  tVal(eur(params.subtotal_cents), y);

  y -= 18;
  tLabel(`TVA (${(params.vat_bp / 100).toFixed(2)}%)`, y);
  tVal(eur(params.vat_cents), y);

  y -= 20;
  page.drawRectangle({
    x: totalsXRight - 220,
    y: y - 6,
    width: 220,
    height: 24,
    color: rgb(0.95, 0.95, 0.95),
    borderColor: rgb(0.90, 0.90, 0.90),
    borderWidth: 1,
  });
  drawRight("TOTAL", labelXRight, y, 12, true);
  drawRight(eur(params.total_cents), totalsXRight, y, 12, true);

  // ---------- Footer ----------
  const footerY = M - 6;
  hr(footerY + 18, 1, rgb(0.90, 0.90, 0.90));

  const footer1 = `${LEGAL_NAME} - ${LEGAL_WEBSITE}`;
  const footer2 = `Support : ${LEGAL_EMAIL}`;
  const footer3 = `Document genere automatiquement.`;

  drawText(footer1, M, footerY + 8, 9, false, rgb(0.35, 0.35, 0.35));
  drawText(footer2, M, footerY - 4, 9, false, rgb(0.35, 0.35, 0.35));
  drawText(footer3, M, footerY - 16, 9, false, rgb(0.35, 0.35, 0.35));

  return await doc.save();
}

serve(async (req) => {
  const headers = cors();
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const internalKey = req.headers.get("x-internal-key") || "";
    const isInternal = INTERNAL_INVOICE_KEY && internalKey === INTERNAL_INVOICE_KEY;
    if (!isInternal && !authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const body = Body.parse(await req.json());
    const periodFrom = body.period_from;
    const periodTo = body.period_to;
    const vatBp = typeof body.vat_bp === "number" ? body.vat_bp : DEFAULT_VAT_BP;

    let organisateurId = "";
    if (isInternal) {
      organisateurId = body.organisateur_id || "";
      if (!organisateurId) return json({ error: "missing_organisateur_id" }, 400);
    } else {
      const jwt = authHeader.replace("Bearer ", "");
      const { data: u, error: uErr } = await supabase.auth.getUser(jwt);
      if (uErr || !u?.user?.id) return json({ error: "unauthorized" }, 401);
      organisateurId = u.user.id;
    }

    // Profil orga (nom + contact)
    const { data: prof, error: pErr } = await supabase
      .from("profils_utilisateurs")
      .select("organisation_nom, structure, email, telephone")
      .eq("user_id", organisateurId)
      .maybeSingle();
    if (pErr) throw pErr;

    const orgName = (prof?.organisation_nom || prof?.structure || "").toString();
    const orgEmail = prof?.email ?? null;
    const orgPhone = prof?.telephone ?? null;

    // Ledger -> somme tickrace_fee_cents sur période
    let ledgerQuery = supabase
      .from("organisateur_ledger_v")
      .select("course_id, course_nom, tickrace_fee_cents, occurred_at, source_table, source_id")
      .eq("organisateur_id", organisateurId)
      .eq("status", "confirmed");

    if (body.paiement_id) {
      ledgerQuery = ledgerQuery.eq("source_table", "paiements").eq("source_id", body.paiement_id);
    } else {
      ledgerQuery = ledgerQuery
        .gte("occurred_at", `${periodFrom}T00:00:00+00`)
        .lte("occurred_at", `${periodTo}T23:59:59+00`);
    }

    if (body.course_id) {
      ledgerQuery = ledgerQuery.eq("course_id", body.course_id);
    }

    const { data: led, error: ledErr } = await ledgerQuery;
    if (ledErr) throw ledErr;

    const byCourse = new Map<string, { amount: number; label: string }>();
    for (const r of led || []) {
      const cid = r.course_id || "unknown";
      const v = Number(r.tickrace_fee_cents || 0);
      if (!v) continue;
      const label = (r as any)?.course_nom || (cid === "unknown" ? "-" : cid);
      const prev = byCourse.get(cid) || { amount: 0, label };
      prev.amount += v;
      if (!prev.label || prev.label === cid) prev.label = label;
      byCourse.set(cid, prev);
    }

    // Fallback: si course_nom absent dans la vue, on hydrate depuis courses
    const courseIds = [...byCourse.keys()].filter((x) => x !== "unknown");
    const coursesMap = new Map<string, string>();
    if (courseIds.length) {
      const { data: cs } = await supabase.from("courses").select("id, nom").in("id", courseIds);
      for (const c of cs || []) coursesMap.set(c.id, c.nom || c.id);
    }

    const lines = [...byCourse.entries()]
      .filter(([, v]) => v.amount !== 0)
      .map(([courseId, v]) => ({
        course_id: courseId === "unknown" ? null : courseId,
        label: v.label || (courseId === "unknown" ? "-" : (coursesMap.get(courseId) || courseId)),
        amount_cents: v.amount,
      }))
      .sort((a, b) => b.amount_cents - a.amount_cents);

    const subtotal = lines.reduce((s, l) => s + Number(l.amount_cents || 0), 0);
    const vat = Math.round(subtotal * (vatBp / 10000));
    const total = subtotal + vat;

    const { data: invoiceNo, error: noErr } = await supabase.rpc("next_tickrace_invoice_no", {
      p_organisateur_id: organisateurId,
      p_date: periodFrom,
    });
    if (noErr) throw noErr;

    const pdfBytes = await buildPdf({
      invoice_no: String(invoiceNo),
      org_name: orgName || "-",
      org_email: orgEmail,
      org_phone: orgPhone,
      period_from: periodFrom,
      period_to: periodTo,
      subtotal_cents: subtotal,
      vat_bp: vatBp,
      vat_cents: vat,
      total_cents: total,
      lines: lines.map((l) => ({ label: l.label, amount_cents: l.amount_cents })),
    });

    const pdfPath = `${organisateurId}/${invoiceNo}.pdf`;
    const up = await supabase.storage
      .from(FACTURES_BUCKET)
      .upload(pdfPath, new Blob([pdfBytes], { type: "application/pdf" }), { upsert: true });

    if (up.error) {
      const msg = String(up.error?.message || up.error);
      if (msg.includes("Bucket not found")) {
        throw new Error(`Bucket Storage introuvable: ${FACTURES_BUCKET}. Cree-le ou change FACTURES_BUCKET.`);
      }
      throw up.error;
    }

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
