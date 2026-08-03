"use client";

/*
 * GameShell — coquille commune à tous les jeux.
 * Barre fine en haut (Retour | Nom du jeu | Menu) + iframe qui remplit
 * tout le reste. Le plein écran s'applique au wrapper entier : la barre
 * reste donc visible même en plein écran.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  EllipsisVertical,
  Maximize,
  Minimize,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface GameShellProps {
  gameName: string;
  gameUrl: string;
}

export function GameShell({ gameName, gameUrl }: GameShellProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
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
  }, [iframeKey]);

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

  const restartGame = useCallback(() => {
    setIsLoading(true);
    setIframeKey((k) => k + 1);
  }, []);

  const focusGame = useCallback(() => {
    iframeRef.current?.contentWindow?.focus();
  }, []);

  return (
    <div ref={wrapperRef} className="flex flex-col h-full bg-black">
      {/* Barre du haut : Retour | Nom | Menu */}
      <div className="flex items-center justify-between h-11 px-2 bg-slate-900 border-b border-slate-800 text-white shrink-0 relative">
        <Link href="/games">
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Retour
          </Button>
        </Link>

        <h1 className="absolute left-1/2 -translate-x-1/2 font-bold text-base truncate max-w-[50%] text-center pointer-events-none">
          {gameName}
        </h1>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-white hover:bg-slate-800"
              aria-label="Menu du jeu"
            >
              <EllipsisVertical className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canFullscreen && (
              <DropdownMenuItem onClick={toggleFullscreen}>
                {isFullscreen ? (
                  <>
                    <Minimize className="w-4 h-4 mr-2" /> Quitter le plein écran
                  </>
                ) : (
                  <>
                    <Maximize className="w-4 h-4 mr-2" /> Plein écran
                  </>
                )}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={restartGame}>
              <RotateCcw className="w-4 h-4 mr-2" /> Recommencer le jeu
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Zone de jeu : l'iframe remplit tout l'espace restant */}
      <div className="flex-1 relative min-h-0" onClick={focusGame}>
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-slate-900 z-20">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-500" />
            <p className="text-lg font-medium animate-pulse">
              Lancement de {gameName}...
            </p>
          </div>
        )}
        <iframe
          key={iframeKey}
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
