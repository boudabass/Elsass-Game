/*
 * waggisUI.js — helpers de refonte visuelle des écrans Waggis
 * (spec 709 — « ⚠️ RÉVISION 08/08/2026 », validée John le 08/08).
 *
 * Regroupe ce qui est partagé par les écrans refondus SANS toucher à
 * core/ (règle studio : une brique n'entre dans core/ que si deux jeux
 * l'utilisent — ces helpers sont propres à Waggis) :
 *  - WaggisUI.ciel(g, w, h) : dégradé de ciel (même rendu que
 *    MenuScene._dessinerCiel — cielHaut en haut → cielBas en bas) ;
 *  - WaggisUI.bouton(scene, o) : bouton refondu (coins arrondis + ombre
 *    portée + dégradé léger + feedback clic scale-down / micro-rebond,
 *    pattern MenuScene) ;
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
         * Bouton rectangulaire refondu — pattern MenuScene (spec 709
         * révision 08/08) : coins arrondis + ombre portée + voile clair sur
         * la moitié haute (dégradé léger) + feedback au clic (scale-down à
         * l'appui, micro-rebond Back.Out au relâchement).
         * @param {object} o {label, couleur, onClick}
         */
        bouton: function (scene, o) {
            var C = window.WaggisConfig;
            var ombre = scene.add.graphics().setDepth(49);
            var corps = scene.add.graphics().setDepth(50);
            var label = scene.add.text(0, 0, o.label, {
                fontFamily: C.police.famille,
                color: "#ffffff",
                align: "center"
            }).setOrigin(0.5).setDepth(51);
            var zone = scene.add.rectangle(0, 0, 10, 10, 0x000000, 0)
                .setInteractive({ useHandCursor: true })
                .setDepth(52);

            zone.on("pointerdown", function () {
                [ombre, corps, label, zone].forEach(function (c) {
                    scene.tweens.add({ targets: c, scale: 0.95, duration: 70, ease: "Linear" });
                });
            });
            var relacher = function () {
                [ombre, corps, label, zone].forEach(function (c) {
                    scene.tweens.add({ targets: c, scale: 1, duration: 170, ease: "Back.Out" });
                });
            };
            zone.on("pointerout", relacher);
            zone.on("pointerup", function () {
                relacher();
                if (typeof o.onClick === "function") o.onClick();
            });

            var x = 0, y = 0, largeur = 10, hauteur = 10;
            var couleur = hex(o.couleur || C.couleurs.bouton);
            var dessiner = function () {
                var r = hauteur * 0.3;
                ombre.clear();
                ombre.fillStyle(C.couleurs.ombrePortee, 0.25);
                ombre.fillRoundedRect(x - largeur / 2, y - hauteur / 2 + hauteur * 0.07,
                    largeur, hauteur, r);
                corps.clear();
                corps.fillStyle(couleur, 1);
                corps.fillRoundedRect(x - largeur / 2, y - hauteur / 2, largeur, hauteur, r);
                // Dégradé léger : voile clair sur la moitié haute (spec 709).
                corps.fillStyle(0xffffff, 0.16);
                corps.fillRoundedRect(x - largeur / 2, y - hauteur / 2,
                    largeur, hauteur * 0.52, r);
                label.setFontSize(Math.round(hauteur * 0.4) + "px");
                label.setPosition(x, y);
                zone.setPosition(x, y).setSize(largeur, hauteur);
                if (zone.input && zone.input.hitArea) {
                    zone.input.hitArea.setSize(largeur, hauteur);
                }
            };

            return {
                label: label,
                setPosition: function (nx, ny) { x = nx; y = ny; dessiner(); return this; },
                redimensionner: function (nw, nh) { largeur = nw; hauteur = nh; dessiner(); return this; },
                setDepth: function (d) {
                    ombre.setDepth(d); corps.setDepth(d + 1);
                    label.setDepth(d + 2); zone.setDepth(d + 3);
                    return this;
                },
                destroy: function () {
                    ombre.destroy(); corps.destroy(); label.destroy(); zone.destroy();
                }
            };
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
                    scene.tweens.add({ targets: c, scale: 0.95, duration: 70, ease: "Linear" });
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
                ombre.clear();
                ombre.fillStyle(C.couleurs.ombrePortee, 0.25);
                ombre.fillCircle(x, y + diametre * 0.06, r);
                corps.clear();
                corps.fillStyle(hex(C.couleurs.iconeFond), 1);
                corps.fillCircle(x, y, r);
                corps.lineStyle(Math.max(2, Math.round(UI.u(scene, 0.5))), rouge, 1);
                corps.strokeCircle(x, y, r - 1);
                // Chevron fin et arrondi (lineCap/lineJoin round), sombre sur
                // le fond blanc (lisible, accent rouge réservé au liseré).
                chevron.clear();
                var ep = Math.max(2, Math.round(diametre * 0.09));
                chevron.lineStyle(ep, 0x141210, 1, 1, 1);
                chevron.beginPath();
                if (sens === "gauche") {
                    chevron.moveTo(x + r * 0.32, y - r * 0.35);
                    chevron.lineTo(x - r * 0.16, y);
                    chevron.lineTo(x + r * 0.32, y + r * 0.35);
                } else {
                    chevron.moveTo(x - r * 0.32, y - r * 0.35);
                    chevron.lineTo(x + r * 0.16, y);
                    chevron.lineTo(x - r * 0.32, y + r * 0.35);
                }
                chevron.strokePath();
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
