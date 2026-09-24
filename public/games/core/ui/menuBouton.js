/*
 * core/ui/menuBouton.js — LE bouton de menu réutilisable, design system
 * The Elsassisch (décision John — plus de couleur en dur par jeu).
 *
 * Fine couche au-dessus de core/ui/button.js (Arcade.UI.bouton) : AUCUNE
 * duplication de rendu, ce fichier décide uniquement couleur / ombre /
 * liseré à partir d'une VARIANTE sémantique, à la place de chaque jeu qui
 * devait connaître "Réglages = rouge, secondaire = noir, Jouer = vert" et
 * répéter couleur + ombre à chaque appel.
 *
 *   Arcade.UI.boutonMenu(scene, {
 *       variante: "jouer" | "secondaire" | "accent",
 *       // + toutes les options de Arcade.UI.bouton (icone, label,
 *       // tailles u()/px, onClick...) SAUF couleur/textColor/ombre/
 *       // contour/police, résolues ici. Une variante peut être surchargée
 *       // explicitement si un jeu a vraiment besoin d'une exception
 *       // (couleur/ombre passées quand même écrasent la variante).
 *   })
 *
 * Variantes — refonte « charte stricte » du 23/09/2026 (décision John :
 * les menus des jeux doivent ressembler à l'app, pas à un jeu mobile
 * générique). Toutes à plat (pas de voile brillant), libellé Montserrat
 * gras, comme les boutons et cartes du catalogue :
 *   - "jouer"      : ROUGE alsacien, texte blanc — le seul appel à l'action
 *                    principal, comme la pastille « Jouer » du catalogue.
 *                    (Était VERT jusqu'au 23/09 : couleur hors charte.)
 *   - "secondaire" : carte CRÈME bordée « ligne », texte encre — tuiles
 *                    d'action (Niveaux, Boutique, Classement…), comme les
 *                    cartes de jeu du catalogue.
 *   - "accent"     : NOIR, texte blanc, liseré clair discret — Réglages
 *                    et Quitter / Plein écran (core/ui.js), comme la
 *                    pastille de filtre active de l'app.
 * La police vient de Arcade.UI.polices.texte si l'appel n'en passe pas.
 */
(function () {
    "use strict";

    window.Arcade = window.Arcade || {};
    Arcade.UI = Arcade.UI || {};

    var VARIANTES = {
        jouer: function (tokens) {
            return { couleur: tokens.rouge, textColor: "#ffffff", ombre: tokens.ombre };
        },
        secondaire: function (tokens) {
            return {
                couleur: tokens.creme,
                textColor: tokens.encre,
                ombre: tokens.ombreDouce,
                contourCouleur: tokens.ligne,
                contourAlpha: 1
            };
        },
        accent: function (tokens) {
            return {
                couleur: tokens.noir,
                textColor: "#ffffff",
                ombre: tokens.ombre,
                contourAlpha: 0.14
            };
        }
    };

    Arcade.UI.boutonMenu = function (scene, o) {
        o = o || {};
        var tokens = Arcade.UI.tokens;
        var resolveur = VARIANTES[o.variante] || VARIANTES.secondaire;
        var style = resolveur(tokens);

        var options = Object.assign({ plat: true, gras: true }, o, {
            couleur: o.couleur || style.couleur,
            textColor: o.textColor || style.textColor,
            ombre: o.ombre || style.ombre,
            police: o.police || (Arcade.UI.polices && Arcade.UI.polices.texte),
            contourCouleur: o.contourCouleur || style.contourCouleur,
            alphaCorps: (typeof o.alphaCorps === "number") ? o.alphaCorps : style.alphaCorps,
            contourAlpha: (typeof o.contourAlpha === "number") ? o.contourAlpha : style.contourAlpha
        });
        delete options.variante;

        return Arcade.UI.bouton(scene, options);
    };
})();
