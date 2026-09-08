import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import path from "path";
import { promises as fs } from "fs";
import { verifyToken, COOKIE_NAME } from "../../../../lib/auth";

const UPLOAD_DIR = path.join(process.cwd(), "public", "sites", "live4dresult-net-0600c55d", "root-8a5edab2", "custom");
const PUBLIC_BASE = "/sites/live4dresult-net-0600c55d/root-8a5edab2/custom";

async function isAuthed(): Promise<boolean> {
  const store = await cookies();
  return verifyToken(store.get(COOKIE_NAME)?.value);
}

export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { name, data } = (await req.json()) as { name?: string; data?: string };
    if (!name || !data) return NextResponse.json({ error: "missing file" }, { status: 400 });
    const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_");
    if (!/\.(png|jpe?g|gif|svg|webp)$/i.test(safe)) return NextResponse.json({ error: "unsupported type" }, { status: 400 });
    const comma = data.indexOf(",");
    if (comma < 0) return NextResponse.json({ error: "bad data" }, { status: 400 });
    const meta = data.slice(0, comma);
    const b64 = data.slice(comma + 1);
    if (!/^data:[^;]+;base64$/i.test(meta)) return NextResponse.json({ error: "bad data" }, { status: 400 });
    const buf = Buffer.from(b64, "base64");
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const file = path.join(UPLOAD_DIR, safe);
    await fs.writeFile(file, buf);
    return NextResponse.json({ url: "/api/media/" + safe });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}

