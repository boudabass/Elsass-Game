"use client";

import { usePathname } from "next/navigation";
import { ArcadePills, ArcadeTabs, ArcadeLoginTab } from "@/components/arcade-nav";
import { cn } from "@/lib/utils";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isGamePage = pathname?.startsWith("/play/");

    /*
     * Plus d'en-tête : l'arcade vit dans une page Odoo qui a déjà le sien
     * (voir arcade-nav.tsx). La navigation passe en bas sur mobile, en
     * pastilles dans le flux sur desktop.
     *
     * `min-h-screen` uniquement en mode jeu : hors jeu, la page Odoo donne
     * à l'iframe la hauteur du contenu, et forcer 100vh ferait grandir
     * l'iframe à chaque mesure (le contenu vaudrait toujours la hauteur
     * courante de l'iframe).
     */
    return (
        <div
            className={cn(
                "flex flex-col bg-elsass-cream",
                isGamePage && "min-h-screen"
            )}
        >
            <main
                className={cn(
                    "w-full flex-1",
                    isGamePage ? "p-0" : "mx-auto max-w-6xl px-4 pb-6 pt-4 sm:px-6 sm:pb-8 sm:pt-6"
                )}
            >
                {!isGamePage && <ArcadePills />}
                {children}
            </main>

            {/* Barre d'onglets : masquée pendant une partie, écran au jeu. */}
            {!isGamePage && (
                <>
                    <ArcadeTabs />
                    <ArcadeLoginTab />
                </>
            )}
        </div>
    );
}
