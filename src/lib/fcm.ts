import { createSign, createHash } from "crypto";

/**
 * Firebase Cloud Messaging, without pulling in the Admin SDK.
 *
 * The site runs on Vercel, so everything here is plain REST with a service
 * account JSON: it signs a JWT, swaps it for an access token and uses that for
 * both FCM (the push) and Firestore (the device list). Nothing is cached across
 * instances except the access token, which is fetch-on-demand anyway.
 *
 * With no FIREBASE_SERVICE_ACCOUNT in the environment every function here is a
 * quiet no-op, so the site behaves exactly as before until the Firebase project
 * is connected.
 */

type ServiceAccount = { project_id: string; client_email: string; private_key: string };

const SCOPE = "https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/datastore";

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || "";
  if (!raw) return null;
  try {
    // Accept the file as-is or base64-encoded - env values with newlines are
    // awkward to paste into a dashboard.
    const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const j = JSON.parse(text) as ServiceAccount;
    if (!j.project_id || !j.client_email || !j.private_key) return null;
    return { ...j, private_key: j.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

export function pushConfigured(): boolean {
  return serviceAccount() !== null;
}

let cachedToken: { value: string; expires: number } | null = null;

/** The OAuth2 access token a service account is worth. */
async function accessToken(sa: ServiceAccount): Promise<string | null> {
  if (cachedToken && cachedToken.expires > Date.now() + 60000) return cachedToken.value;
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = b64({ alg: "RS256", typ: "JWT" }) + "." +
    b64({ iss: sa.client_email, scope: SCOPE, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 });
  try {
    const signature = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: unsigned + "." + signature }),
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!j.access_token) return null;
    cachedToken = { value: j.access_token, expires: Date.now() + (j.expires_in || 3600) * 1000 };
    return j.access_token;
  } catch {
    return null;
  }
}

/** A stable document id for a device token. */
export function tokenKey(token: string): string {
  return createHash("sha1").update(token).digest("hex");
}

const db = (sa: ServiceAccount) => `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;

/** Read one Firestore document, or null. */
export async function firestoreGet<T>(path: string): Promise<T | null> {
  const sa = serviceAccount();
  if (!sa) return null;
  const token = await accessToken(sa);
  if (!token) return null;
  try {
    const res = await fetch(`${db(sa)}/${path}`, { headers: { Authorization: "Bearer " + token }, cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Create or replace one Firestore document (plain string fields). */
export async function firestorePut(path: string, fields: Record<string, string>): Promise<boolean> {
  const sa = serviceAccount();
  if (!sa) return false;
  const token = await accessToken(sa);
  if (!token) return false;
  const body = { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, { stringValue: v }])) };
  try {
    const res = await fetch(`${db(sa)}/${path}`, {
      method: "PATCH",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function firestoreDelete(path: string): Promise<void> {
  const sa = serviceAccount();
  if (!sa) return;
  const token = await accessToken(sa);
  if (!token) return;
  try {
    await fetch(`${db(sa)}/${path}`, { method: "DELETE", headers: { Authorization: "Bearer " + token }, cache: "no-store", signal: AbortSignal.timeout(6000) });
  } catch { /* nothing to do */ }
}

type FirestoreDoc = { name?: string; fields?: Record<string, { stringValue?: string }> };

/** Every registered device: doc id, push token, and the language it chose. */
export async function registeredDevices(): Promise<{ id: string; token: string; lang: string }[]> {
  const sa = serviceAccount();
  if (!sa) return [];
  const token = await accessToken(sa);
  if (!token) return [];
  const out: { id: string; token: string; lang: string }[] = [];
  let pageToken = "";
  for (let page = 0; page < 20; page++) {
    const url = `${db(sa)}/devices?pageSize=300${pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : ""}`;
    let json: { documents?: FirestoreDoc[]; nextPageToken?: string };
    try {
      const res = await fetch(url, { headers: { Authorization: "Bearer " + token }, cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (!res.ok) break;
      json = (await res.json()) as typeof json;
    } catch {
      break;
    }
    for (const d of json.documents || []) {
      const id = (d.name || "").split("/").pop() || "";
      const t = d.fields?.token?.stringValue || "";
      if (id && t) out.push({ id, token: t, lang: d.fields?.lang?.stringValue || "en" });
    }
    if (!json.nextPageToken) break;
    pageToken = json.nextPageToken;
  }
  return out;
}

/**
 * Send one notification to each token.
 *
 * A token FCM answers 404 / UNREGISTERED for is dead (the app was uninstalled,
 * or the token rotated), so it is reported back and the caller deletes it.
 */
export async function sendToTokens(
  devices: { id: string; token: string }[],
  title: string,
  body: string,
  url = "/"
): Promise<{ sent: number; dead: string[] }> {
  const sa = serviceAccount();
  if (!sa || !devices.length) return { sent: 0, dead: [] };
  const token = await accessToken(sa);
  if (!token) return { sent: 0, dead: [] };
  const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  const dead: string[] = [];
  let sent = 0;
  await Promise.all(devices.map(async (d) => {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token: d.token,
            notification: { title, body },
            data: { url },
            android: { priority: "high", notification: { channel_id: "mkt88-live-draw", sound: "default" } },
          },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) { sent++; return; }
      if (res.status === 404) dead.push(d.id);
      else {
        const t = await res.text().catch(() => "");
        if (/UNREGISTERED|registration-token-not-registered/i.test(t)) dead.push(d.id);
      }
    } catch { /* a push that fails is retried on the next draw */ }
  }));
  return { sent, dead };
}
