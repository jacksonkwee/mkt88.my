export interface GameDef {
  slug: string;
  name: string;
  zh: string;
  title: string;
  desc: string;
  logo: string;
  cardIds: string[];
  mode: "home" | "lotto";
}

const IMG = "/wp-content/themes/oldtheme-lottery-frontend/assets/images/";
const L = (n: string) => "/sites/live4dresult-net-0600c55d/root-8a5edab2" + IMG + n;

export const GAME_DEFS: GameDef[] = [
  {
    slug: "magnum",
    name: "Magnum 4D",
    zh: "萬能",
    title: "Magnum 4D Result 萬能 4D 开奖结果",
    desc: "Magnum 4D, Magnum Life and Magnum Jackpot Gold results - live and updated instantly after each draw.",
    logo: L("logo_magnum.gif?v=1"),
    cardIds: ["table-1-2026-09-06", "table-3-2026-09-06", "table-2-2026-09-06"],
    mode: "home",
  },
  {
    slug: "sportstoto",
    name: "Sports Toto 4D",
    zh: "多多",
    title: "Sports Toto 4D Result 多多 4D 开奖结果",
    desc: "Sports Toto 4D and Sports Toto 5D/6D results - live and updated instantly after each draw.",
    logo: L("logo_toto.gif?v=1"),
    cardIds: ["table-6-2026-09-06", "table-7-2026-09-06"],
    mode: "home",
  },
  {
    slug: "damacai",
    name: "Da Ma Cai 1+3D",
    zh: "大馬彩",
    title: "Da Ma Cai 4D Result 大馬彩 4D 开奖结果",
    desc: "Da Ma Cai 1+3D and Da Ma Cai 3+3D results - live and updated instantly after each draw.",
    logo: L("logo_damacai.gif?v=1"),
    cardIds: ["table-4-2026-09-06", "table-5-2026-09-06"],
    mode: "home",
  },
  {
    slug: "grand-dragon",
    name: "Grand Dragon 4D",
    zh: "豪龙",
    title: "Grand Dragon 4D & 6D Result 豪龙 4D 开奖结果",
    desc: "Grand Dragon Lotto 4D and 6D results with 6+1D jackpot pool - live Cambodia lottery results.",
    logo: L("logo_granddragon.jpg?v=1"),
    cardIds: ["table-13-2026-09-06", "table-14-2026-09-06-6d"],
    mode: "lotto",
  },
  {
    slug: "nine-lotto",
    name: "Nine Lotto 4D",
    zh: "Nine Lotto",
    title: "Nine Lotto 4D & 6D Result 开奖结果",
    desc: "Nine Lotto 4D and 6D results with Super Jackpot - live Cambodia lottery results.",
    logo: L("logo_ninelotto.png?v=1"),
    cardIds: ["table-17-2026-09-06", "table-18-2026-09-06-6d"],
    mode: "lotto",
  },
  {
    slug: "perdana",
    name: "Perdana 4D",
    zh: "Perdana",
    title: "Perdana Lottery 4D Result 开奖结果",
    desc: "Perdana Lottery 4D (3:30PM & 7:30PM) live results.",
    logo: L("logo_perdana.jpg?v=1"),
    cardIds: ["table-16-2026-09-06-1530", "table-16-2026-09-06-1930"],
    mode: "lotto",
  },
  {
    slug: "lucky-harihari",
    name: "Lucky HariHari 4D",
    zh: "天天好运",
    title: "Lucky HariHari 4D & 6D Result 天天好运 开奖结果",
    desc: "Lucky HariHari 4D and 6D results with jackpot pool (3:30PM & 7:30PM) - live results.",
    logo: L("logo_harihari.jpg?v=1"),
    cardIds: [
      "table-15-2026-09-06-1530", "table-15-2026-09-06-1930",
      "table-15-2026-09-06-1530-6d", "table-15-2026-09-06-1930-6d",
    ],
    mode: "lotto",
  },
];

export const gameBySlug: Record<string, GameDef> = Object.fromEntries(
  GAME_DEFS.map((g) => [g.slug, g])
);

export interface EastLink { slug: string; name: string; zh: string; logo: string; href: string; }
export const EAST_LINKS: EastLink[] = [
  { slug: "stc", name: "Sandakan 4D", zh: "山打根", logo: L("logo_stc4d.gif?v=1"), href: "/sabah-sarawak-4d-results?op=sandakan" },
  { slug: "sabah88", name: "Sabah 88 4D", zh: "沙巴88", logo: L("logo_sabah88.gif?v=1"), href: "/sabah-sarawak-4d-results?op=sabah88" },
  { slug: "cashsweep", name: "Cash Sweep 4D", zh: "沙捞越", logo: L("logo_cashsweep.gif?v=1"), href: "/sabah-sarawak-4d-results?op=cashsweep" },
];
