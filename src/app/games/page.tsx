import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, Sparkles, ArrowRight } from "lucide-react"
import Link from "next/link"
import { query } from "@/lib/db"
import { getSessionUser } from "@/app/actions/auth"
import { redirect } from "next/navigation"

export default async function GamesPage() {
    // Session signée (HMAC) : invalide ou expirée -> retour au login.
    const user = await getSessionUser();
    if (!user) redirect("/login?expired=1&next=/games");

    // L'admin voit aussi les jeux masqués (pour les tester avant publication).
    const isAdmin = !!process.env.ADMIN_UID && String(user.uid) === process.env.ADMIN_UID;

    let games: any[] = [];
    try {
        const { rows } = await query(
            isAdmin
                ? "SELECT id, name, description, url, published FROM game ORDER BY id"
                : "SELECT id, name, description, url, published FROM game WHERE published ORDER BY id"
        );
        games = rows;
    } catch (e) {
        console.warn("Could not fetch games", e);
    }

    return (
        <div className="animate-in fade-in duration-500">
            <div className="mb-6 sm:mb-8">
                <h1 className="font-heading text-3xl sm:text-4xl text-elsass-ink flex items-center gap-3">
                    <Play className="w-7 h-7 sm:w-8 sm:h-8 text-elsass-red shrink-0" />
                    Catalogue de jeux
                </h1>
                <p className="text-muted-foreground mt-2">
                    Tous les jeux disponibles, gratuits pour la communauté.
                </p>
            </div>

            {games.length === 0 ? (
                <Card className="border-dashed border-2 border-elsass-line bg-white/50">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 bg-elsass-gold/15 rounded-full flex items-center justify-center mb-4">
                            <Sparkles className="w-8 h-8 text-elsass-gold" />
                        </div>
                        <h3 className="font-heading text-xl text-elsass-ink mb-2">Aucun jeu disponible</h3>
                        <p className="text-muted-foreground max-w-md">La bibliothèque est actuellement vide.</p>
                    </CardContent>
                </Card>
            ) : (
                // Mobile-first : une colonne sur téléphone, deux dès la tablette,
                // trois sur grand écran.
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {games.map(game => (
                        <Card key={game.id} className="overflow-hidden border-elsass-line hover:border-elsass-gold hover:shadow-md transition-all duration-300 group flex flex-col h-full">
                            <div className="h-40 sm:h-44 bg-elsass-black relative overflow-hidden flex items-center justify-center">
                                <Play className="w-10 h-10 text-elsass-gold group-hover:scale-110 transition-transform duration-500" />
                            </div>

                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start gap-2">
                                    <CardTitle className="font-heading font-normal text-xl text-elsass-ink">
                                        {game.name}
                                    </CardTitle>
                                    {!game.published && (
                                        <span className="text-xs bg-elsass-gold/20 text-elsass-ink px-2 py-0.5 rounded-full font-medium shrink-0">
                                            Masqué
                                        </span>
                                    )}
                                </div>
                            </CardHeader>

                            <CardContent className="flex-grow">
                                <p className="text-muted-foreground text-sm line-clamp-3">
                                    {game.description || "Aucune description disponible pour ce jeu."}
                                </p>
                            </CardContent>

                            <CardFooter className="pt-4 border-t border-elsass-line">
                                <Link href={`/play/${game.id}`} className="w-full">
                                    <Button className="w-full bg-elsass-red hover:bg-elsass-red/90 text-white font-medium">
                                        Jouer <ArrowRight className="ml-2 w-4 h-4" />
                                    </Button>
                                </Link>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
