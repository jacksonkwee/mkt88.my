import type { CardRow, CardTable, LotteryCardData } from "./LotteryCard";
import { attr, plain, segmentOf, tablesOf } from "./card-parse";
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

function cardFor(cls: string): LotteryCardData | null {
  const seg = segmentOf(html, cls);
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
function lottoBoard(title: string, group: "5" | "6", rows: number, separated = false): CardTable {
  const cells: CardRow[] = [];
  /*
   * Each board carries its own heading, the way Sports Toto's 5D / 6D card
   * heads its sections, and wears the Sabah 88 blue - the same colour as that
   * card's own header band (11 Oct 2026).
   */
  if (title) {
    cells.push({
      cls: "",
      cells: [{ tag: "td", cls: "lottery-prize-title sabah88-bg text-center", attrs: { colspan: "4" }, html: title }],
    });
  }
  for (let i = 1; i <= rows; i++) {
    const id = "sabahlotto" + group + "_";
    cells.push({
      cls: "",
      cells: [
        { tag: "td", cls: "lottery-prize-title text-center", attrs: { width: "16%" }, html: "Group " + i },
        { tag: "td", cls: "border text-center lottery-number", attrs: { width: "26%", "data-id": id + "num_" + i }, html: "----" },
        { tag: "td", cls: "border text-center lottery-number", attrs: { width: "13%", "data-id": id + "bonus_" + i }, html: "----" },
        { tag: "td", cls: "lottery-prize-number border text-center mkt-lotto-jp", attrs: { width: "45%", "data-id": id + "jp_" + i }, html: "----" },
      ],
    });
  }
  // "mkt-lotto-sep" opens a gap above the board, so the Lotto blocks read as
  // their own section instead of running straight on from the 4D rows.
  return { cls: "my-1 mkt-lotto" + (separated ? " mkt-lotto-sep" : ""), widthAttr: "100%", rows: cells };
}

/**
 * Cash Sweep's 3D board.
 *
 * The operator publishes it in the same live.json (keys 4 to 6) but its page has
 * no board for it, so the table is built here in the shape the other games' 3D
 * boards use. The user asked for it under the 4D Jackpot rows (11 Oct 2026).
 */
function d3Table(): CardTable {
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
      { cls: "", cells: [{ tag: "td", cls: "lottery-prize-title text-center", attrs: { colspan: "2" }, html: "3D" }] },
      row("1st Prize 首奖", "first_d3_prize"),
      row("2nd Prize 二奖", "second_d3_prize"),
      row("3rd Prize 三奖", "third_d3_prize"),
    ],
  };
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
    // Lotto 5 and Lotto 6 are separate blocks: each has its own heading and its
    // own gap, so the two boards do not read as one long table.
    const lotto = cls === "table-10" ? [lottoBoard("Lotto 5", "5", 8, true), lottoBoard("Lotto 6", "6", 5, true)] : [];
    // Cash Sweep's own 3D board, directly under its jackpot rows.
    if (cls === "table-9") return { ...c, tables: [...head, jackpotTable(ids), d3Table(), ...tail] };
    /*
     * The captured 3D board's title row spans five columns, which gives that
     * table a five-column grid - so its "1st Prize / 859" rows only filled part
     * of the card while the 4D rows beside them ran the full width. Two columns
     * is the shape the 4D prize table uses, and the one the operator's own board
     * has.
     */
    const tidy = tail.map((t) => {
      const title = plain(t.rows[0]?.cells[0]?.html || "");
      const titleCell = t.rows[0]?.cells[0];
      if (!titleCell) return t;
      // The operator's Lotto 6/45 board only differs by its heading; give it
      // the same Sabah 88 blue as the Lotto 5 / 6 heading, and the gap that
      // keeps the Lotto boards apart from the 4D results above them.
      if (title === "Lotto 6/45") {
        return {
          ...t,
          cls: (t.cls + " mkt-lotto-sep").trim(),
          rows: t.rows.map((r, i) => (i === 0 ? { ...r, cells: [{ ...titleCell, cls: titleCell.cls + " sabah88-bg" }] } : r)),
        };
      }
      if (title !== "3D") return t;
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
