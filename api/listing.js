// GET /api/listing?name=Business&city=McKinney TX&site=example.com[&placeId=...]
// Google Business Profile check via the Places API (New). Needs GOOGLE_API_KEY.
const { cleanUrl, registrable, finding, send } = require("./_lib/util");
const { fromOurSite, rateLimited } = require("./_lib/guard");

const FIELDS = ["id", "displayName", "formattedAddress", "nationalPhoneNumber", "websiteUri", "rating", "userRatingCount", "regularOpeningHours", "businessStatus", "photos", "googleMapsUri", "primaryTypeDisplayName"];

async function places(path, init) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(`https://places.googleapis.com/v1/${path}`, { ...init, signal: ctrl.signal });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, json: j };
  } finally {
    clearTimeout(t);
  }
}

const STOP = new Set(["the", "llc", "inc", "co", "company", "corp", "ltd", "pllc", "and", "of", "services", "service"]);
function words(s) {
  return String(s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter((w) => w && !STOP.has(w));
}
// True when a Google result's name is clearly the business the visitor typed.
function nameMatch(query, placeName) {
  const a = words(query);
  const b = words(placeName);
  if (!a.length || !b.length) return false;
  const ja = a.join("");
  const jb = b.join("");
  if (ja === jb) return true;
  if (ja.length >= 4 && jb.length >= 4 && (jb.startsWith(ja) || ja.startsWith(jb)) && Math.min(ja.length, jb.length) / Math.max(ja.length, jb.length) >= 0.5) {
    // "codegrity" vs "codegrity mckinney" is fine; "code" vs "codegravity" is not.
    return b.includes(a[0]) || a.includes(b[0]);
  }
  const A = new Set(a);
  const shared = b.filter((w) => A.has(w)).length;
  return shared / Math.max(a.length, b.length) >= 0.6;
}

// A 50 km circle around the city they typed, or around the visitor (Vercel adds
// approximate location headers), so local service-area businesses can be found.
async function areaBias(city, req, headers) {
  const circle = (lat, lng) => ({ circle: { center: { latitude: lat, longitude: lng }, radius: 50000 } });
  if (city) {
    const r = await places("places:searchText", {
      method: "POST",
      headers: { ...headers, "X-Goog-FieldMask": "places.location" },
      body: JSON.stringify({ textQuery: city, pageSize: 1 }),
    }).catch(() => null);
    const loc = r && r.ok && r.json.places && r.json.places[0] && r.json.places[0].location;
    if (loc) return circle(loc.latitude, loc.longitude);
  }
  const h = req.headers || {};
  const lat = parseFloat(h["x-vercel-ip-latitude"]);
  const lng = parseFloat(h["x-vercel-ip-longitude"]);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return circle(lat, lng);
  return null;
}

function summary(p) {
  return {
    id: p.id,
    name: p.displayName && p.displayName.text,
    address: p.formattedAddress || "",
    mapsUri: p.googleMapsUri || null,
    rating: p.rating || null,
    reviews: p.userRatingCount || 0,
    type: p.primaryTypeDisplayName && p.primaryTypeDisplayName.text,
  };
}

function hostOf(u) {
  try {
    return new URL(u).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function assess(p, siteHost) {
  const out = [];
  const s = summary(p);
  out.push(finding({ id: "gbp", area: "google", status: "pass", title: "We found your Google listing", detail: `${s.name}${s.address ? ", " + s.address : ""}`, evidence: s.mapsUri || "" }));

  if (p.businessStatus === "CLOSED_PERMANENTLY" || p.businessStatus === "CLOSED_TEMPORARILY") {
    const perm = p.businessStatus === "CLOSED_PERMANENTLY";
    out.push(finding({
      id: "gbp-closed", area: "google", status: "fail", fixable: true,
      title: `Google shows you as ${perm ? "permanently" : "temporarily"} closed`,
      detail: "Anyone who finds you on Google Maps sees that you're closed.",
      impact: "People skip businesses marked closed. If you're open, you're losing every one of those customers.",
      evidence: p.businessStatus,
      diy: ["Sign in at business.google.com, open your profile and update your status to Open.", "Check your hours while you're there."],
    }));
  }
  if (!p.nationalPhoneNumber) {
    out.push(finding({
      id: "gbp-phone", area: "google", status: "fail", fixable: true,
      title: "No phone number on your Google listing",
      detail: "Google has no number to show, so there's no Call button on your listing.",
      impact: "The Call button is how most local customers contact a business they find on Maps.",
      diy: ["At business.google.com, edit your profile's Contact section and add your number."],
    }));
  } else {
    out.push(finding({ id: "gbp-phone-ok", area: "google", status: "pass", title: "Phone number is listed", evidence: p.nationalPhoneNumber }));
  }
  if (!p.regularOpeningHours) {
    out.push(finding({
      id: "gbp-hours", area: "google", status: "fail", fixable: true,
      title: "No hours on your Google listing",
      detail: "Google doesn't know when you're open.",
      impact: "People searching \"open now\" won't see you, and others won't risk calling.",
      diy: ["At business.google.com, edit your profile's Hours section. Add holiday hours too."],
    }));
  } else {
    out.push(finding({ id: "gbp-hours-ok", area: "google", status: "pass", title: "Business hours are listed" }));
  }
  if (!p.websiteUri) {
    out.push(finding({
      id: "gbp-website", area: "google", status: "fail", fixable: true,
      title: "Your Google listing doesn't link to your website",
      detail: "There's no Website button on your listing.",
      impact: "People who want to see your work or prices before calling have nowhere to go, and Google has less to connect your site to your business.",
      diy: ["At business.google.com, edit your profile's Contact section and add your website address."],
    }));
  } else {
    const lh = hostOf(p.websiteUri);
    const match = siteHost && lh && registrable(lh) === registrable(siteHost.replace(/^www\./, ""));
    if (siteHost && lh && !match && !lh.endsWith(siteHost) && !siteHost.endsWith(lh)) {
      out.push(finding({
        id: "gbp-website-mismatch", area: "google", status: "warn", fixable: true,
        title: "Your Google listing links to a different website",
        detail: `Your listing links to ${lh}, not ${siteHost}.`,
        impact: "Customers land on an old or wrong site, and Google gets mixed signals about which site is yours.",
        evidence: p.websiteUri,
        diy: ["At business.google.com, edit the website link on your profile."],
      }));
    } else {
      out.push(finding({ id: "gbp-website-ok", area: "google", status: "pass", title: "Your listing links to your website", evidence: p.websiteUri }));
    }
  }
  const photos = (p.photos || []).length;
  if (photos < 5) {
    out.push(finding({
      id: "gbp-photos", area: "google", status: "warn", fixable: true,
      title: photos ? `Only ${photos} photo${photos === 1 ? "" : "s"} on your listing` : "No photos on your listing",
      detail: "Photos of your work, your team and your storefront or vehicle help people choose you.",
      impact: "Listings with real photos look active and trustworthy; empty ones look abandoned.",
      diy: ["At business.google.com, add 10 or more real photos: your work, team, building or truck, and logo."],
    }));
  }
  if (s.reviews < 10) {
    out.push(finding({
      id: "gbp-reviews", area: "google", status: "warn", fixable: true,
      title: s.reviews ? `Only ${s.reviews} Google review${s.reviews === 1 ? "" : "s"}` : "No Google reviews yet",
      detail: "Reviews are one of the biggest things people compare when choosing a local business.",
      impact: "Competitors with more reviews tend to get the call, and they often show up higher on the map.",
      evidence: s.rating ? `${s.rating} stars from ${s.reviews} reviews` : "",
      diy: ["At business.google.com, copy your \"Ask for reviews\" link.", "Text it to your last 20 happy customers, and print it as a QR card to hand out after each job."],
    }));
  } else {
    out.push(finding({ id: "gbp-reviews-ok", area: "google", status: "pass", title: `${s.reviews} Google reviews, ${s.rating} stars` }));
  }
  if (s.rating && s.rating < 4 && s.reviews >= 5) {
    out.push(finding({ id: "gbp-rating", area: "google", status: "info", title: `Your rating is ${s.rating} stars`, detail: "Replying calmly to every review, good and bad, shows future customers how you treat people." }));
  }
  return out;
}

module.exports = async (req, res) => {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) return send(res, 200, { enabled: false });
  if (!fromOurSite(req)) return send(res, 403, { error: "Run the checkup at codegrity.com/checkup" });
  if (rateLimited(req)) return send(res, 429, { error: "Too many Google checks from your connection. Try again in a few minutes." });
  const name = String(req.query.name || "").trim().slice(0, 120);
  const city = String(req.query.city || "").trim().slice(0, 80);
  const site = req.query.site ? cleanUrl(req.query.site) : null;
  const siteHost = site ? site.host : null;
  const placeId = String(req.query.placeId || "").trim();
  const digits = String(req.query.phone || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  const phone = digits.length === 10 ? `+1 ${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}` : null;
  const headers = { "X-Goog-Api-Key": key, "Content-Type": "application/json" };

  try {
    if (placeId) {
      if (!/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) return send(res, 400, { error: "Bad place" });
      const r = await places(`places/${placeId}`, { headers: { ...headers, "X-Goog-FieldMask": FIELDS.join(",") } });
      if (!r.ok) return send(res, 200, { enabled: true, error: "lookup failed" });
      return send(res, 200, { enabled: true, match: summary(r.json), alternatives: [], findings: assess(r.json, siteHost) });
    }
    if (name.length < 2) return send(res, 400, { error: "Enter your business name" });
    const domain = siteHost ? registrable(siteHost.replace(/^www\./, "")) : null;
    const samePhone = (p) => phone && p.nationalPhoneNumber && p.nationalPhoneNumber.replace(/\D/g, "").slice(-10) === digits;
    const isMine = (p) => samePhone(p) || (domain && p.websiteUri && hostOf(p.websiteUri) && registrable(hostOf(p.websiteUri)) === domain) || nameMatch(name, p.displayName && p.displayName.text);

    // Point the search at the right area. Businesses without a street address
    // (service-area businesses) rank too low to show up in an unbiased search.
    const bias = await areaBias(city, req, headers);
    // Phone number is the most exact match; "LLC" and similar throw Google's search off.
    const plain = name.replace(/[,.]?\s+\b(llc|l\.l\.c\.|inc|incorporated|co|corp|corporation|ltd|pllc|lp)\b\.?$/i, "").trim() || name;
    // At most 3 searches per check, to keep the cost of each run small.
    const queries = [
      phone ? { q: phone, bias } : null,
      city ? { q: `${plain}, ${city}`, bias } : null,
      { q: plain, bias },
    ].filter(Boolean);
    const seen = new Map();
    let best = null;
    let failed = 0;
    for (const { q, bias: b } of queries) {
      const body = { textQuery: q, pageSize: 10, includePureServiceAreaBusinesses: true };
      if (b) body.locationBias = b;
      const r = await places("places:searchText", {
        method: "POST",
        headers: { ...headers, "X-Goog-FieldMask": FIELDS.map((f) => "places." + f).join(",") },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        failed++;
        continue;
      }
      for (const p of r.json.places || []) if (!seen.has(p.id)) seen.set(p.id, p);
      best = [...seen.values()].find(samePhone) || [...seen.values()].find((p) => domain && p.websiteUri && hostOf(p.websiteUri) && registrable(hostOf(p.websiteUri)) === domain) || [...seen.values()].find(isMine) || null;
      if (best) break;
    }
    const all = [...seen.values()];
    if (failed && !all.length) return send(res, 200, { enabled: true, error: "lookup failed", findings: [finding({ id: "gbp-unknown", area: "google", status: "info", title: "We couldn't check Google right now", detail: "Try again in a minute." })] });

    if (best) {
      return send(res, 200, { enabled: true, match: summary(best), alternatives: all.filter((p) => p !== best).slice(0, 4).map(summary), findings: assess(best, siteHost) });
    }
    if (all.length) {
      return send(res, 200, {
        enabled: true, match: null, alternatives: all.slice(0, 5).map(summary),
        findings: [finding({
          id: "gbp-unsure", area: "google", status: "info",
          title: `We couldn't find a listing named "${name}"`,
          detail: "Google returned other businesses with similar names. If yours is in the list below, pick it. If not, you may not have a Google listing yet, or it uses a different name.",
          diy: ["Search for your business on Google Maps. If it's there under a different name, run the check again with that name.", "If it isn't there, create a free profile at business.google.com and complete verification."],
        })],
      });
    }
    return send(res, 200, {
      enabled: true, match: null, alternatives: [],
      findings: [finding({
        id: "gbp-missing", area: "google", status: "fail", fixable: true,
        title: "We couldn't find you on Google Maps",
        detail: `Searching Google for "${name}${city ? ", " + city : ""}" didn't turn up a business listing.`,
        impact: "Google Maps is where most people look for a local business. If you're not there, they find your competitors instead.",
        diy: ["Search for your business on Google Maps yourself. If it's there under a different name, run this check again with that name.", "If not, create a free profile at business.google.com and complete verification."],
      })],
    });
  } catch (e) {
    send(res, 200, { enabled: true, error: "lookup failed", findings: [finding({ id: "gbp-unknown", area: "google", status: "info", title: "We couldn't check Google right now", detail: "Try again in a minute." })] });
  }
};

module.exports.assess = assess;
module.exports.nameMatch = nameMatch;
