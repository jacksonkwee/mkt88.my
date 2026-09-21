"use client";

/**
 * Native HTTP for the app.
 *
 * The Android shell exposes window.mktNative.get(url, id) and answers through
 * window.__mktNative.result(id, body). It is used only for result sites that
 * refuse a browser request, so the on-screen results stay correct even when the
 * server cannot reach them.
 */
type NativeBridge = { get: (url: string, id: string) => void };
type Waiter = (body: string | null) => void;

const waiting = new Map<string, Waiter>();
let seq = 0;

declare global {
  interface Window {
    mktNative?: NativeBridge;
    __mktNative?: { result: (id: string, body: string) => void };
  }
}

if (typeof window !== "undefined") {
  window.__mktNative = window.__mktNative || {
    result: (id: string, body: string) => {
      const w = waiting.get(id);
      if (!w) return;
      waiting.delete(id);
      w(body || null);
    },
  };
}

/** True when the native fetch is available (inside the app). */
export function hasNativeHttp(): boolean {
  return typeof window !== "undefined" && !!window.mktNative && typeof window.mktNative.get === "function";
}

/** GET a URL through the app itself. Resolves null when there is no bridge. */
export function nativeHttpGet(url: string, timeoutMs = 20000): Promise<string | null> {
  const bridge = typeof window !== "undefined" ? window.mktNative : undefined;
  if (!bridge || typeof bridge.get !== "function") return Promise.resolve(null);
  return new Promise((resolve) => {
    const id = "n" + ++seq + "-" + Date.now();
    let done = false;
    const finish = (body: string | null) => {
      if (done) return;
      done = true;
      waiting.delete(id);
      resolve(body);
    };
    waiting.set(id, finish);
    window.setTimeout(() => finish(null), timeoutMs);
    try { bridge.get(url, id); } catch { finish(null); }
  });
}
