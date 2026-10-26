"""Generates the gFour Marketing website concept pages into demos/gfour/."""
import os, html

OUT = "/home/claude/codegrity-website/demos/gfour"
PHONE = "(305) 856-8788"
TEL = "+13058568788"
ADDR1 = "2100 Ponce de Leon Blvd, Suite 1090"
ADDR2 = "Coral Gables, FL 33134"

NAV = [
    ("services", "/gfour/services", "Marketing Services"),
    ("who", "/gfour/who-we-help", "Who We Help"),
    ("stories", "/gfour/stories", "Customer Stories"),
    ("about", "/gfour/about", "About Us"),
]


def icon(name):
    return f'<ion-icon name="{name}" aria-hidden="true"></ion-icon>'


def page(slug, title, desc, body, active=None):
    nav = "".join(
        f'<a href="{href}"{" aria-current=\"page\"" if key == active else ""}>{label}</a>'
        for key, href, label in NAV
    )
    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{html.escape(title)}</title>
    <meta name="description" content="{html.escape(desc)}" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="theme-color" content="#0d0e0e" />
    <link rel="icon" type="image/png" href="/demos/gfour/img/gfour-logo.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=Caveat:wght@500;600&display=swap" />
    <link rel="stylesheet" href="/demos/gfour/gfour.css" />
    <script>document.documentElement.classList.add("js");</script>
  </head>
  <body>
    <div class="demo-bar">Website concept for gFour Marketing, designed by <a href="https://www.codegrity.com/">Codegrity</a>. Content comes from gfourmarketing.com. <a href="/gfour/report">Read the SEO and presence report</a></div>
    <header class="top">
      <div class="wrap">
        <a class="brand" href="/gfour"><img class="brand-logo" src="/demos/gfour/img/gfour-logo.png" width="104" height="109" alt="gFour Marketing home" /></a>
        <nav class="nav" id="site-nav" aria-label="Main">
          {nav}
          <a class="nav-phone" href="tel:{TEL}">{PHONE}</a>
          <a class="btn btn-ledger" href="/gfour/demo">Book a demo</a>
        </nav>
        <button class="menu-btn" type="button" aria-controls="site-nav" aria-expanded="false" aria-label="Open menu">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>
        </button>
      </div>
    </header>
    <main id="main">
{body}
    </main>
    <footer class="foot">
      <div class="wrap">
        <div class="foot-grid">
          <div>
            <a class="brand" href="/gfour"><img class="brand-logo" src="/demos/gfour/img/gfour-logo.png" width="104" height="109" alt="gFour Marketing home" /></a>
            <p style="margin-top:1rem;max-width:34ch">Your done-for-you relationship marketing team for home improvement and home service companies, since 2009.</p>
            <div class="social">
              <a href="https://www.facebook.com/gFourMarketing/" rel="noopener" aria-label="gFour Marketing on Facebook">{icon("logo-facebook")}</a>
              <a href="https://www.linkedin.com/company/g-four-marketing-group/" rel="noopener" aria-label="gFour Marketing on LinkedIn">{icon("logo-linkedin")}</a>
            </div>
          </div>
          <div>
            <h2>Marketing services</h2>
            <ul>
              <li><a href="/gfour/services#appreciation">Customer appreciation</a></li>
              <li><a href="/gfour/services#reviews">Online reviews</a></li>
              <li><a href="/gfour/services#referrals">Referral rewards</a></li>
              <li><a href="/gfour/services#nurture">Customer nurturing</a></li>
              <li><a href="/gfour/services#program">The 1Into5&trade; program</a></li>
            </ul>
          </div>
          <div>
            <h2>Company</h2>
            <ul>
              <li><a href="/gfour/who-we-help">Who we help</a></li>
              <li><a href="/gfour/stories">Customer stories</a></li>
              <li><a href="/gfour/about">About us</a></li>
              <li><a href="/gfour/about#hiring">Careers</a></li>
              <li><a href="/gfour/services#pricing">Pricing</a></li>
            </ul>
          </div>
          <div>
            <h2>Contact</h2>
            <ul>
              <li><a href="tel:{TEL}">{PHONE}</a></li>
              <li>{ADDR1}<br />{ADDR2}</li>
              <li><a href="/gfour/demo">Book a demo</a></li>
            </ul>
          </div>
        </div>
        <div class="foot-base">
          <span>&copy; 2026 gFour Marketing, LLC. All rights reserved. <a href="https://gfourmarketing.com/privacy-policy/" rel="noopener">Privacy policy</a></span>
          <span>Concept by <a href="https://www.codegrity.com/">Codegrity</a></span>
        </div>
      </div>
    </footer>
    <script type="module" src="https://cdn.jsdelivr.net/npm/ionicons@8.1.0/dist/ionicons/ionicons.esm.js"></script>
    <script src="/demos/gfour/gfour.js" defer></script>
  </body>
</html>
"""


def closer(h="How many leads are you leaving on the table?"):
    return f"""
      <section class="section closer on-dark">
        <div class="wrap">
          <h2>{h}</h2>
          <p>Every happy client is a chance to generate a dozen more. The problem? Raving Fans aren't born; they're created. Book a demo and we'll show you how.</p>
          <div class="ctas">
            <a class="btn btn-gold" href="/gfour/demo">Book a demo</a>
            <a class="btn btn-line" href="tel:{TEL}">{icon("call-outline")} Call {PHONE}</a>
          </div>
        </div>
      </section>"""


GUARANTEE = """
          <div class="guarantee">
            <div class="seal" aria-hidden="true">No-risk<br />guarantee</div>
            <h3>Change your mind before launch? You get 100% of your setup fee back.</h3>
            <p>Get started today, and if at any time until your launch you change your mind, for any reason, we'll cancel your agreement and refund 100% of your setup fee.</p>
            <a class="btn btn-ledger" href="/gfour/demo">Get started</a>
          </div>"""


# ---------------------------------------------------------------- home
TESTIMONIALS = [
    ("roofing", "Roofing", "Customer relationships are like compound interest", "You need a solid appreciation and referral program to stay in constant communication with your customers.", "Matthew Housh", "Arry's Roofing", "MH"),
    ("remodel", "Remodelers", "180% increase in referral net revenue in 12 months", "From 2022 to 2023 we saw a 180% increase in Referral Net Revenue.", "Eric Peschke", "Zintex Remodeling", "EP"),
    ("replace", "Replacement contractors", "All-in-one relationship marketing, done for you", "We had 10 previous customers call in to schedule a second bathroom project.", "Darron Steagall", "Midwest Bath", "DS"),
    ("hvac", "HVAC and plumbing", "Lower your marketing costs and earn higher profits", "We're enjoying higher-revenue jobs at a lower marketing cost!", "Ted Fox", "Fox and Sons", "TF"),
    ("other", "Other home services", "Repeat business costs you less and makes you more", "gFour Marketing does an amazing job keeping my company in front of my clients.", "Tim Melton", "Creative Closets", "TM"),
    ("franchise", "Franchise systems", "Systemize a WOW customer experience across your franchise network", "We integrated the 1Into5 program early in 2022 and have since generated 76 5-star reviews.", "Fargo franchisee", "Window World", "WW"),
    ("mfg", "Manufacturers and distributors", "Made easy for dealer network rollout", "Our network should be jumping in head first with these programs because it takes away any guesswork.", "Mike Zokle", "Four Seasons", "MZ"),
]


def tabs():
    btns, panels = [], []
    for i, (k, label, h, q, name, co, ini) in enumerate(TESTIMONIALS):
        sel = i == 0
        btns.append(f'<button role="tab" id="tab-{k}" aria-controls="panel-{k}" aria-selected="{"true" if sel else "false"}" tabindex="{0 if sel else -1}">{label}</button>')
        panels.append(f"""
            <div class="tabpanel" role="tabpanel" id="panel-{k}" aria-labelledby="tab-{k}"{"" if sel else " hidden"}>
              <div class="stars" aria-label="5 out of 5 stars">{icon("star")*5}</div>
              <h3 style="margin-top:1rem">{h}</h3>
              <blockquote>&ldquo;{q}&rdquo;</blockquote>
              <div class="who"><span class="mono" aria-hidden="true">{ini}</span><div><b>{name}</b><span>{co}</span></div></div>
            </div>""")
    return f"""
          <div class="tabs" data-tabs>
            <div class="tablist" role="tablist" aria-label="Testimonials by trade">{''.join(btns)}</div>
            <div>{''.join(panels)}</div>
          </div>"""


home = f"""
      <section class="hero">
        <div class="wrap hero-grid">
          <div>
            <h1>Unleash the power of your own customers.</h1>
            <p class="lede">Done-for-you relationship marketing for home improvement and home service companies. We turn happy customers into Raving Fans who send referrals, book repeat work and leave 5-star reviews.</p>
            <ul class="hero-trio">
              <li>{icon("heart-outline")} We nurture your champions.</li>
              <li>{icon("ribbon-outline")} They boost your brand reputation.</li>
              <li>{icon("trending-up-outline")} You close more sales, easier.</li>
            </ul>
            <div class="ctas">
              <a class="btn btn-ledger" href="/gfour/demo">Book a demo</a>
              <a class="btn btn-line" href="#how">See how it works</a>
            </div>
            <p class="cta-note">About 4 hours of your time to launch. gFour takes care of the rest.</p>
          </div>
          <div class="desk" role="img" aria-label="The touchpoints gFour sends for you: a monthly newsletter, a cookie gift box, a referral reward check, a thank-you card and a new 5-star review.">
            <div class="piece piece-news" aria-hidden="true">
              <div class="news-mast">Your Company News</div>
              <div class="news-sub">Monthly newsletter for past customers</div>
              <div class="news-photo"></div>
              <div class="news-lines"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
            </div>
            <div class="piece piece-box" aria-hidden="true"><span>Small-batch cookies</span></div>
            <div class="piece piece-check" aria-hidden="true">
              <div class="check-top"><span class="check-co">Your Company</span><span>Referral reward</span></div>
              <div class="check-pay"><span>Pay to the order of</span><span class="hand">Your past customer</span><span class="check-amt">$100.00</span></div>
              <div class="check-foot"><span class="memo">Memo <span class="hand">Thanks for the referral!</span></span><span class="sig"><span class="hand">Your Company</span></span></div>
            </div>
            <div class="piece piece-card" aria-hidden="true">
              <span class="hand">Thank you for choosing us!</span>
              <small>Enjoy the cookies, and tell us how we did.</small>
            </div>
            <div class="piece piece-review" aria-hidden="true">
              <div class="stars">{icon("star")*5}</div>
              <p>New 5-star review</p>
              <div class="news-lines" style="margin-top:.6em"><i style="background:#3a3a3b"></i><i style="background:#3a3a3b;width:80%"></i></div>
            </div>
          </div>
        </div>
      </section>

      <section class="trusted" aria-label="Clients">
        <div class="wrap">
          <p>Trusted by contractors like</p>
          <ul>
            <li>ReBath</li><li>WindowNation</li><li>Window World</li><li>Zintex</li><li>Continental Siding</li><li>Arry's Roofing</li><li>Victory</li><li>Four Seasons</li>
          </ul>
        </div>
      </section>

      <section class="section on-dark">
        <div class="wrap split">
          <div>
            <h2>Built by home improvement people, for home improvement companies.</h2>
            <p class="lede" style="margin-top:1.2rem">gFour started inside home improvement businesses. Since 2009 we have been the secret back-office relationship marketing team for hundreds of contractors.</p>
            <a class="btn btn-gold" href="/gfour/about" style="margin-top:1rem">Meet the team</a>
          </div>
          <dl class="ledger-table">
            <div class="ledger-row"><dt>Homeowners delighted</dt><dd>1,000,000+</dd></div>
            <div class="ledger-row"><dt>Contractors served</dt><dd>200+</dd></div>
            <div class="ledger-row"><dt>Client retention</dt><dd>99%</dd></div>
            <div class="ledger-row"><dt>Relationship marketing since</dt><dd>2009</dd></div>
            <div class="ledger-row"><dt>Your time to launch</dt><dd>~4 hrs</dd></div>
          </dl>
        </div>
      </section>

      <section class="section" id="how">
        <div class="wrap">
          <div class="head">
            <h2>What happens after the final walkthrough.</h2>
            <p class="lede">Most contractors stop talking to customers the day the job is paid. That is where the gFour Formula starts, and every touch is branded to your company.</p>
          </div>
          <ol class="journey">
            <li>
              <span class="dot">{icon("gift-outline")}</span>
              <span class="when">Right after the job</span>
              <h3>Customer appreciation</h3>
              <p>A personalized thank-you card and small-batch cookies arrive by priority 2-day mail.</p>
              <a href="/gfour/services#appreciation">How appreciation works</a>
            </li>
            <li>
              <span class="dot">{icon("star-outline")}</span>
              <span class="when">While the experience is fresh</span>
              <h3>Feedback and reviews</h3>
              <p>Text, email and direct mail ask for feedback and 5-star reviews, with software that makes responding easy.</p>
              <a href="/gfour/services#reviews">How reviews work</a>
            </li>
            <li>
              <span class="dot">{icon("people-outline")}</span>
              <span class="when">When they tell a friend</span>
              <h3>Referral rewards</h3>
              <p>Incentives turn a customer's willingness to recommend you into real referrals, and thank them when they do.</p>
              <a href="/gfour/services#referrals">How referrals work</a>
            </li>
            <li>
              <span class="dot">{icon("mail-open-outline")}</span>
              <span class="when">Every month after</span>
              <h3>Long-term nurture</h3>
              <p>A monthly newsletter, direct mail and keep-in-touch emails keep you first in line for the next project.</p>
              <a href="/gfour/services#nurture">How nurture works</a>
            </li>
          </ol>
        </div>
      </section>

      <section class="section on-dark">
        <div class="wrap program">
          <div>
            <div class="program-name">1Into5<sup>&trade;</sup></div>
          </div>
          <div>
            <h2>One program. Every channel. Run for you.</h2>
            <p class="lede" style="margin-top:1.1rem">The 1Into5&trade; program synchronizes your outreach across every channel your customers use, customized to your goals, from fulfillment to follow-up.</p>
            <ul class="channels">
              <li>{icon("mail-outline")} Email</li>
              <li>{icon("chatbubble-outline")} Text</li>
              <li>{icon("albums-outline")} Direct mail</li>
              <li>{icon("gift-outline")} Gifts</li>
              <li>{icon("newspaper-outline")} Newsletter</li>
            </ul>
            <div class="ctas" style="margin-top:2rem"><a class="btn btn-gold" href="/gfour/demo">Get a free demo</a></div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <div class="head">
            <h2>Real contractors. Real numbers.</h2>
          </div>
          <article class="feature-story">
            <div class="copy">
              <p class="kicker">Window Depot of Northeast Ohio, three years on the program</p>
              <h3 style="font-size:clamp(1.6rem,3vw,2.3rem);font-weight:800">How Rich Begalla's Window Depot closes 70&ndash;80% of referrals</h3>
              <blockquote>&ldquo;I wish I would have done the program sooner, because we've lost opportunity.&rdquo;</blockquote>
              <cite>Rich Begalla, Window Depot of Northeast Ohio</cite>
              <div class="ctas" style="margin-top:1.6rem"><a class="btn btn-line" href="/gfour/stories">Read customer stories</a></div>
            </div>
            <div class="nums">
              <div class="num"><b>983</b><span>jobs closed in 2025, up 24%</span></div>
              <div class="num"><b>70&ndash;80%</b><span>of referral appointments close</span></div>
              <div class="num"><b>24.6x</b><span>program ROI</span></div>
              <div class="num"><b>307 &rarr; 563</b><span>online reviews</span></div>
            </div>
          </article>
        </div>
      </section>

      <section class="section on-sheet">
        <div class="wrap">
          <div class="head">
            <h2>What our Raving Fans are saying.</h2>
            <p class="lede">Pick your trade.</p>
          </div>
          {tabs()}
        </div>
      </section>

      <section class="section">
        <div class="wrap origin">
          <div>
            <h2>We come from home improvement.</h2>
            <p class="lede" style="margin-top:1.2rem">Our founders started their careers running home improvement businesses. We aren't an outside agency that found your industry later. We use the same relationship marketing that made our own companies successful.</p>
            <a href="/gfour/about" class="btn btn-line" style="margin-top:.6rem">Our story</a>
          </div>
          {GUARANTEE}
        </div>
      </section>
{closer()}
"""

# ---------------------------------------------------------------- services
def service(id_, ic, h, lede, stat, ticks, box_h, box):
    t = "".join(f"<li>{icon('checkmark-circle-outline')}<span>{x}</span></li>" for x in ticks)
    b = "".join(f"<li>{icon('checkmark-outline')}<span>{x}</span></li>" for x in box)
    s = f'<div class="stat-pill"><b>{stat[0]}</b><span>{stat[1]}</span></div>' if stat else ""
    return f"""
          <section class="service" id="{id_}">
            <div>
              <div class="service-icon">{icon(ic)}</div>
              <h2>{h}</h2>
              <p class="lede">{lede}</p>
              {s}
            </div>
            <div>
              <ul class="ticks">{t}</ul>
              <div class="box-list aside" style="margin-top:1.4rem"><h4>{box_h}</h4><ul>{b}</ul></div>
            </div>
          </section>"""


services = f"""
      <section class="page-hero">
        <div class="wrap">
          <p class="crumbs"><a href="/gfour">Home</a> / Marketing services</p>
          <h1>A proven relationship marketing system.</h1>
          <p class="lede">4 hours is the time you invest. gFour takes care of the rest: the strategy, the content, the fulfillment and the follow-up.</p>
          <nav class="subnav" aria-label="On this page">
            <a href="#appreciation">Customer appreciation</a><a href="#reviews">Online reviews</a><a href="#referrals">Referral rewards</a><a href="#nurture">Customer nurturing</a><a href="#program">1Into5&trade;</a><a href="#pricing">Pricing</a>
          </nav>
        </div>
      </section>
      <div class="wrap">
        {service("appreciation", "gift-outline", "Customer appreciation", "The most overlooked marketing strategy. Personalized gifts and cards show customers you appreciate them, and turn ordinary customers into Raving Fans.", ("350%", "more reviews when a gift is sent"),
                 ["Increases ROI per customer", "Improves engagement and brand recall", "Sets you apart from competitors", "Improves lead quality"],
                 "Inside every cookie package", ["Customized to your brand", "Personalized for each customer", "Small-batch, all-natural cookies", "A thank-you card with a feedback request", "A plastic bounce-back gift card", "Priority 2-day shipping, so cookies arrive fresh"])}
        {service("reviews", "star-outline", "Reviews and online reputation", "Review campaigns by text, email and direct mail build a steady stream of 5-star reviews, which help you rank higher in local search.", None,
                 ["Rank higher than competitors in local search", "Drive more engaged leads", "Generate more free online leads", "Boost your reputation"],
                 "How we run it", ["Text, email and direct mail review requests", "Review management software for easy responses", "Feedback requests built into every appreciation package"])}
        {service("referrals", "people-outline", "Referral rewards", "Happy customers are willing to recommend you. A referral incentive program gives them a reason to act now, and a way for you to say thank you.", None,
                 ["Generates more referrals and Raving Fans", "Creates urgency for faster results", "Adds value and loyalty", "Strengthens brand advocacy"],
                 "Why it works", ["Rewards customers for the recommendations they already want to make", "Thanks every referrer, which keeps them referring", "Runs automatically, without your team chasing it"])}
        {service("nurture", "mail-open-outline", "Long-term nurture", "Monthly newsletters, direct mail and personalized keep-in-touch emails keep customers up to date on your news, specials and promotions.", None,
                 ["Keeps your brand visible", "Increases repeat business and referrals", "Creates new sales opportunities", "Highlights your promotions"],
                 "Written for you", ["Content created by marketing experts", "Monthly newsletter by mail and email", "Personalized keep-in-touch emails"])}
      </div>

      <section class="section on-dark" id="program">
        <div class="wrap program">
          <div><div class="program-name">1Into5<sup>&trade;</sup></div></div>
          <div>
            <h2>All four, synchronized.</h2>
            <p class="lede" style="margin-top:1.1rem">The 1Into5&trade; program combines email, texting, direct mail, gifts and more into one synchronized outreach plan for reviews, referrals and repeat business, customized to your goals.</p>
            <ul class="channels"><li>{icon("mail-outline")} Email</li><li>{icon("chatbubble-outline")} Text</li><li>{icon("albums-outline")} Direct mail</li><li>{icon("gift-outline")} Gifts</li><li>{icon("newspaper-outline")} Newsletter</li></ul>
          </div>
        </div>
      </section>

      <section class="section" id="pricing">
        <div class="wrap">
          <div class="head">
            <h2>Outsourcing to gFour costs about 1/3 of doing it in-house.</h2>
            <p class="lede">Pricing depends on the programs you choose and your job volume. Here is what you'd otherwise build and run yourself.</p>
          </div>
          <div class="table-wrap">
            <table class="compare">
              <thead><tr><th scope="col"><span class="sr" style="position:absolute;left:-9999px">Area</span></th><th scope="col">Doing it yourself</th><th scope="col" class="us">With gFour</th></tr></thead>
              <tbody>
                <tr><th scope="row">Experts</th><td><span class="no">{icon("close-circle-outline")}</span>Find, hire and manage them</td><td class="us"><span class="yes">{icon("checkmark-circle")}</span>Provided</td></tr>
                <tr><th scope="row">Fulfillment</th><td><span class="no">{icon("close-circle-outline")}</span>Find storage, manage inventory and shipping</td><td class="us"><span class="yes">{icon("checkmark-circle")}</span>Our fulfillment facility and team</td></tr>
                <tr><th scope="row">Process</th><td><span class="no">{icon("close-circle-outline")}</span>You manage every step</td><td class="us"><span class="yes">{icon("checkmark-circle")}</span>Managed like clockwork</td></tr>
                <tr><th scope="row">System</th><td><span class="no">{icon("close-circle-outline")}</span>Build your own from scratch</td><td class="us"><span class="yes">{icon("checkmark-circle")}</span>Proprietary relationship marketing system</td></tr>
              </tbody>
            </table>
          </div>
          <figure class="feature-story" style="margin:2rem 0 0;grid-template-columns:1fr">
            <div class="copy">
              <blockquote style="margin-top:0">&ldquo;We've never written as many referral checks as we have since starting the gFour program.&rdquo;</blockquote>
              <figcaption class="who"><span class="mono" aria-hidden="true">ST</span><div><b>Steve Thompson</b><span>Centurion Exteriors</span></div></figcaption>
            </div>
          </figure>
        </div>
      </section>

      <section class="section on-sheet">
        <div class="wrap">
          <div class="head"><h2>How to get started.</h2><p class="lede">Launch takes 3 to 4 weeks and a few hours of your time.</p></div>
          <ol class="steps">
            <li><h3>Decide</h3><p>Book a demo and see if the program fits your business.</p></li>
            <li><h3>Discovery</h3><p>A 45-minute session about your goals.</p></li>
            <li><h3>Customize</h3><p>We tailor the 1Into5&trade; program to you.</p></li>
            <li><h3>Launch</h3><p>Setup takes 3 to 4 weeks. We run it from there.</p></li>
          </ol>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <div class="head"><h2>Questions contractors ask.</h2></div>
          <div class="faq">
            <details><summary>Is gFour Marketing right for my company?</summary><p>gFour works best for home improvement and home service companies doing more than 100 projects a year that want to scale.</p></details>
            <details><summary>What is included in the 1Into5&trade; program?</summary><p>Email, texting, direct mail, gifts and other channels, synchronized into one outreach plan for reviews, referrals and repeat business, customized to your goals.</p></details>
            <details><summary>How long does it take to get started?</summary><p>Setup takes 3 to 4 weeks and needs a few hours of your time.</p></details>
            <details><summary>How much does it cost?</summary><p>Pricing depends on the programs you choose and your job volume. Book a demo for a personalized quote.</p></details>
            <details><summary>Do you offer a guarantee?</summary><p>Yes. If you change your mind at any time before launch, for any reason, we cancel your agreement and refund 100% of your setup fee.</p></details>
          </div>
        </div>
      </section>
{closer("Ready to see the program for your business?")}
"""

# ---------------------------------------------------------------- who we help
HI = ["Replacement contractors", "Remodelers", "Exterior contractors", "Bath systems", "Roofers", "Basement companies", "Waterproofing contractors", "Home improvement", "Siding contractors", "Closet companies", "Window and door installers", "Concrete and hardscape", "Fence and deck contractors", "Flooring companies", "Solar companies", "Cabinetry companies", "General contractors", "Garage companies"]
HS = ["Home services", "HVAC service", "Plumbers", "Gutter professionals", "Painters", "Landscape companies", "Handyman services", "Pool installers"]


def trades(items):
    return "".join(f"<li><span>{x}</span></li>" for x in items)


who = f"""
      <section class="page-hero">
        <div class="wrap">
          <p class="crumbs"><a href="/gfour">Home</a> / Who we help</p>
          <h1>Contractors of all types build their future with relationship marketing.</h1>
          <p class="lede">Our done-for-you system was built for the home improvement and home services industry, because that is where we come from.</p>
        </div>
      </section>
      <section class="section">
        <div class="wrap">
          <div class="fit">
            <div class="fit-card dark">{icon("hammer-outline")}<h3>Contractors doing 100+ jobs a year</h3><p>The program works best for companies with a growing customer base and a goal to scale.</p></div>
            <div class="fit-card">{icon("git-network-outline")}<h3>Franchise systems</h3><p>Systemize a WOW customer experience across your franchise network.</p></div>
            <div class="fit-card">{icon("business-outline")}<h3>Manufacturers and distributors</h3><p>A program made easy to roll out across your dealer network.</p></div>
          </div>
        </div>
      </section>
      <section class="section on-sheet">
        <div class="wrap">
          <div class="head"><h2>Home improvement trades</h2></div>
          <ul class="trades">{trades(HI)}</ul>
          <div class="head" style="margin-top:4rem"><h2>Home service trades</h2></div>
          <ul class="trades">{trades(HS)}</ul>
        </div>
      </section>
      <section class="section on-dark">
        <div class="wrap split">
          <div><h2>Since 2009, for hundreds of contractors.</h2></div>
          <dl class="ledger-table">
            <div class="ledger-row"><dt>Homeowners delighted</dt><dd>1,000,000+</dd></div>
            <div class="ledger-row"><dt>Contractors served</dt><dd>200+</dd></div>
            <div class="ledger-row"><dt>Client retention</dt><dd>99%</dd></div>
          </dl>
        </div>
      </section>
      <section class="section">
        <div class="wrap">
          <figure class="feature-story" style="margin:0;grid-template-columns:1fr">
            <div class="copy">
              <blockquote style="margin-top:0">&ldquo;Our network should be jumping in head first with these programs because it takes away any guesswork.&rdquo;</blockquote>
              <figcaption class="who"><span class="mono" aria-hidden="true">MZ</span><div><b>Mike Zokle</b><span>Four Seasons</span></div></figcaption>
            </div>
          </figure>
        </div>
      </section>
{closer("Find out what your past customers are worth.")}
"""

# ---------------------------------------------------------------- stories
STORIES = [
    ("replace", "Replacement contractor", "70&ndash;80%", "of referral appointments close", "How Rich Begalla's Window Depot closes 70&ndash;80% of referrals", "983 jobs closed in 2025, up 24% year over year. Reviews grew from 307 to 563 and the program returned 24.6x.", "Window Depot of Northeast Ohio", "https://gfourmarketing.com/case-study/how-rich-begallas-window-depot-closes-70-80-of-referrals/"),
    ("replace", "Replacement contractor", "$1M+", "in repeat and referral business", "More than $1 million in repeat and referral business", "#1 in the Google 3-pack and a 54% repeat customer close rate.", "Centurion Exteriors", "https://gfourmarketing.com/wp-content/uploads/2024/04/CenturionExteriors-2.pdf"),
    ("replace", "Replacement contractor", "290", "new reviews in 10 months", "68 repeat jobs and 290 new reviews", "Owner Jayson Shortt's results in the first 10 months on the program.", "Desert King Windows", "https://gfourmarketing.com/reviews/"),
    ("roofing", "Roofing", "~55%", "close rate", "How a 52-year-old Boston roofer hit a ~55% close rate", "A family-owned roofer in the greater Boston area.", "O'Lyn Roofing", "https://gfourmarketing.com/case-study/how-a-52-year-old-boston-roofer-hit-a-55-close-rate/"),
    ("remodel", "Remodelers", "$500K", "from past customers, starting at zero", "Zero to $500K: the compound behind MODE Renovation's past-customer engine", "From no repeat customers to a past-customer engine.", "MODE Renovation", "https://gfourmarketing.com/case-study/zero-to-500k-the-compound-behind-mode-renovations-past-customer-engine/"),
    ("remodel", "Remodelers", "180%", "increase in referral net revenue", "180% increase in referral net revenue in 12 months", "&ldquo;From 2022 to 2023 we saw a 180% increase in Referral Net Revenue.&rdquo; Eric Peschke", "Zintex Remodeling", None),
    ("replace", "Replacement contractor", "10", "past customers booked a second bathroom", "All-in-one relationship marketing, done for you", "Google and Facebook ratings rose to 4.8 and 4.9. Darron Steagall", "Midwest Bath", None),
    ("franchise", "Franchise systems", "76", "5-star reviews since early 2022", "Systemize a WOW customer experience across your franchise network", "A Fargo franchisee integrated the 1Into5&trade; program early in 2022.", "Window World", None),
    ("services", "HVAC and plumbing", None, None, "Lower your marketing costs and earn higher profits", "&ldquo;We're enjoying higher-revenue jobs at a lower marketing cost!&rdquo; Ted Fox", "Fox and Sons", None),
    ("services", "Other home services", None, None, "Repeat business costs you less and makes you more", "&ldquo;gFour Marketing does an amazing job keeping my company in front of my clients.&rdquo; Tim Melton", "Creative Closets", None),
]


def story_cards():
    out = []
    for k, trade, big, bl, h, p, client, url in STORIES:
        num = f'<div class="big">{big}</div><div class="big-label">{bl}</div>' if big else ""
        link = f'<a href="{url}" rel="noopener">Read {icon("arrow-forward-outline")}</a>' if url else ""
        out.append(f"""
            <article class="story" data-trade="{k}">
              <span class="trade">{trade}</span>
              {num}
              <h3>{h}</h3>
              <p>{p}</p>
              <div class="client"><span>{client}</span>{link}</div>
            </article>""")
    return "".join(out)


stories = f"""
      <section class="page-hero">
        <div class="wrap">
          <p class="crumbs"><a href="/gfour">Home</a> / Customer stories</p>
          <h1>Join the gFour Rockstars.</h1>
          <p class="lede">Contractors who turned their past customers into their best source of new business, in their own numbers.</p>
        </div>
      </section>
      <section class="section">
        <div class="wrap">
          <div class="filters" role="group" aria-label="Filter stories by trade">
            <button data-filter="all" aria-pressed="true">All trades</button>
            <button data-filter="replace" aria-pressed="false">Replacement contractors</button>
            <button data-filter="roofing" aria-pressed="false">Roofing</button>
            <button data-filter="remodel" aria-pressed="false">Remodelers</button>
            <button data-filter="franchise" aria-pressed="false">Franchise systems</button>
            <button data-filter="services" aria-pressed="false">Home services</button>
          </div>
          <p id="story-count" class="cta-note" aria-live="polite" style="margin:-1rem 0 1.4rem">{len(STORIES)} stories</p>
          <div class="stories">{story_cards()}</div>
        </div>
      </section>
{closer("Want numbers like these?")}
"""

# ---------------------------------------------------------------- about
LEADS = [("BK", "Brian Kaskavalciyan", "Co-Founder"), ("AK", "Adi Kaskavalciyan", "Co-Founder"), ("FR", "Felipe Ros", "President"), ("AG", "Adam Guenther-Mendez", "Chief Operating Officer")]
ROLES = [("people-outline", "Relationship managers", "Your day-to-day contact, who runs your program and reports results."),
         ("rocket-outline", "Onboarding", "Sets up your program in 3 to 4 weeks with a few hours of your time."),
         ("newspaper-outline", "Newsletter team", "Writes and produces your monthly customer newsletter."),
         ("cube-outline", "Fulfillment and activations", "Packs and ships gifts, cards and direct mail from our facility."),
         ("code-slash-outline", "Technology", "Runs the systems behind texts, emails and review requests.")]

leads_html = "".join(f'<div class="person"><span class="mono" aria-hidden="true">{i}</span><b>{n}</b><span>{t}</span></div>' for i, n, t in LEADS)
roles_html = "".join(f'<div class="fit-card">{icon(ic)}<h3>{h}</h3><p>{d}</p></div>' for ic, h, d in ROLES)

about = f"""
      <section class="page-hero">
        <div class="wrap">
          <p class="crumbs"><a href="/gfour">Home</a> / About us</p>
          <h1>Say hello to your secret back-office marketing team.</h1>
          <p class="lede">gFour is the relationship marketing team behind hundreds of home improvement and home service companies, nurturing their customers on autopilot since 2009.</p>
        </div>
      </section>
      <section class="section">
        <div class="wrap origin">
          <div>
            <h2>We come from home improvement.</h2>
          </div>
          <div>
            <p class="lede" style="color:var(--ink)">Our founders started their careers in home improvement businesses. We are not an outside agency that discovered the industry later. We are home improvement entrepreneurs, applying the same marketing that made our own businesses successful.</p>
            <p class="lede">Today that marketing runs for our clients: turning existing customers into referrals, repeat sales and 5-star reviews.</p>
          </div>
        </div>
      </section>
      <section class="section on-dark">
        <div class="wrap split">
          <div><h2>The team behind the program.</h2><p class="lede" style="margin-top:1.1rem">Relationship managers, onboarding, fulfillment, newsletters and technology, under one roof.</p></div>
          <dl class="ledger-table">
            <div class="ledger-row"><dt>Founded</dt><dd>2009</dd></div>
            <div class="ledger-row"><dt>Homeowners delighted</dt><dd>1,000,000+</dd></div>
            <div class="ledger-row"><dt>Contractors served</dt><dd>200+</dd></div>
          </dl>
        </div>
      </section>
      <section class="section">
        <div class="wrap">
          <div class="head"><h2>Leadership</h2></div>
          <div class="team-lead">{leads_html}</div>
          <div class="head" style="margin-top:4rem"><h2>Who runs your program</h2><p class="lede">One team handles every part of it, so you don't have to.</p></div>
          <div class="fit fit-5">{roles_html}
          <p class="team-note">{icon("information-circle-outline")}<span>Concept note: the live page would show current team members with photos, kept up to date from one list.</span></p></div>
        </div>
      </section>
      <section class="section on-sheet" id="hiring">
        <div class="wrap origin">
          <div>
            <h2>We're hiring.</h2>
            <p class="lede" style="margin-top:1.1rem">gFour is a fast-growing team. If you love helping contractors grow, we'd like to hear from you.</p>
            <a class="btn btn-ledger" href="/gfour/demo">Get in touch</a>
          </div>
          {GUARANTEE}
        </div>
      </section>
{closer("Uncover the ROI of relationships with gFour.")}
"""

# ---------------------------------------------------------------- demo
demo = f"""
      <section class="page-hero">
        <div class="wrap">
          <p class="crumbs"><a href="/gfour">Home</a> / Book a demo</p>
          <h1>Schedule a demo.</h1>
          <p class="lede">A 45-minute discovery call about your goals and your job volume, and where referrals, reviews and repeat business can grow.</p>
        </div>
      </section>
      <section class="section">
        <div class="wrap book">
          <form class="form" data-concept novalidate>
            <div class="row2">
              <label>First name<input name="first" autocomplete="given-name" required /></label>
              <label>Last name<input name="last" autocomplete="family-name" required /></label>
            </div>
            <label>Company<input name="company" autocomplete="organization" required /></label>
            <div class="row2">
              <label>Your trade
                <select name="trade">
                  <option>Replacement contractor</option><option>Remodeler</option><option>Roofing</option><option>Windows and doors</option><option>Bath systems</option><option>HVAC or plumbing</option><option>Other home improvement</option><option>Other home services</option><option>Franchise system</option><option>Manufacturer or distributor</option>
                </select>
              </label>
              <label>Jobs per year
                <select name="jobs"><option>Under 100</option><option>100 to 250</option><option>250 to 500</option><option>500 to 1,000</option><option>1,000+</option></select>
              </label>
            </div>
            <div class="row2">
              <label>Email<input type="email" name="email" autocomplete="email" required /></label>
              <label>Phone<input type="tel" name="phone" autocomplete="tel" /></label>
            </div>
            <label>What would you like to grow? <span class="hint">Optional</span><textarea name="goals" rows="3"></textarea></label>
            <button class="btn btn-ledger" type="submit">Request my demo</button>
            <p class="form-done" tabindex="-1" role="status">Concept preview: on the live site this sends your request to the gFour team. Nothing was sent from this mockup.</p>
          </form>
          <div class="aside-stack">
            <div class="aside">
              <h3>What happens next</h3>
              <ul>
                <li>{icon("calendar-outline")}<span>We schedule your 45-minute discovery session.</span></li>
                <li>{icon("options-outline")}<span>We tailor the 1Into5&trade; program to your goals.</span></li>
                <li>{icon("rocket-outline")}<span>Setup takes 3 to 4 weeks and a few hours of your time.</span></li>
              </ul>
            </div>
            <div class="aside">
              <h3>Contact information</h3>
              <ul>
                <li>{icon("call-outline")}<span><a href="tel:{TEL}">{PHONE}</a></span></li>
                <li>{icon("location-outline")}<span>{ADDR1}<br />{ADDR2}</span></li>
              </ul>
            </div>
            {GUARANTEE}
          </div>
        </div>
      </section>
      <section class="section on-sheet">
        <div class="wrap">
          <div class="head"><h2>Still have questions?</h2></div>
          <div class="faq">
            <details><summary>Is gFour Marketing right for my company?</summary><p>gFour works best for home improvement and home service companies doing more than 100 projects a year that want to scale.</p></details>
            <details><summary>What is included in the 1Into5&trade; program?</summary><p>Email, texting, direct mail, gifts and other channels, synchronized into one outreach plan for reviews, referrals and repeat business.</p></details>
            <details><summary>How long does it take to get started?</summary><p>Setup takes 3 to 4 weeks and needs a few hours of your time.</p></details>
            <details><summary>How much does it cost?</summary><p>Pricing depends on the programs you choose and your job volume. We'll give you a personalized quote on the demo.</p></details>
          </div>
        </div>
      </section>
"""

PAGES = [
    ("index.html", "gFour Marketing | Done-for-you relationship marketing for contractors", "Done-for-you relationship marketing for home improvement and home service companies: referrals, repeat business and 5-star reviews from your own customers.", home, None),
    ("services.html", "Marketing services | gFour Marketing", "Customer appreciation, online reviews, referral rewards and long-term nurture, run for you through the 1Into5 program.", services, "services"),
    ("who-we-help.html", "Who we help | gFour Marketing", "Relationship marketing for roofers, remodelers, replacement contractors, HVAC, plumbers and more home improvement and home service trades.", who, "who"),
    ("stories.html", "Customer stories | gFour Marketing", "Results from contractors using gFour: referral close rates, repeat business and review growth.", stories, "stories"),
    ("about.html", "About us | gFour Marketing", "gFour is the back-office relationship marketing team for hundreds of home improvement companies, since 2009.", about, "about"),
    ("demo.html", "Book a demo | gFour Marketing", "Schedule a 45-minute discovery call with gFour Marketing.", demo, None),
]

for fn, t, d, b, a in PAGES:
    with open(os.path.join(OUT, fn), "w") as f:
        f.write(page(fn, t, d, b, a))
print("ok")
