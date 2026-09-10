// Shared client-side store for the Favourite Numbers feature.
// Kept dependency-free so both the floating tool and the app screens can use it.

export type Scope = "main" | "special" | "consolation";

export interface Fav {
  num: string;          // 4-digit string, e.g. "2609"
  scopes: Scope[];      // which prizes trigger the highlight / notification
  notify: boolean;      // send a special notification when it appears
}

export const FAV_KEY = "mkt_favs_v2";
export const LEGACY_KEY = "mkt_favs_v1";
export const FAV_EVENT = "mkt-favs-change";
export const YELLOW = "#ffe84c";
export const ALL_SCOPES: Scope[] = ["main", "special", "consolation"];

export const SCOPE_LABEL: Record<Scope, string> = {
  main: "Main 正奖",
  special: "Special 特别奖",
  consolation: "Consolation 安慰奖",
};

export function isNum(v: string): boolean {
  return /^\d{4}$/.test(v);
}

function normalize(f: Partial<Fav>): Fav | null {
  if (!f || !isNum(String(f.num))) return null;
  const scopes = Array.isArray(f.scopes)
    ? (f.scopes.filter((s) => ALL_SCOPES.includes(s as Scope)) as Scope[])
    : [];
  return {
    num: String(f.num),
    scopes: scopes.length ? scopes : [...ALL_SCOPES],
    notify: Boolean(f.notify),
  };
}

export function loadFavs(): Fav[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FAV_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(normalize).filter(Boolean) as Fav[];
    }
    // Migrate the old simple list of numbers.
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const list = JSON.parse(legacy);
      if (Array.isArray(list)) {
        const favs = list
          .map((n) => normalize({ num: String(n), scopes: ALL_SCOPES, notify: false }))
          .filter(Boolean) as Fav[];
        saveFavs(favs);
        return favs;
      }
    }
  } catch { /* ignore */ }
  return [];
}

export function saveFavs(list: Fav[]): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(FAV_KEY, JSON.stringify(list)); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent(FAV_EVENT)); } catch { /* ignore */ }
}

export function addFav(num: string, scopes: Scope[], notify = false): Fav[] {
  if (!isNum(num)) return loadFavs();
  const cur = loadFavs();
  const useScopes = scopes.length ? scopes : [...ALL_SCOPES];
  const exists = cur.some((f) => f.num === num);
  const next = exists
    ? cur.map((f) => (f.num === num ? { ...f, scopes: useScopes, notify: f.notify || notify } : f))
    : [...cur, { num, scopes: useScopes, notify }];
  saveFavs(next);
  return next;
}

export function removeFav(num: string): Fav[] {
  const next = loadFavs().filter((f) => f.num !== num);
  saveFavs(next);
  return next;
}

export function toggleFav(num: string, scopes: Scope[] = [...ALL_SCOPES]): Fav[] {
  const cur = loadFavs();
  return cur.some((f) => f.num === num) ? removeFav(num) : addFav(num, scopes);
}

export function hasFav(num: string): boolean {
  return loadFavs().some((f) => f.num === num);
}

/** Which prize bucket a rendered result number belongs to (by its data-id). */
export function cellScope(el: Element | null): Scope {
  const id = (el && el.getAttribute && el.getAttribute("data-id")) || "";
  if (id.indexOf("special-") === 0) return "special";
  if (id.indexOf("consolation-") === 0) return "consolation";
  return "main";
}

export function favMatches(f: Fav, num: string, scope: Scope): boolean {
  return f.num === num && f.scopes.includes(scope);
}
