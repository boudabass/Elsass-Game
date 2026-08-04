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
import { cn } from "@/lib/utils";

/*
 * variant "bar" : bouton texte, dans la rangée de pastilles (desktop).
 * variant "tab" : 4e onglet de la barre du bas (mobile) — icône + label,
 *                 même gabarit que les autres onglets, menu ouvert vers
 *                 le haut puisqu'il n'y a rien en dessous.
 */
export function UserNav({ variant = "bar" }: { variant?: "bar" | "tab" }) {
    const { user, role, isLoading, signOut } = useAuth();
    const estTab = variant === "tab";

    if (isLoading)
        return (
            <div
                className={cn(
                    "animate-pulse rounded-full bg-elsass-line",
                    estTab ? "m-3 h-8" : "h-8 w-24"
                )}
            />
        );

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
                {estTab ? (
                    <button
                        type="button"
                        className="flex min-h-[56px] flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium text-elsass-ink/50 transition-colors data-[state=open]:text-elsass-red"
                    >
                        <CircleUser className="h-5 w-5" strokeWidth={1.8} />
                        Moi
                    </button>
                ) : (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full text-elsass-ink/70 hover:bg-elsass-line/60 hover:text-elsass-ink"
                    >
                        Mon espace
                    </Button>
                )}
            </DropdownMenuTrigger>
            <DropdownMenuContent
                className="w-56"
                align="end"
                side={estTab ? "top" : "bottom"}
                sideOffset={estTab ? 8 : 4}
                forceMount
            >
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
