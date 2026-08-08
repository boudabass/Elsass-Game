/*
 * main.js — point de départ de Similitude.
 * Décrit ce qu'il faut charger, puis laisse le socle démarrer le jeu.
 */
(function () {
    "use strict";

    const C = window.SimilitudeConfig;

    Arcade.boot({
        key: C.key,
        backgroundColor: C.couleurs.fond,
        scenes: [MenuScene, GameScene, OverScene],
        firstScene: MenuScene.KEY,

        // Règle de l'arcade : rendu net pour les sprites 16×16 agrandis
        // (spec 473 §8 — les substituts sont du pixel art).
        pixelArt: true,

        // Contrat de plateforme (chantier B, art. 704) : les boutons
        // persistants Quitter (haut-gauche) / Plein écran (haut-droite)
        // reprennent le style du bouton Réglages. Les textes vivent dans
        // config.js, la couleur de fond vient de la config — le socle
        // (core/ui.js, Arcade.UI.iconesPlateforme) fait le reste.
        iconesPlateforme: {
            retour: C.textes.retour,
            pleinEcran: C.textes.pleinEcran,
            style: {
                couleur: C.couleurs.bouton
            }
        },

        // Chargement : les 6 items alsaciens, chemins listés UNE SEULE FOIS
        // dans config.js (spec §7 — point clos).
        preload: function (scene) {
            C.items.forEach(function (item) {
                scene.load.image(item.cle, item.chemin);
            });
        },

        // Session unique (spec §2) : AUCUNE sauvegarde de partie — core/save.js
        // n'est volontairement pas câblé. Seul le score final part au serveur
        // via Arcade.Score.submit() (SIM-3).
        create: async function () {
            // Rien à initialiser en SIM-1 : la grille se construit dans
            // GameScene, le meilleur score se lit dans MenuScene.
        }
    });
})();
