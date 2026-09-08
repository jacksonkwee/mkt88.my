import crypto from "crypto";

export const ADMIN_USER = process.env.ADMIN_USER || "admin";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "mkt88@2026";
const SECRET = process.env.ADMIN_SECRET || "mkt88-admin-secret-change-me";
const TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

export const COOKIE_NAME = "mkt88_admin";

export function createToken(): string {
  const ts = Date.now().toString();
  const payload = ADMIN_USER + "." + ts;
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  return payload + "." + sig;
}

export function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const payload = parts[0] + "." + parts[1];
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  if (sig !== parts[2]) return false;
  const ts = Number(parts[1]);
  if (!ts || Date.now() - ts > TTL) return false;
  return parts[0] === ADMIN_USER;
}
