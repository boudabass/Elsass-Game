/*
 * main.js — point de départ du spike Schieweschlawe.
 *
 * Comme les autres jeux : on décrit ce qu'il faut charger, puis le socle
 * (core/boot.js) démarre le jeu. Aucune sauvegarde ici : le spike n'a ni
 * niveau ni progression.
 */
(function () {
    "use strict";

    const C = window.SchieweschlaweConfig;

    Arcade.boot({
        key: C.key,
        backgroundColor: C.couleurs.cielHaut,
        scenes: [TestScene],
        firstScene: TestScene.KEY,

        // Chargement : aucune image téléchargée, les textures (disque de feu,
        // traînée, braise) sont DESSINÉES puis mises en mémoire par Phaser.
        preload: function (scene) {
            TestScene.genererTextures(scene);
        }
    });
})();
