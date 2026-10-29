// Light abuse protection for the paid lookups (Google Places).
// 1) Only answer requests coming from our own checkup page.
// 2) Per-IP rate limit, kept in memory per server instance.
const HITS = new Map();

function fromOurSite(req) {
  const h = req.headers || {};
  const src = String(h.origin || h.referer || "");
  if (!src) return false;
  try {
    const host = new URL(src).hostname;
    return host === "www.codegrity.com" || host === "codegrity.com" || host === "localhost" || host.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

function rateLimited(req, max = 8, windowMs = 10 * 60 * 1000) {
  const h = req.headers || {};
  const ip = String(h["x-real-ip"] || h["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  const now = Date.now();
  const list = (HITS.get(ip) || []).filter((t) => now - t < windowMs);
  if (list.length >= max) {
    HITS.set(ip, list);
    return true;
  }
  list.push(now);
  HITS.set(ip, list);
  if (HITS.size > 5000) HITS.clear();
  return false;
}

module.exports = { fromOurSite, rateLimited };
