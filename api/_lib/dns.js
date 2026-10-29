// DNS over HTTPS lookups (Google first, Cloudflare as fallback).
// Uniform JSON answers make results easy to test and avoid relying on the
// serverless host's own resolver.

const TYPES = { A: 1, NS: 2, CNAME: 5, MX: 15, TXT: 16, AAAA: 28 };

let fetchImpl = (...args) => fetch(...args);
function setFetch(fn) {
  fetchImpl = fn;
}

// TXT data may arrive as one string or as several quoted chunks.
function joinTxt(data) {
  const s = String(data || "").trim();
  if (!s.startsWith('"')) return s;
  const parts = s.match(/"((?:[^"\\]|\\.)*)"/g) || [];
  return parts.map((p) => p.slice(1, -1).replace(/\\"/g, '"')).join("");
}

async function query(name, type, { timeoutMs = 4000 } = {}) {
  const t = TYPES[type];
  const urls = [
    `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
  ];
  let lastErr;
  for (const url of urls) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetchImpl(url, { headers: { accept: "application/dns-json" }, signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`DNS HTTP ${res.status}`);
      const json = await res.json();
      // Status 0 = NOERROR, 3 = NXDOMAIN. Anything else is a lookup failure.
      if (json.Status !== 0 && json.Status !== 3) throw new Error(`DNS status ${json.Status}`);
      const answers = (json.Answer || []).filter((a) => a.type === t);
      return {
        ok: true,
        nxdomain: json.Status === 3,
        records: answers.map((a) => (type === "TXT" ? joinTxt(a.data) : String(a.data))),
        raw: json.Answer || [],
      };
    } catch (e) {
      lastErr = e;
    }
  }
  return { ok: false, error: String(lastErr && lastErr.message), records: [] };
}

async function txt(name) {
  return query(name, "TXT");
}

async function mx(name) {
  const r = await query(name, "MX");
  r.hosts = r.records
    .map((d) => {
      const [pri, host] = d.split(/\s+/);
      return { priority: Number(pri), host: String(host || "").replace(/\.$/, "").toLowerCase() };
    })
    .filter((h) => h.host)
    .sort((a, b) => a.priority - b.priority);
  return r;
}

module.exports = { query, txt, mx, joinTxt, setFetch, TYPES };
