/*
 * core/ui.js — briques d'interface communes à tous les jeux.
 *
 * Deux règles de l'arcade :
 *  - CLIC / TAP UNIQUEMENT : jamais de clavier, jamais de manette.
 *  - Le même écran doit être lisible sur un téléphone et sur un PC : les
 *    tailles sont donc exprimées en POURCENTAGE du plus petit côté (u), pas
 *    en pixels.
 */
(function () {
    "use strict";

    window.Arcade = window.Arcade || {};

    Arcade.UI = {
        /**
         * Taille relative : u(scene, 5) = 5 % du plus petit côté de l'écran.
         * Un texte à u(4) reste lisible partout.
         */
        u: function (scene, n) {
            var w = scene.scale.width;
            var h = scene.scale.height;
            return (Math.min(w, h) * n) / 100;
        },

        /** Largeur / hauteur courantes de l'écran de jeu. */
        size: function (scene) {
            return { w: scene.scale.width, h: scene.scale.height };
        },

        /**
         * Exécute une mise en page maintenant, puis à chaque redimensionnement
         * (rotation du téléphone, passage en plein écran).
         * @param {function} fn reçoit (largeur, hauteur)
         */
        layout: function (scene, fn) {
            var run = function () {
                fn(scene.scale.width, scene.scale.height);
            };
            run();
            scene.scale.on("resize", run);
            scene.events.once("shutdown", function () {
                scene.scale.off("resize", run);
            });
        },

        /**
         * Texte centré, taille en % du plus petit côté.
         * @param {number} sizePct ex. 4 pour du texte courant, 9 pour un titre
         */
        text: function (scene, x, y, content, sizePct, color) {
            return scene.add
                .text(x, y, content, {
                    fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
                    fontSize: Math.round(Arcade.UI.u(scene, sizePct)) + "px",
                    color: color || "#141210",
                    align: "center"
                })
                .setOrigin(0.5);
        },

        /**
         * Bouton tactile avec retour visuel à l'appui.
         * @param {object} o {x, y, width, height, label, color, textColor, onClick}
         * @returns {Phaser.GameObjects.Container}
         */
        button: function (scene, o) {
            var couleur = Phaser.Display.Color.HexStringToColor(o.color || "#E31B23").color;
            var bg = scene.add.graphics();
            var label = scene.add
                .text(0, 0, o.label, {
                    fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
                    color: o.textColor || "#ffffff"
                })
                .setOrigin(0.5);

            // La zone sensible est un VRAI rectangle Phaser, invisible, posé
            // par-dessus le dessin. Un conteneur, lui, place sa zone sensible
            // à côté de son contenu selon l'origine : source de décalages.
            var zone = scene.add.rectangle(0, 0, 10, 10, 0x000000, 0);
            zone.setInteractive({ useHandCursor: true });

            var btn = {
                bg: bg,
                label: label,
                zone: zone,
                x: 0,
                y: 0,
                largeur: o.width || 200,
                hauteur: o.height || 60,

                /** Déplace le bouton (son centre). */
                setPosition: function (x, y) {
                    this.x = x;
                    this.y = y;
                    this.dessiner();
                    return this;
                },

                /** Change sa taille (rotation de l'écran). */
                redimensionner: function (w, h) {
                    this.largeur = w;
                    this.hauteur = h;
                    this.dessiner();
                    return this;
                },

                dessiner: function () {
                    var w = this.largeur;
                    var h = this.hauteur;
                    bg.clear();
                    bg.fillStyle(couleur, 1);
                    bg.fillRoundedRect(this.x - w / 2, this.y - h / 2, w, h, h * 0.25);
                    label.setFontSize(Math.round(h * 0.42) + "px");
                    label.setPosition(this.x, this.y);
                    zone.setPosition(this.x, this.y).setSize(w, h);
                    if (zone.input && zone.input.hitArea) {
                        zone.input.hitArea.setSize(w, h);
                    }
                    return this;
                },

                setDepth: function (d) {
                    bg.setDepth(d);
                    label.setDepth(d + 1);
                    zone.setDepth(d + 2);
                    return this;
                },

                destroy: function () {
                    bg.destroy();
                    label.destroy();
                    zone.destroy();
                }
            };

            btn.setDepth(50);
            btn.setPosition(o.x || 0, o.y || 0);

            // Retour visuel à l'appui : le bouton se ternit légèrement.
            zone.on("pointerdown", function () {
                bg.setAlpha(0.75);
                label.setAlpha(0.75);
            });
            var relacher = function () {
                bg.setAlpha(1);
                label.setAlpha(1);
            };
            zone.on("pointerout", relacher);
            zone.on("pointerup", function () {
                relacher();
                if (typeof o.onClick === "function") o.onClick();
            });

            return btn;
        },

        /**
         * Rend toute la surface de jeu cliquable (jeux à une seule action,
         * type Cigogne). Renvoie la zone créée pour pouvoir la retirer.
         */
        tapAnywhere: function (scene, onTap) {
            var zone = scene.add
                .zone(0, 0, scene.scale.width, scene.scale.height)
                .setOrigin(0)
                .setInteractive();
            zone.on("pointerdown", onTap);

            Arcade.UI.layout(scene, function (w, h) {
                zone.setSize(w, h);
                zone.input.hitArea.setSize(w, h);
            });

            return zone;
        }
    };
})();
