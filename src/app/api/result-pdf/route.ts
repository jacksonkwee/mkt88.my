import { NextRequest, NextResponse } from "next/server";
import { getSnapshot } from "../../../lib/live-snapshot";
import { gameBySlug } from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/GameDefs";

/**
 * A downloadable PDF of one game's latest result.
 *
 * Built by hand rather than with a PDF library: the app ships no PDF package,
 * and the only things this page needs are text, lines and one clickable link -
 * all of which are part of the basic PDF format. The text font is the PDF
 * viewer's built-in Helvetica, so no font file has to be embedded; that means
 * Latin characters only, so the Chinese names are dropped from the PDF.
 */
export const dynamic = "force-dynamic";

const PLAY_URL = "https://play.google.com/store/apps/details?id=com.mkt88.app";
const SITE = "https://mkt88.my";
/** The four games served from their own pages rather than /result/<slug>. */
const EXTRA: Record<string, { name: string; table: string }> = {
  sg: { name: "Singapore 4D", table: "table-11" },
  sabah88: { name: "Sabah 88 4D", table: "table-10" },
  sandakan: { name: "Sandakan 4D", table: "table-8" },
  cashsweep: { name: "Cash Sweep 4D", table: "table-9" },
};

const PAGE_W = 595;
const PAGE_H = 842;

/** Helvetica is Latin only, so anything else would come out as rubbish. */
const latin = (s: unknown) =>
  String(s ?? "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

type Line = { text: string; x: number; y: number; size: number; bold?: boolean };

function content(lines: Line[]): string {
  const ops = ["0.09 0.09 0.10 rg"];
  for (const l of lines) {
    const t = latin(l.text);
    if (!t) continue;
    ops.push(`BT /${l.bold ? "F2" : "F1"} ${l.size} Tf ${l.x} ${l.y} Td (${esc(t)}) Tj ET`);
  }
  return ops.join("\n");
}

/** Assemble the objects into a valid PDF with a correct cross-reference table. */
function makePdf(objects: string[]): Buffer {
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefAt = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += String(off).padStart(10, "0") + " 00000 n \n";
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

type Card = { date: string; drawNo: string; prizes: string[]; specials: string[]; cons: string[] };

function cardFromSnapshot(slug: string, snap: Awaited<ReturnType<typeof getSnapshot>>): Card | null {
  const def = gameBySlug[slug];
  const extra = EXTRA[slug];
  if (!def && !extra) return null;
  const cls = def
    ? latin(def.cardIds[0]).replace(/-\d{4}-\d{2}-\d{2}.*$/, "").replace(/-6d$/, "")
    : extra.table;
  const dash = (v?: string) => (!v || /^-+$/.test(v.trim()) ? "-" : v.trim());

  if (cls === "table-16" || cls === "table-15") {
    const slots = cls === "table-16" ? snap.perdana : snap.hari;
    const pick = Object.values(slots || {}).filter(Boolean).map((v: unknown) => {
      const s = (v as { set?: unknown }).set ?? v;
      return s as { date?: string; drawNo?: string; prize?: string[]; special?: string[]; cons?: string[] };
    });
    const withNumbers = pick.filter((s) => (s.prize || []).some((v) => v && !/^-+$/.test(v)));
    const s = withNumbers[withNumbers.length - 1] || pick[pick.length - 1];
    if (!s) return null;
    return {
      date: latin(s.date) || "",
      drawNo: latin(s.drawNo) || "",
      prizes: (s.prize || []).slice(0, 3).map(dash),
      specials: (s.special || []).map(dash),
      cons: (s.cons || []).map(dash),
    };
  }

  const c = (snap.cards || {})[cls] as Record<string, string> | undefined;
  if (!c) return null;
  const many = (prefix: string, n: number) =>
    Array.from({ length: n }, (_, i) => dash(c[prefix + (i + 1)])).filter((v) => v !== "-");
  return {
    date: latin(c.date) || "",
    drawNo: latin(c.draw_no) || "",
    prizes: [dash(c.first_prize), dash(c.second_prize), dash(c.third_prize)],
    specials: many("special-", 15),
    cons: many("consolation-", 10),
  };
}

export async function GET(req: NextRequest) {
  const slug = (req.nextUrl.searchParams.get("game") || "magnum").toLowerCase();
  const def = gameBySlug[slug];
  const extra = EXTRA[slug];
  if (!def && !extra) return NextResponse.json({ error: "unknown game" }, { status: 404 });

  const snap = await getSnapshot();
  const card = cardFromSnapshot(slug, snap);
  if (!card) return NextResponse.json({ error: "no result" }, { status: 404 });
  const title = latin(def ? def.name : extra.name);

  const lines: Line[] = [];
  const left = 48;
  let y = PAGE_H - 74;

  lines.push({ text: "MKT 88  4D Results", x: left, y, size: 20, bold: true });
  y -= 30;
  lines.push({ text: title + "  Result", x: left, y, size: 15, bold: true });
  y -= 16;
  const meta = [card.date ? "Date: " + card.date : "", card.drawNo ? "Draw No: " + card.drawNo : ""]
    .filter(Boolean).join("     ");
  lines.push({ text: meta, x: left, y, size: 10 });
  y -= 14;

  // Rule under the header.
  const rule = (yy: number) =>
    `0.80 0.80 0.82 RG 0.7 w ${left} ${yy} m ${PAGE_W - left} ${yy} l S\n0.09 0.09 0.10 rg`;
  let rules = rule(y);
  y -= 26;

  const prizeNames = ["1st Prize", "2nd Prize", "3rd Prize"];
  for (let i = 0; i < 3; i++) {
    lines.push({ text: prizeNames[i], x: left, y, size: 11 });
    lines.push({ text: card.prizes[i] || "-", x: left + 110, y, size: 16, bold: true });
    y -= 24;
  }

  const block = (title: string, values: string[]) => {
    if (!values.length) return;
    y -= 8;
    lines.push({ text: title, x: left, y, size: 11, bold: true });
    y -= 20;
    for (let i = 0; i < values.length; i += 5) {
      lines.push({ text: values.slice(i, i + 5).join("    "), x: left, y, size: 12 });
      y -= 18;
    }
  };
  block("SPECIAL", card.specials);
  block("CONSOLATION", card.cons);

  // Footer: the app link, which stays clickable in the PDF.
  const footY = 96;
  lines.push({ text: "Every live draw, all 11 games - free in the MKT 88 app", x: left, y: footY + 34, size: 11, bold: true });
  lines.push({ text: PLAY_URL, x: left, y: footY + 14, size: 11 });
  lines.push({ text: SITE, x: left, y: footY - 4, size: 10 });

  // The link annotation sits over the Play Store line so it can be tapped.
  const linkRect = `[${left} ${footY + 10} ${left + 360} ${footY + 28}]`;
  const annot = `<< /Type /Annot /Subtype /Link /Rect ${linkRect} /Border [0 0 0] /A << /Type /Action /S /URI /URI (${esc(PLAY_URL)}) >> >>`;

  const stream = rules + "\n" + content(lines);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R /Annots [7 0 R] >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
    annot,
  ];

  const pdf = makePdf(objects);
  const file = (latin(slug) || "result") + "-" + (latin(card.date).replace(/[^0-9-]/g, "") || "latest") + ".pdf";

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${file}"`,
      "cache-control": "no-store",
    },
  });
}
