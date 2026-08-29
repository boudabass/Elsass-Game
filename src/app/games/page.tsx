import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { getSessionUser } from "@/app/actions/auth";
import { getGameCatalogMeta } from "@/lib/game-catalog-meta";
import { GamesCatalog } from "@/components/games-catalog";

export default async function GamesPage() {
    // Session signée (HMAC) : invalide ou expirée -> retour au login.
    const user = await getSessionUser();
    if (!user) redirect("/login?expired=1&next=/games");

    // L'admin voit aussi les jeux masqués (pour les tester avant publication).
    const isAdmin = !!process.env.ADMIN_UID && String(user.uid) === process.env.ADMIN_UID;

    let rows: any[] = [];
    try {
        const { rows: r } = await query(
            isAdmin
                ? "SELECT id, name, description, url, published FROM game ORDER BY id"
                : "SELECT id, name, description, url, published FROM game WHERE published ORDER BY id"
        );
        rows = r;
    } catch (e) {
        console.warn("Could not fetch games", e);
    }

    const games = rows.map((g) => ({ ...g, meta: getGameCatalogMeta(g.name) }));

    return <GamesCatalog games={games} />;
}
