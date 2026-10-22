import { firestoreGet, firestorePut, pushConfigured } from "./fcm";
import {
  normalizeJackpotFeed,
  parseStoredJackpotFeed,
  type JackpotFeed,
} from "./jackpot-feed";

const DOC = "state/jackpot";
const CACHE_MS = 30_000;
const MAX_AGE_MS = 20 * 60_000;

let cached: { at: number; feed: JackpotFeed | null } | null = null;

function fresh(feed: JackpotFeed | null): boolean {
  if (!feed) return false;
  const at = Date.parse(feed.receivedAt);
  return Number.isFinite(at) && Date.now() - at <= MAX_AGE_MS;
}

export async function saveJackpotFeed(value: unknown): Promise<JackpotFeed | null> {
  if (!pushConfigured()) return null;
  const feed = normalizeJackpotFeed(value, new Date().toISOString());
  if (!feed) return null;
  const saved = await firestorePut(DOC, { json: JSON.stringify(feed) });
  if (saved) cached = { at: Date.now(), feed };
  return saved ? feed : null;
}

export async function getJackpotFeed(): Promise<JackpotFeed | null> {
  if (process.env.JACKPOT_TEST_FEED_JSON) {
    return parseStoredJackpotFeed(process.env.JACKPOT_TEST_FEED_JSON);
  }
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return fresh(cached.feed) ? cached.feed : null;
  }
  if (!pushConfigured()) {
    cached = { at: Date.now(), feed: null };
    return null;
  }

  const doc = await Promise.race([
    firestoreGet<{ fields?: { json?: { stringValue?: string } } }>(DOC),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 900)),
  ]);
  const feed = parseStoredJackpotFeed(doc?.fields?.json?.stringValue);
  if (feed) {
    cached = { at: Date.now(), feed };
    return fresh(feed) ? feed : null;
  }
  if (fresh(cached?.feed || null)) {
    cached = { at: Date.now(), feed: cached?.feed || null };
    return cached.feed;
  }
  cached = { at: Date.now(), feed: null };
  return null;
}
