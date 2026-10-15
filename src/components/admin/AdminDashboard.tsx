"use client";

import { useEffect, useState } from "react";

type Any = Record<string, any>;

/** The cards the owner can type in - see MANUAL_FIELDS in lib/live-snapshot.ts. */
const MANUAL_GAMES = [
  { cls: "table-6", name: "Sports Toto 4D 多多", hint: "照顺序贴：3 个头奖、10 个特别奖、10 个安慰奖（共 23 个）" },
  { cls: "table-13", name: "Grand Dragon 4D 豪龙", hint: "一行一个，例如 I=1912 或 1st=1234；只填你要改的格子，其余保持不动" },
  { cls: "table-14", name: "Grand Dragon 6D 豪龙 6D", hint: "例如 6D=117749；下面的小奖会自动算出来" },
];

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

export default function AdminDashboard() {
  const [c, setC] = useState<Any | null>(null);
  const [health, setHealth] = useState<Any | null>(null);
  const [ownerDevice, setOwnerDevice] = useState<Any | null>(null);
  const [ownerMsg, setOwnerMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [newDate, setNewDate] = useState("");

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
      else setMsg("Save failed");
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

  const box: React.CSSProperties = { border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12, background: "#fff" };
  const label: React.CSSProperties = { display: "block", margin: "8px 0 4px", fontWeight: 600 };
  const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: 8 };

  return (
    <div style={{ maxWidth: 760, margin: "24px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 22 }}>Admin Panel</h1>
      <p style={{ color: "#666" }}>Logged in. Changes apply instantly across the whole site.</p>

      {health ? (
        <section style={{ ...box, borderColor: health.bad ? "#cc0000" : "#12b76a" }}>
          <h2 style={{ fontSize: 17, marginTop: 0 }}>
            📡 Live sources {health.bad ? "— " + health.bad + " needs attention" : "— all good"}
          </h2>
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
        </section>
      ) : null}

      <section style={box}>
        <h2 style={{ fontSize: 17, marginTop: 0 }}>📱 My phone alerts</h2>
        {deviceToken() ? (
          <>
            <p style={{ color: "#666", fontSize: 13, marginTop: 0 }}>
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
        {ownerDevice ? <p style={{ fontSize: 13, color: "#666" }}>目前在名单上：{ownerDevice.devices} 台装置</p> : null}
        {ownerMsg ? <p style={{ fontSize: 13 }}>{ownerMsg}</p> : null}
      </section>

      <section style={box}>
        <h2 style={{ fontSize: 17, marginTop: 0 }}>🎯 Special draw dates 特别彩日期</h2>
        <p style={{ color: "#666", fontSize: 13, marginTop: 0 }}>
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
          <p style={{ color: "#666", fontSize: 13 }}>目前没有特别彩日期。</p>
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
      </section>

      <section style={box}>
        <h2 style={{ fontSize: 17, marginTop: 0 }}>✍️ 手动输入成绩</h2>
        <p style={{ color: "#666", fontSize: 13, marginTop: 0 }}>
          Sports Toto 4D 和豪龙 4D 有机器人防护，程式抓不到。开彩时用你自己的浏览器打开官方成绩页，把号码照顺序贴进下面的框，再按最下面的 <strong>Save changes</strong>，网页和 App 马上就会显示你贴的号码。
          <br />
          贴的顺序：<strong>头奖、二奖、三奖</strong> → <strong>特别奖</strong> → <strong>安慰奖</strong>。号码之间用空格或换行分开都可以。
        </p>
        {MANUAL_GAMES.map((g) => {
          const e = manualFor(g.cls);
          const count = String(e.text || "").split(/[^0-9]+/).filter(Boolean).length;
          return (
            <div key={g.cls} style={{ borderTop: "1px solid #eee", marginTop: 12, paddingTop: 10 }}>
              <strong>{g.name}</strong>
              <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "6px 0", flexWrap: "wrap" }}>
                <label style={{ fontSize: 13 }}>
                  日期
                  <input type="date" value={e.date} onChange={(ev) => setManual(g.cls, { date: ev.target.value })} style={{ padding: 6, marginLeft: 6 }} />
                </label>
                <label style={{ fontSize: 13 }}>
                  期号（可留空）
                  <input value={e.drawNo} onChange={(ev) => setManual(g.cls, { drawNo: ev.target.value })} style={{ padding: 6, marginLeft: 6, width: 110 }} />
                </label>
              </div>
              <textarea rows={3} style={input} placeholder={g.hint} value={e.text} onChange={(ev) => setManual(g.cls, { text: ev.target.value })} />
              <p style={{ fontSize: 12, margin: "4px 0 0", color: count ? "#1b5e20" : "#666" }}>
                已读入 {count} 个号码{g.hint}
              </p>
            </div>
          );
        })}
      </section>

      <section style={box}>
        <h2 style={{ fontSize: 17, marginTop: 0 }}>🎨 Design / General</h2>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          <label style={label as any}>Primary colour
            <input type="color" value={c.settings.primary} onChange={(e) => settings({ primary: e.target.value })} />
          </label>
          <label style={label as any}>Base font size ({c.settings.fontSize}px)
            <input type="range" min={12} max={20} value={c.settings.fontSize} onChange={(e) => settings({ fontSize: Number(e.target.value) })} />
          </label>
        </div>
      </section>

      <section style={box}>
        <h2 style={{ fontSize: 17, marginTop: 0 }}>🖼 Logo</h2>
        <label style={label as any}>Logo size: {c.settings.logo.size}px
          <input type="range" min={30} max={140} value={c.settings.logo.size} onChange={(e) => logo({ size: Number(e.target.value) })} style={{ width: "100%" }} />
        </label>
        {c.settings.logo.src ? (
          <div style={{ margin: "8px 0" }}>
            <img src={c.settings.logo.src} alt="custom logo" style={{ height: 60, background: "#eee", borderRadius: 6, padding: 4 }} />
            <button onClick={() => logo({ src: "" })} style={{ marginLeft: 10 }}>Use default logo</button>
          </div>
        ) : <p style={{ color: "#666" }}>Using default logo (mkt88 logo).</p>}
        <label style={label as any}>Upload logo image
          <input type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" onChange={(e) => e.target.files && upload(e.target.files[0], "logo")} />
        </label>
      </section>

      <section style={box}>
        <h2 style={{ fontSize: 17, marginTop: 0 }}>📷 Top banner image</h2>
        <label style={{ display: "block", margin: "6px 0" }}>
          <input type="checkbox" checked={c.settings.banner.enabled} onChange={(e) => banner({ enabled: e.target.checked })} /> Show banner
        </label>
        {c.settings.banner.src ? (
          <div style={{ margin: "8px 0" }}>
            <img src={c.settings.banner.src} alt="banner" style={{ maxWidth: "100%", maxHeight: 90, background: "#eee", borderRadius: 6 }} />
            <button onClick={() => banner({ src: "" })} style={{ marginLeft: 10 }}>Remove</button>
          </div>
        ) : <p style={{ color: "#666" }}>No banner uploaded.</p>}
        <label style={label as any}>Upload banner image
          <input type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" onChange={(e) => e.target.files && upload(e.target.files[0], "banner")} />
        </label>
      </section>

      <section style={box}>
        <h2 style={{ fontSize: 17, marginTop: 0 }}>📣 Announcement bar</h2>
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
      </section>

      <section style={box}>
        <h2 style={{ fontSize: 17, marginTop: 0 }}>💰 Advertising - top banner (earn from sponsors)</h2>
        <p style={{ margin: "4px 0 8px", color: "#666" }}>Sell this slot to an advertiser, upload their banner + link, and enable it. It shows at the top of every results page.</p>
        <label style={{ display: "block", margin: "6px 0" }}>
          <input type="checkbox" checked={c.ads.direct.top.enabled} onChange={(e) => directTop({ enabled: e.target.checked })} /> Enable sponsored banner
        </label>
        {c.ads.direct.top.image ? (
          <div style={{ margin: "8px 0" }}>
            <img src={c.ads.direct.top.image} alt="ad" style={{ maxWidth: "100%", maxHeight: 90, background: "#eee", borderRadius: 6 }} />
            <button onClick={() => directTop({ image: "" })} style={{ marginLeft: 10 }}>Remove image</button>
          </div>
        ) : <p style={{ color: "#666" }}>No banner uploaded.</p>}
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
      </section>

      <section style={box}>
        <h2 style={{ fontSize: 17, marginTop: 0 }}>© Footer copyright</h2>
        <input style={input} value={c.copyright} onChange={(e) => set({ copyright: e.target.value })} />
      </section>

      <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
        <button onClick={save} disabled={saving} style={{ padding: "9px 22px", color: "#fff", background: "#cc0000", border: 0, borderRadius: 6 }}>
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button onClick={logout} style={{ padding: "9px 20px", background: "#eee", border: "1px solid #bbb", borderRadius: 6 }}>Log out</button>
      </div>
      {msg ? <p style={{ marginTop: 8 }}>{msg}</p> : null}
    </div>
  );
}

