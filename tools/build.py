#!/usr/bin/env python3
"""Codegrity site build: injects the shared SEO head, schema, header and footer
into every page, and regenerates sitemap.xml.

The site stays plain static HTML. This script only rewrites the regions between
marker comments, so it is safe to run repeatedly:

    python3 tools/build.py

Page metadata lives in tools/pages.json. Run this after adding or renaming a page.
"""
import html
import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG = json.loads((ROOT / "tools" / "pages.json").read_text(encoding="utf-8"))
SITE = CONFIG["site"]
ORIGIN = SITE["origin"]
ORG_ID = ORIGIN + "/#org"


def esc(s):
    return html.escape(s, quote=True)


def region(name, body, indent="    "):
    return f"{indent}<!-- {name}:start -->\n{body}\n{indent}<!-- {name}:end -->"


def replace_region(text, name, new_block):
    pat = re.compile(r"[ \t]*<!-- " + name + r":start -->.*?<!-- " + name + r":end -->", re.S)
    if pat.search(text):
        return pat.sub(lambda m: new_block, text, count=1), True
    return text, False


# ---------------------------------------------------------------- head
def seo_block(cfg):
    title = cfg["title"]
    desc = cfg["description"]
    lines = [f"    <title>{esc(title)}</title>", f'    <meta name="description" content="{esc(desc)}" />']
    if cfg.get("noindex"):
        lines.append('    <meta name="robots" content="noindex, follow" />')
    else:
        url = ORIGIN + cfg["path"]
        image = ORIGIN + cfg.get("image", SITE["defaultImage"])
        alt = cfg.get("imageAlt", f"{SITE['name']}: senior software engineers in McKinney, Texas")
        lines += [
            '    <meta name="robots" content="index, follow, max-image-preview:large" />',
            f'    <link rel="canonical" href="{esc(url)}" />',
            f'    <meta property="og:type" content="{"article" if cfg.get("type") == "article" else "website"}" />',
            f'    <meta property="og:site_name" content="{esc(SITE["name"])}" />',
            f'    <meta property="og:title" content="{esc(cfg.get("ogTitle", title))}" />',
            f'    <meta property="og:description" content="{esc(desc)}" />',
            f'    <meta property="og:url" content="{esc(url)}" />',
            f'    <meta property="og:image" content="{esc(image)}" />',
            '    <meta property="og:image:width" content="1200" />',
            '    <meta property="og:image:height" content="630" />',
            f'    <meta property="og:image:alt" content="{esc(alt)}" />',
            '    <meta property="og:locale" content="en_US" />',
            '    <meta name="twitter:card" content="summary_large_image" />',
            f'    <meta name="twitter:title" content="{esc(cfg.get("ogTitle", title))}" />',
            f'    <meta name="twitter:description" content="{esc(desc)}" />',
            f'    <meta name="twitter:image" content="{esc(image)}" />',
        ]
    lines += [
        '    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />',
        '    <link rel="apple-touch-icon" href="/images/apple-touch-icon.png" />',
        '    <meta name="theme-color" content="#0a0a0a" />',
    ]
    return region("seo", "\n".join(lines))


def schema_block(cfg):
    graph = [
        {
            "@type": ["Organization", "ProfessionalService"],
            "@id": ORG_ID,
            "name": SITE["name"],
            "legalName": SITE["legalName"],
            "url": ORIGIN + "/",
            "logo": ORIGIN + "/images/codegrity-logo-512.png",
            "image": ORIGIN + SITE["defaultImage"],
            "description": CONFIG["footer"]["about"],
            "telephone": SITE["phone"],
            "email": SITE["email"],
            "foundingDate": "2023",
            "founder": {"@id": ORIGIN + "/about#pj-sojdei"},
            "address": {
                "@type": "PostalAddress",
                "addressLocality": "McKinney",
                "addressRegion": "TX",
                "addressCountry": "US",
            },
            "areaServed": [
                {"@type": "City", "name": "McKinney, TX"},
                {"@type": "City", "name": "Dallas, TX"},
                {"@type": "Country", "name": "United States"},
            ],
            "priceRange": "$$",
        },
        {
            "@type": "Person",
            "@id": ORIGIN + "/about#pj-sojdei",
            "name": "PJ Sojdei",
            "jobTitle": "Founder",
            "worksFor": {"@id": ORG_ID},
            "url": ORIGIN + "/about",
            "sameAs": ["https://www.linkedin.com/in/pj-sojdei/"],
        },
        {
            "@type": "WebSite",
            "@id": ORIGIN + "/#website",
            "url": ORIGIN + "/",
            "name": SITE["name"],
            "publisher": {"@id": ORG_ID},
            "inLanguage": "en-US",
        },
    ]
    if SITE.get("sameAs"):
        graph[0]["sameAs"] = SITE["sameAs"]
    if SITE.get("googleBusinessProfile"):
        graph[0]["hasMap"] = SITE["googleBusinessProfile"]
    if cfg.get("path") and cfg.get("crumb"):
        items = [{"@type": "ListItem", "position": 1, "name": "Home", "item": ORIGIN + "/"}]
        parent = cfg.get("parentCrumb")
        if parent:
            items.append({"@type": "ListItem", "position": 2, "name": parent["name"], "item": ORIGIN + parent["path"]})
        items.append({"@type": "ListItem", "position": len(items) + 1, "name": cfg["crumb"], "item": ORIGIN + cfg["path"]})
        graph.append({"@type": "BreadcrumbList", "@id": ORIGIN + cfg["path"] + "#breadcrumb", "itemListElement": items})
    data = json.dumps({"@context": "https://schema.org", "@graph": graph}, indent=2)
    data = "\n".join("      " + l for l in data.splitlines())
    return region("schema", f'    <script type="application/ld+json">\n{data}\n    </script>')


# ---------------------------------------------------------------- header / footer
def is_current(href, cfg):
    path = cfg.get("path") or ""
    if href == "/":
        return path == "/"
    return path == href or path.startswith(href + "/")


def header_block(cfg):
    items = []
    for item in CONFIG["nav"]:
        cur = ' aria-current="page"' if is_current(item["href"], cfg) else ""
        items.append(f'          <li><a href="{item["href"]}"{cur}>{esc(item["label"])}</a></li>')
    cta = CONFIG["cta"]
    items.append(
        f'          <li class="cg-menu-cta"><a href="{cta["href"]}" data-cta="nav-mobile">{esc(cta["label"])}</a></li>'
    )
    body = f"""    <a class="cg-skip" href="#main">Skip to content</a>
    <header class="cg-header">
      <nav class="cg-nav" aria-label="Main">
        <a href="/" class="cg-brand" aria-label="Codegrity home">
          <span class="cg-mark" aria-hidden="true"></span>
          <span class="cg-wordmark">Code<span>grity</span></span>
        </a>
        <ul class="cg-menu" id="cg-menu">
{chr(10).join(items)}
        </ul>
        <a href="{cta["href"]}" class="cg-cta" data-cta="nav">{esc(cta["label"])}</a>
        <button class="cg-toggle" type="button" aria-controls="cg-menu" aria-expanded="false" aria-label="Open menu">
          <svg class="cg-i-menu" viewBox="0 0 512 512" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M80 160h352M80 256h352M80 352h352"/></svg>
          <svg class="cg-i-close" viewBox="0 0 512 512" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M368 368L144 144M368 144L144 368"/></svg>
        </button>
      </nav>
    </header>"""
    return region("header", body)


def footer_block():
    f = CONFIG["footer"]
    cols = []
    for col in f["columns"]:
        links = "\n".join(f'            <li><a href="{l["href"]}">{esc(l["label"])}</a></li>' for l in col["links"])
        cols.append(
            f"""        <div>
          <h2>{esc(col["title"])}</h2>
          <ul>
{links}
          </ul>
        </div>"""
        )
    linkedin = f'\n            <li><a href="{SITE["linkedin"]}" rel="noopener">LinkedIn</a></li>' if SITE.get("linkedin") else ""
    body = f"""    <footer class="cg-footer">
      <div class="cg-footer-grid">
        <div class="cg-footer-about">
          <a href="/" class="cg-brand" aria-label="Codegrity home">
            <span class="cg-mark" aria-hidden="true"></span>
            <span class="cg-wordmark">Code<span>grity</span></span>
          </a>
          <p>{esc(f["about"])}</p>
        </div>
{chr(10).join(cols)}
        <div>
          <h2>Contact</h2>
          <ul>
            <li><a href="mailto:{SITE["email"]}">{SITE["email"]}</a></li>
            <li><a href="tel:{SITE["phone"].replace("-", "")}">{SITE["phoneDisplay"]}</a></li>
            <li>McKinney, Texas</li>{linkedin}
          </ul>
        </div>
      </div>
      <div class="cg-footer-base">
        <span>&copy; {date.today().year} {esc(SITE["legalName"])}. McKinney, Texas.</span>
        <span>Serving McKinney, Dallas-Fort Worth and clients nationwide.</span>
      </div>
    </footer>"""
    return region("footer", body)


# ---------------------------------------------------------------- legacy cleanup (idempotent)
LINK_MAP = {
    "index.html": "/",
    "services.html": "/services",
    "local.html": "/local",
    "work.html": "/work",
    "about.html": "/about",
    "contact.html": "/contact",
    "blog/index.html": "/blog",
}


def fix_links(text, rel):
    def sub(m):
        attr, val = m.group(1), m.group(2)
        if re.match(r"^(https?:|mailto:|tel:|#|/|data:)", val):
            return m.group(0)
        frag = ""
        if "#" in val:
            val, frag = val.split("#", 1)
            frag = "#" + frag
        base = Path(rel).parent
        resolved = (base / val).as_posix()
        parts = []
        for p in resolved.split("/"):
            if p == "..":
                if parts:
                    parts.pop()
            elif p and p != ".":
                parts.append(p)
        resolved = "/".join(parts)
        if resolved in LINK_MAP:
            new = LINK_MAP[resolved]
        elif resolved.endswith(".html"):
            new = "/" + resolved[:-5]
            if new.endswith("/index"):
                new = new[: -len("/index")] or "/"
        else:
            new = "/" + resolved
        return f'{attr}="{new}{frag}"'

    return re.sub(r'\b(href|src)="([^"]*)"', sub, text)


def legacy_cleanup(text):
    # Custom cursor, scroll % indicator and the old JS nav placeholder
    text = re.sub(r'\s*<div class="cursor(?:-follower)?"></div>', "", text)
    text = re.sub(r'\s*<div class="scroll-indicator">0%</div>', "", text)
    text = re.sub(r'\s*<div class="scroll-progress"></div>', "", text)
    text = re.sub(r'\s*<div id="nav-placeholder"></div>', "", text)
    text = re.sub(r'\s*<!-- Navigation removed: now loaded via /js/nav.js -->', "", text)
    text = re.sub(r'\s*<script src="[^"]*(?:nav|main)\.js"(?: defer)?></script>', "", text)
    # Inline scripts that only drove the cursor / scroll indicator / nav effects
    text = re.sub(r"\s*<script>\s*// Custom Cursor.*?</script>", "", text, flags=re.S)
    text = re.sub(r"\n\s*cursor: none !important;", "", text)
    # Old per-page ProfessionalService schema (now sitewide)
    def drop_org(m):
        return "" if '"@type": "ProfessionalService"' in m.group(0) and "makesOffer" not in m.group(0) else m.group(0)

    text = re.sub(r'\s*(?:<!-- Schema Markup for SEO -->\s*)?<script type="application/ld\+json">.*?</script>', drop_org, text, flags=re.S)
    # Old head tags now generated in the seo region
    if "<!-- seo:start -->" not in text:
        text = re.sub(r"\s*<title>.*?</title>", "", text, count=1, flags=re.S)
        text = re.sub(r'\s*<meta\s+name="description"\s+content="[^"]*"\s*/>', "", text, count=1, flags=re.S)
        text = re.sub(r'\s*<link rel="canonical"[^>]*/>', "", text)
        text = re.sub(r'\s*<meta property="og:[^"]*"[^>]*/>', "", text)
        text = re.sub(r'\s*<meta name="twitter:[^"]*"[^>]*/>', "", text)
        text = re.sub(r'\s*<link rel="icon"[^>]*/>', "", text)
    return text


def ensure_assets(text):
    if "/css/chrome.css" not in text:
        text = re.sub(r"[ \t]*</head>", '    <link rel="stylesheet" href="/css/chrome.css" />\n  </head>', text, count=1)
    if "/js/site.js" not in text:
        text = re.sub(r"[ \t]*</body>", '    <script src="/js/site.js" defer></script>\n  </body>', text, count=1)
    return text


def ensure_main_landmark(text):
    if 'id="main"' in text:
        return text
    # Wrap content between header and footer in <main id="main">
    text = text.replace("<!-- header:end -->", '<!-- header:end -->\n    <main id="main">', 1)
    text = re.sub(r"[ \t]*<!-- footer:start -->", "    </main>\n    <!-- footer:start -->", text, count=1)
    return text


def build_page(rel, cfg):
    path = ROOT / rel
    text = path.read_text(encoding="utf-8")
    text = legacy_cleanup(text)
    text = fix_links(text, rel)
    text = text.replace("CodeGrity", "Codegrity")

    # head
    text, ok = replace_region(text, "seo", seo_block(cfg))
    if not ok:
        text = re.sub(r'(<meta name="viewport"[^>]*/>)', lambda m: m.group(1) + "\n" + seo_block(cfg), text, count=1)
    text, ok = replace_region(text, "schema", schema_block(cfg))
    if not ok:
        text = re.sub(r"[ \t]*</head>", lambda m: schema_block(cfg) + "\n  </head>", text, count=1)

    # header
    text, ok = replace_region(text, "header", header_block(cfg))
    if not ok:
        text = re.sub(r"(<body[^>]*>)", lambda m: m.group(1) + "\n" + header_block(cfg), text, count=1)

    # footer
    text, ok = replace_region(text, "footer", footer_block())
    if not ok:
        text, n = re.subn(r"[ \t]*<footer\b.*?</footer>", lambda m: footer_block(), text, count=1, flags=re.S)
        if not n:
            text = text.replace("</body>", footer_block() + "\n  </body>", 1)

    text = ensure_main_landmark(text)
    text = ensure_assets(text)
    path.write_text(text, encoding="utf-8")


def git_date(f):
    """Last commit date for a file; today if it has uncommitted changes or no history."""
    import subprocess

    rel = f.relative_to(ROOT).as_posix()
    dirty = subprocess.run(["git", "status", "--porcelain", "--", rel], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    if dirty:
        return date.today().isoformat()
    out = subprocess.run(["git", "log", "-1", "--format=%cs", "--", rel], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    return out or date.today().isoformat()


def build_sitemap():
    urls = []
    for rel, cfg in CONFIG["pages"].items():
        if not cfg.get("path") or cfg.get("noindex"):
            continue
        f = ROOT / rel
        lastmod = cfg.get("lastmod") or git_date(f)
        prio = "1.0" if cfg["path"] == "/" else cfg.get("priority", "0.8")
        urls.append(
            f"  <url>\n    <loc>{ORIGIN}{cfg['path']}</loc>\n    <lastmod>{lastmod}</lastmod>\n    <priority>{prio}</priority>\n  </url>"
        )
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(urls) + "\n</urlset>\n"
    (ROOT / "sitemap.xml").write_text(xml, encoding="utf-8")


def main():
    missing = [rel for rel in CONFIG["pages"] if not (ROOT / rel).exists()]
    if missing:
        sys.exit("Missing pages listed in tools/pages.json: " + ", ".join(missing))
    on_disk = {p.relative_to(ROOT).as_posix() for p in ROOT.rglob("*.html") if "tools" not in p.parts and "node_modules" not in p.parts and "demos" not in p.parts}
    unlisted = sorted(on_disk - set(CONFIG["pages"]))
    if unlisted:
        sys.exit("Pages not listed in tools/pages.json: " + ", ".join(unlisted))
    for rel, cfg in CONFIG["pages"].items():
        build_page(rel, cfg)
    build_sitemap()
    print(f"Built {len(CONFIG['pages'])} pages and sitemap.xml")


if __name__ == "__main__":
    main()
