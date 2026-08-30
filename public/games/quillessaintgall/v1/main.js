/*
 * main.js — point de départ du spike « collision boule/quilles » de Quilles
 * Saint-Gall (PRD article 875).
 *
 * Comme les autres jeux : on décrit ce qu'il faut charger, puis le socle
 * (core/boot.js) démarre le jeu. Aucune sauvegarde ici : le spike n'a ni
 * niveau ni progression.
 */
(function () {
    "use strict";

    const C = window.QuillesSaintGallConfig;

    Arcade.boot({
        key: C.key,
        backgroundColor: C.couleurs.ciel,
        scenes: [TestScene],
        firstScene: TestScene.KEY,

        // Chargement : aucune image téléchargée, les textures (quille,
        // boule) sont DESSINÉES puis mises en mémoire par Phaser.
        preload: function (scene) {
            TestScene.genererTextures(scene);
        }
    });
})();
