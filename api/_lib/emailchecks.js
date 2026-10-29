// Email authentication checks from public DNS: MX, SPF, DKIM, DMARC.
const dns = require("./dns");
const { finding } = require("./util");

const PROVIDERS = [
  { id: "google", name: "Google Workspace", mx: /(aspmx\.l\.google\.com|googlemail\.com|smtp\.google\.com)$/, spf: ["_spf.google.com"], dkim: ["google"] },
  { id: "microsoft", name: "Microsoft 365", mx: /mail\.protection\.outlook\.com$/, spf: ["spf.protection.outlook.com"], dkim: ["selector1", "selector2"] },
  { id: "zoho", name: "Zoho Mail", mx: /zoho\.(com|eu|in)$/, spf: ["zoho.com", "zohomail.com", "zoho.eu"], dkim: ["zmail", "zoho", "default"] },
  { id: "godaddy", name: "GoDaddy email", mx: /secureserver\.net$/, spf: ["secureserver.net"], dkim: ["default"] },
  { id: "titan", name: "Titan email", mx: /titan\.email$/, spf: ["spf.titan.email"], dkim: ["titan1", "default"] },
  { id: "proton", name: "Proton Mail", mx: /protonmail\.ch$/, spf: ["_spf.protonmail.ch"], dkim: ["protonmail", "protonmail2", "protonmail3"] },
  { id: "icloud", name: "iCloud Mail", mx: /icloud\.com$/, spf: ["icloud.com"], dkim: ["sig1"] },
];

// Selectors used by common sending services, checked for everyone.
const COMMON_SELECTORS = ["default", "dkim", "mail", "k1", "k2", "s1", "s2", "resend", "mandrill", "smtp", "key1", "sig1", "selector1", "selector2", "google"];

const DNS_HOSTS = [
  [/domaincontrol\.com$/, "GoDaddy"],
  [/registrar-servers\.com$/, "Namecheap"],
  [/cloudflare\.com$/, "Cloudflare"],
  [/wordpress\.com$/, "WordPress.com"],
  [/squarespacedns\.com$|squarespace\.com$/, "Squarespace"],
  [/wixdns\.net$/, "Wix"],
  [/googledomains\.com$/, "Google Domains (now Squarespace)"],
  [/awsdns/, "Amazon Route 53"],
  [/azure-dns/, "Microsoft Azure"],
  [/vercel-dns\.com$/, "Vercel"],
  [/name-services\.com$|enom\.com$/, "Enom"],
  [/hostgator\.com$/, "HostGator"],
  [/bluehost\.com$/, "Bluehost"],
  [/ionos\./, "IONOS"],
  [/dreamhost\.com$/, "DreamHost"],
  [/networksolutions\.com$|worldnic\.com$/, "Network Solutions"],
  [/porkbun\.com$/, "Porkbun"],
  [/dnsimple\.com$/, "DNSimple"],
  [/hostinger\.com$|dns-parking\.com$/, "Hostinger"],
];

function detectProvider(mxHosts) {
  for (const h of mxHosts) {
    const p = PROVIDERS.find((p) => p.mx.test(h.host));
    if (p) return p;
  }
  return mxHosts.length ? { id: "other", name: mxHosts[0].host, spf: [], dkim: [] } : null;
}

async function dnsHost(domain) {
  const r = await dns.query(domain, "NS");
  const ns = r.records.map((s) => s.replace(/\.$/, "").toLowerCase());
  for (const n of ns) {
    const hit = DNS_HOSTS.find(([re]) => re.test(n));
    if (hit) return { name: hit[1], ns };
  }
  return { name: null, ns };
}

function where(dnsName) {
  return dnsName ? `in your DNS settings at ${dnsName}` : "in your domain's DNS settings (wherever you bought the domain or manage it)";
}

// ---------- SPF
function parseSpf(rec) {
  const terms = rec.trim().split(/\s+/).slice(1);
  const all = terms.find((t) => /^[+\-~?]?all$/i.test(t));
  return { terms, all: all ? (all.length === 3 ? "+all" : all.toLowerCase()) : null };
}

async function spfLookups(domain, depth = 0, seen = new Set()) {
  if (depth > 6 || seen.has(domain)) return 0;
  seen.add(domain);
  const r = await dns.txt(domain);
  const rec = r.records.find((s) => /^v=spf1(\s|$)/i.test(s));
  if (!rec) return 0;
  let n = 0;
  for (const t of parseSpf(rec).terms) {
    const m = t.match(/^[+\-~?]?(include|redirect)[:=](.+)$/i);
    if (m) {
      n += 1;
      n += await spfLookups(m[2].toLowerCase(), depth + 1, seen);
    } else if (/^[+\-~?]?(a|mx|ptr|exists)(\b|[:/])/i.test(t)) {
      n += 1;
    }
  }
  return n;
}

// ---------- DKIM
function isDkim(rec) {
  // Some services (Resend, for one) publish only "p=<key>" with no version tag.
  if (/(^|;)\s*p=[A-Za-z0-9+/=]{100,}/.test(rec)) return true;
  return /(^|;)\s*p=[A-Za-z0-9+/=]{20,}/.test(rec) && (/v=DKIM1/i.test(rec) || /k=(rsa|ed25519)/i.test(rec));
}

async function findDkim(domain, provider) {
  const selectors = Array.from(new Set([...(provider ? provider.dkim : []), ...COMMON_SELECTORS]));
  const probe = "cg" + Math.random().toString(36).slice(2, 10);
  const results = await Promise.all(
    [...selectors, probe].map(async (sel) => {
      const r = await dns.txt(`${sel}._domainkey.${domain}`);
      return { sel, ok: r.ok, found: r.records.some(isDkim) };
    })
  );
  const wildcard = results.find((x) => x.sel === probe && x.found);
  const found = wildcard ? [] : results.filter((x) => x.sel !== probe && x.found).map((x) => x.sel);
  return { found, unreliable: Boolean(wildcard), failedLookups: results.filter((x) => !x.ok).length };
}

// ---------- main
async function checkEmail(domain, opts = {}) {
  const usesDomainEmail = opts.usesDomainEmail; // true | false | null (unknown)
  const out = [];
  const [mxr, txtr, dmarcr, host] = await Promise.all([dns.mx(domain), dns.txt(domain), dns.txt(`_dmarc.${domain}`), dnsHost(domain)]);

  if (!mxr.ok || !txtr.ok || !dmarcr.ok) {
    out.push(finding({ id: "email-lookup", area: "email", status: "info", title: "We couldn't read your email settings right now", detail: "A DNS lookup timed out. Run the checkup again in a minute." }));
    return { findings: out, provider: null, dnsHost: host.name };
  }

  const provider = detectProvider(mxr.hosts);
  const sendsMail = Boolean(provider) || usesDomainEmail === true;
  const loc = where(host.name);

  // MX
  if (!provider) {
    if (usesDomainEmail) {
      out.push(finding({
        id: "mx-missing", area: "email", status: "fail", fixable: true,
        title: `${domain} can't receive email`,
        detail: `There are no mail (MX) records for ${domain}, so email sent to your address has nowhere to go.`,
        impact: "Customers who email you get a bounce message, or their email silently disappears.",
        evidence: "MX lookup returned no records",
        diy: [`Sign in to your email provider and find its "MX records" setup page.`, `Add the MX records it gives you ${loc}.`, "Send yourself a test email from a personal account to confirm it arrives."],
      }));
    } else {
      out.push(finding({
        id: "mx-none", area: "email", status: "info",
        title: `No email is set up on ${domain}`,
        detail: "That's fine if you use a different address. It does mean your domain should tell the world it never sends email, so nobody can fake it (see the spoofing checks below).",
        evidence: "MX lookup returned no records",
      }));
    }
  } else {
    out.push(finding({
      id: "mx", area: "email", status: "pass",
      title: `Email is set up with ${provider.name}`,
      detail: `Mail for ${domain} is delivered to ${provider.name}.`,
      evidence: mxr.hosts.map((h) => `${h.priority} ${h.host}`).join(", "),
    }));
  }

  // SPF
  const spfs = txtr.records.filter((s) => /^v=spf1(\s|$)/i.test(s));
  if (spfs.length === 0) {
    out.push(finding({
      id: "spf-missing", area: "email", status: "fail", fixable: true,
      title: "No SPF record",
      detail: sendsMail
        ? "SPF is the list of servers allowed to send email as your domain. You don't have one, so inboxes can't tell your real email from a fake."
        : "SPF tells inboxes which servers may send as your domain. Since you don't send from it, it should say \"nobody.\"",
      impact: sendsMail ? "More of your email lands in spam, and scammers can send email that looks like it came from you." : "Scammers can send email that looks like it came from your business.",
      evidence: "No TXT record starting with v=spf1",
      diy: sendsMail
        ? [`Add one TXT record ${loc}: Name "@", Value "v=spf1 ${provider && provider.spf[0] ? "include:" + provider.spf[0] + " " : ""}~all".`, "If other services send email for you (invoicing, booking or newsletter tools), add their include too. Each service's help page lists it."]
        : [`Add one TXT record ${loc}: Name "@", Value "v=spf1 -all". That says no server is allowed to send email as your domain.`],
    }));
  } else if (spfs.length > 1) {
    out.push(finding({
      id: "spf-multiple", area: "email", status: "fail", fixable: true,
      title: `You have ${spfs.length} SPF records (you can only have one)`,
      detail: "When a domain has more than one SPF record, inboxes treat SPF as broken.",
      impact: "Your email loses its main proof that it really came from you, so more of it lands in spam.",
      evidence: spfs.join("  |  "),
      diy: [`Merge them into one TXT record ${loc} that starts with "v=spf1", lists every include once, and ends with "~all".`, "Delete the extra record."],
    }));
  } else {
    const spf = spfs[0];
    const p = parseSpf(spf);
    const lookups = await spfLookups(domain);
    const lower = spf.toLowerCase();
    const missingInclude = provider && provider.spf.length && !provider.spf.some((inc) => lower.includes("include:" + inc));
    if (p.all === "+all") {
      out.push(finding({
        id: "spf-plusall", area: "email", status: "fail", fixable: true,
        title: "Your SPF record lets anyone send as you",
        detail: "Your record ends in \"+all\", which tells inboxes that any server in the world may send email as your domain.",
        impact: "Scammers can impersonate your business by email, and spam filters treat your domain as careless.",
        evidence: spf,
        diy: [`Edit the TXT record ${loc} and change "+all" at the end to "~all".`],
      }));
    } else if (missingInclude) {
      out.push(finding({
        id: "spf-provider", area: "email", status: "fail", fixable: true,
        title: `SPF doesn't include ${provider.name}`,
        detail: `Your email is hosted with ${provider.name}, but your SPF record doesn't list it as allowed to send.`,
        impact: "Email you send can fail checks and land in spam.",
        evidence: spf,
        diy: [`Edit the SPF TXT record ${loc} and add "include:${provider.spf[0]}" right after "v=spf1".`],
      }));
    } else if (lookups > 10) {
      out.push(finding({
        id: "spf-lookups", area: "email", status: "fail", fixable: true,
        title: "Your SPF record is too long to work",
        detail: `SPF allows at most 10 lookups. Yours needs ${lookups}, so inboxes stop reading it and count it as an error.`,
        impact: "Email from some of your services fails SPF and can land in spam.",
        evidence: spf,
        diy: ["Remove includes for services you no longer use.", "If you still need them all, the record has to be restructured. That's a good one to hand off."],
      }));
    } else if (!p.all || p.all === "?all") {
      out.push(finding({
        id: "spf-weak", area: "email", status: "warn", fixable: true,
        title: "Your SPF record doesn't say what to do with fakes",
        detail: `It ends with ${p.all ? '"?all"' : "no \"all\" rule"}, which tells inboxes to stay neutral about email from unlisted servers.`,
        impact: "Spoofed email that pretends to be you gets less pushback.",
        evidence: spf,
        diy: [`Edit the record ${loc} so it ends with "~all".`],
      }));
    } else {
      out.push(finding({
        id: "spf", area: "email", status: "pass",
        title: "SPF is set up",
        detail: `One valid record, ${lookups} of 10 lookups used.`,
        evidence: spf,
      }));
    }
  }

  // DKIM
  if (sendsMail) {
    const dk = await findDkim(domain, provider);
    if (dk.found.length) {
      out.push(finding({
        id: "dkim", area: "email", status: "pass",
        title: "DKIM signing is set up",
        detail: `We found DKIM keys for: ${dk.found.join(", ")}. DKIM is the signature that proves an email really came from you.`,
        evidence: dk.found.map((s) => `${s}._domainkey.${domain}`).join(", "),
      }));
    } else if (provider && (provider.id === "google" || provider.id === "microsoft") && !dk.unreliable && dk.failedLookups === 0) {
      const isGoogle = provider.id === "google";
      out.push(finding({
        id: "dkim-missing", area: "email", status: "fail", fixable: true,
        title: `DKIM isn't turned on for ${provider.name}`,
        detail: "DKIM is a digital signature that proves your email really came from your business. Without it, inboxes have to take your email's word for it.",
        impact: "Gmail, Yahoo and Outlook trust unsigned email less, so more of it goes to spam. It's also easier for someone to impersonate you.",
        evidence: isGoogle ? `No key at google._domainkey.${domain}` : `No keys at selector1/selector2._domainkey.${domain}`,
        diy: isGoogle
          ? ["Go to admin.google.com, then Apps, Google Workspace, Gmail, Authenticate email.", "Click Generate new record and copy the TXT value.", `Add it ${loc} as a TXT record named "google._domainkey".`, "Wait an hour, then click Start authentication in Google Admin."]
          : ["In the Microsoft Defender portal, go to Email authentication settings, then DKIM.", "Select your domain and copy the two CNAME records it shows.", `Add both ${loc}.`, "Back in Defender, turn on signing for the domain."],
      }));
    } else {
      out.push(finding({
        id: "dkim-unknown", area: "email", status: "info",
        title: "We couldn't confirm DKIM from the outside",
        detail: "DKIM keys can live under names we can't guess. Send us a test email below and we'll check the real signature.",
      }));
    }
  }

  // DMARC
  const dmarcs = dmarcr.records.filter((s) => /^v=DMARC1/i.test(s));
  if (dmarcs.length === 0) {
    out.push(finding({
      id: "dmarc-missing", area: "email", status: "fail", fixable: true,
      title: "No DMARC record",
      detail: "DMARC tells inboxes what to do with email that fails your SPF and DKIM checks, and where to send reports about it.",
      impact: "Gmail and Yahoo now expect it, and without it nothing stops someone from sending fake email in your name.",
      evidence: `No TXT record at _dmarc.${domain}`,
      diy: [`Add a TXT record ${loc}: Name "_dmarc", Value "v=DMARC1; p=none; rua=mailto:you@${domain}" (use your real address).`, "After a few weeks of clean reports, change p=none to p=quarantine."],
    }));
  } else if (dmarcs.length > 1) {
    out.push(finding({
      id: "dmarc-multiple", area: "email", status: "fail", fixable: true,
      title: `You have ${dmarcs.length} DMARC records (you can only have one)`,
      detail: "With more than one record, inboxes ignore DMARC completely.",
      impact: "You get none of DMARC's protection, and Gmail and Yahoo treat your domain as having no policy.",
      evidence: dmarcs.join("  |  "),
      diy: [`Delete the extra "_dmarc" TXT record ${loc} so only one remains.`],
    }));
  } else {
    const d = dmarcs[0];
    const policy = ((d.match(/;\s*p\s*=\s*(\w+)/i) || [])[1] || "").toLowerCase();
    const hasRua = /rua\s*=/i.test(d);
    if (policy === "none" || !policy) {
      out.push(finding({
        id: "dmarc-none", area: "email", status: "warn", fixable: true,
        title: "DMARC is only watching, not protecting",
        detail: `Your policy is "p=none", so inboxes report fake email in your name but still deliver it.${hasRua ? "" : " You also aren't collecting the reports, so nobody sees them."}`,
        impact: "Someone can still send convincing fake email as your business, like a fake invoice to your customers.",
        evidence: d,
        diy: [hasRua ? "Read a few weeks of DMARC reports to confirm all your real email passes." : `Add "rua=mailto:you@${domain}" to the record to start getting reports, and watch them for 2 to 4 weeks.`, `Then change "p=none" to "p=quarantine" ${loc}.`],
      }));
    } else {
      out.push(finding({
        id: "dmarc", area: "email", status: "pass",
        title: `DMARC is protecting your domain (p=${policy})`,
        detail: "Fake email that pretends to be you gets quarantined or rejected.",
        evidence: d,
      }));
    }
  }

  return { findings: out, provider: provider ? provider.name : null, dnsHost: host.name };
}

module.exports = { checkEmail, parseSpf, isDkim, detectProvider, spfLookups, findDkim, dnsHost };
