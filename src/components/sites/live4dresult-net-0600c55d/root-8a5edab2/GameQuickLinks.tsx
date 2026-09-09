import { GAME_DEFS, EAST_LINKS } from "./GameDefs";

function Tile({ href, logo, name, zh, external }: { href: string; logo?: string; name: string; zh?: string; external?: boolean }) {
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
        justifySelf: "center",
        width: "100%",
        maxWidth: 120,
        boxSizing: "border-box",
        minWidth: 0,
        padding: "10px 2px",
        border: "1px solid #eee",
        borderRadius: 10,
        background: "#fff",
        color: "#333",
        textDecoration: "none",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      }}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt={name} style={{ width: 46, height: 46, objectFit: "contain", marginBottom: 4 }} />
      ) : (
        <div style={{ width: 46, height: 46, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 4 }}>
          🎰
        </div>
      )}
      <span style={{ fontSize: 10, fontWeight: 700, textAlign: "center", lineHeight: 1.2 }}>{name}</span>
      {zh ? <span style={{ fontSize: 9, color: "#666", textAlign: "center" }}>{zh}</span> : null}
    </a>
  );
}

export default function GameQuickLinks() {
  return (
    <div style={{ maxWidth: 640, margin: "10px auto 6px", padding: "0 4px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, justifyItems: "center" }}>
        {GAME_DEFS.map((g) => (
          <Tile key={g.slug} href={"/result/" + g.slug} logo={g.logo} name={g.name} zh={g.zh} />
        ))}
        {EAST_LINKS.map((g) => (
          <Tile key={g.slug} href={g.href} logo={g.logo} name={g.name} zh={g.zh} />
        ))}
        <Tile
          href="https://www.singaporepools.com.sg/en/product/pages/4d_results.aspx"
          name="Singapore 4D"
          zh="新加坡"
          external
        />
      </div>
    </div>
  );
}
