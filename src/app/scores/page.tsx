import { Trophy } from "lucide-react"
import { query } from "@/lib/db"
import { getSessionUser } from "@/app/actions/auth"
import { getGameCatalogMeta } from "@/lib/game-catalog-meta"
import { cn } from "@/lib/utils"
import { redirect } from "next/navigation"

export default async function ScoresPage() {
    // Session signée (HMAC) : invalide ou expirée -> retour au login.
    const user = await getSessionUser();
    if (!user) redirect("/login?expired=1&next=/scores");

    let userScores: any[] = [];
    try {
        // Uniquement les scores du joueur connecté (meilleur score par jeu).
        const { rows } = await query(
            "SELECT s.game_id, s.score, s.updated_at, g.name AS game_name FROM score s JOIN game g ON g.id = s.game_id WHERE s.user_id = $1 ORDER BY s.score DESC",
            [user.uid]
        );
        userScores = rows;
    } catch (e) {
        console.warn("Could not fetch scores", e);
    }

    const totalGamesPlayed = userScores.length;
    const highestScore = userScores.length > 0 ? Math.max(...userScores.map(s => Number(s.score))) : 0;

    return (
        <div className="mx-auto max-w-6xl animate-in fade-in duration-500">
            <h1 className="mb-6 flex items-center gap-3 font-heading text-3xl text-elsass-ink sm:mb-8 sm:text-4xl">
                <Trophy className="h-7 w-7 shrink-0 text-elsass-gold sm:h-8 sm:w-8" />
                Mes scores
            </h1>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.4fr] lg:items-start lg:gap-8">
                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-1">
                    <div className="rounded-xl border border-elsass-line bg-white p-4">
                        <p className="text-xs font-medium text-elsass-ink/55 sm:text-sm">Parties jouées</p>
                        <p className="mt-1 font-heading text-3xl text-elsass-ink">{totalGamesPlayed}</p>
                    </div>
                    <div className="rounded-xl border border-elsass-line bg-white p-4">
                        <p className="text-xs font-medium text-elsass-ink/55 sm:text-sm">Meilleur score</p>
                        <p className="mt-1 font-heading text-3xl text-elsass-red">{highestScore}</p>
                    </div>
                </div>

                <div className="rounded-xl border border-elsass-line bg-white p-4 sm:p-5">
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-elsass-ink/50">
                        Détail par jeu
                    </p>
                    {userScores.length === 0 ? (
                        <p className="italic text-muted-foreground">
                            Aucun score enregistré pour le moment.
                        </p>
                    ) : (
                        <div className="divide-y divide-elsass-line">
                            {userScores.map((s) => {
                                const meta = getGameCatalogMeta(s.game_name);
                                return (
                                    <div key={s.game_id} className="flex items-center gap-3 py-3">
                                        <div
                                            className={cn(
                                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-heading text-xs text-white",
                                                meta.couleur
                                            )}
                                        >
                                            {meta.initiale}
                                        </div>
                                        <span className="min-w-0 flex-1 truncate text-elsass-ink">{s.game_name}</span>
                                        <span className="shrink-0 font-heading text-lg text-elsass-red">{s.score}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
