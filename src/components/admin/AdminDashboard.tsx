"use client";

import { useEffect, useState } from "react";
import cardsRaw from "../sites/mkt88/app/cards-data.json";
import lottoRaw from "../sites/mkt88/app/lotto-data.json";
import { EAST_CARDS } from "../sites/mkt88/app/east-cards";
import { SG_CARDS } from "../sites/mkt88/app/sg-cards";

type Any = Record<string, any>;

/**
 * 备用：手动纠正。
 *
 * Every game now updates itself from its operator, so this panel is only for
 * the day a source refuses our server or one cell needs fixing. The cells are
 * read from the cards themselves, so the boxes always match the board - there
 * is no second list to keep in step.
 */
const MANUAL_GAMES = [
  "Magnum 4D", "Da Ma Cai", "Sports Toto", "Singapore 4D", "Sabah 88", "Cash Sweep",
  "Sandakan", "Grand Dragon", "Nine Lotto", "Perdana", "Lucky HariHari",
];

const CLASS_GAME: Record<string, string> = {
  "table-1": "Magnum 4D", "table-2": "Magnum 4D", "table-3": "Magnum 4D",
  "table-4": "Da Ma Cai", "table-5": "Da Ma Cai",
  "table-6": "Sports Toto", "table-7": "Sports Toto",
  "table-8": "Sandakan", "table-9": "Cash Sweep", "table-10": "Sabah 88",
  "table-10-lotto": "Sabah 88",
  "table-11": "Singapore 4D", "table-12": "Singapore 4D",
  "table-13": "Grand Dragon", "table-14": "Grand Dragon",
  "table-15": "Lucky HariHari", "table-16": "Perdana",
  "table-17": "Nine Lotto", "table-18": "Nine Lotto",
};

type ManualCard = { id: string; cls: string; name: string; game: string; fields: string[] };

const MANUAL_CARDS: ManualCard[] = (() => {
  const raw = [
    ...((cardsRaw as unknown as { cards: Any[] }).cards || []),
    ...((lottoRaw as unknown as { cards: Any[] }).cards || []),
    ...(EAST_CARDS as unknown as Any[]),
    ...(SG_CARDS as unknown as Any[]),
  ];
  const seen = new Set<string>();
  /*
   * Sabah 88's three Lotto boards share one table-10-lotto card class. The
   * owner needs every cell, so they are one manual card with the union of
   * their fields - the server writes that union to the shared class and each
   * public card renders the ids it owns.
   */
  const byCls = new Map<string, ManualCard>();
  for (const c of raw) {
    /*
     * The class list can carry extra markers (Singapore Toto is
     * "card outer-box mkt-static table-12"), so take the table-N token rather
     * than the first word. This is why table-12 never appeared in the manual
     * list before.
     */
    const cls = (String(c.cardCls || "").match(/\btable-\d+(?:-[a-z0-9]+)*\b/) || [""])[0];
    // The 3-cell Perdana/HariHari cards are the prize rows only; the full
    // 26-cell cards are added below and drive the public board.
    if (!cls || cls === "table-15" || cls === "table-16") continue;
    const game = CLASS_GAME[cls];
    if (!game || seen.has(c.id)) continue;
    const fields: string[] = [];
    for (const tb of c.tables || []) {
      for (const row of tb.rows || []) {
        for (const cell of row.cells || []) {
          const id = cell?.attrs?.["data-id"];
          if (id && id !== "date" && id !== "draw_no" && !fields.includes(id)) fields.push(id);
        }
      }
    }
    if (!fields.length) continue;
    seen.add(c.id);
    const name = c.header?.name || c.id;
    const existing = byCls.get(cls);
    if (existing) {
      for (const f of fields) if (!existing.fields.includes(f)) existing.fields.push(f);
      if (!existing.name.split(" / ").includes(name)) existing.name += " / " + name;
    } else {
      byCls.set(cls, { id: c.id, cls, name, game, fields });
    }
  }
  const out: ManualCard[] = [...byCls.values()];
  /*
   * Cards whose boxes changed shape since the page was captured.
   *
   * The grid is built from the captured markup, so when the Grand Dragon 6D
   * card moved from jp7_pool to jp_pool (and never had a letter box captured at
   * all) those fields simply had no cell to type into. They are added here for
   * every card, whatever the capture holds.
   */
  const EXTRA_FIELDS: Record<string, string[]> = {
    "table-14": ["six_main", "jp_pool", "jp7_pool", "jp7_grand", "jp_letter", "jp_units"],
    "table-13": ["jp_pool", "jp7_pool", "jp7_grand", "jp_letter", "jp_units"],
  };
  for (const card of out) {
    for (const f of EXTRA_FIELDS[card.cls] || []) {
      if (!card.fields.includes(f)) card.fields.push(f);
    }
  }
  /*
   * Perdana and HariHari 4D: drawn by position, so there are no data-ids to
   * read. Their boxes are the operator's own letters - A-M specials, N-W
   * consolations - plus the three prizes, which come out of three of those
   * boxes. Two sessions each: the 3:30 and the 7:30.
   */
  const LETTERS = [..."ABCDEFGHIJKLM", ..."NOPQRSTUVW"];
  const slots: [string, string, string][] = [
    ["perdana:15:30", "Perdana 4D (3:30PM)", "Perdana"],
    ["perdana:19:30", "Perdana 4D (7:30PM)", "Perdana"],
    ["hari:15:30", "Lucky HariHari 4D (3:30PM)", "Lucky HariHari"],
    ["hari:19:30", "Lucky HariHari 4D (7:30PM)", "Lucky HariHari"],
  ];
  for (const [cls, name, game] of slots) {
    out.push({ id: cls, cls, name, game, fields: ["1ST", "2ND", "3RD", ...LETTERS] });
  }
  return out;
})();

/**
 * Sports Toto 5D and 6D: only the first numbers are typed.
 *
 * 5D prints 4th/5th/6th as the 1st prize's last four, three and two digits;
 * 6D prints 2nd-5th as the first/last five, four, three and two digits of its
 * six-digit number. The operator's board works that way, so the boxes here do
 * too - typed once, the rest of the row fills itself in.
 */
function totoDerived(vals: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  const five = String(vals["d5_number_1"] || "").trim();
  if (/^\d{5}$/.test(five)) {
    out["d5_number_4"] = five.slice(-4);
    out["d5_number_5"] = five.slice(-3);
    out["d5_number_6"] = five.slice(-2);
  }
  const six = String(vals["d6_number_1"] || "").trim();
  if (/^\d{6}$/.test(six)) {
    for (const n of [2, 3, 4, 5]) {
      out["d6_first_number_" + n] = six.slice(0, 7 - n) + "*".repeat(n - 1);
      out["d6_second_number_" + n] = "*".repeat(n - 1) + six.slice(n - 1);
    }
  }
  return out;
}

const TOTO_AUTO = new Set(["d5_number_4", "d5_number_5", "d5_number_6",
  "d6_first_number_2", "d6_second_number_2", "d6_first_number_3", "d6_second_number_3",
  "d6_first_number_4", "d6_second_number_4", "d6_first_number_5", "d6_second_number_5"]);

/** "special-3" reads C, "consolation-1" reads N - the operator's own letters. */
function cellLabel(f: string): string {
  const sp = /^special-(\\d+)$/.exec(f);
  if (sp) return "ABCDEFGHIJKLM"[Number(sp[1]) - 1] || f;
  const cn = /^consolation-(\\d+)$/.exec(f);
  if (cn) return "NOPQRSTUVW"[Number(cn[1]) - 1] || f;
  return f;
}

/** "I=1912" lines and the grid of boxes are two views of the same thing. */
function parseManualText(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  /*
   * The grid writes the cell's own data-id, and Toto's are long:
   * d5_number_1, d6_first_number_2. The old 1-3 character key dropped every
   * one of them, so a typed Toto board looked empty the moment it was read
   * back. Keep the data-id exactly as written; only the short prize aliases
   * are kept in their original case so the 1ST/2ND/3RD boxes match the grid.
   */
  for (const m of String(text || "").matchAll(/([A-Za-z][A-Za-z0-9_-]{0,48}|[0-9][A-Za-z0-9]{0,2})\s*[:=]\s*(\d{1,7})/g)) {
    const raw = m[1];
    const upper = raw.toUpperCase();
    // Old entries saved "1st"; the grid's boxes are 1ST. Normalise the three
    // prize labels so both forms point at the same box.
    out[upper === "1ST" || upper === "2ND" || upper === "3RD" ? upper : raw] = m[2];
  }
  /*
   * Anything that is not a bare number - a letter, a money figure, a status
   * word, a star pattern - kept falling out of the grid, so it vanished from the
   * box the moment the panel redrew and never reached the store. Read those
   * lines too, without touching what the pass above already filled.
   */
  for (const line of String(text || "").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z][A-Za-z0-9_-]{0,48})\s*[:=]\s*(.+?)\s*$/.exec(line);
    if (!m) continue;
    if (out[m[1]] === undefined && out[m[1].toUpperCase()] === undefined) out[m[1]] = m[2];
  }
  if (!Object.keys(out).length) {
    const bare = String(text || "").match(/\d{6,7}/);
    if (bare) out["6D"] = bare[0].slice(0, 6);
  }
  return out;
}
const buildManualText = (vals: Record<string, string>): string =>
  Object.entries(vals)
    .filter(([, v]) => String(v || "").trim())
    .map(([k, v]) => k + "=" + String(v).trim())
    .join("\n");

/**
 * This device's push token, when the page is opened inside the app.
 *
 * Module scope on purpose: the dashboard returns early while it is still
 * loading, so anything declared after that return is never initialised - and
 * the effect above still calls it, which crashed the whole page with "a
 * client-side exception has occurred" (reported 15 Oct 2026).
 */
function deviceToken(): string {
  try { return window.localStorage.getItem("mkt_push_token") || ""; } catch { return ""; }
}

/**
 * One settings function per panel. The page lists what can be changed and
 * opens only the one being worked on, so it stays short.
 */
function Section({ id, title, hint, accent, openSection, setOpenSection, children }: {
  id: string;
  title: string;
  hint?: string;
  accent?: string;
  openSection: string;
  setOpenSection: (v: string) => void;
  children: React.ReactNode;
}) {
  const open = openSection === id;
  return (
    <section style={{ border: "1px solid " + (accent || "#ddd"), borderRadius: 8, marginTop: 12, background: "#fff", overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setOpenSection(open ? "" : id)}
        aria-expanded={open}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, padding: "14px 16px", background: "none", border: 0, cursor: "pointer",
          textAlign: "left", fontSize: 16, fontWeight: 700, color: "inherit",
        }}
      >
        <span>{title}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 500, color: "var(--muted)" }}>
          {hint}
          <span aria-hidden="true">{open ? "▴" : "▾"}</span>
        </span>
      </button>
      {open ? <div style={{ padding: "0 16px 16px" }}>{children}</div> : null}
    </section>
  );
}

export default function AdminDashboard() {
  const [c, setC] = useState<Any | null>(null);
  const [health, setHealth] = useState<Any | null>(null);
  const [ownerDevice, setOwnerDevice] = useState<Any | null>(null);
  const [ownerMsg, setOwnerMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [manualGame, setManualGame] = useState(MANUAL_GAMES[0]);
  const [msg, setMsg] = useState("");
  const [newDate, setNewDate] = useState("");
  const [openSection, setOpenSection] = useState("");

  useEffect(() => {
    fetch("/api/admin/content")
      .then(async (r) => {
        if (r.status === 401) { window.location.href = "/admin/login"; return; }
        setC(await r.json());
      })
      .catch(() => (window.location.href = "/admin/login"));
    /*
     * Whether the live sources still have the shape their game needs.
     *
     * A source that changed its page is refused before it reaches the cards (see
     * lib/source-health.ts), so a card showing an older draw is the symptom -
     * this is where the cause is named.
     */
    fetch("/api/source-health")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setHealth(j))
      .catch(() => {});
    // Which phones get the "a live source broke" push (owner-alerts.ts). The
    // token is only present inside the app, so this says so plainly on a PC.
    fetch("/api/admin/owner-device?token=" + encodeURIComponent(deviceToken()))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setOwnerDevice(j))
      .catch(() => {});
  }, []);

  if (!c) return <p className="text-center mt-4">Loading admin…</p>;

  const set = (p: Any) => setC({ ...c, ...p });
  const notice = (p: Any) => setC({ ...c, notice: { ...c.notice, ...p } });
  const settings = (p: Any) => setC({ ...c, settings: { ...c.settings, ...p } });
  const logo = (p: Any) => setC({ ...c, settings: { ...c.settings, logo: { ...c.settings.logo, ...p } } });
  const banner = (p: Any) => setC({ ...c, settings: { ...c.settings, banner: { ...c.settings.banner, ...p } } });
  const ads = (p: Any) => setC({ ...c, ads: { ...c.ads, ...p } });
  const directTop = (p: Any) => ads({ direct: { ...c.ads.direct, top: { ...c.ads.direct.top, ...p } } });
  const placeholder = (p: Any) => ads({ direct: { ...c.ads.direct, placeholder: { ...c.ads.direct.placeholder, ...p } } });
  const manualFor = (cls: string) => {
    const m = (c.manual || {})[cls] as { date?: string; drawNo?: string; text?: string } | undefined;
    return { date: m?.date || "", drawNo: m?.drawNo || "", text: m?.text || "" };
  };
  const setManual = (cls: string, patch: { date?: string; drawNo?: string; text?: string }) =>
    set({ manual: { ...(c.manual || {}), [cls]: { ...manualFor(cls), ...patch } } });

  const upload = async (file: File, kind: "logo" | "banner" | "topAd") => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result);
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: file.name, data: dataUrl }),
      });
      if (res.ok) {
        const j = await res.json();
        if (kind === "logo") logo({ src: j.url });
        else if (kind === "banner") banner({ src: j.url, enabled: true });
        else if (kind === "topAd") directTop({ image: j.url, enabled: true });
        setMsg("Image uploaded ✅");
      } else setMsg("Upload failed");
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setSaving(true); setMsg("");
    try {
      const res = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(c),
      });
      if (res.ok) { setC(await res.json()); setMsg("Saved successfully ✅"); }
      else {
        /*
         * Say WHY it failed. "Save failed" hid a 401 (session gone) and a
         * read-only store behind the same two words, so a typed 6D could look
         * saved and never appear.
         */
        let why = "";
        try { const j = await res.json(); why = String(j?.error || ""); } catch { /* no body */ }
        setMsg("Save failed (" + res.status + (why ? ": " + why : "") + ")");
      }
    } catch { setMsg("Save failed"); }
    setSaving(false);
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/admin/login";
  };

  const setOwnerAlert = async (on: boolean) => {
    setOwnerMsg("");
    try {
      const res = await fetch("/api/admin/owner-device", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: deviceToken(), on }),
      });
      const j = await res.json();
      if (res.ok) { setOwnerDevice(j); setOwnerMsg(on ? "已开启 ✅ 这台手机会收到来源警报" : "已关闭"); }
      else setOwnerMsg(String(j.error || "失败"));
    } catch { setOwnerMsg("失败"); }
  };

  const label: React.CSSProperties = { display: "block", margin: "8px 0 4px", fontWeight: 600 };
  const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: 8 };

  return (
    <div style={{ maxWidth: 760, margin: "24px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 22 }}>Admin Panel</h1>
      <p style={{ color: "var(--muted)" }}>Logged in. Changes apply instantly across the whole site.</p>

      {health ? (
        <Section
          id="health"
          title="📡 Live sources 官方来源"
          hint={health.bad ? health.bad + " 个需要处理" : "全部正常"}
          accent={health.bad ? "#cc0000" : "#12b76a"}
          openSection={openSection}
          setOpenSection={setOpenSection}
        >
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            {(health.sources || []).map((s: Any) => (
              <li key={s.key} style={{ color: s.ok ? "#1b5e20" : "#cc0000", marginBottom: 2 }}>
                <strong>{s.name}</strong>{" "}
                {s.ok
                  ? "OK"
                  : (s.why || "shape changed") +
                    (s.okAt ? " · last good " + new Date(s.okAt).toLocaleString() : "")}
              </li>
            ))}
            {!(health.sources || []).length ? <li>No source has reported yet.</li> : null}
          </ul>
        </Section>
      ) : null}

      <Section id="alerts" title="📱 My phone alerts 管理员通知" openSection={openSection} setOpenSection={setOpenSection}>
        {deviceToken() ? (
          <>
            <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
              来源出问题时，用推播通知这台手机（只有你的装置，不会发给用户）。
            </p>
            <button onClick={() => setOwnerAlert(!(ownerDevice && ownerDevice.thisDevice))} style={{ padding: "8px 16px" }}>
              {ownerDevice && ownerDevice.thisDevice ? "关闭这台手机的管理员通知" : "让这台手机收管理员通知"}
            </button>
            {ownerDevice && ownerDevice.thisDevice ? (
              <button
                onClick={async () => {
                  setOwnerMsg("发送中…");
                  try {
                    const r = await fetch("/api/admin/owner-device", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ test: true }) });
                    const j = await r.json();
                    setOwnerMsg(j.sent ? "测试通知已发出 ✅ 看看这台手机有没有收到" : "已发出，但没有任何装置收到（先确认 App 的通知权限）");
                  } catch { setOwnerMsg("发送失败"); }
                }}
                style={{ marginLeft: 8, padding: "8px 16px" }}
              >发送测试通知</button>
            ) : null}
          </>
        ) : (
          <p style={{ color: "#cc0000", fontSize: 13, marginTop: 0 }}>
            这台装置没有 App 推播。请在 <strong>手机 App 里</strong>打开 mkt88.my/admin 并登入，再按这里。
          </p>
        )}
        {ownerDevice ? <p style={{ fontSize: 13, color: "var(--muted)" }}>目前在名单上：{ownerDevice.devices} 台装置</p> : null}
        {ownerMsg ? <p style={{ fontSize: 13 }}>{ownerMsg}</p> : null}
      </Section>

      <Section id="dates" title="🎯 Special draw dates 特别彩日期" openSection={openSection} setOpenSection={setOpenSection}>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
          这里列出的日期，手机会在 12:00、15:00、18:10（马来西亚时间）收到特别开彩提醒；日期过了就自动停止，不用回来删。
          加好或删好后，按最下面的 <strong>Save changes</strong> 才会生效。
        </p>
        {Array.isArray(c.specialDraws) && c.specialDraws.length ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
            {c.specialDraws.map((d: string) => (
              <li key={d} style={{ marginBottom: 4 }}>
                <strong>{d}</strong>
                <button
                  onClick={() => set({ specialDraws: c.specialDraws.filter((x: string) => x !== d) })}
                  style={{ marginLeft: 8, padding: "2px 10px" }}
                >
                  删除
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>目前没有特别彩日期。</p>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
          <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} style={{ padding: 8 }} />
          <button
            onClick={() => {
              if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return;
              const list: string[] = Array.isArray(c.specialDraws) ? c.specialDraws : [];
              if (list.includes(newDate)) return;
              set({ specialDraws: [...list, newDate].sort() });
              setNewDate("");
            }}
            style={{ padding: "8px 16px" }}
          >
            添加日期
          </button>
        </div>
      </Section>

      <Section id="manual" title="✍️ 备用：手动纠正" hint="平时不用填" openSection={openSection} setOpenSection={setOpenSection}>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
          11 个游戏现在都会自己从官方来源更新，这里平时<strong>不用填</strong>。
          只有官方拒接、或某一格要改正时才用：先选游戏，再在格子里填号码。
          同一场里你填的优先；下一场自动数据到了就会盖过去。
        </p>
        <label style={{ fontSize: 13, fontWeight: 600 }}>
          选择游戏
          <select
            value={manualGame}
            onChange={(ev) => setManualGame(ev.target.value)}
            style={{ marginLeft: 8, padding: "8px 10px", minHeight: 40, borderRadius: 8, border: "1px solid var(--j-border)", fontWeight: 600 }}
          >
            {MANUAL_GAMES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        {MANUAL_CARDS.filter((card) => card.game === manualGame).map((card) => {
          const e = manualFor(card.cls);
          const vals = parseManualText(e.text);
          const count = card.fields.filter((f) => vals[f]).length;
          return (
            <div key={card.id} style={{ borderTop: "1px solid var(--j-border)", marginTop: 12, paddingTop: 10 }}>
              <strong>{card.name}</strong>
              <span style={{ color: "var(--muted)", fontSize: 12, marginLeft: 8 }}>{card.cls}</span>
              <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "6px 0", flexWrap: "wrap" }}>
                <label style={{ fontSize: 13 }}>
                  日期
                  <input type="date" value={e.date} onChange={(ev) => setManual(card.cls, { date: ev.target.value })} style={{ padding: 6, marginLeft: 6 }} />
                </label>
                <label style={{ fontSize: 13 }}>
                  期号（可留空）
                  <input value={e.drawNo} onChange={(ev) => setManual(card.cls, { drawNo: ev.target.value })} style={{ padding: 6, marginLeft: 6, width: 110 }} />
                </label>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                {card.fields.map((f) => {
                  const auto = card.cls === "table-7" && TOTO_AUTO.has(f);
                  const shown = auto ? (totoDerived(vals)[f] || "") : (vals[f] || "");
                  return (
                    <label key={f} style={{ fontSize: 11, display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ color: auto ? "#8a8f98" : "var(--muted)" }}>{cellLabel(f)}</span>
                      {auto ? (
                        <input readOnly value={shown} title="自动算出，不用填"
                          style={{ width: 68, padding: 6, boxSizing: "border-box", background: "#f2f3f5", color: "#6b7280" }} />
                      ) : (
                        <input
                          value={shown}
                          onChange={(ev) => {
                            const next = { ...vals };
                            /*
                             * Every box used to strip anything that was not a
                             * digit, so a jackpot letter, a money figure or a
                             * sliced 6D pattern could not be typed at all - the
                             * cell simply refused. Text is kept as typed now.
                             */
                            next[f] = ev.target.value.slice(0, 24);
                            if (card.cls === "table-7") Object.assign(next, totoDerived(next));
                            setManual(card.cls, { text: buildManualText(next) });
                          }}
                          style={{ width: 68, padding: 6, boxSizing: "border-box" }}
                        />
                      )}
                    </label>
                  );
                })}
              </div>
              {card.cls === "table-7" ? (
                <p style={{ fontSize: 12, margin: "6px 0 0", color: "var(--muted)" }}>
                  5D 只填 d5_number_1–3，第 4–6 格自动取 1 奖的尾 4／3／2 位；
                  6D 只填 d6_number_1 六位数，第 2–5 排自动拆成前后 5／4／3／2 位。
                </p>
              ) : null}
              <p style={{ fontSize: 12, margin: "6px 0 0", color: count ? "#1b5e20" : "var(--muted)" }}>
                已有 {Object.keys(vals).length} 个格子填了值（记得按最下面的 Save changes）
              </p>
            </div>
          );
        })}
        {manualGame === "Perdana" || manualGame === "Lucky HariHari" ? (
          <p style={{ fontSize: 13, marginTop: 10, color: "var(--muted)" }}>
            4D 的格子和营运商一样用字母：A–M 是特别奖，N–W 是安慰奖；1ST / 2ND / 3RD 填上方三个奖。
            空着的格子就保持空白。
          </p>
        ) : null}
      </Section>

      <Section id="banner" title="📷 Top banner image 顶部横幅" openSection={openSection} setOpenSection={setOpenSection}>
        <label style={{ display: "block", margin: "6px 0" }}>
          <input type="checkbox" checked={c.settings.banner.enabled} onChange={(e) => banner({ enabled: e.target.checked })} /> Show banner
        </label>
        {c.settings.banner.src ? (
          <div style={{ margin: "8px 0" }}>
            <img src={c.settings.banner.src} alt="banner" style={{ maxWidth: "100%", maxHeight: 90, background: "var(--j-border)", borderRadius: 6 }} />
            <button onClick={() => banner({ src: "" })} style={{ marginLeft: 10 }}>Remove</button>
          </div>
        ) : <p style={{ color: "var(--muted)" }}>No banner uploaded.</p>}
        <label style={label as any}>Upload banner image
          <input type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" onChange={(e) => e.target.files && upload(e.target.files[0], "banner")} />
        </label>
      </Section>

      <Section id="notice" title="📣 Announcement bar 公告栏" openSection={openSection} setOpenSection={setOpenSection}>
        <label style={{ display: "block", margin: "6px 0" }}>
          <input type="checkbox" checked={c.notice.enabled} onChange={(e) => notice({ enabled: e.target.checked })} /> Show announcement
        </label>
        <textarea rows={2} style={input} value={c.notice.text} onChange={(e) => notice({ text: e.target.value })} placeholder="Announcement text" />
        <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
          <label>BG <input type="color" value={c.notice.bg} onChange={(e) => notice({ bg: e.target.value })} /></label>
          <label>Text <input type="color" value={c.notice.color} onChange={(e) => notice({ color: e.target.value })} /></label>
          <label>Animation
            <select value={c.notice.fx} onChange={(e) => notice({ fx: e.target.value })}>
              <option value="none">None</option>
              <option value="blink">Blink</option>
              <option value="pulse">Pulse</option>
              <option value="marquee">Marquee</option>
            </select>
          </label>
        </div>
      </Section>

      <Section id="ads" title="💰 Advertising 广告位" hint="赞助商横幅" openSection={openSection} setOpenSection={setOpenSection}>
        <p style={{ margin: "4px 0 8px", color: "var(--muted)" }}>Sell this slot to an advertiser, upload their banner + link, and enable it. It shows at the top of every results page.</p>
        <label style={{ display: "block", margin: "6px 0" }}>
          <input type="checkbox" checked={c.ads.direct.top.enabled} onChange={(e) => directTop({ enabled: e.target.checked })} /> Enable sponsored banner
        </label>
        {c.ads.direct.top.image ? (
          <div style={{ margin: "8px 0" }}>
            <img src={c.ads.direct.top.image} alt="ad" style={{ maxWidth: "100%", maxHeight: 90, background: "var(--j-border)", borderRadius: 6 }} />
            <button onClick={() => directTop({ image: "" })} style={{ marginLeft: 10 }}>Remove image</button>
          </div>
        ) : <p style={{ color: "var(--muted)" }}>No banner uploaded.</p>}
        <label style={label as any}>Banner image (.png/.jpg/.jpeg)
          <input type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" onChange={(e) => e.target.files && upload(e.target.files[0], "topAd")} />
        </label>
        <label style={label as any}>Advertiser link (URL)
          <input style={input} value={c.ads.direct.top.link} onChange={(e) => directTop({ link: e.target.value })} placeholder="https://advertiser.example" />
        </label>
        <hr />
        <label style={{ display: "block", margin: "6px 0" }}>
          <input type="checkbox" checked={c.ads.direct.placeholder.enabled} onChange={(e) => placeholder({ enabled: e.target.checked })} /> Show "Advertise Here" box (when no sponsor yet)
        </label>
        <label style={label as any}>Box text
          <input style={input} value={c.ads.direct.placeholder.text} onChange={(e) => placeholder({ text: e.target.value })} />
        </label>
        <label style={label as any}>Contact link (optional)
          <input style={input} value={c.ads.direct.placeholder.link} onChange={(e) => placeholder({ link: e.target.value })} placeholder="mailto:you@example.com" />
        </label>
      </Section>

      <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
        <button onClick={save} disabled={saving} style={{ padding: "9px 22px", color: "#fff", background: "#cc0000", border: 0, borderRadius: 6 }}>
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button onClick={logout} style={{ padding: "9px 20px", background: "var(--j-border)", border: "1px solid #bbb", borderRadius: 6 }}>Log out</button>
      </div>
      {msg ? <p style={{ marginTop: 8 }}>{msg}</p> : null}
    </div>
  );
}

