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
         * plateforme) : les DEUX boutons persistants qui remplacent la
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
         * ⭐ FIX 08/08/2026 (style bouton Réglages, décision John 08/08) :
         * chaque bouton est un VRAI bouton reprenant EXACTEMENT le style
         * du bouton Réglages (pattern _creerBoutonSecondaire, spec 709
         * révision 08/08) : fond arrondi (rayon 0.3 × hauteur) + ombre
         * portée décalée (+7 % hauteur) + voile clair sur la moitié
         * haute (dégradé léger) + icône (asset atelier copié dans le
         * dossier du jeu : ui/rogrpg_fleche_brun_gauche.png pour Quitter,
         * ui/desert_ecran.png pour Plein écran) EN HAUT du bouton et
         * libellé blanc EN DESSOUS, À L'INTÉRIEUR (« Retour » / « Plein
         * écran » — textes du jeu, config.js, passés par Arcade.boot →
         * options.iconesPlateforme) + feedback au clic (rétricissement
         * 10 % centré, Back.Out). Si les textures ne sont pas chargées
         * (jeu qui n'a pas encore copié les assets), repli sur le symbole
         * dessiné (Graphics) — le libellé reste affiché.
         *
         * Le style (couleur de fond, ombre, police) est surchargeable par
         * le jeu via options.iconesPlateforme.style (Waggis passe sa
         * police Azimut et son ombre — défauts du socle sinon).
         *
         * Mobile-first : tailles en % du plus petit côté (u), clic/tap
         * uniquement. À appeler dans le create() de CHAQUE scène du jeu.
         */
        iconesPlateforme: function (scene) {
            Arcade.UI._clicPlateforme = false;
            var marge = Arcade.UI.u(scene, 2);
            var profondeur = 1000;   // au-dessus de tout (UI, HUD, menu)

            // Options du jeu (config.js → main.js → Arcade.boot({
            // iconesPlateforme })) : libellés + style du bouton.
            var opts = (Arcade.bootOptions && Arcade.bootOptions.iconesPlateforme) || {};
            var style = opts.style || {};
            var texteRetour = opts.retour || "Retour";
            var textePleinEcran = opts.pleinEcran || "Plein écran";

            // STYLE DU BOUTON — reprend EXACTEMENT le bouton Réglages
            // (pattern _creerBoutonSecondaire, MenuScene — spec 709
            // révision 08/08). Défauts du socle, surchargeables par le
            // jeu (Waggis passe police.famille + couleurs.ombreBouton).
            var couleur = style.couleur || "#E31B23";      // rouge Waggis
            var ombre = style.ombre || "rgba(20, 18, 16, 0.28)";
            var police = style.police ||
                "system-ui, -apple-system, Segoe UI, sans-serif";

            // Feedback au clic : rétricissement 10 % AUTOUR DU CENTRE,
            // micro-rebond Back.Out (pattern MenuScene — aucun
            // déplacement, dessin en coordonnées centrées).
            var enfoncer = function (cibles) {
                for (var i = 0; i < cibles.length; i++) {
                    scene.tweens.add({ targets: cibles[i], scale: 0.9, duration: 70, ease: "Linear" });
                }
            };
            var relacher = function (cibles) {
                for (var i = 0; i < cibles.length; i++) {
                    scene.tweens.add({ targets: cibles[i], scale: 1, duration: 170, ease: "Back.Out" });
                }
            };

            /**
             * VRAI bouton au style Réglages : fond arrondi + ombre portée
             * + voile clair + icône en haut + libellé blanc en dessous,
             * À L'INTÉRIEUR. La zone cliquable = le bouton entier.
             * @param {string} cleTexture clé de l'image chargée par le jeu
             *                            (ou null → symbole dessiné)
             * @param {function} dessiner (g, r) — symbole de repli (r =
             *                            demi-côté de la zone icône)
             * @param {string} libelle texte affiché DANS le bouton
             * @param {function} onClick — action au relâchement
             */
            var creerBouton = function (cleTexture, dessiner, libelle, onClick) {
                var ombreG = scene.add.graphics()
                    .setDepth(profondeur)
                    .setScrollFactor(0);
                var corps = scene.add.graphics()
                    .setDepth(profondeur + 1)
                    .setScrollFactor(0);
                var icone = null;      // image asset OU Graphics de repli
                var repliG = null;
                if (cleTexture && scene.textures.exists(cleTexture)) {
                    icone = scene.add.image(0, 0, cleTexture)
                        .setDepth(profondeur + 2)
                        .setScrollFactor(0);
                } else {
                    repliG = scene.add.graphics()
                        .setDepth(profondeur + 2)
                        .setScrollFactor(0);
                    icone = repliG;
                }
                var txt = scene.add
                    .text(0, 0, libelle, {
                        fontFamily: police,
                        color: "#ffffff",
                        align: "center"
                    })
                    .setOrigin(0.5)
                    .setDepth(profondeur + 2)
                    .setScrollFactor(0)
                    // Lisible sur ciel clair comme sur fond sombre.
                    .setStroke("#141210", Math.max(2, Arcade.UI.u(scene, 0.35)));
                var zone = scene.add.rectangle(0, 0, 10, 10, 0x000000, 0)
                    .setInteractive({ useHandCursor: true })
                    .setDepth(profondeur + 3)
                    .setScrollFactor(0);
                zone.setData("iconePlateforme", true);

                // Dimensions du bouton : hauteur u(10.5) (MÊME que les
                // boutons secondaires du menu — dont Réglages), largeur
                // adaptée au libellé (au moins u(15), comme Réglages).
                var hauteur = Arcade.UI.u(scene, 10.5);
                var largeur = 0;
                var x = 0, y = 0;
                var coteIcone = hauteur * 0.45;  // même proportion que l'emoji Réglages

                var dessinerTout = function () {
                    txt.setFontSize(Math.round(hauteur * 0.23) + "px");
                    largeur = Math.max(Arcade.UI.u(scene, 15),
                        txt.width + Arcade.UI.u(scene, 4));
                    var r = hauteur * 0.3;
                    // Dessin centré sur (0,0) local + objet posé au centre
                    // du bouton : le scale de l'appui garde le centre
                    // (aucun déplacement — pattern MenuScene).
                    // Ombre portée décalée vers le bas (+7 % hauteur).
                    ombreG.clear();
                    ombreG.fillStyle(ombre, 1);
                    ombreG.fillRoundedRect(-largeur / 2, -hauteur / 2 + hauteur * 0.07,
                        largeur, hauteur, r);
                    ombreG.setPosition(x, y);
                    // Corps du bouton (couleur du jeu — rouge Waggis).
                    corps.clear();
                    corps.fillStyle(Phaser.Display.Color.HexStringToColor(couleur).color, 1);
                    corps.fillRoundedRect(-largeur / 2, -hauteur / 2, largeur, hauteur, r);
                    // Dégradé léger : voile clair sur la moitié haute (spec 709).
                    corps.fillStyle(0xffffff, 0.16);
                    corps.fillRoundedRect(-largeur / 2, -hauteur / 2,
                        largeur, hauteur * 0.52, r);
                    corps.setPosition(x, y);
                    // Icône EN HAUT du bouton (même emplacement que
                    // l'emoji du bouton Réglages).
                    if (repliG) {
                        repliG.clear();
                        dessiner(repliG, coteIcone / 2);
                        repliG.setPosition(x, y - hauteur * 0.16);
                    } else {
                        icone.setDisplaySize(coteIcone, coteIcone)
                            .setPosition(x, y - hauteur * 0.16);
                    }
                    // Libellé BLANC EN DESSOUS, À L'INTÉRIEUR du bouton.
                    txt.setPosition(x, y + hauteur * 0.28);
                    zone.setPosition(x, y).setSize(largeur, hauteur);
                    if (zone.input && zone.input.hitArea) {
                        zone.input.hitArea.setSize(largeur, hauteur);
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
                        ombreG.setAlpha(a);
                        corps.setAlpha(a);
                        if (repliG) repliG.setAlpha(a);
                        else icone.setAlpha(a);
                        txt.setAlpha(a);
                        zone.setAlpha(a);
                        return this;
                    },
                    // Dimensions courantes du bouton (pour le positionnement).
                    largeur: function () { return largeur; },
                    hauteur: function () { return hauteur; }
                };
                bouton.setPosition(0, 0);

                zone.on("pointerdown", function () {
                    enfoncer([ombreG, corps, icone, txt, zone]);
                    // Marqueur lu par les scènes qui écoutent le pointerup
                    // GLOBAL (ex. GameScene de Waggis : un clic sur une icône
                    // plateforme ne doit pas faire bondir le personnage).
                    Arcade.UI._clicPlateforme = true;
                });
                var relacherBouton = function () {
                    relacher([ombreG, corps, icone, txt, zone]);
                };
                zone.on("pointerout", relacherBouton);
                zone.on("pointerup", function () {
                    relacherBouton();
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
            // redimensionnement (Arcade.UI.layout). Le bouton est calé sur
            // les bords : son coin extérieur reste à la marge.
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
