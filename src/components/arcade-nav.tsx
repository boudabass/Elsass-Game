"use client";

/*
 * ArcadeNav — navigation de l'arcade, pensée pour l'iframe.
 *
 * L'arcade est embarquée dans une page du site Odoo, qui a DÉJÀ son
 * en-tête (logo, menu, panier). Rejouer une barre noire avec un
 * mot-marque faisait doublon : deux en-têtes empilés.
 *
 * La nav reste donc en haut — c'est le seul endroit où elle est visible
 * dès l'arrivée, quelle que soit la longueur du catalogue — mais elle
 * abandonne tout ce qui la faisait ressembler à un second en-tête de
 * site : pas de logo, pas de bandeau noir pleine largeur, hauteur
 * réduite. Elle se lit comme un sous-menu de page.
 *
 * Une seule rangée, identique du mobile au desktop, qui grandit un peu
 * sur les grands écrans.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Gamepad2, Trophy } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { UserNav } from "@/components/user-nav";

const LIENS = [
    { href: "/dashboard", label: "Accueil", icon: LayoutDashboard },
    { href: "/games", label: "Jeux", icon: Gamepad2 },
    { href: "/scores", label: "Scores", icon: Trophy },
];

export function ArcadeNav() {
    const pathname = usePathname();
    const { user } = useAuth();

    // /dashboard doit matcher exact, sinon toutes les pages seraient actives.
    const estActif = (href: string) =>
        href === "/dashboard"
            ? pathname === "/dashboard"
            : !!pathname?.startsWith(href);

    return (
        <div
            className={cn(
                // `sticky` ne mord que si l'iframe scrolle elle-même ; sinon
                // inoffensif, la barre reste simplement en tête de contenu.
                "sticky top-0 z-40",
                "border-b border-elsass-line bg-elsass-cream/95 backdrop-blur"
            )}
        >
            <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-2 px-3 sm:h-14 sm:px-6">
                {user ? (
                    <nav
                        className="flex min-w-0 items-center gap-1"
                        aria-label="Navigation de l'arcade"
                    >
                        {LIENS.map((l) => {
                            const Icon = l.icon;
                            const actif = estActif(l.href);
                            return (
                                <Link
                                    key={l.href}
                                    href={l.href}
                                    aria-current={actif ? "page" : undefined}
                                    className={cn(
                                        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors sm:px-4 sm:text-sm",
                                        actif
                                            ? "bg-elsass-gold text-elsass-black"
                                            : "text-elsass-ink/60 hover:bg-elsass-line/60 hover:text-elsass-ink"
                                    )}
                                >
                                    {/* Icônes à partir de sm : sur un écran de
                                        360 px, 3 libellés + le compte tiennent,
                                        avec les icônes non. Le mot prime. */}
                                    <Icon
                                        className="hidden h-4 w-4 shrink-0 sm:block"
                                        strokeWidth={actif ? 2.4 : 1.8}
                                    />
                                    {l.label}
                                </Link>
                            );
                        })}
                    </nav>
                ) : (
                    <span className="text-[13px] font-medium text-elsass-ink/50">
                        Arcade
                    </span>
                )}

                <UserNav />
            </div>
        </div>
    );
}
