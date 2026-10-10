/**
 * The 4D operators publish their result tables in Traditional Chinese, and the
 * pages captured from them carry those characters straight through to the
 * screen. The app itself is Simplified, so the handful of forms that actually
 * turn up in the captured tables are mapped here - at display time only.
 *
 * The stored data keeps its original text on purpose: the number-history
 * parsers match prize rows by what the operators wrote, so the data is left
 * exactly as it was captured.
 */
const TRAD: Record<string, string> = {
  "獎": "奖", "別": "别", "萬": "万", "馬": "马", "黃": "黄", "勞": "劳",
  "東": "东", "氣": "气", "積": "积", "車": "车", "記": "记", "錄": "录",
  "開": "开", "過": "过", "結": "结", "龍": "龙", "發": "发", "頭": "头",
  "賽": "赛",
};

const RE = new RegExp("[" + Object.keys(TRAD).join("") + "]", "g");

/** Rewrite the Traditional characters above into their Simplified forms. */
export function toSimplified(s: string): string {
  return s ? s.replace(RE, (c) => TRAD[c]) : s;
}
