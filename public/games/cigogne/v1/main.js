/*
 * main.js — point de départ de Cigogne.
 * Décrit ce qu'il faut charger, puis laisse le socle démarrer le jeu.
 */
(function () {
    "use strict";

    const C = window.CigogneConfig;

    Arcade.boot({
        key: C.key,
        backgroundColor: C.couleurs.ciel,
        scenes: [MenuScene, GameScene, OverScene],
        firstScene: MenuScene.KEY,

        // Chargement : une seule image à télécharger, le reste est dessiné.
        preload: function (scene) {
            scene.load.spritesheet("cigogne", "assets/cigogne_vol.png", {
                frameWidth: 256,
                frameHeight: 256
            });
            CigogneDecor.genererTextures(scene);
        },

        // Une fois tout chargé : animation de vol + sauvegarde.
        create: async function (scene) {
            scene.anims.create({
                key: "voler",
                frames: scene.anims.generateFrameNumbers("cigogne", { start: 0, end: 7 }),
                frameRate: 12,
                repeat: -1
            });

            // Contrat de save : version 1, aucune migration pour l'instant.
            Arcade.Save.configure({
                key: C.key,
                version: 1,
                migrations: {},
                gather: function () {
                    return { parties: scene.registry.get("parties") || 0 };
                },
                apply: function (data) {
                    scene.registry.set("parties", (data && data.parties) || 0);
                }
            });

            await Arcade.Save.load();
            Arcade.Save.startAutosave();
        }
    });
})();
