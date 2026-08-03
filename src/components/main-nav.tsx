"use client";

/*
 * MainNav — barre du haut, dans le style du site principal :
 * fond noir, mot-marque en Azimut, liens en pastille (or = actif).
 * Mobile-first : les liens sont cachés derrière un menu ☰ sous le
 * palier `sm`, affichés en ligne au-dessus.
 */

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Menu, LayoutDashboard, Gamepad2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/components/auth-provider";
import { UserNav } from "@/components/user-nav";

const LIENS = [
    { href: "/dashboard", label: "Accueil", icon: LayoutDashboard },
    { href: "/games", label: "Jeux", icon: Gamepad2 },
    { href: "/scores", label: "Scores", icon: Trophy },
];

function Wordmark() {
    return (
        <Link href="/dashboard" className="flex items-baseline gap-2 shrink-0">
            <span className="font-heading text-lg sm:text-xl text-white tracking-tight leading-none">
                The Elsassisch
            </span>
            <span className="hidden sm:inline text-elsass-gold text-[10px] font-sans font-semibold uppercase tracking-[0.2em]">
                Arcade
            </span>
        </Link>
    );
}

/** Pastille de nav desktop : fond or quand la page est active. */
function LienPastille({ href, label, active }: { href: string; label: string; active: boolean }) {
    return (
        <Link
            href={href}
            className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                active
                    ? "bg-elsass-gold text-elsass-black"
                    : "text-white/70 hover:text-white"
            )}
        >
            {label}
        </Link>
    );
}

export function MainNav() {
    const pathname = usePathname();
    const { user } = useAuth();
    const [ouvert, setOuvert] = useState(false);

    if (!user) {
        return (
            <div className="flex items-center justify-between w-full">
                <Wordmark />
                <UserNav />
            </div>
        );
    }

    const estActif = (href: string) =>
        href === "/dashboard" ? pathname === "/dashboard" : pathname?.startsWith(href);

    return (
        <div className="flex items-center justify-between w-full gap-4">
            <Wordmark />

            {/* Nav en ligne : visible à partir de sm */}
            <nav className="hidden sm:flex items-center gap-1">
                {LIENS.map((l) => (
                    <LienPastille key={l.href} href={l.href} label={l.label} active={!!estActif(l.href)} />
                ))}
            </nav>

            <div className="flex items-center gap-1">
                <UserNav />

                {/* Menu ☰ : visible seulement en dessous de sm */}
                <Sheet open={ouvert} onOpenChange={setOuvert}>
                    <SheetTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="sm:hidden text-white hover:bg-white/10 hover:text-white"
                            aria-label="Ouvrir le menu"
                        >
                            <Menu className="w-5 h-5" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="bg-elsass-black border-l border-white/10 w-72">
                        <SheetTitle className="font-heading font-normal text-white text-xl mb-6">
                            The Elsassisch
                        </SheetTitle>
                        <nav className="flex flex-col gap-1">
                            {LIENS.map((l) => {
                                const Icon = l.icon;
                                const actif = !!estActif(l.href);
                                return (
                                    <SheetClose asChild key={l.href}>
                                        <Link
                                            href={l.href}
                                            className={cn(
                                                "flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors",
                                                actif
                                                    ? "bg-elsass-gold text-elsass-black"
                                                    : "text-white/80 hover:bg-white/10 hover:text-white"
                                            )}
                                        >
                                            <Icon className="w-5 h-5" /> {l.label}
                                        </Link>
                                    </SheetClose>
                                );
                            })}
                        </nav>
                    </SheetContent>
                </Sheet>
            </div>
        </div>
    );
}
