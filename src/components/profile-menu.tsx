"use client";

import Link from "next/link";
import { Trophy, Shield, LogOut, ChevronRight } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

// Lignes d'action de l'écran Profil — composant client séparé uniquement
// pour "Se déconnecter" (appelle useAuth().signOut()) ; le reste de la page
// profil reste un composant serveur.
export function ProfileMenu({ isAdmin }: { isAdmin: boolean }) {
    const { signOut } = useAuth();

    return (
        <div className="overflow-hidden rounded-xl border border-elsass-line bg-white">
            <Link
                href="/scores"
                className="flex items-center gap-3 border-b border-elsass-line px-4 py-3.5 text-elsass-ink hover:bg-elsass-line/20"
            >
                <Trophy className="h-[18px] w-[18px] text-elsass-ink/70" strokeWidth={1.8} />
                <span className="flex-1 text-sm">Mes scores</span>
                <ChevronRight className="h-4 w-4 text-elsass-ink/40" />
            </Link>

            {isAdmin && (
                <Link
                    href="/admin"
                    className="flex items-center gap-3 border-b border-elsass-line px-4 py-3.5 text-elsass-ink hover:bg-elsass-line/20"
                >
                    <Shield className="h-[18px] w-[18px] text-elsass-ink/70" strokeWidth={1.8} />
                    <span className="flex-1 text-sm">Panneau admin</span>
                    <ChevronRight className="h-4 w-4 text-elsass-ink/40" />
                </Link>
            )}

            <button
                type="button"
                onClick={() => signOut()}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-elsass-red hover:bg-elsass-red/5"
            >
                <LogOut className="h-[18px] w-[18px]" strokeWidth={1.8} />
                <span className="text-sm font-medium">Se déconnecter</span>
            </button>
        </div>
    );
}
