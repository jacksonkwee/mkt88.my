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
  return h;
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
