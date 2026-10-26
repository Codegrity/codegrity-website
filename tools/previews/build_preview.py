"""Builds a one-page homepage preview for a prospect.

Usage: python3 tools/previews/build_preview.py <slug> [<slug> ...]
Reads tools/previews/data/<slug>.json and writes demos/p/<slug>/index.html.
If the JSON names a logo, the file must already be at demos/p/<slug>/<logo>.
Live URL: https://www.codegrity.com/p/<slug>
"""
import html
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, "tools", "previews", "data")
OUT = os.path.join(ROOT, "demos", "p")
CAL = "https://cal.com/codegrity/intro"


def e(s):
    return html.escape(s, quote=True)


def icon(name):
    return f'<ion-icon name="{e(name)}" aria-hidden="true"></ion-icon>'


def initials(name):
    parts = [p for p in name.replace("-", " ").split() if p]
    return (parts[0][0] + (parts[-1][0] if len(parts) > 1 else "")).upper()


def build(slug):
    d = json.load(open(os.path.join(DATA, f"{slug}.json")))
    c = d["colors"]
    if d.get("logo"):
        logo = f'<span class="site-logo"><img src="/demos/p/{e(slug)}/{e(d["logo"])}" alt="{e(d["company"])}" /></span>'
    else:
        logo = f'<span class="site-logo text">{e(d["company"])}</span>'
    nav = "".join(f"<span>{e(n)}</span>" for n in d["nav"])
    pin = ' class="pin pin-inline" data-pin="3"'
    pin3_trust = pin if d.get("pin3") == "trust" else ""
    pin3_partners = pin if d.get("pin3", "partners") == "partners" else ""
    q = d["quote"]
    s = d["stat"]
    cards = "".join(
        f'<div class="card">{icon(cd["icon"])}<h4>{e(cd["name"])}</h4><p>{e(cd["desc"])}</p></div>' for cd in d["cards"]
    )
    partners = "".join(f"<b>{e(p)}</b>" for p in d["partners"])
    fixes = "".join(
        f"""
          <article class="fix">
            <span class="n" aria-hidden="true">{i}</span>
            <h3><span class="sr">Fix {i}: </span>{e(f["title"])}</h3>
            <span class="spacer"></span>
            <div class="col"><h4>On your site today</h4><p>{e(f["now"])}</p></div>
            <div class="col after"><h4>In this preview</h4><p>{e(f["preview"])}</p></div>
          </article>"""
        for i, f in enumerate(d["fixes"], 1)
    )
    page = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{e(d["company"])} homepage preview | Codegrity</title>
    <meta name="description" content="A one-page homepage preview for {e(d["company"])}, made by Codegrity with your logo, your words and three specific fixes." />
    <meta name="robots" content="noindex, nofollow" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400..700&display=swap" />
    <link rel="stylesheet" href="/demos/p/preview.css" />
    <style>:root {{ --brand: {e(c["brand"])}; --brand-ink: {e(c["brand_ink"])}; --brand-soft: {e(c["brand_soft"])}; }} .sr {{ position: absolute; left: -9999px; }}</style>
  </head>
  <body>
    <header class="cg-strip">
      <div class="wrap">
        <a class="cg-brand" href="https://www.codegrity.com/"><img src="/favicon.svg" alt="" width="28" height="28" /><span>Code<span>grity</span></span></a>
        <p>A homepage preview for <b>{e(d["company"])}</b>, with your logo and your own words.</p>
        <a class="jump" href="#fixes">See the 3 fixes</a>
      </div>
    </header>
    <main>
      <section class="intro">
        <div class="wrap">
          <h1>Same company, same words, a homepage that works harder.</h1>
          <p>This is a one-page preview of {e(d["domain"])}. Everything in it comes from your current site. The numbered markers match the three fixes explained below.</p>
        </div>
      </section>
      <div class="wrap">
        <div class="frame" role="img" aria-label="Preview of a redesigned {e(d["company"])} homepage">
          <div class="frame-bar"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="url">{icon("lock-closed")}{e(d["domain"])}</span></div>
          <div class="site" aria-hidden="true">
            <div class="site-nav">{logo}<div class="site-links">{nav}</div><span class="site-btn">{e(d["cta_primary"])}</span></div>
            <div class="site-hero">
              <div>
                <h2 class="pin pin-inline" data-pin="1">{e(d["h1"])}</h2>
                <p class="sub">{e(d["sub"])}</p>
                <div class="site-ctas"><span class="site-btn">{e(d["cta_primary"])}</span><span class="site-btn ghost">{e(d["cta_secondary"])}</span></div>
                <p class="trust">{icon("checkmark-circle")}<span{pin3_trust}>{e(d["trust_line"])}</span></p>
              </div>
              <div class="proof pin" data-pin="2">
                <div class="stat"><b>{e(s["value"])}</b><span>{e(s["label"])}</span><small>{e(s["source"])}</small></div>
                <div class="quote"><p>&ldquo;{e(q["text"])}&rdquo;</p><div class="who"><span class="mono">{e(initials(q["name"]))}</span><div><b>{e(q["name"])}</b><span>{e(q["title"])}, {e(q["company"])}</span></div></div></div>
              </div>
            </div>
            <div class="site-cards"><h3>{e(d["cards_title"])}</h3><div class="cards">{cards}</div></div>
            <div class="site-partners"><span{pin3_partners}>{e(d["partners_label"])}</span>{partners}</div>
          </div>
        </div>
      </div>
      <section class="fixes" id="fixes">
        <div class="wrap">
          <h2>Three fixes, shown above.</h2>
          <p>Each one is small on its own. Together they make the page clearer to a buyer and easier for Google and AI search tools to understand.</p>
          {fixes}
        </div>
      </section>
      <section class="next">
        <div class="wrap">
          <h2>Want the full version?</h2>
          <p>I can turn this into a complete homepage concept and a short written review of your site's search and AI search presence, at no cost and with no obligation.</p>
          <ul>
            <li>{icon("checkmark-circle-outline")}<span>Your logo, colors and content stay. Nothing you'd have to rebrand.</span></li>
            <li>{icon("checkmark-circle-outline")}<span>Prioritized fixes your current team or developer can make.</span></li>
            <li>{icon("checkmark-circle-outline")}<span>A 20-minute call to walk through it, if you'd like one.</span></li>
          </ul>
          <div class="cg-btns">
            <a class="cg-btn primary" href="{CAL}">Book 20 minutes</a>
            <a class="cg-btn line" href="mailto:psojdei@codegrity.com?subject={e(d["company"])}%20homepage%20preview">Reply by email</a>
          </div>
          <p class="sig"><b>PJ Sojdei</b>, Founder, Codegrity. Senior software engineering from McKinney, Texas. (972) 838-7422</p>
        </div>
      </section>
    </main>
    <footer class="foot"><div class="wrap"><span>Preview prepared for {e(d["company"])} by Codegrity LLC. Not affiliated with or endorsed by {e(d["company"])}.</span><a href="https://www.codegrity.com/">codegrity.com</a></div></footer>
    <script type="module" src="https://cdn.jsdelivr.net/npm/ionicons@8.1.0/dist/ionicons/ionicons.esm.js"></script>
  </body>
</html>
"""
    os.makedirs(os.path.join(OUT, slug), exist_ok=True)
    with open(os.path.join(OUT, slug, "index.html"), "w") as f:
        f.write(page)
    print(f"built /p/{slug}")


if __name__ == "__main__":
    for s in sys.argv[1:]:
        build(s)
