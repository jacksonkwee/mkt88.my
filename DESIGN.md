---
name: MKT88 4D Results
description: Live 4D results for eleven games, read on a phone in seconds.
colors:
  brand-red: "#cc0000"
  link-blue: "#0069d9"
  focus-ring: "#cc0000"
  ink: "#212529"
  surface: "#ffffff"
typography:
  number:
    fontFamily: 'inherit'
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.2
    fontFeature: '"tnum" 1'
  title:
    fontFamily: 'inherit'
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.2
  label:
    fontFamily: 'inherit'
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.2
rounded:
  sm: "4px"
  md: "12px"
components:
  button-app:
    backgroundColor: "{colors.brand-red}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "44px"
  card-result:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0.5rem"
---

<!--
  This file records the system that is live TODAY. It is written as a
  pre-redesign baseline: the owner has asked for the visual world to be
  replaced (see plans/001, direction J), and the anatomy below - the cell
  order, the tabular figures, the 44px targets - is what the replacement must
  preserve, not the colours.
-->

# Design System: MKT88 4D Results

## Overview

**Creative North Star: "The Operators' Boards"**

The interface is a set of scoreboards, not a poster. Every screen is built so a
player who already knows where a prize row sits can read it without reading
anything else: numbers are the largest thing on the card, they sit in equal-width
figures so a column lines up, and the labels beside them are small, quiet and
optional. Density is high on purpose - eleven boards can share one phone screen -
and the visual budget goes to the figures, not to the frame around them.

The incumbent look is inherited from the aggregator this site replaced, which is
why the shell is generic: red header, white cards, thin grey borders. That is
also the anchor the owner has asked to cut (plans/001). What is *not* generic, and
what any replacement must keep, is the card anatomy and the numeric discipline
described below.

**Key Characteristics:**
- Numbers first: the figure is the largest element in every card, label text is 12px.
- Equal-width figures everywhere, so digits stack in columns across the whole site.
- Fixed cell positions per game; a player learns them and they never move.
- Empty is a state, not a gap: `----` renders in the same cell, same size.
- Phone-first: 44px minimum targets, 390px is the design width.
- Three languages in the same layouts; no language gets a different structure.

## Colors

Almost monochrome: white surfaces, near-black text, and one red that is spent on
the brand bar and primary actions. The only other hue is a deliberately deepened
link blue.

### Primary
- **Brand Red** (#cc0000): the app's top bar, the active menu underline, primary
  buttons, and the jackpot status text. Its source of truth is the admin's
  "primary colour" setting, written onto `<html>` by `SiteCustomizer`; `--brand`
  in `globals.css` is only the fallback, so a replacement palette must keep
  consuming `var(--primary, var(--brand))` rather than hard-coding a new red.

### Neutral
- **Surface** (#ffffff): card and page background. The incumbent system is flat
  white; the page behind the cards is the same white with hairline borders doing
  the separating.
- **Ink** (#212529): body and number text (Bootstrap's default, inherited).
- **Link Blue** (#0069d9): every default link. Deliberately one shade deeper than
  Bootstrap's #007bff, which measured 3.98:1 on white; #0069d9 measures 5.2:1 and
  4.7:1 on the striped table row.

### Named Rules
**The One Red Rule.** Red is the brand and the primary action, never decoration.
It does not tint cards, headings or table rows; a screen with red in more than
two places is over-budget.

**The Contrast Rule.** Nothing carries meaning below 4.5:1 on its own
background. Two known values were raised to get there (#0069d9 for links, #666
for hint text); a replacement palette must be measured, not eyeballed.

## Typography

**Display Font:** the system UI stack (`-apple-system, BlinkMacSystemFont,
"Segoe UI", Roboto, "Noto Sans", "PingFang SC", "Microsoft YaHei", "Helvetica
Neue", Arial, sans-serif`)
**Body Font:** the same stack.
**Label Font:** the same stack.

**Character:** one stack, no webfont. It was chosen because it renders the Latin
labels *and* the Chinese game names natively on Android and iOS, and because it
keeps the app free of a font download. A replacement may change the stack, but
must keep native CJK rendering and must not add a blocking webfont.

### Hierarchy
- **Number** (700, 17px on a phone / 28–30px on the enlarged East Malaysia web
  cards, line-height 1.2, tabular figures): the prize figures and every drawn
  number. `white-space: nowrap` - a 4-digit number never splits.
- **Title** (700, 15px): the game name on a card.
- **Body** (400, 15px): menu items, footer, table text.
- **Label** (600, 12px): "1st Prize", "Date", "Draw No", the Special /
  Consolation headings. Small on purpose: they are reference, not content.

### Where the pages actually stand (measured 16 Oct 2026)

The four roles above were the intent; the pages had drifted to eleven sizes - 12,
13, 14, 15, 16, 17, 18, 20, 22, 28 and 30px - and a reader could not tell which
of two sizes was the deliberate one.

Brought back onto the scale: the live status strip (13 to 12), the jackpot status
"Partially Won" (14 to 12), the past-result title and its "Latest" button (14 and
16 to 15), the information block's copy and links (14 to 15), the footer menu (14
to 15), the jackpot digit cells (18 to 17), the prize prose (16 to 15), the
jackpot figure (16 to 17), the Singapore title band (16 to 15) and the app's top
bar (18 to 17, its link 13 to 12) and empty state (16 to 15). The page heading
kept its 20px but took the title weight: 500 appeared nowhere else in the product.

Measured on eight public pages at 390px, before and after: the home page and
/result/magnum read 12, 15, 17, 20 and 22 now, /lotto-4d reads 12, 15, 17 and 22,
and no page scrolls sideways.

Two number sizes beyond the default 17 are deliberate and named here so they are
not "corrected" later:

- **22px on the six-digit boards** (`--mkt-cambodia-number`): Grand Dragon 6D,
  Nine Lotto 6D and the Cambodia boards hold six digits in a cell, and the same
  variable sizes those boards so a row stays on one line.
- **28px / 30px on the East Malaysia single pages, web only** (`body:not(.mkt-in-app)`):
  the owner asked for larger figures there so the column reads better on a
  desktop. The app is explicitly excluded from that rule.

The last of it: /statistics and /draw-schedule now take the scale through a
`.mkt-inner` scope (they were still on Bootstrap's 24 / 20 / 16px and its 12.8px
caption), the app's inner screens lost their 25 inline 13px hints, the
information block's prose moved from 14 to 15, and the 800 weight is gone - the
game strip's selected tile no longer switches to a heavier weight on top of the
amber underline it already wears.

Final measurement, eight public pages at 390px: **ten size/weight pairs** - three
weights (400 body, 600 label, 700 title) over five sizes (12, 15, 17, and the two
deliberate ones below) - down from twenty-one. No page scrolls sideways.

### Named Rules
**The Tabular Rule.** Every numeral in the product uses equal-width figures
(`font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1`), set once
on `body`. A column of results that does not line up is a bug.

**The 12px Label Rule.** Prize-row labels do not grow with the numbers they sit
beside. If a figure needs more room, the figure gets it.

## Layout

Cards are laid out on a 12-column Bootstrap grid: three across on a wide screen,
one across on a phone (`col-12 col-sm-12 col-md-6 col-lg-4`). Reading order is
column-first on desktop, so a player scanning down sees one game per column.

Inside a card the order is fixed and identical for all eleven games: game name
and logo, then date and draw number, then 1st/2nd/3rd, then the special grid,
then the consolation grid, then any jackpot rows. The special and consolation
grids are five cells per row on every game, whatever the game's cell count, so
cell 6 starts a new row everywhere.

The narrow breakpoint is **380px**: below it, game names wrap instead of
truncating, numbers drop to 17px with `letter-spacing: 0`, and cell padding goes
to 1px so a full row of numbers still fits without horizontal scroll.

## Elevation & Depth

Flat by default. Depth is carried by hairline borders and background tone, not by
shadow: a card is white on a white page with a 1px border, and states (focus,
press) are expressed as an outline or a small transform rather than a raised
surface.

### Named Rules
**The Flat-By-Default Rule.** No shadow on a resting surface. A shadow may
appear only as a response to state.

## Shapes

Two radii exist and no others: `--radius-sm` (4px) for cards, table cells and
chips; `--radius-md` (12px) for buttons and the app's pressable tiles. One
documented exception sits in the app shell, which uses `border-radius: 0` on the
top bar so it spans the full width.

## Components

### Buttons
- **Shape:** 12px radius (`var(--radius-md)`), minimum 44x44, one line of text,
  never a wrapped label.
- **Primary:** brand red background, white text.
- **Secondary:** white background, ink text, 1px border.
- **Hover / Press / Focus:** a 90ms transform + filter on press, and a
  `:focus-visible` ring in `--focus-ring`. The theme's own stylesheet switches
  outlines off for every `:focus`, so the ring is re-declared globally - a
  replacement must not remove it.
- **Disabled:** reduced opacity, no transform.

### Cards / Containers
- **Corner Style:** 4px (`var(--radius-sm)`).
- **Background:** white; the game name sits on the game's own header tint.
- **Border:** 1px hairline; no shadow at rest.
- **Internal Padding:** 0.5rem on the card body, 1px left/right on number cells
  below 380px.

### The Result Card (signature component)
The one component that repeats eleven times and carries the product.

- **Anatomy, in order:** header (logo + game name) → date + draw number → the
  three top prizes as label/number rows → Special grid → Consolation grid →
  optional jackpot rows.
- **Cell contract:** every value is addressed by a `data-id`
  (`first_prize`, `special-1..13`, `consolation-1..10`, `number_1..9`,
  `six_main`, `six_2a..5b`, `date`, `draw_no`). Live writers, the server
  snapshot and the admin manual-entry boxes all address cells this way, so the
  attributes and the cell order are load-bearing and must survive a restyle.
- **Empty cells:** render `----` in the same size and position as a number.
  Emptying a cell that holds a number must be possible (a new draw clears the
  board) while a deliberate hole in an operator's grid stays empty.
- **States:** live-pending (a cell awaiting its first value), live-flash (a value
  just written), and past (an archived board, `.mkt-past`).

### Navigation
- Brand bar: red background, white logo, five items, equal weight.
- Active item: marked by an underline, not by a fill.
- Sticky rows (the game-icon row) measure the header's real height at runtime
  instead of using a fixed offset, because the logo size is an admin setting.

## Do's and Don'ts

### Do:
- **Do** keep every `data-id` attribute, every cell and every cell *position*
  exactly as they are when restyling a card.
- **Do** render numbers larger than every label on the card, and keep them
  tabular.
- **Do** keep `----` in the same cell, at the same size, as the number it
  replaces.
- **Do** check a change at 390px wide before shipping it; that is the design
  width, not 1440px.
- **Do** verify contrast numerically (4.5:1 body text) rather than by eye.
- **Do** keep the three languages in the same layout, with no language getting
  a different structure.

### Don't:
- **Don't** move a prize row or a cell to gain visual novelty - position is how
  players read the board.
- **Don't** hard-code a brand colour where `var(--primary, var(--brand))` is
  read, or the admin's colour setting stops working.
- **Don't** add a webfont that blocks first paint or that renders CJK as boxes.
- **Don't** add shadow, gradient or animation to a resting surface: this is an
  Operate surface, and motion competes with reading a number.
- **Don't** shrink a tap target below 44x44, including in the dense grids.

### Measured exceptions on record (16 Oct 2026)

Two findings from the audit are deliberate and must not be "fixed" again:

- **Inline links inside sentences are exempt from the 44px floor.** Nine links
  were flagged (all `<a><span>` inside a `<p>` in the prose sections, rendering
  16-18px tall). WCAG 2.2 Target Size (Minimum) exempts a target inside a
  sentence, and padding them to 44px would break the line rhythm of the copy.
  Links that are *navigation* - menu, footer lists, buttons - do keep the 44px
  floor, and still measure above it.
- **The header logo is capped at `min(60vw, 240px)`.** It is a wide wordmark;
  at height 48 it rendered 390px wide on a 390px screen and pushed the document
  to 414px. The cap is what keeps the page from scrolling sideways, so raising
  it re-introduces that bug.
- **The card's amber top edge stays 4px on a 14px radius.** The detector reports
  this as `border-accent-on-rounded`, an anti-pattern it associates with older
  decorative styling, eleven times per page. The owner was shown the three
  options side by side - keep it, square the top corners, or replace the bar
  with a 1px gold rule under the card heading - and chose to keep it as it is
  (16 Oct 2026, direction J). Reported, not a defect; do not "fix" it without
  asking again.
- **Arial is not a finding either.** The detector flags `body` for using an
  overused face. This project uses the system UI stack on purpose: it renders
  the Latin labels and the Chinese game names natively, and it keeps the app
  free of a font download (see Typography above). Swapping it needs a webfont
  that covers CJK, which is the trade-off to weigh first.
- **The status row's greens, the favourite highlight and the dimmed empty cell
  are semantic, not palette.** The palette audit reports the live-publishing
  greens (`#16a34a` on `#f0fdf4`, border `#86efac`, ink `#15803d`), the favourite
  yellow on the results pages, and `.jackpot_number.blank`'s `#aaa` as
  off-palette. They carry meaning rather than decoration - "this draw is being
  published right now", "this is one of your numbers", "this box is deliberately
  empty" - so they are kept and named here instead of being dragged towards
  amber. The `.blank` grey in particular must stay visible: it is the marker that
  tells a deliberate hole apart from a cell the draw has not reached, so lightening
  it towards `--j-border` would erase the distinction, not tidy it. The palette
  governs the surfaces around them; every other colour the audit lists on the six
  pages is old residue and is fair game.
- **An empty cell has three causes, and only one is a defect.** It reads `----`
  when the draw has not reached that box yet, when the operator deliberately
  drew that number as a top prize (so the box is empty on their board too), and
  when a value was cleared because the source went behind. The first two are
  normal and the operator's own page shows them identically, so our board
  matches it; the third is the risky one, and the status row above the results
  is what names it - a board whose "last updated" time has stopped is stale.
  Decided 16 Oct 2026: do not invent a fourth cell style to separate the first
  two. If a later pass wants it anyway, the route is a sentinel value for the
  deliberate holes - the server already knows which boxes those are, from the
  top-prize letters - plus a dimmer cell. Anything that only changes how `----`
  is *drawn* cannot tell the three apart, because at that point the information
  is gone.
