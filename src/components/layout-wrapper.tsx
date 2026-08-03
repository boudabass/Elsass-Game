"use client";

import { usePathname } from "next/navigation";
import { MainNav } from "@/components/main-nav";
import { cn } from "@/lib/utils";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isGamePage = pathname?.startsWith("/play/");

    return (
        <div className="flex flex-col min-h-screen bg-elsass-cream">
            {/* Barre noire, dans le style du site principal. Masquée pendant une partie. */}
            {!isGamePage && (
                <header className="sticky top-0 z-40 bg-elsass-black">
                    <div className="h-14 sm:h-16 px-4 sm:px-6 max-w-6xl mx-auto flex items-center">
                        <MainNav />
                    </div>
                </header>
            )}

            {/* Mobile-first : padding compact, qui s'ouvre sur les grands écrans. */}
            <main className={cn(
                "flex-1 w-full",
                isGamePage ? "p-0" : "max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-8"
            )}>
                {children}
            </main>
        </div>
    );
}
