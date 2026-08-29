"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/app-shell";

// Écrans authentifiés avec nav persistante (barre du bas / rail) — voir
// app-shell.tsx. Même liste que iframe-resizer.tsx (mode "game" côté Odoo).
const PREFIXES_COQUILLE = ["/dashboard", "/games", "/scores", "/profile", "/admin"];

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname() || "";
    const isGamePage = pathname.startsWith("/play/");
    const isShellPage = PREFIXES_COQUILLE.some((p) => pathname.startsWith(p));

    // Jeu : GameShell occupe 100% de l'espace, aucun chrome autour.
    if (isGamePage) {
        return <div className="min-h-screen bg-white">{children}</div>;
    }

    // Accueil/Jeux/Scores/Profil/Admin : coquille app native (nav + contenu
    // scrollable en interne), largeur laissée au choix de chaque page.
    if (isShellPage) {
        return <AppShell>{children}</AppShell>;
    }

    // Landing (/) et /login : pas de nav, ces pages gèrent leur propre
    // centrage plein-écran (hauteur pilotée par leur contenu côté Odoo).
    return <div className="min-h-dvh bg-elsass-cream">{children}</div>;
}
