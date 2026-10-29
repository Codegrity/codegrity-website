// GET /api/listing?name=Business&city=McKinney TX&site=example.com[&placeId=...]
// Google Business Profile check via the Places API (New). Needs GOOGLE_API_KEY.
const { cleanUrl, registrable, finding, send } = require("./_lib/util");

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
  const name = String(req.query.name || "").trim().slice(0, 120);
  const city = String(req.query.city || "").trim().slice(0, 80);
  const site = req.query.site ? cleanUrl(req.query.site) : null;
  const siteHost = site ? site.host : null;
  const placeId = String(req.query.placeId || "").trim();
  const headers = { "X-Goog-Api-Key": key, "Content-Type": "application/json" };

  try {
    if (placeId) {
      if (!/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) return send(res, 400, { error: "Bad place" });
      const r = await places(`places/${placeId}`, { headers: { ...headers, "X-Goog-FieldMask": FIELDS.join(",") } });
      if (!r.ok) return send(res, 200, { enabled: true, error: "lookup failed" });
      return send(res, 200, { enabled: true, match: summary(r.json), alternatives: [], findings: assess(r.json, siteHost) });
    }
    if (name.length < 2) return send(res, 400, { error: "Enter your business name" });
    const r = await places("places:searchText", {
      method: "POST",
      headers: { ...headers, "X-Goog-FieldMask": FIELDS.map((f) => "places." + f).join(",") },
      body: JSON.stringify({ textQuery: city ? `${name}, ${city}` : name, pageSize: 5 }),
    });
    if (!r.ok) return send(res, 200, { enabled: true, error: "lookup failed", findings: [finding({ id: "gbp-unknown", area: "google", status: "info", title: "We couldn't check Google right now", detail: "Try again in a minute." })] });
    const list = r.json.places || [];
    if (!list.length) {
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
    }
    let best = list[0];
    if (siteHost) {
      const byWeb = list.find((p) => p.websiteUri && hostOf(p.websiteUri) && registrable(hostOf(p.websiteUri)) === registrable(siteHost.replace(/^www\./, "")));
      if (byWeb) best = byWeb;
    }
    send(res, 200, {
      enabled: true,
      match: summary(best),
      alternatives: list.filter((p) => p !== best).slice(0, 4).map(summary),
      findings: assess(best, siteHost),
    });
  } catch (e) {
    send(res, 200, { enabled: true, error: "lookup failed", findings: [finding({ id: "gbp-unknown", area: "google", status: "info", title: "We couldn't check Google right now", detail: "Try again in a minute." })] });
  }
};

module.exports.assess = assess;
