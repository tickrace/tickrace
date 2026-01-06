export const config = { runtime: "edge" };


function isBot(ua: string) {
  const U = (ua || "").toLowerCase();
  return (
    U.includes("whatsapp") ||
    U.includes("facebookexternalhit") ||
    U.includes("facebot") ||
    U.includes("twitterbot") ||
    U.includes("slackbot") ||
    U.includes("discordbot") ||
    U.includes("telegrambot") ||
    U.includes("linkedinbot") ||
    U.includes("applebot") ||
    U.includes("preview")
  );
}

function escapeHtml(s: string) {
  return (s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export default async function handler(req: Request) {
  const ua = req.headers.get("user-agent") || "";
  const url = new URL(req.url);
  const id = url.pathname.split("/").pop();
  const origin = url.origin;

  // HTML Vite (SPA)
  const htmlRes = await fetch(`${origin}/index.html`);
  const html = await htmlRes.text();

  // ✅ Humans: renvoyer l’index normal (aucun changement)
  if (!isBot(ua)) {
    return new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  // ✅ Bots: injecter OG
  const ogRes = await fetch(`${origin}/api/og/course/${id}`, {
    headers: { "user-agent": ua },
  });
  if (!ogRes.ok) {
    return new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const og = await ogRes.json();

  const title = escapeHtml(og.title || "Tickrace");
  const desc = escapeHtml(og.description || "Inscriptions & infos sur Tickrace");
  const image = escapeHtml(og.image || "");
  const pageUrl = escapeHtml(og.url || `${origin}/courses/${id}`);

  const meta = `
    <title>${title}</title>
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Tickrace" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:url" content="${pageUrl}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${desc}" />
    <meta name="twitter:image" content="${image}" />
  `;

  const injected = html.replace("</head>", `${meta}\n</head>`);

  return new Response(injected, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // 👇 limite le cache côté bots/CDN
      "cache-control": "public, max-age=0, s-maxage=600",
    },
  });
}
