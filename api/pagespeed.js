// GET /api/pagespeed?url=https://example.com
// Google PageSpeed Insights (mobile). Uses GOOGLE_API_KEY when set.
const { cleanUrl, finding, send } = require("./_lib/util");

module.exports = async (req, res) => {
  const site = cleanUrl(req.query.url);
  if (!site) return send(res, 400, { error: "Bad url" });
  const target = /^http:\/\//i.test(req.query.url) ? req.query.url : `https://${site.host}${site.path || ""}`;
  const key = process.env.GOOGLE_API_KEY ? `&key=${encodeURIComponent(process.env.GOOGLE_API_KEY)}` : "";
  const api = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(target)}&strategy=mobile&category=performance${key}`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 55000);
    const r = await fetch(api, { signal: ctrl.signal });
    clearTimeout(t);
    const j = await r.json();
    if (!r.ok || !j.lighthouseResult) {
      return send(res, 200, { reason: r.status, findings: [finding({ id: "speed-unknown", area: "website", status: "info", title: "We couldn't measure your speed this time", detail: "Google's speed test didn't finish. Run the checkup again later." })] });
    }
    const lh = j.lighthouseResult;
    const score = Math.round((lh.categories.performance.score || 0) * 100);
    const lcp = lh.audits["largest-contentful-paint"] && lh.audits["largest-contentful-paint"].displayValue;
    const evidence = `Google PageSpeed mobile score ${score}/100${lcp ? `, main content visible after ${lcp.replace(/\s/g, " ")}` : ""}`;
    let f;
    if (score >= 90) {
      f = finding({ id: "speed", area: "website", status: "pass", title: `Fast on phones (${score}/100)`, detail: "Google rates your site's mobile speed as good.", evidence });
    } else if (score >= 50) {
      f = finding({
        id: "speed-slow", area: "website", status: "warn", bigger: true,
        title: `Your site is a bit slow on phones (${score}/100)`,
        detail: "Google rates your mobile speed as needing improvement.",
        impact: "People searching on their phones are impatient. A slow page sends some of them back to the results to call someone else.",
        evidence,
      });
    } else {
      f = finding({
        id: "speed-poor", area: "website", status: "fail", bigger: true,
        title: `Your site is slow on phones (${score}/100)`,
        detail: "Google rates your mobile speed as poor.",
        impact: "Slow sites lose visitors before the page even shows, and Google takes speed into account when ranking.",
        evidence,
      });
    }
    send(res, 200, { score, findings: [f] });
  } catch (e) {
    send(res, 200, { findings: [finding({ id: "speed-unknown", area: "website", status: "info", title: "We couldn't measure your speed this time", detail: "Google's speed test timed out. Run the checkup again later." })] });
  }
};
