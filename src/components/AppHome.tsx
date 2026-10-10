"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GAME_DEFS, EAST_LINKS } from "./sites/live4dresult-net-0600c55d/root-8a5edab2/GameDefs";
import { isCapacitorApp } from "../lib/is-capacitor-app";
import { GearSix } from "@phosphor-icons/react";

/** Icons cropped from the artwork supplied for the app home screen. */
const HOME = "/sites/live4dresult-net-0600c55d/root-8a5edab2/app-home";
const SG_LOGO = "/sites/live4dresult-net-0600c55d/root-8a5edab2/logo_singapore4d.png";
/** The brand logo, at the top of the first page. */
const MKT_LOGO = "/sites/live4dresult-net-0600c55d/root-8a5edab2/logo-mkt88.webp?v=4";
const PLAY_URL = "https://play.google.com/store/apps/details?id=com.mkt88.app";

/** Same order the swipe strip uses. */
const GAME_ORDER = [
  "magnum", "damacai", "sportstoto", "sg", "sabah88", "cashsweep",
  "sandakan", "grand-dragon", "nine-lotto", "perdana", "lucky-harihari",
];

type Tile = { href: string; logo: string; name: string; zh?: string; lucky?: boolean; settings?: boolean };

/* Design tokens for the app first page.
 *
 * Radius rule: every tile and button uses RADIUS. The Settings on/off switch is
 * the only full-pill control and the result tables stay square - one documented
 * rule, applied everywhere, instead of a different radius per component.
 * Colour rule: one accent (the brand red) over off-white surfaces. No pure black
 * and no pure-white page background.
 */
const RADIUS = 12;
const PAGE_BG = "#f6f7f9";
const SURFACE = "#ffffff";
const BORDER = "#e6e8eb";
const INK = "#16181d";
const INK_MUTED = "#5b6470";
const ACCENT = "#cc0000"; // the brand red

const TILE: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
  gap: 3, padding: "7px 6px", minHeight: 78, borderRadius: RADIUS, border: "1px solid " + BORDER,
  background: SURFACE, boxShadow: "0 1px 2px rgba(22,24,29,0.06)", textDecoration: "none",
  color: INK, textAlign: "center", WebkitTapHighlightColor: "transparent",
};

const ICON_BOX: React.CSSProperties = {
  width: "100%", height: 44, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto",
};

const NAME: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: INK, lineHeight: 1.15 };
const SUB: React.CSSProperties = { fontSize: 11, color: INK_MUTED, lineHeight: 1.15 };

/**
 * Runs before the browser paints on the client and does nothing on the server.
 * The body classes that hide the site behind the first page must be back in
 * place in the same frame as hydration, or the app would flash the results.
 */
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function luckyNumber(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

/**
 * Internal links go through next/link so tapping a game is a client-side
 * navigation. A plain <a> reloads the whole page, which re-mounted the root
 * layout and threw the user straight back onto this screen instead of the game
 * they picked.
 */
function Nav({ href, onClick, children }: { href: string; onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void; children: React.ReactNode }) {
  if (href.startsWith("/")) {
    return <Link href={href} prefetch={false} className="mkt-press" style={TILE} onClick={onClick}>{children}</Link>;
  }
  // onClick must be attached here too: the Lucky Numbers tile points at "#",
  // so it takes this branch - and its handler was being dropped, which made the
  // tile do nothing at all.
  return <a href={href} target="_blank" rel="noreferrer" className="mkt-press" style={TILE} onClick={onClick}>{children}</a>;
}

/** Shown once per app launch, not on every page load. */
const SEEN_KEY = "mkt_app_home_shown";

const HOME_OPEN_CLASS = "mkt-home-open";

/** Keep-screen-on preference. Default is ON. */
const WAKE_KEY = "mkt_keep_screen_on";

/** Live-draw knock sound. Default ON, switchable in Settings. */
export const LIVE_SOUND_KEY = "mkt_live_sound";

type WakeLockSentinelLike = { release: () => Promise<void>; released?: boolean };
type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

/**
 * The app's first screen: a tile grid of the 11 games plus the shortcuts people
 * actually use, shown when the app opens. Website visitors never see it - it is
 * gated on the Android user agent, so the site stays exactly as it was.
 */
export default function AppHome({ initialOpen = false }: { initialOpen?: boolean }) {
  // The first page must be in the server-rendered HTML, not added after the
  // page loads: otherwise the results page paints first and the user sees it
  // for a moment before this screen appears. The layout knows from the
  // request whether this is the app, so it tells us to start open.
  // The overlay's markup is always rendered now, so the server and the client
  // agree on the HTML and the page can be cached; only the body classes decide
  // whether it is actually shown, and those are set for the app before paint.
  const [open, setOpen] = useState(() => initialOpen || isCapacitorApp());
  const [lucky, setLucky] = useState<string | null>(null);
  const [specialDraw, setSpecialDraw] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [keepOn, setKeepOn] = useState(true);
  const [soundOn, setSoundOn] = useState(true);

  /*
   * The 恭喜发财 reminders open the app at /?lucky=<number>, so the popup is
   * already showing the same number when someone arrives from the lock screen.
   * The flag is cleared straight away so a later refresh does not pop it up
   * again.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    if (!p.has("lucky")) return;
    // A reminder carries its own number (/?lucky=1236) so the popup repeats what
    // the user saw; the bare old flag (/?lucky=1) still draws a fresh number.
    const sent = (p.get("lucky") || "").trim();
    setLucky(/^\d{4}$/.test(sent) ? sent : luckyNumber());
    p.delete("lucky");
    const q = p.toString();
    window.history.replaceState(null, "", window.location.pathname + (q ? "?" + q : ""));
  }, []);
  /*
   * Special draw days: opening the app on one of these dates shows the same
   * words the phone reminder carries. Every open that day, as agreed.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());
    if (today === "2026-10-27" || today === "2026-12-29") setSpecialDraw(true);
  }, []);

  const lockRef = useRef<WakeLockSentinelLike | null>(null);

  const pathname = usePathname();
  /** The route the first page is waiting for, so the site stays hidden until it arrives. */
  const pendingNav = useRef<string | null>(null);

  /**
   * Tapping a tile must not show the results page on the way there. The site
   * stays hidden until the route has actually changed, and only then is the
   * first page dismissed - so the page you picked appears directly.
   */
  useEffect(() => {
    if (!open || !pendingNav.current) return;
    if (pathname !== pendingNav.current) {
      pendingNav.current = null;
      setOpen(false);
    }
  }, [pathname, open]);

  /** Close the first page now, or hold it until a different page is ready. */
  const openPage = (href: string) => {
    const path = href.split("?")[0];
    if (path.startsWith("/") && path !== pathname) {
      pendingNav.current = pathname || "/";
      return;
    }
    setOpen(false);
  };

  // Load the saved preferences (both default ON).
  useEffect(() => {
    try {
      if (localStorage.getItem(WAKE_KEY) === "0") setKeepOn(false);
      if (localStorage.getItem(LIVE_SOUND_KEY) === "0") setSoundOn(false);
    } catch { /* private mode - keep the default */ }
  }, []);

  /**
   * Hold a screen wake lock while the preference is on.
   *
   * The native app used to force the screen on with no say for the user; this
   * makes it their choice, and it works on the website too. Browsers drop the
   * lock whenever the page is hidden, so it is re-requested on the way back.
   */
  useEffect(() => {
    const nav = navigator as NavigatorWithWakeLock;
    const acquire = async () => {
      if (!keepOn || !nav.wakeLock) return;
      try {
        if (!lockRef.current || lockRef.current.released) {
          lockRef.current = await nav.wakeLock.request("screen");
        }
      } catch { /* unsupported or denied - the app still works */ }
    };
    const onVis = () => { if (keepOn && document.visibilityState === "visible") void acquire(); };

    if (keepOn) {
      void acquire();
      document.addEventListener("visibilitychange", onVis);
    } else if (lockRef.current) {
      const lock = lockRef.current;
      lockRef.current = null;
      void lock.release().catch(() => {});
    }

    return () => document.removeEventListener("visibilitychange", onVis);
  }, [keepOn]);

  const setKeepScreenOn = (on: boolean) => {
    setKeepOn(on);
    try { localStorage.setItem(WAKE_KEY, on ? "1" : "0"); } catch { /* ignore */ }
  };

  const setLiveSound = (on: boolean) => {
    setSoundOn(on);
    try { localStorage.setItem(LIVE_SOUND_KEY, on ? "1" : "0"); } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!isCapacitorApp()) return;
    // Remember that this launch already showed the home screen. Without it,
    // every page load inside the app re-opened it - so tapping a game looked
    // like the app jumping back to the first page.
    try {
      if (sessionStorage.getItem(SEEN_KEY)) return;
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch { /* private mode - just show it */ }
    setOpen(true);
  }, []);

  // The header logo asks for this screen back, so tapping MKT 發發 on any
  // results page returns to the first page.
  useEffect(() => {
    const onHome = () => setOpen(true);
    window.addEventListener("mkt-home", onHome);
    return () => window.removeEventListener("mkt-home", onHome);
  }, []);

  /**
   * Hide the whole site while the first page is open. It is an overlay, and on
   * phones where the ad banner pads the WebView the fixed layer does not cover
   * that strip - so the results page showed through at the bottom.
   */
  useIsoLayoutEffect(() => {
    // These classes are what hide the site behind the first page (globals.css).
    // The boot script puts them on <body> before the first paint; this keeps
    // them in step afterwards, and puts them back if React rewrites the class
    // list while hydrating.
    const app = isCapacitorApp();
    document.body.classList.toggle("mkt-in-app", app);
    document.body.classList.toggle(HOME_OPEN_CLASS, app && open);
    document.body.style.background = app && open ? "#fff" : "";
    return () => {
      if (app) document.body.classList.remove(HOME_OPEN_CLASS);
      document.body.style.background = "";
    };
  }, [open]);

  const defs = Object.fromEntries(GAME_DEFS.map((g) => [g.slug, g]));
  const east = Object.fromEntries(EAST_LINKS.map((g) => [g.slug, g]));

  const games: Tile[] = GAME_ORDER.map((slug) => {
    if (slug === "sg") return { href: "/singapore-4d-results", logo: SG_LOGO, name: "Singapore", zh: "新加坡" };
    if (slug === "sandakan") {
      const e = east.stc;
      return { href: e.href, logo: e.logo, name: "Sandakan", zh: e.zh };
    }
    const d = defs[slug];
    if (d) {
      const name = d.name.replace(/\s+4D$/, "");
      return { href: "/result/" + d.slug, logo: d.logo, name, zh: d.zh };
    }
    const e = east[slug];
    if (e) return { href: e.href, logo: e.logo, name: e.name.replace(/\s+4D$/, ""), zh: e.zh };
    return { href: "#", logo: "", name: slug };
  });

  const actions: Tile[] = [
    { href: "/favourites", logo: HOME + "/favourite.png?v=2", name: "Favourite Numbers", zh: "收藏号码" },
    { href: "/dabogong", logo: HOME + "/dabogong.png?v=2", name: "大伯公", zh: "千字图" },
    { href: "/number-history", logo: HOME + "/number-history.svg?v=1", name: "Number History", zh: "开彩记录" },
    { href: "/statistics", logo: HOME + "/hot-numbers.svg?v=1", name: "Hot Numbers", zh: "热门号码" },
    { href: PLAY_URL, logo: HOME + "/rate-us.png?v=2", name: "Rate us", zh: "评分" },
    { href: "#", logo: "", name: "Settings", zh: "设置", settings: true },
    // The icon artwork already reads 恭喜发财, so no second Chinese label here.
    { href: "#", logo: HOME + "/gongxi.png?v=2", name: "Lucky Numbers", lucky: true },
  ];

  return (
    <div className="mkt-app-home" style={{ position: "fixed", inset: 0, zIndex: 100050, background: PAGE_BG, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "10px 10px 14px" }}>
        {/* Brand logo, top of the first page. */}
        <div style={{ display: "flex", justifyContent: "center", padding: "2px 0 10px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MKT_LOGO} alt="MKT 發發" style={{ height: 56, width: "auto", maxWidth: "78%", display: "block" }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
          {games.map((t) => (
            <Nav key={t.name} href={t.href} onClick={() => openPage(t.href)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <span style={ICON_BOX}><img src={t.logo} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /></span>
              <span style={NAME}>{t.name}</span>
              {t.zh ? <span style={SUB}>{t.zh}</span> : null}
            </Nav>
          ))}
        </div>

        <button
          type="button"
          className="mkt-press"
          onClick={() => setOpen(false)}
          style={{ width: "100%", margin: "8px 0", padding: "12px 0", border: 0, borderRadius: RADIUS, background: ACCENT, color: "#fff", fontSize: 15, fontWeight: 800, letterSpacing: 0.2, cursor: "pointer" }}
        >
          See live results 查看成绩
        </button>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
          {actions.map((t) => (
            <Nav
              key={t.name}
              href={t.href}
              onClick={(e) => {
                if (t.settings) { e.preventDefault(); setSettingsOpen(true); return; }
                if (t.lucky) {
                  // Same 恭喜发财 popup the three-line menu shows. It lives
                  // here rather than in the header because the header is hidden
                  // behind the first page.
                  e.preventDefault();
                  setLucky(luckyNumber());
                  return;
                }
                // Close the first page as the link opens. Without this the
                // overlay stayed on top and the page it opened showed behind
                // it, which read as the bottom tiles not working at all.
                openPage(t.href);
              }}
            >
              <span style={ICON_BOX}>
                {t.logo ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={t.logo} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                ) : (
                  <GearSix size={30} weight="bold" color={ACCENT} aria-hidden="true" />
                )}
              </span>
              <span style={NAME}>{t.name}</span>
              {t.zh ? <span style={{ ...SUB, fontWeight: 700, color: ACCENT }}>{t.zh}</span> : null}
            </Nav>
          ))}
        </div>
        {/* The page link that actually works: Facebook search ranks a new page
            far too low to be found, so the app hands users the direct address. */}
        <a
          href="https://www.facebook.com/mkt88my"
          target="_blank"
          rel="noreferrer"
          className="mkt-press"
          style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "11px 0", borderRadius: RADIUS, background: "#1877F2", color: "#fff", fontSize: 15, fontWeight: 800, textDecoration: "none" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#fff" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          Follow us on Facebook 关注我们
        </a>
      </div>

      {settingsOpen ? (
        <div
          onClick={() => setSettingsOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 100060, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: RADIUS, padding: "20px 20px 16px", width: "88%", maxWidth: 340 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: ACCENT, marginBottom: 14 }}>Settings 设置</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Keep screen on</div>
                <div style={{ fontSize: 13, color: "#777" }}>屏幕常亮</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={keepOn}
                aria-label="Keep screen on"
                onClick={() => setKeepScreenOn(!keepOn)}
                style={{ border: 0, borderRadius: 999, width: 58, height: 32, background: keepOn ? "#12b76a" : "#c9c9c9", cursor: "pointer", position: "relative", flex: "0 0 auto" }}
              >
                <span style={{ position: "absolute", top: 3, left: keepOn ? 29 : 3, width: 26, height: 26, borderRadius: "50%", background: "#fff", transition: "left 120ms ease", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
              </button>
            </div>
            <div style={{ fontSize: 13, color: "#999", marginTop: 10 }}>
              While this is on the phone will not sleep during a live draw.
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 18 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Live draw sound</div>
                <div style={{ fontSize: 13, color: "#777" }}>开奖提示音</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={soundOn}
                aria-label="Live draw sound"
                onClick={() => setLiveSound(!soundOn)}
                style={{ border: 0, borderRadius: 999, width: 58, height: 32, background: soundOn ? "#12b76a" : "#c9c9c9", cursor: "pointer", position: "relative", flex: "0 0 auto" }}
              >
                <span style={{ position: "absolute", top: 3, left: soundOn ? 29 : 3, width: 26, height: 26, borderRadius: "50%", background: "#fff", transition: "left 120ms ease", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
              </button>
            </div>
            <div style={{ fontSize: 13, color: "#999", marginTop: 10 }}>
              A short knock sounds as each number comes out during a live draw.
            </div>
            <button type="button" onClick={() => setSettingsOpen(false)} style={{ width: "100%", marginTop: 16, padding: "11px 0", border: 0, borderRadius: RADIUS, background: ACCENT, color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>Done 完成</button>
          </div>
        </div>
      ) : null}

      {specialDraw ? (
        <div
          onClick={() => setSpecialDraw(false)}
          style={{ position: "fixed", inset: 0, zIndex: 100060, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: RADIUS, padding: "28px 26px", textAlign: "center", maxWidth: 320, width: "88%" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: ACCENT }}>Special Draw Today 今天特别彩</div>
            <div style={{ fontSize: 14, color: "#888", marginTop: 8 }}>记得查看今天的特别开彩成绩</div>
            <button type="button" onClick={() => setSpecialDraw(false)} style={{ marginTop: 18, padding: "11px 22px", background: ACCENT, color: "#fff", border: 0, borderRadius: RADIUS, fontWeight: 800, cursor: "pointer" }}>OK 好的</button>
          </div>
        </div>
      ) : null}

      {lucky ? (
        <div
          onClick={() => setLucky(null)}
          style={{ position: "fixed", inset: 0, zIndex: 100060, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: RADIUS, padding: "28px 32px", textAlign: "center", maxWidth: 320, width: "88%" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: ACCENT }}>恭喜发财</div>
            <div style={{ fontSize: 15, color: "#888", marginTop: 4 }}>您的幸运号码</div>
            {/* Tap the number to see its full record in Number History. */}
            <Link
              href={"/number-history?num=" + lucky}
              onClick={() => { setLucky(null); openPage("/number-history?num=" + lucky); }}
              title="查看这个号码的开彩记录"
              style={{ display: "block", fontSize: 32, fontWeight: 900, letterSpacing: 8, color: ACCENT, margin: "14px 0 10px", background: "#fff7e6", borderRadius: RADIUS, padding: "8px 0", fontVariantNumeric: "tabular-nums", textDecoration: "none" }}
            >{lucky}</Link>
            <button type="button" onClick={() => setLucky(luckyNumber())} style={{ padding: "10px 18px", background: ACCENT, color: "#fff", border: 0, borderRadius: RADIUS, marginRight: 8, cursor: "pointer" }}>Try Again</button>
            <button type="button" onClick={() => setLucky(null)} style={{ padding: "10px 18px", background: "#eee", border: 0, borderRadius: RADIUS, cursor: "pointer" }}>Close</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
