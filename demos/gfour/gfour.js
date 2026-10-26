(function () {
  var top = document.querySelector(".top");
  var btn = document.querySelector(".menu-btn");
  if (top && btn) {
    btn.addEventListener("click", function () {
      var open = top.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
  }

  // testimonial tabs
  document.querySelectorAll("[data-tabs]").forEach(function (root) {
    var tabs = root.querySelectorAll('[role="tab"]');
    function select(tab) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
      });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(t); });
      t.addEventListener("keydown", function (e) {
        var n = null;
        if (e.key === "ArrowDown" || e.key === "ArrowRight") n = tabs[(i + 1) % tabs.length];
        if (e.key === "ArrowUp" || e.key === "ArrowLeft") n = tabs[(i - 1 + tabs.length) % tabs.length];
        if (n) { e.preventDefault(); select(n); n.focus(); }
      });
    });
  });

  // story filters
  var filters = document.querySelectorAll("[data-filter]");
  if (filters.length) {
    var stories = document.querySelectorAll(".story");
    var count = document.getElementById("story-count");
    filters.forEach(function (f) {
      f.addEventListener("click", function () {
        var key = f.getAttribute("data-filter");
        filters.forEach(function (o) { o.setAttribute("aria-pressed", o === f ? "true" : "false"); });
        var shown = 0;
        stories.forEach(function (s) {
          var match = key === "all" || s.getAttribute("data-trade") === key;
          s.hidden = !match;
          if (match) shown++;
        });
        if (count) count.textContent = shown + (shown === 1 ? " story" : " stories");
      });
    });
  }

  // concept form: no data leaves the page
  var form = document.querySelector("form[data-concept]");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      form.classList.add("sent");
      var done = form.querySelector(".form-done");
      if (done) done.focus();
    });
  }
})();
