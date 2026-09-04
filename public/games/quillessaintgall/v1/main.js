/*
 * main.js — point de départ de Quilles Saint-Gall (PRD article 875).
 *
 * Comme les autres jeux : on décrit ce qu'il faut charger, puis le socle
 * (core/boot.js) démarre le jeu. Pas de Arcade.Save : une partie (17
 * jets) ne persiste pas d'un rechargement à l'autre — seul le meilleur
 * score (Arcade.Score, autonome) est conservé.
 */
(function () {
    "use strict";

    const C = window.QuillesSaintGallConfig;

    Arcade.boot({
        key: C.key,
        backgroundColor: C.couleurs.ciel,
        scenes: [MenuScene, GameScene],
        firstScene: MenuScene.KEY,

        // Chargement : aucune image téléchargée, les textures (quille,
        // boule) sont DESSINÉES puis mises en mémoire par Phaser.
        preload: function (scene) {
            GameScene.genererTextures(scene);
        },

        // Meilleur score connu (affiché sur l'écran de fin de partie) —
        // même emplacement que Arcade.Save.load() dans les autres jeux.
        create: async function () {
            await Arcade.Score.load();
        }
    });
})();
