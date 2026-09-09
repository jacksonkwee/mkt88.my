import GameQuickLinks from "./GameQuickLinks";

const BUTTONS = [
  { label1: "4D Result", label2: "马来西亚", href: "/" },
  { label1: "SG", label2: "新加坡", href: "/singapore-4d-results" },
  { label1: "East 4D", label2: "東馬", href: "/sabah-sarawak-4d-results" },
  { label1: "Lotto 4D", label2: "柬埔寨", href: "/lotto-4d" },
];

export default function RegionButtons() {
  return (
    <div className="header-btn-group container px-0">
      <div className="btn-group border w-100" role="group" aria-label="Basic example">
        {BUTTONS.map((b) => (
          <a key={b.label1 + b.label2} href={b.href} className="btn">
            {b.label1} <br /> {b.label2}
          </a>
        ))}
      </div>
      <GameQuickLinks />
    </div>
  );
}
