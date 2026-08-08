/*
 * core/ui/button.js — LE composant bouton réutilisable de l'arcade
 * (dossier core/ui/, décision John 08/08 — art. 704 Chantier B + 709).
 *
 * UN SEUL composant, configurable — seuls l'ASSET (icône), le TEXTE et
 * les COULEURS changent selon le bouton ; la STRUCTURE et le STYLE sont
 * partagés (fond, coins arrondis, ombre portée, feedback au clic,
 * icône + texte, tailles u() mobile-first, clic/tap uniquement) :
 *
 *   Arcade.UI.bouton(scene, {
 *       // --- Icône (OPTIONNEL : sans icône → bouton TEXTE SIMPLE) ----
 *       icone: "cle_texture",   // asset image (cadré sur son contenu
 *                               // opaque → même taille rendue)
 *       //   ou emoji : "⚙️"   // texte emoji
 *       //   ou rien            // bouton texte simple (Jouer…)
 *       repliDessin: fn(g, r),  // symbole dessiné si texture absente
 *       // --- Texte + couleurs (ce qui change selon le bouton) --------
 *       label: "Réglages",
 *       couleur: "#141210",     // fond du bouton — NOIR par défaut
 *       ombre: "rgba(20,18,16,0.28)",
 *       police: "system-ui, …",
 *       textColor: "#ffffff",
 *       // --- Dimensions (u() mobile-first, recalculées au resize) ----
 *       // Deux modes équivalents (jamais de taille figée en pixels) :
 *       //  - u() : largeurU / hauteurU / largeurMinU / margeLibelleU —
 *       //    pourcentages du plus petit côté. Le composant les recalcule
 *       //    LUI-MÊME à chaque rotation / redimensionnement
 *       //    (Arcade.UI.layout) : c'est la règle unifiée du composant
 *       //    (FIX 08/08/2026 — Retour / Plein écran s'adaptent comme
 *       //    Réglages) ;
 *       //  - px (redimensionner() appelé par le layout de la scène,
 *       //    ex. menus Waggis / Cigogne) : valeurs déjà recalculées par
 *       //    l'appelant à chaque layout.
 *       hauteurU: 10.5,          // ex. hauteur = u(10.5)
 *       autoLargeur: true,       // largeur = max(largeurMin,
 *                                //   txt.width + margeLibelle)
 *       largeurMinU: 15, margeLibelleU: 4,
 *       profondeur: 50,
 *       onClick: fn
 *   })
 *
 * Rendu (style spec 709 révision 08/08, identique partout) :
 *   - fond arrondi (rayon 0.3 × hauteur) + ombre portée décalée
 *     (+7 % hauteur) + voile clair 0.16 sur la moitié haute ;
 *   - avec icône : icône EN HAUT (taille 0.45 × hauteur), libellé blanc
 *     EN DESSOUS À L'INTÉRIEUR (taille 0.23 × hauteur) ;
 *   - sans icône (texte simple) : libellé CENTRÉ (taille 0.4 × hauteur) ;
 *   - feedback au clic : rétricissement 10 % centré (Back.Out), scale
 *     RELATIVE à la base de chaque objet (_baseScale) ;
 *   - zone cliquable = bouton entier ; tailles en % du plus petit côté.
 *
 * Règles de l'arcade : clic/tap uniquement, tailles en u(), rien en
 * pixels.
 */
(function () {
    "use strict";

    window.Arcade = window.Arcade || {};
    Arcade.UI = Arcade.UI || {};

    /**
     * Cadre une texture sur son contenu OPAQUE (bbox des pixels non
     * transparents). Les assets d'icônes font tous 16×16 mais leur
     * contenu visible diffère (l'écran ~14×15 px, la flèche ~8×10 px) :
     * affichés au même cadre, la flèche rendrait minuscule. Mesuré UNE
     * FOIS par texture (cache), résultat en fractions de l'image source.
     * @returns {object|null} {fx, fy, fw, fh, sw, sh} | null si non mesurable
     */
    var bboxOpaque = (function () {
        var cache = {};
        return function (scene, cleTexture) {
            if (Object.prototype.hasOwnProperty.call(cache, cleTexture)) {
                return cache[cleTexture];
            }
            var resultat = null;
            try {
                if (scene.textures.exists(cleTexture)) {
                    var src = scene.textures.get(cleTexture).getSourceImage();
                    if (src && src.width && src.height) {
                        var cv = document.createElement("canvas");
                        cv.width = src.width;
                        cv.height = src.height;
                        var ctx = cv.getContext("2d");
                        ctx.drawImage(src, 0, 0);
                        var d = ctx.getImageData(0, 0, cv.width, cv.height).data;
                        var minX = cv.width, minY = cv.height, maxX = -1, maxY = -1;
                        for (var y = 0; y < cv.height; y++) {
                            for (var x = 0; x < cv.width; x++) {
                                if (d[(y * cv.width + x) * 4 + 3] > 10) {
                                    if (x < minX) minX = x;
                                    if (x > maxX) maxX = x;
                                    if (y < minY) minY = y;
                                    if (y > maxY) maxY = y;
                                }
                            }
                        }
                        if (maxX >= 0) {
                            resultat = {
                                fx: minX / cv.width,
                                fy: minY / cv.height,
                                fw: (maxX - minX + 1) / cv.width,
                                fh: (maxY - minY + 1) / cv.height,
                                sw: cv.width,
                                sh: cv.height
                            };
                        }
                    }
                }
            } catch (e) {
                resultat = null;
            }
            cache[cleTexture] = resultat;
            return resultat;
        };
    })();

    /**
     * Composant bouton réutilisable (style spec 709 révision 08/08).
     * @param {Phaser.Scene} scene
     * @param {object} o — voir l'en-tête de fichier pour les options.
     * @returns {object} API du bouton (setPosition, redimensionner,
     *                   setDepth, setAlpha, destroy, largeur, hauteur,
     *                   refresh).
     */
    Arcade.UI.bouton = function (scene, o) {
        o = o || {};

        var couleur = o.couleur || "#141210";
        // NOIR par défaut (boutons secondaires — Niveaux, Personnages,
        // Boutique, Classement ; décision John 08/08 : couleur PAR BOUTON).
        // ROUGE (Retour / Plein écran / Réglages) et VERT (Jouer /
        // Commencer) sont passés explicitement par chaque appel.
        var ombre = o.ombre || "rgba(20, 18, 16, 0.28)";
        var police = o.police ||
            "system-ui, -apple-system, Segoe UI, sans-serif";
        var profondeur = o.profondeur !== undefined ? o.profondeur : 50;

        // --- Objets Phaser ------------------------------------------------
        var ombreG = scene.add.graphics()
            .setDepth(profondeur)
            .setScrollFactor(0);
        var corps = scene.add.graphics()
            .setDepth(profondeur + 1)
            .setScrollFactor(0);

        // Icône : image (texture) OU repli dessiné (si la texture n'est
        // pas chargée) OU emoji (texte). Ordre de décision : une chaîne
        // qui est une texture existante → image ; sinon un repliDessin
        // fourni → symbole dessiné (ex. icônes plateforme dont l'asset
        // manque) ; sinon une chaîne → emoji (ex. "⚙️", "🗺️").
        var icone = null;       // objet affiché (image / texte / graphics)
        var repliG = null;      // graphics de repli (si texture absente)
        var estEmoji = false;
        var cleTexture = null;
        if (o.icone && typeof o.icone === "string" &&
                scene.textures.exists(o.icone)) {
            cleTexture = o.icone;
            icone = scene.add.image(0, 0, cleTexture)
                .setDepth(profondeur + 2)
                .setScrollFactor(0);
        } else if (typeof o.repliDessin === "function") {
            repliG = scene.add.graphics()
                .setDepth(profondeur + 2)
                .setScrollFactor(0);
            icone = repliG;
        } else if (o.icone && typeof o.icone === "string") {
            // Chaîne non-texture → emoji (ex. "⚙️", "🗺️").
            estEmoji = true;
            icone = scene.add.text(0, 0, o.icone, {
                fontFamily: police,
                align: "center"
            })
                .setOrigin(0.5)
                .setDepth(profondeur + 2)
                .setScrollFactor(0);
        }

        var txt = scene.add
            .text(0, 0, o.label || "", {
                fontFamily: police,
                color: o.textColor || "#ffffff",
                align: "center"
            })
            .setOrigin(0.5)
            .setDepth(profondeur + 2)
            .setScrollFactor(0);
        // Lisible sur ciel clair comme sur fond sombre (optionnel).
        if (o.stroke) {
            txt.setStroke(o.stroke, Math.max(2, Arcade.UI.u(scene, 0.35)));
        }

        var zone = scene.add.rectangle(0, 0, 10, 10, 0x000000, 0)
            .setInteractive({ useHandCursor: true })
            .setDepth(profondeur + 3)
            .setScrollFactor(0);

        // --- Feedback au clic (rétricissement 10 % centré, Back.Out) ----
        // Scale RELATIVE à la base de chaque objet (l'icône image a une
        // base ≠ 1, cadrée sur son contenu opaque) — jamais écrasée.
        var enfoncer = function (cibles) {
            for (var i = 0; i < cibles.length; i++) {
                var base = (cibles[i].getData &&
                    cibles[i].getData("_baseScale")) || 1;
                scene.tweens.add({ targets: cibles[i], scale: base * 0.9, duration: 70, ease: "Linear" });
            }
        };
        var relacher = function (cibles) {
            for (var i = 0; i < cibles.length; i++) {
                var base = (cibles[i].getData &&
                    cibles[i].getData("_baseScale")) || 1;
                scene.tweens.add({ targets: cibles[i], scale: base, duration: 170, ease: "Back.Out" });
            }
        };

        // --- Géométrie courante -------------------------------------------
        // Deux modes de dimensionnement (FIX 08/08/2026 — signalement
        // John : Retour / Plein écran ne s'adaptaient pas comme Réglages
        // car leurs tailles étaient figées en px à la création) :
        //  - mode u() : largeurU / hauteurU / largeurMinU / margeLibelleU
        //    (pourcentages du plus petit côté). Le composant recalcule
        //    lui-même les px à chaque layout / rotation (Arcade.UI.layout)
        //    — MÊMES RÈGLES pour les 2 variantes (icône+texte, texte
        //    simple) : plus aucune taille figée en pixels ;
        //  - mode px : largeur / hauteur / largeurMin / margeLibelle
        //    (ou redimensionner() appelé par le layout de la scène, ex.
        //    menus Waggis / Cigogne — l'appelant recalcule à chaque
        //    rotation). Conservé pour compatibilité.
        var largeurU = (typeof o.largeurU === "number") ? o.largeurU : null;
        var hauteurU = (typeof o.hauteurU === "number") ? o.hauteurU : null;
        var largeurMinU = (typeof o.largeurMinU === "number") ? o.largeurMinU : null;
        var margeLibelleU = (typeof o.margeLibelleU === "number") ? o.margeLibelleU : null;
        var largeur = o.largeur || 10;   // placeholder : écrasé au 1er
        var hauteur = o.hauteur || 10;   // dessin (u() ou redimensionner)
        var x = o.x || 0;
        var y = o.y || 0;
        var autoLargeur = !!o.autoLargeur;
        var largeurMin = o.largeurMin || 0;
        var margeLibelle = o.margeLibelle || 0;

        // Applique le mode u() : convertit les pourcentages en px courants
        // (plus petit côté de l'écran au moment de l'appel).
        var appliquerU = function () {
            if (hauteurU !== null) {
                hauteur = Arcade.UI.u(scene, hauteurU);
            }
            if (largeurU !== null) {
                largeur = Arcade.UI.u(scene, largeurU);
            }
            if (largeurMinU !== null) {
                largeurMin = Arcade.UI.u(scene, largeurMinU);
            }
            if (margeLibelleU !== null) {
                margeLibelle = Arcade.UI.u(scene, margeLibelleU);
            }
        };

        var dessiner = function () {
            // Mode u() : recalcule les px à partir du plus petit côté
            // COURANT de l'écran — le redessin suit la rotation / le
            // redimensionnement (Arcade.UI.layout), comme les autres
            // boutons du menu (FIX 08/08/2026).
            appliquerU();

            // Largeur adaptée au libellé (boutons plateforme) : recalculée
            // AVANT le dessin du fond, comme l'ancien code.
            if (autoLargeur) {
                if (icone) {
                    txt.setFontSize(Math.round(hauteur * 0.23) + "px");
                } else {
                    txt.setFontSize(Math.round(hauteur * 0.4) + "px");
                }
                largeur = Math.max(largeurMin, txt.width + margeLibelle);
            }

            var r = hauteur * 0.3;
            // Dessin centré sur (0,0) local + objet posé au centre : le
            // scale de l'appui garde le centre (aucun déplacement).
            // Ombre portée décalée vers le bas (+7 % hauteur).
            ombreG.clear();
            ombreG.fillStyle(ombre, 1);
            ombreG.fillRoundedRect(-largeur / 2, -hauteur / 2 + hauteur * 0.07,
                largeur, hauteur, r);
            ombreG.setPosition(x, y);
            // Corps du bouton (couleur du jeu).
            corps.clear();
            corps.fillStyle(Phaser.Display.Color.HexStringToColor(couleur).color, 1);
            corps.fillRoundedRect(-largeur / 2, -hauteur / 2, largeur, hauteur, r);
            // Dégradé léger : voile clair sur la moitié haute (spec 709).
            corps.fillStyle(0xffffff, 0.16);
            corps.fillRoundedRect(-largeur / 2, -hauteur / 2,
                largeur, hauteur * 0.52, r);
            corps.setPosition(x, y);

            var coteIcone = hauteur * 0.45;  // même proportion partout
            if (cleTexture) {
                // Image cadrée sur son contenu OPAQUE (bbox mesuré une
                // fois par texture) : MÊME TAILLE RENDUE pour toutes les
                // icônes, proportions conservées (aucune distorsion).
                var bbox = bboxOpaque(scene, cleTexture);
                if (bbox) {
                    var echelle = coteIcone / (bbox.fh * bbox.sh);
                    icone.setOrigin(bbox.fx + bbox.fw / 2,
                            bbox.fy + bbox.fh / 2)
                        .setScale(echelle)
                        .setPosition(x, y - hauteur * 0.16);
                    icone.setData("_baseScale", echelle);
                } else {
                    icone.setOrigin(0.5, 0.5)
                        .setDisplaySize(coteIcone, coteIcone)
                        .setPosition(x, y - hauteur * 0.16);
                    icone.setData("_baseScale", icone.scaleX);
                }
            } else if (estEmoji) {
                icone.setFontSize(Math.round(coteIcone) + "px")
                    .setPosition(x, y - hauteur * 0.16);
            } else if (repliG) {
                repliG.clear();
                o.repliDessin(repliG, coteIcone / 2);
                repliG.setPosition(x, y - hauteur * 0.16);
            }

            if (icone) {
                // Libellé BLANC EN DESSOUS, À L'INTÉRIEUR du bouton.
                txt.setFontSize(Math.round(hauteur * 0.23) + "px");
                txt.setPosition(x, y + hauteur * 0.28);
            } else {
                // Bouton TEXTE SIMPLE : libellé centré.
                txt.setFontSize(Math.round(hauteur * 0.4) + "px");
                txt.setPosition(x, y);
            }

            zone.setPosition(x, y).setSize(largeur, hauteur);
            if (zone.input && zone.input.hitArea) {
                zone.input.hitArea.setSize(largeur, hauteur);
            }
        };

        // --- API du bouton -------------------------------------------------
        var bouton = {
            setPosition: function (nx, ny) {
                x = nx; y = ny;
                dessiner();
                return this;
            },
            redimensionner: function (nw, nh) {
                // Reprend la main en px : le mode u() est désactivé (les
                // valeurs u() ne re-écrasent plus le redimensionnement
                // manuel, ex. layout de scène qui calcule en u() lui-même).
                largeurU = null;
                hauteurU = null;
                largeurMinU = null;
                margeLibelleU = null;
                largeur = nw; hauteur = nh;
                dessiner();
                return this;
            },
            // Redessine SANS bouger (ex. état plein écran qui change).
            refresh: function () {
                dessiner();
                return this;
            },
            setAlpha: function (a) {
                ombreG.setAlpha(a);
                corps.setAlpha(a);
                if (icone) icone.setAlpha(a);
                txt.setAlpha(a);
                zone.setAlpha(a);
                return this;
            },
            setDepth: function (d) {
                ombreG.setDepth(d);
                corps.setDepth(d + 1);
                if (icone) icone.setDepth(d + 2);
                txt.setDepth(d + 2);
                zone.setDepth(d + 3);
                return this;
            },
            destroy: function () {
                ombreG.destroy();
                corps.destroy();
                if (icone) icone.destroy();
                txt.destroy();
                zone.destroy();
            },
            // Dimensions courantes (pour le positionnement).
            largeur: function () { return largeur; },
            hauteur: function () { return hauteur; }
        };
        bouton.setPosition(x, y);

        // Mode u() : le composant se redimensionne LUI-MÊME à chaque
        // rotation / redimensionnement (Arcade.UI.layout), comme les
        // boutons du menu pilotés par leur layout de scène — MÊMES RÈGLES
        // pour les 2 variantes (FIX 08/08/2026, signalement John : Retour
        // / Plein écran restaient figés quand Réglages s'adaptait).
        if (largeurU !== null || hauteurU !== null ||
                largeurMinU !== null || margeLibelleU !== null) {
            Arcade.UI.layout(scene, function () {
                dessiner();
            });
        }

        zone.on("pointerdown", function () {
            var cibles = [ombreG, corps];
            if (icone) cibles.push(icone);
            cibles.push(txt, zone);
            enfoncer(cibles);
            // Marqueur lu par les scènes qui écoutent le pointerup GLOBAL
            // (ex. GameScene de Waggis : un clic sur une icône plateforme
            // ne doit pas faire bondir le personnage).
            if (o.marqueurClic) Arcade.UI._clicPlateforme = true;
        });
        var relacherBouton = function () {
            var cibles = [ombreG, corps];
            if (icone) cibles.push(icone);
            cibles.push(txt, zone);
            relacher(cibles);
        };
        zone.on("pointerout", relacherBouton);
        zone.on("pointerup", function () {
            relacherBouton();
            if (typeof o.onClick === "function") o.onClick();
        });

        return bouton;
    };
})();
