"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { GAME_DEFS, EAST_LINKS } from "./sites/mkt88/app/GameDefs";
import { isCapacitorApp } from "../lib/is-capacitor-app";
import { GearSix } from "@phosphor-icons/react";
import { useLang, tr, LANG_LABEL } from "../lib/i18n";
import { RESULT_ALERT_KEY } from "./ResultAlerts";
import NoticeBar from "./NoticeBar";
import { gamePagerIndex } from "./sites/mkt88/app/game-order";

/** Icons cropped from the artwork supplied for the app home screen. */
const HOME = "/sites/mkt88/app/app-home";
const SG_LOGO = "/sites/mkt88/app/logo_singapore4d.png";
/** The brand logo, at the top of the first page. */
const MKT_LOGO = "/sites/mkt88/app/logo-mkt88.webp?v=4";
const PLAY_URL = "https://play.google.com/store/apps/details?id=com.mkt88.app";

/** Same order the swipe strip uses. */
const GAME_ORDER = [
  "magnum", "damacai", "sportstoto", "sg", "sabah88", "cashsweep",
  "sandakan", "grand-dragon", "nine-lotto", "perdana", "lucky-harihari",
];

type Tile = { href: string; logo: string; name: string; zh?: string; key?: string; subKey?: string; lucky?: boolean; settings?: boolean };

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

const NAME: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: INK, lineHeight: 1.15 };
const SUB: React.CSSProperties = { fontSize: 12, color: INK_MUTED, lineHeight: 1.15 };

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
 * navigation. Prefetch stays off: eleven route prefetches at once delayed the
 * home and the first tap (measured again 18 Oct 2026); the light shell alone
 * is what made the first response fast.
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

/**
 * The admin pages belong to the owner, not to the app's first screen.
 *
 * The first screen is an overlay that hides the whole site, so /admin and
 * /admin/login have to be exempt or the password box is behind it (reported
 * 15 Oct 2026). The boot script in layout.tsx applies the same rule before the
 * first paint; this keeps it true after hydration.
 */
function isAdminPath(): boolean {
  try { return /^\/admin(\/|$)/.test(window.location.pathname); } catch { return false; }
}

/**
 * The first page belongs to the home route only.
 *
 * Opening the app on a game page (a link, a notification, or a tap that
 * landed before React hydrated and so did a full page load) must show that
 * game - not cover it with the tile grid again.
 */
function isHomePath(): boolean {
  try { const p = window.location.pathname; return p === "/" || p === ""; } catch { return false; }
}

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
  const [open, setOpen] = useState(() => initialOpen || (isCapacitorApp() && !isAdminPath() && isHomePath()));
  const [lucky, setLucky] = useState<string | null>(null);
  /** The tile whose page is being fetched, so a second tap cannot restart it. */
  const [pending, setPending] = useState<string | null>(null);
  const router = useRouter();
  const [lang, setLang] = useLang();
  const [specialDraw, setSpecialDraw] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [keepOn, setKeepOn] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [alertsOn, setAlertsOn] = useState(true);

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
      setPending(null);
      setOpen(false);
      document.body.classList.remove("mkt-boot-wait");
    }
  }, [pathname, open]);

  /**
   * Close the first page now, or hold it until a different page is ready.
   *
   * A game tap also tells the swipe pager which slide it means: the pager keeps
   * the slide the reader swiped to while the URL stays where they entered, so
   * coming back through the logo and tapping the game whose route we are still
   * on has to move the track explicitly (reported 17 Oct 2026).
   */
  const openPage = (href: string) => {
    const path = href.split("?")[0];
    // The three east games share one route and differ only by ?op=, so the
    // path alone cannot tell the pager which one was tapped.
    const game = /^\/result\/([a-z0-9-]+)/.exec(path);
    const east = /^\/sabah-sarawak-4d-results\?op=([a-z0-9-]+)/.exec(href);
    const slot = game ? game[1] : east ? east[1] : "";
    if (slot) {
      try { window.dispatchEvent(new CustomEvent("mktpager-go", { detail: { index: gamePagerIndex(slot) } })); } catch { /* not a browser */ }
    }
    if (path.startsWith("/") && path !== pathname) {
      pendingNav.current = pathname || "/";
      // The tap is registered: show it on the tile and refuse further taps
      // until the page arrives (a second tap restarted the fetch, which is
      // what made a slow page feel like a dead button).
      setPending(path);
      return;
    }
    setOpen(false);
  };

  /*
   * A tile tapped before this component was alive (the boot script queues it).
   *
   * The tap that used to become a full page load is now a client-side
   * navigation that starts the moment React is ready - one tap, no reload
   * (reported 17 Oct 2026: tapping straight after launch took two seconds and
   * needed several taps, while the same tap a second later was instant).
   */
  useIsoLayoutEffect(() => {
    const w = window as unknown as { __mktQueuedHref?: string | null };
    const flush = () => {
      const href = w.__mktQueuedHref;
      if (!href) return;
      w.__mktQueuedHref = null;
      document.body.classList.remove("mkt-boot-wait");
      openPage(href);
      router.push(href);
    };
    window.addEventListener("mkt-queued-nav", flush);
    flush();
    return () => window.removeEventListener("mkt-queued-nav", flush);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, pathname]);

  /*
   * Warm the one tool page people tap most. One static route, once, after the
   * light home is interactive - not the eleven-route burst that slowed the
   * first tap.
   */
  useEffect(() => {
    if (!open || !isCapacitorApp() || isAdminPath() || !isHomePath()) return;
    const t = window.setTimeout(() => router.prefetch("/dabogong"), 700);
    return () => window.clearTimeout(t);
  }, [open, router]);

  // A navigation that never lands must not leave the tiles dead.
  useEffect(() => {
    if (!pending) return;
    const t = window.setTimeout(() => setPending(null), 8000);
    return () => window.clearTimeout(t);
  }, [pending]);

  // Load the saved preferences (both default ON).
  useEffect(() => {
    try {
      if (localStorage.getItem(WAKE_KEY) === "0") setKeepOn(false);
      if (localStorage.getItem(LIVE_SOUND_KEY) === "0") setSoundOn(false);
      if (localStorage.getItem(RESULT_ALERT_KEY) === "0") setAlertsOn(false);
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

  const setResultAlerts = (on: boolean) => {
    setAlertsOn(on);
    try { localStorage.setItem(RESULT_ALERT_KEY, on ? "1" : "0"); } catch { /* ignore */ }
    // PushRegister listens for this so the server stops pushing when the user
    // switches result alerts off (the two must not disagree).
    try { window.dispatchEvent(new Event("mkt-result-alerts")); } catch { /* not in a browser */ }
  };

  useEffect(() => {
    // Only the home route gets the tile grid on launch; a deep link into a game
    // must open that game uncovered.
    if (!isCapacitorApp() || isAdminPath() || !isHomePath()) return;
    // Remember that this launch already showed the home screen. Without it,
    // every page load inside the app re-opened it - so tapping a game looked
    // like the app jumping back to the first page.
    try {
      if (sessionStorage.getItem(SEEN_KEY)) return;
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch { /* private mode - just show it */ }
    setOpen(true);
  }, []);

  // The header logo asks for this screen back, so tapping MKT 发发 on any
  // results page returns to the first page.
  useEffect(() => {
    const onHome = () => setOpen(true);
    window.addEventListener("mkt-home", onHome);
    return () => window.removeEventListener("mkt-home", onHome);
  }, []);

  /*
   * Hooks the phone's back key uses.
   *
   * MainActivity handles that key natively: it asks the page whether the app's
   * own screen is already open, and when it is not it tells the page to show it.
   * So back lands on the home screen from any page, and only leaves the app when
   * there is nowhere left to go back to.
   */
  useIsoLayoutEffect(() => {
    const w = window as unknown as { __mktAtHome?: () => boolean; __mktGoHome?: () => void };
    w.__mktAtHome = () => document.body.classList.contains(HOME_OPEN_CLASS);
    w.__mktGoHome = () => window.dispatchEvent(new Event("mkt-home"));
    return () => {
      delete w.__mktAtHome;
      delete w.__mktGoHome;
    };
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
    { href: "/favourites", logo: HOME + "/favourite.png?v=2", name: "Favourite Numbers", zh: "收藏号码", key: "favourite" },
    { href: "/dabogong", logo: HOME + "/dabogong.png?v=2", name: "大伯公", zh: "千字图", key: "dabogong", subKey: "dabogongSub" },
    { href: "/number-history", logo: HOME + "/number-history.svg?v=1", name: "Number History", zh: "开彩记录", key: "history" },
    { href: "/statistics", logo: HOME + "/hot-numbers.svg?v=1", name: "Hot Numbers", zh: "热门号码", key: "hot" },
    // The icon artwork already reads 恭喜发财, so no second Chinese label here.
    { href: "#", logo: HOME + "/gongxi.png?v=2", name: "Lucky Numbers", key: "lucky", lucky: true },
    { href: PLAY_URL, logo: HOME + "/rate-us.png?v=2", name: "Rate us", zh: "评分", key: "rate" },
    { href: "#", logo: "", name: "Settings", zh: "设置", key: "settings", settings: true },
  ];

  return (
    <div className="mkt-app-home" style={{ position: "fixed", inset: 0, zIndex: 100050, background: PAGE_BG, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        {/* Announcement strip: the first thing on the app's own screen, same as
            on the website. */}
        <NoticeBar />
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "10px 10px 14px" }}>
        {/* Brand logo, top of the first page. */}
        <div style={{ display: "flex", justifyContent: "center", padding: "2px 0 10px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img loading="lazy" src={MKT_LOGO} alt="MKT 发发" style={{ height: 56, width: "auto", maxWidth: "78%", display: "block" }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, pointerEvents: pending ? "none" : undefined }}>
          {games.map((t) => (
            <Nav key={t.name} href={t.href} onClick={() => openPage(t.href)}>
              <span style={ICON_BOX}>
                {pending === t.href ? (
                  <span className="mkt-spin" aria-label="Loading" />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img loading="lazy" src={t.logo} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                )}
              </span>
              <span style={NAME}>{t.name}</span>
              {t.zh ? <span style={SUB}>{t.zh}</span> : null}
            </Nav>
          ))}
        </div>

        <button
          type="button"
          className="mkt-press"
          onClick={() => {
            /*
             * The app's home is a lightweight shell now: there is no result
             * grid behind it to reveal. Send 查看成绩 to the real results page
             * instead of closing onto an empty background.
             */
            if (typeof document !== "undefined" && document.getElementById("mkt-app-shell")) {
              openPage("/4dresults");
              router.push("/4dresults");
              return;
            }
            setOpen(false);
          }}
          style={{ width: "100%", margin: "8px 0", padding: "12px 0", border: 0, borderRadius: RADIUS, background: ACCENT, color: "#fff", fontSize: 15, fontWeight: 700, letterSpacing: 0.2, cursor: "pointer" }}
        >
          {tr("seeLive", lang)}
        </button>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, pointerEvents: pending ? "none" : undefined }}>
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
                {pending === t.href ? (
                  <span className="mkt-spin" aria-label="Loading" />
                ) : t.logo ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img loading="lazy" src={t.logo} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                ) : (
                  <GearSix size={30} weight="bold" color={ACCENT} aria-hidden="true" />
                )}
              </span>
              <span style={NAME}>{t.key ? tr(t.key, lang) : t.name}</span>
              {t.subKey ? <span style={{ ...SUB, fontWeight: 700, color: ACCENT }}>{tr(t.subKey, lang)}</span> : (!t.key && t.zh ? <span style={{ ...SUB, fontWeight: 700, color: ACCENT }}>{t.zh}</span> : null)}
            </Nav>
          ))}
        </div>
      </div>

      {settingsOpen ? (
        <div
          onClick={() => setSettingsOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 100060, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: RADIUS, padding: "20px 20px 16px", width: "88%", maxWidth: 340 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: ACCENT, marginBottom: 14 }}>{tr("settings", lang)}</div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{tr("language", lang)}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                {(["en", "ms", "zh"] as const).map((l) => (
                  <button key={l} type="button" onClick={() => setLang(l)}
                    style={{ flex: 1, padding: "8px 0", borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 700,
                      border: lang === l ? "2px solid " + ACCENT : "1px solid var(--j-border)",
                      background: lang === l ? "#ffe9e9" : "#fff", color: lang === l ? ACCENT : "var(--j-ink)" }}>
                    {LANG_LABEL[l]}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{tr("languageHelp", lang)}</div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{tr("keepScreen", lang)}</div>
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
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>{tr("keepScreenHelp", lang)}</div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 18 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{tr("drawSound", lang)}</div>
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
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>{tr("drawSoundHelp", lang)}</div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 18 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{tr("resultAlerts", lang)}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={alertsOn}
                aria-label="Result ready alerts"
                onClick={() => setResultAlerts(!alertsOn)}
                style={{ border: 0, borderRadius: 999, width: 58, height: 32, background: alertsOn ? "#12b76a" : "#c9c9c9", cursor: "pointer", position: "relative", flex: "0 0 auto" }}
              >
                <span style={{ position: "absolute", top: 3, left: alertsOn ? 29 : 3, width: 26, height: 26, borderRadius: "50%", background: "#fff", transition: "left 120ms ease", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
              </button>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>{tr("resultAlertsHelp", lang)}</div>
            <button type="button" onClick={() => setSettingsOpen(false)} style={{ width: "100%", marginTop: 16, padding: "11px 0", border: 0, borderRadius: RADIUS, background: ACCENT, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>{tr("done", lang)}</button>
            {/* The installed app has no address bar, so this is the only way to
                reach the admin page from inside it - which is where the owner
                turns their own "a live source broke" alerts on (see
                lib/owner-alerts.ts). The page itself still needs the password. */}
            <a href="/admin" style={{ display: "block", marginTop: 12, fontSize: 12, color: "var(--muted)", textAlign: "center", textDecoration: "none" }}>管理员登入 / Admin</a>
          </div>
        </div>
      ) : null}

      {specialDraw ? (
        <div
          onClick={() => setSpecialDraw(false)}
          style={{ position: "fixed", inset: 0, zIndex: 100060, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: RADIUS, padding: "28px 26px", textAlign: "center", maxWidth: 320, width: "88%" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: ACCENT }}>Special Draw Today 今天特别彩</div>
            <div style={{ fontSize: 14, color: "var(--muted)", marginTop: 8 }}>记得查看今天的特别开彩成绩</div>
            <button type="button" onClick={() => setSpecialDraw(false)} style={{ marginTop: 18, padding: "11px 22px", background: ACCENT, color: "#fff", border: 0, borderRadius: RADIUS, fontWeight: 700, cursor: "pointer" }}>OK 好的</button>
          </div>
        </div>
      ) : null}

      {lucky ? (
        <div
          onClick={() => setLucky(null)}
          style={{ position: "fixed", inset: 0, zIndex: 100060, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: RADIUS, padding: "28px 32px", textAlign: "center", maxWidth: 320, width: "88%" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: ACCENT }}>恭喜发财</div>
            <div style={{ fontSize: 15, color: "var(--muted)", marginTop: 4 }}>{tr("luckyTitle", lang)}</div>
            {/* Tap the number to see its full record in Number History. */}
            <Link
              href={"/number-history?num=" + lucky}
              onClick={() => { setLucky(null); openPage("/number-history?num=" + lucky); }}
              title={tr("luckyTip", lang)}
              style={{ display: "block", fontSize: 32, fontWeight: 900, letterSpacing: 8, color: ACCENT, margin: "14px 0 10px", background: "#fff7e6", borderRadius: RADIUS, padding: "8px 0", fontVariantNumeric: "tabular-nums", textDecoration: "none" }}
            >{lucky}</Link>
            <button type="button" onClick={() => setLucky(luckyNumber())} style={{ padding: "10px 18px", background: ACCENT, color: "#fff", border: 0, borderRadius: RADIUS, marginRight: 8, cursor: "pointer" }}>{tr("luckyTry", lang)}</button>
            <button type="button" onClick={() => setLucky(null)} style={{ padding: "10px 18px", background: "var(--j-border)", border: 0, borderRadius: RADIUS, cursor: "pointer" }}>{tr("close", lang)}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
