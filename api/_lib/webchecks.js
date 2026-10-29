// Website checks: reachability, HTTPS, certificate, basic on-page details, domain expiry.
const { safeGet, certInfo } = require("./net");
const { finding, freeHost, registrable } = require("./util");

let fetchImpl = (...args) => fetch(...args);
function setFetch(fn) {
  fetchImpl = fn;
}

const TLS_CODES = /CERT|TLS|SSL|SELF_SIGNED|UNABLE_TO_VERIFY|ALTNAME/i;

function decode(s) {
  return String(s || "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&copy;|&#169;|&#xa9;/gi, "©").replace(/\s+/g, " ").trim();
}

function metaContent(html, attr, val) {
  const re = new RegExp(`<meta[^>]+${attr}\\s*=\\s*["']${val}["'][^>]*>`, "i");
  const tag = (html.match(re) || [])[0];
  if (!tag) return null;
  return decode((tag.match(/content\s*=\s*["']([^"']*)["']/i) || [])[1] || "");
}

function analyzeHtml(html, now = new Date()) {
  const head = html.slice(0, 200000);
  const title = decode((head.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
  const description = metaContent(head, "name", "description");
  const viewport = /<meta[^>]+name\s*=\s*["']viewport["']/i.test(head);
  const ogImage = metaContent(head, "property", "og:image") || metaContent(head, "name", "og:image");
  const tel = /href\s*=\s*["']tel:/i.test(html);
  const ldBlocks = html.match(/<script[^>]+application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) || [];
  const ldBusiness = ldBlocks.some((b) => /"(address|telephone|openingHours|geo)"\s*:/.test(b));
  const microdata = /itemtype\s*=\s*["']https?:\/\/schema\.org\/(LocalBusiness|[A-Za-z]*Business|Organization|Store|Restaurant|Dentist|Physician|Plumber|Electrician|HomeAndConstructionBusiness)/i.test(html);
  const scripts = (html.match(/<script\b/gi) || []).length;
  const text = decode(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<[^>]+>/g, " "));
  const jsRendered = text.length < 250 && scripts >= 3;
  const generator = metaContent(head, "name", "generator") || "";

  // Copyright year as written in the page itself. Skip if a script fills it in.
  let copyright = null;
  const yearScript = /getFullYear\s*\(/.test(html);
  const re = /(?:©|\(c\)|copyright)\s*(?:copyright\s*)?(\d{4})(?:\s*[-–—]\s*(\d{4}))?/gi;
  let m;
  let best = 0;
  let snippet = "";
  while ((m = re.exec(text))) {
    const y = Number(m[2] || m[1]);
    if (y >= 1995 && y <= now.getFullYear() + 1 && y > best) {
      best = y;
      snippet = text.slice(Math.max(0, m.index - 10), m.index + 60).trim();
    }
  }
  if (best) copyright = { year: best, snippet, scripted: yearScript };

  let builder = null;
  const g = generator.toLowerCase();
  if (/wix\.com/i.test(g) || /static\.wixstatic\.com|wix-warmup-data/i.test(html)) builder = "Wix";
  else if (/squarespace/i.test(g) || /static1\.squarespace\.com/i.test(html)) builder = "Squarespace";
  else if (/wordpress/i.test(g) || /wp-content\//i.test(html)) builder = "WordPress";
  else if (/godaddy|go daddy|website builder/i.test(g) || /img1\.wsimg\.com/i.test(html)) builder = "GoDaddy Website Builder";
  else if (/weebly/i.test(g) || /editmysite\.com/i.test(html)) builder = "Weebly / Square";
  else if (/shopify/i.test(html) && /cdn\.shopify\.com/i.test(html)) builder = "Shopify";
  else if (/webflow/i.test(g)) builder = "Webflow";

  return { title, description, viewport, ogImage, tel, schema: ldBusiness || microdata, jsRendered, copyright, builder };
}

// RDAP server per top-level domain, from IANA's bootstrap file (cached per instance).
const RDAP_KNOWN = { com: "https://rdap.verisign.com/com/v1/", net: "https://rdap.verisign.com/net/v1/" };
let rdapBootstrap = null;
async function rdapBase(tld) {
  if (RDAP_KNOWN[tld]) return RDAP_KNOWN[tld];
  try {
    if (!rdapBootstrap) {
      const r = await fetchImpl("https://data.iana.org/rdap/dns.json");
      rdapBootstrap = r.ok ? await r.json() : { services: [] };
    }
    const svc = (rdapBootstrap.services || []).find(([tlds]) => tlds.includes(tld));
    return svc ? svc[1][0].replace(/\/?$/, "/") : null;
  } catch {
    return null;
  }
}

async function rdapExpiry(domain) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const base = await rdapBase(domain.split(".").pop());
    const urls = [base && `${base}domain/${domain}`, `https://rdap.org/domain/${domain}`].filter(Boolean);
    for (const u of urls) {
      try {
        const res = await fetchImpl(u, { headers: { accept: "application/rdap+json, application/json" }, signal: ctrl.signal });
        if (!res.ok) continue;
        const j = await res.json();
        const ev = (j.events || []).find((e) => /expiration/i.test(e.eventAction));
        if (ev) return new Date(ev.eventDate);
      } catch {}
    }
    return null;
  } finally {
    clearTimeout(t);
  }
}

function fmtDate(d) {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

async function checkWebsite(site, { now = new Date() } = {}) {
  const out = [];
  const meta = { finalUrl: null, builder: null, jsRendered: false };
  const host = site.host;
  const fh = freeHost(host);

  if (fh) {
    out.push(finding({
      id: "free-host", area: "website", status: "fail", fixable: true,
      title: "Your website uses the builder's address, not your own",
      detail: `Your site lives at ${host}${site.path || ""}, a free address on ${fh}. Customers have to remember (and trust) a long address with someone else's name in it.`,
      impact: "It looks less established, it's harder to share, and free plans often show the builder's ads on your site.",
      evidence: `${host}${site.path || ""}`,
      diy: ["Buy your own domain (about $10 to $20 a year), ideally your business name plus .com.", `In your ${fh} account, upgrade to a plan that allows a custom domain and connect it.`],
    }));
  }

  // Load the site over HTTPS, falling back to www.
  let page = await safeGet(`https://${host}${site.path || ""}`);
  let usedHost = host;
  if (!page.ok && !fh && !host.startsWith("www.") && page.code !== "PRIVATE" && !TLS_CODES.test(String(page.code))) {
    const alt = await safeGet(`https://www.${host}${site.path || ""}`);
    if (alt.ok) {
      page = alt;
      usedHost = "www." + host;
    }
  }

  if (!page.ok) {
    if (TLS_CODES.test(String(page.code)) || TLS_CODES.test(String(page.error))) {
      out.push(finding({
        id: "ssl-broken", area: "website", status: "fail", fixable: true,
        title: "Your site shows a security warning",
        detail: "Your security certificate (the padlock) isn't valid for this address, so browsers warn visitors before showing your site.",
        impact: "Most people hit Back the moment they see \"Your connection is not private.\"",
        evidence: page.code || page.error,
        diy: ["In your hosting or website builder dashboard, look for SSL or HTTPS settings and turn on the free certificate.", "If the domain was recently connected, it can take up to a day to issue."],
      }));
    } else if (page.code === "ENOTFOUND") {
      out.push(finding({
        id: "site-dns", area: "website", status: "fail", fixable: true,
        title: "Your domain doesn't point to a website",
        detail: `${host} doesn't lead anywhere right now.`,
        impact: "Anyone typing your address, or clicking it on Google, gets an error page.",
        evidence: page.error,
        diy: ["In your website builder or host, find the steps to connect a custom domain and copy the DNS records it gives you.", "Add them where you manage your domain's DNS."],
      }));
    } else if (page.code === "PRIVATE") {
      out.push(finding({ id: "site-private", area: "website", status: "info", title: "We can't check that address", detail: "It points to a private network address." }));
    } else {
      out.push(finding({
        id: "site-unreachable", area: "website", status: "info",
        title: "We couldn't load your website from our server",
        detail: "If it loads fine for you, your host may block automated checks. If it doesn't, your site may be down.",
        evidence: page.code || page.error,
      }));
    }
    return { findings: out, meta };
  }

  meta.finalUrl = page.url;
  const finalHost = new URL(page.url).hostname;

  if (page.status >= 500) {
    out.push(finding({
      id: "site-error", area: "website", status: "fail", bigger: true,
      title: `Your homepage shows a server error (${page.status})`,
      detail: "The site is reachable but the server can't build the page.",
      impact: "Visitors see an error instead of your business.",
      evidence: `${page.url} returned ${page.status}`,
    }));
  } else if (page.status === 404 || page.status === 410) {
    out.push(finding({
      id: "site-404", area: "website", status: "fail", fixable: true,
      title: "Your homepage says \"page not found\"",
      detail: `${page.url} returns a ${page.status}.`,
      impact: "Visitors and Google both see a dead page.",
      evidence: `${page.url} returned ${page.status}`,
      diy: ["Check your website builder or host to make sure the homepage is published and set as the home page."],
    }));
  } else if (page.status >= 400) {
    out.push(finding({
      id: "site-blocked", area: "website", status: "info",
      title: "Your site blocked our checker",
      detail: `It answered ${page.status}, which usually means a security service turned us away. We'll skip the on-page checks; real visitors are probably fine.`,
      evidence: `${page.url} returned ${page.status}`,
    }));
  }

  // HTTPS: certificate and http -> https redirect.
  const [cert, plain] = await Promise.all([certInfo(finalHost), safeGet(`http://${usedHost}${site.path || ""}`, { wantBody: false, maxHops: 4 })]);
  if (cert && cert.validTo) {
    const days = Math.floor((cert.validTo - now) / 864e5);
    if (days < 10) {
      out.push(finding({
        id: "ssl-expiring", area: "website", status: "fail", fixable: true,
        title: days < 0 ? "Your security certificate has expired" : `Your security certificate expires in ${days} day${days === 1 ? "" : "s"}`,
        detail: "When it lapses, browsers show a full-page security warning instead of your site.",
        impact: "Most visitors leave rather than click through a security warning.",
        evidence: `Valid until ${fmtDate(cert.validTo)}${cert.issuer ? ` (${cert.issuer})` : ""}`,
        diy: ["In your host's dashboard, renew the SSL certificate or turn on auto-renew."],
      }));
    } else {
      out.push(finding({
        id: "ssl", area: "website", status: "pass",
        title: "Secure connection (HTTPS) works",
        detail: "Your site loads with the padlock.",
        evidence: `Certificate valid until ${fmtDate(cert.validTo)}${cert.issuer ? ` (${cert.issuer})` : ""}`,
      }));
    }
  }
  const httpLast = plain.hops && plain.hops.length ? plain.hops[plain.hops.length - 1] : null;
  if (plain.ok && plain.status < 300 && /^http:/.test(plain.url)) {
    out.push(finding({
      id: "no-https-redirect", area: "website", status: "fail", fixable: true,
      title: "Your site still loads without the padlock",
      detail: `Visiting http://${usedHost} shows your site insecurely instead of switching to https.`,
      impact: "Chrome labels the page \"Not secure\", and anything typed into your forms travels unprotected.",
      evidence: `http://${usedHost} returned ${plain.status} with no redirect`,
      diy: ["Turn on \"Force HTTPS\" or \"Redirect HTTP to HTTPS\" in your host or builder settings."],
    }));
  } else if (httpLast && plain.hops.some((h) => h.location && /^https:/i.test(new URL(h.location, h.url).toString()))) {
    // redirected to https: fine, no row needed
  }

  // On-page details.
  if (page.status < 400 && page.html) {
    const a = analyzeHtml(page.html, now);
    meta.builder = a.builder;
    meta.jsRendered = a.jsRendered;

    if (!a.title) {
      out.push(finding({
        id: "title-missing", area: "website", status: "fail", fixable: true,
        title: "Your homepage has no page title",
        detail: "The page title is the blue headline Google shows for your site in search results.",
        impact: "Google makes one up, usually something unhelpful, and fewer people click.",
        diy: ["In your builder's SEO settings for the homepage, set a title like \"Business Name | What You Do in Your City\"."],
      }));
    } else if (a.title.length < 12 || /^(home|homepage|welcome|untitled|my site|website|index)$/i.test(a.title.trim())) {
      out.push(finding({
        id: "title-weak", area: "website", status: "warn", fixable: true,
        title: "Your page title doesn't say what you do",
        detail: `Google shows "${a.title}" as your headline in search results.`,
        impact: "People searching for your service can't tell from the results that you offer it.",
        evidence: a.title,
        diy: ["Change it to something like \"Business Name | What You Do in Your City\" in your builder's SEO settings."],
      }));
    } else {
      out.push(finding({ id: "title", area: "website", status: "pass", title: "Your homepage has a page title", evidence: a.title }));
    }

    if (!a.description) {
      out.push(finding({
        id: "desc-missing", area: "website", status: "warn", fixable: true,
        title: "No search description",
        detail: "The search description is the short paragraph under your name in Google results.",
        impact: "Google grabs random text from your page instead, which rarely sells your business.",
        diy: ["In your builder's SEO settings, write one or two sentences: what you do, where, and why to choose you."],
      }));
    } else {
      out.push(finding({ id: "desc", area: "website", status: "pass", title: "You have a search description", evidence: a.description.slice(0, 200) }));
    }

    if (!a.viewport) {
      out.push(finding({
        id: "not-mobile", area: "website", status: "fail", bigger: true,
        title: "Your site isn't built for phones",
        detail: "The page is missing the setting that tells phones to fit it to the screen, so it shows up tiny and zoomed out.",
        impact: "Most local customers search on their phones, and Google ranks sites that work on phones higher.",
        evidence: "No <meta name=\"viewport\"> tag",
      }));
    }

    if (!a.ogImage) {
      out.push(finding({
        id: "og-missing", area: "website", status: "warn", fixable: true,
        title: "Links to your site look plain when shared",
        detail: "Your site doesn't set a preview image, so when someone shares it on Facebook or in a text, it shows up with no picture.",
        impact: "Shared links with a good image get noticed and clicked; plain ones get scrolled past.",
        diy: ["In your builder's SEO or social settings, upload a \"social share image\" (1200 x 630 pixels works best)."],
      }));
    }

    if (a.jsRendered) {
      out.push(finding({
        id: "js-rendered", area: "website", status: "info",
        title: "Some checks were skipped",
        detail: "Your site builds its content with JavaScript after it loads, so we couldn't check for a tap-to-call link, business details or the footer year from outside.",
      }));
    } else {
      if (!a.tel) {
        out.push(finding({
          id: "no-tel", area: "website", status: "warn", fixable: true,
          title: "No tap-to-call link on your homepage",
          detail: "Your phone number isn't a link, so people on phones can't tap it to call.",
          impact: "Every extra step between \"I need this\" and calling you loses customers, especially on phones.",
          diy: ["Make your phone number a link to tel:+1XXXXXXXXXX (your number with no spaces). Most builders have a \"phone link\" option."],
        }));
      }
      if (!a.schema) {
        out.push(finding({
          id: "no-schema", area: "website", status: "warn", fixable: true,
          title: "Google can't read your business details from your site",
          detail: "Your site doesn't include business info in the structured format Google and AI search tools read (name, address, phone, hours).",
          impact: "It's harder for Google and tools like ChatGPT to confirm who you are, where you are and when you're open.",
          diy: ["Search your builder's help for \"structured data\" or \"schema\". Some have a local business setting.", "Or add a LocalBusiness block using a free schema generator."],
        }));
      }
      if (a.copyright && !a.copyright.scripted && a.copyright.year <= now.getFullYear() - 2) {
        out.push(finding({
          id: "stale-year", area: "website", status: "warn", fixable: true,
          title: `Your site says © ${a.copyright.year}`,
          detail: "The year in your footer is out of date.",
          impact: "Visitors notice. An old year makes people wonder whether you're still in business.",
          evidence: a.copyright.snippet,
          diy: ["Update the year in your footer, or set it to update automatically if your builder allows."],
        }));
      }
    }
  }

  // Domain expiry.
  if (!fh) {
    const reg = registrable(host);
    const exp = await rdapExpiry(reg);
    if (exp) {
      const days = Math.floor((exp - now) / 864e5);
      if (days < 30) {
        out.push(finding({
          id: "domain-expiring", area: "website", status: "warn",
          title: `${reg} expires in ${days} day${days === 1 ? "" : "s"}`,
          detail: "If it lapses, your website and email stop working, and someone else can buy the name.",
          impact: "Losing your domain means losing your web address and your email address at the same time.",
          evidence: `Registered through ${fmtDate(exp)}`,
          diy: ["Sign in where you bought the domain and confirm auto-renew is on with a working card."],
        }));
      } else {
        out.push(finding({ id: "domain", area: "website", status: "pass", title: `${reg} is registered through ${fmtDate(exp)}`, detail: "Keep auto-renew on." }));
      }
    }
  }

  return { findings: out, meta };
}

module.exports = { checkWebsite, analyzeHtml, rdapExpiry, setFetch };
