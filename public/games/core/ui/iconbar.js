/*
 * core/ui/iconbar.js — LA barre d'icônes à état de l'arcade
 * (dossier core/ui/, décision John 09/08 — même esprit que button.js).
 *
 * Le composant bouton (core/ui/button.js) ne sait pas représenter une
 * icône QUI PORTE UN ÉTAT : une quantité qui change, un grisage à zéro,
 * une icône « armée » qui s'éclaire. C'est pourtant le même besoin dans
 * tous les jeux (barre de jokers de Similitude, barre d'objets d'un
 * futur jeu…) : d'où CE composant, à côté du bouton.
 *
 *   var barre = Arcade.UI.barreIcones(scene, {
 *       items: [{ cle: "marteau", icone: "🔨" }, …],  // ou clé de texture
 *       couleurFond: "#2c4f3c",       // fond d'une icône au repos
 *       couleurBordure: "#3d6b52",
 *       couleurActif: "#fff3c4",      // fond de l'icône ACTIVE (armée)
 *       couleurBadge: "#f5f0e6",      // couleur du nombre
 *       grisAlpha: 0.25,              // alpha d'une icône à 0
 *       police: "…", profondeur: 30,
 *       onClic: function (cle) { … }  // clic/tap uniquement
 *   });
 *
 *   barre.placer({ x, y, cote, espace });  // barre CENTRÉE en x
 *   barre.setBadge("marteau", 3);          // quantité affichée
 *   barre.setActif("marteau");             // ou null pour tout éteindre
 *   barre.destroy();
 *
 * Règles de l'arcade : clic/tap uniquement (article 409), aucune taille
 * en pixels (l'appelant passe des valeurs déjà calculées en u()), mise
 * en page recalculée par le layout de la scène.
 *
 * Le clic sur une icône NE TRAVERSE PAS vers la scène (stopPropagation) :
 * une barre posée par-dessus une grille de jeu ne doit pas déclencher
 * aussi le clic de la grille.
 */
(function () {
    "use strict";

    window.Arcade = window.Arcade || {};
    Arcade.UI = Arcade.UI || {};

    /** "#rrggbb" | 0xrrggbb → nombre (les Graphics WebGL veulent un nombre). */
    function couleurNum(c, defaut) {
        if (typeof c === "number") return c;
        if (typeof c === "string" && c) {
            return Phaser.Display.Color.HexStringToColor(c).color;
        }
        return defaut;
    }

    /**
     * Barre d'icônes cliquables à état (quantité + grisage + icône active).
     * @param {Phaser.Scene} scene
     * @param {object} o — voir l'en-tête de fichier.
     * @returns {object} API (placer, setBadge, setActif, setAlpha, destroy).
     */
    Arcade.UI.barreIcones = function (scene, o) {
        o = o || {};

        var items = o.items || [];
        var police = o.police ||
            "system-ui, -apple-system, Segoe UI, sans-serif";
        var profondeur = o.profondeur !== undefined ? o.profondeur : 30;
        var couleurFond = couleurNum(o.couleurFond, 0x2c4f3c);
        var couleurBordure = couleurNum(o.couleurBordure, 0x3d6b52);
        var couleurActif = couleurNum(o.couleurActif, 0xfff3c4);
        var grisAlpha = o.grisAlpha !== undefined ? o.grisAlpha : 0.25;
        // Proportions internes (reprises de la barre de jokers Similitude) :
        // l'icône est légèrement remontée pour laisser le nombre en bas.
        var ratioIcone = o.ratioIcone !== undefined ? o.ratioIcone : 0.64;
        var ratioBadge = o.ratioBadge !== undefined ? o.ratioBadge : 0.37;
        // Épaisseur de la bordure en PROPORTION du côté de la case (25/08).
        // Elle était figée à 1 px — seule valeur en pixels du composant :
        // invisible sur un écran dense, et sur une grande tablette un trait
        // d'un pixel autour d'une case de 90 px ne tient plus le contour.
        // 3 % du côté = 1 px sur mobile (rendu identique à avant) et 3 px
        // sur desktop.
        var ratioBordure = o.ratioBordure !== undefined ? o.ratioBordure : 0.03;

        var cases = {};     // cle → { fond, icone, badge, zone, valeur }
        var actif = null;   // clé de l'icône « armée », ou null

        items.forEach(function (it) {
            var fond = scene.add.rectangle(0, 0, 1, 1, couleurFond, 1)
                .setStrokeStyle(1, couleurBordure)
                .setDepth(profondeur);

            // Icône : texture chargée si elle existe, sinon emoji (texte).
            var icone;
            if (it.icone && typeof it.icone === "string" &&
                    scene.textures.exists(it.icone)) {
                icone = scene.add.image(0, 0, it.icone)
                    .setOrigin(0.5)
                    .setDepth(profondeur + 1);
            } else {
                icone = scene.add.text(0, 0, it.icone || "", {
                    fontFamily: police,
                    fontSize: "0px",
                    align: "center"
                })
                    .setOrigin(0.5)
                    .setDepth(profondeur + 1);
            }

            var badge = scene.add.text(0, 0, "", {
                fontFamily: police,
                fontSize: "0px",
                color: o.couleurBadge || "#ffffff",
                align: "center"
            })
                .setOrigin(0.5)
                .setDepth(profondeur + 1);

            // La zone est sur la MÊME couche haute : la barre capte les
            // clics AVANT ce qu'il y a dessous (grille de jeu…).
            var zone = scene.add.zone(0, 0, 1, 1)
                .setInteractive({ useHandCursor: true })
                .setDepth(profondeur + 2);
            zone.on("pointerdown", function (pointeur, lx, ly, event) {
                if (event && event.stopPropagation) event.stopPropagation();
                if (typeof o.onClic === "function") o.onClic(it.cle);
            });

            cases[it.cle] = {
                item: it, fond: fond, icone: icone,
                badge: badge, zone: zone, valeur: 0
            };
        });

        /** Applique grisage / éclat selon la quantité et l'icône active. */
        function rafraichir() {
            items.forEach(function (it) {
                var c = cases[it.cle];
                var estActif = actif === it.cle;
                c.fond.setFillStyle(estActif ? couleurActif : couleurFond, 1);
                var a = (c.valeur <= 0 && !estActif) ? grisAlpha : 1;
                c.fond.setAlpha(a);
                c.icone.setAlpha(a);
                c.badge.setAlpha(a);
            });
        }

        var barre = {
            /**
             * Pose la barre, CENTRÉE horizontalement sur x.
             * @param {object} p — { x, y, cote, espace, tailleIcone,
             *                       tailleBadge } (valeurs déjà en px,
             *                       calculées en u() par la scène).
             */
            placer: function (p) {
                var cote = p.cote;
                var espace = p.espace !== undefined ? p.espace : cote * 0.2;
                var pas = cote + espace;
                var x0 = p.x - (items.length - 1) * pas / 2;
                var tIcone = p.tailleIcone !== undefined
                    ? p.tailleIcone : cote * ratioIcone;
                var tBadge = p.tailleBadge !== undefined
                    ? p.tailleBadge : cote * ratioBadge;

                var epaisseur = Math.max(1, Math.round(cote * ratioBordure));

                items.forEach(function (it, i) {
                    var c = cases[it.cle];
                    var x = x0 + i * pas;
                    c.fond.setPosition(x, p.y).setSize(cote, cote);
                    c.fond.setStrokeStyle(epaisseur, couleurBordure);
                    if (c.icone.setFontSize) {
                        c.icone.setFontSize(Math.round(tIcone) + "px");
                    } else {
                        c.icone.setDisplaySize(tIcone, tIcone);
                    }
                    c.icone.setPosition(x, p.y - cote * 0.06);
                    c.badge
                        .setFontSize(Math.round(tBadge) + "px")
                        .setPosition(x, p.y + cote * 0.32);
                    c.zone.setPosition(x, p.y).setSize(cote, cote);
                    if (c.zone.input && c.zone.input.hitArea) {
                        c.zone.input.hitArea.setSize(cote, cote);
                    }
                });
                rafraichir();
                return this;
            },
            /** Quantité affichée sous une icône (grise l'icône à 0). */
            setBadge: function (cle, valeur) {
                var c = cases[cle];
                if (!c) return this;
                c.valeur = Number(valeur) || 0;
                c.badge.setText(String(valeur));
                rafraichir();
                return this;
            },
            /** Icône ACTIVE (armée) — passer null pour tout éteindre. */
            setActif: function (cle) {
                actif = cle || null;
                rafraichir();
                return this;
            },
            actif: function () { return actif; },
            setAlpha: function (a) {
                items.forEach(function (it) {
                    var c = cases[it.cle];
                    c.fond.setAlpha(a);
                    c.icone.setAlpha(a);
                    c.badge.setAlpha(a);
                });
                return this;
            },
            /** Objets Phaser d'une icône (pour animer depuis la scène). */
            objets: function (cle) { return cases[cle] || null; },
            destroy: function () {
                items.forEach(function (it) {
                    var c = cases[it.cle];
                    c.fond.destroy();
                    c.icone.destroy();
                    c.badge.destroy();
                    c.zone.destroy();
                });
                cases = {};
            }
        };

        return barre;
    };
})();
