/*
 * main.js — point de départ de Similitude.
 * Décrit ce qu'il faut charger, puis laisse le socle démarrer le jeu.
 */
(function () {
    "use strict";

    const C = window.SimilitudeConfig;

    Arcade.boot({
        key: C.key,
        backgroundColor: C.couleurs.fond,
        scenes: [MenuScene, GameScene, OverScene, SettingsScene, ClassementScene, CommentJouerScene],
        firstScene: MenuScene.KEY,

        // Règle de l'arcade : rendu net pour les sprites 16×16 agrandis
        // (spec 473 §8 — les substituts sont du pixel art).
        pixelArt: true,

        // Contrat de plateforme (chantier B, art. 704) : les boutons
        // persistants Quitter (haut-gauche) / Plein écran (haut-droite)
        // reprennent le style du bouton Réglages (spec 728 §7 : police
        // Azimut + ombre portée — mêmes réglages que Waggis). Les textes
        // vivent dans config.js, le style vient aussi de la config — le
        // socle (core/ui.js, Arcade.UI.iconesPlateforme) fait le reste.
        iconesPlateforme: {
            retour: C.textes.retour,
            pleinEcran: C.textes.pleinEcran,
            style: {
                couleur: C.couleurs.bouton,
                ombre: C.couleurs.ombreBouton,
                police: C.police.famille
            }
        },

        // Chargement : les 6 items alsaciens, chemins listés UNE SEULE FOIS
        // dans config.js (spec §7 — point clos).
        preload: function (scene) {
            C.items.forEach(function (item) {
                scene.load.image(item.cle, item.chemin);
            });
        },

        // Profil persistant (spec 728 §2, §8) : SEUL le profil (pièces +
        // inventaire) se sauvegarde — jamais le déroulé d'une partie (ni
        // grille, ni score en cours, ni chrono). core/save.js est câblé à
        // partir de cette étape : deux copies (locale + cloud), la plus
        // RÉCENTE gagne, apply() assainit (entiers ≥ 0, joker inconnu
        // ignoré). PAS d'autosave : la save n'est écrite qu'aux moments
        // explicites (fin de partie, achat, utilisation d'un joker).
        create: async function (scene) {
            // L'état du profil vit ici (objet mutable) ; les scènes le
            // lisent via window.SimilitudeProfil.profil (menu : porte-
            // monnaie ; fin de partie : gain + écriture de la save).
            const etat = { profil: Profil.creer(C) };
            window.SimilitudeProfil = etat;

            Arcade.Save.configure({
                key: C.key,
                version: 1,
                gather: () => etat.profil,
                apply: (data) => { etat.profil = Profil.assainir(data, C); }
            });

            // Charge local + cloud avant d'afficher le menu (la copie la
            // plus récente gagne, contrat spec 728 §8).
            await Arcade.Save.load();

            // SIM-7 (spec 728 §7 — Réglages) : la préférence son (on/off,
            // stockée LOCALEMENT — soundPref.js) est appliquée au
            // SoundManager global dès le boot : un son coupé le reste au
            // lancement du jeu, avant même d'ouvrir Réglages.
            SimilitudeSound.appliquer(scene);
        }
    });
})();
