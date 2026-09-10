import type { Metadata, Viewport } from "next";
import PWARegister from "../components/PWARegister";
import NoticeBar from "../components/NoticeBar";
import TopBanner from "../components/TopBanner";
import SiteCustomizer from "../components/SiteCustomizer";
import AppTools from "../components/AppTools";
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

/**
 * Boot script (runs while the HTML is still parsing, before the app's JS):
 * it asks the pre-warmed snapshot for the current numbers and writes them into
 * the cards straight away, so a visitor sees the latest draw immediately
 * instead of waiting for the framework to hydrate and fetch.
 */
const BOOT_SCRIPT = `
(function(){
  window.__MKT_BOOT__ = true;
  function txt(el, v){ if(!el || v === undefined || v === null || v === "") return; if((el.textContent||"").trim() !== v){ el.textContent = v; } el.classList.remove("live-pending"); }
  function applyCards(cards){
    Object.keys(cards || {}).forEach(function(cls){
      var vals = cards[cls] || {};
      var nodes = document.querySelectorAll(".card.outer-box." + cls);
      for (var i = 0; i < nodes.length; i++){
        Object.keys(vals).forEach(function(id){ txt(nodes[i].querySelector('[data-id="' + id + '"]'), vals[id]); });
      }
    });
  }
  function dot(v){ return !v || v.indexOf("----") === 0; }
  function applySet(card, set){
    if(!card || !set || !set.prize) return;
    var tables = card.querySelectorAll("table");
    var rows = tables[0] ? tables[0].querySelectorAll("tr") : [];
    (set.prize || []).forEach(function(v, i){ var row = rows[i]; if(!row || dot(v)) return; txt(row.querySelector("td.lottery-prize-number"), v); });
    if(tables[1]){ var sp = tables[1].querySelectorAll("td.lottery-number"); (set.special || []).forEach(function(v, i){ if(sp[i] && !dot(v)) txt(sp[i], v); }); }
    if(tables[2]){ var cn = tables[2].querySelectorAll("td.lottery-number"); (set.cons || []).forEach(function(v, i){ if(cn[i] && !dot(v)) txt(cn[i], v); }); }
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
  function pull(url, fn){ try { fetch(url, { cache: "no-store" }).then(function(r){ return r.ok ? r.json() : null; }).then(fn).catch(function(){}); } catch(e){} }
  pull("/api/home-live", function(j){ if(j){ if(j.cards) applyCards(j.cards); applyCambodia(j); } });
  pull("/api/cambodia-live", function(j){ if(j) applyCambodia(j); });
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh">
      <body className="home wp-singular page-template-default page page-id-3 wp-theme-oldtheme-lottery-frontend d-flex flex-column aa-prefix-live4-">
        <NoticeBar />
        <TopBanner />
        {children}
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
        <PWARegister />
        <SiteCustomizer />
        <AppTools />
      </body>
    </html>
  );
}
