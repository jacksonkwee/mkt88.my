export type JackpotOperator = {
  status?: number;
  jp1?: string;
  jp2?: string;
  jp3d?: string;
  gold1?: string;
  gold2?: string;
  denied?: boolean;
  err?: string;
};

export type JackpotFeed = {
  receivedAt: string;
  magnum: JackpotOperator;
  damacai: JackpotOperator;
  sportstoto: JackpotOperator;
};

export type JackpotCardFields = Record<"table-1" | "table-4" | "table-6", Record<string, string>>;

function amount(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const n = Number(String(value).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return "RM " + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function operator(value: unknown): JackpotOperator {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;
  return {
    ...(Number.isFinite(Number(source.status)) ? { status: Number(source.status) } : {}),
    ...(amount(source.jp1) ? { jp1: amount(source.jp1) } : {}),
    ...(amount(source.jp2) ? { jp2: amount(source.jp2) } : {}),
    ...(amount(source.jp3d) ? { jp3d: amount(source.jp3d) } : {}),
    ...(amount(source.gold1) ? { gold1: amount(source.gold1) } : {}),
    ...(amount(source.gold2) ? { gold2: amount(source.gold2) } : {}),
    ...(source.denied === true ? { denied: true } : {}),
    ...(typeof source.err === "string" && source.err ? { err: source.err.slice(0, 240) } : {}),
  };
}

/** Accept the exact one-line JSON produced by the VPS capture script. */
export function normalizeJackpotFeed(value: unknown, receivedAt?: string): JackpotFeed | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const magnum = operator(raw.magnum);
  const damacai = operator(raw.damacai);
  const sportstoto = operator(raw.sportstoto);
  if (!magnum.jp1 || !magnum.jp2 || !damacai.jp1 || !damacai.jp2) return null;
  const embedded = typeof raw.receivedAt === "string" && Number.isFinite(Date.parse(raw.receivedAt))
    ? raw.receivedAt
    : undefined;
  return { receivedAt: receivedAt || embedded || new Date().toISOString(), magnum, damacai, sportstoto };
}

export function parseStoredJackpotFeed(raw: string | null | undefined): JackpotFeed | null {
  if (!raw) return null;
  try {
    return normalizeJackpotFeed(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * The fields the Magnum and Da Ma Cai cards already render.
 *
 * Missing or stale values are deliberately written as "----". The page hides
 * captured jackpot amounts until its first live snapshot lands; this makes the
 * first snapshot clear an old captured figure instead of revealing it again.
 */
export function jackpotCardFields(feed: JackpotFeed | null): JackpotCardFields {
  return {
    "table-1": {
      first_jackpot_prize: feed?.magnum.jp1 || "----",
      first_jackpot_status: "",
      second_jackpot_prize: feed?.magnum.jp2 || "----",
      second_jackpot_status: "",
    },
    "table-4": {
      first_jackpot_prize: feed?.damacai.jp1 || "----",
      first_jackpot_status: "",
      second_jackpot_prize: feed?.damacai.jp2 || "----",
      second_jackpot_status: "",
      third_jackpot_prize: feed?.damacai.jp3d || "----",
      third_jackpot_status: "",
    },
    "table-6": {
      first_jackpot_prize: feed?.sportstoto.jp1 || "----",
      first_jackpot_status: "",
      second_jackpot_prize: feed?.sportstoto.jp2 || "----",
      second_jackpot_status: "",
    },
  };
}
