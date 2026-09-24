/*
 * core/ui/hud.js — LA pastille d'information affichée PENDANT la partie
 * (score, niveau, chrono, énergie, heure…), aux couleurs de The Elsassisch
 * (suite de la refonte charte des menus, 24/09/2026).
 *
 * Avant : chaque jeu écrivait son HUD directement sur le décor, en police
 * système noire (Cigogne, Waggis), blanche (Similitude) ou à contour épais
 * (Elsass Farm) — illisible sur un décor chargé, et sans rapport avec les
 * menus. Même vocabulaire que les pastilles de l'en-tête des menus
 * (core/ui/menuPrincipal.js) : fond NOIR arrondi, texte Montserrat gras
 * CRÈME. En alerte (chrono qui s'épuise…) : fond ROUGE, texte blanc.
 *
 *   var p = Arcade.UI.pastilleHud(scene, {
 *       texte: "Score : 0",
 *       tailleU: 3.6,        // police, en u() (défaut 3.6)
 *       ancre: 0,            // 0 = x est le bord GAUCHE, 0.5 = le centre,
 *                            // 1 = le bord DROIT (défaut 0.5)
 *       profondeur: 40
 *   });
 *   p.placer(x, y);          // y = HAUT de la pastille, en px
 *   p.setText("Score : 12"); // re-mesure et redessine à la même place
 *   p.setAlerte(true);
 *   p.cibles();              // [fond, texte] — pour un tween de pulsation
 *                            // (échelle autour du centre de la pastille)
 *   p.objets();              // idem — pour un filtre de caméra (Farm)
 *
 * Une pastille dont le texte est "" est masquée (valeur pas encore connue).
 * La police vient de Arcade.UI.polices (core/ui/polices.js) si le jeu la
 * charge, sinon police système : la brique ne dépend que de core/ui.js et
 * core/ui/tokens.js.
 */
(function () {
    "use strict";

    window.Arcade = window.Arcade || {};
    Arcade.UI = Arcade.UI || {};

    var POLICE_SECOURS = "system-ui, -apple-system, 'Segoe UI', sans-serif";

    Arcade.UI.pastilleHud = function (scene, o) {
        o = o || {};
        var UI = Arcade.UI;
        var T = UI.tokens;
        var u = function (v) { return UI.u(scene, v); };
        var profondeur = o.profondeur || 40;
        var ancre = typeof o.ancre === "number" ? o.ancre : 0.5;
        var tailleU = o.tailleU || 3.6;
        var alerte = false;
        var visible = true;
        var position = null;

        // Le fond est dessiné AUTOUR de (0, 0) puis déplacé : une mise à
        // l'échelle (pulsation d'alerte) se fait ainsi autour du centre.
        var fond = scene.add.graphics().setDepth(profondeur);
        var texte = scene.add.text(0, 0, o.texte || "", {
            fontFamily: (UI.polices && UI.polices.texte) || POLICE_SECOURS,
            fontStyle: "bold",
            color: T.creme,
            align: "center"
        }).setOrigin(0.5).setDepth(profondeur + 1);

        var dessiner = function () {
            texte.setFontSize(Math.round(u(tailleU)) + "px")
                .setColor(alerte ? "#ffffff" : T.creme);
            var hauteur = texte.height + u(tailleU * 0.45);
            var largeur = texte.width + u(tailleU * 1.2);
            var coul = UI.couleur(alerte ? T.rouge : T.noir);
            fond.clear();
            fond.fillStyle(coul.valeur, alerte ? 1 : 0.8);
            fond.fillRoundedRect(-largeur / 2, -hauteur / 2, largeur, hauteur, hauteur / 2);

            var montrer = visible && texte.text !== "";
            fond.setVisible(montrer);
            texte.setVisible(montrer);
            if (position) {
                var cx = position.x + largeur * (0.5 - ancre);
                var cy = position.y + hauteur / 2;
                fond.setPosition(cx, cy);
                texte.setPosition(cx, cy);
            }
            // Pastille masquée : elle n'occupe aucune place (mise en page).
            return montrer ? { largeur: largeur, hauteur: hauteur }
                : { largeur: 0, hauteur: 0 };
        };

        var taille = dessiner();

        var api = {
            placer: function (x, y) {
                position = { x: x, y: y };
                taille = dessiner();
                return api;
            },
            setText: function (t) {
                texte.setText(t);
                taille = dessiner();
                return api;
            },
            setTaille: function (u2) {
                tailleU = u2;
                taille = dessiner();
                return api;
            },
            setAlerte: function (oui) {
                alerte = !!oui;
                taille = dessiner();
                return api;
            },
            setVisible: function (oui) {
                visible = !!oui;
                taille = dessiner();
                return api;
            },
            setAlpha: function (a) {
                fond.setAlpha(a);
                texte.setAlpha(a);
                return api;
            },
            largeur: function () { return taille.largeur; },
            hauteur: function () { return taille.hauteur; },
            cibles: function () { return [fond, texte]; },
            objets: function () { return [fond, texte]; },
            destroy: function () {
                fond.destroy();
                texte.destroy();
            }
        };
        return api;
    };
})();
