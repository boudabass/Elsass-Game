/*
 * core/ui/ecran.js — LE gabarit des écrans secondaires d'un jeu (Boutique,
 * Niveaux, Classement, Réglages, Comment jouer…) + LA carte de contenu,
 * aux couleurs de The Elsassisch (refonte charte, 24/09/2026 — suite de
 * core/ui/menuPrincipal.js, décision John : « continue les menus »).
 *
 * Avant : chaque écran dessinait son titre (Azimut à contour), ses cartes
 * (noires, grises, translucides…) et son bouton Quitter à sa façon. Tous
 * partagent pourtant la même structure — c'est elle qui vit ici :
 *
 *   var ecran = Arcade.UI.ecran(scene, {
 *       surtitre: "Waggis",                  // nom du jeu (or, capitales)
 *       titre: "Boutique",                   // titre de l'écran (Azimut)
 *       infos: ["🪙 34"],                     // pastilles, optionnel
 *       retour: { label: "Quitter", onClick },
 *       contenu: function (zone) { … }       // place le contenu de la
 *   });                                      // scène dans zone
 *   ecran.setInfo(0, "🪙 4");
 *
 *   zone = { x, y, largeur, hauteur, cx, cy }  (px, recalculée à chaque
 *   rotation — la scène y range ses cartes, sa grille, sa liste…)
 *
 * Mise en page (Arcade.UI.layout) :
 *   - PORTRAIT : en-tête en haut, bouton Retour en bas, contenu entre les
 *     deux, sur une colonne de 88 % de la largeur ;
 *   - PAYSAGE : en-tête + Retour dans une colonne à gauche, contenu à
 *     droite sur toute la hauteur (les listes gardent de la place).
 *
 *   Arcade.UI.carte(g, x, y, largeur, hauteur, etat)
 *     Dessine une carte (coin haut-gauche x, y) dans le Graphics g :
 *     fond crème, bord « ligne », ombre douce — les cartes de jeu du
 *     catalogue de l'app. États : "normal" | "selection" (bord rouge,
 *     l'élément actif) | "reussi" (bord or, déjà obtenu / terminé) |
 *     "verrou" (fond ligne, sans ombre : pas encore accessible) |
 *     "primaire" (fond ROUGE, sans bord : LA prochaine action, ex. le
 *     niveau à jouer — texte blanc dessus).
 *     Le texte posé dessus est en encre (Arcade.UI.tokens.encre).
 */
(function () {
    "use strict";

    window.Arcade = window.Arcade || {};
    Arcade.UI = Arcade.UI || {};

    Arcade.UI.carte = function (g, x, y, largeur, hauteur, etat) {
        var T = Arcade.UI.tokens;
        var c = Arcade.UI.couleur;
        var r = Math.min(hauteur, largeur) * 0.18;
        var trait = Math.max(1, Math.round(Math.min(hauteur, largeur) * 0.02));
        etat = etat || "normal";

        if (etat !== "verrou") {
            var ombre = c(T.ombreDouce);
            g.fillStyle(ombre.valeur, ombre.alpha);
            g.fillRoundedRect(x, y + hauteur * 0.05, largeur, hauteur, r);
        }
        var fond = { verrou: T.ligne, primaire: T.rouge }[etat] || T.creme;
        g.fillStyle(c(fond).valeur, 1);
        g.fillRoundedRect(x, y, largeur, hauteur, r);
        if (etat === "primaire") return;

        var bord = { normal: T.ligne, selection: T.rouge, reussi: T.or, verrou: T.ligne }[etat] || T.ligne;
        var epaisseur = (etat === "selection" || etat === "reussi") ? trait * 2 : trait;
        g.lineStyle(epaisseur, c(bord).valeur, 1);
        g.strokeRoundedRect(x, y, largeur, hauteur, r);
    };

    Arcade.UI.ecran = function (scene, o) {
        o = o || {};
        var UI = Arcade.UI;
        var u = function (v) { return UI.u(scene, v); };

        var entete = UI.enteteMenu(scene, {
            surtitre: o.surtitre,
            titre: o.titre,
            infos: o.infos,
            tailleTitreU: 8
        });

        var retour = o.retour ? UI.boutonMenu(scene, {
            variante: "accent",
            label: o.retour.label,
            onClick: o.retour.onClick
        }) : null;

        var miseEnPage = function (w, h) {
            var marge = u(4);
            var hRetour = u(11);
            var zone;

            if (w > h) {
                // PAYSAGE : colonne gauche (en-tête + Retour), contenu à droite.
                var gauche = Math.min(w * 0.34, u(95));
                var xG = marge;
                entete.placer(xG, marge, gauche);
                if (retour) {
                    retour.redimensionner(gauche, hRetour)
                        .setPosition(xG + gauche / 2, h - marge - hRetour / 2);
                }
                var xD = xG + gauche + u(6);
                zone = { x: xD, y: marge, largeur: w - xD - marge, hauteur: h - 2 * marge };
            } else {
                // PORTRAIT : une colonne.
                var largeur = w * 0.88;
                var x0 = (w - largeur) / 2;
                var hEntete2 = entete.placer(x0, marge, largeur);
                var basContenu = h - marge;
                if (retour) {
                    var lRetour = Math.min(largeur, u(60));
                    retour.redimensionner(lRetour, hRetour)
                        .setPosition(w / 2, h - marge - hRetour / 2);
                    basContenu = h - marge - hRetour - u(4);
                }
                var hautContenu = marge + hEntete2 + u(4);
                zone = { x: x0, y: hautContenu, largeur: largeur, hauteur: basContenu - hautContenu };
            }
            zone.cx = zone.x + zone.largeur / 2;
            zone.cy = zone.y + zone.hauteur / 2;
            if (typeof o.contenu === "function") o.contenu(zone);
        };

        UI.layout(scene, miseEnPage);

        return {
            setInfo: function (i, texte) {
                entete.setInfo(i, texte);
                miseEnPage(scene.scale.width, scene.scale.height);
            },
            retour: retour
        };
    };
})();
