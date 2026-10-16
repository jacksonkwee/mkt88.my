# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(The Android app is a WebView wrapper that loads this same site, so the design
language is web, not native. Confirmed by the Capacitor wrapper in `mkt88-app/`.)

## Users

Primary: 4D lottery players in Malaysia, checking results on a phone. They open
the site during a live draw, in the minutes right after it, and later for prize
details. The job is narrow and urgent: **did my number come out, and in which
prize row**. Many are not fluent readers of English, so the product serves
English, Bahasa Melayu and 简体中文, and numbers must be recognisable at a glance
without reading labels.

Confirmed by the owner, 16 Oct 2026.

Secondary (owner-confirmed, **conditional**): the audience of the owner's Meta
page, who get a daily results post built from this site's data — "if conditions
permit". It is a destination for the data, not a constraint on this interface:
no layout or wording decision may be made for the Meta audience at the expense
of the phone player.

## Product Purpose

One place to see live 4D results for all eleven games — Magnum 4D, Da Ma Cai
1+3D / 3+3D, SportsToto 4D / 5D / 6D, Singapore 4D, Singapore Toto, Sabah 88,
Sandakan, Special Cash Sweep, Grand Dragon 4D / 6D, Nine Lotto, Perdana 4D and
Lucky HariHari — plus the history and tools that surround them (number history,
hot numbers, favourites, draw schedule, 大伯公, statistics). Success is a player
getting the right number off the screen in seconds, and trusting it because it
came from the operator.

## Positioning

Results are read from the **operators' own sites and APIs**, not copied from
another aggregator, and each game's board is filled cell by cell as the operator
publishes. The owner can type a board in by hand for the two games no machine
can read, so the site never depends on a source it does not control the meaning
of. The site is not a clone of the aggregator it replaced, and the owner has
asked for the visual resemblance to be removed.

## Operating Context

- Draws run on a published timetable: midday/afternoon slots, and the main
  evening block (~18:30–20:30 Malaysia time). A board is revealed number by
  number over minutes, so the page must be readable **mid-draw**, with cells
  that legitimately hold nothing yet.
- The evening is the peak: several games revealing at once, users refreshing.
- The site is also the Android app's only screen; there is no separate app UI.
- The owner operates the site alone, through `/admin`, while watching a draw.
- A nightly automation checks that every live source still has the shape its
  game needs, and tells the owner only when one breaks.

## Capabilities and Constraints

- Eleven games, each a card with fixed cells. **The `data-id` attributes and the
  cell positions are a hard contract**: the live writers, the embedded snapshot
  and the admin manual-entry boxes all address cells by id, and players read the
  board by position.
- Operators' boards contain **deliberate empty cells** (a 13-slot special grid
  leaves holes where numbers were drawn as the 1st/2nd/3rd prizes). "Not
  published yet" and "deliberately empty" both render as `----` and can only be
  told apart by when they were written.
- Two boards (Sports Toto 4D, Grand Dragon 4D/6D) sit behind bot protection that
  refuses every machine the owner has, so they are read by hand from
  `/admin`; Grand Dragon's specials arrive **in lettered boxes (A–M, N–W)**, not
  in order.
- Three languages everywhere: English, Bahasa Melayu, 简体中文.
- Phone first: the cards must survive a 390px-wide viewport.
- Constraints: results refresh continuously; sources can be slow, blocked or
  change shape, and a card must keep the last value that was right rather than
  show a wrong one.

## Brand Commitments

- **Cell positions inside a result card are frozen** (owner-confirmed, 16 Oct
  2026): 1st/2nd/3rd, then Special, then Consolation, in that order, with the
  same number of cells in the same grid shape per game. A restyle may change
  colour, type, borders, spacing and the shell around the card; it may not
  reorder or re-shape the board itself.

- Name: **MKT88** (mkt88.my). Existing logo asset is used as-is.
- Three languages are a commitment, not a feature.
- The owner has asked, explicitly, that the site and app stop looking like the
  aggregator they were cloned from.
- Undecided (open): whether the site keeps advertising (AdSense/AdSlot
  components exist and are wired).

## Evidence on Hand

- Real live results for all eleven games, refreshed from operator sources.
- Deep number-history archives and past-results snapshots shipped with the site.
- A published Android build (`MKT88-4D-v2.22.aab`) and its Play listings.
- Marketing assets for the daily Meta posts (`marketing/`).
- No testimonials, press, or customer counts exist; future work must not invent
  them.

## Product Principles

1. **The number is the interface.** Everything else — labels, decoration, brand —
   is subordinate to finding a four-digit number fast on a phone.
2. **Position is memory.** Regular players learn where each prize row sits; do not
   move cells to gain visual novelty.
3. **Never show a wrong number.** A card may hold an older result, but it must not
   invent, guess, or mis-place one.
4. **Read like the operator's board.** Where the operator puts a number (a
   lettered box, a hole) is the truth; our layout follows it.
5. **Understandable without English.** A player who reads only Chinese or only
   Malay must still get the result.

<!-- Written 16 Oct 2026 (commit 6b9b732). The structured interview tool was
     unavailable in this session, so the record was drafted from repository
     evidence plus the owner's brief, then confirmed with the owner in writing
     the same day: primary user, purpose, positioning, and the frozen cell
     positions are all owner-confirmed. No section is still inferred. -->
