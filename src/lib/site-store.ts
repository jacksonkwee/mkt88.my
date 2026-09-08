import { promises as fs } from "fs";
import path from "path";

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

export async function getSiteContent(): Promise<SiteContent> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const data = JSON.parse(raw);
    const d = DEFAULTS;
    const ads = data.ads || {};
    return {
      ...d, ...data,
      notice: { ...d.notice, ...(data.notice || {}) },
      settings: {
        ...d.settings, ...(data.settings || {}),
        logo: { ...d.settings.logo, ...((data.settings || {}).logo || {}) },
        banner: { ...d.settings.banner, ...((data.settings || {}).banner || {}) },
      },
      ads: {
        ...d.ads, ...ads,
        direct: {
          ...d.ads.direct,
          ...(ads.direct || {}),
          top: { ...d.ads.direct.top, ...((ads.direct || {}).top || {}) },
          placeholder: { ...d.ads.direct.placeholder, ...((ads.direct || {}).placeholder || {}) },
        },
      },
    };
  } catch {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
}

export async function saveSiteContent(patch: Partial<SiteContent>): Promise<SiteContent> {
  const cur = await getSiteContent();
  const ads = (patch.ads || {}) as Partial<SiteContent["ads"]>;
  const next: SiteContent = {
    ...cur, ...patch,
    notice: { ...cur.notice, ...(patch.notice || {}) },
    settings: {
      ...cur.settings, ...(patch.settings || {}),
      logo: { ...cur.settings.logo, ...((patch.settings || {}).logo || {}) },
      banner: { ...cur.settings.banner, ...((patch.settings || {}).banner || {}) },
    },
    ads: {
      ...cur.ads, ...ads,
      direct: {
        ...cur.ads.direct, ...(ads.direct || {}),
        top: { ...cur.ads.direct.top, ...((ads.direct || {}).top || {}) },
        placeholder: { ...cur.ads.direct.placeholder, ...((ads.direct || {}).placeholder || {}) },
      },
    },
  };
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(next, null, 2), "utf8");
  return next;
}
