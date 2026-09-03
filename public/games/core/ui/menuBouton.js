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
 *       // tailles u()/px, onClick...) SAUF couleur/ombre/alphaCorps/
 *       // contourAlpha, résolues ici. Une variante peut être surchargée
 *       // explicitement si un jeu a vraiment besoin d'une exception
 *       // (couleur/ombre passées quand même écrasent la variante).
 *   })
 *
 * Variantes :
 *   - "jouer"      : tokens.succes (vert) — CTA principal, texte simple.
 *   - "secondaire" : tokens.noir + liseré "verre dépoli" (alphaCorps 0.92
 *                    + contourAlpha 0.18, cf. core/ui/button.js) — tuiles
 *                    d'action du menu (Niveaux, Boutique, Classement...).
 *   - "accent"     : tokens.rouge — Réglages, et Quitter/Plein écran
 *                    (core/ui.js, iconesPlateforme).
 */
(function () {
    "use strict";

    window.Arcade = window.Arcade || {};
    Arcade.UI = Arcade.UI || {};

    var VARIANTES = {
        jouer: function (tokens) {
            return { couleur: tokens.succes, ombre: tokens.ombre };
        },
        secondaire: function (tokens) {
            return {
                couleur: tokens.noir,
                ombre: tokens.ombre,
                alphaCorps: 0.92,
                contourAlpha: 0.18
            };
        },
        accent: function (tokens) {
            return { couleur: tokens.rouge, ombre: tokens.ombre };
        }
    };

    Arcade.UI.boutonMenu = function (scene, o) {
        o = o || {};
        var tokens = Arcade.UI.tokens;
        var resolveur = VARIANTES[o.variante] || VARIANTES.secondaire;
        var style = resolveur(tokens);

        var options = Object.assign({}, o, {
            couleur: o.couleur || style.couleur,
            ombre: o.ombre || style.ombre,
            alphaCorps: (typeof o.alphaCorps === "number") ? o.alphaCorps : style.alphaCorps,
            contourAlpha: (typeof o.contourAlpha === "number") ? o.contourAlpha : style.contourAlpha
        });
        delete options.variante;

        return Arcade.UI.bouton(scene, options);
    };
})();
