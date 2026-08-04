"use client";

import { usePathname } from "next/navigation";
import { ArcadeNav } from "@/components/arcade-nav";
import { cn } from "@/lib/utils";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isGamePage = pathname?.startsWith("/play/");

    /*
     * Plus d'en-tête noir : l'arcade vit dans une page Odoo qui a déjà le
     * sien (voir arcade-nav.tsx). Reste une barre de sous-menu discrète,
     * masquée pendant une partie — l'écran est au jeu.
     *
     * `min-h-screen` uniquement en mode jeu : hors jeu, la page Odoo donne
     * à l'iframe la hauteur du contenu, et forcer 100vh ferait grandir
     * l'iframe à chaque mesure (le contenu vaudrait toujours la hauteur
     * courante de l'iframe).
     */
    return (
        <div
            className={cn(
                // Fond blanc, comme la page Odoo qui embarque l'iframe.
                "flex flex-col bg-white",
                isGamePage && "min-h-screen"
            )}
        >
            {!isGamePage && <ArcadeNav />}

            <main
                className={cn(
                    "w-full flex-1",
                    isGamePage
                        ? "p-0"
                        : "mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8"
                )}
            >
                {children}
            </main>
        </div>
    );
}
