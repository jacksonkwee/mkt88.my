import { firestoreGet, firestorePut, pushConfigured } from "./fcm";

export const SG_GUARD_DOC = "state/sg4d";
const SG_RELAY_SECRET_DOC = "config/sg-relay";
const SG_RELAY_CACHE_MS = 5 * 60 * 1000;

type FirestoreJson = { fields?: { json?: { stringValue?: string } } };
type SgFeed = {
  result?: {
    comp?: string;
    date?: string;
    flag?: string;
    n?: { i?: string; p?: string; z?: string }[];
  };
};

let relaySecret: { value: string; at: number } | null = null;

function fourDigits(value: unknown): string | null {
  const text = String(value || "").trim();
  return /^\d{4}$/.test(text) ? text : null;
}
const isDash = (value?: string): boolean => !value || /^----+$/.test(value.trim());

function singaporeToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function prettyDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}-${year} (${weekday})`;
}

/** Turn the operator's jLive payload into the exact keys table-11 reads. */
export function normalizeSgLiveFeed(input: unknown): Record<string, string> | null {
  const result = (input as SgFeed | null)?.result;
  if (!result || result.comp !== "SG4D") return null;

  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(String(result.date || ""));
  if (!match) return null;
  const iso = `${match[1]}-${match[2]}-${match[3]}`;
  if (iso > singaporeToday()) return null;

  const values: Record<string, string> = {};
  for (const item of Array.isArray(result.n) ? result.n : []) {
    const number = fourDigits(item?.i);
    if (!number) continue;
    const prize = String(item.p || "");
    const group = String(item.z || "").toUpperCase();
    if (/^[123]$/.test(prize)) values[prize] = number;
    else if (/^S\d+$/.test(group)) values["S" + Number(group.slice(1))] = number;
    else if (/^C\d+$/.test(group)) values["C" + Number(group.slice(1))] = number;
  }

  const first = values["1"] || fourDigits(result.flag) || "";
  const hasLiveNumber = !!first || Object.keys(values).some((key) => key.startsWith("S"));
  if (!hasLiveNumber) return null;

  return {
    date: prettyDate(iso),
    first_prize: first || "----",
    second_prize: values["2"] || "----",
    third_prize: values["3"] || "----",
    ...Object.fromEntries(Array.from({ length: 15 }, (_, i) => ["special-" + (i + 1), values["S" + (i + 1)] || "----"])),
    ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => ["consolation-" + (i + 1), values["C" + (i + 1)] || "----"])),
  };
}

function drawDay(board: Record<string, string>): number {
  const match = /(\d{2})-(\d{2})-(\d{4})/.exec(board.date || "");
  return match ? Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])) : 0;
}

function sameBoard(a: Record<string, string> | null, b: Record<string, string>): boolean {
  if (!a) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => (a[key] || "") === (b[key] || ""));
}

function mergeSameDay(current: Record<string, string>, incoming: Record<string, string>): Record<string, string> {
  const merged = { ...current };
  for (const [key, value] of Object.entries(incoming)) {
    if (!value) continue;
    if (isDash(value) && !isDash(merged[key])) continue;
    merged[key] = value;
  }
  return merged;
}

async function readBoard(): Promise<Record<string, string> | null> {
  const doc = await firestoreGet<FirestoreJson>(SG_GUARD_DOC);
  const raw = doc?.fields?.json?.stringValue;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return drawDay(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** The relay token can live in Vercel env vars or in a server-only Firestore document. */
export async function sgRelayToken(): Promise<string | null> {
  const fromEnv = (process.env.SG_INGEST_SECRET || "").trim();
  if (fromEnv) return fromEnv;
  if (relaySecret && Date.now() - relaySecret.at < SG_RELAY_CACHE_MS) return relaySecret.value;
  if (!pushConfigured()) return null;

  const doc = await firestoreGet<{ fields?: { token?: { stringValue?: string } } }>(SG_RELAY_SECRET_DOC);
  const token = (doc?.fields?.token?.stringValue || "").trim();
  if (!token) return null;
  relaySecret = { value: token, at: Date.now() };
  return token;
}

/**
 * Save the live feed without ever letting a partial update erase a number that
 * was already seen. Firestore is shared by every Vercel instance.
 */
export async function saveSgLiveFeed(input: unknown): Promise<
  { ok: true; board: Record<string, string>; changed: boolean } |
  { ok: false; status: 400 | 409 | 503; error: string }
> {
  const incoming = normalizeSgLiveFeed(input);
  if (!incoming) return { ok: false, status: 400, error: "invalid or stale SG4D payload" };
  if (!pushConfigured()) return { ok: false, status: 503, error: "Firestore is not configured" };

  const current = await readBoard();
  if (current && drawDay(current) > drawDay(incoming)) {
    return { ok: false, status: 409, error: "a newer SG4D board is already stored" };
  }

  const board = current && drawDay(current) === drawDay(incoming)
    ? mergeSameDay(current, incoming)
    : incoming;
  if (sameBoard(current, board)) return { ok: true, board, changed: false };

  const saved = await firestorePut(SG_GUARD_DOC, {
    json: JSON.stringify(board),
    received_at: new Date().toISOString(),
    source: "vps-live4d-sg",
  });
  if (!saved) return { ok: false, status: 503, error: "Firestore save failed" };
  return { ok: true, board, changed: true };
}
