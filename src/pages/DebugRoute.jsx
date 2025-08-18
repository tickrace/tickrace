import React, { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { supabase } from "../supabase";

export default function DebugRoute() {
  const params = useParams();
  const location = useLocation();
  const [ping, setPing] = useState({ ok: false, count: 0, error: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.from("courses").select("id").limit(1);
        if (error) throw error;
        if (!cancelled) setPing({ ok: true, count: data?.length || 0, error: null });
      } catch (e) {
        console.error("Ping Supabase error:", e);
        if (!cancelled) setPing({ ok: false, count: 0, error: e.message || String(e) });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1>🧭 DebugRoute</h1>
      <p><strong>pathname:</strong> <code>{location.pathname}</code></p>
      <p><strong>search:</strong> <code>{location.search}</code></p>
      <p><strong>params:</strong> <code>{JSON.stringify(params)}</code></p>

      <h3>🔌 Supabase ping</h3>
      <pre style={{ background: "#111", color: "#0f0", padding: 12, borderRadius: 8 }}>
{JSON.stringify(ping, null, 2)}
      </pre>

      <p style={{ marginTop: 16 }}>
        <Link to="/mon-espace-organisateur">← Retour espace organisateur</Link>
      </p>
    </div>
  );
}
