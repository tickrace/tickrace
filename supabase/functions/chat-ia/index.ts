// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import OpenAI from "https://esm.sh/openai@4.55.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ChatIARequest {
  course_id: string;
  parent_id?: string | null;
  prompt: string;
}

serve(async (req) => {
  // Préflight CORS
  if (req.method === "OPTIONS") {
  // 204 No Content => pas de body !
  return new Response(null, { headers: corsHeaders, status: 204 });
}


  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { course_id, parent_id, prompt } = (await req.json()) as ChatIARequest;

    if (!course_id || !prompt) {
      return new Response(JSON.stringify({ error: "Missing course_id or prompt" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!SUPABASE_URL || !SERVICE_KEY || !OPENAI_API_KEY) {
      console.error("Env missing", { hasUrl: !!SUPABASE_URL, hasService: !!SERVICE_KEY, hasOpenAI: !!OPENAI_API_KEY });
      return new Response(JSON.stringify({ error: "Missing environment variables" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    // Contexte course (facultatif)
    const { data: course, error: courseErr } = await supabase
      .from("courses")
      .select("nom, lieu, date")
      .eq("id", course_id)
      .maybeSingle();
    if (courseErr) console.error("Course fetch error:", courseErr);

    const system = `Tu es l'assistant IA de Tickrace. Réponds brièvement, utilement et poliment.
Contexte: ${course?.nom ?? "Course"} à ${course?.lieu ?? "?"} le ${course?.date ?? "?"}.`;

    let aiText = "Désolé, je n'ai pas assez d'infos pour répondre.";
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      });
      aiText = completion.choices?.[0]?.message?.content?.trim() || aiText;
    } catch (e) {
      console.error("OpenAI error:", e);
      aiText = "🤖 IA momentanément indisponible. Réessaie dans un instant.";
    }

    const IA_USER_ID = "00000000-0000-0000-0000-000000000000";

    const { error: insertErr } = await supabase.from("chat_messages").insert({
      course_id,
      parent_id: parent_id ?? null,
      user_id: IA_USER_ID,
      nom: "IA",
      prenom: "Tickrace",
      message: aiText,
      is_hidden: false,
    });

    if (insertErr) {
      console.error("Insert AI message error:", insertErr);
      return new Response(JSON.stringify({ error: "Insert failed", details: insertErr?.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Function error:", e);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
