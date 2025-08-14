import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../supabase";

export default function Merci() {
  const [sp] = useSearchParams();
  const sessionId = sp.get("session_id");
  const inscriptionId = sp.get("inscription_id");

  useEffect(() => {
    const run = async () => {
      if (!sessionId || !inscriptionId) return;
      const { error } = await supabase.functions.invoke("verify-checkout-session", {
        body: { session_id: sessionId, inscription_id: inscriptionId },
      });
      if (error) console.error("verify-checkout-session error", error);
    };
    run();
  }, [sessionId, inscriptionId]);

  return /* ... votre page Merci ... */;
}
