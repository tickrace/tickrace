export const config = { runtime: "edge" };

function escapeHtml(s: string) {
  return (s || "")
    .split("&").join("&amp;")
    .split("<").join("&lt;")
    .split(">").join("&gt;")
    .split('"').join("&quot;");
}

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

export default async function handler(req: Request) {
  const ua = req.headers.get("user-agent") || "";
  const url = new URL(req.url);
  const id = url.pathname.split("/").pop() || "";
  const origin = url.origin;

  // ✅ si humain -> renvoyer l'app SPA
  if (!isBot(ua) && url.searchParams.get("app") === "1") {
    const spa = await fetch(`${origin}/`);
    const html = await spa.text();
    return new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  // ✅ récupérer les infos OG
  const ogRes = await fetch(`${origin}/api/og-course?id=${encodeURIComponent(id)}`, {
    headers: { "user-agent": ua },
  });

  const og = ogRes.ok
    ? await ogRes.json()
    : {
        title: "Tickrace",
        description: "Inscriptions & infos sur Tickrace",
        url: `${origin}/courses/${id}`,
        image: `${origin}/api/og-image?id=${encodeURIComponent(id)}`,
      };

  const title = escapeHtml(og.title || "Tickrace");
  const desc = escapeHtml(og.description || "Inscriptions & infos sur Tickrace");
  const image = escapeHtml(og.image || "");
  const pageUrl = escapeHtml(og.url || `${origin}/courses/${id}`);
  const appUrl = `${pageUrl}${pageUrl.includes("?") ? "&" : "?"}app=1`;

  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>${title}</title>
  <meta name="description" content="${desc}" />
  <link rel="canonical" href="${pageUrl}" />

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

  ${!isBot(ua) ? `<meta http-equiv="refresh" content="0;url=${escapeHtml(appUrl)}" />` : ""}
</head>
<body>
  <noscript>Tickrace</noscript>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=600",
    },
  });
}
