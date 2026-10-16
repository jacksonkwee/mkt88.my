import { toSimplified } from "../../../../lib/zh-simplified";

export const ASSET_BASE = "/sites/live4dresult-net-0600c55d/root-8a5edab2";

const HOST = "https://live4dresult.net";

const HOST_WWW = "https://www.live4dresult.net";

/** Convert a same-site absolute/relative URL into a local asset URL. */
export function toLocal(src: string): string {
  if (!src) return src;
  if (src.startsWith(HOST)) return ASSET_BASE + src.slice(HOST.length);
  if (src.startsWith("//")) return "https:" + src;
  if (src.startsWith("/") && !src.startsWith("/sites/")) return ASSET_BASE + src;
  return src;
}

/**
 * Rewrite captured HTML for safe local rendering:
 * - point same-site images at the local asset namespace,
 * - neutralise same-site page links (those pages are out of clone scope),
 * - leave external links untouched.
 * - the operators write their tables in Traditional Chinese, so the text is
 *   passed through toSimplified on the way out.
 */
export function rewriteHtml(html: string): string {
  let h = html.replace(new RegExp(HOST.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "");
  h = h.replace(new RegExp(HOST_WWW.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "");
  h = h.replace(/(src=")(\/[^"]*)/g, (_m, p: string, path: string) =>
    p + (path.startsWith("/sites/") ? path : ASSET_BASE + path)
  );
  h = h.replace(/(href=")\/[^"]*"/g, 'href="#"');
  h = h.replace(/(this\.src=')(\/[^']*)/g, (_m, p: string, path2: string) =>
    p + (path2.startsWith("/sites/") ? path2 : ASSET_BASE + path2)
  );
  /*
   * Captured markup carries images with no alt at all - the SportsToto zodiac
   * animal was the one left (measured 14 Oct 2026). They sit beside their own
   * text label, so an empty alt is the right treatment: it keeps them out of
   * the screen reader's way without hiding anything a reader needs.
   */
  h = h.replace(/<img\b(?![^>]*\salt=)/gi, '<img alt=""');
  return toSimplified(h);
}

/** Parse a CSS inline-style string into a React style object. */
export function parseInlineStyle(style: string): React.CSSProperties | undefined {
  if (!style) return undefined;
  const out: Record<string, string> = {};
  for (const part of style.split(";")) {
    const idx = part.indexOf(":");
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      if (k && v) {
        const camel = k.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
        out[camel] = v;
      }
    }
  }
  return out as React.CSSProperties;
}



/**
 * Give Sabah 88's Lotto boards cards of their own.
 *
 * The source hands one card over carrying four boards - 4D, Lotto 6/45, Lotto 5
 * and Lotto 6 - stacked inside the same block, which is why they read as one
 * very long card. The owner asked for them as separate cards (16 Oct 2026, the
 * A treatment: amber top edge, rounded corner), which they get for free once
 * each board sits in its own `.card.outer-box`.
 *
 * The boundaries are inserted rather than the HTML being rebuilt, and they are
 * siblings, not nested: the Lotto card's opening tags are placed before each
 * board's first table and the block's own closing tags close the last one. So
 * the four cards end up level with each other, and no card sits inside a card.
 *
 * The new wrapper deliberately does not reuse `table-10`. The phone's writers
 * and the source shape-checks both select `.card.outer-box.table-10`, and a
 * second card carrying that class would be handed 4D numbers.
 */
export function splitLottoCards(html: string): string {
  // Only the Sabah 88 card carries these boards; every other page is returned
  // untouched.
  if (!html || html.indexOf("Lotto 6/45") < 0) return html;
  const open = '</div></div><div class="card outer-box table-10-lotto"><div class="card-body p-2">';
  // "Lotto 6" must not match the "6" of "Lotto 6/45", hence the lookaheads.
  const labels = [/Lotto 6\/45/, /Lotto 5(?!\d)/, /Lotto 6(?![\d/])/];
  let out = html;
  for (const label of labels) {
    const hit = label.exec(out);
    if (!hit) continue;
    const table = out.lastIndexOf("<table", hit.index);
    if (table < 0) continue;
    out = out.slice(0, table) + open + out.slice(table);
  }
  return out;
}

/** Remove Advanced-Ads placeholder blocks (e.g. the 'Advertisements' label boxes). */
export function stripAdHtml(html: string): string {
  let h = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  const candidates = [
    /<div class="my-3 text-center">/gi,
    /<div style="margin: 20px 0">/gi,
    /<div style='margin: 20px 0'>/gi,
  ];
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 200) {
    changed = false;
    for (const re of candidates) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(h))) {
        // only remove ad-looking containers (they contain adsbygoogle or the label)
        const tail = h.slice(m.index, Math.min(h.length, m.index + 6000));
        if (!/adsbygoogle|Advertisements/i.test(tail)) continue;
        let i = m.index + m[0].length;
        const len = h.length;
        let depth = 1;
        while (i < len && depth > 0) {
          const open = h.indexOf("<div", i);
          const close = h.indexOf("</div>", i);
          if (open === -1 && close === -1) break;
          if (close === -1 || (open !== -1 && open < close)) { depth++; i = open + 4; }
          else { depth--; i = close + 6; }
        }
        h = h.slice(0, m.index) + h.slice(i);
        changed = true;
        re.lastIndex = m.index;
        break;
      }
      if (changed) break;
    }
  }
  h = h.replace(/<ins class="adsbygoogle"[^>]*>[\s\S]*?<\/ins>/gi, "");
  h = h.replace(/Advertisements/g, "");
  return h;
}
