/*
 * core/ui/tokens.js — couleurs de marque The Elsassisch, côté Phaser.
 *
 * Miroir EXPLICITE de `tailwind.config.ts` -> `theme.colors.elsass` (côté
 * Next.js) : les 6 couleurs de marque, mêmes valeurs, même noms français
 * qu'utilisés depuis toujours dans les `config.js` des jeux (bouton,
 * boutonSecondaire, encadreRecord...). Si la charte change un jour, ce
 * fichier ET tailwind.config.ts changent ensemble.
 *
 * + 2 constantes qui ne sont pas dans la palette Tailwind mais qui sont
 * déjà un standard de fait, identique dans les 4 jeux (Cigogne, Waggis,
 * Similitude, Elsass Farm) : le vert "Jouer/Commencer" et l'ombre standard
 * des boutons.
 *
 * Les couleurs de DÉCOR (ciel, toits, sol, façades...) ne sont PAS ici :
 * elles sont propres à chaque monde de jeu, pas à la marque — elles
 * restent dans le config.js de chaque jeu.
 */
(function () {
    "use strict";

    window.Arcade = window.Arcade || {};
    Arcade.UI = Arcade.UI || {};

    Arcade.UI.tokens = {
        noir: "#141210",   // elsass.black
        rouge: "#E31B23",  // elsass.red
        or: "#F2B93D",     // elsass.gold
        creme: "#FBF8F3",  // elsass.cream
        encre: "#26221D",  // elsass.ink
        ligne: "#E9E2D6",  // elsass.line
        succes: "#2E9E4F", // vert historique — plus utilisé par les menus (23/09 : « Jouer » = rouge, comme l'app)
        ombre: "rgba(20, 18, 16, 0.28)", // ombre standard des boutons (= noir + alpha)
        ombreDouce: "rgba(20, 18, 16, 0.14)" // ombre des cartes claires (tuiles crème du menu)
    };

    /**
     * Convertit une couleur CSS ("#E31B23", "rgba(20,18,16,0.28)") en
     * { valeur: 0xRRGGBB, alpha: 0..1 } pour Graphics.fillStyle /
     * lineStyle. ⚠️ Ces deux méthodes n'acceptent QUE des nombres : une
     * chaîne passée telle quelle est lue comme 0 par le rendu WebGL, donc
     * NOIR OPAQUE — c'est ce qui rendait les ombres « rgba » des boutons
     * noires et pleines jusqu'au 23/09/2026.
     */
    Arcade.UI.couleur = function (css) {
        if (typeof css === "number") return { valeur: css, alpha: 1 };
        var c = Phaser.Display.Color.ValueToColor(css);
        return { valeur: c.color, alpha: c.alpha / 255 };
    };
})();
