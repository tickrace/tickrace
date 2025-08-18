void (async function testAdminStats() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.warn("⚠️ Pas de session active : connecte-toi d'abord.");
      return;
    }

    const url = "https://pecotcxpcqfkwvyylvjv.supabase.co/functions/v1/admin-stats";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    console.log("HTTP status:", res.status);
    console.log("Access-Control-Allow-Origin:", res.headers.get("access-control-allow-origin"));
    console.log("Body:", await res.text());
  } catch (err) {
    console.error("Erreur:", err);
  }
})();
