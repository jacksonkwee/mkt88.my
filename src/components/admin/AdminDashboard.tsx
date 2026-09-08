"use client";

import { useEffect, useState } from "react";

type Any = Record<string, any>;

export default function AdminDashboard() {
  const [c, setC] = useState<Any | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/admin/content")
      .then(async (r) => {
        if (r.status === 401) { window.location.href = "/admin/login"; return; }
        setC(await r.json());
      })
      .catch(() => (window.location.href = "/admin/login"));
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

  const box: React.CSSProperties = { border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12, background: "#fff" };
  const label: React.CSSProperties = { display: "block", margin: "8px 0 4px", fontWeight: 600 };
  const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: 8 };

  return (
    <div style={{ maxWidth: 760, margin: "24px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 22 }}>Admin Panel</h1>
      <p style={{ color: "#666" }}>Logged in. Changes apply instantly across the whole site.</p>

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
        ) : <p style={{ color: "#999" }}>Using default logo (mkt88 logo).</p>}
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
        ) : <p style={{ color: "#999" }}>No banner uploaded.</p>}
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
        ) : <p style={{ color: "#999" }}>No banner uploaded.</p>}
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

