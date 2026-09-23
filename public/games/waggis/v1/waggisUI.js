/*
 * waggisUI.js — helpers de refonte visuelle des écrans Waggis
 * (spec 709 — « ⚠️ RÉVISION 08/08/2026 », validée John le 08/08).
 *
 * Regroupe ce qui est propre à Waggis et n'a pas sa place dans core/.
 *
 * ⭐ 09/08/2026 : WaggisUI.bouton a été SUPPRIMÉ. C'était une deuxième
 * version du bouton de l'arcade, en parallèle du composant partagé
 * core/ui/button.js — deux rendus à maintenir, deux occasions de
 * diverger. Les 6 boutons des écrans Personnages / Classement /
 * Niveaux / Réglages / Boutique passent désormais par Arcade.UI.bouton,
 * comme le menu. Règle : AUCUN bouton n'est redessiné à la main
 * (mode d'emploi du composant : article Odoo 458).
 *
 * ⭐ 24/09/2026 : WaggisUI.fleche est devenue Arcade.UI.fleche
 * (core/ui/classement.js), partagée avec Similitude.
 *
 * Restent ici :
 *  - WaggisUI.ciel(g, w, h) : dégradé de ciel (même rendu que
 *    MenuScene._dessinerCiel — cielHaut en haut → cielBas en bas) ;
 *  - WaggisUI.cadenas(g, x, y, taille, couleur) : icône cadenas FINE
 *    dessinée (anse + corps + trou) — remplace l'emoji 🔒 et le gris uni ;
 *  - WaggisUI.aller(scene, sceneKey, data) : transition animée fade
 *    entre écrans (au lieu du switch instantané).
 *
 * RÈGLE COULEURS (QA 08/08, NC1) : le renderer WebGL ne convertit PAS
 * les chaînes CSS pour les Graphics — tout fillStyle / lineStyle /
 * strokeStyle reçoit une valeur NUMÉRIQUE (0xRRGGBB) ou un Phaser.Color
 * converti. Les alphas passent par le 2ᵉ argument de fillStyle (ex.
 * fillStyle(0x141210, 0.25)). Utilitaire : Arcade.UI.couleur (core/ui.js).
 */
(function () {
    "use strict";

    window.WaggisUI = {
        /**
         * Dégradé de ciel (spec 709 révision 08/08) : bandes horizontales
         * interpolées entre cielHaut (haut) et cielBas (bas). Redessiné à
         * chaque layout (rotation, plein écran).
         */
        ciel: function (g, w, h) {
            var C = window.WaggisConfig;
            var haut = Phaser.Display.Color.HexStringToColor(C.couleurs.cielHaut);
            var bas = Phaser.Display.Color.HexStringToColor(C.couleurs.cielBas);
            var bandes = 24;
            g.clear();
            for (var i = 0; i < bandes; i++) {
                var t = i / (bandes - 1);
                var r = Math.round(haut.red + (bas.red - haut.red) * t);
                var v = Math.round(haut.green + (bas.green - haut.green) * t);
                var b = Math.round(haut.blue + (bas.blue - haut.blue) * t);
                g.fillStyle(Phaser.Display.Color.GetColor(r, v, b), 1);
                g.fillRect(0, (h * i) / bandes, w, h / bandes + 1);
            }
        },

        /**
         * Icône cadenas FINE dessinée (spec 709 révision 08/08 : « icône
         * cadenas plus fine au lieu du gris uni ») : anse en arc arrondi +
         * corps à coins arrondis + trou de serrure. Couleurs NUMÉRIQUES.
         */
        cadenas: function (g, x, y, taille, couleur) {
            var ep = Math.max(2, Math.round(taille * 0.11));
            // Anse (demi-arc au-dessus du corps), extrémités arrondies.
            g.lineStyle(ep, couleur, 1, 1, 1);
            g.beginPath();
            g.arc(x, y - taille * 0.1, taille * 0.26, Math.PI, 0, false);
            g.strokePath();
            // Corps.
            g.fillStyle(couleur, 1);
            g.fillRoundedRect(x - taille * 0.3, y - taille * 0.12,
                taille * 0.6, taille * 0.58, taille * 0.12);
            // Trou de serrure (sombre, contraste sur le corps clair).
            g.fillStyle(0x141210, 1);
            g.fillCircle(x, y + taille * 0.14, taille * 0.08);
        },

        /**
         * Transition animée entre écrans (spec 709 révision 08/08 :
         * « transitions animées entre écrans (fade/slide) au lieu du switch
         * instantané ») : fondu au noir puis démarrage de la scène cible.
         * Garde-fou anti double-clic pendant le fondu (pattern MenuScene).
         */
        aller: function (scene, sceneKey, data) {
            if (scene.enTransition) return;
            scene.enTransition = true;
            scene.cameras.main.fadeOut(180, 0, 0, 0);
            scene.cameras.main.once("camerafadeoutcomplete", function () {
                scene.scene.start(sceneKey, data || {});
            });
        }
    };
})();
