/*
 * core/ui/menuPrincipal.js — LE menu d'accueil d'un jeu, aux couleurs de
 * The Elsassisch (refonte « charte stricte » du 23/09/2026, décision John :
 * les menus des jeux étaient fonctionnels mais chacun avait son allure —
 * police système ici, Azimut à contour rouge là, bouton vert, tuiles
 * noires brillantes — et aucun ne ressemblait à l'app).
 *
 * Même vocabulaire visuel que le catalogue de l'app (src/components/
 * games-catalog.tsx) : bandeau NOIR à surtitre OR (le « À la une »),
 * titre en Azimut, texte en Montserrat, bouton « Jouer » ROUGE, tuiles
 * CRÈME bordées comme les cartes de jeu. Le DÉCOR du jeu (ciel, toits,
 * piste…) reste propre à chaque jeu et passe dessous.
 *
 * Le composant construit ET place tout l'écran — le jeu ne fournit que
 * son contenu :
 *
 *   var menu = Arcade.UI.menuPrincipal(scene, {
 *       titre: "Waggis",
 *       accroche: "Traverse Strasbourg…",        // optionnel
 *       surtitre: "The Elsassisch · Arcade",     // optionnel (défaut)
 *       infos: ["🏆 Meilleur score : 0"],         // 0..N pastilles, optionnel
 *                                                 // ("" = pastille masquée
 *                                                 // jusqu'à son setInfo)
 *       illustration: function (cx, cy, hauteurMax, largeurMax) { … },
 *                                                 // optionnel : place le
 *                                                 // visuel du jeu dans la
 *                                                 // place restante
 *       // Bloc d'actions : mêmes options que Arcade.UI.menuActions
 *       jouer: { label, onClick } | null,
 *       secondaires: [{ icone, label, onClick }],
 *       reglages: { label, onClick } | null,
 *       iconesPlateforme: false  // optionnel : écran SANS Quitter / Plein
 *                                // écran (fin de partie) — l'en-tête
 *                                // remonte en haut de l'écran
 *   });
 *   menu.setInfo(0, "🏆 Meilleur score : 12");  // ex. après Score.load()
 *
 * Mise en page (recalculée à chaque rotation, Arcade.UI.layout) :
 *   - PORTRAIT : une colonne centrée (88 % de la largeur) — en-tête sous
 *     les boutons Quitter / Plein écran, actions ancrées en bas,
 *     illustration centrée dans la place qui reste entre les deux. Sans
 *     illustration, en-tête + actions sont regroupés au centre ;
 *   - PAYSAGE : deux colonnes alignées en haut — en-tête à gauche et
 *     illustration dessous, actions à droite ; sans illustration, le
 *     groupe est centré verticalement. (Avant : un « Jouer » étiré sur
 *     80 % d'un écran de PC.)
 * Largeurs en % de la largeur réelle, hauteurs et polices en u().
 */
(function () {
    "use strict";

    window.Arcade = window.Arcade || {};
    Arcade.UI = Arcade.UI || {};

    var SURTITRE_DEFAUT = "The Elsassisch · Arcade";

    /**
     * Réduit la police d'un texte d'une ligne jusqu'à `largeur`, sans
     * descendre sous `plancher` px.
     */
    function ajusterLargeur(texte, taille, largeur, plancher) {
        var fs = taille;
        texte.setFontSize(Math.round(fs) + "px");
        while (texte.width > largeur && fs > plancher) {
            fs -= 1;
            texte.setFontSize(Math.round(fs) + "px");
        }
    }

    /**
     * En-tête de menu : carte noire, surtitre or en capitales, titre Azimut,
     * accroche, pastilles d'infos (score, porte-monnaie…). Texte aligné à
     * gauche, comme le bandeau « À la une » de l'app.
     * @returns {{ placer: function(x, y, largeur): number, setInfo: function }}
     *          placer() dessine la carte (coin haut-gauche x, y) et renvoie
     *          sa hauteur.
     */
    Arcade.UI.enteteMenu = function (scene, o) {
        var T = Arcade.UI.tokens;
        var P = Arcade.UI.polices;
        var profondeur = 20;
        var u = function (v) { return Arcade.UI.u(scene, v); };

        var ombre = scene.add.graphics().setDepth(profondeur);
        var carte = scene.add.graphics().setDepth(profondeur + 1);

        var surtitre = scene.add.text(0, 0, (o.surtitre || SURTITRE_DEFAUT).toUpperCase(), {
            fontFamily: P.texte, fontStyle: "bold", color: T.or
        }).setDepth(profondeur + 2);

        var titre = scene.add.text(0, 0, o.titre || "", {
            fontFamily: P.titre, color: T.creme
        }).setDepth(profondeur + 2);

        var accroche = o.accroche ? scene.add.text(0, 0, o.accroche, {
            fontFamily: P.texte, color: T.creme
        }).setDepth(profondeur + 2).setAlpha(0.78) : null;

        var pastilles = scene.add.graphics().setDepth(profondeur + 1);
        var infos = (o.infos || []).map(function (texte) {
            return scene.add.text(0, 0, texte, {
                fontFamily: P.texte, fontStyle: "bold", color: T.creme
            }).setDepth(profondeur + 2);
        });

        var derniere = null;   // dernière géométrie, pour setInfo()

        var placer = function (x, y, largeur) {
            derniere = { x: x, y: y, largeur: largeur };
            var pX = u(5);
            var pY = u(4.5);
            var interieur = largeur - 2 * pX;
            var curseur = y + pY;

            surtitre.setFontSize(Math.round(u(2.5)) + "px")
                .setLetterSpacing(u(0.35))
                .setPosition(x + pX, curseur);
            curseur += surtitre.height + u(1);

            ajusterLargeur(titre, u(o.tailleTitreU || 10), interieur, u(5));
            titre.setPosition(x + pX, curseur);
            curseur += titre.height;

            if (accroche) {
                accroche.setFontSize(Math.round(u(3.4)) + "px")
                    .setWordWrapWidth(interieur, true)
                    .setPosition(x + pX, curseur + u(1));
                curseur += u(1) + accroche.height;
            }

            pastilles.clear();
            if (infos.some(function (t) { return t.text !== ""; })) {
                curseur += u(3);
                var hP = u(6.5);
                var mP = u(2.6);
                var ecart = u(2);
                var px = x + pX;
                var py = curseur;
                infos.forEach(function (t) {
                    // Pastille vide = masquée (valeur pas encore connue,
                    // ex. le gain de pièces avant l'envoi du score).
                    t.setVisible(t.text !== "");
                    if (t.text === "") return;
                    ajusterLargeur(t, u(3), interieur - 2 * mP, u(2));
                    var lP = t.width + 2 * mP;
                    if (px > x + pX && px + lP > x + pX + interieur) {
                        px = x + pX;          // pas la place : ligne suivante
                        py += hP + ecart;
                    }
                    pastilles.fillStyle(0xffffff, 0.10);
                    pastilles.fillRoundedRect(px, py, lP, hP, hP / 2);
                    t.setOrigin(0, 0.5).setPosition(px + mP, py + hP / 2);
                    px += lP + ecart;
                });
                curseur = py + hP;
            }

            var hauteur = curseur + pY - y;
            var r = u(3.5);
            var teinteOmbre = Arcade.UI.couleur(T.ombre);
            ombre.clear();
            ombre.fillStyle(teinteOmbre.valeur, teinteOmbre.alpha);
            ombre.fillRoundedRect(x, y + u(0.9), largeur, hauteur, r);
            carte.clear();
            carte.fillStyle(Arcade.UI.couleur(T.noir).valeur, 1);
            carte.fillRoundedRect(x, y, largeur, hauteur, r);
            carte.lineStyle(Math.max(1, u(0.2)), 0xffffff, 0.08);
            carte.strokeRoundedRect(x, y, largeur, hauteur, r);
            // Pastilles dessinées APRÈS la carte : même Graphics séparé,
            // profondeur au-dessus de la carte.
            return hauteur;
        };

        return {
            placer: placer,
            setInfo: function (i, texte) {
                if (!infos[i]) return;
                infos[i].setText(texte);
                if (derniere) placer(derniere.x, derniere.y, derniere.largeur);
            }
        };
    };

    Arcade.UI.menuPrincipal = function (scene, o) {
        o = o || {};
        var UI = Arcade.UI;
        var u = function (v) { return UI.u(scene, v); };

        var entete = UI.enteteMenu(scene, {
            titre: o.titre,
            accroche: o.accroche,
            surtitre: o.surtitre,
            infos: o.infos
        });

        var actions = UI.menuActions(scene, {
            jouer: o.jouer || null,
            secondaires: o.secondaires || [],
            reglages: o.reglages || null,
            // Un peu plus hauts que les défauts du bloc (11,5 / 10,5) :
            // les libellés des tuiles restent lisibles sur téléphone.
            hauteurJouerU: 12,
            hauteurSecondaireU: 12,
            autoLayout: false
        });

        var hauteurEntete = 0;

        var avecIllustration = typeof o.illustration === "function";

        var miseEnPage = function (w, h) {
            // Sous les boutons Quitter / Plein écran (marge u(2) + hauteur
            // u(10.5), cf. Arcade.UI.iconesPlateforme) + respiration — sauf
            // sur un écran qui ne les affiche pas (fin de partie).
            var haut = o.iconesPlateforme === false ? u(4) : u(2) + u(10.5) + u(3);
            var bas = h * 0.965;
            var ecart = u(3);
            var hActions = actions.hauteur();
            var zoneIllu;

            if (w > h) {
                // PAYSAGE : deux colonnes, alignées en haut. Sans
                // illustration, le groupe est centré verticalement.
                var gouttiere = u(6);
                var colonne = Math.min((w - 2 * u(4) - gouttiere) / 2, w * 0.42);
                var cxG = w / 2 - gouttiere / 2 - colonne / 2;
                var cxD = w / 2 + gouttiere / 2 + colonne / 2;

                hauteurEntete = entete.placer(cxG - colonne / 2, haut, colonne);
                var top = haut;
                if (!avecIllustration) {
                    var hGroupe = Math.max(hauteurEntete, hActions);
                    top = Math.max(haut, (haut + bas) / 2 - hGroupe / 2);
                    entete.placer(cxG - colonne / 2, top, colonne);
                }
                actions.positionner(cxD, colonne, Math.min(bas, top + hActions));
                zoneIllu = {
                    cx: cxG, largeur: colonne,
                    haut: top + hauteurEntete + ecart,
                    bas: bas
                };
            } else {
                // PORTRAIT : une colonne. Actions ancrées en bas (à portée
                // de pouce), illustration entre l'en-tête et les actions.
                // Sans illustration, en-tête + actions forment un seul
                // groupe centré (pas de grand vide au milieu).
                var largeur = w * 0.88;
                hauteurEntete = entete.placer(w / 2 - largeur / 2, haut, largeur);
                var basActions = bas;
                if (!avecIllustration) {
                    var hTout = hauteurEntete + u(8) + hActions;
                    var hautGroupe = Math.max(haut, (haut + bas) / 2 - hTout / 2);
                    entete.placer(w / 2 - largeur / 2, hautGroupe, largeur);
                    basActions = Math.min(bas, hautGroupe + hTout);
                }
                actions.positionner(w / 2, largeur, basActions);
                zoneIllu = {
                    cx: w / 2, largeur: largeur,
                    haut: haut + hauteurEntete + ecart,
                    bas: actions.haut() - ecart
                };
            }

            if (avecIllustration) {
                var hMax = Math.max(0, zoneIllu.bas - zoneIllu.haut);
                o.illustration(zoneIllu.cx, zoneIllu.haut + hMax / 2, hMax, zoneIllu.largeur);
            }
        };

        UI.layout(scene, miseEnPage);

        return {
            setInfo: function (i, texte) {
                entete.setInfo(i, texte);
                miseEnPage(scene.scale.width, scene.scale.height);
            },
            actions: actions
        };
    };
})();
