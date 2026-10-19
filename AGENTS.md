# Rules this project has already been told once

Each line below exists because the same mistake was reported more than once.
Read them before touching the live results pipeline.

## Grand Dragon

- The 1st, 2nd and 3rd prizes always print the booth letter in front of the
  number: `D 2890`. The operator shows `1st Prize (D) 2890` and blanks booth D
  on the board, so the letter has to be carried separately - never print a bare
  `2890`. Both sources must keep it: the dated page (`1st Prize (D) 2890`) and
  the app API (`DrawNumber1/2/3` name the letter). A typed board does the same:
  `1st = D 2890`.
- The jackpot block under the 4D board uses the data-ids `jp_pool`,
  `jp_letter`, `jp_units`. `jp7_pool` / `jp7_grand` are the 6D card's ids.
- The 4D card is `table-13`; the 6D card is `table-14`. A correction aimed at
  one of them does nothing for the other - always fix both when the report says
  "Grand Dragon".
- The operator's own hosts are rate-limited per IP and share one budget across
  `result.gdlotto.com` and `result.gdlotto.net`. Never poll them every few
  seconds; that is what emptied the 6D card for days.
- A blanked booth is DATA. When a GD number moves up to 1st/2nd/3rd the
  operator empties its lettered box, and the mirror sends it empty. Leaving that
  key out of the card makes the phone keep whatever it showed there before,
  which is how B and E carried the previous draw's numbers all evening. Once a
  board has any number, its empty boxes must be sent as `----`.

## Manual corrections

- Every box on every card must be typeable with text, not only digits: letters
  (`jp_letter=D`), money (`jp_pool=1741072.81`), status words and star patterns.
- A box name written by the panel (`six_main=`) wins over a short alias (`6D=`)
  when both are present.
- A refused read keeps the last good board; the card is never blanked.

## Data flow

- The archive and hot-number statistics are refreshed by the GitLab schedule and
  by the PC tasks `MKT88-PastBundle` (00:10) and `MKT88-HistoryCheck` (12:00).
