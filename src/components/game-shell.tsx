"use client";

/*
 * GameShell — coquille commune à tous les jeux.
 * Barre fine en haut (Retour | Nom du jeu | Plein écran) + iframe qui remplit
 * tout le reste. Le plein écran s'applique au wrapper entier : la barre
 * reste donc visible même en plein écran.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Maximize, Minimize, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GameShellProps {
  gameName: string;
  gameUrl: string;
}

export function GameShell({ gameName, gameUrl }: GameShellProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Le plein écran n'est pas disponible partout (ex: Safari iPhone).
  useEffect(() => {
    setCanFullscreen(
      typeof document !== "undefined" && !!document.fullscreenEnabled
    );
  }, []);

  // Suivre l'état réel du plein écran (la touche Échap le quitte aussi).
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Filet de sécurité : ne pas rester bloqué sur le loader.
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (wrapperRef.current) {
        await wrapperRef.current.requestFullscreen();
      }
    } catch (e) {
      console.error("Plein écran refusé :", e);
    }
  }, []);

  const focusGame = useCallback(() => {
    iframeRef.current?.contentWindow?.focus();
  }, []);

  return (
    <div ref={wrapperRef} className="flex flex-col h-full bg-black">
      {/* Barre du haut : Retour | Nom | Plein écran */}
      <div className="flex items-center justify-between h-11 px-2 bg-elsass-black border-b border-white/10 text-elsass-cream shrink-0 relative">
        <Link href="/games">
          <Button
            variant="ghost"
            size="sm"
            className="text-elsass-cream/60 hover:text-elsass-cream hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Retour
          </Button>
        </Link>

        <h1 className="absolute left-1/2 -translate-x-1/2 font-heading text-base truncate max-w-[50%] text-center pointer-events-none">
          {gameName}
        </h1>

        {canFullscreen && (
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            className="text-elsass-cream/60 hover:text-elsass-cream hover:bg-white/10"
            aria-label={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
          >
            {isFullscreen ? (
              <Minimize className="w-5 h-5" />
            ) : (
              <Maximize className="w-5 h-5" />
            )}
          </Button>
        )}
      </div>

      {/* Zone de jeu : l'iframe remplit tout l'espace restant */}
      <div className="flex-1 relative min-h-0" onClick={focusGame}>
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-elsass-cream bg-elsass-black z-20">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-elsass-gold" />
            <p className="text-lg font-medium animate-pulse font-heading">
              Lancement de {gameName}...
            </p>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={gameUrl}
          onLoad={() => {
            setIsLoading(false);
            focusGame();
          }}
          className="absolute inset-0 w-full h-full border-0 block"
          allow="autoplay; fullscreen; gamepad; accelerometer; gyroscope"
          title={`Jeu ${gameName}`}
          scrolling="no"
        />
      </div>
    </div>
  );
}
