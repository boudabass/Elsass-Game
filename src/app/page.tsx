"use client";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  const { user, isLoading } = useAuth();

  return (
    // LayoutWrapper (mode "auth") ne pose plus aucun padding : la page gère
    // seule son centrage plein écran.
    <div className="flex min-h-dvh flex-col items-center justify-center bg-elsass-cream px-6 text-center">
      <span className="text-elsass-gold text-xs font-semibold uppercase tracking-[0.25em] mb-3">
        Arcade
      </span>
      <h1 className="font-heading text-4xl sm:text-6xl text-elsass-ink leading-tight max-w-2xl">
        The Elsassisch
      </h1>
      <p className="text-muted-foreground text-base sm:text-lg max-w-xl mt-4 leading-relaxed">
        Des jeux créés de toutes pièces par The Elsassisch, pour sa communauté.
      </p>

      <div className="pt-8">
        {user ? (
          <Link href="/dashboard">
            <Button
              size="lg"
              className="h-12 px-8 text-base font-medium bg-elsass-red hover:bg-elsass-red/90 text-white"
            >
              Lancer l'Arcade <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        ) : (
          <Link href="/login">
            <Button
              size="lg"
              className="h-12 px-8 text-base font-medium bg-elsass-red hover:bg-elsass-red/90 text-white"
              disabled={isLoading}
            >
              Commencer maintenant <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
