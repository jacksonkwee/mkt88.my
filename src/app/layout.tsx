import type { Metadata, Viewport } from "next";
import PWARegister from "../components/PWARegister";
import NoticeBar from "../components/NoticeBar";
import TopBanner from "../components/TopBanner";
import SiteCustomizer from "../components/SiteCustomizer";
import AppTools from "../components/AppTools";
import { getSnapshot } from "../lib/live-snapshot";
import LiveSnapshotProvider, { type SnapValue } from "../components/LiveSnapshotProvider";
import "./vendor/bootstrap.min.css";
import "./vendor/font-awesome.min.css";
import "./vendor/theme-style.css";
import "./globals.css";

const ASSET = "/sites/live4dresult-net-0600c55d/root-8a5edab2";

export const metadata: Metadata = {
  title: "Live 4d results - Magnum, Damacai, Sportstoto, Perdana 4D",
  description: "Real time 4d result. Live 4d updates Magnum 4D, Sports Toto, and DaMaCai 1+3D. Fast, Accurate, and Easy Access.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "恭喜发财", statusBarStyle: "default" },
  other: {
    "google-adsense-account": "ca-pub-3670692731712446",
  },
  icons: {
    icon: [
      { url: ASSET + "/favicon.ico", sizes: "any" },
      { url: ASSET + "/wp-content/uploads/sites/3/2026/08/live4dresult-150x150.png", sizes: "32x32", type: "image/png" },
      { url: ASSET + "/wp-content/uploads/sites/3/2026/08/live4dresult-300x300.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: ASSET + "/icon_48x48.png", sizes: "48x48" },
      { url: ASSET + "/icon_96x96.png", sizes: "96x96" },
      { url: ASSET + "/icon_144x144.png", sizes: "144x144" },
      { url: ASSET + "/icon_192x192.png", sizes: "192x192" },
      { url: ASSET + "/wp-content/uploads/sites/3/2026/08/live4dresult-300x300.png" },
    ],
  },
};

export const viewport: Viewport = { themeColor: "#1633c7", width: "device-width", initialScale: 1 };

// The snapshot must be current for every request, so pages are rendered on the
// server (the snapshot itself comes from memory in a few milliseconds).
export const dynamic = "force-dynamic";

/**
 * Boot script (runs while the HTML is still parsing, before the app's JS):
 * it asks the pre-warmed snapshot for the current numbers and writes them into
 * the cards straight away, so a visitor sees the latest draw immediately
 * instead of waiting for the framework to hydrate and fetch.
 */
const BOOT_SCRIPT = `
(function(){
  window.__MKT_BOOT__ = true;
  var changed = false;
  function txt(el, v){ if(!el || v === undefined || v === null || v === "") return; var id = el.getAttribute ? (el.getAttribute("data-id") || "") : ""; if(/^six_/.test(id) && /^----+$/.test(String(v).trim())) return; if((el.textContent||"").trim() !== v){ el.textContent = v; changed = true; } if(el.classList.contains("live-pending")){ el.classList.remove("live-pending"); changed = true; } }
  function applyCards(cards){
    Object.keys(cards || {}).forEach(function(cls){
      var vals = cards[cls] || {};
      var nodes = document.querySelectorAll(".card.outer-box." + cls);
      for (var i = 0; i < nodes.length; i++){
        Object.keys(vals).forEach(function(id){ var v = vals[id]; if(!v || v === "-" || v.indexOf("----") === 0) return; txt(nodes[i].querySelector('[data-id="' + id + '"]'), v); });
      }
    });
  }
  function dot(v){ return !v || v.indexOf("----") === 0; }
  function applySet(card, set){
    if(!card || !set || !set.prize) return;
    var dateEl = card.querySelector('[data-id="date"]');
    var curDate = dateEl ? (dateEl.textContent || "").trim() : "";
    var newDraw = !!set.date && set.date !== curDate;
    function put(el, v){
      if(!el || v === undefined || v === null) return;
      if(dot(v) && !newDraw) return;          // an older draw never blanks a value
      txt(el, v === "" ? "----" : v);         // a new draw shows what is still pending as "----"
    }
    var tables = card.querySelectorAll("table");
    var rows = tables[0] ? tables[0].querySelectorAll("tr") : [];
    (set.prize || []).forEach(function(v, i){ var row = rows[i]; if(!row) return; put(row.querySelector("td.lottery-prize-number"), v); });
    if(tables[1]){ var sp = tables[1].querySelectorAll("td.lottery-number"); (set.special || []).forEach(function(v, i){ if(sp[i]) put(sp[i], v); }); }
    if(tables[2]){ var cn = tables[2].querySelectorAll("td.lottery-number"); (set.cons || []).forEach(function(v, i){ if(cn[i]) put(cn[i], v); }); }
    if(set.date) txt(card.querySelector('[data-id="date"]'), set.date);
    if(set.drawNo) txt(card.querySelector('[data-id="draw_no"]'), set.drawNo);
  }
  function applyCambodia(j){
    if(!j) return;
    [["15:30","1530"],["19:30","1930"]].forEach(function(pair){
      var t = pair[0], sfx = pair[1];
      var pid = "table-16-2026-09-06-" + sfx, hid = "table-15-2026-09-06-" + sfx;
      var p = j.perdana && j.perdana[t];
      if(p){ var pcs = document.querySelectorAll('[id="' + pid + '"]'); for(var i=0;i<pcs.length;i++) applySet(pcs[i], p); }
      var h = j.hari && j.hari[t];
      if(h && h.set){
        var hcs = document.querySelectorAll('[id="' + hid + '"]');
        for(var k=0;k<hcs.length;k++) applySet(hcs[k], h.set);
        if(h.six){
          var six = document.getElementById(hid + "-6d");
          if(six){ txt(six.querySelector('[data-id="six_main"]'), h.six.main); Object.keys(h.six.subs || {}).forEach(function(key){ txt(six.querySelector('[data-id="' + key + '"]'), h.six.subs[key]); }); }
        }
        if(h.jp){ for(var m=0;m<hcs.length;m++){ Object.keys(h.jp).forEach(function(key){ txt(hcs[m].querySelector('[data-id="' + key + '"]'), h.jp[key]); }); } }
      }
    });
  }
  var snap = {};
  try { var el = document.getElementById("mkt-snapshot"); snap = el && el.textContent ? JSON.parse(el.textContent) : {}; } catch(e){ snap = {}; }
  window.__MKT_SNAP__ = snap;
  function run(){
    changed = false;
    if(snap && snap.cards) applyCards(snap.cards);
    applyCambodia(snap);
    if(changed){ try { window.dispatchEvent(new Event("mkt-snap")); } catch(e){} }
  }
  function publish(j){
    if(!j) return;
    var next = {};
    Object.keys(snap || {}).forEach(function(k){ next[k] = snap[k]; });
    Object.keys(j).forEach(function(k){ next[k] = j[k]; });
    // Merge the two-draw games per draw time: a feed that carries only the
    // "set" must not drop the 6D numbers / jackpot we already have.
    if(j.hari && snap && snap.hari){
      var merged = {};
      Object.keys(j.hari).forEach(function(t){
        var cur = snap.hari[t] || {};
        var add = j.hari[t] || {};
        merged[t] = { set: add.set || cur.set, six: add.six || cur.six, jp: add.jp || cur.jp };
      });
      Object.keys(snap.hari).forEach(function(t){ if(!merged[t]) merged[t] = snap.hari[t]; });
      next.hari = merged;
    }
    snap = next;
    window.__MKT_SNAP__ = next;
    run();
  }
  function pull(url, fn){ try { fetch(url, { cache: "no-store" }).then(function(r){ return r.ok ? r.json() : null; }).then(fn).catch(function(){}); } catch(e){} }

  run();
  if(document.readyState === "loading"){ document.addEventListener("DOMContentLoaded", run); }
  try {
    var pending = 0;
    new MutationObserver(function(){
      if(pending) return;
      pending = setTimeout(function(){ pending = 0; run(); }, 50);
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch(e){}
  // Keep re-applying: React occasionally re-renders a card from its built-in
  // values, which would otherwise wipe the freshly filled numbers.
  setInterval(run, 400);
  document.addEventListener("visibilitychange", function(){ if(document.visibilityState === "visible") run(); });
  pull("/api/home-live", publish);
  pull("/api/cambodia-live", publish);
})();
`;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let snapObj: SnapValue = { cards: {}, perdana: {}, hari: {} };
  try { const snap = await getSnapshot(); snapObj = { cards: snap.cards, perdana: snap.perdana as unknown as SnapValue["perdana"], hari: snap.hari as unknown as SnapValue["hari"] }; } catch { /* ignore */ }
  const snapJson = JSON.stringify(snapObj).replace(/</g, "\\u003c");
  return (
    <html lang="zh">
      <body className="home wp-singular page-template-default page page-id-3 wp-theme-oldtheme-lottery-frontend d-flex flex-column aa-prefix-live4-">
        <script id="mkt-snapshot" type="application/json" dangerouslySetInnerHTML={{ __html: snapJson }} />
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
        <LiveSnapshotProvider value={snapObj}>
          <NoticeBar />
          <TopBanner />
          {children}
        </LiveSnapshotProvider>
        <PWARegister />
        <SiteCustomizer />
        <AppTools />
      </body>
    </html>
  );
}












