function escapeHtml(s) {
  return (s || "")
    .split("&").join("&amp;")
    .split("<").join("&lt;")
    .split(">").join("&gt;")
    .split('"').join("&quot;");
}

function isBot(ua) {
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

export default async function handler(req, res) {
  const ua = req.headers["user-agent"] || "";
  const origin = "https://www.tickrace.com";
  const id = req.query?.id || "";

  if (!id) {
    res.status(400).setHeader("content-type", "text/plain; charset=utf-8");
    return res.end("Missing id");
  }

  // Récupère les infos OG (JSON) via ta route existante
  let og = null;
  try {
    const ogRes = await fetch(`${origin}/api/og-course?id=${encodeURIComponent(id)}`, {
      headers: { "user-agent": ua },
    });
    if (ogRes.ok) og = await ogRes.json();
  } catch (_) {}

  if (!og) {
    og = {
      title: "Tickrace",
      description: "Inscriptions & infos sur Tickrace",
      url: `${origin}/courses/${id}`,
      image: `${origin}/api/og-image?id=${encodeURIComponent(id)}`,
    };
  }

  const title = escapeHtml(og.title || "Tickrace");
  const desc = escapeHtml(og.description || "Inscriptions & infos sur Tickrace");
  const image = escapeHtml(og.image || "");
  const pageUrl = escapeHtml(og.url || `${origin}/courses/${id}`);

  // Redirection pour humains (pour ne pas casser l'expérience)
  const appUrl = `${origin}/courses/${encodeURIComponent(id)}?from=share`;

  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>${title}</title>
  <meta name="description" content="${desc}" />

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
<body></body>
</html>`;

  res.setHeader("content-type", "text/html; charset=utf-8");
  res.setHeader("cache-control", "public, max-age=0, s-maxage=600");
  return res.status(200).send(html);
}
