import { GAME_DEFS, EAST_LINKS } from "./GameDefs";

function Tile({ href, logo, name, zh }: { href: string; logo?: string; name: string; zh?: string }) {
  return (
    <a
      href={href}
      title={name}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 86,
        maxWidth: 96,
        flex: "0 0 auto",
        margin: "0 4px",
        padding: "8px 4px",
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
        <img src={logo} alt={name} style={{ width: 54, height: 54, objectFit: "contain", marginBottom: 4 }} />
      ) : (
        <div style={{ width: 54, height: 54, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 4 }}>
          🎰
        </div>
      )}
      <span style={{ fontSize: 11, fontWeight: 700, textAlign: "center", lineHeight: 1.2 }}>{name}</span>
      {zh ? <span style={{ fontSize: 10, color: "#666", textAlign: "center" }}>{zh}</span> : null}
    </a>
  );
}

export default function GameQuickLinks() {
  return (
    <div style={{ margin: "8px 0 4px" }}>
      <div style={{ display: "flex", overflowX: "auto", paddingBottom: 6 }}>
        {GAME_DEFS.map((g) => (
          <Tile key={g.slug} href={"/result/" + g.slug} logo={g.logo} name={g.name} zh={g.zh} />
        ))}
        {EAST_LINKS.map((g) => (
          <Tile key={g.slug} href={g.href} logo={g.logo} name={g.name} zh={g.zh} />
        ))}
        <Tile href="/singapore-4d-results" name="Singapore 4D" zh="新加坡" />
        <Tile href="/lotto-4d" name="Lotto 4D" zh="柬埔寨" />
      </div>
    </div>
  );
}
