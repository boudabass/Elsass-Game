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

        // ⭐ FIX 08/08/2026 (style bouton Réglages, décision John 08/08 —
        // art. 704 Chantier B) : les boutons persistants Quitter (haut-
        // gauche) / Plein écran (haut-droite) reprennent EXACTEMENT le
        // style du bouton Réglages (fond, coins arrondis, ombre portée,
        // feedback au clic, dégradé — spec 709 révision 08/08). L'icône +
        // le libellé sont À L'INTÉRIEUR du bouton (pattern
        // _creerBoutonSecondaire). Les textes vivent dans config.js
        // (textes.retour / textes.pleinEcran), la couleur de fond vient
        // de la config — c'est ici que tout est transmis au socle (ombre
        // + police = défauts du socle, même rendu que le bouton Réglages).
        iconesPlateforme: {
            retour: C.textes.retour,
            pleinEcran: C.textes.pleinEcran,
            style: {
                couleur: C.couleurs.bouton
            }
        },

        // Chargement : une seule image à télécharger, le reste est dessiné.
        preload: function (scene) {
            scene.load.spritesheet("cigogne", "assets/cigogne_vol.png", {
                frameWidth: 256,
                frameHeight: 256
            });

            // ⭐ FIX 08/08/2026 (assets icônes plateforme, décision John
            // 08/08 — art. 704 Chantier B) : vraies images des boutons
            // persistants Quitter (haut-gauche) et Plein écran (haut-droite)
            // — assets atelier copiés dans assets/ui/ (flèche BRUN, tons
            // terre/bois du jeu ; écran du désert). Chargées ici pour être
            // disponibles dans TOUTES les scènes (iconesPlateforme les
            // affiche dans chaque create()).
            scene.load.image("icone_retour", "assets/ui/rogrpg_fleche_brun_gauche.png");
            scene.load.image("icone_plein_ecran", "assets/ui/desert_ecran.png");

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
