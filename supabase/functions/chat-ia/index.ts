// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import OpenAI from "https://esm.sh/openai@4.55.3";

interface ChatIARequest {
  course_id: string;
  parent_id?: string | null;
  prompt: string;
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const { course_id, parent_id, prompt } = await req.json() as ChatIARequest;
    if (!course_id || !prompt) return new Response("Missing course_id or prompt", { status: 400 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY")! });

    const { data: course } = await supabase
      .from("courses")
      .select("nom, lieu, date")
      .eq("id", course_id)
      .maybeSingle();

    const system = `Tu es l'assistant IA de Tickrace. Réponds brièvement, utilement et poliment.
Contexte: ${course?.nom ?? "Course"} à ${course?.lieu ?? "?"} le ${course?.date ?? "?"}.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt }
      ]
    });

    const aiText = completion.choices?.[0]?.message?.content?.trim() || "Désolé, je manque d'infos.";

    const IA_USER_ID = "00000000-0000-0000-0000-000000000000"; // garde cohérent avec tes policies

    const { error } = await supabase.from("chat_messages").insert({
      course_id,
      parent_id: parent_id ?? null,
      user_id: IA_USER_ID,
      nom: "IA",
      prenom: "Tickrace",
      message: aiText,
      is_hidden: false
    });

    if (error) {
      console.error("Insert AI message error:", error);
      return new Response("Insert failed", { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response("Server error", { status: 500 });
  }
});
