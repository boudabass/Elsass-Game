"use client";

/*
 * AppShell — coquille des écrans authentifiés (Accueil, Jeux, Scores, Profil,
 * Admin). Remplace l'ancienne ArcadeNav (barre pill du haut) par une nav
 * façon app native : barre d'onglets en bas sur mobile, rail vertical à
 * gauche à partir de la tablette (`md`). Les 4 destinations et l'état actif
 * sont définis une seule fois ; seule leur mise en forme change entre les
 * deux tailles (CSS uniquement, pas de duplication de logique).
 *
 * `h-dvh` + `overflow-y-auto` sur la zone de contenu : la nav reste fixe
 * pendant que le contenu défile en interne. Ça suppose que la page Odoo hôte
 * donne à l'iframe la hauteur pleine de l'écran ici (mode "game" du contrat
 * postMessage, voir iframe-resizer.tsx) — sinon une longue liste ferait
 * grandir toute l'iframe et la nav "fixe" scrollerait avec le reste.
 *
 * Pas de plafond de largeur ici : chaque page choisit sa propre largeur de
 * contenu (une fiche profil n'a pas besoin du même espace qu'un tableau
 * d'admin ou une grille de catalogue) plutôt que d'en hériter un imposé par
 * la coquille.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, Gamepad2, Trophy, User, type LucideIcon } from "lucide-react";

interface NavItem {
    href: string;
    label: string;
    icon: LucideIcon;
    estActif: (pathname: string) => boolean;
}

const LIENS: NavItem[] = [
    {
        href: "/dashboard",
        label: "Accueil",
        icon: Home,
        estActif: (p) => p === "/dashboard",
    },
    {
        href: "/games",
        label: "Jeux",
        icon: Gamepad2,
        estActif: (p) => p.startsWith("/games"),
    },
    {
        href: "/scores",
        label: "Scores",
        icon: Trophy,
        estActif: (p) => p.startsWith("/scores"),
    },
    {
        // Le Panneau admin est un sous-écran du Profil (mêmes 4 destinations
        // dans la nav, comme dans le mockup) : /admin met "Profil" actif.
        href: "/profile",
        label: "Profil",
        icon: User,
        estActif: (p) => p.startsWith("/profile") || p.startsWith("/admin"),
    },
];

export function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname() || "";

    return (
        <div className="flex h-dvh min-h-0 flex-col bg-elsass-cream md:flex-row">
            {/* Rail vertical — tablette (icônes seules) et desktop (icônes + libellés) */}
            <nav
                aria-label="Navigation de l'arcade"
                className="hidden shrink-0 flex-col gap-1 border-r border-elsass-line bg-white p-3 md:flex md:w-20 md:items-center lg:w-56 lg:items-stretch lg:p-4"
            >
                {LIENS.map((item) => {
                    const Icon = item.icon;
                    const actif = item.estActif(pathname);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            aria-current={actif ? "page" : undefined}
                            className={cn(
                                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors lg:px-4",
                                actif
                                    ? "bg-elsass-red text-white"
                                    : "text-elsass-ink/60 hover:bg-elsass-line/60 hover:text-elsass-ink"
                            )}
                        >
                            <Icon className="h-5 w-5 shrink-0" strokeWidth={actif ? 2.4 : 1.8} />
                            <span className="hidden lg:inline">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Zone de contenu — seule partie qui défile */}
            <main className="min-h-0 flex-1 overflow-y-auto pb-20 md:pb-0">
                <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">{children}</div>
            </main>

            {/* Barre d'onglets — mobile uniquement */}
            <nav
                aria-label="Navigation de l'arcade"
                className="fixed inset-x-0 bottom-0 z-40 flex h-16 border-t border-elsass-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
            >
                {LIENS.map((item) => {
                    const Icon = item.icon;
                    const actif = item.estActif(pathname);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            aria-current={actif ? "page" : undefined}
                            className={cn(
                                "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
                                actif ? "text-elsass-red" : "text-elsass-ink/60"
                            )}
                        >
                            <Icon className="h-5 w-5" strokeWidth={actif ? 2.4 : 1.8} />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}
