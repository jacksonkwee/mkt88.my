import { NextResponse } from "next/server";

/**
 * Warmed snapshot of the live result cards.
 * One (server-cached, self-refreshing) request feeds every card on the home /
 * game pages, so the results appear immediately instead of waiting for the
 * 8 separate upstream pages the client used to fetch.
 */
export const dynamic = "force-dynamic";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const TTL = 8000;

type CardMap = Record<string, Record<string, string>>;
type Resp = { at: number; cards: CardMap };

let cache: { at: number; data: Resp } | null = null;
let warmer: ReturnType<typeof setInterval> | null = null;

async function get(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "*/*" }, cache: "no-store", signal: AbortSignal.timeout(12000) });
    return res.ok ? await res.text() : "";
  } catch { return ""; }
}

function clean(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
}

/** Group every result card of a page by its table class: { "table-1": { first_prize: "2609", ... } } */
function parseCards(html: string): CardMap {
  const out: CardMap = {};
  if (!html) return out;
  const starts: { cls: string; i: number }[] = [];
  const re = /class="card outer-box (table-[0-9][^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) starts.push({ cls: m[1], i: m.index });
  for (let k = 0; k < starts.length; k++) {
    const seg = html.slice(starts[k].i, k + 1 < starts.length ? starts[k + 1].i : html.length);
    const vals: Record<string, string> = {};
    const elRe = /<(td|span|div)\b[^>]*data-id="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/gi;
    let e: RegExpExecArray | null;
    while ((e = elRe.exec(seg))) {
      const id = e[2];
      const val = clean(e[3]);
      if (id && val !== undefined) vals[id] = val;
    }
    if (Object.keys(vals).length) out[starts[k].cls] = { ...(out[starts[k].cls] || {}), ...vals };
  }
  return out;
}

async function build(): Promise<Resp> {
  const [home, east] = await Promise.all([
    get("https://live4dresult.net/"),
    get("https://live4dresult.net/sabah-sarawak-4d-results/"),
  ]);
  const cards: CardMap = { ...parseCards(east), ...parseCards(home) };
  const data: Resp = { at: Date.now(), cards };
  cache = { at: Date.now(), data };
  return data;
}

function startWarmer() {
  if (warmer) return;
  warmer = setInterval(() => { void build(); }, TTL);
  (warmer as unknown as { unref?: () => void }).unref?.();
}

export async function GET() {
  if (cache && Date.now() - cache.at < TTL) {
    startWarmer();
    return NextResponse.json(cache.data, { headers: { "cache-control": "no-store" } });
  }
  const data = await build();
  startWarmer();
  return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
}
