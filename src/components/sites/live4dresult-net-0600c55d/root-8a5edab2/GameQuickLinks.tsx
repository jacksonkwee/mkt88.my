import { GAME_DEFS, EAST_LINKS } from "./GameDefs";

const SG_LOGO = "/sites/live4dresult-net-0600c55d/root-8a5edab2/logo_singapore4d.png";

function Tile({ href, logo, name, zh, external }: { href: string; logo: string; name: string; zh?: string; external?: boolean }) {
  return (
    <a
      href={href}
      title={name}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
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

export default function GameQuickLinks() {
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
      {GAME_DEFS.map((g) => (
        <Tile key={g.slug} href={"/result/" + g.slug} logo={g.logo} name={g.name} zh={g.zh} />
      ))}
      {EAST_LINKS.map((g) => (
        <Tile key={g.slug} href={g.href} logo={g.logo} name={g.name} zh={g.zh} />
      ))}
      <Tile
        href="https://www.singaporepools.com.sg/en/product/pages/4d_results.aspx"
        logo={SG_LOGO}
        name="Singapore 4D"
        zh="新加坡"
        external
      />
    </div>
  );
}
