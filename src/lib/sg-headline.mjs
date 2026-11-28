const DASH = "----";
const fourDigits = (value) => /^\d{4}$/.test(String(value || "").trim()) ? String(value).trim() : DASH;

/**
 * The fast Singapore stream is a headline feed, not a complete result board.
 *
 * live4d.sg empties its detail list after the draw and leaves only the 1st
 * prize in `flag`. Any starter numbers it exposed before that point can be
 * incomplete or out of order. Expose only the headline fields here; the full
 * Singapore Pools board remains the sole owner of 2nd, 3rd, starter and
 * consolation values.
 */
export function sgHeadlineCard(board) {
  if (!board || !board.date) return null;

  const card = {
    date: board.date,
    draw_no: DASH,
    first_prize: fourDigits(board.first_prize),
    second_prize: DASH,
    third_prize: DASH,
  };
  for (let i = 1; i <= 15; i++) card["special-" + i] = DASH;
  for (let i = 1; i <= 10; i++) card["consolation-" + i] = DASH;
  return card;
}
