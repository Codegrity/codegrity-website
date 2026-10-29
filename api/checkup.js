// GET /api/checkup?site=example.com&mail=example.com
// Email (DNS) and website checks. Nothing is stored or logged.
const { checkEmail } = require("./_lib/emailchecks");
const { checkWebsite } = require("./_lib/webchecks");
const { cleanUrl, cleanHost, FREE_MAIL, freeHost, registrable, finding, send } = require("./_lib/util");
const dns = require("./_lib/dns");

module.exports = async (req, res) => {
  if (req.method !== "GET") return send(res, 405, { error: "GET only" });
  const site = cleanUrl(req.query.site);
  if (!site) return send(res, 400, { error: "Enter a website address like yourbusiness.com" });
  const mailDomain = req.query.mail ? cleanHost(req.query.mail) : null;

  const siteDomain = site.host.replace(/^www\./, "");
  const siteIsFree = Boolean(freeHost(siteDomain));
  const freeMail = mailDomain && FREE_MAIL.has(mailDomain);
  const ownMail = mailDomain && !freeMail && !freeHost(mailDomain) ? mailDomain : null;
  // Email checks only make sense on a domain the business owns.
  const emailDomain = ownMail || (siteIsFree ? null : siteDomain);
  // true when they told us they use an address at this domain; null when unknown.
  const usesDomainEmail = ownMail ? true : mailDomain ? false : null;

  // A misspelled or unregistered domain: say so once instead of a page of failures.
  const ns = await dns.query(registrable(siteDomain), "NS");
  if (ns.ok && !ns.records.length) {
    return send(res, 200, {
      site: `${site.host}${site.path || ""}`,
      emailDomain: null,
      checkedAt: new Date().toISOString(),
      findings: [finding({ id: "domain-unknown", area: "website", status: "info", title: `We couldn't find ${registrable(siteDomain)}`, detail: "That domain doesn't seem to be registered. Check the spelling and run the checkup again." })],
    });
  }

  const [email, web] = await Promise.all([
    emailDomain ? checkEmail(emailDomain, { usesDomainEmail }) : Promise.resolve({ findings: [], provider: null, dnsHost: null }),
    checkWebsite(site),
  ]);

  const findings = [...email.findings];
  if (!emailDomain) {
    findings.unshift(finding({
      id: "no-own-domain", area: "email", status: "info",
      title: "Email checks need your own domain",
      detail: `${freeMail ? `You use a free ${mailDomain} address and` : "Your"} website is on a builder's address, so there's no domain of yours to protect yet. Once you have your own domain (yourbusiness.com), an address like you@yourbusiness.com looks more established and these checks will apply.`,
    }));
  } else if (freeMail) {
    findings.unshift(finding({
      id: "free-mail", area: "email", status: "info",
      title: `You're using a free ${mailDomain} address`,
      detail: `It works, but an address like you@${siteDomain} looks more established and builds trust with new customers. The checks below cover ${siteDomain}, so nobody can send fake email in its name.`,
    }));
  }
  findings.push(...web.findings);

  send(res, 200, {
    site: `${site.host}${site.path || ""}`,
    emailDomain,
    emailProvider: email.provider,
    dnsHost: email.dnsHost,
    finalUrl: web.meta.finalUrl,
    builder: web.meta.builder,
    phone: web.meta.phone,
    checkedAt: new Date().toISOString(),
    findings,
  });
};
