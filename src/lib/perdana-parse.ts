/**
 * Parse the official Perdana 4D page into the two draws it publishes.
 *
 * Two shapes are accepted because the page arrives differently depending on how
 * it was fetched: raw HTML (values in 4dFirst / 4dSecond / 4dThird classes and
 * fourDPosition attributes) or plain text (values after the printed labels).
 */
export type PerdanaSet = { prize: string[]; special: string[]; cons: string[]; date: string };

const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pretty(iso: string): string {
  const [y, m, d] = iso.split("-");
  const dt = new Date(iso + "T12:00:00Z");
  const wk = Number.isNaN(dt.getTime()) ? "" : WEEK[dt.getUTCDay()];
  return d + "-" + m + "-" + y + (wk ? " (" + wk + ")" : "");
}

const VALUE = /^(?:\([A-Z]\)\s*)?(----|\d{4})$/;

export function perdanaFromHtml(html: string): Record<string, PerdanaSet> {
  const out: Record<string, PerdanaSet> = {};

  // Shape 1: raw HTML with the value classes and position attributes.
  if (/4dFirst/.test(html)) {
    for (const block of html.split(/(?=\d{12}4D|\d{8}4D)/).slice(1)) {
      const time = (block.match(/>(\d{1,2}:\d{2})</) || [])[1];
      if (!time) continue;
      const val = (re: RegExp): string => {
        const m = re.exec(block);
        return m && m[1] ? m[1] : "----";
      };
      const cell = (cls: string) => val(new RegExp('class="[^"]*' + cls + '"[^>]*>\\s*(?:\\([A-Z]\\)\\s*)?(----|\\d{4})'));
      const byPos = (letters: string) =>
        [...letters].map((L) => val(new RegExp('fourDPosition="[^"]*' + L + '"[^>]*>\\s*(?:\\([A-Z]\\)\\s*)?(----|\\d{4})')));
      const stamp = /^(\d{4})(\d{2})(\d{2})/.exec(block.trim().slice(0, 12));
      const set: PerdanaSet = {
        prize: [cell("4dFirst"), cell("4dSecond"), cell("4dThird")],
        special: byPos("ABCDEFGHIJKLM"),
        cons: byPos("NOPQRSTUVW"),
        date: stamp ? pretty(stamp[1] + "-" + stamp[2] + "-" + stamp[3]) : "",
      };
      if (set.prize.some((v) => !/^----+$/.test(v)) && !out[time]) out[time] = set;
    }
    if (Object.keys(out).length) return out;
  }

  // Shape 2: plain text - the marker line, then the time, then the values.
  const lines = html.split(/\r?\n/).map((l) => l.trim());
  const marks: number[] = [];
  lines.forEach((l, i) => { if (/^\d{8}4D$/.test(l) || /^\d{12}4D$/.test(l)) marks.push(i); });
  for (let m = 0; m < marks.length; m++) {
    const start = marks[m];
    const end = m + 1 < marks.length ? marks[m + 1] : lines.length;
    const block = lines.slice(start, end);
    const dm = /^(\d{4})(\d{2})(\d{2})/.exec(block[0] || "");
    const stamp = dm ? dm[1] + "-" + dm[2] + "-" + dm[3] : "";
    const time = block.slice(1, 8).find((l) => /^\d{1,2}:\d{2}$/.test(l));
    if (!time) continue;
    const at = (re: RegExp) => block.findIndex((l) => re.test(l));
    const pIdx = at(/^3rd Prize$/i);
    const sIdx = at(/^Special$/i);
    const cIdx = at(/^Consolation$/i);
    const grab = (from: number, to: number, max: number): string[] => {
      const vals: string[] = [];
      for (let i = from; i < to && vals.length < max; i++) {
        const mm = VALUE.exec(block[i]);
        if (mm) vals.push(mm[1]);
      }
      return vals;
    };
    const prize = pIdx >= 0 && sIdx > pIdx ? grab(pIdx + 1, sIdx, 3) : [];
    while (prize.length < 3) prize.push("----");
    const special = sIdx >= 0 ? grab(sIdx + 1, cIdx > sIdx ? cIdx : block.length, 13) : [];
    while (special.length < 13) special.push("----");
    const cons = cIdx >= 0 ? grab(cIdx + 1, block.length, 10) : [];
    while (cons.length < 10) cons.push("----");
    const set: PerdanaSet = { prize, special, cons, date: stamp ? pretty(stamp) : "" };
    if (set.prize.some((v) => !/^----+$/.test(v)) && !out[time]) out[time] = set;
  }
  return out;
}
