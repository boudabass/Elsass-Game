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

    try {
      // Classement : une ligne par joueur (meilleur score), lisible par tous.
      let rows;
      if (gameId) {
        const gameIdInt = parseInt(gameId, 10);
        if (Number.isNaN(gameIdInt)) {
          return NextResponse.json({ error: "gameId invalide" }, { status: 400 });
        }
        ({ rows } = await query(
          "SELECT game_id, user_id, user_name, score, updated_at FROM score WHERE game_id = $1 ORDER BY score DESC LIMIT 100",
          [gameIdInt]
        ));
      } else {
        ({ rows } = await query(
          "SELECT game_id, user_id, user_name, score, updated_at FROM score ORDER BY score DESC LIMIT 100"
        ));
      }
      return NextResponse.json({ scores: rows });
    } catch (e) {
      console.warn("DB fetch failed, returning empty scores array:", e);
      return NextResponse.json({ scores: [] });
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
    const { gameId, score } = body;

    const gameIdInt = parseInt(gameId, 10);
    const scoreInt = Math.round(Number(score));
    if (Number.isNaN(gameIdInt) || !Number.isFinite(scoreInt)) {
      return NextResponse.json({ error: "gameId ou score invalide" }, { status: 400 });
    }

    try {
      // UPSERT atomique : une seule ligne par (jeu, joueur), on garde le MEILLEUR.
      // Le nom affiché vient de la session signée (pas du client).
      const { rows } = await query<{ best: string }>(
        `INSERT INTO score (game_id, user_id, user_name, score)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (game_id, user_id) DO UPDATE
           SET score      = GREATEST(score.score, EXCLUDED.score),
               user_name  = EXCLUDED.user_name,
               updated_at = CASE WHEN EXCLUDED.score > score.score THEN now() ELSE score.updated_at END
         RETURNING score AS best`,
        [gameIdInt, user.uid, user.name, scoreInt]
      );

      const best = Number(rows[0]?.best ?? scoreInt);
      return NextResponse.json({ success: true, updated: best === scoreInt, best });
    } catch (e) {
      console.error("Failed to save score:", e);
      return NextResponse.json({ error: "Failed to save score" }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
