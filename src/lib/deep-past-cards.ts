/**
 * Deep past-results archive (2021-09-15 .. 2022-04-20).
 *
 * The live archive only starts on 2022-04-20, so the earlier draws were
 * collected once from the public past-results archive and stored here. Each
 * record keeps the printed rows: prize pairs plus the Special / Consolation
 * grids, exactly as the operator published them.
 */
import deepRaw from "./deep-past.json";

export interface DeepGame { n: string; d: string; dn: string; p: [string, string][]; g: [string, string[]][] }
type Store = Record<string, Record<string, DeepGame>>;

export const DEEP = deepRaw as unknown as Store;
export const DEEP_FROM = "2021-09-15";

const ASSET = "/sites/live4dresult-net-0600c55d/root-8a5edab2/wp-content/themes/oldtheme-lottery-frontend/assets/images/";
const SG_LOGO = "/sites/live4dresult-net-0600c55d/root-8a5edab2/logo_singapore4d.png";

/** Which archive records make up each game page, and how to draw them. */
export const DEEP_CARDS: Record<string, { key: string; table: string; bg: string; logo: string; name: string }[]> = {
  magnum: [
    { key: "magnum", table: "table-1", bg: "magnum-bg", logo: ASSET + "logo_magnum.gif?v=1", name: "Magnum 4D 萬能" },
    { key: "magnum-life", table: "table-3", bg: "magnum-bg", logo: ASSET + "logo_magnum.gif?v=1", name: "Magnum Life万能天天彩" },
    { key: "magnum-jp", table: "table-2", bg: "magnum-bg", logo: ASSET + "logo_magnum.gif?v=1", name: "Magnum Jackpot Gold萬能黃金万字积宝" },
  ],
  damacai: [
    { key: "damacai", table: "table-4", bg: "damacai-bg", logo: ASSET + "logo_damacai.gif?v=1", name: "Da Ma Cai 1+3D 大馬彩" },
    { key: "damacai33", table: "table-5", bg: "damacai-bg", logo: ASSET + "logo_damacai.gif?v=1", name: "Da Ma Cai 3+3D 大馬彩" },
  ],
  sportstoto: [
    { key: "sportstoto", table: "table-6", bg: "sportstoto-bg", logo: ASSET + "logo_toto.gif?v=1", name: "SportsToto 4D 多多" },
    { key: "sportstoto56", table: "table-7", bg: "sportstoto-bg", logo: ASSET + "logo_toto.gif?v=1", name: "SportsToto 5D, 6D, Lotto多多六合彩" },
  ],
  sg: [{ key: "sg", table: "table-11", bg: "singapore-bg", logo: SG_LOGO, name: "Singapore 4D" }],
  sabah88: [{ key: "sabah88", table: "table-10", bg: "sabah88-bg", logo: ASSET + "logo_sabah88.gif?v=1", name: "Sabah 88 4D 沙巴萬字" }],
  sandakan: [{ key: "sandakan", table: "table-8", bg: "sandakan-bg", logo: ASSET + "logo_stc4d.gif?v=1", name: "Sandakan 4D山打根赛马会" }],
  cashsweep: [{ key: "cashsweep", table: "table-9", bg: "cashsweep-bg", logo: ASSET + "logo_cashsweep.gif?v=1", name: "Special CashSweep 砂勞越大萬" }],
};

DEEP_CARDS.east = [...DEEP_CARDS.sandakan, ...DEEP_CARDS.cashsweep, ...DEEP_CARDS.sabah88];
DEEP_CARDS.home = [
  ...DEEP_CARDS.magnum, ...DEEP_CARDS.damacai, ...DEEP_CARDS.sportstoto,
  ...DEEP_CARDS.sg, ...DEEP_CARDS.sandakan, ...DEEP_CARDS.cashsweep, ...DEEP_CARDS.sabah88,
];

const esc = (s: string) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const rowTd = (cls: string, html: string, width?: string) =>
  '<td class="' + cls + '"' + (width ? ' width="' + width + '"' : "") + ">" + html + "</td>";

function pairsTable(pairs: [string, string][]): string {
  const rows = pairs
    .filter(([label]) => /prize|jackpot|Bonus/i.test(label))
    .map(([label, value]) => "<tr>" + rowTd("lottery-prize-title text-center", esc(label), "45%") + rowTd("lottery-prize-number border text-center", esc(value), "55%") + "</tr>")
    .join("");
  return rows ? '<table class="my-1" width="100%"><tbody>' + rows + "</tbody></table>" : "";
}

function gridTable(title: string, values: string[]): string {
  const clean = values.filter((v) => /^----$/.test(v) || /^\d{1,6}$/.test(v));
  if (!clean.length) return "";
  const rows: string[] = ["<tr>" + rowTd("lottery-prize-title text-center", esc(title)) + "</tr>"];
  for (let i = 0; i < clean.length; i += 5) {
    const chunk = clean.slice(i, i + 5);
    while (chunk.length < 5) chunk.push("&nbsp;");
    rows.push("<tr>" + chunk.map((v) => rowTd("border text-center lottery-number", v === "&nbsp;" ? v : esc(v), "20%")).join("") + "</tr>");
  }
  return '<table class="my-1" width="100%"><tbody>' + rows.join("") + "</tbody></table>";
}

/** Card HTML for one game on an archived date, or "" when not held. */
export function buildDeepCard(date: string, slug: string, cardId: string): { html: string; name: string } | null {
  const day = DEEP[date];
  if (!day) return null;
  const info = (DEEP_CARDS[slug] || []).find((c) => c.key && day[c.key]);
  if (!info) return null;
  const g = day[info.key];
  const grids = g.g.map(([t, v]) => gridTable(t, v)).join("");
  const extra = pairsTable(g.p.filter(([l]) => /Jackpot|Bonus|Prize :/i.test(l)));
  const html =
    '<div class="card outer-box mkt-past ' + info.table + '" id="' + cardId + '">' +
      '<div class="card-body p-2">' +
        '<div class="row mx-0 align-items-center justify-content-center ' + info.bg + ' position-relative">' +
          '<div class="lottery-logo"><img src="' + info.logo + '" alt="logo" /></div>' +
          '<div class="lottery-name">' + esc(info.name || g.n) + "</div>" +
        "</div>" +
        '<div class="row mx-0 justify-content-between">' +
          '<div class="date">Date: <span data-id="date">' + esc(g.d) + "</span></div>" +
          (g.dn ? '<div class="date">Draw No: <span data-id="draw_no">' + esc(g.dn) + "</span></div>" : "") +
        "</div>" +
        pairsTable(g.p) + extra + grids +
      "</div>" +
    "</div>";
  return { html, name: info.name || g.n };
}

/** True when the archive holds this game on this date. */
export function deepHas(date: string, slug: string): boolean {
  const day = DEEP[date];
  if (!day) return false;
  return (DEEP_CARDS[slug] || []).some((c) => day[c.key]);
}

export function deepDates(): string[] {
  return Object.keys(DEEP).sort();
}
