"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/*
 * Dialogue avec la page Odoo qui embarque l'arcade en iframe :
 *  - ARCADE_MODE  { mode: "game" | "page" } : sur une page de jeu, la page
 *    Odoo donne à l'iframe la hauteur de l'écran du visiteur ; sinon elle
 *    revient au mode "hauteur = contenu".
 *  - ARCADE_RESIZE { height } : hauteur du contenu (hors mode jeu).
 */
export function IframeResizer() {
  const pathname = usePathname();
  const isGamePage = !!pathname && pathname.startsWith("/play/");

  useEffect(() => {
    if (typeof window === "undefined" || window === window.parent) return;

    window.parent.postMessage(
      { type: "ARCADE_MODE", mode: isGamePage ? "game" : "page" },
      "*"
    );

    // En mode jeu, la hauteur est pilotée par la page Odoo (écran du
    // visiteur) : on ne mesure pas le contenu, sinon boucle infinie.
    if (isGamePage) return;

    let lastHeight = 0;

    const sendHeight = () => {
      const height = document.body.offsetHeight;
      // Ne redimensionner que si la différence dépasse 30px
      // (casse les boucles de micro-ajustements).
      if (Math.abs(lastHeight - height) > 30) {
        lastHeight = height;
        window.parent.postMessage({ type: "ARCADE_RESIZE", height: height }, "*");
      }
    };

    sendHeight();

    let timeoutId: NodeJS.Timeout;
    const observer = new ResizeObserver(() => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => sendHeight(), 100);
    });

    observer.observe(document.body);

    return () => {
      observer.disconnect();
      clearTimeout(timeoutId);
    };
  }, [isGamePage]);

  return null;
}
