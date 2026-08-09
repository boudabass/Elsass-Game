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
 * Restent ici :
 *  - WaggisUI.ciel(g, w, h) : dégradé de ciel (même rendu que
 *    MenuScene._dessinerCiel — cielHaut en haut → cielBas en bas) ;
 *  - WaggisUI.fleche(scene, sens, onClick) : bouton rond de pagination
 *    avec chevron FIN et ARRONDI (Graphics, lineCap/lineJoin round) —
 *    remplace les boutons carrés ◀▶ de l'ancien menu ;
 *  - WaggisUI.cadenas(g, x, y, taille, couleur) : icône cadenas FINE
 *    dessinée (anse + corps + trou) — remplace l'emoji 🔒 et le gris uni ;
 *  - WaggisUI.aller(scene, sceneKey, data) : transition animée fade
 *    entre écrans (au lieu du switch instantané).
 *
 * RÈGLE COULEURS (QA 08/08, NC1) : le renderer WebGL ne convertit PAS
 * les chaînes CSS pour les Graphics — tout fillStyle / lineStyle /
 * strokeStyle reçoit une valeur NUMÉRIQUE (0xRRGGBB) ou un Phaser.Color
 * converti. Les alphas passent par le 2ᵉ argument de fillStyle (ex.
 * fillStyle(0x141210, 0.25)). Voir config.js couleurs.ombrePortee.
 */
(function () {
    "use strict";

    /** Convertit une chaîne hexadécimale en couleur numérique Phaser. */
    function hex(s) {
        return Phaser.Display.Color.HexStringToColor(s).color;
    }

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
         * Bouton rond de pagination (spec 709 révision 08/08 : « flèches de
         * pagination ◀▶ redessinées, fines et arrondies ») : fond blanc,
         * liseré rouge Waggis, ombre portée, chevron FIN dessiné en Graphics
         * (lineCap/lineJoin round), feedback au clic. Remplace les boutons
         * carrés ◀▶ de l'ancien menu.
         * @param {string} sens "gauche" ou "droite"
         */
        fleche: function (scene, sens, onClick) {
            var C = window.WaggisConfig;
            var UI = Arcade.UI;
            var ombre = scene.add.graphics().setDepth(49);
            var corps = scene.add.graphics().setDepth(50);
            var chevron = scene.add.graphics().setDepth(51);
            var zone = scene.add.rectangle(0, 0, 10, 10, 0x000000, 0)
                .setInteractive({ useHandCursor: true })
                .setDepth(52);

            zone.on("pointerdown", function () {
                [ombre, corps, chevron, zone].forEach(function (c) {
                    scene.tweens.add({ targets: c, scale: 0.9, duration: 70, ease: "Linear" });
                });
            });
            var relacher = function () {
                [ombre, corps, chevron, zone].forEach(function (c) {
                    scene.tweens.add({ targets: c, scale: 1, duration: 170, ease: "Back.Out" });
                });
            };
            zone.on("pointerout", relacher);
            zone.on("pointerup", function () {
                relacher();
                if (typeof onClick === "function") onClick();
            });

            var x = 0, y = 0, diametre = 10;
            var rouge = hex(C.couleurs.bouton);
            var dessiner = function () {
                var r = diametre / 2;
                // Dessin centré sur (0,0) local + objet posé au centre :
                // le scale de l'appui garde le centre (aucun déplacement).
                ombre.clear();
                ombre.fillStyle(C.couleurs.ombrePortee, 0.25);
                ombre.fillCircle(0, diametre * 0.06, r);
                ombre.setPosition(x, y);
                corps.clear();
                corps.fillStyle(hex(C.couleurs.iconeFond), 1);
                corps.fillCircle(0, 0, r);
                corps.lineStyle(Math.max(2, Math.round(UI.u(scene, 0.5))), rouge, 1);
                corps.strokeCircle(0, 0, r - 1);
                corps.setPosition(x, y);
                // Chevron fin et arrondi (lineCap/lineJoin round), sombre sur
                // le fond blanc (lisible, accent rouge réservé au liseré).
                chevron.clear();
                var ep = Math.max(2, Math.round(diametre * 0.09));
                chevron.lineStyle(ep, 0x141210, 1, 1, 1);
                chevron.beginPath();
                if (sens === "gauche") {
                    chevron.moveTo(r * 0.32, -r * 0.35);
                    chevron.lineTo(-r * 0.16, 0);
                    chevron.lineTo(r * 0.32, r * 0.35);
                } else {
                    chevron.moveTo(-r * 0.32, -r * 0.35);
                    chevron.lineTo(r * 0.16, 0);
                    chevron.lineTo(-r * 0.32, r * 0.35);
                }
                chevron.strokePath();
                chevron.setPosition(x, y);
                // Zone tactile : au moins ~9,5 % du petit côté (cible
                // confortable, même sur mobile).
                var z = Math.max(diametre, UI.u(scene, 9.5));
                zone.setPosition(x, y).setSize(z, z);
                if (zone.input && zone.input.hitArea) {
                    zone.input.hitArea.setSize(z, z);
                }
            };

            return {
                setPosition: function (nx, ny) { x = nx; y = ny; dessiner(); return this; },
                redimensionner: function (d) { diametre = d; dessiner(); return this; },
                setDepth: function (d) {
                    ombre.setDepth(d); corps.setDepth(d + 1);
                    chevron.setDepth(d + 2); zone.setDepth(d + 3);
                    return this;
                },
                destroy: function () {
                    ombre.destroy(); corps.destroy(); chevron.destroy(); zone.destroy();
                }
            };
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
