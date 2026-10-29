/* Codegrity Business Checkup: runs the checks, renders the report, prices the fixes.
   Nothing is stored. Results live only in this page until it's closed. */
(() => {
  "use strict";

  const CONTACT = "psojdei@codegrity.com";
  const BOOK = "https://cal.com/codegrity/intro";
  const PACKS = [
    { id: "quick", name: "Quick Fix", per: 79, min: 1, max: 2, blurb: "We fix up to 2 items." },
    { id: "tune", name: "Tune-Up", per: 69, min: 3, max: 4, blurb: "We fix 3 or 4 items." },
    { id: "all", name: "Fix Everything", per: 63, min: 5, max: Infinity, blurb: "We fix every item on your report, at 20% off." },
  ];
  const LIST_PRICE = 79;
  const AREAS = [
    { id: "email", label: "Email", icon: "mail-outline" },
    { id: "website", label: "Website", icon: "globe-outline" },
    { id: "google", label: "Google listing", icon: "location-outline" },
  ];
  const ICON = { fail: "close-circle", warn: "alert-circle", pass: "checkmark-circle", info: "information-circle" };
  const RANK = { fail: 0, warn: 1, info: 2, pass: 3 };

  const $ = (s, r = document) => r.querySelector(s);
  const form = $("#ck-form");
  const results = $("#ck-results");
  const errBox = $("#ck-error");

  let S = null; // current run state
  let runId = 0;
  let linkMail = ""; // email domain from a shared link

  $("#ck-mail").addEventListener("input", () => (linkMail = ""));

  // ---------- tiny DOM helper (text is always escaped)
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  const icon = (name, cls) => h("ion-icon", { name, class: cls, "aria-hidden": "true" });
  const money = (n) => "$" + Math.round(n).toLocaleString("en-US");

  // ---------- inputs
  function cleanSite(v) {
    let s = String(v || "").trim();
    if (!s) return null;
    s = s.replace(/^[a-z]+:\/\//i, "").replace(/\/+$/, "");
    if (!/^[a-z0-9.-]+\.[a-z]{2,}(\/[^\s]*)?$/i.test(s)) return null;
    return s.toLowerCase();
  }
  function mailDomain(v) {
    const s = String(v || "").trim().toLowerCase();
    if (!s) return "";
    const d = s.includes("@") ? s.split("@").pop() : s;
    return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d) ? d : "";
  }
  function token() {
    const a = new Uint8Array(12);
    crypto.getRandomValues(a);
    return Array.from(a, (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
  }

  async function getJSON(url) {
    const r = await fetch(url, { headers: { accept: "application/json" } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
    return j;
  }

  // ---------- run
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    start();
  });

  function start() {
    errBox.textContent = "";
    const site = cleanSite($("#ck-site").value);
    if (!site) {
      errBox.textContent = "Enter your website address, like yourbusiness.com";
      $("#ck-site").focus();
      return;
    }
    const mail = $("#ck-mail").value.trim();
    const md = mail ? mailDomain(mail) : linkMail;
    if (mail && !md) {
      errBox.textContent = "That email address doesn't look right.";
      $("#ck-mail").focus();
      return;
    }
    const id = ++runId;
    S = {
      id,
      site,
      mail: md,
      name: $("#ck-name").value.trim(),
      city: $("#ck-city").value.trim(),
      src: { checkup: [], speed: [], listing: [], test: [] },
      loading: { checkup: true, speed: true, listing: false },
      meta: {},
      listing: null,
      test: { enabled: null, token: token(), address: null, status: "idle", info: null, until: 0 },
      checkedAt: new Date(),
    };
    const q = new URLSearchParams({ site });
    if (md) q.set("mail", md);
    if (S.name) q.set("name", S.name);
    if (S.city) q.set("city", S.city);
    history.replaceState(null, "", "/checkup?" + q.toString());

    results.hidden = false;
    $("#ck-what").hidden = true;
    render();
    results.scrollIntoView({ behavior: "smooth", block: "start" });

    const ckq = new URLSearchParams({ site });
    if (md) ckq.set("mail", md);
    getJSON("/api/checkup?" + ckq)
      .then((j) => {
        if (id !== runId) return;
        S.src.checkup = j.findings || [];
        S.meta = j;
        S.loading.checkup = false;
        render();
        runSpeed(id, j.finalUrl);
      })
      .catch((err) => {
        if (id !== runId) return;
        S.loading.checkup = false;
        S.loading.speed = false;
        S.fatal = err.message;
        render();
      });

    if (S.name) runListing(id, {});
    getJSON(`/api/email-test?token=${S.test.token}&address=1`)
      .then((j) => {
        if (id !== runId) return;
        S.test.enabled = Boolean(j.enabled);
        S.test.address = j.address || null;
        render();
      })
      .catch(() => {
        if (id !== runId) return;
        S.test.enabled = false;
        render();
      });
  }

  function runSpeed(id, finalUrl) {
    if (!finalUrl) {
      S.loading.speed = false;
      render();
      return;
    }
    getJSON("/api/pagespeed?url=" + encodeURIComponent(finalUrl))
      .then((j) => {
        if (id !== runId) return;
        S.src.speed = j.findings || [];
      })
      .catch(() => {})
      .finally(() => {
        if (id !== runId) return;
        S.loading.speed = false;
        render();
      });
  }

  function runListing(id, { placeId }) {
    S.loading.listing = true;
    render();
    const q = new URLSearchParams({ site: S.site });
    if (placeId) q.set("placeId", placeId);
    else {
      q.set("name", S.name);
      if (S.city) q.set("city", S.city);
    }
    getJSON("/api/listing?" + q)
      .then((j) => {
        if (id !== runId) return;
        if (placeId && S.listing) j.alternatives = S.listing.all.filter((a) => a.id !== placeId);
        S.listing = { enabled: j.enabled !== false, match: j.match || null, alternatives: j.alternatives || [] };
        S.listing.all = [S.listing.match, ...S.listing.alternatives].filter(Boolean);
        S.src.listing = j.findings || [];
      })
      .catch((err) => {
        if (id !== runId) return;
        S.listing = { enabled: true, error: err.message, alternatives: [] };
        S.src.listing = [];
      })
      .finally(() => {
        if (id !== runId) return;
        S.loading.listing = false;
        render();
      });
  }

  // ---------- email test polling
  function startPolling() {
    if (!S || !S.test.enabled || S.test.status === "received") return;
    S.test.until = Date.now() + 10 * 60 * 1000;
    if (S.test.status !== "waiting") {
      S.test.status = "waiting";
      render();
      poll(S.id);
    }
  }
  function poll(id) {
    if (!S || id !== runId || S.test.status !== "waiting") return;
    if (Date.now() > S.test.until) {
      S.test.status = "timeout";
      render();
      return;
    }
    const q = new URLSearchParams({ token: S.test.token });
    if (S.meta && S.meta.emailDomain) q.set("domain", S.meta.emailDomain);
    getJSON("/api/email-test?" + q)
      .then((j) => {
        if (id !== runId) return;
        if (j.status === "received") {
          S.test.status = "received";
          S.test.info = { from: j.fromDomain, subject: j.subject };
          S.src.test = j.findings || [];
          render();
        } else setTimeout(() => poll(id), 5000);
      })
      .catch(() => setTimeout(() => poll(id), 8000));
  }

  // ---------- merge and count
  function merged() {
    const c = S.src.checkup;
    let test = S.src.test.slice();
    let base = [...c, ...S.src.speed, ...S.src.listing];
    const has = (id) => base.some((f) => f.id === id);
    const tk = (id) => test.find((f) => f.id === id);

    const tdk = tk("test-dkim");
    if (tdk) {
      if (tdk.status !== "pass" && has("dkim-missing")) test = test.filter((f) => f !== tdk);
      else base = base.filter((f) => !["dkim", "dkim-missing", "dkim-unknown"].includes(f.id));
    }
    const tspf = tk("test-spf");
    if (tspf && ((tspf.status !== "pass" && base.some((f) => f.id.startsWith("spf-") && f.fixable)) || (tspf.status === "pass" && has("spf")))) test = test.filter((f) => f !== tspf);
    const tdm = tk("test-dmarc");
    if (tdm && ((tdm.status !== "pass" && (has("dmarc-missing") || has("dmarc-multiple"))) || (tdm.status === "pass" && (has("dmarc") || has("dmarc-none"))))) test = test.filter((f) => f !== tdm);

    return [...base, ...test];
  }

  function counts(all) {
    const fixes = all.filter((f) => f.fixable && f.status !== "pass");
    const bigger = all.filter((f) => f.bigger && f.status !== "pass");
    const good = all.filter((f) => f.status === "pass");
    return { fixes, bigger, good };
  }

  // ---------- render
  function render() {
    if (!S) return;
    const all = merged();
    const c = counts(all);
    renderSummary(all, c);
    renderSections(all);
    renderPackages(c);
  }

  function busy() {
    return S.loading.checkup || S.loading.speed || S.loading.listing;
  }

  function renderSummary(all, c) {
    const box = $("#ck-summary");
    box.replaceChildren();
    const when = S.checkedAt.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
    box.append(
      h("p", { class: "kicker" }, "Your checkup"),
      h("h2", { class: "ck-site" }, S.site),
      h("p", { class: "muted ck-when" }, `Checked ${when}`)
    );
    if (S.fatal) {
      box.append(h("p", { class: "form-status err" }, S.fatal));
      return;
    }
    const stats = h(
      "div",
      { class: "ck-stats" },
      h("div", { class: "ck-stat ck-stat-fix" }, h("strong", {}, String(c.fixes.length)), h("span", {}, c.fixes.length === 1 ? "thing to fix" : "things to fix")),
      h("div", { class: "ck-stat" }, h("strong", {}, String(c.bigger.length)), h("span", {}, c.bigger.length === 1 ? "bigger job" : "bigger jobs")),
      h("div", { class: "ck-stat ck-stat-good" }, h("strong", {}, String(c.good.length)), h("span", {}, c.good.length === 1 ? "thing looks good" : "things look good"))
    );
    box.append(stats);
    if (busy()) box.append(h("p", { class: "ck-running" }, h("span", { class: "ck-spin", "aria-hidden": "true" }), "Still checking: ", [S.loading.checkup && "email and website", S.loading.speed && "phone speed (up to a minute)", S.loading.listing && "Google listing"].filter(Boolean).join(", ")));
    box.append(
      h(
        "div",
        { class: "ck-tools" },
        h("button", { class: "btn btn-quiet ck-small", type: "button", onclick: copyLink }, icon("link-outline"), "Copy link to this checkup"),
        h("button", { class: "btn btn-quiet ck-small", type: "button", onclick: () => printReport() }, icon("print-outline"), "Print or save as PDF"),
        h("button", { class: "btn btn-quiet ck-small", type: "button", onclick: () => { results.hidden = true; $("#ck-what").hidden = false; window.scrollTo({ top: 0, behavior: "smooth" }); $("#ck-site").focus(); } }, icon("refresh-outline"), "Check another business")
      )
    );
  }

  function copyLink(e) {
    const btn = e.currentTarget;
    const url = location.href;
    const done = () => {
      btn.lastChild.textContent = "Link copied";
      setTimeout(() => (btn.lastChild.textContent = "Copy link to this checkup"), 2000);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => prompt("Copy this link:", url));
    else prompt("Copy this link:", url);
  }

  function printReport() {
    document.querySelectorAll(".ck-results details").forEach((d) => (d.open = true));
    window.print();
  }

  function item(f) {
    const tag = f.status === "pass" || f.status === "info" ? null : f.fixable ? h("span", { class: "ck-tag" }, "In fix packages") : f.bigger ? h("span", { class: "ck-tag ck-tag-big" }, "Bigger job") : null;
    return h(
      "article",
      { class: `ck-item ck-${f.status}` },
      h("div", { class: "ck-ico" }, icon(ICON[f.status])),
      h(
        "div",
        { class: "ck-body" },
        h("div", { class: "ck-head" }, h("h4", {}, f.title), tag),
        f.detail && h("p", {}, f.detail),
        f.impact && h("p", { class: "ck-impact" }, h("strong", {}, "What this means for you: "), f.impact),
        f.evidence && h("p", { class: "ck-evidence" }, h("span", {}, "What we saw"), h("code", {}, f.evidence)),
        f.diy && f.diy.length ? h("details", { class: "ck-diy" }, h("summary", {}, "Fix it yourself"), h("ol", {}, f.diy.map((s) => h("li", {}, s)))) : null
      )
    );
  }

  function renderSections(all) {
    const wrap = $("#ck-sections");
    // Keep open/closed state of details across re-renders.
    const open = new Set(Array.from(wrap.querySelectorAll("details[open]"), (d) => d.dataset.key).filter(Boolean));
    wrap.replaceChildren();
    for (const area of AREAS) {
      const rows = all.filter((f) => f.area === area.id).sort((a, b) => RANK[a.status] - RANK[b.status]);
      const issues = rows.filter((f) => f.status !== "pass");
      const good = rows.filter((f) => f.status === "pass");
      const toFix = rows.filter((f) => (f.fixable || f.bigger) && f.status !== "pass").length;
      const loading = area.id === "google" ? S.loading.listing : area.id === "website" ? S.loading.checkup || S.loading.speed : S.loading.checkup;

      const sec = h(
        "section",
        { class: "ck-sec", id: "ck-" + area.id },
        h(
          "header",
          { class: "ck-sec-head" },
          icon(area.icon),
          h("h3", {}, area.label),
          loading ? h("span", { class: "ck-badge ck-badge-wait" }, "Checking") : rows.length ? h("span", { class: "ck-badge" + (toFix ? " ck-badge-bad" : " ck-badge-ok") }, toFix ? `${toFix} to fix` : "Looks good") : null
        )
      );
      const metaLine = sectionMeta(area.id);
      if (metaLine) sec.append(h("p", { class: "ck-meta" }, metaLine));
      if (area.id === "google") sec.append(googleBlock());
      issues.forEach((f) => sec.append(item(f)));
      const m = S.meta || {};
      if (area.id === "email" && !S.loading.checkup && m.emailDomain && (!S.mail || S.mail === m.emailDomain)) sec.append(testPanel());
      if (good.length) {
        const d = h("details", { class: "ck-good", "data-key": "good-" + area.id }, h("summary", {}, `${good.length} thing${good.length === 1 ? "" : "s"} look${good.length === 1 ? "s" : ""} good`), good.map(item));
        if (open.has(d.dataset.key)) d.open = true;
        sec.append(d);
      }
      if (loading && !rows.length) sec.append(h("p", { class: "ck-running" }, h("span", { class: "ck-spin", "aria-hidden": "true" }), "Checking…"));
      wrap.append(sec);
    }
  }

  function sectionMeta(area) {
    const m = S.meta || {};
    if (area === "email" && m.emailDomain) {
      return [`Checked ${m.emailDomain}`, m.emailProvider && `email by ${m.emailProvider}`, m.dnsHost && `DNS managed at ${m.dnsHost}`].filter(Boolean).join(" · ");
    }
    if (area === "website" && m.finalUrl) {
      return [`Loaded ${m.finalUrl}`, m.builder && `built with ${m.builder}`].filter(Boolean).join(" · ");
    }
    return null;
  }

  function googleBlock() {
    const box = h("div", { class: "ck-google" });
    if (!S.name) {
      const name = h("input", { type: "text", placeholder: "Business name", "aria-label": "Business name", autocomplete: "organization" });
      const city = h("input", { type: "text", placeholder: "City", "aria-label": "City", value: S.city || "" });
      box.append(
        h("p", {}, "Add your business name to check your Google Maps listing."),
        h(
          "form",
          {
            class: "ck-inline",
            onsubmit: (e) => {
              e.preventDefault();
              if (name.value.trim().length < 2) return name.focus();
              S.name = name.value.trim();
              S.city = city.value.trim();
              $("#ck-name").value = S.name;
              $("#ck-city").value = S.city;
              const q = new URLSearchParams(location.search);
              q.set("name", S.name);
              if (S.city) q.set("city", S.city);
              history.replaceState(null, "", "/checkup?" + q);
              runListing(S.id, {});
            },
          },
          name,
          city,
          h("button", { class: "btn btn-primary ck-small", type: "submit" }, "Check my listing")
        )
      );
      return box;
    }
    if (!S.listing) return box;
    if (S.listing.enabled === false) {
      box.append(h("p", { class: "muted" }, "The Google listing check is being switched on. Check back soon."));
      return box;
    }
    if (S.listing.error) {
      box.append(h("p", { class: "muted" }, S.listing.error));
      return box;
    }
    const m = S.listing.match;
    if (m) {
      box.append(
        h(
          "div",
          { class: "ck-place" },
          icon("storefront-outline"),
          h("div", {}, h("strong", {}, m.name), h("span", { class: "muted" }, m.address), m.mapsUri ? h("a", { href: m.mapsUri, target: "_blank", rel: "noopener" }, "Open in Google Maps") : null)
        )
      );
    }
    if (S.listing.alternatives && S.listing.alternatives.length) {
      const label = m ? "Not you? Pick your business" : "Is one of these you? Pick it";
      const sel = h("select", { "aria-label": "Pick your business" }, h("option", { value: "" }, label), S.listing.alternatives.map((a) => h("option", { value: a.id }, `${a.name}${a.address ? ", " + a.address : ""}`)));
      sel.addEventListener("change", () => sel.value && runListing(S.id, { placeId: sel.value }));
      box.append(sel);
    }
    return box;
  }

  function testPanel() {
    const t = S.test;
    if (t.enabled === null) return h("div");
    if (!t.enabled) return h("div");
    const box = h("div", { class: "ck-test" });
    if (t.status === "received") {
      box.append(
        h("h4", {}, icon("checkmark-done-outline"), " We got your test email"),
        h("p", { class: "muted" }, `From ${t.info.from || "your address"}${t.info.subject ? `, subject "${t.info.subject}"` : ""}. The results are included above.`)
      );
      return box;
    }
    const fromAddr = S.mail ? `your @${S.mail} address` : `your @${S.meta.emailDomain} email address`;
    const addr = h("code", {}, t.address);
    const copyBtn = h(
      "button",
      {
        class: "btn btn-quiet ck-small",
        type: "button",
        onclick: (e) => {
          const b = e.currentTarget;
          (navigator.clipboard ? navigator.clipboard.writeText(t.address) : Promise.reject()).then(
            () => {
              b.lastChild.textContent = "Copied";
              setTimeout(() => (b.lastChild.textContent = "Copy"), 1800);
            },
            () => prompt("Copy this address:", t.address)
          );
          startPolling();
        },
      },
      icon("copy-outline"),
      "Copy"
    );
    box.append(
      h("h4", {}, icon("paper-plane-outline"), " Get the full email check"),
      h("p", {}, `Send a short email from ${fromAddr} to the address below. We'll see exactly how the receiving server judged it, using the same checks Gmail and Outlook run.`),
      h("div", { class: "ck-addr" }, addr, copyBtn),
      h("p", { class: "muted ck-small-text" }, "Write it like a normal email to a customer: a few sentences and your usual signature, so we can check the formatting too. Nothing private, please."),
      h(
        "div",
        { class: "ck-test-actions" },
        h("a", { class: "btn btn-quiet ck-small", href: `mailto:${t.address}?subject=${encodeURIComponent("Checking in")}`, onclick: startPolling }, icon("mail-open-outline"), "Open my email app"),
        t.status === "idle" ? h("button", { class: "btn btn-primary ck-small", type: "button", onclick: startPolling }, "I sent it") : null
      )
    );
    if (t.status === "waiting") box.append(h("p", { class: "ck-running" }, h("span", { class: "ck-spin", "aria-hidden": "true" }), "Waiting for your email. It usually arrives within a minute."));
    if (t.status === "timeout")
      box.append(
        h("p", { class: "muted" }, "We haven't seen it yet. Check the address and try again. ", h("button", { class: "ck-linkbtn", type: "button", onclick: () => { S.test.status = "idle"; startPolling(); } }, "Keep waiting"))
      );
    return box;
  }

  function renderPackages(c) {
    const box = $("#ck-packages");
    box.replaceChildren();
    if (S.loading.checkup || S.fatal) return;
    const n = c.fixes.length;
    const head = h("div", { class: "sec-head" });
    if (n === 0) {
      head.append(h("h2", {}, "Nothing small to fix. Nice work."), h("p", {}, c.bigger.length ? "There's one bigger item above. It's usually part of a site rebuild, so we'd quote it separately." : "Your email, website and listing are in good shape. Run it again any time something changes."));
      box.append(head);
      if (c.bigger.length) box.append(biggerBlock(c));
      return;
    }
    head.append(
      h("h2", {}, "Want us to fix it?"),
      h("p", {}, `We found ${n} thing${n === 1 ? "" : "s"} we can fix for you, usually within a few days. Every item above also has steps if you'd rather do it yourself.`)
    );
    box.append(head);

    const rec = PACKS.find((p) => n >= p.min && n <= p.max) || PACKS[2];
    const grid = h("div", { class: "ck-pack-grid" });
    for (const p of PACKS) {
      const covers = Math.min(n, p.max);
      const usable = p.id === "quick" || n >= p.min;
      const total = covers * p.per;
      const isRec = p === rec;
      const list = covers * LIST_PRICE;
      const card = h(
        "div",
        { class: "ck-pack" + (isRec ? " is-rec" : "") + (usable ? "" : " is-off") },
        isRec ? h("p", { class: "badge" }, n > p.max ? "Best value" : "Covers everything we found") : null,
        h("h3", {}, p.name),
        h("p", { class: "ck-pack-blurb" }, p.blurb),
        h("div", { class: "amount" }, money(p.per), h("span", { class: "per" }, " per fix")),
        usable
          ? h(
              "p",
              { class: "ck-pack-total" },
              p.id === "all" ? `All ${n} fixes: ` : covers < n ? `Pick your top ${covers}: ` : `Your ${covers} fix${covers === 1 ? "" : "es"}: `,
              h("strong", {}, money(total)),
              total < list ? h("span", { class: "ck-save" }, ` (save ${money(list - total)})`) : null
            )
          : h("p", { class: "ck-pack-total muted" }, `For reports with ${p.min} or more fixes`),
        usable ? h("a", { class: "btn " + (isRec ? "btn-primary" : "btn-quiet"), href: orderLink(p, covers, total, c) }, `Get the ${p.name}`) : null
      );
      grid.append(card);
    }
    box.append(grid);
    const webFixes = c.fixes.filter((f) => f.area === "website").length;
    if (webFixes >= 4 || c.fixes.some((f) => f.id === "free-host")) {
      box.append(
        h(
          "div",
          { class: "ck-rebuild" },
          icon("construct-outline"),
          h(
            "p",
            {},
            h("strong", {}, "Thinking about a new website instead? "),
            `With ${webFixes} website fix${webFixes === 1 ? "" : "es"}, a rebuild may be the better deal. Every website item above is included when we build your new site ($750, then $79 a month for hosting and care). `,
            h("a", { href: "/local" }, "See local website plans")
          )
        )
      );
    }
    box.append(
      h(
        "div",
        { class: "ck-how" },
        h("h3", {}, "How it works"),
        h(
          "ol",
          {},
          h("li", {}, "Tap a package. It opens an email to PJ with your checkup attached. Nothing is charged yet."),
          h("li", {}, "We confirm what's included and set up access together (usually your domain or Google account)."),
          h("li", {}, "We make the fixes, run the checkup again with you, and send a short note on what changed.")
        ),
        h("p", { class: "muted" }, "Rather talk first? ", h("a", { href: BOOK, target: "_blank", rel: "noopener" }, "Book a free 15-minute call"), " or call ", h("a", { href: "tel:+19728387422" }, "(972) 838-7422"), ".")
      )
    );
    if (c.bigger.length) box.append(biggerBlock(c));
  }

  function biggerBlock(c) {
    return h(
      "div",
      { class: "ck-bigger" },
      h("h3", {}, "Bigger jobs"),
      h("p", { class: "muted" }, "These take more than a quick fix, so they aren't in the packages. We'll quote them, and they're included when we rebuild a site on one of our ", h("a", { href: "/local" }, "local website plans"), "."),
      h("ul", {}, c.bigger.map((f) => h("li", {}, f.title)))
    );
  }

  function orderLink(p, covers, total, c) {
    const lines = c.fixes.map((f, i) => `${i + 1}. ${f.title}`);
    const body =
      `Hi PJ,\n\nI ran the Business Checkup for ${S.site} and I'd like the ${p.name}` +
      (p.id === "all" ? ` (all ${c.fixes.length} fixes, ${money(total)}).` : ` (${covers} fix${covers === 1 ? "" : "es"}, ${money(total)}).`) +
      `\n\nHere's what the checkup found:\n${lines.join("\n")}\n` +
      (c.bigger.length ? `\nBigger jobs it mentioned:\n${c.bigger.map((f) => "- " + f.title).join("\n")}\n` : "") +
      `\nMy checkup: ${location.href}\n\nBest time to reach me:\n`;
    return `mailto:${CONTACT}?subject=${encodeURIComponent(`${p.name} for ${S.site}`)}&body=${encodeURIComponent(body)}`;
  }

  // ---------- start from a shared link (it carries only the email domain)
  const qp = new URLSearchParams(location.search);
  if (qp.get("site")) {
    $("#ck-site").value = qp.get("site");
    if (qp.get("name")) $("#ck-name").value = qp.get("name");
    if (qp.get("city")) $("#ck-city").value = qp.get("city");
    linkMail = qp.get("mail") ? mailDomain(qp.get("mail")) : "";
    if (linkMail) $("#ck-mail").placeholder = "you@" + linkMail;
    start();
  }
})();
