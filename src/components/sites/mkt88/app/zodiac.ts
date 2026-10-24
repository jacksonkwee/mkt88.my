const FILES: Record<string, string> = {
  rat: "rat",
  ox: "ox",
  tiger: "tiger",
  rabbit: "rabbit",
  dragon: "dragon",
  snake: "snake",
  horse: "horse",
  goat: "goat",
  sheep: "goat",
  monkey: "monkey",
  rooster: "rooster",
  chicken: "rooster",
  dog: "dog",
  boar: "boar",
  pig: "boar",
};

export function zodiacImage(value: string | undefined): string {
  const key = String(value || "").trim().toLowerCase();
  const file = FILES[key] || "empty";
  return `/sites/mkt88/app/theme-assets/images/zodiac/${file}.png`;
}

/** Replace the zodiac image inside an HTML-imported Sports Toto card. */
export function setZodiacImage(html: string, value: string | undefined): string {
  return html.replace(
    /(<img\b(?=[^>]*\bdata-id=["']zodiac["'])[^>]*\bsrc=["'])[^"']*/i,
    (_match, prefix: string) => prefix + zodiacImage(value)
  );
}
