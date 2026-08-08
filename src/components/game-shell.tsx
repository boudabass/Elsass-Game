"use client";

/*
 * GameShell — coquille commune à tous les jeux.
 *
 * ⭐ Chantier B (08/08/2026, art. 704) : la barre du haut (Retour | Nom du
 * jeu | Plein écran) est SUPPRIMÉE — elle ne sert plus (décision John).
 * Le jeu remplit tout l'écran. Ses deux fonctions passent DANS l'UI du
 * jeu, en icônes persistantes sur toutes les scènes (brique
 * Arcade.UI.iconesPlateforme dans public/games/core/ui.js) :
 *  - Quitter (haut-gauche) : retour vers /games ;
 *  - Plein écran (haut-droite) : requestFullscreen du document du jeu
 *    (l'iframe garde allow="fullscreen" pour autoriser le plein écran).
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";

interface GameShellProps {
  gameName: string;
  gameUrl: string;
}

export function GameShell({ gameName, gameUrl }: GameShellProps) {
  const [isLoading, setIsLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Filet de sécurité : ne pas rester bloqué sur le loader.
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  const focusGame = useCallback(() => {
    iframeRef.current?.contentWindow?.focus();
  }, []);

  return (
    <div className="relative h-full bg-black" onClick={focusGame}>
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-elsass-black z-20">
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
  );
}
