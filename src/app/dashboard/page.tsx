import { redirect } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Play, Sparkles, ChevronRight } from "lucide-react"
import Link from "next/link"
import { query } from "@/lib/db"
import { getSessionUser } from "@/app/actions/auth"
import { getGameCatalogMeta } from "@/lib/game-catalog-meta"
import { cn } from "@/lib/utils"

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
          ? "SELECT id, name FROM game ORDER BY created_at DESC LIMIT 6"
          : "SELECT id, name FROM game WHERE published ORDER BY created_at DESC LIMIT 6"
      );
      latestGames = rows;
    } catch (e: any) {
      console.warn("Could not fetch games", e);
    }

    const userName = user.name || user.username?.split('@')[0] || "Joueur"
    const initiale = userName.charAt(0).toUpperCase();

    return (
        <div className="mx-auto max-w-6xl animate-in fade-in space-y-6 duration-500 sm:space-y-8">
            {/* Accueil : qui est là, et le raccourci vers le catalogue. */}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="font-heading text-2xl text-elsass-ink sm:text-3xl lg:text-4xl">
                        Bonjour, <span className="text-elsass-red">{userName}</span>
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                        Prêt pour une nouvelle partie ?
                    </p>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-elsass-black font-heading text-elsass-gold sm:h-11 sm:w-11">
                    {initiale}
                </div>
            </div>

            <Link href="/games" className="block">
                <Button
                    size="lg"
                    className="w-full rounded-full bg-elsass-red py-6 font-medium text-white hover:bg-elsass-red/90"
                >
                    <Play className="mr-2 h-5 w-5 fill-current" /> Lancer un jeu
                </Button>
            </Link>

            <div>
                <h2 className="mb-3 flex items-center gap-2 font-heading text-xl text-elsass-ink sm:mb-4">
                    <Sparkles className="h-5 w-5 text-elsass-gold" /> Nouveautés
                </h2>

                {latestGames.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {latestGames.map((game) => {
                            const meta = getGameCatalogMeta(game.name);
                            return (
                                <Link
                                    key={game.id}
                                    href={`/games/${game.id}`}
                                    className="group flex items-center gap-3 rounded-xl border border-elsass-line bg-white p-3 transition-colors hover:border-elsass-gold"
                                >
                                    <div
                                        className={cn(
                                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-heading text-base text-white",
                                            meta.couleur
                                        )}
                                    >
                                        {meta.initiale}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h4 className="truncate font-medium text-elsass-ink">{game.name}</h4>
                                        <span className="text-xs text-elsass-ink/55">{meta.categorie}</span>
                                    </div>
                                    <ChevronRight className="h-4 w-4 shrink-0 text-elsass-red" />
                                </Link>
                            );
                        })}
                    </div>
                ) : (
                    <p className="italic text-muted-foreground">
                        Aucun jeu récent (ou session expirée).
                    </p>
                )}
            </div>
        </div>
    )
}
