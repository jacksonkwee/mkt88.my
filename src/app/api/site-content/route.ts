import { NextResponse } from "next/server";
import { getSiteContent } from "../../../lib/site-store";

export async function GET() {
  return NextResponse.json(await getSiteContent());
}
