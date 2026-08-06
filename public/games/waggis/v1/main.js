/*
 * main.js — point de départ de Waggis V2.
 * Décrit ce qu'il faut charger, puis laisse le socle démarrer le jeu.
 *
 * ÉTAPE 2 : les textures du terrain (sols herbe/route, véhicules, décor)
 * sont chargées pour LaneGenerator. Le personnage arrivera à l'étape
 * suivante avec ses propres assets.
 */
(function () {
    "use strict";

    const C = window.WaggisConfig;

    Arcade.boot({
        key: C.key,
        backgroundColor: C.couleurs.ciel,
        scenes: [MenuScene, GameScene, OverScene],
        firstScene: MenuScene.KEY,

        // Chargement : sols, véhicules et décor des bandes générées.
        preload: function (scene) {
            // Sols des bandes (zone sûre herbe / route asphalte + marquage).
            scene.load.image("herbe", "assets/sol/p8city_herbe.png");
            scene.load.image("herbe_fleurs_roses", "assets/sol/p8city_herbe_fleurs_roses.png");
            scene.load.image("herbe_fleurs_vertes", "assets/sol/p8city_herbe_fleurs_vertes.png");
            scene.load.image("route_pleine", "assets/sol/p8city_route_pleine.png");
            scene.load.image("route_ligne", "assets/sol/p8city_route_ligne_v2.png");

            // Véhicules des bandes route (vue de dessus, sens de circulation).
            scene.load.image("voiture_rouge_droite", "assets/vehicule/p8city_voiture_rouge_dessus_droite.png");
            scene.load.image("voiture_rouge_gauche", "assets/vehicule/p8city_voiture_rouge_dessus_gauche.png");
            scene.load.image("voiture_verte_droite", "assets/vehicule/p8city_voiture_verte_dessus_droite.png");
            scene.load.image("voiture_verte_gauche", "assets/vehicule/p8city_voiture_verte_dessus_gauche.png");
            scene.load.image("voiture_rose_droite", "assets/vehicule/p8city_voiture_rose_dessus_droite.png");
            scene.load.image("voiture_rose_gauche", "assets/vehicule/p8city_voiture_rose_dessus_gauche.png");

            // Décor des zones sûres (prairie et rangées de vigne).
            scene.load.image("buisson_vert", "assets/decor/p8city_buisson_vert.png");
            scene.load.image("arbre_vert", "assets/decor/p8city_arbre_vert.png");
            scene.load.image("arbre_vert_v2", "assets/decor/p8city_arbre_vert_v2.png");
            scene.load.image("arbre_vert_v3", "assets/decor/p8city_arbre_vert_v3.png");
            scene.load.image("arbre_vert_v4", "assets/decor/p8city_arbre_vert_v4.png");
            scene.load.image("arbre_orange", "assets/decor/p8city_arbre_orange.png");
            scene.load.image("arbre_orange_v2", "assets/decor/p8city_arbre_orange_v2.png");
            scene.load.image("arbre_orange_v3", "assets/decor/p8city_arbre_orange_v3.png");
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
