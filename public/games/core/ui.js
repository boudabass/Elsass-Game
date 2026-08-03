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
                    color: color || "#0f172a",
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
            var couleur = Phaser.Display.Color.HexStringToColor(o.color || "#4f46e5").color;
            var bg = scene.add.graphics();
            var label = scene.add
                .text(0, 0, o.label, {
                    fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
                    color: o.textColor || "#ffffff"
                })
                .setOrigin(0.5);

            var box = scene.add.container(o.x || 0, o.y || 0, [bg, label]);

            /** Redessine le bouton à la taille voulue (rotation de l'écran). */
            box.redimensionner = function (w, h) {
                bg.clear();
                bg.fillStyle(couleur, 1);
                bg.fillRoundedRect(-w / 2, -h / 2, w, h, h * 0.25);
                label.setFontSize(Math.round(h * 0.42) + "px");
                box.setSize(w, h);
                if (box.input) box.input.hitArea.setTo(-w / 2, -h / 2, w, h);
                return box;
            };

            box.redimensionner(o.width || 200, o.height || 60);
            box.setInteractive(
                new Phaser.Geom.Rectangle(-box.width / 2, -box.height / 2, box.width, box.height),
                Phaser.Geom.Rectangle.Contains
            );
            box.input.cursor = "pointer";

            // Retour tactile : le bouton s'enfonce légèrement.
            box.on("pointerdown", function () {
                box.setScale(0.94);
            });
            box.on("pointerout", function () {
                box.setScale(1);
            });
            box.on("pointerup", function () {
                box.setScale(1);
                if (typeof o.onClick === "function") o.onClick();
            });

            return box;
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
