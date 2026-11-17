import { NextResponse } from "next/server";
import { getPastDatesForGame } from "../../../lib/past-dates";

const KNOWN_GAMES = new Set([
  "home", "magnum", "damacai", "sportstoto", "sg", "sabah88", "cashsweep",
  "sandakan", "east", "grand-dragon", "nine-lotto", "perdana", "lucky-harihari",
]);

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug") || "";
  if (!KNOWN_GAMES.has(slug)) {
    return NextResponse.json({ error: "Unknown game" }, { status: 400 });
  }
  const dates = await getPastDatesForGame(slug);
  return NextResponse.json(
    { dates },
    { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=86400" } },
  );
}
