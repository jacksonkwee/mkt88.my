export const PAST_FIELDS = ["gd", "nine", "gd6", "gdjp4", "gdjp7", "nine6", "nineJp"];

const isDash = (value) => /^----+$/.test(String(value || "").trim());
const isFourD = (value) => /^\d{4}$/.test(String(value || "").trim());

/**
 * A settled 4D set has three prizes and the full 13 + 10 grid.
 * Grand Dragon's deliberate blank specials are valid because the prize was
 * promoted out of that lettered box.
 * @param {unknown} value
 */
export function isFourDSetComplete(value) {
  if (!value || typeof value !== "object") return false;
  const set = /** @type {{ prize?: unknown; special?: unknown; cons?: unknown }} */ (value);
  if (!Array.isArray(set.prize) || set.prize.length !== 3 || !set.prize.every(isFourD)) return false;
  if (!Array.isArray(set.special) || set.special.length !== 13) return false;
  if (!Array.isArray(set.cons) || set.cons.length !== 10) return false;
  return [...set.special, ...set.cons].every((v) => isFourD(v) || isDash(v));
}

/** @param {unknown} value */
export function isSixComplete(value) {
  if (!value || typeof value !== "object") return false;
  const six = /** @type {{ main?: unknown }} */ (value);
  return /^\d{6}$/.test(String(six.main || "").trim());
}

/** @param {unknown} value */
export function isGdJp4Complete(value) {
  if (!value || typeof value !== "object") return false;
  const jp = /** @type {{ jp4_pool?: unknown; jp4_letter?: unknown; jp4_units?: unknown }} */ (value);
  return /\d/.test(String(jp.jp4_pool || ""))
    && /^[A-M]/i.test(String(jp.jp4_letter || "").trim())
    && /^\d+$/.test(String(jp.jp4_units ?? "").trim());
}

/** @param {unknown} value */
export function isGdJp7Complete(value) {
  if (!value || typeof value !== "object") return false;
  const jp = /** @type {{ jp7_pool?: unknown; jp7_grand?: unknown }} */ (value);
  return /\d/.test(String(jp.jp7_pool || ""))
    && /^\d{6}\s*\+\s*\d$/.test(String(jp.jp7_grand || "").trim());
}

/** @param {unknown} value */
export function isNineJpComplete(value) {
  if (!value || typeof value !== "object") return false;
  const jp = /** @type {Record<string, unknown>} */ (value);
  return ["n9_sj_pool", "n9_sj_grand", "n9_sj_super", "n9_sj_minor"]
    .every((key) => /\d/.test(String(jp[key] || "")));
}

/**
 * @param {Record<string, any>} record
 * @param {string} field
 * @returns {"complete" | "partial" | "missing"}
 */
export function pastFieldState(record, field) {
  const value = record?.[field];
  if (value == null) return "missing";
  const complete = field === "gd" || field === "nine"
    ? isFourDSetComplete(value)
    : field === "gd6" || field === "nine6"
      ? isSixComplete(value)
      : field === "gdjp4"
        ? isGdJp4Complete(value)
        : field === "gdjp7"
          ? isGdJp7Complete(value)
          : field === "nineJp"
            ? isNineJpComplete(value)
            : false;
  return complete ? "complete" : "partial";
}

/** Core game result is what the past card must have. */
export function coreResultComplete(record, game) {
  return pastFieldState(record, game) === "complete";
}

/** @param {Record<string, any>} record */
export function pastRecordStatus(record) {
  return Object.fromEntries(PAST_FIELDS.map((field) => [field, pastFieldState(record, field)]));
}
