"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Mêmes préfixes que layout-wrapper.tsx (AppShell) : ces écrans ont une nav
// persistante (barre du bas / rail) qui a besoin de la hauteur pleine pour
// rester fixe pendant que le contenu défile en interne.
const PREFIXES_PLEINE_HAUTEUR = ["/play/", "/dashboard", "/games", "/scores", "/profile", "/admin"];

/*
 * Dialogue avec la page Odoo qui embarque l'arcade en iframe :
 *  - ARCADE_MODE  { mode: "game" | "page" } : en mode "game" (page de jeu OU
 *    écran avec nav persistante), la page Odoo donne à l'iframe la hauteur
 *    de l'écran du visiteur ; sinon elle revient au mode "hauteur = contenu".
 *  - ARCADE_RESIZE { height } : hauteur du contenu (hors mode "game").
 */
export function IframeResizer() {
  const pathname = usePathname();
  const isFullHeightPage = !!pathname && PREFIXES_PLEINE_HAUTEUR.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (typeof window === "undefined" || window === window.parent) return;

    window.parent.postMessage(
      { type: "ARCADE_MODE", mode: isFullHeightPage ? "game" : "page" },
      "*"
    );

    // En mode "game", la hauteur est pilotée par la page Odoo (écran du
    // visiteur) : on ne mesure pas le contenu, sinon boucle infinie.
    if (isFullHeightPage) return;

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
  }, [isFullHeightPage]);

  return null;
}
