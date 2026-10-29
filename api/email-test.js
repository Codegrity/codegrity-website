// GET /api/email-test?token=abc123xyz0&domain=example.com
// The visitor sends an email to checkup-<token>@<INBOUND_DOMAIN>. We look it up
// through Resend's receiving API and report what the receiving server saw.
// Needs RESEND_API_KEY and INBOUND_DOMAIN. Nothing is stored on our side.
const { cleanHost, finding, send } = require("./_lib/util");

const SHORTENERS = /\b(bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|buff\.ly|rebrand\.ly|cutt\.ly|shorturl\.at)\//i;

async function resend(path) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`https://api.resend.com/${path}`, { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }, signal: ctrl.signal });
    return { ok: r.ok, status: r.status, json: await r.json().catch(() => ({})) };
  } finally {
    clearTimeout(t);
  }
}

function addrDomain(s) {
  const m = String(s || "").match(/@([A-Za-z0-9.-]+)>?\s*$/);
  return m ? m[1].toLowerCase() : null;
}

function header(headers, name) {
  if (!headers) return [];
  const v = headers[name] ?? headers[name.toLowerCase()] ?? Object.entries(headers).find(([k]) => k.toLowerCase() === name)?.[1];
  if (v == null) return [];
  const one = (x) => (typeof x === "string" ? x : JSON.stringify(x));
  return Array.isArray(v) ? v.map(one) : [one(v)];
}

function analyze(e, expected) {
  const out = [];
  const auth = e.authentication || {};
  const fromDomain = addrDomain(e.from);
  const signers = header(e.headers, "dkim-signature").flatMap((h) => [...h.matchAll(/(?:^|;)\s*d=([^;\s]+)/g)].map((m) => m[1].toLowerCase()));
  const aligned = fromDomain && signers.some((d) => d === fromDomain || fromDomain.endsWith("." + d) || d.endsWith("." + fromDomain));

  if (expected && fromDomain && fromDomain !== expected && !fromDomain.endsWith("." + expected)) {
    out.push(finding({ id: "test-from", area: "email", status: "info", title: `Your test came from ${fromDomain}`, detail: `These results are for ${fromDomain}. Send from your ${expected} address to test that one.` }));
  }

  const word = (r) => (r === "pass" ? "passed" : r === "fail" ? "failed" : "couldn't be confirmed");

  // SPF
  if (auth.spf === "pass") {
    out.push(finding({ id: "test-spf", area: "email", status: "pass", title: "Your test email passed SPF", evidence: `spf=${auth.spf}` }));
  } else if (auth.spf) {
    out.push(finding({
      id: "test-spf", area: "email", status: "fail", fixable: true,
      title: "Your test email failed SPF",
      detail: `It ${word(auth.spf)} the check that it was sent from a server your domain allows.`,
      impact: "Inboxes see that check fail and are more likely to send your email to spam.",
      evidence: `spf=${auth.spf}`,
      diy: ["Add the service you sent from to your SPF record (its help page lists the include to use)."],
    }));
  }

  // DKIM
  // Only call DKIM "not your domain" when we can actually see the signer and it
  // isn't you. A DMARC pass already proves your domain was authenticated.
  const unaligned = signers.length > 0 && !aligned && auth.dmarc !== "pass";
  if (auth.dkim === "pass" && !unaligned) {
    out.push(finding({ id: "test-dkim", area: "email", status: "pass", title: "Your test email was signed with DKIM", detail: "The signature proves it really came from you.", evidence: `dkim=pass${signers.length ? ` (signed by ${signers.join(", ")})` : ""}${auth.dmarc === "pass" ? ", dmarc=pass" : ""}` }));
  } else if (auth.dkim === "pass") {
    out.push(finding({
      id: "test-dkim", area: "email", status: "warn", fixable: true,
      title: "Your email is signed, but not with your domain",
      detail: `It was signed by ${signers.join(", ") || "your provider"} instead of ${fromDomain}.`,
      impact: "Inboxes give your own domain less credit, and DMARC can't rely on that signature.",
      evidence: `dkim=pass, d=${signers.join(", ")}`,
      diy: ["In the service you sent from, look for \"domain authentication\" or \"custom DKIM\" and add the records it gives you."],
    }));
  } else if (auth.dkim) {
    out.push(finding({
      id: "test-dkim", area: "email", status: "fail", fixable: true,
      title: "Your test email wasn't signed with DKIM",
      detail: "DKIM is a digital signature that proves an email really came from your business.",
      impact: "Gmail, Yahoo and Outlook trust unsigned email less, so more of it goes to spam.",
      evidence: `dkim=${auth.dkim}`,
      diy: ["In your email provider's admin settings, find DKIM (sometimes under \"Authenticate email\") and turn it on.", "Add the DNS record it gives you, then switch signing on."],
    }));
  }

  // DMARC
  if (auth.dmarc === "pass") {
    out.push(finding({ id: "test-dmarc", area: "email", status: "pass", title: "Your test email passed DMARC", evidence: `dmarc=${auth.dmarc}` }));
  } else if (auth.dmarc) {
    out.push(finding({
      id: "test-dmarc", area: "email", status: "fail", fixable: true,
      title: "Your test email failed DMARC",
      detail: "DMARC passes only when SPF or DKIM passes for your own domain. Neither did here.",
      impact: "Gmail and Yahoo now expect DMARC to pass. Failing mail is far more likely to land in spam or be rejected.",
      evidence: `dmarc=${auth.dmarc}`,
      diy: ["Fix SPF and DKIM above first; DMARC follows once one of them passes for your domain."],
    }));
  }

  // Content
  const html = String(e.html || "");
  const text = String(e.text || "").trim() || html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  const pixels = imgs.filter((t) => /\b(width|height)\s*=\s*["']?[01]["'\s>]/i.test(t)).length;
  const realImgs = imgs.length - pixels;
  const links = (html.match(/href\s*=\s*["']https?:\/\//gi) || []).length || (text.match(/https?:\/\//g) || []).length;
  const shortener = SHORTENERS.test(html) || SHORTENERS.test(text);

  if (realImgs > 0 && text.length < 600) {
    out.push(finding({
      id: "test-images", area: "email", status: "warn",
      title: "Your email is light on text and has images",
      detail: `It has ${realImgs} image${realImgs === 1 ? "" : "s"} (often a logo in the signature) and only a few lines of text. Spam filters score that pattern as risky, especially in a first email to someone new.`,
      impact: "Short emails with images, often from a logo signature, are more likely to land in spam.",
      diy: ["Use a plain-text signature (name, business, phone, website) when emailing someone for the first time.", "Keep your logo signature for replies and existing customers."],
    }));
  }
  if (pixels > 0) {
    out.push(finding({ id: "test-pixel", area: "email", status: "info", title: "Your email contains a tracking pixel", detail: "Open tracking works by hiding a tiny image in the email. Spam filters notice it, and many inboxes block it anyway. Turn it off for first-contact emails." }));
  }
  if (shortener) {
    out.push(finding({ id: "test-shortener", area: "email", status: "warn", title: "Your email uses a shortened link", detail: "Links like bit.ly hide where they go, and spammers use them heavily. Use your full web address instead." }));
  }
  if (links > 3) {
    out.push(finding({ id: "test-links", area: "email", status: "info", title: `Your email has ${links} links`, detail: "For a first email to someone new, one link reads as personal. Several read as marketing." }));
  }
  if (!realImgs && !shortener && links <= 3 && text.length >= 80) {
    out.push(finding({ id: "test-content", area: "email", status: "pass", title: "Your email's content looks clean", detail: "Mostly text, no shortened links, no tracking pixel." }));
  }
  return { fromDomain, subject: e.subject || "", findings: out };
}

module.exports = async (req, res) => {
  const inbound = process.env.INBOUND_DOMAIN;
  if (!process.env.RESEND_API_KEY || !inbound) return send(res, 200, { enabled: false });
  const token = String(req.query.token || "").toLowerCase();
  if (!/^[a-z0-9]{10,24}$/.test(token)) return send(res, 400, { error: "Bad token" });
  const address = `checkup-${token}@${inbound}`.toLowerCase();
  if (req.query.address === "1") return send(res, 200, { enabled: true, address });
  const expected = req.query.domain ? cleanHost(req.query.domain) : null;

  try {
    const list = await resend("emails/receiving?limit=100");
    if (!list.ok) return send(res, 200, { enabled: true, address, status: "error" });
    const hit = (list.json.data || []).find((m) => (m.to || []).some((t) => String(t).toLowerCase().includes(address)));
    if (!hit) return send(res, 200, { enabled: true, address, status: "waiting" });
    const full = await resend(`emails/receiving/${encodeURIComponent(hit.id)}`);
    if (!full.ok) return send(res, 200, { enabled: true, address, status: "error" });
    const result = analyze(full.json, expected);
    send(res, 200, { enabled: true, address, status: "received", ...result });
  } catch (e) {
    send(res, 200, { enabled: true, address, status: "error" });
  }
};

module.exports.analyze = analyze;
