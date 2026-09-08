import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

const UPLOAD_DIR = path.join(process.cwd(), "public", "sites", "live4dresult-net-0600c55d", "root-8a5edab2", "custom");
const MIME: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".svg": "image/svg+xml", ".webp": "image/webp",
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const safe = (name || "").replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safe || /\.\./.test(safe)) return new NextResponse("bad name", { status: 400 });
  try {
    const file = path.join(UPLOAD_DIR, safe);
    const buf = await fs.readFile(file);
    const ext = path.extname(safe).toLowerCase();
    return new NextResponse(new Uint8Array(buf), { headers: { "content-type": MIME[ext] || "application/octet-stream", "cache-control": "no-store" } });
  } catch {
    return new NextResponse("not found", { status: 404 });
  }
}
