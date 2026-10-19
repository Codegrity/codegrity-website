/* Codegrity - shared behavior: mobile menu, header state, icons, analytics events */
(function () {
  "use strict";

  // Ionicons (loaded once, as a module)
  if (!document.querySelector("script[data-ionicons]")) {
    var s = document.createElement("script");
    s.type = "module";
    s.src = "https://cdn.jsdelivr.net/npm/ionicons@8.1.0/dist/ionicons/ionicons.esm.js";
    s.setAttribute("data-ionicons", "");
    document.head.appendChild(s);
  }

  function track(name, params) {
    if (typeof window.gtag === "function") {
      window.gtag("event", name, params || {});
    }
  }

  function init() {
    var header = document.querySelector(".cg-header");
    if (header) {
      var onScroll = function () {
        header.classList.toggle("scrolled", window.scrollY > 40);
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();

      var toggle = header.querySelector(".cg-toggle");
      var setOpen = function (open) {
        header.classList.toggle("open", open);
        if (!toggle) return;
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      };
      if (toggle) {
        toggle.addEventListener("click", function () {
          setOpen(!header.classList.contains("open"));
        });
      }
      header.querySelectorAll(".cg-menu a").forEach(function (a) {
        a.addEventListener("click", function () {
          setOpen(false);
        });
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") setOpen(false);
      });
    }

    // Analytics: calls, emails, booking and CTA clicks, form submits
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a");
      if (!a) return;
      var href = a.getAttribute("href") || "";
      if (href.indexOf("tel:") === 0) {
        track("phone_click", { link_url: href });
      } else if (href.indexOf("mailto:") === 0) {
        track("email_click", { link_url: href });
      } else if (a.hasAttribute("data-cta")) {
        track("cta_click", {
          cta: a.getAttribute("data-cta"),
          link_url: href,
          page: location.pathname,
        });
      }
    });

    document.querySelectorAll("form[data-form]").forEach(function (form) {
      form.addEventListener("submit", function () {
        track("generate_lead", { form: form.getAttribute("data-form"), page: location.pathname });
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
