import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionUser } from "@/app/actions/auth";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const { rows: games } = await query(
        "SELECT id, name, description, url FROM game WHERE published ORDER BY id"
      );
      return NextResponse.json({ games });
    } catch (e) {
      console.warn("DB fetch failed, returning empty games array:", e);
      return NextResponse.json({ games: [] });
    }
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
