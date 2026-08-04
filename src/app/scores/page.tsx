import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trophy } from "lucide-react"
import { query } from "@/lib/db"
import { getSessionUser } from "@/app/actions/auth"
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
        <div className="animate-in fade-in duration-500">
            <h1 className="mb-6 flex items-center gap-3 font-heading text-3xl text-elsass-ink sm:mb-8 sm:text-4xl">
                <Trophy className="h-7 w-7 shrink-0 text-elsass-gold sm:h-8 sm:w-8" />
                Mes scores
            </h1>

            <div className="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:gap-4">
                <Card className="border-elsass-line">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Parties jouées
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="font-heading text-3xl text-elsass-ink">{totalGamesPlayed}</p>
                    </CardContent>
                </Card>
                <Card className="border-elsass-line">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Meilleur score
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="font-heading text-3xl text-elsass-red">{highestScore}</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-elsass-line">
                <CardHeader>
                    <CardTitle className="font-heading font-normal text-xl text-elsass-ink">
                        Détail par jeu
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {userScores.length === 0 ? (
                        <p className="italic text-muted-foreground">
                            Aucun score enregistré pour le moment.
                        </p>
                    ) : (
                        <div className="divide-y divide-elsass-line">
                            {userScores.map((s) => (
                                <div key={s.game_id} className="flex justify-between gap-3 py-3">
                                    <span className="truncate text-elsass-ink">{s.game_name}</span>
                                    <span className="shrink-0 font-medium text-elsass-red">{s.score}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
