"use client";

/*
 * Catalogue de jeux — mobile : lignes pleine largeur (référence mockup).
 * Tablette/desktop : mêmes lignes réparties en grille (2-3 colonnes) plutôt
 * qu'une seule colonne étirée — pas de carte "verticale à la Play Store"
 * séparée : une seule structure de carte, la largeur d'écran décide du
 * nombre de colonnes.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Play, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORIES, type GameCatalogMeta } from "@/lib/game-catalog-meta";

interface Game {
    id: number;
    name: string;
    description: string;
    published: boolean;
    meta: GameCatalogMeta;
}

export function GamesCatalog({ games }: { games: Game[] }) {
    const [categorie, setCategorie] = useState<string>("Tous");

    // Dernier jeu ajouté (id croissant) mis en avant dans la bannière —
    // pas de notion de "jeu vedette" éditable, juste le plus récent.
    const vedette = games[games.length - 1];

    const filtres = useMemo(
        () => (categorie === "Tous" ? games : games.filter((g) => g.meta.categorie === categorie)),
        [games, categorie]
    );

    return (
        <div className="mx-auto max-w-6xl animate-in fade-in duration-500">
            {vedette && (
                <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-elsass-black to-elsass-ink px-5 py-6 sm:mb-8 sm:px-8 sm:py-10">
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-elsass-gold sm:text-xs">
                        À la une
                    </span>
                    <h2 className="mt-1 font-heading text-xl text-white sm:text-2xl lg:text-3xl">
                        {vedette.name}
                    </h2>
                </div>
            )}

            <h1 className="mb-4 font-heading text-3xl text-elsass-ink sm:text-4xl">Catalogue</h1>

            <div className="mb-6 flex gap-2 overflow-x-auto pb-1 sm:mb-8 sm:flex-wrap sm:overflow-visible">
                {CATEGORIES.map((cat) => (
                    <button
                        key={cat}
                        type="button"
                        onClick={() => setCategorie(cat)}
                        className={cn(
                            "shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors sm:text-sm",
                            categorie === cat
                                ? "bg-elsass-black text-white"
                                : "bg-elsass-line text-elsass-ink/70 hover:bg-elsass-line/70"
                        )}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {games.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-elsass-line bg-white/50 py-16 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-elsass-gold/15">
                        <Sparkles className="h-8 w-8 text-elsass-gold" />
                    </div>
                    <h3 className="mb-2 font-heading text-xl text-elsass-ink">Aucun jeu disponible</h3>
                    <p className="max-w-md text-muted-foreground">La bibliothèque est actuellement vide.</p>
                </div>
            ) : filtres.length === 0 ? (
                <p className="italic text-muted-foreground">Aucun jeu dans cette catégorie.</p>
            ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
                    {filtres.map((game) => (
                        <Link
                            key={game.id}
                            href={`/games/${game.id}`}
                            className="group flex items-center gap-4 rounded-xl border border-elsass-line bg-white p-3 transition-colors hover:border-elsass-gold"
                        >
                            <div
                                className={cn(
                                    "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl font-heading text-xl text-white",
                                    game.meta.couleur
                                )}
                            >
                                {game.meta.initiale}
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="truncate font-medium text-elsass-ink">{game.name}</h3>
                                <p className="truncate text-xs text-elsass-ink/55 sm:text-sm">
                                    {game.meta.categorie}
                                </p>
                            </div>
                            <div className="shrink-0">
                                {!game.published ? (
                                    <span className="rounded-full bg-elsass-line px-3 py-1.5 text-[11px] font-bold text-elsass-ink/70">
                                        Masqué
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 rounded-full bg-elsass-red px-4 py-1.5 text-xs font-bold text-white">
                                        <Play className="h-3 w-3 fill-current" /> Jouer
                                    </span>
                                )}
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
