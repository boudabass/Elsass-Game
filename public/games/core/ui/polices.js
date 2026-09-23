/*
 * core/ui/polices.js — les deux polices de marque The Elsassisch, côté
 * Phaser (miroir de src/lib/fonts.ts côté Next.js).
 *
 *   - Azimut (titres) : Regular uniquement. JAMAIS de gras — la graisse
 *     « Bold » d'Azimut est un dessin pochoir illisible en petit corps.
 *     L'emphase se fait par la taille et les MAJUSCULES.
 *   - Montserrat (texte, boutons) : police variable 400 → 800.
 *
 * Les deux fichiers sont auto-hébergés dans public/fonts/ (aucun CDN).
 * Le chargement est fait UNE FOIS par PreloadScene, avant la première
 * scène du jeu : toutes les scènes peuvent donc utiliser
 * Arcade.UI.polices.titre / .texte sans rien charger elles-mêmes.
 * Hors ligne ou police indisponible : repli silencieux sur les polices
 * système après une courte attente (le jeu ne reste jamais bloqué).
 */
(function () {
    "use strict";

    window.Arcade = window.Arcade || {};
    Arcade.UI = Arcade.UI || {};

    Arcade.UI.polices = {
        titre: "'Azimut', Georgia, serif",
        texte: "'Montserrat', system-ui, -apple-system, 'Segoe UI', sans-serif"
    };

    var FICHIERS = [
        { famille: "Azimut", url: "/fonts/azimut/Azimut-Regular.woff2", graisse: "400" },
        { famille: "Montserrat", url: "/fonts/montserrat/Montserrat-latin-variable.woff2", graisse: "400 800" }
    ];

    var ATTENTE_MAX_MS = 1500;
    var promesse = null;

    /**
     * Déclare les @font-face et attend leur chargement (au plus
     * ATTENTE_MAX_MS). Idempotent : les appels suivants renvoient la même
     * promesse.
     */
    Arcade.UI.chargerPolices = function () {
        if (promesse) return promesse;
        if (typeof document === "undefined" || !document.fonts) {
            promesse = Promise.resolve();
            return promesse;
        }
        var css = FICHIERS.map(function (f) {
            return "@font-face{font-family:'" + f.famille + "';src:url('" + f.url +
                "') format('woff2');font-weight:" + f.graisse +
                ";font-style:normal;font-display:swap;}";
        }).join("");
        var style = document.createElement("style");
        style.textContent = css;
        document.head.appendChild(style);

        // Canvas (Phaser.Text) n'attend pas les polices : il faut qu'elles
        // soient chargées AVANT le premier dessin, graisses utilisées
        // comprises (Montserrat 400 et 700).
        var chargements = Promise.all([
            document.fonts.load('16px "Azimut"'),
            document.fonts.load('16px "Montserrat"'),
            document.fonts.load('700 16px "Montserrat"')
        ]).catch(function () { /* repli police système */ });
        promesse = Promise.race([
            chargements,
            new Promise(function (res) { setTimeout(res, ATTENTE_MAX_MS); })
        ]);
        return promesse;
    };
})();
