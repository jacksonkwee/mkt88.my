"use client";

import { useState } from "react";


export default function LoginPage() {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user, password }),
      });
      if (res.ok) {
        window.location.href = "/admin";
      } else {
        setErr("Invalid username or password");
      }
    } catch {
      setErr("Login failed");
    }
    setBusy(false);
  };

  return (
    <main style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <form onSubmit={submit} style={{ width: 300, border: "1px solid #ddd", borderRadius: 10, padding: 24, background: "#fff" }}>
        <h1 style={{ fontSize: 20, marginTop: 0 }}>Admin Login</h1>
        <label style={{ display: "block", margin: "10px 0 4px" }}>Username</label>
        <input style={{ width: "100%", boxSizing: "border-box", padding: 8 }} value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" />
        <label style={{ display: "block", margin: "10px 0 4px" }}>Password</label>
        <input type="password" style={{ width: "100%", boxSizing: "border-box", padding: 8 }} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        {err ? <p style={{ color: "#c00" }}>{err}</p> : null}
        <button type="submit" disabled={busy} style={{ marginTop: 14, width: "100%", padding: 10, color: "#fff", background: "#cc0000", border: 0, borderRadius: 6 }}>
          {busy ? "Logging in…" : "Login"}
        </button>
      </form>
    </main>
  );
}
