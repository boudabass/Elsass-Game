import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, Info, ArrowRight } from "lucide-react"
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
        <div className="container mx-auto py-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-end border-b pb-6 mb-8">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                        <Play className="w-8 h-8 text-indigo-600" />
                        Catalogue de Jeux
                    </h1>
                    <p className="text-slate-500 mt-2 text-lg">Découvrez tous les titres disponibles sur la plateforme.</p>
                </div>
            </div>

            {games.length === 0 ? (
                <Card className="bg-slate-50 border-dashed border-2 border-slate-200">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                            <Info className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-700 mb-2">Aucun jeu disponible</h3>
                        <p className="text-slate-500 max-w-md">La bibliothèque est actuellement vide.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {games.map(game => (
                        <Card key={game.id} className="overflow-hidden hover:shadow-xl transition-all duration-300 group border-slate-200/60 flex flex-col h-full hover:-translate-y-1">
                            <div className="h-48 bg-slate-200 relative overflow-hidden flex items-center justify-center">
                                <Play className="w-12 h-12 text-slate-400 group-hover:scale-110 transition-transform duration-500" />
                            </div>
                            
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <CardTitle className="text-xl font-bold group-hover:text-indigo-600 transition-colors">
                                        {game.name}
                                    </CardTitle>
                                    {!game.published && (
                                        <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold shrink-0">
                                            Masqué
                                        </span>
                                    )}
                                </div>
                            </CardHeader>
                            
                            <CardContent className="flex-grow">
                                <p className="text-slate-600 text-sm line-clamp-3">
                                    {game.description || "Aucune description disponible pour ce jeu."}
                                </p>
                            </CardContent>
                            
                            <CardFooter className="pt-4 border-t bg-slate-50/50">
                                <Link href={`/play/${game.id}`} className="w-full">
                                    <Button className="w-full bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm font-semibold group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                        Jouer maintenant <ArrowRight className="ml-2 w-4 h-4 opacity-70" />
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