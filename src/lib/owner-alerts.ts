import { firestoreGet, firestorePut, registeredDevices, sendToTokens } from "./fcm";

/**
 * Telling the OWNER, on their own phone, that a live source broke.
 *
 * The result pushes go to every user; these must not. So the owner's device is
 * named in its own list (config/owner-devices), and it is put there from /admin
 * - which already needs the admin password - rather than by a switch any user
 * could flip (decided 15 Oct 2026).
 *
 * With Firebase unset every call here is a quiet no-op, exactly like the rest of
 * the push code.
 */
const DOC = "config/owner-devices";

/** The device ids the owner asked to be told on. */
export async function ownerDeviceIds(): Promise<string[]> {
  try {
    const doc = await firestoreGet<{ fields?: { json?: { stringValue?: string } } }>(DOC);
    const raw = doc?.fields?.json?.stringValue;
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.map((v) => String(v)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/** Add or remove one device from that list. */
export async function setOwnerDevice(deviceId: string, on: boolean): Promise<string[]> {
  if (!deviceId) return ownerDeviceIds();
  const cur = new Set(await ownerDeviceIds());
  if (on) cur.add(deviceId);
  else cur.delete(deviceId);
  const next = [...cur];
  await firestorePut(DOC, { json: JSON.stringify(next) });
  return next;
}

/**
 * Push one line to the owner's devices.
 *
 * Phones FCM says are gone are dropped from the list, so the owner never has to
 * wonder why the alerts stopped after changing phone.
 */
export async function notifyOwner(title: string, body: string, url = "/admin"): Promise<{ sent: number; devices: number }> {
  const ids = await ownerDeviceIds();
  if (!ids.length) return { sent: 0, devices: 0 };
  const mine = new Set(ids);
  const devices = (await registeredDevices()).filter((d) => mine.has(d.id));
  if (!devices.length) return { sent: 0, devices: 0 };
  const { sent, dead } = await sendToTokens(devices, title, body, url);
  if (dead.length) await firestorePut(DOC, { json: JSON.stringify(ids.filter((id) => !dead.includes(id))) });
  return { sent, devices: devices.length };
}
