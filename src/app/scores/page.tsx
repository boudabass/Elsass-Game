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
        <div className="container mx-auto py-8 animate-in fade-in duration-500">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3 mb-8">
                <Trophy className="w-8 h-8 text-yellow-500" />
                Mes Scores
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm text-slate-500">Parties jouées</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold">{totalGamesPlayed}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm text-slate-500">Meilleur score</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold">{highestScore}</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Détail par jeu</CardTitle>
                </CardHeader>
                <CardContent>
                    {userScores.length === 0 ? (
                        <p className="text-slate-400 italic">Aucun score enregistré pour le moment.</p>
                    ) : (
                        <div className="space-y-4">
                            {userScores.map((s) => (
                                <div key={s.game_id} className="flex justify-between p-2 border-b">
                                    <span>{s.game_name}</span>
                                    <span className="font-bold">{s.score}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
