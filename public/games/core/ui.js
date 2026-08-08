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
         * (haut-droite). ⭐ DÉCISION JOHN 08/08 : ils ne sont VISIBLES QUE
         * SUR LE MENU PRINCIPAL (plus d'affichage sur les autres scènes).
         *
         *  - Quitter : retour vers /games, même effet que le lien
         *    « Retour » de l'ancienne barre (le jeu tourne dans l'iframe
         *    du GameShell → navigation de la page parente) ;
         *  - Plein écran : requestFullscreen du document du jeu (plus
         *    géré par le wrapper Next.js), bascule agrandir/réduire selon
         *    l'état réel ; cachée si le navigateur ne supporte pas le
         *    plein écran (même règle que l'ancien canFullscreen).
         *
         * ⭐ REFONTE 08/08/2026 (décision John, art. 704 Chantier B) : les
         * deux boutons sont construits avec LE COMPOSANT bouton
         * réutilisable core/ui/button.js (Arcade.UI.bouton — dossier UI,
         * décision John 08/08 : un seul composant, plus de code dupliqué
         * avec des styles incohérents). Le style du bouton (fond arrondi
         * rayon 0.3×h + ombre portée + voile clair + icône en haut +
         * libellé en dessous + feedback clic rétricissement 10 % centré,
         * Back.Out) est celui de la spec 709 révision 08/08, partagé
         * avec le menu principal. Seuls l'ASSET (icône), le TEXTE et les
         * COULEURS changent : le jeu transmet ses textes et son style via
         * Arcade.boot → options.iconesPlateforme (config.js → main.js).
         * L'icône est l'asset atelier copié dans assets/ui/ du jeu
         * (flèche brune / écran désert), cadrée sur son contenu OPAQUE
         * (bbox mesuré une fois par texture) pour que les deux icônes
         * rendent à la MÊME taille visible. Repli dessiné si la texture
         * n'est pas chargée (le libellé reste affiché).
         *
         * Mobile-first : tailles en % du plus petit côté (u), clic/tap
         * uniquement. À appeler dans le create() du MENU PRINCIPAL
         * uniquement (décision John 08/08).
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
            // ⭐ FIX 08/08/2026 (couleurs des boutons, décision John 08/08
            // — couleur PAR BOUTON) : Retour et Plein écran sont ROUGES —
            // couleur passée EXPLICITEMENT (jamais le défaut noir du
            // composant) : style.couleur du jeu (C.couleurs.bouton, rouge)
            // ou défaut socle rouge ci-dessous.
            var couleur = style.couleur || "#E31B23";      // rouge Waggis
            var ombre = style.ombre || "rgba(20, 18, 16, 0.28)";
            var police = style.police ||
                "system-ui, -apple-system, Segoe UI, sans-serif";

            // Options communes du composant (core/ui/button.js) : hauteur
            // u(10.5) comme les boutons secondaires du menu, largeur
            // adaptée au libellé (min u(15), marge u(4)). Pas de marqueur
            // _clicPlateforme : il n'est plus posé (plus d'icônes dans
            // GameScene Waggis — décision John 08/08 : Retour / Plein
            // écran visibles QUE sur le menu principal).
            var optionsBouton = {
                couleur: couleur,
                ombre: ombre,
                police: police,
                hauteur: Arcade.UI.u(scene, 10.5),
                autoLargeur: true,
                largeurMin: Arcade.UI.u(scene, 15),
                margeLibelle: Arcade.UI.u(scene, 4),
                profondeur: profondeur,
                stroke: "#141210"
            };

            // --- Quitter (haut-gauche) : flèche retour vers /games --------
            var quitter = Arcade.UI.bouton(scene, Object.assign({}, optionsBouton, {
                icone: "icone_retour",
                repliDessin: function (g, r) {
                    g.lineStyle(r * 0.22, 0xffffff, 1);
                    g.lineBetween(-r * 0.35, 0, r * 0.4, 0);
                    g.lineBetween(-r * 0.35, 0, -r * 0.08, -r * 0.26);
                    g.lineBetween(-r * 0.35, 0, -r * 0.08, r * 0.26);
                },
                label: texteRetour,
                onClick: function () {
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
            }));

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
                pleinEcran = Arcade.UI.bouton(scene, Object.assign({}, optionsBouton, {
                    icone: "icone_plein_ecran",
                    repliDessin: function (g, r) {
                        dessinerCoins(g, r, !!document.fullscreenElement);
                    },
                    label: textePleinEcran,
                    onClick: function () {
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
                }));
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
