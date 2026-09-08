# Spec: App-store banner + SEO description (AppStoreBanner.tsx, SeoSection.tsx)

## App-store banner
Inside `main > .row > .col-sm-12`, before the grid:
`<div style="display:flex; justify-content:center; margin-top:1rem">` containing
two `<a>` (App Store / Google Play, external links preserved, target _blank) with
`<img width="100%" style="max-width:200px">`: logo_appstore.png (800x237), logo_playstore.png (414x122).
Rendered each 200x59px, separated by `<div class="px-1">`. Followed by `<br>`.
Data attributes/computed measured 1020px wide container, images y132 h59 at 1440 viewport.

## SEO description (component: SeoSection.tsx)
`.description.text-center` (1020px wide, margin default) containing exactly 8 blocks captured
verbatim into sections-data.json; each block keeps its inline style & HTML (from the live DOM):
1. h2 14px left: "Live 4D – <em>Latest Live 4D Results<br></em>Magnum 4D, Sports Toto 4D, Damacai 1+3D, ... + Toto."
2. p 11px left: welcome paragraph (3 lines) with link "Past Draw Results"
3. p left (no size): "We provide real-time updates for:"
4. h3 13px left: "Check 4D Result – 4D Toto | Magnum 4D | Damacai 4D"
5. p 11px left: "Latest 4D result is an essential routine..."
6. p 11px left: "Whether you're checking Magnum's latest number..." + link "lotto 4d" (external loto4d.com, kept)
7. h2 14px left: "Cambodia 4D – Live4dresult"
8. p 11px left: "Cambodia 4D, Lotto 4D, ..." + link "Check Here."
Links that target other pages on live4dresult.net are rendered href "#" (out of scope);
external links (loto4d.com) preserved. Container text-align center; block text-align left via inline styles.
