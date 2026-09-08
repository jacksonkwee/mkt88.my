import type { Metadata, Viewport } from "next";
import Script from "next/script";
import PWARegister from "../components/PWARegister";
import NoticeBar from "../components/NoticeBar";
import TopBanner from "../components/TopBanner";
import SiteCustomizer from "../components/SiteCustomizer";
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh">
      <body className="home wp-singular page-template-default page page-id-3 wp-theme-oldtheme-lottery-frontend d-flex flex-column aa-prefix-live4-">
        <NoticeBar />
        <TopBanner />
        {children}
        <PWARegister />
        <SiteCustomizer />
        <Script
          strategy="afterInteractive"
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3670692731712446"
          crossOrigin="anonymous"
        />
      </body>
    </html>
  );
}

