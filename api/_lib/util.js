// Shared helpers for the Business Checkup functions.

const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "hotmail.com", "outlook.com", "live.com",
  "msn.com", "aol.com", "icloud.com", "me.com", "mac.com", "att.net", "sbcglobal.net", "comcast.net",
  "verizon.net", "proton.me", "protonmail.com", "gmx.com", "zoho.com", "mail.com", "yandex.com",
]);

// Free website-builder addresses: the business doesn't own the domain.
const FREE_HOSTS = [
  "wixsite.com", "godaddysites.com", "square.site", "weebly.com", "wordpress.com", "business.site",
  "carrd.co", "webflow.io", "squarespace.com", "jimdosite.com", "site123.me", "mystrikingly.com",
  "netlify.app", "vercel.app", "github.io", "blogspot.com",
];

// Second-level public suffixes we may see in practice (kept short on purpose).
const TWO_PART_SUFFIXES = new Set(["co.uk", "org.uk", "com.au", "net.au", "co.nz", "com.mx", "com.br", "co.za", "co.in"]);

function cleanHost(input) {
  let s = String(input || "").trim().toLowerCase();
  if (!s) return null;
  if (s.includes("@")) s = s.split("@").pop();
  s = s.replace(/^[a-z]+:\/\//, "");
  s = s.split(/[/?#]/)[0];
  s = s.replace(/:\d+$/, "").replace(/\.$/, "");
  if (s.length > 253) return null;
  if (!/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(s)) return null;
  return s;
}

// The path part matters for builder sites like name.wixsite.com/website.
function cleanUrl(input) {
  let s = String(input || "").trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  try {
    const u = new URL(s);
    const host = cleanHost(u.hostname);
    if (!host) return null;
    const path = u.pathname && u.pathname !== "/" ? u.pathname.replace(/\/+$/, "") : "";
    return { host, path };
  } catch {
    return null;
  }
}

function registrable(host) {
  const parts = host.split(".");
  if (parts.length <= 2) return host;
  const last2 = parts.slice(-2).join(".");
  if (TWO_PART_SUFFIXES.has(last2)) return parts.slice(-3).join(".");
  return last2;
}

function freeHost(host) {
  return FREE_HOSTS.find((f) => host === f || host.endsWith("." + f)) || null;
}

// A finding is one row in the report.
// status: pass | warn | fail | info
// fixable: counts toward the fix packages (a small job, under an hour)
// bigger: real problem, but bigger than a package fix (quoted separately)
function finding(o) {
  return {
    id: o.id,
    area: o.area,
    status: o.status,
    title: o.title,
    detail: o.detail || "",
    impact: o.impact || "",
    evidence: o.evidence || "",
    diy: o.diy || [],
    fixable: Boolean(o.fixable),
    bigger: Boolean(o.bigger),
  };
}

function send(res, code, body) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  res.status(code).json(body);
}

module.exports = { FREE_MAIL, cleanHost, cleanUrl, registrable, freeHost, finding, send };
