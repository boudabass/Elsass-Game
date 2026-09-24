/*
 * main.js — point de départ de Schieweschlawe (PRD article Odoo 873).
 *
 * Comme les autres jeux : on décrit ce qu'il faut charger, puis le socle
 * (core/boot.js) démarre le jeu.
 *
 * Sauvegarde (contrat { v, t, data }, core/save.js), version 1 :
 *   data.currentLevel : prochain niveau à réussir (1..101 — 101 = tout fini)
 *   data.resultats    : { "12": { lancers: 2, proximite: 87 }, … } — le
 *                       meilleur résultat de chaque niveau réussi.
 * Écrite à la réussite d'un niveau (FinScene), plus l'autosave du socle.
 */
(function () {
    "use strict";

    const C = window.SchieweschlaweConfig;

    Arcade.boot({
        key: C.key,
        backgroundColor: C.couleurs.ciel,
        scenes: [MenuScene, NiveauxScene, GameScene, FinScene],
        firstScene: MenuScene.KEY,

        // Quitter / Plein écran sur le menu principal (textes seulement,
        // le style est celui du socle).
        iconesPlateforme: {
            retour: C.textes.retour,
            pleinEcran: C.textes.pleinEcran
        },

        // Aucune image téléchargée : disque, traînée et braises sont dessinés.
        preload: function (scene) {
            GameScene.genererTextures(scene);
        },

        create: async function (scene) {
            Arcade.Save.configure({
                key: C.key,
                version: 1,
                migrations: {},
                gather: function () {
                    return {
                        currentLevel: scene.registry.get("currentLevel") || 1,
                        resultats: scene.registry.get("resultats") || {}
                    };
                },
                apply: function (data) {
                    scene.registry.set("currentLevel", (data && data.currentLevel) || 1);
                    scene.registry.set("resultats", (data && data.resultats) || {});
                }
            });

            await Arcade.Save.load();
            Arcade.Save.startAutosave();
        }
    });
})();
