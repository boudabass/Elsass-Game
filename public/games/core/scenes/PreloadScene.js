/*
 * core/scenes/PreloadScene.js — écran de chargement commun.
 *
 * Charge les images du jeu (fonction preload fournie par le jeu), affiche une
 * barre de progression, puis lance la première scène du jeu.
 */
(function () {
    "use strict";

    window.Arcade = window.Arcade || {};

    Arcade.PreloadScene = class PreloadScene extends Phaser.Scene {
        constructor() {
            super("core.preload");
        }

        preload() {
            var opts = Arcade.bootOptions;
            var w = this.scale.width;
            var h = this.scale.height;
            var barW = Math.min(w * 0.6, 420);
            var barH = Math.max(h * 0.012, 8);

            // Fond + libellé
            this.add.rectangle(0, 0, w, h, 0x0f172a).setOrigin(0);
            var label = this.add
                .text(w / 2, h / 2 - barH * 4, "Chargement…", {
                    fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
                    fontSize: Math.round(Math.min(w, h) * 0.04) + "px",
                    color: "#e2e8f0"
                })
                .setOrigin(0.5);

            // Rail + barre
            this.add
                .rectangle(w / 2, h / 2, barW, barH, 0x1e293b)
                .setOrigin(0.5)
                .setStrokeStyle(1, 0x334155);
            var bar = this.add
                .rectangle(w / 2 - barW / 2, h / 2, 0, barH, 0x4f46e5)
                .setOrigin(0, 0.5);

            this.load.on("progress", function (value) {
                bar.width = barW * value;
            });
            this.load.on("fileprogress", function (file) {
                label.setText("Chargement… " + file.key);
            });

            // Chargement propre au jeu
            if (typeof opts.preload === "function") opts.preload(this);
        }

        async create() {
            var opts = Arcade.bootOptions;

            // Le canvas est prêt : on retire le loader HTML de la page.
            Arcade.Platform.hideHtmlLoader();

            // Le jeu prépare ses animations et charge sa sauvegarde ici.
            // On attend la fin avant d'afficher le menu.
            if (typeof opts.create === "function") {
                try {
                    await opts.create(this);
                } catch (e) {
                    console.error("[Preload] Initialisation du jeu en échec :", e);
                }
            }

            // La première scène est désignée par sa CLÉ (la chaîne passée au
            // super() de la scène), via firstScene ou la propriété statique KEY.
            var first = opts.firstScene ||
                (opts.scenes && opts.scenes.length ? opts.scenes[0].KEY : null);

            if (!first) {
                console.error(
                    "[Preload] Impossible de savoir quelle scène lancer : " +
                    "passer firstScene à Arcade.boot(), ou déclarer 'static KEY' sur la scène."
                );
                return;
            }
            this.scene.start(first);
        }
    };
})();
