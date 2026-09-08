import type { MetadataRoute } from "next";

const ASSET = "/sites/live4dresult-net-0600c55d/root-8a5edab2";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "恭喜发财 4D 开彩结果 - Live 4D",
    short_name: "恭喜发财",
    description: "4D 开彩结果 - Magnum, Sports Toto, DaMaCai, Singapore Pools, Perdana, Lucky HariHari",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f7f7",
    theme_color: "#1633c7",
    lang: "zh",
    icons: [
      { src: ASSET + "/icon_48x48.png", sizes: "48x48", type: "image/png" },
      { src: ASSET + "/icon_96x96.png", sizes: "96x96", type: "image/png" },
      { src: ASSET + "/icon_144x144.png", sizes: "144x144", type: "image/png" },
      { src: ASSET + "/icon_192x192.png", sizes: "192x192", type: "image/png" },
      { src: ASSET + "/wp-content/uploads/sites/3/2026/08/live4dresult-300x300.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: ASSET + "/wp-content/uploads/sites/3/2026/08/live4dresult-300x300.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
