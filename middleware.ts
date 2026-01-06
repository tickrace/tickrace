export const config = {
  matcher: ["/courses/:id*"],
};

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

export default async function middleware(req: Request) {
  const ua = req.headers.get("user-agent") || "";
  if (!isBot(ua)) return fetch(req);

  const url = new URL(req.url);
  const id = url.pathname.split("/").pop();

  const ogRes = await fetch(`${url.origin}/api/og/course/${id}`, { headers: { "user-agent": ua } });
  if (!ogRes.ok) return fetch(req);

  const og = await ogRes.json();

  const htmlRes = await fetch(`${url.origin}/index.html`);
  const html = await htmlRes.text();

  const title = escapeHtml(og.title || "Tickrace");
  const desc = escapeHtml(og.description || "Inscriptions & infos sur Tickrace");
  const image = escapeHtml(og.image || "");
  const pageUrl = escapeHtml(og.url || url.href);

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
      "cache-control": "public, max-age=0, s-maxage=600",
    },
  });
}
