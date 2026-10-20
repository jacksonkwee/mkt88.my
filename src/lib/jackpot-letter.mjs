export const JACKPOT_LETTERS = "ABCDEFGHIJKLM";

/**
 * "E", "E : 9136" and "e:9136" all reduce to E.
 * @param {unknown} value
 * @returns {string | null}
 */
export function jackpotLetterOf(value) {
  const match = /^[A-M]/i.exec(String(value ?? "").trim());
  return match ? match[0].toUpperCase() : null;
}

/**
 * Grand Dragon's jackpot letter advances A -> B ... -> M -> A.
 * @param {unknown} value
 * @returns {string | null}
 */
export function nextJackpotLetter(value) {
  const current = jackpotLetterOf(value);
  if (!current) return null;
  return JACKPOT_LETTERS[(JACKPOT_LETTERS.indexOf(current) + 1) % JACKPOT_LETTERS.length];
}
