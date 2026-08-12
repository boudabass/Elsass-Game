/*
 * main.js — point de départ d'Elsass Farm (proposition Bloc A, point 1).
 *
 * Même pattern que Cigogne : Arcade.boot({ key, backgroundColor, scenes,
 * firstScene, iconesPlateforme, preload, create }) ; la sauvegarde est
 * branchée sur core/save.js TEL QUEL (aucune modification de core/) :
 *   Arcade.Save.configure({ key, version: 1, migrations: {}, gather, apply })
 *   + load() (local + cloud, la plus récente gagne) + startAutosave()
 *   (local 30 s / cloud 5 min, flush à la fermeture).
 *
 * L'état du jeu vit dans window.FarmEtat (objet HORS scène) : le restart
 * de GameScene au passage de portail ne perd rien (point 2).
 * Format stocké : { v: 1, t, data: { horloge: { t }, sols, position } }.
 */
(function () {
    "use strict";

    const C = window.FarmConfig;

    Arcade.boot({
        key: C.key,
        backgroundColor: C.couleurs.fond,
        scenes: [MenuScene, GameScene],
        firstScene: MenuScene.KEY,

        // Contrat de plateforme (art. 704) : Retour / Plein écran sur le
        // menu principal. Textes et style depuis la config.
        iconesPlateforme: {
            retour: C.textes.retour,
            pleinEcran: C.textes.pleinEcran,
            style: {
                couleur: C.couleurs.bouton,
                ombre: C.couleurs.ombreBouton,
                police: C.police.famille
            }
        },

        // Chargement : zones.json (lu par zones.js). Les cartes Tiled de la
        // zone courante sont chargées par GameScene.preload (le restart
        // recharge la map de la nouvelle zone).
        preload: function (scene) {
            FarmZones.charger(scene);
        },

        create: async function (scene) {
            // État du jeu, hors scène (point 2 : le restart ne perd rien).
            const etat = {
                horloge: { t: 0 },        // compteur unique (ms de jeu)
                sols: {},                 // { zone: { "x,y": {etat, ...} } }
                position: { zone: null, x: 0, y: 0 }
            };
            window.FarmEtat = etat;

            // Contrat core/save.js TEL QUEL : v:1, migrations:{}, gather,
            // apply (assainit les données chargées).
            Arcade.Save.configure({
                key: C.key,
                version: 1,
                migrations: {},
                gather: () => ({
                    horloge: etat.horloge,
                    sols: etat.sols,
                    position: etat.position
                }),
                apply: (data) => {
                    etat.horloge.t =
                        (data.horloge && typeof data.horloge.t === "number")
                            ? data.horloge.t : 0;
                    etat.sols =
                        (data.sols && typeof data.sols === "object") ? data.sols : {};
                    etat.position =
                        (data.position && typeof data.position === "object" &&
                            typeof data.position.zone === "string")
                            ? data.position : { zone: null, x: 0, y: 0 };
                }
            });

            await Arcade.Save.load();
        }
    });
})();
