// Safe outbound fetching for user-supplied websites: public IPs only, manual
// redirects (each hop re-checked), a timeout and a size cap.
const dns = require("./dns");
const net = require("net");
const tls = require("tls");

let fetchImpl = (...args) => fetch(...args);
let certImpl = null;
function setFetch(fn) {
  fetchImpl = fn;
}
function setCert(fn) {
  certImpl = fn;
}

function privateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const s = ip.toLowerCase();
  return s === "::1" || s === "::" || s.startsWith("fc") || s.startsWith("fd") || s.startsWith("fe80") || s.startsWith("::ffff:");
}

async function hostIsPublic(host) {
  if (net.isIP(host)) return !privateIp(host);
  const [a, aaaa] = await Promise.all([dns.query(host, "A"), dns.query(host, "AAAA")]);
  const ips = [...a.records, ...aaaa.records];
  if (!ips.length) return null; // does not resolve
  return ips.every((ip) => !privateIp(ip));
}

async function readCapped(res, max = 1.5e6) {
  const reader = res.body && res.body.getReader ? res.body.getReader() : null;
  if (!reader) return (await res.text()).slice(0, max);
  const chunks = [];
  let size = 0;
  while (size < max) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  try {
    reader.cancel();
  } catch {}
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
}

// Returns { ok, status, url, hops: [{url,status,location}], html, headers, error, code }
async function safeGet(startUrl, { timeoutMs = 9000, maxHops = 6, wantBody = true } = {}) {
  const hops = [];
  let url = startUrl;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    for (let i = 0; i <= maxHops; i++) {
      const u = new URL(url);
      if (!/^https?:$/.test(u.protocol)) return { ok: false, error: "Unsupported redirect", hops };
      const pub = await hostIsPublic(u.hostname);
      if (pub === null) return { ok: false, error: `${u.hostname} doesn't resolve`, code: "ENOTFOUND", hops };
      if (!pub) return { ok: false, error: "Address not allowed", code: "PRIVATE", hops };
      const res = await fetchImpl(url, {
        redirect: "manual",
        signal: ctrl.signal,
        headers: { "user-agent": "Mozilla/5.0 (compatible; CodegrityCheckup/1.0; +https://www.codegrity.com/checkup)", accept: "text/html,*/*" },
      });
      const loc = res.headers.get("location");
      hops.push({ url, status: res.status, location: loc || null });
      if (res.status >= 300 && res.status < 400 && loc) {
        url = new URL(loc, url).toString();
        continue;
      }
      const html = wantBody ? await readCapped(res) : "";
      return { ok: true, status: res.status, url, hops, html, headers: Object.fromEntries(res.headers.entries()) };
    }
    return { ok: false, error: "Too many redirects", hops };
  } catch (e) {
    const cause = (e && e.cause) || {};
    return { ok: false, error: String(cause.message || e.message || e), code: cause.code || (e.name === "AbortError" ? "TIMEOUT" : e.code), hops };
  } finally {
    clearTimeout(timer);
  }
}

// Certificate expiry for host:443. Resolves { validTo: Date, issuer } or { error }.
function certInfo(host, timeoutMs = 6000) {
  if (certImpl) return certImpl(host);
  return new Promise((resolve) => {
    const sock = tls.connect({ host, servername: host, port: 443, rejectUnauthorized: false, timeout: timeoutMs }, () => {
      const c = sock.getPeerCertificate();
      const authorized = sock.authorized;
      const authErr = sock.authorizationError;
      sock.end();
      if (!c || !c.valid_to) return resolve({ error: "No certificate" });
      resolve({ validTo: new Date(c.valid_to), issuer: (c.issuer && (c.issuer.O || c.issuer.CN)) || "", authorized, authError: authErr ? String(authErr) : null });
    });
    sock.on("error", (e) => resolve({ error: e.code || e.message }));
    sock.on("timeout", () => {
      sock.destroy();
      resolve({ error: "TIMEOUT" });
    });
  });
}

module.exports = { safeGet, certInfo, hostIsPublic, privateIp, setFetch, setCert };
