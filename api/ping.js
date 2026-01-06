export default function handler(req, res) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.status(200).send(JSON.stringify({ ok: true, ts: Date.now() }));
}
