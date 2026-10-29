// Offline tests for the Business Checkup functions. Run: node tools/checkup-tests/test.js
const assert = require("assert");
const path = require("path");
const api = (p) => path.join(__dirname, "../../api", p);
const dns = require(api("_lib/dns"));
const net = require(api("_lib/net"));
const web = require(api("_lib/webchecks"));
const { checkEmail } = require(api("_lib/emailchecks"));
const { checkWebsite, analyzeHtml } = web;

const T = { A: 1, NS: 2, CNAME: 5, MX: 15, TXT: 16, AAAA: 28 };
let ZONES = {};
let SITES = {};
let RDAP = {};

const KEY = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAlYdqSKbewcjvG+VjKd8zq4hnRqmXKhO" + "A".repeat(200);

function mockFetch(url, init = {}) {
  const u = new URL(url);
  if (u.hostname === "dns.google") {
    const name = u.searchParams.get("name").toLowerCase();
    const type = u.searchParams.get("type");
    const zone = Object.keys(ZONES).find((z) => name === z || name.endsWith("." + z));
    if (!zone) return Promise.resolve(Response.json({ Status: 3 }));
    const recs = ZONES[zone][`${name}|${type}`];
    let answers = (recs || []).map((d) => ({ name, type: T[type], data: d }));
    // Wildcard CNAME to the apex, like WordPress.com DNS.
    if (!recs && ZONES[zone].__wildcard && name !== zone) {
      const apex = ZONES[zone][`${zone}|${type}`] || [];
      answers = [{ name, type: 5, data: zone + "." }, ...apex.map((d) => ({ name: zone, type: T[type], data: d }))];
    }
    return Promise.resolve(Response.json({ Status: 0, Answer: answers }));
  }
  if (u.hostname === "rdap.org") {
    const d = u.pathname.split("/").pop();
    if (!RDAP[d]) return Promise.resolve(new Response("{}", { status: 404 }));
    return Promise.resolve(Response.json({ events: [{ eventAction: "expiration", eventDate: RDAP[d] }] }));
  }
  const s = SITES[url];
  if (!s) return Promise.reject(Object.assign(new Error("fetch failed"), { cause: { code: "ECONNREFUSED", message: "refused" } }));
  if (s.error) return Promise.reject(Object.assign(new Error("fetch failed"), { cause: { code: s.error, message: s.error } }));
  return Promise.resolve(new Response(s.body || "", { status: s.status || 200, headers: s.location ? { location: s.location } : {} }));
}
dns.setFetch(mockFetch);
net.setFetch(mockFetch);
web.setFetch(mockFetch);
net.setCert(async () => ({ validTo: new Date("2027-01-20T00:00:00Z"), issuer: "Let's Encrypt" }));

const ids = (fs) => fs.map((f) => `${f.id}:${f.status}`);
const byId = (fs, id) => fs.find((f) => f.id === id);
let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log("ok  ", name);
  } catch (e) {
    console.log("FAIL", name, "\n   ", e.message);
    process.exitCode = 1;
  }
}

(async () => {
  // ---- codegrity.com as it actually looks today
  ZONES = {
    "codegrity.com": {
      __wildcard: true,
      "codegrity.com|MX": ["1 aspmx.l.google.com.", "5 alt1.aspmx.l.google.com.", "10 alt3.aspmx.l.google.com."],
      "codegrity.com|TXT": ["google-site-verification=z_MrJadNDyZvfBrs9a3u_8a68aPsh8IfY-JroHWlkys", "v=spf1 include:_spf.google.com include:_spf.wpcloud.com ~all"],
      "codegrity.com|NS": ["ns1.wordpress.com.", "ns2.wordpress.com."],
      "codegrity.com|A": ["76.76.21.21"],
      "_dmarc.codegrity.com|TXT": ["v=DMARC1; p=none;"],
      "google._domainkey.codegrity.com|TXT": [`v=DKIM1; k=rsa; p=${KEY}`],
      "resend._domainkey.codegrity.com|TXT": [`p=${KEY}`],
    },
    "_spf.google.com": { "_spf.google.com|TXT": ["v=spf1 include:_netblocks.google.com include:_netblocks2.google.com include:_netblocks3.google.com ~all"] },
    "_spf.wpcloud.com": { "_spf.wpcloud.com|TXT": ["v=spf1 ip4:192.0.64.0/18 ~all"] },
  };
  await test("codegrity.com email: provider, spf, dkim (incl. Resend p-only key), dmarc p=none", async () => {
    const r = await checkEmail("codegrity.com", { usesDomainEmail: true });
    assert.strictEqual(r.provider, "Google Workspace");
    assert.strictEqual(r.dnsHost, "WordPress.com");
    assert.deepStrictEqual(ids(r.findings), ["mx:pass", "spf:pass", "dkim:pass", "dmarc-none:warn"]);
    assert.match(byId(r.findings, "dkim").detail, /google/);
    assert.match(byId(r.findings, "dkim").detail, /resend/);
    assert.match(byId(r.findings, "spf").detail, /5 of 10/);
    assert.match(byId(r.findings, "dmarc-none").detail, /aren't collecting the reports/);
    assert.match(byId(r.findings, "dmarc-none").diy[1], /WordPress\.com/);
  });

  await test("wildcard DNS does not fake a DKIM key", async () => {
    delete ZONES["codegrity.com"]["google._domainkey.codegrity.com|TXT"];
    delete ZONES["codegrity.com"]["resend._domainkey.codegrity.com|TXT"];
    const r = await checkEmail("codegrity.com", { usesDomainEmail: true });
    assert.ok(byId(r.findings, "dkim-missing"), ids(r.findings).join(","));
    assert.strictEqual(byId(r.findings, "dkim-missing").fixable, true);
  });

  // ---- broken setup
  ZONES["acme-plumbing.com"] = {
    "acme-plumbing.com|MX": ["0 acme-plumbing-com.mail.protection.outlook.com."],
    "acme-plumbing.com|TXT": ["v=spf1 include:spf.protection.outlook.com -all", "v=spf1 include:sendgrid.net ~all"],
    "acme-plumbing.com|NS": ["ns55.domaincontrol.com."],
    "_dmarc.acme-plumbing.com|TXT": ["v=DMARC1; p=none;", "v=DMARC1; p=none; rua=mailto:a@acme-plumbing.com"],
  };
  await test("two SPF, two DMARC, Microsoft without DKIM, GoDaddy DNS", async () => {
    const r = await checkEmail("acme-plumbing.com", { usesDomainEmail: true });
    assert.deepStrictEqual(ids(r.findings), ["mx:pass", "spf-multiple:fail", "dkim-missing:fail", "dmarc-multiple:fail"]);
    assert.match(byId(r.findings, "spf-multiple").diy[0], /GoDaddy/);
    assert.strictEqual(r.findings.filter((f) => f.fixable).length, 3);
  });

  ZONES["nomail.com"] = { "nomail.com|NS": ["a.ns.cloudflare.com."] };
  await test("no MX, unknown email use: info + spoofing guard", async () => {
    const r = await checkEmail("nomail.com", { usesDomainEmail: null });
    assert.deepStrictEqual(ids(r.findings), ["mx-none:info", "spf-missing:fail", "dmarc-missing:fail"]);
    assert.match(byId(r.findings, "spf-missing").diy[0], /v=spf1 -all/);
  });

  await test("no MX but they use the address: can't receive", async () => {
    const r = await checkEmail("nomail.com", { usesDomainEmail: true });
    assert.strictEqual(r.findings[0].id, "mx-missing");
    assert.ok(byId(r.findings, "dkim-unknown"));
  });

  ZONES["toolong.com"] = {
    "toolong.com|MX": ["10 mx.toolong.com."],
    "toolong.com|TXT": ["v=spf1 a mx include:a.toolong.com include:b.toolong.com include:c.toolong.com ~all"],
    "a.toolong.com|TXT": ["v=spf1 a mx include:d.toolong.com ~all"],
    "b.toolong.com|TXT": ["v=spf1 a mx ~all"],
    "c.toolong.com|TXT": ["v=spf1 a mx ptr ~all"],
    "d.toolong.com|TXT": ["v=spf1 a ~all"],
    "_dmarc.toolong.com|TXT": ["v=DMARC1; p=reject; rua=mailto:x@toolong.com"],
  };
  await test("SPF over 10 lookups, DMARC reject passes, other provider DKIM unknown", async () => {
    const r = await checkEmail("toolong.com", { usesDomainEmail: true });
    assert.deepStrictEqual(ids(r.findings), ["mx:pass", "spf-lookups:fail", "dkim-unknown:info", "dmarc:pass"]);
    assert.match(byId(r.findings, "spf-lookups").detail, /needs 14/);
  });

  // ---- website
  const goodHtml = `<!doctype html><html><head><title>Sewell Plumbing | Plumber in McKinney, TX</title>
    <meta name="description" content="Licensed plumbers in McKinney."><meta name="viewport" content="width=device-width">
    <meta property="og:image" content="https://x/og.png"><script type="application/ld+json">{"@type":"Plumber","telephone":"+1"}</script></head>
    <body><a href="tel:+12145551234">Call</a><p>${"Real content about plumbing. ".repeat(20)}</p><footer>© 2026 Sewell</footer></body></html>`;
  ZONES["good.com"] = { "good.com|A": ["93.184.216.34"], "www.good.com|A": ["93.184.216.34"] };
  SITES = {
    "https://good.com": { status: 301, location: "https://www.good.com/" },
    "https://www.good.com/": { status: 200, body: goodHtml },
    "http://good.com": { status: 301, location: "https://good.com/" },
    "https://good.com/": { status: 301, location: "https://www.good.com/" },
  };
  RDAP["good.com"] = "2028-03-01T00:00:00Z";
  await test("healthy website: all passes, no fixable items", async () => {
    const r = await checkWebsite({ host: "good.com", path: "" }, { now: new Date("2026-10-29") });
    assert.deepStrictEqual(ids(r.findings), ["ssl:pass", "title:pass", "desc:pass", "domain:pass"]);
    assert.strictEqual(r.meta.finalUrl, "https://www.good.com/");
  });

  const wixHtml = `<html><head><title>Home</title><meta name="generator" content="Wix.com Website Builder"><meta name="viewport" content="width=device-width"></head>
    <body><p>${"We clean carpets in Hurst, Euless and Bedford. ".repeat(10)}</p><p>Call 817-905-3906</p><footer>©2019 by HEB Carpet Cleaning. Proudly created with Wix.com</footer></body></html>`;
  ZONES["wixsite.com"] = { "heb.wixsite.com|A": ["185.230.63.171"] };
  SITES = { "https://heb.wixsite.com/website": { status: 200, body: wixHtml }, "http://heb.wixsite.com/website": { status: 301, location: "https://heb.wixsite.com/website" } };
  await test("Wix free site: free host, weak title, no desc, no og, no tel, no schema, ©2019", async () => {
    const r = await checkWebsite({ host: "heb.wixsite.com", path: "/website" }, { now: new Date("2026-10-29") });
    assert.deepStrictEqual(ids(r.findings), ["free-host:fail", "ssl:pass", "title-weak:warn", "desc-missing:warn", "og-missing:warn", "no-tel:warn", "no-schema:warn", "stale-year:warn"]);
    assert.strictEqual(r.meta.builder, "Wix");
    assert.match(byId(r.findings, "stale-year").evidence, /2019/);
  });

  await test("scripted footer year is not flagged", async () => {
    const a = analyzeHtml(`<html><head><title>x</title></head><body><p>${"text ".repeat(80)}</p><footer>© 2019 – <span id=y></span><script>y.textContent=new Date().getFullYear()</script></footer></body></html>`);
    assert.ok(a.copyright.scripted);
  });

  await test("JS-only site skips body checks", async () => {
    const a = analyzeHtml(`<html><head><title>App</title></head><body><div id=root></div><script src=a></script><script src=b></script><script src=c></script></body></html>`);
    assert.strictEqual(a.jsRendered, true);
  });

  ZONES["plain.com"] = { "plain.com|A": ["93.184.216.35"] };
  SITES = { "https://plain.com": { status: 200, body: goodHtml.replace('<meta name="viewport" content="width=device-width">', "") }, "http://plain.com": { status: 200, body: "hi" } };
  RDAP["plain.com"] = "2026-11-10T00:00:00Z";
  await test("no https redirect, not mobile (bigger), domain expiring", async () => {
    const r = await checkWebsite({ host: "plain.com", path: "" }, { now: new Date("2026-10-29") });
    const s = ids(r.findings);
    assert.ok(s.includes("no-https-redirect:fail"), s.join(","));
    assert.ok(s.includes("not-mobile:fail"));
    assert.strictEqual(byId(r.findings, "not-mobile").bigger, true);
    assert.strictEqual(byId(r.findings, "not-mobile").fixable, false);
    assert.ok(s.includes("domain-expiring:warn"));
  });

  ZONES["badcert.com"] = { "badcert.com|A": ["93.184.216.36"] };
  SITES = { "https://badcert.com": { error: "ERR_TLS_CERT_ALTNAME_INVALID" } };
  await test("certificate error is reported as a security warning", async () => {
    const r = await checkWebsite({ host: "badcert.com", path: "" });
    assert.deepStrictEqual(ids(r.findings), ["ssl-broken:fail"]);
  });

  ZONES["internal.com"] = { "internal.com|A": ["10.0.0.5"] };
  await test("private addresses are refused", async () => {
    const r = await checkWebsite({ host: "internal.com", path: "" });
    assert.deepStrictEqual(ids(r.findings), ["site-private:info"]);
  });

  await test("nonexistent domain", async () => {
    const r = await checkWebsite({ host: "nope-nothing.com", path: "" });
    assert.deepStrictEqual(ids(r.findings), ["site-dns:fail"]);
  });

  // ---- email test analysis
  const { analyze } = require(api("email-test"));
  await test("email test: clean plain-text email from codegrity.com", async () => {
    const r = analyze({ from: "PJ <psojdei@codegrity.com>", authentication: { spf: "pass", dkim: "pass", dmarc: "pass" }, headers: { "dkim-signature": "v=1; a=rsa-sha256; d=codegrity.com; s=google; b=xx" }, text: "Hi Luke, ".repeat(30), html: "" }, "codegrity.com");
    assert.deepStrictEqual(ids(r.findings), ["test-spf:pass", "test-dkim:pass", "test-dmarc:pass", "test-content:pass"]);
  });
  await test("email test: unaligned DKIM, logo image, short text", async () => {
    const r = analyze({ from: "a@shop.com", authentication: { spf: "pass", dkim: "pass", dmarc: "fail" }, headers: { "dkim-signature": "v=1; d=sendgrid.net; s=s1" }, text: "Test", html: '<p>Test</p><img src="https://x/logo.png" width="120">' }, "shop.com");
    assert.deepStrictEqual(ids(r.findings), ["test-spf:pass", "test-dkim:warn", "test-dmarc:fail", "test-images:warn"]);
  });

  // ---- listing assessment
  const { assess } = require(api("listing"));
  await test("listing: missing hours and website, few photos and reviews", async () => {
    const f = assess({ id: "x", displayName: { text: "Samantha's Barber Studio" }, formattedAddress: "McKinney", nationalPhoneNumber: null, rating: 5, userRatingCount: 27, photos: [1, 2], businessStatus: "OPERATIONAL" }, "samanthasbarber.com");
    assert.deepStrictEqual(ids(f), ["gbp:pass", "gbp-phone:fail", "gbp-hours:fail", "gbp-website:fail", "gbp-photos:warn", "gbp-reviews-ok:pass"]);
  });
  await test("listing: website mismatch and closed", async () => {
    const f = assess({ id: "x", displayName: { text: "Añejo" }, nationalPhoneNumber: "(214) 548-4869", regularOpeningHours: {}, websiteUri: "https://cesarsmexican.com/", userRatingCount: 4, rating: 3.5, photos: Array(8), businessStatus: "CLOSED_TEMPORARILY" }, "anejo.com");
    assert.deepStrictEqual(ids(f), ["gbp:pass", "gbp-closed:fail", "gbp-phone-ok:pass", "gbp-hours-ok:pass", "gbp-website-mismatch:warn", "gbp-reviews:warn"]);
  });
  await test("listing: www vs apex counts as a match", async () => {
    const f = assess({ id: "x", displayName: { text: "A" }, nationalPhoneNumber: "1", regularOpeningHours: {}, websiteUri: "https://www.good.com/?utm=gbp", userRatingCount: 40, rating: 4.8, photos: Array(10), businessStatus: "OPERATIONAL" }, "good.com");
    assert.ok(byId(f, "gbp-website-ok"));
  });

  console.log(`\n${passed} passed`);
})();
