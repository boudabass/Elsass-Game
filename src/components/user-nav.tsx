"use client";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { LogOut, User, Shield, Trophy, CircleUser } from "lucide-react";

/*
 * Bouton de compte, à droite de la barre de l'arcade. Sur mobile la
 * place manque à côté des trois onglets : on ne garde que l'icône.
 */
export function UserNav() {
    const { user, role, isLoading, signOut } = useAuth();

    if (isLoading)
        return <div className="h-8 w-8 animate-pulse rounded-full bg-elsass-line sm:w-24" />;

    if (!user) {
        return (
            <Link href="/login">
                <Button
                    size="sm"
                    className="bg-elsass-red text-white hover:bg-elsass-red/90 rounded-full font-medium"
                >
                    Se connecter
                </Button>
            </Link>
        );
    }

    const email = user.email || "U";

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Mon espace"
                    className="shrink-0 rounded-full px-2 text-elsass-ink/70 hover:bg-elsass-line/60 hover:text-elsass-ink sm:px-3"
                >
                    <CircleUser className="h-5 w-5 sm:hidden" strokeWidth={1.8} />
                    <span className="hidden sm:inline">Mon espace</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" sideOffset={4} forceMount>
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">Mon Compte</p>
                        <p className="text-xs leading-none text-muted-foreground">
                            {email}
                        </p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                        <Link href="/profile" className="cursor-pointer">
                            <User className="mr-2 h-4 w-4" />
                            <span>Mon Profil</span>
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link href="/scores" className="cursor-pointer">
                            <Trophy className="mr-2 h-4 w-4" />
                            <span>Mes Scores</span>
                        </Link>
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />

                {/* Lien Admin réservé aux administrateurs */}
                {role === 'admin' && (
                    <DropdownMenuItem asChild>
                        <Link href="/admin" className="cursor-pointer">
                            <Shield className="mr-2 h-4 w-4" />
                            <span>Admin Panel</span>
                        </Link>
                    </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()} className="text-elsass-red focus:text-elsass-red cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Se déconnecter</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
