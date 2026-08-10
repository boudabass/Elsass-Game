/*
 * similitudeUI.js — helpers de refonte visuelle des écrans Similitude
 * (spec 728 §7 — menu façon Waggis, SIM-7).
 *
 * Regroupe ce qui est partagé par les écrans refondus SANS toucher à
 * core/ (règle studio : une brique n'entre dans core/ que si deux jeux
 * l'utilisent — Waggis a déjà waggisUI.js, volontairement séparé ; les
 * boutons, eux, utilisent LE composant partagé Arcade.UI.bouton) :
 *  - SimilitudeUI.ciel(g, w, h) : dégradé de fond (même rendu que
 *    WaggisUI.ciel — cielHaut en haut → cielBas en bas, couleurs
 *    Similitude) ;
 *  - SimilitudeUI.aller(scene, sceneKey, data) : transition animée fade
 *    entre écrans (au lieu du switch instantané) ;
 *  - SimilitudeUI.chargerPolice(scene) : injection du @font-face Azimut
 *    (police de marque, auto-hébergée) + attente courte.
 *
 * RÈGLE COULEURS (QA 08/08, NC1 — Waggis) : le renderer WebGL ne convertit
 * PAS les chaînes CSS pour les Graphics — tout fillStyle / lineStyle reçoit
 * une valeur NUMÉRIQUE (0xRRGGBB) ou un Phaser.Color converti. Les alphas
 * passent par le 2ᵉ argument de fillStyle. Voir config.js couleurs.
 */
(function () {
    "use strict";

    window.SimilitudeUI = {
        /**
         * Dégradé de fond (spec 728 §7 — dégradé de fond) : bandes
         * horizontales interpolées entre cielHaut (haut) et cielBas (bas).
         * Redessiné à chaque layout (rotation, plein écran).
         */
        ciel: function (g, w, h) {
            var C = window.SimilitudeConfig;
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
         * Transition animée entre écrans (spec 728 §7 — transitions en
         * fondu) : fondu au noir puis démarrage de la scène cible.
         * Garde-fou anti double-clic pendant le fondu (pattern Waggis).
         */
        aller: function (scene, sceneKey, data) {
            if (scene.enTransition) return;
            scene.enTransition = true;
            scene.cameras.main.fadeOut(180, 0, 0, 0);
            scene.cameras.main.once("camerafadeoutcomplete", function () {
                scene.scene.start(sceneKey, data || {});
            });
        },

        /**
         * Injecte le @font-face d'Azimut (une seule fois par page) et
         * attend son chargement, avec une limite de temps : hors ligne ou
         * police indisponible, l'écran se dessine quand même avec la pile
         * de repli (pattern MenuScene Waggis).
         */
        chargerPolice: function (scene) {
            var C = window.SimilitudeConfig;
            try {
                if (!document.fonts || window.__similitudePoliceInjected) return;
                window.__similitudePoliceInjected = true;
                var style = document.createElement("style");
                style.textContent =
                    "@font-face{font-family:'Azimut';src:url('" + C.police.url +
                    "') format('woff2');font-weight:400;font-style:normal;" +
                    "font-display:swap;}";
                document.head.appendChild(style);
                return Promise.race([
                    document.fonts.load('16px "Azimut"'),
                    new Promise(function (res) { setTimeout(res, 1200); })
                ]);
            } catch (e) {
                // Repli silencieux sur la police système.
            }
        }
    };
})();
