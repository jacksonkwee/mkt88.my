import type { CardCell, CardRow, CardTable } from "./LotteryCard";

/**
 * Reading a captured card out of a snapshot's HTML and into the card model the
 * app renders. Two captures need this - the three East games and Singapore's
 * Toto card - so the reading lives here instead of inside either of them.
 */

/** The card's own block of markup: from its opening div to its matching close. */
export function segmentOf(html: string, cls: string): string {
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

export const plain = (s: string): string =>
  s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();

export const attr = (attrs: string, name: string): string => new RegExp('\\b' + name + '="([^"]*)"').exec(attrs)?.[1] || "";

export function cellsOf(inner: string): CardCell[] {
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

export function tablesOf(seg: string): CardTable[] {
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
