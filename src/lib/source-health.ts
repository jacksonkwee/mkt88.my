import { firestoreGet, firestorePut, pushConfigured } from "./fcm";
import { notifyOwner } from "./owner-alerts";

/**
 * Which live sources are behaving today, and which ones changed shape.
 *
 * Every result we publish is parsed out of somebody else's page or API. When one
 * of them changes its layout the parse does not crash - it quietly produces the
 * wrong shape, and that wrong shape is what lands on the card. That is how an
 * evening of "the numbers are wrong again" starts, and nobody finds out until a
 * user looks at their phone (asked for 15 Oct 2026).
 *
 * So every source's result is checked against the shape its game must have. A
 * source that fails is NOT written to the cards: the card keeps the last value
 * that was right instead of showing a wrong one. The failure is recorded here,
 * kept in Firestore so every server instance and the admin page see the same
 * thing, and shown on /admin.
 */
export interface SourceState {
  key: string;
  /** What the reader would call it. */
  name: string;
  ok: boolean;
  /** Why it failed, in plain words. */
  why?: string;
  /** When this state was last set (ms). */
  at: number;
  /** When this source last produced a good result (ms). */
  okAt?: number;
}

const DOC = "config/source-health";
const memory = new Map<string, SourceState>();
let dirty = false;
/** State changes since the last flush - what the owner gets pushed about. */
const pending = new Map<string, { name: string; ok: boolean; why?: string }>();

/**
 * Record the outcome of one source.
 *
 * Firestore is only written when a source CHANGES state - the snapshot is
 * rebuilt every few seconds and a write per rebuild would be absurd.
 */
export function noteSource(key: string, name: string, result: { ok: boolean; why?: string }): void {
  const prev = memory.get(key);
  const now = Date.now();
  if (prev && prev.ok === result.ok && prev.why === result.why) {
    prev.at = now;
    if (result.ok) prev.okAt = now;
    return;
  }
  memory.set(key, {
    key, name,
    ok: result.ok,
    why: result.ok ? undefined : (result.why || "shape changed"),
    at: now,
    okAt: result.ok ? now : prev?.okAt,
  });
  pending.set(key, { name, ok: result.ok, why: result.ok ? undefined : (result.why || "shape changed") });
  dirty = true;
}

/** Push a changed state to Firestore (called once at the end of a snapshot build). */
export async function flushSourceHealth(): Promise<void> {
  if (!dirty) return;
  dirty = false;
  const seen = [...pending.entries()];
  pending.clear();
  if (!pushConfigured() || !seen.length) return;
  /*
   * What the last instance wrote.
   *
   * The map above lives in ONE serverless instance, so a cold start - every
   * deploy, and every idle wake - remembers nothing and every source reads as
   * "just changed". The owner was therefore pushed "来源已恢复" once for every
   * instance that started: several an hour, all day, with nothing wrong
   * (reported 15 Oct 2026). The stored copy is the memory that spans instances,
   * so only a difference against IT is worth a push.
   */
  const was = await storedStates();
  const changed = was
    ? seen
        .filter(([key, now]) => {
          const before = was.get(key);
          return !before || before.ok !== now.ok || (before.why || "") !== (now.why || "");
        })
        .map(([, v]) => v)
    : [];
  try {
    await firestorePut(DOC, { json: JSON.stringify([...memory.values()]) });
  } catch { /* the snapshot must not fail because a note could not be stored */ }
  /*
   * Tell the owner, on their own phone, and only them (see owner-alerts.ts).
   * One push per REAL change, never per rebuild - a source flipping state is
   * once in a long while, and an evening of pings would just get muted. With
   * nothing stored to compare against, stay quiet rather than repeat the lot.
   *
   * Only a BREAK is pushed. Recovery is news the owner asked not to have
   * (15 Oct 2026): the card is right again by the time it happens, and the
   * message that came with it was the one filling their phone. The stored state
   * still moves back to ok, so if that source breaks again later it is
   * announced once more.
   */
  if (!changed.length) return;
  const broke = changed.filter((c) => !c.ok);
  if (!broke.length) return;
  try {
    await notifyOwner(
      "⚠️ MKT88 开彩来源有问题",
      broke.map((c) => c.name + "：" + (c.why || "形状变了")).join("\n") +
        "\n（画面会保留上一次正确的成绩，不会显示错的号码）"
    );
  } catch { /* a push that fails must not break the snapshot */ }
}

/**
 * The states whichever instance wrote last, or null when there is no copy to
 * compare with (nothing stored yet, or the store could not be read).
 */
async function storedStates(): Promise<Map<string, SourceState> | null> {
  try {
    const doc = await firestoreGet<{ fields?: { json?: { stringValue?: string } } }>(DOC);
    const raw = doc?.fields?.json?.stringValue;
    if (!raw) return null;
    return new Map((JSON.parse(raw) as SourceState[]).map((s) => [s.key, s]));
  } catch {
    return null;
  }
}

/** Every source we have heard from, worst first. */
export async function getSourceHealth(): Promise<SourceState[]> {
  if (memory.size) return sortHealth([...memory.values()]);
  if (!pushConfigured()) return [];
  const stored = await storedStates();
  return stored ? sortHealth([...stored.values()]) : [];
}

const sortHealth = (list: SourceState[]) =>
  list.sort((a, b) => Number(a.ok) - Number(b.ok) || a.name.localeCompare(b.name));

/*
 * The shape each game's grid must have.
 *
 * These are the operator's own board sizes, checked against the official sites:
 * how many top prizes, how many special and consolation cells, and how many
 * digits each number carries. A parser that suddenly produces a different
 * COUNT, a wrong-width number, a repeat inside a grid, or a date that is not
 * today or yesterday has met a changed page - not a result.
 */
export interface GridShape {
  prizes: number;
  special: number;
  cons: number;
  digits: number;
  /** Some games print the 1st-3rd prizes as letters into the special grid. */
  allowBlank?: boolean;
}

export const GRID_SHAPES: Record<string, GridShape> = {
  "table-1": { prizes: 3, special: 13, cons: 10, digits: 4 },
  "table-4": { prizes: 3, special: 10, cons: 10, digits: 4 },
  "table-5": { prizes: 3, special: 6, cons: 6, digits: 6 },
  "table-6": { prizes: 3, special: 13, cons: 10, digits: 4 },
  "table-8": { prizes: 3, special: 13, cons: 10, digits: 4 },
  "table-9": { prizes: 3, special: 10, cons: 10, digits: 4 },
  "table-10": { prizes: 3, special: 13, cons: 10, digits: 4 },
  "table-11": { prizes: 3, special: 10, cons: 10, digits: 4 },
  "table-13": { prizes: 3, special: 13, cons: 10, digits: 4 },
  "table-17": { prizes: 3, special: 13, cons: 10, digits: 4 },
};

/**
 * How old the draw on a card is allowed to be.
 *
 * Most games draw three times a week (Wednesday, Saturday and Sunday), so the
 * newest draw on a Tuesday is Sunday's - two days old - and on a Wednesday
 * morning it is three. A one-day rule flagged every one of those as a broken
 * page, which would have woken the owner on the first Friday morning for a
 * board that was perfectly correct. A date further back than this, or a date in
 * the future, is still refused.
 */
const MAX_DRAW_AGE_DAYS = 4;

/**
 * "No number here" as the operators actually print it.
 *
 * Dashes of any length are the usual one; Sports Toto prints "****" while a
 * draw is pending, and the mirror's east page leaves a bare "-". All of them
 * mean empty, and treating them as a changed page would cry wolf every day
 * (found 15 Oct 2026).
 */
const isDashVal = (v: string) => /^(-{1,}|\*{2,})$/.test(String(v || "").trim());
const isNumberish = (v: string) => /^[0-9]+$/.test(String(v || "").trim());

/**
 * Check one game's parsed board. Returns a plain-language reason, or null when
 * the shape is what it should be.
 *
 * A board still being revealed is fine - empty cells are expected. What is not
 * fine is the wrong number of cells, a number of the wrong width, a repeat
 * inside the same grid, or a date that is impossible (see MAX_DRAW_AGE_DAYS).
 */
export function checkGrid(cls: string, vals: Record<string, string>, todayIso: string): string | null {
  const g = GRID_SHAPES[cls];
  if (!g) return null;
  const prizes = ["first_prize", "second_prize", "third_prize"].map((k) => vals[k]).filter((v) => v !== undefined);
  const special = Array.from({ length: g.special }, (_, i) => vals["special-" + (i + 1)]).filter((v) => v !== undefined);
  const cons = Array.from({ length: g.cons }, (_, i) => vals["consolation-" + (i + 1)]).filter((v) => v !== undefined);
  if (prizes.length && prizes.length !== g.prizes) return "头奖格数不对（" + prizes.length + "，应该是 " + g.prizes + "）";
  // Some feeds hand over the card's full fifteen special slots for a game that
  // only publishes thirteen - the extras are spare cells and are normally
  // blank. Too FEW cells is the changed-page signal; a NUMBER in a spare cell
  // is the "same number printed twice" fault, and is caught below.
  if (special.length && special.length < g.special) return "特别奖格数不足（" + special.length + "，应该是 " + g.special + "）";
  if (cons.length && cons.length < g.cons) return "安慰奖格数不足（" + cons.length + "，应该是 " + g.cons + "）";
  const spare = [...special.slice(g.special), ...cons.slice(g.cons)].filter((v) => v && !isDashVal(v));
  if (spare.length) return "多出来的空格里出现了号码（" + spare[0] + "）";
  const all = [...prizes, ...special, ...cons].map((v) => String(v).trim());
  const bad = all.find((v) => v && !isDashVal(v) && !isNumberish(v));
  if (bad) return "有号码不是数字（" + bad.slice(0, 12) + "）";
  const wrongWidth = all.find((v) => v && !isDashVal(v) && isNumberish(v) && v.replace(/^0+(?=\d)/, "").length > g.digits);
  if (wrongWidth) return "号码位数太多（" + wrongWidth + "）";
  const drawn = (arr: string[]) => arr.filter((v) => v && !isDashVal(v));
  for (const [label, arr] of [["特别奖", drawn(special)], ["安慰奖", drawn(cons)]] as [string, string[]][]) {
    const dupes = arr.filter((v, i) => arr.indexOf(v) !== i);
    if (dupes.length) return label + "里面有重复号码（" + dupes[0] + "）";
  }
  const date = String(vals.date || "").trim();
  const m = /(\d{2})-(\d{2})-(\d{4})/.exec(date);
  if (m) {
    const iso = m[3] + "-" + m[2] + "-" + m[1];
    const ageDays = Math.round((Date.parse(todayIso + "T00:00:00Z") - Date.parse(iso + "T00:00:00Z")) / 86400000);
    if (!Number.isFinite(ageDays)) return "卡片日期看不懂（" + date + "）";
    if (ageDays < 0 || ageDays > MAX_DRAW_AGE_DAYS) {
      return "卡片日期是 " + date + "（今天是 " + todayIso + "，差了 " + ageDays + " 天）";
    }
  }
  return null;
}
