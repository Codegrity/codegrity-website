/**
 * CodeGrity - Shared Navigation Component
 * Builds the site nav, marks the current page, adds a mobile menu,
 * and loads Ionicons once for every page.
 * Works from root pages and the /blog/ subdirectory.
 */

(function () {
  var IONICONS_SRC =
    "https://cdn.jsdelivr.net/npm/ionicons@8.1.0/dist/ionicons/ionicons.esm.js";

  function loadIonicons() {
    if (document.querySelector('script[data-ionicons]')) return;
    var s = document.createElement("script");
    s.type = "module";
    s.src = IONICONS_SRC;
    s.setAttribute("data-ionicons", "");
    document.head.appendChild(s);
  }

  function injectStyles() {
    if (document.getElementById("nav-js-styles")) return;
    var css =
      "ion-icon{font-size:inherit;vertical-align:middle}" +
      ".nav-links{gap:2.25rem}" +
      ".nav-toggle{display:none;background:none;border:1px solid rgba(255,255,255,.15);color:#f8fafc;" +
      "border-radius:10px;width:44px;height:44px;align-items:center;justify-content:center;font-size:1.5rem}" +
      ".nav-toggle:focus-visible{outline:2px solid #3b82f6;outline-offset:2px}" +
      "@media (max-width:1100px){.nav-links{gap:1.5rem}.nav-number{display:none}}" +
      "@media (max-width:900px){" +
      "#site-nav .cta-button{display:none}" +
      ".nav-toggle{display:inline-flex}" +
      "#site-nav .nav-links{display:none;position:absolute;top:100%;left:0;right:0;flex-direction:column;gap:0;" +
      "background:#0a0a0a;border-bottom:1px solid rgba(255,255,255,.08);padding:.5rem 5% 1.25rem}" +
      "#site-nav.open .nav-links{display:flex}" +
      "#site-nav .nav-links li{border-top:1px solid rgba(255,255,255,.06)}" +
      "#site-nav .nav-links a{display:block;padding:.9rem 0;font-size:1.05rem}" +
      "#site-nav .nav-links a::after{display:none}" +
      "#site-nav .nav-cta-mobile{display:block}" +
      "}" +
      ".nav-cta-mobile{display:none}" +
      ".nav-cta-mobile a{color:#3b82f6 !important;font-weight:600}";
    var style = document.createElement("style");
    style.id = "nav-js-styles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function buildNav() {
    var path = window.location.pathname;
    var inBlog = path.indexOf("/blog/") !== -1;
    var root = inBlog ? "../" : "";

    var navItems = [
      { href: "index.html", label: "Home", num: "00" },
      { href: "services.html", label: "Services", num: "01" },
      { href: "local.html", label: "Local Businesses", num: "02" },
      { href: "work.html", label: "Work", num: "03" },
      { href: "about.html", label: "About", num: "04" },
      { href: "contact.html", label: "Contact", num: "05" },
      { href: "blog/index.html", label: "Blog", num: "06" },
    ];

    var currentFile = path.split("/").pop() || "index.html";
    // Clean URLs (e.g. /local) map to local.html
    if (currentFile.indexOf(".") === -1) currentFile = currentFile + ".html";

    function isActive(href) {
      var file = href.split("/").pop();
      if (inBlog && href.indexOf("blog/") === 0) return true;
      if (!inBlog && file === currentFile) return true;
      return false;
    }

    var linksHTML = navItems
      .map(function (item) {
        var active = isActive(item.href)
          ? ' class="active" aria-current="page"'
          : "";
        return (
          '<li><a href="' +
          root +
          item.href +
          '"' +
          active +
          ">" +
          item.label +
          '<span class="nav-number">' +
          item.num +
          "</span></a></li>"
        );
      })
      .join("");

    var navHTML =
      '<nav id="site-nav" aria-label="Main">' +
      '<a href="' +
      root +
      'index.html" class="logo-nav">' +
      '<div class="logo-icon">' +
      '<div class="lock-outer"></div>' +
      '<div class="lock-inner"><div class="lock-dot"></div></div>' +
      "</div>" +
      '<span class="logo-text"><span class="code-part">Code</span><span class="grity-part">Grity</span></span>' +
      "</a>" +
      '<ul class="nav-links" id="nav-links">' +
      linksHTML +
      '<li class="nav-cta-mobile"><a href="' +
      root +
      'contact.html">Start a Project</a></li>' +
      "</ul>" +
      '<a href="' +
      root +
      'contact.html" class="cta-button">Start Project</a>' +
      '<button class="nav-toggle" type="button" aria-controls="nav-links" aria-expanded="false" aria-label="Open menu">' +
      '<ion-icon name="menu-outline" aria-hidden="true"></ion-icon>' +
      "</button>" +
      "</nav>";

    var placeholder = document.getElementById("nav-placeholder");
    if (placeholder) {
      placeholder.outerHTML = navHTML;
    }

    var nav = document.getElementById("site-nav");
    if (!nav) return;

    window.addEventListener("scroll", function () {
      nav.classList.toggle("scrolled", window.scrollY > 100);
    });

    var toggle = nav.querySelector(".nav-toggle");
    var icon = toggle.querySelector("ion-icon");
    function setOpen(open) {
      nav.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      icon.setAttribute("name", open ? "close-outline" : "menu-outline");
    }
    toggle.addEventListener("click", function () {
      setOpen(!nav.classList.contains("open"));
    });
    nav.querySelectorAll(".nav-links a").forEach(function (a) {
      a.addEventListener("click", function () {
        setOpen(false);
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
    });
  }

  loadIonicons();
  injectStyles();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildNav);
  } else {
    buildNav();
  }
})();
