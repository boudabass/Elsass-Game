/*
 * main.js — point de départ de Waggis V2.
 * Décrit ce qu'il faut charger, puis laisse le socle démarrer le jeu.
 *
 * ÉTAPE 1 : squelette. Aucun asset n'est encore chargé (le style visuel est
 * en cours de décision, cf. PRD article 705) : les scènes sont vides mais
 * fonctionnelles. Les sprites (Waggis, véhicules, flottants, train) seront
 * ajoutés avec les étapes suivantes.
 */
(function () {
    "use strict";

    const C = window.WaggisConfig;

    Arcade.boot({
        key: C.key,
        backgroundColor: C.couleurs.ciel,
        scenes: [MenuScene, GameScene, OverScene],
        firstScene: MenuScene.KEY,

        // Chargement : rien à télécharger pour le squelette.
        preload: function (scene) {
            // Les assets viendront aux étapes suivantes (LaneGenerator,
            // ObstaclePool, personnage).
        },

        // Une fois tout chargé : sauvegarde.
        create: async function (scene) {
            // Contrat de save : version 1, aucune migration pour l'instant.
            // (Le concept V1 Frogger étant abandonné, la sauvegarde repart
            // sur la même clé avec le même format { parties } — compatible.)
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
