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
        },

        /**
         * ⭐ Chantier B (art. 704 — suppression barre GameShell, contrat de
         * plateforme) : les DEUX icônes persistantes qui remplacent la
         * barre du haut — Quitter (haut-gauche) et Plein écran
         * (haut-droite) — visibles sur TOUTES les scènes de chaque jeu.
         *
         *  - Quitter : retour vers /games, même effet que le lien
         *    « Retour » de l'ancienne barre (le jeu tourne dans l'iframe
         *    du GameShell → navigation de la page parente) ;
         *  - Plein écran : requestFullscreen du document du jeu (plus
         *    géré par le wrapper Next.js), bascule agrandir/réduire selon
         *    l'état réel ; cachée si le navigateur ne supporte pas le
         *    plein écran (même règle que l'ancien canFullscreen).
         *
         * ⭐ FIX 08/08/2026 (assets icônes, décision John 08/08) : chaque
         * bouton affiche désormais une VRAIE IMAGE (asset atelier copié
         * dans le dossier du jeu : ui/rogrpg_fleche_brun_gauche.png pour
         * Quitter, ui/desert_ecran.png pour Plein écran) posée sur le
         * cercle, avec son LIBELLÉ EN DESSOUS (« Retour » / « Plein
         * écran » — textes du jeu, config.js, passés par Arcade.boot →
         * options.iconesPlateforme). La zone cliquable englobe le cercle
         * ET le libellé. Si les textures ne sont pas chargées (jeu qui
         * n'a pas encore copié les assets), repli sur le symbole dessiné
         * (Graphics) — le libellé reste affiché.
         *
         * Mobile-first : tailles en % du plus petit côté (u), clic/tap
         * uniquement. À appeler dans le create() de CHAQUE scène du jeu.
         */
        iconesPlateforme: function (scene) {
            Arcade.UI._clicPlateforme = false;
            var marge = Arcade.UI.u(scene, 2);
            var taille = Arcade.UI.u(scene, 8);      // diamètre du cercle
            var rayon = taille / 2;
            var profondeur = 1000;   // au-dessus de tout (UI, HUD, menu)

            // Libellés sous les icônes : textes du jeu (config.js → textes.
            // retour / pleinEcran), transmis par main.js via Arcade.boot({
            // iconesPlateforme: {...} }). Repli générique si le jeu ne les
            // fournit pas.
            var libelles = (Arcade.bootOptions && Arcade.bootOptions.iconesPlateforme) || {};
            var texteRetour = libelles.retour || "Retour";
            var textePleinEcran = libelles.pleinEcran || "Plein écran";

            // Feedback de clic : l'icône se ternit à l'appui.
            var pointerdown = function (g, img, txt, zone) {
                g.setAlpha(0.6);
                if (img) img.setAlpha(0.6);
                if (txt) txt.setAlpha(0.6);
                zone.setAlpha(0.6);
                // Marqueur lu par les scènes qui écoutent le pointerup
                // GLOBAL (ex. GameScene de Waggis : un clic sur une icône
                // plateforme ne doit pas faire bondir le personnage).
                Arcade.UI._clicPlateforme = true;
            };
            var relacher = function (g, img, txt, zone) {
                g.setAlpha(1);
                if (img) img.setAlpha(1);
                if (txt) txt.setAlpha(1);
                zone.setAlpha(1);
            };

            /**
             * Bouton plateforme : cercle sombre translucide + liseré clair,
             * IMAGE (asset) au centre si la texture est chargée (sinon
             * symbole dessiné — repli), LIBELLÉ EN DESSOUS du cercle.
             * La zone cliquable englobe cercle + libellé.
             * @param {string} cleTexture clé de l'image chargée par le jeu
             *                            (ou null → symbole dessiné)
             * @param {function} dessiner (g, r) — symbole de repli
             * @param {string} libelle texte affiché sous l'icône
             * @param {function} onClick — action au relâchement
             */
            var creerBouton = function (cleTexture, dessiner, libelle, onClick) {
                var g = scene.add.graphics()
                    .setDepth(profondeur)
                    .setScrollFactor(0);
                var img = null;
                if (cleTexture && scene.textures.exists(cleTexture)) {
                    img = scene.add.image(0, 0, cleTexture)
                        .setDepth(profondeur + 1)
                        .setScrollFactor(0);
                }
                var txt = scene.add
                    .text(0, 0, libelle, {
                        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
                        color: "#ffffff",
                        align: "center"
                    })
                    .setOrigin(0.5)
                    .setDepth(profondeur + 1)
                    .setScrollFactor(0)
                    // Lisible sur ciel clair comme sur fond sombre.
                    .setStroke("#141210", Math.max(2, Arcade.UI.u(scene, 0.35)));
                var zone = scene.add.rectangle(0, 0, 10, 10, 0x000000, 0)
                    .setInteractive({ useHandCursor: true })
                    .setDepth(profondeur + 2)
                    .setScrollFactor(0);
                zone.setData("iconePlateforme", true);

                // Dimensions du bloc : cercle en HAUT, libellé en DESSOUS.
                var tailleTexte = Arcade.UI.u(scene, 2.6);
                var espace = Arcade.UI.u(scene, 0.8);
                var hauteurTexte = 0;
                var largeurBloc = 0;
                var hauteurBloc = 0;
                var x = 0, y = 0;

                var dessinerTout = function () {
                    txt.setFontSize(Math.round(tailleTexte) + "px");
                    hauteurTexte = txt.height;
                    // Largeur du bloc : le cercle ou le libellé, le plus large.
                    largeurBloc = Math.max(taille, txt.width + Arcade.UI.u(scene, 2));
                    hauteurBloc = taille + espace + hauteurTexte;

                    // Le cercle occupe le HAUT du bloc, le libellé le bas.
                    var cy = y - hauteurBloc / 2 + rayon;
                    g.clear();
                    g.setPosition(x, cy);
                    g.fillStyle(0x141210, 0.55);
                    g.fillCircle(0, 0, rayon);
                    g.lineStyle(Math.max(2, rayon * 0.12), 0xffffff, 0.45);
                    g.strokeCircle(0, 0, rayon);
                    if (img) {
                        // Image au centre du cercle, 70 % de son diamètre
                        // (pixel art 16×16 agrandi sans flou : pixelArt
                        // activé par boot.js).
                        var cote = taille * 0.7;
                        img.setDisplaySize(cote, cote).setPosition(x, cy);
                    } else {
                        dessiner(g, rayon);
                    }
                    txt.setPosition(x, y + hauteurBloc / 2 - hauteurTexte / 2);
                    zone.setPosition(x, y).setSize(largeurBloc, hauteurBloc);
                    if (zone.input && zone.input.hitArea) {
                        zone.input.hitArea.setSize(largeurBloc, hauteurBloc);
                    }
                };

                var bouton = {
                    setPosition: function (nx, ny) {
                        x = nx; y = ny;
                        dessinerTout();
                        return this;
                    },
                    // Redessine SANS bouger (ex. état plein écran qui
                    // change : touche Échap, appui système).
                    refresh: function () {
                        dessinerTout();
                        return this;
                    },
                    setAlpha: function (a) {
                        g.setAlpha(a);
                        if (img) img.setAlpha(a);
                        txt.setAlpha(a);
                        zone.setAlpha(a);
                        return this;
                    },
                    // Dimensions courantes du bloc (pour le positionnement).
                    largeur: function () { return largeurBloc; },
                    hauteur: function () { return hauteurBloc; }
                };
                bouton.setPosition(0, 0);

                zone.on("pointerdown", function () { pointerdown(g, img, txt, zone); });
                zone.on("pointerout", function () { relacher(g, img, txt, zone); });
                zone.on("pointerup", function () {
                    relacher(g, img, txt, zone);
                    if (typeof onClick === "function") onClick();
                });

                return bouton;
            };

            // --- Quitter (haut-gauche) : flèche retour vers /games --------
            var quitter = creerBouton(
                "icone_retour",
                function (g, r) {
                    g.lineStyle(r * 0.22, 0xffffff, 1);
                    g.lineBetween(-r * 0.35, 0, r * 0.4, 0);
                    g.lineBetween(-r * 0.35, 0, -r * 0.08, -r * 0.26);
                    g.lineBetween(-r * 0.35, 0, -r * 0.08, r * 0.26);
                },
                texteRetour,
                function () {
                    // Même effet que le lien « Retour » : on ramène la PAGE
                    // PARENTE (l'arcade) vers /games — le jeu tourne dans
                    // l'iframe du GameShell. Repli sur la fenêtre courante si
                    // la page parente est inaccessible (cross-origin).
                    try {
                        if (window.top && window.top.location) {
                            window.top.location.href = "/games";
                        } else {
                            window.location.href = "/games";
                        }
                    } catch (e) {
                        window.location.href = "/games";
                    }
                }
            );

            // --- Plein écran (haut-droite) : requestFullscreen du jeu ----
            var pleinEcran = null;
            var fullscreenOk = typeof document !== "undefined" &&
                typeof document.documentElement !== "undefined" &&
                !!document.documentElement.requestFullscreen;
            if (fullscreenOk) {
                // Repli dessiné : deux variantes — « agrandir » (angle du L
                // au coin extérieur) et « réduire » (angle du L vers le
                // centre).
                var dessinerCoins = function (g, r, reduire) {
                    var rc = r * 0.58;   // demi-côté du carré imaginaire
                    var L = r * 0.34;    // longueur d'un segment de coin
                    g.lineStyle(r * 0.2, 0xffffff, 1);
                    if (!reduire) {
                        g.lineBetween(-rc, -rc, -rc + L, -rc);
                        g.lineBetween(-rc, -rc, -rc, -rc + L);
                        g.lineBetween(rc, -rc, rc - L, -rc);
                        g.lineBetween(rc, -rc, rc, -rc + L);
                        g.lineBetween(-rc, rc, -rc + L, rc);
                        g.lineBetween(-rc, rc, -rc, rc - L);
                        g.lineBetween(rc, rc, rc - L, rc);
                        g.lineBetween(rc, rc, rc, rc - L);
                    } else {
                        g.lineBetween(-rc + L, -rc, -rc + L, -rc + L);
                        g.lineBetween(-rc, -rc + L, -rc + L, -rc + L);
                        g.lineBetween(rc - L, -rc, rc - L, -rc + L);
                        g.lineBetween(rc, -rc + L, rc - L, -rc + L);
                        g.lineBetween(-rc + L, rc, -rc + L, rc - L);
                        g.lineBetween(-rc, rc - L, -rc + L, rc - L);
                        g.lineBetween(rc - L, rc, rc - L, rc - L);
                        g.lineBetween(rc, rc - L, rc - L, rc - L);
                    }
                };
                pleinEcran = creerBouton(
                    "icone_plein_ecran",
                    function (g, r) { dessinerCoins(g, r, !!document.fullscreenElement); },
                    textePleinEcran,
                    function () {
                        try {
                            if (document.fullscreenElement) {
                                document.exitFullscreen();
                            } else {
                                document.documentElement.requestFullscreen();
                            }
                        } catch (e) {
                            console.error("[UI] Plein écran refusé :", e);
                        }
                    }
                );
                // L'icône suit l'état réel du plein écran (touche Échap
                // comprise) : redessin à chaque changement d'état.
                var onFullscreenChange = function () {
                    if (pleinEcran) pleinEcran.refresh();
                };
                document.addEventListener("fullscreenchange", onFullscreenChange);
                scene.events.once("shutdown", function () {
                    document.removeEventListener("fullscreenchange", onFullscreenChange);
                });
            }

            // Positionnement aux coins, recalculé à chaque rotation /
            // redimensionnement (Arcade.UI.layout). Le bloc (cercle +
            // libellé) est calé sur les bords : son coin extérieur reste à
            // la marge.
            Arcade.UI.layout(scene, function (w) {
                quitter.setPosition(marge + quitter.largeur() / 2,
                    marge + quitter.hauteur() / 2);
                if (pleinEcran) {
                    pleinEcran.setPosition(w - marge - pleinEcran.largeur() / 2,
                        marge + pleinEcran.hauteur() / 2);
                }
            });
        }
    };
})();
