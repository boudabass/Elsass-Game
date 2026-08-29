import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, ImageIcon } from "lucide-react";
import { query } from "@/lib/db";
import { getSessionUser } from "@/app/actions/auth";
import { getGameCatalogMeta } from "@/lib/game-catalog-meta";
import { cn } from "@/lib/utils";

// Fiche détail du catalogue — écran intermédiaire entre "Jeux" et le jeu
// lui-même (/play/[id]). Nouvelle route : jusqu'ici une carte du catalogue
// menait directement au jeu.
export default async function GameDetailPage({ params }: { params: Promise<{ gameId: string }> }) {
    const { gameId } = await params;

    const user = await getSessionUser();
    if (!user) redirect(`/login?expired=1&next=/games/${gameId}`);

    const isAdmin = !!process.env.ADMIN_UID && String(user.uid) === process.env.ADMIN_UID;
    const idNum = parseInt(gameId, 10);

    let game: any = null;
    let bestScore: number | null = null;

    try {
        if (!Number.isNaN(idNum)) {
            const { rows } = await query(
                "SELECT id, name, description, url, published FROM game WHERE id = $1",
                [idNum]
            );
            if (rows.length > 0 && (rows[0].published || isAdmin)) game = rows[0];

            if (game) {
                const { rows: scoreRows } = await query(
                    "SELECT score FROM score WHERE game_id = $1 AND user_id = $2",
                    [idNum, user.uid]
                );
                if (scoreRows.length > 0) bestScore = Number(scoreRows[0].score);
            }
        }
    } catch (e) {
        console.warn("Could not fetch game detail", e);
    }

    if (!game) notFound();

    const meta = getGameCatalogMeta(game.name);
    const jouable = game.published || isAdmin;

    return (
        <div className="mx-auto max-w-5xl animate-in fade-in duration-500">
            <Link
                href="/games"
                className="mb-4 inline-flex items-center gap-1 text-sm text-elsass-ink/60 hover:text-elsass-ink sm:mb-6"
            >
                <ChevronLeft className="h-4 w-4" /> Catalogue
            </Link>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <div>
                    <div className="mb-6 flex items-center gap-4">
                        <div
                            className={cn(
                                "flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-2xl font-heading text-2xl text-white",
                                meta.couleur
                            )}
                        >
                            {meta.initiale}
                        </div>
                        <div className="min-w-0">
                            <h1 className="truncate font-heading text-2xl text-elsass-ink sm:text-3xl">
                                {game.name}
                            </h1>
                            <p className="text-sm text-elsass-ink/55">
                                The Elsassisch · {meta.categorie}
                            </p>
                        </div>
                    </div>

                    {jouable ? (
                        <Link href={`/play/${game.id}`} className="block">
                            <button className="w-full rounded-full bg-elsass-red py-3.5 text-sm font-bold text-white transition-colors hover:bg-elsass-red/90 sm:text-base">
                                Jouer
                            </button>
                        </Link>
                    ) : (
                        <button
                            disabled
                            className="w-full cursor-not-allowed rounded-full bg-elsass-line py-3.5 text-sm font-bold text-elsass-ink/60 sm:text-base"
                        >
                            Bientôt disponible
                        </button>
                    )}

                    {!game.published && (
                        <p className="mt-2 text-xs font-medium text-elsass-ink/50">
                            Masqué au public — visible ici car vous êtes admin.
                        </p>
                    )}

                    <div className="mt-6 rounded-xl border border-elsass-line p-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-elsass-ink">Votre score</span>
                            <span className="font-heading text-lg text-elsass-red">
                                {bestScore !== null ? bestScore : "—"}
                            </span>
                        </div>
                    </div>
                </div>

                <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-elsass-ink/50">
                        À propos
                    </p>
                    <p className="mb-6 text-sm leading-relaxed text-elsass-ink">
                        {game.description || "Aucune description disponible pour ce jeu."}
                    </p>

                    <div className="flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible">
                        {[0, 1, 2].map((i) => (
                            <div
                                key={i}
                                className={cn(
                                    "flex h-24 w-32 shrink-0 items-center justify-center rounded-lg sm:w-full",
                                    meta.couleur
                                )}
                                style={{ opacity: 0.18 }}
                            >
                                <ImageIcon className="h-6 w-6 text-elsass-ink/60" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
