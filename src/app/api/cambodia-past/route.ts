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
  return p[2] + "-" + p[1] + "-" + p[0] + " (" + w + ")";
}

function parsePerdanaHtml(html: string): Record<string, Set> {
  const lines = textLines(html);
  const out: Record<string, Set> = {};
  const markers: number[] = [];
  lines.forEach((l, i) => {
    if (/^\d{8}4D$/.test(l) || /^\d{12}4D$/.test(l)) markers.push(i);
  });
  for (let mi = 0; mi < markers.length; mi++) {
    const start = markers[mi];
    const end = mi + 1 < markers.length ? markers[mi + 1] : lines.length;
    const block = lines.slice(start, end);
    const dateM = /^(\d{4})(\d{2})(\d{2})/.exec(block[0] || "");
    const iso = dateM ? dateM[1] + "-" + dateM[2] + "-" + dateM[3] : undefined;
    const timeLine = block.slice(1, 10).find((l) => /^(\d{1,2}:\d{2})$/.test(l));
    if (!timeLine) continue;
    const pIdx = block.findIndex((l) => /^3rd Prize$/i.test(l));
    const sIdx = block.findIndex((l) => /^Special$/i.test(l));
    const cIdx = block.findIndex((l) => /^Consolation$/i.test(l));
    const eIdx = block.findIndex((l) => /^(2D|3D|6D) Results$/i.test(l));
    const prize: string[] = [];
    if (pIdx >= 0 && sIdx > pIdx) {
      for (let i = pIdx + 1; i < sIdx && prize.length < 3; i++) {
        const cmb = /^\([A-Z]\)\s*(----|\d{4})$/.exec(block[i]);
        if (cmb) { prize.push(cmb[1]); continue; }
        if (/^(----|\d{4})$/.test(block[i])) { prize.push(block[i]); continue; }
        if (/^\([A-Z]\)$/.test(block[i]) && i + 1 < sIdx && /^(----|\d{4})$/.test(block[i + 1])) { prize.push(block[i + 1]); i++; }
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
    special,
    cons,
    drawNo: j.id != null ? String(j.id) : undefined,
    date: iso ? weekdayOf(iso) : undefined,
  };
}

function innerText(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").trim();
}

function extractCard(html: string, idPrefix: string): string {
  const key = "class=\"card outer-box " + idPrefix;
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

function parseCardHtml(cardHtml: string): { prize: string[]; special: string[]; cons: string[] } {
  const prize: string[] = [];
  const special: string[] = [];
  const cons: string[] = [];
  const tables = cardHtml.split(/<table/i).slice(1);
  const nums = (seg: string): string[] =>
    [...seg.matchAll(/class="[^"]*lottery-(?:prize-)?number[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/t[dh]>/gi)]
      .map((m) => innerText(m[1]))
      .filter((v) => v && v !== "&nbsp;");
  if (tables[0]) {
    for (const r of tables[0].split(/<tr/i).slice(1)) {
      const m = /class="[^"]*lottery-prize-number[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/t[dh]>/i.exec(r);
      if (m) prize.push(innerText(m[1]));
    }
  }
  if (tables[1]) special.push(...nums(tables[1]));
  if (tables[2]) cons.push(...nums(tables[2]));
  return { prize: prize.slice(0, 3), special: special.slice(0, 13), cons: cons.slice(0, 10) };
}

function parseNineSetHtml(html: string): Set | null {
  const lines = textLines(html).filter(Boolean);
  const idx = lines.findIndex((l) => /^DRAW NO:$/i.test(l) || /^DRAW$/i.test(l) || /^NO:$/i.test(l));
  if (idx < 0) return null;
  const around = (lines[idx] + " " + (lines[idx + 1] || "") + " " + (lines[idx + 2] || "")).replace(/\s+/g, " ");
  const dm = /(\d+)\/(\d{4})/.exec(around);
  const prize: string[] = [];
  const special: string[] = [];
  const cons: string[] = [];
  for (let k = idx + 1; k < lines.length - 1; k++) {
    const a = lines[k];
    if (/^(2D|3D|6D|JACKPOT|SUPER|CONTACT)$/i.test(a)) break;
    const colonM = /^([A-W])\s*:$/.exec(a);
    if (colonM) {
      const nv = /^(----|\d{4})$/.exec(lines[k + 1] || "");
      if (nv) {
        const L = colonM[1];
        if (L >= "N" && L <= "W") cons.push(nv[1]); else special.push(nv[1]);
        k++;
        continue;
      }
    }
    if (/^[A-W]$/.test(a) && lines[k + 1] === ":") {
      const nv = /^(----|\d{4})$/.exec(lines[k + 2] || "");
      if (nv) { if (a >= "N" && a <= "W") cons.push(nv[1]); else special.push(nv[1]); k += 2; continue; }
    }
    if (/^[A-W]$/.test(a) && /^(----|\d{4})$/.test(lines[k + 1]) && lines[k + 2] !== ":") {
      if (prize.length < 3) prize.push(lines[k + 1]);
      k++;
    }
  }
  while (prize.length < 3) prize.push("----");
  return { prize, special: special.slice(0, 13), cons: cons.slice(0, 10), drawNo: dm ? dm[1] + "/" + dm[2] : undefined };
}

async function fetchNineLatest(): Promise<Set | null> {
  return parseNineSetHtml(await httpGet("https://9lotto.com/result"));
}


// Nine Lotto official draw 1482/2026 (07-09-2026) - bundled so Render does not need to reach 9lotto.com
const NINE_0709 = {
  prize: ["8834", "6782", "7728"],
  special: ["7039", "----", "3193", "8634", "6227", "----", "7146", "4548", "----", "4322", "6901", "3398", "2327"],
  cons: ["1549", "3718", "0127", "8275", "9865", "8644", "4039", "8654", "3560", "0941"],
  drawNo: "1482/2026",
};

type SixParts = { main: string; subs: Record<string, string> };
function deriveSixParts(p0: string, p1: string, p2: string): SixParts | null {
  if (!/^\d{4}$/.test(p0) || !/^\d{4}$/.test(p1) || !/^\d{4}$/.test(p2)) return null;
  const main = p0[0] + p1[0] + p2[0] + p0[3] + p1[3] + p2[3];
  return {
    main,
    subs: {
      six_2a: main.slice(0, 5), six_2b: main.slice(1),
      six_3a: main.slice(0, 4), six_3b: main.slice(2),
      six_4a: main.slice(0, 3), six_4b: main.slice(3),
      six_5a: main.slice(0, 2), six_5b: main.slice(4),
    },
  };
}
function cleanHtml(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ");
}

/** Parse Grand Dragon 4D (prize/special/consolation) from an official results page. */
function parseGdFourHtml(html: string): Set | null {
  const lines = textLines(html).filter(Boolean);
  const idx4d = lines.findIndex((l) => /^4D$/.test(l));
  if (idx4d < 0) return null;
  const prize: string[] = [];
  const takeP = (label: string) => {
    const li = lines.indexOf(label, idx4d);
    if (li < 0) return "----";
    for (let k = li + 1; k < lines.length && k < li + 8; k++) {
      const m = /^(----|\d{4})$/.exec(lines[k]);
      if (m) return m[1];
    }
    return "----";
  };
  prize.push(takeP("1st Prize"), takeP("2nd Prize"), takeP("3rd Prize"));
  const special: string[] = [];
  const cons: string[] = [];
  const si = lines.indexOf("Special Prize", idx4d);
  const ci = lines.indexOf("Consolation Prize", idx4d);
  const grab = (from: number, to: number, letters: string[]) => {
    const out: string[] = [];
    let li = from;
    while (li >= 0 && li < to && out.length < letters.length) {
      const L = letters[out.length];
      const ai = lines.indexOf(L, li);
      if (ai < 0 || ai >= to) break;
      const nv = /^(----|\d{4})$/.exec(lines[ai + 1] || "");
      out.push(nv ? nv[1] : "----");
      li = ai + 2;
    }
    return out;
  };
  const A_M = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];
  const N_W = ["N", "O", "P", "Q", "R", "S", "T", "U", "V", "W"];
  if (si >= 0) special.push(...grab(si + 1, ci > si ? ci : lines.length, A_M));
  if (ci >= 0) cons.push(...grab(ci + 1, lines.length, N_W));
  while (special.length < 13) special.push("----");
  while (cons.length < 10) cons.push("----");
  return { prize: prize.slice(0, 3), special: special.slice(0, 13), cons: cons.slice(0, 10) };
}

/** Grand Dragon 6D + jackpot info for a past draw date. */
async function gdPastParts(date: string): Promise<{ four?: Set; gd6?: SixParts; gdjp4?: Record<string, string>; gdjp7?: Record<string, string> } | null> {
  try {
    const [y, m, d] = date.split("-");
    const html = await httpGet("https://gdlotto.net/results/ajax/_result.aspx?past=1&v=1&d=" + m + "/" + d + "/" + y);
    const txt = cleanHtml(html);
    const out: { four?: Set; gd6?: SixParts; gdjp4?: Record<string, string>; gdjp7?: Record<string, string> } = {};
    const m6 = /6D\s*1st\s*Prize\s+([0-9](?:\s*[0-9]){5})/.exec(txt);
    if (m6) {
      const main = m6[1].replace(/\s+/g, "");
      out.gd6 = { main, subs: mainSubs(main) };
    }
    const pool4 = /id="4d_jpool">([^<]+)</.exec(html);
    const letter4 = /id="4d_jpalphnum">([^<]*)</.exec(html);
    const units4 = /id="4d_jptotalunit">([^<]*)</.exec(html);
    if (pool4 || letter4 || units4) {
      out.gdjp4 = {};
      if (pool4) out.gdjp4.jp4_pool = pool4[1].trim();
      if (letter4 && letter4[1].trim()) out.gdjp4.jp4_letter = letter4[1].trim();
      if (units4 && units4[1].trim()) out.gdjp4.jp4_units = units4[1].trim();
    }
    const pool7 = /class="7d_JPool">([^<]+)</.exec(html);
    const gdDigits: string[] = [];
    for (let i = 0; i < 7; i++) {
      const mm = new RegExp('class="L7_' + i + '">([^<]+)</span>').exec(html);
      if (mm) gdDigits.push(mm[1].trim());
    }
    if (pool7 || gdDigits.length === 7) {
      out.gdjp7 = {};
      if (pool7) out.gdjp7.jp7_pool = pool7[1].trim();
      if (gdDigits.length === 7) {
        const g7 = gdDigits.join("");
        if (/^\d{7}$/.test(g7)) out.gdjp7.jp7_grand = g7.slice(0, 6) + " + " + g7[6];
      }
    }
    const gdFour = parseGdFourHtml(html);
    if (gdFour) out.four = gdFour;
    return out;
  } catch {
    return null;
  }
}
function mainSubs(main: string): Record<string, string> {
  return {
    six_2a: main.slice(0, 5), six_2b: main.slice(1),
    six_3a: main.slice(0, 4), six_3b: main.slice(2),
    six_4a: main.slice(0, 3), six_4b: main.slice(3),
    six_5a: main.slice(0, 2), six_5b: main.slice(4),
  };
}

/** Nine Lotto 6D (derived) + Super Jackpot for a past draw date (/result/YYYY-M-D). */
async function ninePastParts(date: string): Promise<{ four?: Set; nine6?: SixParts; nineJp?: Record<string, string> } | null> {
  try {
    const [y, m, d] = date.split("-");
    const html = await httpGet("https://9lotto.com/result/" + y + "-" + Number(m) + "-" + Number(d));
    const txt = cleanHtml(html);
    const out: { four?: Set; nine6?: SixParts; nineJp?: Record<string, string> } = {};
    const poolM = /result-sjp-lg">\s*([^<]+)</.exec(html) || /USD\s*([\d,]+\.\d{2})/.exec(txt);
    const pool = poolM ? poolM[1].replace(/\s+/g, " ").trim() : undefined;
    const rows: Record<string, string> = {};
    const nums: string[] = [];
    const trRe = /<tr class="result-numbersjp">([\s\S]*?)<\/tr>/g;
    let mm2: RegExpExecArray | null;
    let guard = 0;
    while ((mm2 = trRe.exec(html)) && guard++ < 20) {
      const block = mm2[1];
      const lblM = /class="char1">([^<]+)</.exec(block);
      const valM = [...block.matchAll(/class="result-sjp-prize"[^>]*>([^<]+)</g)].map((x) => x[1].trim());
      const label = lblM ? lblM[1].trim() : "";
      const key = "n9_sj_" + label.replace(/\s*prize$/i, "").trim().toLowerCase();
      if (key && valM.length >= 3) rows[key] = valM.join(" + ");
      if (valM.length >= 3) nums.push(valM[valM.length - 1]);
    }
    const jp: Record<string, string> = {};
    if (pool) jp.n9_sj_pool = pool;
    for (const [k, v] of Object.entries(rows)) if (v) jp[k] = v;
    if (Object.keys(jp).length) out.nineJp = jp;
    if (nums.length >= 3) {
      const sp = deriveSixParts(nums[0], nums[1], nums[2]);
      if (sp) out.nine6 = sp;
      // 4D prizes come from the same draw numbers shown on the Super Jackpot lines
      const four = parseNineSetHtml(html);
      const special = four && four.special ? four.special : [];
      const cons = four && four.cons ? four.cons : [];
      out.four = { prize: [nums[0], nums[1], nums[2]], special, cons };
    }
    return out;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "bad date" }, { status: 400 });
  try {
    const ymd = date.split("-");
    const perdanaHtml = await httpGet("https://www.perdana4d.com/Results/4D?processDate=" + date);
    const perd = parsePerdanaHtml(perdanaHtml);
    const hari: Record<string, any> = { "15:30": null, "19:30": null };
    for (const t of ["15:30", "19:30"] as const) {
      try {
        const u = "https://api.hari4d.com/DrawResultL/GetDrawResult?date=" + ymd[0] + "-" + Number(ymd[1]) + "-" + Number(ymd[2]) + "T" + t + ":00";
        const j = JSON.parse(await httpGet(u));
        const set = parseHariJson(j);
        const six = j && j.prize6D ? { main: String(j.prize6D), subs: mainSubs(String(j.prize6D)) } : null;
        let jp: Record<string, string> | null = null;
        try {
          const ju = "https://api.hari4d.com/Jackpot/GetJackpot?date=" + ymd[0] + "-" + Number(ymd[1]) + "-" + Number(ymd[2]) + "T" + t + ":00";
          const jj = JSON.parse(await httpGet(ju));
          if (jj && jj.jackpotAmount != null) {
            jp = { jp_pool: "USD " + Number(jj.jackpotAmount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) };
            const nums: string[] = [];
            if (jj.number) nums.push(String(jj.number));
            if (jj.number2) nums.push(String(jj.number2));
            if (nums.length) jp.jp_no = nums.join(" or ");
          }
        } catch { jp = null; }
        hari[t] = { set, six, jp };
      } catch { hari[t] = null; }
    }
    const khHtml = getViewHtml(date, "kh");
    let gd = khHtml ? parseCardHtml(extractCard(khHtml, "table-13")) : null;
    let nine = khHtml ? parseCardHtml(extractCard(khHtml, "table-17")) : null;
    if (!nine || !nine.prize || !nine.prize[0]) {
      try {
        nine = parseNineSetHtml(await httpGet("https://9lotto.com/result/" + ymd[0] + "-" + Number(ymd[1]) + "-" + Number(ymd[2])));
      } catch { /* ignore */ }
    }
    if ((!nine || !nine.prize || !nine.prize[0]) && date === "2026-09-07") {
      nine = { ...NINE_0709 };
    }
    const [gdParts, nineParts] = await Promise.all([gdPastParts(date), ninePastParts(date)]);
    if ((!gd || !gd.prize || !gd.prize[0]) && gdParts && gdParts.four) {
      gd = gdParts.four;
    }
    if ((!nine || !nine.prize || !nine.prize[0]) && nineParts && nineParts.four) {
      nine = nineParts.four;
    }
    return NextResponse.json({
      date, gd, nine,
      gd6: gdParts?.gd6 || null, gdjp4: gdParts?.gdjp4 || null, gdjp7: gdParts?.gdjp7 || null,
      nine6: nineParts?.nine6 || null, nineJp: nineParts?.nineJp || null,
      perdana: perd, hari,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
