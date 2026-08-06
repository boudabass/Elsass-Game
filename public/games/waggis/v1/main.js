/*
 * main.js — point de départ de Waggis.
 * Décrit ce qu'il faut charger, puis laisse le socle démarrer le jeu.
 */
(function () {
    "use strict";

    const C = window.WaggisConfig;

    Arcade.boot({
        key: C.key,
        backgroundColor: C.couleurs.ciel,
        scenes: [MenuScene, GameScene, OverScene],
        firstScene: MenuScene.KEY,

        // Chargement : les sprites copiés dans assets/ (atelier partagé).
        preload: function (scene) {
            // Personnage : les 3 frames de marche du piéton (sprites séparés)
            scene.load.image("pieton_1", "assets/perso/p8city_pieton_rouge_1.png");
            scene.load.image("pieton_2", "assets/perso/p8city_pieton_rouge_2.png");
            scene.load.image("pieton_3", "assets/perso/p8city_pieton_rouge_3.png");

            // Décor : route (pavés) + rivière + berges
            scene.load.image("route", "assets/sol/p8city_pave.png");
            scene.load.image("eau", "assets/eau/p8city_eau.png");
            scene.load.image("arbre", "assets/decor/p8city_arbre_vert.png");
            scene.load.image("buisson", "assets/decor/p8city_buisson_vert.png");

            WaggisDecor.genererTextures(scene);
        },

        // Une fois tout chargé : animation de marche + sauvegarde.
        create: async function (scene) {
            // Les 3 frames sont des images séparées : l'animation les enchaîne.
            scene.anims.create({
                key: "marcher",
                frames: [
                    { key: "pieton_1", frame: 0 },
                    { key: "pieton_2", frame: 0 },
                    { key: "pieton_3", frame: 0 }
                ],
                frameRate: 6,
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
