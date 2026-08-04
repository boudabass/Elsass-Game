import { redirect } from 'next/navigation'
import { Card, CardFooter, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, Star, ArrowRight } from "lucide-react"
import Link from "next/link"
import { query } from "@/lib/db"
import { getSessionUser } from "@/app/actions/auth"

export default async function DashboardPage() {
    // Session signée (HMAC) : invalide ou expirée -> retour au login.
    const user = await getSessionUser();
    if (!user) {
        redirect("/login?expired=1&next=/dashboard");
    }

    // L'admin voit aussi les jeux masqués (pour les tester avant publication).
    const isAdmin = !!process.env.ADMIN_UID && String(user.uid) === process.env.ADMIN_UID;

    let latestGames: any[] = [];
    try {
      const { rows } = await query(
        isAdmin
          ? "SELECT id, name FROM game ORDER BY created_at DESC LIMIT 3"
          : "SELECT id, name FROM game WHERE published ORDER BY created_at DESC LIMIT 3"
      );
      latestGames = rows;
    } catch (e: any) {
      console.warn("Could not fetch games", e);
    }

    const userName = user.name || user.username?.split('@')[0] || "Joueur"

    return (
        <div className="animate-in fade-in space-y-6 duration-500 sm:space-y-8">
            {/* Accueil : qui est là, et le raccourci vers le catalogue. */}
            <div className="flex flex-col gap-4 border-b border-elsass-line pb-6 sm:flex-row sm:items-end sm:justify-between sm:pb-8">
                <div>
                    <h1 className="font-heading text-3xl text-elsass-ink sm:text-4xl">
                        Bonjour, <span className="text-elsass-red">{userName}</span>
                    </h1>
                    <p className="mt-1 text-muted-foreground">Prêt pour une nouvelle partie ?</p>
                </div>
                <Link href="/games" className="shrink-0">
                    <Button
                        size="lg"
                        className="w-full bg-elsass-red font-medium text-white hover:bg-elsass-red/90 sm:w-auto"
                    >
                        <Play className="mr-2 h-5 w-5 fill-current" /> Lancer un jeu
                    </Button>
                </Link>
            </div>

            <Card className="border-elsass-line">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-heading font-normal text-xl text-elsass-ink">
                        <Star className="h-5 w-5 text-elsass-gold" /> Nouveautés sur la plateforme
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {latestGames.length > 0 ? latestGames.map(game => (
                            <div
                                key={game.id}
                                className="group flex items-center justify-between gap-3 rounded-lg border border-elsass-line p-3 transition-colors hover:border-elsass-gold"
                            >
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-elsass-black text-elsass-gold">
                                        <Play className="h-6 w-6" />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="truncate font-medium text-elsass-ink">{game.name}</h4>
                                        <span className="rounded-full bg-elsass-gold/20 px-2 py-0.5 text-xs text-elsass-ink">
                                            v1.0
                                        </span>
                                    </div>
                                </div>
                                <Link href={`/play/${game.id}`} className="shrink-0">
                                    {/* Toujours visible : au doigt, il n'y a pas de survol. */}
                                    <Button variant="ghost" size="sm" className="text-elsass-red hover:bg-elsass-red/10 hover:text-elsass-red">
                                        Jouer <ArrowRight className="ml-1 h-4 w-4" />
                                    </Button>
                                </Link>
                            </div>
                        )) : (
                            <p className="italic text-muted-foreground">
                                Aucun jeu récent (ou session expirée).
                            </p>
                        )}
                    </div>
                </CardContent>
                <CardFooter>
                    <Link href="/games" className="w-full">
                        <Button variant="outline" className="w-full border-elsass-line text-elsass-ink hover:bg-elsass-line/40">
                            Voir tout le catalogue
                        </Button>
                    </Link>
                </CardFooter>
            </Card>
        </div>
    )
}
