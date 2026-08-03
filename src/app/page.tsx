"use client";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { ArrowRight, LayoutDashboard } from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  const { user, isLoading } = useAuth();

  return (
    <div className="relative min-h-[800px] bg-white text-slate-900 flex flex-col items-center justify-center px-6 overflow-hidden">
      {/* Bouton connexion / dashboard, en haut à droite */}
      <div className="absolute top-6 right-6 z-10">
        {!isLoading && user ? (
          <Link href="/dashboard">
            <Button variant="default" className="bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-lg shadow-indigo-500/20">
              <LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard
            </Button>
          </Link>
        ) : (
          <Link href="/login">
            <Button variant="outline" className="border-indigo-500 text-indigo-600 hover:bg-indigo-500 hover:text-white transition-all">
              Connexion
            </Button>
          </Link>
        )}
      </div>

      <div className="relative z-10 text-center space-y-6 max-w-3xl">
        <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-tight">
          The Elsassisch
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-cyan-500 to-teal-500">
            Game center
          </span>
        </h1>
        <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
          Des jeux créés de toutes pièces par The Elsassisch, pour sa communauté.
        </p>
        <div className="pt-6">
          {user ? (
            <Link href="/dashboard">
              <Button size="lg" className="h-14 px-8 text-lg font-bold bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all transform hover:scale-105">
                Lancer l'Arcade <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          ) : (
            <Link href="/login">
              <Button size="lg" className="h-14 px-8 text-lg font-bold bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all transform hover:scale-105">
                Commencer maintenant <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
