import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionUser } from "@/app/actions/auth";

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get("gameId");

    if (!gameId) {
      return NextResponse.json({ error: "gameId is required" }, { status: 400 });
    }
    const gameIdInt = parseInt(gameId, 10);
    if (Number.isNaN(gameIdInt)) {
      return NextResponse.json({ error: "gameId invalide" }, { status: 400 });
    }

    try {
      // Sauvegarde cloisonnée par (jeu, utilisateur) : l'uid vient de la
      // session signée, un client ne peut donc lire que SES sauvegardes.
      const { rows } = await query(
        "SELECT data FROM save WHERE game_id = $1 AND user_id = $2",
        [gameIdInt, user.uid]
      );
      // data est du jsonb : renvoyé tel quel (objet), ce que Engine.Save attend.
      return NextResponse.json({ data: rows.length > 0 ? rows[0].data : null });
    } catch (e) {
      console.warn("DB fetch failed, returning empty storage:", e);
      return NextResponse.json({ data: null });
    }
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { gameId, data } = body;

    const gameIdInt = parseInt(gameId, 10);
    if (Number.isNaN(gameIdInt)) {
      return NextResponse.json({ error: "gameId invalide" }, { status: 400 });
    }
    if (data === undefined || data === null) {
      return NextResponse.json({ error: "data requis" }, { status: 400 });
    }

    try {
      // UPSERT : une seule sauvegarde par (jeu, joueur).
      await query(
        `INSERT INTO save (game_id, user_id, data)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (game_id, user_id) DO UPDATE
           SET data = EXCLUDED.data, updated_at = now()`,
        [gameIdInt, user.uid, JSON.stringify(data)]
      );
      return NextResponse.json({ success: true });
    } catch (e) {
      console.error("Failed to save data:", e);
      return NextResponse.json({ error: "Failed to save data" }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
