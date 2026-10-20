import cardsRaw from "../components/sites/mkt88/app/cards-data.json";
import lottoRaw from "../components/sites/mkt88/app/lotto-data.json";
import { EAST_CARDS } from "../components/sites/mkt88/app/east-cards";
import { SG_CARDS } from "../components/sites/mkt88/app/sg-cards";

type Card = {
  cardCls: string;
  tables: {
    rows: {
      cells: {
        attrs?: Record<string, string>;
        html?: string;
      }[];
    }[];
  }[];
};

const cards = [
  ...(cardsRaw as unknown as { cards: Card[] }).cards,
  ...(lottoRaw as unknown as { cards: Card[] }).cards,
  ...(EAST_CARDS as unknown as Card[]),
  ...(SG_CARDS as unknown as Card[]),
];

function idsOf(card: Card): string[] {
  const out: string[] = [];
  for (const table of card.tables || []) {
    for (const row of table.rows || []) {
      for (const cell of row.cells || []) {
        const id = cell.attrs?.["data-id"];
        if (id) out.push(id);
        for (const match of String(cell.html || "").matchAll(/data-id\s*=\s*["']([^"']+)["']/gi)) {
          out.push(match[1]);
        }
      }
    }
  }
  return out;
}

const BOUND_IDS: Record<string, Set<string>> = {};
for (const card of cards) {
  const cls = /\b(table-\d+(?:-[a-z0-9]+)*)\b/i.exec(card.cardCls || "")?.[1];
  if (!cls) continue;
  const set = BOUND_IDS[cls] || (BOUND_IDS[cls] = new Set<string>());
  for (const id of idsOf(card)) set.add(id);
}
// Sabah 88's four cards share one live payload: the 4D card receives the
// Lotto ids too, and the split Lotto cards receive the 4D ids. Accept the
// union so the contract checks bindings without forcing four payload copies.
if (BOUND_IDS["table-10"] || BOUND_IDS["table-10-lotto"]) {
  const sabah = new Set([
    ...(BOUND_IDS["table-10"] || []),
    ...(BOUND_IDS["table-10-lotto"] || []),
  ]);
  BOUND_IDS["table-10"] = sabah;
  BOUND_IDS["table-10-lotto"] = sabah;
}

function isBound(cls: string, key: string): boolean {
  const ids = BOUND_IDS[cls];
  if (!ids) return false;
  if (key === "date" || key === "draw_no" || key.startsWith("__")) return true;
  if (ids.has(key)) return true;
  // East cards expose the same grids through the ids their captured page uses.
  const grid = /^(special|consolation)-(\d+)$/.exec(key);
  if (grid && ids.has(grid[1] + "_number_" + grid[2])) return true;
  const capturedGrid = /^(special|consolation)_number_(\d+)$/.exec(key);
  return !!capturedGrid && ids.has(capturedGrid[1] + "-" + capturedGrid[2]);
}

/**
 * Refuse a snapshot whose non-empty values have no cell on the rendered card.
 *
 * Source-health checks prove a feed has the right shape; this proves the card
 * actually reads that shape. Without it, a renamed data-id silently turns a
 * perfectly valid result into "----".
 */
export function assertCardBindings(cardMap: Record<string, Record<string, string>>): void {
  const problems: string[] = [];
  for (const [cls, values] of Object.entries(cardMap)) {
    if (!BOUND_IDS[cls]) {
      problems.push(cls + ": no rendered card");
      continue;
    }
    for (const [key, value] of Object.entries(values)) {
      if (!value || /^----+$/.test(String(value).trim()) || isBound(cls, key)) continue;
      problems.push(cls + ": " + key + "=" + value + " has no data-id");
    }
  }
  if (problems.length) {
    throw new Error("Live card field contract failed:\n" + problems.join("\n"));
  }
}
