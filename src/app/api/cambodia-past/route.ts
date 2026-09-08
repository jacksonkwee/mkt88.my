import { NextRequest, NextResponse } from "next/server";
import https from "https";
import { getViewHtml } from "../../../components/sites/live4dresult-net-0600c55d/root-8a5edab2/past-data";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": UA, Accept: "*/*" }, timeout: 20000 }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout")));
  });
}

type Set = { prize: string[]; special: string[]; cons: string[]; date?: string; drawNo?: string };

function textLines(html: string): string[] {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .split("\n")
    .map((l) => l.trim());
}

function weekdayOf(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  const p = iso.split("-");
  const w = d.toLocaleDateString("en-US", { weekday: "short" });
  return `${p[2]}-${p[1]}-${p[0]} (${w})`;
}

function parsePerdanaHtml(html: string): Record<string, Set> {
  const lines = textLines(html);
  const out: Record<string, Set> = {};
  const markers: number[] = [];
  lines.forEach((l, i) => { if (/^\d{8}4D$/.test(l) || /^\d{12}4D$/.test(l)) markers.push(i); });
  for (let mi = 0; mi < markers.length; mi++) {
    const start = markers[mi];
    const end = mi + 1 < markers.length ? markers[mi + 1] : lines.length;
    const block = lines.slice(start, end);
    const dateM = /^(\d{4})(\d{2})(\d{2})/.exec(block[0] || "");
    const iso = dateM ? `${dateM[1]}-${dateM[2]}-${dateM[3]}` : undefined;
    const timeLine = block.slice(1, 10).find((l) => /^(\d{1,2}:\d{2})$/.test(l));
    if (!timeLine) continue;
    const pIdx = block.findIndex((l) => /^3rd Prize$/i.test(l));
    const sIdx = block.findIndex((l) => /^Special$/i.test(l));
    const cIdx = block.findIndex((l) => /^Consolation$/i.test(l));
    const eIdx = block.findIndex((l) => /^(2D|3D|6D) Results$/i.test(l));
    const val = (l: string): string | null => {
      const cmb = /^\([A-Z]\)\s*(----|\d{4})$/.exec(l);
      if (cmb) return cmb[1];
      if (/^(----|\d{4})$/.test(l)) return l;
      return null;
    };
    const prize: string[] = [];
    if (pIdx >= 0 && sIdx > pIdx) {
      for (let i = pIdx + 1; i < sIdx && prize.length < 3; i++) {
        const v = val(block[i]);
        if (v) prize.push(v);
        else if (/^\([A-Z]\)$/.test(block[i]) && i + 1 < sIdx) {
          const nv = val(block[i + 1]);
          if (nv && /^\d/.test(block[i + 1])) { prize.push(nv); i++; }
        }
      }
      while (prize.length < 3) prize.push("----");
    }
    const grab = (from: number, to: number): string[] => {
      const vals: string[] = [];
      for (let i = from; i < to; i++) {
        const l = block[i];
        if (!l) continue;
        const cmb = /^\([A-Z]\)\s*(----|\d{4})$/.exec(l);
        if (cmb) { vals.push(cmb[1]); continue; }
        if (/^\(([A-Z])\)$/.test(l) && i + 1 < to) {
          const nv = /^(----|\d{4})$/.exec(block[i + 1]);
          if (nv) { vals.push(nv[1]); i++; }
        }
      }
      return vals;
    };
    const special = sIdx >= 0 ? grab(sIdx + 1, cIdx > sIdx ? cIdx : eIdx > sIdx ? eIdx : lines.length) : [];
    const cons = cIdx >= 0 ? grab(cIdx + 1, eIdx > cIdx ? eIdx : lines.length) : [];
    out[timeLine] = { prize, special, cons, date: iso ? weekdayOf(iso) : undefined };
  }
  return out;
}

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];
const CONS = ["N", "O", "P", "Q", "R", "S", "T", "U", "V", "W"];

function parseHariJson(j: any): Set | null {
  if (!j || !j.prize1) return null;
  const special = LETTERS.map((L) => String(j["prize" + L] ?? "----"));
  const cons = CONS.map((L) => String(j["prize" + L] ?? "----"));
  const iso = typeof j.drawDate === "string" ? j.drawDate.slice(0, 10) : undefined;
  return {
    prize: [j.prize1, j.prize2, j.prize3].map(String),
    special, cons,
    drawNo: j.id != null ? String(j.id) : undefined,
    date: iso ? weekdayOf(iso) : undefined,
  };
}


function extractCard(html: string, idPrefix: string): string {
  const key = 'class="card outer-box ' + idPrefix;
  const s = html.indexOf(key);
  if (s < 0) return "";
  let i = s;
  let depth = 0;
  const len = html.length;
  while (i < len) {
    const open = html.indexOf("<div", i);
    const close = html.indexOf("</div>", i);
    if (close === -1 || (open !== -1 && open < close)) { depth++; i = open + 4; }
    else { depth--; i = close + 6; if (depth === 0) break; }
  }
  return html.slice(s, i);
}

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "bad date" }, { status: 400 });
  try {
    const [y, m, d] = date.split("-");
    // Perdana official
    const perdanaHtml = await httpGet("https://www.perdana4d.com/Results/4D?processDate=" + date);
    const perd = parsePerdanaHtml(perdanaHtml);
    // HariHari official JSON
    const hari: Record<string, Set | null> = { "15:30": null, "19:30": null };
    for (const t of ["15:30", "19:30"] as const) {
      const u = `https://api.hari4d.com/DrawResultL/GetDrawResult?date=${Number(y)}-${Number(m)}-${Number(d)}T${t}:00`;
      try { hari[t] = parseHariJson(JSON.parse(await httpGet(u))); } catch { hari[t] = null; }
    }
    const khHtml = getViewHtml(date, "kh");
    const gdHtml = khHtml ? extractCard(khHtml, "table-13") : "";
    return NextResponse.json({ date, gdHtml, perdana: perd, hari });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
