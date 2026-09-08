# Spec: Lottery cards grid (LotteryCard.tsx + LotteryGrid.tsx + cards-data.json)

Source capture: draw date 06-09-2026 (Sun). Data file `cards-data.json` holds the exact per-cell markup
(class, attrs, innerHTML) exported from the live DOM; reconstruction was verified byte-equivalent
against the live card-body for all 9 cards.

## Grid arrangement (must match live, verified by geometry)
`<div id="row"><section class="row" data-live="">` with 8 column wrappers
`div.col-12.col-sm-12.col-md-6.col-lg-4.mt-3.px-1` (col widths 350px at ≥1200, cards 342px; col padding 4px px-1):
1. Magnum 4D (table-1)
2. SportsToto 4D (table-6)
3. Da Ma Cai 1+3D (table-4)
4. Magnum Life (table-3) + `<br>` + Magnum Jackpot Gold (table-2)   <- same column, stacked
5. SportsToto 5D/6D/Lotto (table-7)
6. Da Ma Cai 3+3D (table-5)
7. Grand Dragon 4D (table-13)
8. Nine Lotto (table-17)

Rows: line1 = 1,2,3 (y231); line2 = 4+5,6,7 (y831, height 1131 -> other columns stretch to match);
line3 = 8,9 (y1977). The dynamic Advanced-Ads wrappers injected between cards on the live page are
NOT reproduced (they render 0px when ad-blocked; clone matches ad-free content layout exactly).

## Card anatomy (each .card.outer-box)
- `.card.outer-box.table-<id>`, id table-<n>-2026-09-06; border #b4b4b4 1px; radius 5px; shadow 0 0 2px 1px #ddd; width 342.
- `.card-body.p-2` (padding 8px)
- Header row `.row.mx-0.align-items-center.justify-content-center <bgClass> .position-relative`:
  - `.lottery-logo` (width 20%, min-height 38px, text-align center) > <img 50x38/48x38/47x45/32x32>
  - `.lottery-name` (width 80%, font-size 18px, weight 600, line-height 1.3, text-align center)
- Header bg classes: magnum-bg (#ff0 bg / #444 text), sportstoto-bg (#ad0006 / #fff),
  damacai-bg (navy / #fff), granddragon-bg (#e81409 / #fff), `.nine.lotto-bg` (#f28120 / #fff).
- Date row `.row.mx-0.justify-content-between`: `Date: 06-09-2026 (Sun)` and (where present)
  `Draw No: <no>`; `.date` font-size 14px color #333 padding 5px 0. (Grand Dragon has no Draw No.)
- Then result `<table>`s (classes preserved verbatim from data):
  - 1st/2nd/3rd prize rows: title td 45% `.lottery-prize-title.text-center` (bg #333 color #fff 14px 700 min-h 25px),
    number td `.lottery-prize-number.border.text-center` (24px 700). Sportstoto adds zodiac column
    (rowspan 3, img zodiac/goat.png) and uses 30% titles; DaMaCai 3+3D uses 3 cols incl zodiac text + Bonus rows.
  - Special/Consolation grids: title td colspan=5/9 `.lottery-prize-title`, number tds 20%/33.33% `.border.text-center.lottery-number` (22px).
  - Jackpot tables: two `.lottery-prize-title` cols + `.text-center.border.grey.line-height-dense.py-1`
    with `<b>` prize (e.g., "RM 8,350,042.91") + `<span class="blink">Partially Won/Won</span>`.
    .blink: color red 14px bold, animation blinker 1s linear infinite (blinking). Damacai 1+3D adds a 3D Jackpot Prize row.
  - Life card: Winning Numbers (8 tds `.jackpot_number` 18px), Bonus Numbers (2 tds colspan 4), Grand Prize rows (grey).
  - Jackpot Gold card: combination tables with `.lottery-rank.grey`/`.lottery-number` etc. (full markup in data).
  - 5D/6D/Lotto card: 5D grid, 6D grid with "or" cells, Star Toto 6/50 (6 numbers + 1 bonus + 2 jackpot rows),
    Power Toto 6/55 & Supreme Toto 6/58 (6 numbers + jackpot).
- Final table always the "More <Game> Result" row: `<a><div class="anchor">` (bg #3273dc white 1px border, margin 0 -1px).
  Original hrefs target out-of-scope pages -> rendered href "#".

## Data fidelity
Text of every card equals live card innerText (verified char-for-char). Numbers, masked **** / ----,
RM values, zodiacs, and link labels reproduced verbatim. Card rects x/y/w/h equal live at 1440 and 390.

## Responsive
- ≥992px: 3 columns/row (col-lg-4). 768px: 2 per row (col-md-6). <576px: 1 per row (col-12), cards 382px at 390 viewport.
- Grouped columns (Magnum Life + Jackpot Gold) stay together per the original markup at every breakpoint.
