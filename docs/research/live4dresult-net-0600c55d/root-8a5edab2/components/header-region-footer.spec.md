# Spec: Header / Region buttons / Footer (site chrome)

Source: https://live4dresult.net/ (captured 2026-09-07). Page = single WordPress lottery results page.

## Header (component: Header.tsx)
Markup skeleton (reproduced 1:1 with original classes):
`header.sticky-top.navbar-inverse > nav.navbar.navbar-expand-lg.navbar-light.p-lg-0.py-1 > .container > [brand <a>] [.d-flex.align-items-center: refresh toggler + hamburger toggler] [#navbarSupportedContent.collapse.navbar-collapse > .container.px-0 > .menu-top-menu-container > ul#menu-top-menu.navbar-nav]`

Computed styles (1440px viewport):
- header: height 64px; background #f7f7f7; box-shadow 0 0 5px 0 rgba(0,0,0,0.9); border-color #eee; position sticky; z-index 1020.
- nav.navbar: height 64px; display flex; align-items center; padding 0.
- nav container: width 1050px (max-width 1050 at ≥1200 via theme CSS), display flex; justify-content space-between; align-items center.
- Brand: img logo_header.png 40x39 + span "4dresult.co" font-size 12px color #d35842.
- Menu links: font Arial 16px; .current-menu-item font-weight 700; .navbar-nav .nav-link padding 10px 1rem line-height 20px color inherit.
- Mobile (≤991px): .navbar-collapse position absolute; top 65px; left 0; width 100%; background #f7f7f7; border-top 1px #c3c3c3; box-shadow 0 5px 5px rgba(0,0,0,0.3).

## Region buttons (component: RegionButtons.tsx)
`.header-btn-group.container.px-0 > .btn-group.border.w-100` with 4 links:
4D Result / 马来西亚 · Lotto 4D / 柬埔寨 · East 4D / 東馬 · SG / 新加坡 (each "label <br> label2", font-size 12px)
Computed: .header-btn-group position sticky top 65px z-index 1019 (height 52px); .btn background #1633c7 color #fff border-radius 0 font-weight 700 font-size 12px.
Interaction: original anchors navigate to region pages (out of clone scope -> href "#"); first button (home) href "/".
Responsive: ≤370px buttons font-size 11px; on mobile btn-group stays full width (52px tall).

## Footer (component: Footer.tsx)
`footer.footer.mt-auto.bg-dark.text-white > .container > .row.flex-column.py-2 > [.footer-menu.text-center (Disclaimer | Privacy Policy)] [.text-center Copyright © 2018 - 2026 live4dresult.net. All Rights Reserved.]`
Computed: height 55px; font-size 12px (footer), 14px (footer-menu); footer-menu links color #fff. body is .d-flex.flex-column min-height 100vh so footer.mt-auto sticks to bottom.
Interactions: original links point to /disclaimer & /privacy-policy (out of scope -> href "#").

## Fonts & global CSS
- Typography: Arial, Helvetica, sans-serif everywhere (computed body 16px/24px). Google-font <link>s (Roboto 500, Google Sans) exist in source but computed styles resolve to Arial; not self-hosted.
- Icons: Font Awesome 4.7 (refresh icon in header toggler) self-hosted locally.
- Bootstrap 4.6 theme (self-hosted) + theme style.css copied verbatim (see ARTIFACT_MANIFEST).
- Global: html,body min-height 100vh; body flex column; sticky header/button group.
