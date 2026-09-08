# ARTIFACT MANIFEST — live4dresult.net homepage clone

Site key:    live4dresult-net-0600c55d
Page key:    root-8a5edab2 (homepage /)
Captured:    2026-09-07 (draw date 06-09-2026)

## Source
https://live4dresult.net/ (WordPress + Bootstrap 4 theme "oldtheme-lottery-frontend", Advanced Ads, Font Awesome 4.7)

## Downloaded originals -> local path (public/sites/live4dresult-net-0600c55d/root-8a5edab2)
CSS (moved to src/app/vendor for bundling; canonical copies):
- wp-content/themes/oldtheme-lottery-frontend/style.css?v=1.27          -> src/app/vendor/theme-style.css
- wp-content/themes/oldtheme-lottery-frontend/assets/css/bootstrap.min.css -> src/app/vendor/bootstrap.min.css
- stackpath.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css -> src/app/vendor/font-awesome.min.css
  (font URL references rewritten to local namespace)

Font Awesome font files (assets/font-awesome/fonts/): fontawesome-webfont.{eot,svg,ttf,woff,woff2}

Images (kept under public/sites/live4dresult-net-0600c55d/root-8a5edab2/wp-content/themes/oldtheme-lottery-frontend/assets/images/):
- logo_header.png (40x39 shown), logo_appstore.png, logo_playstore.png
- lottery logos: logo_magnum.gif, logo_toto.gif, logo_damacai.gif, logo_granddragon.jpg, logo_ninelotto.png
- zodiac/goat.png, zodiac/empty.png

Favicons/icons:
- /icon_48x48.png, /icon_96x96.png, /icon_144x144.png, /icon_192x192.png, /favicon.ico
- wp-content/uploads/sites/3/2026/08/live4dresult-150x150.png, live4dresult-300x300.png

## Extracted artifacts (docs/research/live4dresult-net-0600c55d/root-8a5edab2)
- extraction.json — computed styles/selectors, full text inventory, asset lists
- mobile.json / tablet.json — responsive geometry
- capture/ — raw HTML of main, header, region buttons, footer, SEO area, each card outerHTML
- components/*.spec.md — per-component specs
- screenshots (docs/design-references/.../root-8a5edab2/): desktop-1440-full.png, tablet-768-full.png, mobile-390-full.png

## Build inputs generated from live DOM
- src/components/sites/live4dresult-net-0600c55d/root-8a5edab2/cards-data.json — exact per-card cell markup (verified reconstruct)
- src/components/sites/live4dresult-net-0600c55d/root-8a5edab2/sections-data.json — chrome sections + SEO blocks

## Known gaps / decisions
- Real-time "live" updates, AJAX loader modal, Google AdSense/prebid/Advanced-Ads placements, sticky #foxads ad,
  and Facebook SDK are not reproduced (out of scope: static clone). Ad slots collapse to zero height.
- Navigation links to other pages of the site (region pages, past results, disclaimer, per-game "More" pages)
  are inert (href "#"); brand link returns to "/".
- Blinking jackpot status text (`.blink`) animates on the live site; both render identically but out of phase
  between screenshots (expected).
- Google-font <link>s are ignored: computed typography resolves to Arial on both live and clone.
- Data is a snapshot of the 06-09-2026 draws (mock/static per clone scope).

## 2026-09-07 addendum: functional navigation routes
Additional pages cloned (static snapshots of the same draw date, same theme):
- /sabah-sarawak-4d-results (Sandakan 4D, Special CashSweep, Sabah 88 4D) - exact geometry match
- /singapore-4d-results (Singapore 4D, Singapore Toto) - exact geometry match
- /cambodia-4d-results (Grand Dragon, Perdana, Nine Lotto, Lucky HariHari)
- /lotto-4d (Grand Dragon, Perdana, Nine Lotto, Lucky HariHari)
- /past-results (11 games, Malaysia & Singapore view; Cambodia toggle navigates to /cambodia-4d-results)

Snapshot source: docs/research/live4dresult-net-0600c55d/<page>/capture.json + toolbar.html
Rendered from: src/components/sites/live4dresult-net-0600c55d/root-8a5edab2/snapshots/*.content.json
New assets downloaded: logo_perdana.jpg, logo_harihari.jpg, logo_stc4d.gif, logo_cashsweep.gif,
logo_sabah88.gif, icon/calendar.png
Navigation: Header (Results by Regions dropdown, Past Results) and RegionButtons now link to these routes.
Cambodia/Lotto/Past total heights can vary a few tens of px vs live due to ad-slot placeholder scaffolding.

## 2026-09-07 addendum 2: functional Past Results date browser
- /past-results now renders the latest captured draw (2026-09-06) and /past-results/YYYY-MM-DD serves real
  captured data for 11 dates (2026-08-27 ... 2026-09-06): full Malaysia & Singapore draws (10-11 cards) on
  draw days and Cambodia draws (3 cards: Grand Dragon, Perdana, Lucky HariHari) on Cambodia-only days.
- Toolbar (PastToolbar.tsx): Prev/Next step through the captured dates (alert at the ends, like the original);
  calendar button opens a date list; country toggle reflects the view shown for each date (Malaysia & Singapore
  vs Cambodia). Switching to a view not captured for a date shows a clear notice instead of dead UI.
- Implementation: pages at src/app/past-results/page.tsx + src/app/past-results/[date]/page.tsx (SSG via
  generateStaticParams), data in src/components/sites/live4dresult-net-0600c55d/root-8a5edab2/past-dates.json.
- New assets: zodiac ox/rabbit/rat/rooster png. Empty.png onerror fallback paths rewritten to the local namespace.
- Verified: all 11 date routes return content with 0 broken images and 0 failed requests.

## 2026-09-07 addendum 3: Lotto 4D now shows BOTH daily draws
Perdana 4D and Lucky HariHari each have TWO draws per day. The /lotto-4d page now shows both:
- Perdana Lottery 4D (15:30) and Perdana Lottery 4D (19:30)
- Lucky HariHari (3:30PM, draw no. 4327) and Lucky HariHari (7:30PM, draw no. 4328)
Data for 2026-09-06 taken from the official sources: https://www.perdana4d.com/Results/4D
and https://hari4d.com/draw-result.php?lang=en
Cards: src/components/sites/live4dresult-net-0600c55d/root-8a5edab2/lotto-data.json
Page: src/app/lotto-4d/page.tsx + Lotto4DPage.tsx (Grand Dragon + Nine Lotto unchanged).

## 2026-09-07 addendum 4: equalized Lotto 4D cards
Bug: generated Perdana/HariHari cards carried class "table" (exact) which triggered Bootstrap's `.table td`
padding (12px) - rows/cards rendered ~1.6x taller and cells looked different from Grand Dragon/Nine Lotto.
Fixed: card class now matches the site convention ("card outer-box table-16" / "table-15").
Result: all six Lotto 4D cards are equal size (342px wide; 486/486/486/486/488/488 tall), aligned in 2 rows,
same fonts/classes as the original cards. Page height 1986px.

## 2026-09-07 addendum 5: Cambodia region results == Lotto 4D results
/cambodia-4d-results (Results by Regions > Cambodia 4D Results) now uses the SAME multi-draw grid as
/lotto-4d via shared component src/components/sites/live4dresult-net-0600c55d/root-8a5edab2/MultiDrawResults.tsx
(Grand Dragon, Perdana 15:30 & 19:30, Nine Lotto, Lucky HariHari 3:30PM & 7:30PM), each page keeps its own
SEO description. Verified: both routes render 6 equal cards, 0 broken images.

## 2026-09-07 addendum 6: LIVE results (auto-refresh)
- New server proxy: src/app/api/live/route.ts (allowlisted hosts: live4dresult.net, perdana4d.com,
  hari4d.com, api.hari4d.com) fetches the original sources server-side (avoids browser CORS).
- Client LiveResults.tsx on /, /sabah-sarawak-4d-results, /singapore-4d-results, /lotto-4d and
  /cambodia-4d-results refreshes draw numbers every 60s + once on load, in place (green LIVE pill bottom-right,
  green flash on changed cards):
  - live4dresult.net pages: cells synced by data-id (Magnum, SportsToto, DaMaCai, East/SG games, GD, Nine)
  - Perdana 4D: both draws from perdana4d.com
  - Lucky HariHari: both draws from api.hari4d.com JSON
  - A slot whose draw is not available yet keeps the last real numbers (dashes never overwrite).
Verified: today's Perdana 15:30 (8310/0337/0829) and HariHari 3:30PM (6790/0744/7713) updated with dates/draw
numbers; un-drawn slots (19:30 / 7:30PM today) keep the previous draw. Past Results pages stay historical/static.

## Official result site references (provided by user, 2026-09-07)
- Magnum 4D: https://www.magnum4d.my/results/draw-results (API: /results/past/between-dates/...)
- DaMaCai: https://www.damacai.com.my/past-draw-result/ (API: /callpassresult?pastdate=YYYYMMDD)
- SportsToto: https://www.sportstoto.com.my/ (blocks automated access, HTTP 403)
- Singapore 4D: https://www.singaporepools.com.sg/en/product/pages/4d_results.aspx
  (static HTML data files: DataFileArchive/Lottery/Output/fourd_result_*_en.html)
- Sandakan (STC 4D): https://stc4d.com/results (static draw archive, results per draw)
- Special Cash Sweep: https://www.cashsweep.my/results (API: /api/results/draws-rendered)
- Sabah 88: https://www.diriwan88.com/App88/Result/Result.asp?...&DrawDate=YYYYMMDD (server HTML)
- Grand Dragon: https://gdlotto.net/live.aspx (unreachable from this environment: connection timeout)
- Nine Lotto: https://9lotto.com/result (server-rendered numbers)
- Perdana 4D: https://www.perdana4d.com/ (live adapter already active)
- Lucky HariHari: https://hari4d.com/draw-result.php?lang=en (live via api.hari4d.com already active)
Current live integration uses live4dresult.net + official Perdana/HariHari. All above hosts are allow-listed in
src/app/api/live/route.ts ready for per-game official adapters.
