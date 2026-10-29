// Local preview server for the checkup page with every outside service mocked.
// node tools/checkup-tests/serve.js  ->  http://localhost:8787/checkup?site=...
const http = require("http");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "../..");
const api = (p) => path.join(ROOT, "api", p);

const T = { A: 1, NS: 2, CNAME: 5, MX: 15, TXT: 16, AAAA: 28 };
const KEY = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA" + "A".repeat(200);
const ZONES = {
  "codegrity.com": {
    __wildcard: true,
    "codegrity.com|MX": ["1 aspmx.l.google.com."],
    "codegrity.com|TXT": ["v=spf1 include:_spf.google.com include:_spf.wpcloud.com ~all"],
    "codegrity.com|NS": ["ns1.wordpress.com."],
    "codegrity.com|A": ["76.76.21.21"],
    "www.codegrity.com|A": ["76.76.21.21"],
    "_dmarc.codegrity.com|TXT": ["v=DMARC1; p=none;"],
    "google._domainkey.codegrity.com|TXT": [`v=DKIM1; k=rsa; p=${KEY}`],
  },
  "acmeplumbingtx.com": {
    "acmeplumbingtx.com|MX": ["0 acmeplumbingtx-com.mail.protection.outlook.com."],
    "acmeplumbingtx.com|TXT": ["v=spf1 include:spf.protection.outlook.com -all", "v=spf1 include:sendgrid.net ~all"],
    "acmeplumbingtx.com|NS": ["ns55.domaincontrol.com."],
    "acmeplumbingtx.com|A": ["93.184.216.34"],
  },
  "wixsite.com": { "hebcarpet.wixsite.com|A": ["185.230.63.171"] },
};
const PAGES = {
  "https://acmeplumbingtx.com": `<html><head><title>Home</title><meta name="viewport" content="width=device-width"></head><body><p>${"Acme Plumbing serves McKinney, Allen and Frisco. Call 214-555-0100. ".repeat(8)}</p><footer>© 2021 Acme Plumbing LLC</footer></body></html>`,
  "http://acmeplumbingtx.com": "same",
  "https://hebcarpet.wixsite.com/website": `<html><head><title>Home</title><meta name="generator" content="Wix.com Website Builder"><meta name="viewport" content="width=device-width"></head><body><p>${"Carpet cleaning in Hurst, Euless and Bedford. ".repeat(10)}</p><footer>©2019 by HEB Carpet Cleaning. Proudly created with Wix.com</footer></body></html>`,
  "https://codegrity.com": { redirect: "https://www.codegrity.com/" },
  "https://www.codegrity.com/": fs.readFileSync(path.join(ROOT, "index.html"), "utf8"),
  "http://codegrity.com": { redirect: "https://codegrity.com/" },
  "https://codegrity.com/": { redirect: "https://www.codegrity.com/" },
};
let polls = 0;

global.fetch = async (url, init = {}) => {
  const u = new URL(url);
  if (u.hostname === "dns.google") {
    const name = u.searchParams.get("name").toLowerCase();
    const type = u.searchParams.get("type");
    const zone = Object.keys(ZONES).find((z) => name === z || name.endsWith("." + z));
    if (!zone) return Response.json({ Status: 3 });
    const recs = ZONES[zone][`${name}|${type}`];
    let answers = (recs || []).map((d) => ({ name, type: T[type], data: d }));
    if (!recs && ZONES[zone].__wildcard && name !== zone) answers = (ZONES[zone][`${zone}|${type}`] || []).map((d) => ({ name: zone, type: T[type], data: d }));
    return Response.json({ Status: 0, Answer: answers });
  }
  if (u.hostname === "rdap.org") {
    const exp = { "codegrity.com": "2027-03-23T00:00:00Z", "acmeplumbingtx.com": "2026-11-12T00:00:00Z" }[u.pathname.split("/").pop()];
    return exp ? Response.json({ events: [{ eventAction: "expiration", eventDate: exp }] }) : new Response("{}", { status: 404 });
  }
  if (u.hostname === "www.googleapis.com") {
    await new Promise((r) => setTimeout(r, 6000));
    const target = u.searchParams.get("url");
    const score = /codegrity/.test(target) ? 0.97 : /wixsite/.test(target) ? 0.38 : 0.62;
    return Response.json({ lighthouseResult: { categories: { performance: { score } }, audits: { "largest-contentful-paint": { displayValue: score > 0.9 ? "1.4 s" : "6.8 s" } } } });
  }
  if (u.hostname === "places.googleapis.com") {
    const body = init.body ? JSON.parse(init.body) : {};
    const q = String(body.textQuery || "");
    if (/codegrity/i.test(q) || /places\//.test(u.pathname)) {
      return Response.json({ places: [{ id: "abc123def456", displayName: { text: "Codegrity" }, formattedAddress: "McKinney, TX, USA", nationalPhoneNumber: "(972) 838-7422", websiteUri: "https://www.codegrity.com/", rating: 5, userRatingCount: 2, regularOpeningHours: {}, businessStatus: "OPERATIONAL", photos: [1, 2, 3], googleMapsUri: "https://maps.google.com/?cid=1" }] });
    }
    return Response.json({ places: [{ id: "xyz987654321", displayName: { text: q.split(",")[0] }, formattedAddress: "Hurst, TX 76053, USA", nationalPhoneNumber: "(817) 905-3906", rating: 4.9, userRatingCount: 6, businessStatus: "OPERATIONAL", photos: [1], googleMapsUri: "https://maps.google.com/?cid=2" }, { id: "alt111111111", displayName: { text: "Other Carpet Co" }, formattedAddress: "Euless, TX" }] });
  }
  if (u.hostname === "api.resend.com") {
    if (u.pathname === "/emails/receiving") {
      polls++;
      const tok = process.env.TEST_TOKEN || "";
      return Response.json({ data: polls > 1 ? [{ id: "r1", to: [`checkup-${tok}@inbound.test`] }] : [] });
    }
    return Response.json({ from: "PJ Sojdei <psojdei@codegrity.com>", subject: "Checking in", authentication: { spf: "pass", dkim: "pass", dmarc: "pass" }, headers: { "dkim-signature": "v=1; d=codegrity.com; s=google" }, text: "Hi there, ".repeat(30), html: "" });
  }
  const page = PAGES[url] ?? PAGES[url.replace(/\/$/, "")];
  if (page === undefined) throw Object.assign(new Error("fetch failed"), { cause: { code: "ECONNREFUSED" } });
  if (page === "same") return new Response("ok", { status: 200 });
  if (page.redirect) return new Response("", { status: 301, headers: { location: page.redirect } });
  return new Response(page, { status: 200, headers: { "content-type": "text/html" } });
};
require(api("_lib/net")).setCert(async (host) => ({ validTo: new Date("2027-01-15T00:00:00Z"), issuer: "Let's Encrypt" }));
process.env.GOOGLE_API_KEY = "test";
process.env.RESEND_API_KEY = "test";
process.env.INBOUND_DOMAIN = "inbound.test";

const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png" };
http
  .createServer(async (req, res) => {
    const u = new URL(req.url, "http://localhost");
    if (u.pathname.startsWith("/api/")) {
      const mod = require(api(u.pathname.slice(5) + ".js"));
      req.query = Object.fromEntries(u.searchParams);
      if (req.query.token) process.env.TEST_TOKEN = req.query.token;
      res.status = (c) => ((res.statusCode = c), res);
      res.json = (o) => {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(o));
      };
      return mod(req, res);
    }
    let f = path.join(ROOT, u.pathname === "/" ? "index.html" : u.pathname);
    if (!path.extname(f)) f += ".html";
    if (!fs.existsSync(f)) return (res.statusCode = 404), res.end("nf");
    res.setHeader("content-type", TYPES[path.extname(f)] || "application/octet-stream");
    fs.createReadStream(f).pipe(res);
  })
  .listen(8787, () => console.log("http://localhost:8787"));
