import { GAME_DEFS, EAST_LINKS } from "./GameDefs";

const SG_LOGO = "/sites/live4dresult-net-0600c55d/root-8a5edab2/logo_singapore4d.png";

function Tile({ href, logo, name, zh }: { href: string; logo: string; name: string; zh?: string }) {
  return (
    <a
      href={href}
      title={name}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto",
        width: 68,
        boxSizing: "border-box",
        padding: "6px 2px",
        border: "1px solid #eee",
        borderRadius: 10,
        background: "#fff",
        color: "#333",
        textDecoration: "none",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} alt={name} style={{ width: 44, height: 44, objectFit: "contain", marginBottom: 4 }} />
      <span style={{ fontSize: 10, fontWeight: 700, textAlign: "center", lineHeight: 1.15, whiteSpace: "normal" }}>{name}</span>
      {zh ? <span style={{ fontSize: 9, color: "#666", textAlign: "center" }}>{zh}</span> : null}
    </a>
  );
}

// Display order: magnum, damacai, sportstoto, singapore, grand dragon,
// nine lotto, sabah 88, sandakan, cash sweep, perdana, lucky harihari
const ORDER = [
  "magnum", "damacai", "sportstoto", "sg",
  "grand-dragon", "nine-lotto",
  "sabah88", "stc", "cashsweep",
  "perdana", "lucky-harihari",
];

export default function GameQuickLinks() {
  const defsBySlug: Record<string, (typeof GAME_DEFS)[number]> = Object.fromEntries(GAME_DEFS.map((g) => [g.slug, g]));
  const eastBySlug: Record<string, (typeof EAST_LINKS)[number]> = Object.fromEntries(EAST_LINKS.map((g) => [g.slug, g]));
  const tiles = ORDER.map((slug) => {
    if (slug === "sg") return <Tile key="sg" href="/singapore-4d-results" logo={SG_LOGO} name="Singapore 4D" zh="新加坡" />;
    const d = defsBySlug[slug];
    if (d) return <Tile key={d.slug} href={"/result/" + d.slug} logo={d.logo} name={d.name} zh={d.zh} />;
    const e = eastBySlug[slug];
    if (e) return <Tile key={e.slug} href={e.href} logo={e.logo} name={e.name} zh={e.zh} />;
    return null;
  });
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        overflowX: "auto",
        overflowY: "hidden",
        justifyContent: "safe center",
        padding: "6px 4px 8px",
        background: "#fff",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {tiles}
    </div>
  );
}
