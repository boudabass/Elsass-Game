import { notFound } from 'next/navigation';
import { GameShell } from '@/components/game-shell';
import { query } from "@/lib/db";
import { getSessionUser } from "@/app/actions/auth";
import { redirect } from "next/navigation";

// Injecte l'ID numérique de la release Odoo dans l'URL de l'iframe (?gid=).
// C'est ce que system.js lit comme source de verite pour scores et sauvegardes.
function buildGameUrl(rawUrl: string | undefined | false, releaseId: number | string): string {
    const base = rawUrl || `/games/unknown/index.html`;
    const separator = base.includes("?") ? "&" : "?";
    return `${base}${separator}gid=${releaseId}`;
}

export default async function PlayPage({ params }: { params: Promise<{ gameId: string }> }) {
    const { gameId } = await params;

    // Session signée (HMAC) : invalide ou expirée -> retour au login.
    const user = await getSessionUser();
    if (!user) redirect(`/login?expired=1&next=/play/${gameId}`);

    const gameIdInt = parseInt(gameId, 10);
    let game = null;

    // L'admin peut tester un jeu encore masqué ; les clients ont un 404.
    const isAdmin = !!process.env.ADMIN_UID && String(user.uid) === process.env.ADMIN_UID;

    try {
        if (!Number.isNaN(gameIdInt)) {
            const { rows } = await query(
                "SELECT id, name, url, published FROM game WHERE id = $1",
                [gameIdInt]
            );
            if (rows.length > 0 && (rows[0].published || isAdmin)) game = rows[0];
        }
    } catch (e) {
        console.error(e);
    }

    if (!game) {
        notFound();
    }

    // h-[100dvh] : la page de jeu occupe toute la hauteur visible
    // (dans l'iframe Odoo, c'est toute la hauteur de l'iframe).
    return (
        <div className="h-[100dvh]">
            <GameShell
                gameName={game.name}
                gameUrl={buildGameUrl(game.url, game.id)}
            />
        </div>
    );
}
