import { promises as fs } from "fs";
import path from "path";
import { firestoreGet, firestorePut, pushConfigured } from "./fcm";

export interface AdUnit { enabled: boolean; image: string; link: string; }
export interface DirectAds { top: AdUnit; placeholder: { enabled: boolean; text: string; link: string }; }

export interface SiteContent {
  notice: { enabled: boolean; text: string; bg: string; color: string; fx: string };
  copyright: string;
  settings: {
    primary: string;
    fontSize: number;
    logo: { src: string; size: number };
    banner: { enabled: boolean; src: string };
  };
  ads: {
    enabled: boolean;
    client: string;
    topSlot: string;
    inContentSlot: string;
    footerSlot: string;
    direct: DirectAds;
  };
}

const FILE = path.join(process.cwd(), "data", "admin", "site.json");

/**
 * The admin settings also live in Firestore.
 *
 * They used to be written to a file next to the code, which works while the
 * site runs on a machine with a disk - but the site is served by Vercel, whose
 * deployment filesystem is read-only, so every "Save" from the admin panel
 * failed and nothing could be switched on (found 14 Oct 2026). The document is
 * the store now; the committed file is the fallback for a local run without
 * Firebase.
 */
const DOC = "config/site";

const emptyUnit = (): AdUnit => ({ enabled: false, image: "", link: "" });

export const DEFAULTS: SiteContent = {
  notice: { enabled: false, text: "", bg: "#fff3cd", color: "#664d03", fx: "none" },
  copyright: "Copyright © 2016 - 2026 mkt88.my. All Rights Reserved.",
  settings: {
    primary: "#cc0000",
    fontSize: 16,
    logo: { src: "", size: 70 },
    banner: { enabled: false, src: "" },
  },
  ads: {
    enabled: false,
    client: "",
    topSlot: "",
    inContentSlot: "",
    footerSlot: "",
    direct: { top: emptyUnit(), placeholder: { enabled: false, text: "Advertise Here — contact mkt88.my", link: "" } },
  },
};

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Fill in anything a stored copy leaves out, so old saves keep working. */
function merge(base: Partial<SiteContent>, patch: Partial<SiteContent>): SiteContent {
  const d = clone(DEFAULTS);
  const a: Partial<SiteContent["ads"]> = base.ads || {};
  const b: Partial<SiteContent["ads"]> = patch.ads || {};
  return {
    ...d, ...base, ...patch,
    copyright: patch.copyright ?? base.copyright ?? d.copyright,
    notice: { ...d.notice, ...(base.notice || {}), ...(patch.notice || {}) },
    settings: {
      ...d.settings, ...(base.settings || {}), ...(patch.settings || {}),
      logo: { ...d.settings.logo, ...((base.settings || {}).logo || {}), ...((patch.settings || {}).logo || {}) },
      banner: { ...d.settings.banner, ...((base.settings || {}).banner || {}), ...((patch.settings || {}).banner || {}) },
    },
    ads: {
      ...d.ads, ...a, ...b,
      direct: {
        ...d.ads.direct, ...(a.direct || {}), ...(b.direct || {}),
        top: { ...d.ads.direct.top, ...((a.direct || {}).top || {}), ...((b.direct || {}).top || {}) },
        placeholder: { ...d.ads.direct.placeholder, ...((a.direct || {}).placeholder || {}), ...((b.direct || {}).placeholder || {}) },
      },
    },
  };
}

async function readRemote(): Promise<Partial<SiteContent> | null> {
  if (!pushConfigured()) return null;
  const doc = await firestoreGet<{ fields?: { json?: { stringValue?: string } } }>(DOC);
  const raw = doc?.fields?.json?.stringValue;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Partial<SiteContent>;
  } catch {
    return null;
  }
}

async function writeRemote(next: SiteContent): Promise<boolean> {
  if (!pushConfigured()) return false;
  return firestorePut(DOC, { json: JSON.stringify(next) });
}

export async function getSiteContent(): Promise<SiteContent> {
  const remote = await readRemote();
  if (remote) return merge(remote, {});
  try {
    const data = JSON.parse(await fs.readFile(FILE, "utf8")) as Partial<SiteContent>;
    return merge(data, {});
  } catch {
    return clone(DEFAULTS);
  }
}

export async function saveSiteContent(patch: Partial<SiteContent>): Promise<SiteContent> {
  const cur = await getSiteContent();
  const next = merge(cur, patch);
  if (await writeRemote(next)) return next;
  // No Firebase here (a local run) - the committed file is still the store.
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(next, null, 2), "utf8");
  return next;
}
