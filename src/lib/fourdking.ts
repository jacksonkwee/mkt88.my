import { io } from "socket.io-client";

type JsonObject = Record<string, unknown>;
export type FourDKingSnapshot = {
  at: number;
  gd: JsonObject | null;
  gd6: JsonObject | null;
};

const URL = "wss://socket.4dking.live:8442";
const CACHE_MS = 10 * 60 * 1000;
let cache: FourDKingSnapshot | null = null;
let inflight: Promise<FourDKingSnapshot | null> | null = null;

const isObject = (value: unknown): value is JsonObject =>
  !!value && typeof value === "object" && !Array.isArray(value);

function firstObject(value: unknown): JsonObject | null {
  if (isObject(value)) return value;
  if (!Array.isArray(value)) return null;
  return value.find(isObject) || null;
}

function applyResult(message: unknown, state: Omit<FourDKingSnapshot, "at">): boolean {
  let body = message;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return false;
    }
  }
  if (Array.isArray(message)) body = { data: message };
  if (!isObject(body)) return false;

  let changed = false;
  const entries = Array.isArray(body.data) ? body.data : [];
  for (const entry of entries) {
    if (!isObject(entry)) continue;
    if (entry.type === "GD" && isObject(entry.fdData)) {
      state.gd = { ...(state.gd || {}), ...entry.fdData };
      changed = true;
    }
    if (entry.type === "GD" || entry.type === "GD6D") {
      const six = firstObject(entry.jpData1);
      if (six) {
        state.gd6 = { ...(state.gd6 || {}), ...six };
        changed = true;
      }
    }
  }

  if (body.a === "u" && body.t === "GD" && isObject(body.fdData)) {
    state.gd = { ...(state.gd || {}), ...body.fdData };
    changed = true;
  }
  if (body.a === "uj1") {
    const six = firstObject(body.jpData1);
    if (six) {
      state.gd6 = { ...(state.gd6 || {}), ...six };
      changed = true;
    }
  }
  return changed;
}

async function readHttpFallback(state: Omit<FourDKingSnapshot, "at">): Promise<boolean> {
  try {
    const response = await fetch("https://mapp.4dking.live/nocache/result_v23.json", {
      headers: { "user-agent": "Mozilla/5.0", accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(1800),
    });
    if (!response.ok) return false;
    return applyResult(await response.json(), state);
  } catch {
    return false;
  }
}

/**
 * Read 4dking's public Grand Dragon feed.
 *
 * The first `results` packet carries the current GD and GD6D boards. Later
 * packets are partial updates, so the socket is kept only for this bounded
 * read and its result is returned as one immutable snapshot.
 */
export async function getFourDKingSnapshot(waitMs = 1800): Promise<FourDKingSnapshot | null> {
  if (cache && Date.now() - cache.at < 1000) return cache;
  if (inflight) return inflight;

  inflight = new Promise<FourDKingSnapshot | null>((resolve) => {
    const recent = cache && Date.now() - cache.at < CACHE_MS ? cache : null;
    const state: Omit<FourDKingSnapshot, "at"> = {
      gd: recent?.gd ? { ...recent.gd } : null,
      gd6: recent?.gd6 ? { ...recent.gd6 } : null,
    };
    const socket = io(URL, {
      transports: ["websocket"],
      reconnection: false,
      timeout: waitMs,
    });
    let done = false;
    let quiet: ReturnType<typeof setTimeout> | null = null;

    const finish = (value: FourDKingSnapshot | null) => {
      if (done) return;
      done = true;
      if (quiet) clearTimeout(quiet);
      clearTimeout(timer);
      socket.removeAllListeners();
      socket.close();
      if (value) cache = value;
      resolve(value);
    };

    const timer = setTimeout(() => {
      void (async () => {
        if (!state.gd || !state.gd6) await readHttpFallback(state);
        finish(state.gd || state.gd6 ? { ...state, at: Date.now() } : null);
      })();
    }, waitMs);

    socket.on("connect", () => {
      socket.emit("channel", "GD");
      socket.emit("channel", "GDJP1");
    });
    socket.on("results", (message) => {
      if (!applyResult(message, state)) return;
      if (quiet) clearTimeout(quiet);
      quiet = setTimeout(() => finish({ ...state, at: Date.now() }), 80);
    });
    socket.on("connect_error", () => {
      void (async () => {
        await readHttpFallback(state);
        finish(state.gd || state.gd6 ? { ...state, at: Date.now() } : recent ? { ...recent, at: Date.now() } : null);
      })();
    });
  });

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}
