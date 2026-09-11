import type { CardRow, CardTable, LotteryCardData } from "./LotteryCard";

const rowText = (row: CardRow) => row.cells.map((c) => c.html.replace(/<[^>]+>/g, " ")).join(" ");
const tableText = (table: CardTable) => table.rows.map(rowText).join(" ");

const isJpRow = (text: string) => /(pool|jackpot|grand prize|super prize|minor prize|6\+1d)/i.test(text);
const isWholeJpTable = (text: string) => /Star Toto|Power Toto|Supreme Toto/i.test(text) && !/1st Prize 首獎/i.test(text);

/** 2nd-5th rows of a 6D card -> the live value slot they read from. */
function sixSlot(text: string): string | null {
  if (/2nd\s*Prize|二獎/.test(text)) return "six_2";
  if (/3rd\s*Prize|三獎/.test(text)) return "six_3";
  if (/4th\s*Prize|四獎/.test(text)) return "six_4";
  if (/5th\s*Prize|五獎/.test(text)) return "six_5";
  return null;
}

/**
 * The captured 6D cards carry the 2nd-5th rows as plain text with no data-id, so
 * the live feed had no way to fill them. Tag the number cell with a value slot
 * (six_2..six_5) unless the row already owns its own ids (SportsToto's 6D rows).
 */
function tagSixRow(row: CardRow): CardRow {
  if (row.cells.some((c) => c.attrs?.["data-id"])) return row;
  const idx = row.cells.findIndex((c) => /lottery-prize-number|lottery-number/.test(c.cls || ""));
  if (idx < 0) return row;
  const slot = sixSlot(rowText(row));
  if (!slot) return row;
  const cells = row.cells.slice();
  cells[idx] = { ...cells[idx], attrs: { ...(cells[idx].attrs || {}), "data-id": slot } };
  return { ...row, cells };
}

/** Split a 6D / SportsToto jackpot card into result and JP columns. */
export function splitSixCard(original: LotteryCardData): { result: LotteryCardData; jp?: LotteryCardData } {
  let card = original;
  if (card.id.startsWith("table-15-") && card.id.endsWith("-6d")) {
    const first = card.tables[0];
    const hasJp = first.rows.some((row) => row.cells.some((cell) => cell.attrs?.["data-id"] === "jp_pool"));
    if (!hasJp) {
      const jpRows: CardRow[] = [
        { cls: "", cells: [{ tag: "td", cls: "lottery-prize-title text-center", attrs: {}, html: "Jackpot Pool 奖金池" }, { tag: "td", cls: "lottery-prize-number border text-center", attrs: { "data-id": "jp_pool" }, html: "----" }] },
        { cls: "", cells: [{ tag: "td", cls: "lottery-prize-title text-center", attrs: {}, html: "Jackpot No. 开奖号码" }, { tag: "td", cls: "lottery-prize-number border text-center", attrs: { "data-id": "jp_no" }, html: "----" }] },
      ];
      card = { ...card, tables: [{ ...first, rows: [...first.rows, ...jpRows] }, ...card.tables.slice(1)] };
    }
  }

  const splittable = card.id.endsWith("-6d") || card.id.startsWith("table-7-");
  if (!splittable) return { result: card };

  const resultTables: CardTable[] = [];
  const jpTables: CardTable[] = [];

  for (const table of card.tables) {
    const text = tableText(table);
    if (isWholeJpTable(text)) {
      jpTables.push(table);
      continue;
    }

    const resultRows: CardRow[] = [];
    const jpRows: CardRow[] = [];
    for (const row of table.rows) {
      const value = rowText(row);
      if (isJpRow(value)) jpRows.push(row);
      else resultRows.push(tagSixRow(row));
    }
    if (resultRows.length) resultTables.push({ ...table, rows: resultRows });
    if (jpRows.length) jpTables.push({ ...table, rows: jpRows });
  }

  const result = resultTables.length ? { ...card, tables: resultTables } : card;
  if (!jpTables.length) return { result };

  const isSports = card.id.startsWith("table-7-");
  const jpName = isSports ? "SportsToto Jackpot 多多积宝" : card.header.name.replace(/6D/, "6D JP");
  const jp: LotteryCardData = {
    ...card,
    id: card.id + "-jp",
    cardCls: card.cardCls + " six-jp",
    header: { ...card.header, name: jpName },
    tables: jpTables,
  };
  return { result, jp };
}
