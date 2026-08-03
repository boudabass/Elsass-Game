/*
 * core/boot.js — démarrage standardisé d'un jeu de l'arcade.
 *
 * Un jeu ne crée jamais son Phaser.Game lui-même : il appelle Arcade.boot().
 * Toutes les règles communes de l'arcade sont appliquées ici, en un seul
 * endroit : plein écran, redimensionnement, clic/tap uniquement, physique
 * Arcade, écran de chargement.
 *
 * Exemple d'utilisation (dans le jeu) :
 *
 *   Arcade.boot({
 *     key: "cigogne",
 *     backgroundColor: "#87ceeb",
 *     preload: (scene) => { scene.load.image("fond", "assets/fond.png"); },
 *     scenes: [MenuScene, GameScene, OverScene],
 *     firstScene: "menu"
 *   });
 */
(function () {
    "use strict";

    window.Arcade = window.Arcade || {};

    Arcade.boot = function (opts) {
        if (!opts || !opts.scenes || !opts.scenes.length) {
            throw new Error("[boot] Il faut au moins une scène de jeu.");
        }

        Arcade.bootOptions = opts;

        // Identifiant court partagé par la sauvegarde et le meilleur score.
        if (opts.key) Arcade.Score.configure(opts.key);

        var config = {
            type: Phaser.AUTO,              // WebGL si possible, sinon Canvas
            parent: opts.parent || "jeu",
            backgroundColor: opts.backgroundColor || "#0f172a",

            // L'écran de jeu occupe toute la place disponible et suit les
            // rotations du téléphone.
            scale: {
                mode: Phaser.Scale.RESIZE,
                autoCenter: Phaser.Scale.CENTER_BOTH,
                width: "100%",
                height: "100%"
            },

            // RÈGLE DE L'ARCADE : clic / tap uniquement.
            input: {
                keyboard: false,
                gamepad: false,
                mouse: true,
                touch: true,
                activePointers: 2           // un doigt + un de réserve
            },

            physics: {
                default: "arcade",
                arcade: {
                    gravity: { x: 0, y: 0 },
                    debug: !!opts.debugPhysics
                }
            },

            // Images pixel art : pas de flou à l'agrandissement.
            pixelArt: opts.pixelArt !== false,

            // L'écran de chargement passe toujours en premier.
            scene: [Arcade.PreloadScene].concat(opts.scenes)
        };

        var game = new Phaser.Game(config);
        Arcade.game = game;
        return game;
    };
})();
