import type { CardCell, CardRow, CardTable, LotteryCardData } from "./LotteryCard";
import raw from "./snapshots/sabah-sarawak-4d-results.content.json";

/**
 * Sabah 88, Cash Sweep and Sandakan, read into the same card model every other
 * game on the site already uses.
 *
 * Their cards used to be dropped into the page as the raw captured HTML. That
 * made them a different size and position from every other game's card, and on
 * a desktop the page's ad-stripper removed them altogether - the column came out
 * empty, so those three pages showed no result at all (reported 11 Oct 2026).
 * Read into LotteryCardData they render through the one component and the one
 * set of styles, so their size and position match the rest by construction.
 */
const html = (raw as { colHtml?: string }).colHtml || "";

const CARD_CLASSES = ["table-8", "table-9", "table-10"];

/** The names the rest of the site prints for these three games. The captured
 *  pages carry their own wording ("砂劳越" for Cash Sweep), and these cards now
 *  sit beside the others, so they take the same names. */
const NAMES: Record<string, string> = {
  "table-8": "Sandakan 4D山打根赛马会",
  "table-9": "Special CashSweep 砂拉越大万",
  "table-10": "Sabah 88 4D 沙巴万字",
};

/** The card's own block of markup: from its opening div to its matching close. */
function segmentOf(cls: string): string {
  const key = 'class="card outer-box ' + cls + '"';
  const at = html.indexOf(key);
  if (at < 0) return "";
  const start = html.lastIndexOf("<div", at);
  let i = start;
  let depth = 0;
  while (i < html.length) {
    const open = html.indexOf("<div", i);
    const close = html.indexOf("</div>", i);
    if (close === -1 || (open !== -1 && open < close)) { depth++; i = open + 4; }
    else { depth--; i = close + 6; if (depth === 0) break; }
  }
  return html.slice(start, i);
}

const plain = (s: string): string =>
  s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();

const attr = (attrs: string, name: string): string => new RegExp('\\b' + name + '="([^"]*)"').exec(attrs)?.[1] || "";

function cellsOf(inner: string): CardCell[] {
  const out: CardCell[] = [];
  const re = /<(td|th)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner))) {
    const a = m[2];
    const attrs: CardCell["attrs"] = {};
    const width = attr(a, "width"); if (width) attrs.width = width;
    const colspan = attr(a, "colspan"); if (colspan) attrs.colspan = colspan;
    const rowspan = attr(a, "rowspan"); if (rowspan) attrs.rowspan = rowspan;
    const id = attr(a, "data-id"); if (id) attrs["data-id"] = id;
    out.push({ tag: m[1].toLowerCase() === "th" ? "th" : "td", cls: attr(a, "class"), attrs, html: m[3] });
  }
  return out;
}

function tablesOf(seg: string): CardTable[] {
  const out: CardTable[] = [];
  const re = /<table\b([^>]*)>([\s\S]*?)<\/table>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(seg))) {
    const rows: CardRow[] = [];
    const rowRe = /<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi;
    let r: RegExpExecArray | null;
    while ((r = rowRe.exec(m[2]))) rows.push({ cls: attr(r[1], "class"), cells: cellsOf(r[2]) });
    out.push({ cls: attr(m[1], "class"), widthAttr: attr(m[1], "width") || null, rows });
  }
  return out;
}

function cardFor(cls: string): LotteryCardData | null {
  const seg = segmentOf(cls);
  if (!seg) return null;
  const openTag = seg.slice(0, seg.indexOf(">") + 1);
  const bg = /class="row mx-0 align-items-center justify-content-center ([^"]*)"/.exec(seg)?.[1] || "";
  return {
    id: attr(openTag, "id") || cls,
    cardCls: "card outer-box " + cls,
    header: {
      bgCls: bg.split(/\s+/).find((c) => /-bg$/.test(c)) || "",
      logo: { src: /class="lottery-logo"[\s\S]*?<img[^>]*src="([^"]*)"/i.exec(seg)?.[1] || "", alt: "logo" },
      name: NAMES[cls] || plain(/class="lottery-name"[^>]*>([\s\S]*?)<\/div>/i.exec(seg)?.[1] || ""),
      date: plain(/data-id="date"[^>]*>([\s\S]*?)<\/span>/i.exec(seg)?.[1] || ""),
      drawNo: plain(/data-id="draw_no"[^>]*>([\s\S]*?)<\/span>/i.exec(seg)?.[1] || "") || null,
    },
    tables: tablesOf(seg),
  };
}

/**
 * The operator's jackpot board, under the consolation grid - the same place
 * Magnum keeps its "4D Jackpot 1/2 Prize" rows.
 *
 * The captured Sabah 88 page predates the board, and Cash Sweep's and
 * Sandakan's captures never had one, so the table is built here. Its two cells
 * carry the ids the live snapshot writes ("jackpot1_prize" / "jackpot2_prize"),
 * so the amounts stay current instead of freezing on whatever was captured.
 */
const JACKPOT_IDS: Record<string, string[]> = {
  "table-8": ["jackpot1_prize", "jackpot2_prize"],
  "table-9": ["jackpot1_prize", "jackpot2_prize"],
  "table-10": ["jackpot1_prize", "jackpot2_prize"],
};

function jackpotTable(ids: string[]): CardTable {
  const row = (label: string, id: string): CardRow => ({
    cls: "",
    cells: [
      { tag: "td", cls: "lottery-prize-title text-center", attrs: { width: "45%" }, html: label },
      { tag: "td", cls: "lottery-prize-number border text-center", attrs: { "data-id": id }, html: "----" },
    ],
  });
  return {
    cls: "my-1",
    widthAttr: "100%",
    rows: [
      { cls: "", cells: [{ tag: "td", cls: "lottery-prize-title text-center", attrs: { colspan: "2" }, html: "4D Jackpot 积宝奖金" }] },
      row("Jackpot 1", ids[0]),
      row("Jackpot 2", ids[1]),
    ],
  };
}

/**
 * Sabah 88's Lotto 5 and Lotto 6 boards.
 *
 * The operator prints one row per group - the number, the bonus and the group's
 * jackpot - and the captured page does not carry these two boards at all, so the
 * table is built here. The ids match what the live snapshot writes.
 */
function lottoBoard(title: string, group: "5" | "6", rows: number): CardTable {
  const cells: CardRow[] = [
    { cls: "", cells: [{ tag: "td", cls: "lottery-prize-title text-center", attrs: { colspan: "4" }, html: title }] },
  ];
  for (let i = 1; i <= rows; i++) {
    const id = "sabahlotto" + group + "_";
    cells.push({
      cls: "",
      cells: [
        { tag: "td", cls: "lottery-prize-title text-center", attrs: { width: "16%" }, html: "Group " + i },
        { tag: "td", cls: "border text-center lottery-number", attrs: { "data-id": id + "num_" + i }, html: "----" },
        { tag: "td", cls: "border text-center lottery-number", attrs: { "data-id": id + "bonus_" + i }, html: "----" },
        { tag: "td", cls: "lottery-prize-number border text-center", attrs: { "data-id": id + "jp_" + i }, html: "----" },
      ],
    });
  }
  return { cls: "my-1", widthAttr: "100%", rows: cells };
}

export const EAST_CARDS: LotteryCardData[] = CARD_CLASSES
  .map(cardFor)
  .map((c) => {
    const cls = c ? (/^table-\d+/.exec(c.id) || [""])[0] : "";
    const ids = JACKPOT_IDS[cls];
    if (!c || !ids) return c;
    // The jackpot board sits directly under the consolation grid, the way
    // Magnum's does; the operator's remaining boards follow it.
    const head = c.tables.slice(0, 3);   // 4D prizes, Special, Consolation
    const tail = c.tables.slice(3);      // 3D, Lotto 6/45
    const lotto = cls === "table-10" ? [lottoBoard("Lotto 5", "5", 8), lottoBoard("Lotto 6", "6", 5)] : [];
    /*
     * The captured 3D board's title row spans five columns, which gives that
     * table a five-column grid - so its "1st Prize / 859" rows only filled part
     * of the card while the 4D rows beside them ran the full width. Two columns
     * is the shape the 4D prize table uses, and the one the operator's own board
     * has.
     */
    const tidy = tail.map((t) => {
      const title = plain(t.rows[0]?.cells[0]?.html || "");
      if (title !== "3D" || !t.rows[0]?.cells[0]) return t;
      const titleCell = t.rows[0].cells[0];
      const rows = t.rows.map((r, i) =>
        i === 0 ? { ...r, cells: [{ ...titleCell, attrs: { ...titleCell.attrs, colspan: "2" } }] } : r
      );
      return { ...t, rows };
    });
    return { ...c, tables: [...head, jackpotTable(ids), ...tidy, ...lotto] };
  })
  .filter((c): c is LotteryCardData => Boolean(c));

/** The card id each east page opens with. */
export const EAST_CARD_ID: Record<string, string> = {
  sandakan: "table-8-2026-09-06",
  cashsweep: "table-9-2026-09-06",
  sabah88: "table-10-2026-09-06",
};
