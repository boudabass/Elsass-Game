"use client";

/*
 * ArcadeNav — navigation de l'arcade pensée pour l'iframe.
 *
 * L'arcade est embarquée dans une page du site Odoo, qui a DÉJÀ son
 * en-tête (logo, menu, panier). Rejouer une barre noire avec un
 * mot-marque en haut faisait doublon : deux en-têtes empilés, et sur
 * mobile la moitié de l'écran mangée avant de voir un jeu.
 *
 * D'où deux rendus, jamais les deux à la fois :
 *  - mobile  : barre d'onglets EN BAS (réflexe application), 4 cibles
 *              larges au pouce, aucune concurrence avec l'en-tête Odoo ;
 *  - sm et + : simple rangée de pastilles dans le flux, sur fond crème,
 *              sans logo ni bandeau — ça se lit comme un sous-menu de
 *              page, pas comme l'en-tête d'un second site.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Gamepad2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { UserNav } from "@/components/user-nav";

const LIENS = [
    { href: "/dashboard", label: "Accueil", icon: LayoutDashboard },
    { href: "/games", label: "Jeux", icon: Gamepad2 },
    { href: "/scores", label: "Scores", icon: Trophy },
];

/** /dashboard doit matcher exact, sinon toutes les pages seraient actives. */
function useEstActif() {
    const pathname = usePathname();
    return (href: string) =>
        href === "/dashboard"
            ? pathname === "/dashboard"
            : !!pathname?.startsWith(href);
}

/* --------------------------------------------------------------- desktop */

export function ArcadePills() {
    const { user } = useAuth();
    const estActif = useEstActif();

    if (!user) {
        return (
            <div className="hidden sm:flex justify-end pb-2">
                <UserNav />
            </div>
        );
    }

    return (
        <div className="hidden sm:flex items-center justify-between gap-4 pb-4">
            <nav className="flex items-center gap-1">
                {LIENS.map((l) => {
                    const actif = estActif(l.href);
                    return (
                        <Link
                            key={l.href}
                            href={l.href}
                            aria-current={actif ? "page" : undefined}
                            className={cn(
                                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                                actif
                                    ? "bg-elsass-gold text-elsass-black"
                                    : "text-elsass-ink/60 hover:text-elsass-ink hover:bg-elsass-line/60"
                            )}
                        >
                            {l.label}
                        </Link>
                    );
                })}
            </nav>
            <UserNav />
        </div>
    );
}

/* ---------------------------------------------------------------- mobile */

export function ArcadeTabs() {
    const { user } = useAuth();
    const estActif = useEstActif();

    if (!user) return null;

    return (
        <nav
            className={cn(
                "sm:hidden sticky bottom-0 z-40",
                "border-t border-elsass-line bg-white/95 backdrop-blur",
                // Encoche des iPhone : on pousse la barre au-dessus du trait.
                "pb-[env(safe-area-inset-bottom)]"
            )}
            aria-label="Navigation de l'arcade"
        >
            <div className="grid grid-cols-4">
                {LIENS.map((l) => {
                    const Icon = l.icon;
                    const actif = estActif(l.href);
                    return (
                        <Link
                            key={l.href}
                            href={l.href}
                            aria-current={actif ? "page" : undefined}
                            className={cn(
                                "flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] text-[11px] font-medium transition-colors",
                                actif ? "text-elsass-red" : "text-elsass-ink/50"
                            )}
                        >
                            <Icon className="w-5 h-5" strokeWidth={actif ? 2.4 : 1.8} />
                            {l.label}
                        </Link>
                    );
                })}

                {/* 4e onglet : le menu compte, ouvert vers le haut. */}
                <UserNav variant="tab" />
            </div>
        </nav>
    );
}

/** Bouton de connexion isolé, pour les pages vues sans session. */
export function ArcadeLoginTab() {
    const { user, isLoading } = useAuth();
    if (user || isLoading) return null;

    return (
        <div className="sm:hidden sticky bottom-0 z-40 border-t border-elsass-line bg-white/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
            <Link href="/login" className="block">
                <Button className="w-full rounded-full bg-elsass-red font-medium text-white hover:bg-elsass-red/90">
                    Se connecter
                </Button>
            </Link>
        </div>
    );
}
