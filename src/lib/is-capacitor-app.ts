export function isCapacitorApp(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /MKT88Android|Capacitor|Android.*; wv\)/i.test(ua);
}