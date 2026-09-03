/*
 * core/ui/menuActions.js — LE bloc d'actions du menu principal, réutilisable
 * et adaptatif au nombre de boutons (décision John — plus de calcul de
 * grille copié-collé par jeu).
 *
 * Généralisation d'une mécanique déjà dupliquée À L'IDENTIQUE dans Waggis
 * et Similitude (mêmes valeurs : largeurJouerPct 80, hauteurJouerU 11.5,
 * hauteurSecondaireU 10.5, largeurReglagesU 15, espaceU 4.5, ySol à 96.5 %
 * de la hauteur) : « Jouer » pleine largeur + une grille de tuiles
 * secondaires + Réglages compact en bas à droite, empilés du bas vers le
 * haut avec un espacement uniforme, jamais superposés (règle John).
 *
 * Ne gère QUE le bloc d'actions : titre, accroche, illustration et fond
 * restent propres à chaque scène (ce n'est pas une question de « combien
 * de boutons »).
 *
 *   Arcade.UI.menuActions(scene, {
 *       jouer: { label, onClick } | null,          // CTA principal, optionnel
 *       secondaires: [{ icone, label, onClick }],  // 0..N — LA GRILLE S'ADAPTE À N
 *       reglages: { label, onClick } | null,        // optionnel, compact, bas-droite
 *       police: "...",
 *       // Défauts = valeurs déjà partagées par Waggis/Similitude, à
 *       // surcharger seulement si un jeu a vraiment besoin d'autre chose :
 *       largeurJouerPct: 80, hauteurJouerU: 11.5, hauteurSecondaireU: 10.5,
 *       largeurReglagesU: 15, espaceU: 4.5, ancrageBasPct: 0.965
 *   })
 *
 * Règle du nombre de colonnes (N = secondaires.length) :
 *   N=0   -> pas de grille, juste Jouer (Cigogne, Elsass Farm).
 *   N=1-3 -> une seule rangée de N colonnes.
 *   N=4   -> grille 2×2 (Waggis, Similitude — reproduit EXACTEMENT la
 *            disposition actuelle, mêmes valeurs).
 *   N>=5  -> 3 colonnes, plusieurs lignes ; une dernière ligne incomplète
 *            est CENTRÉE (jamais alignée à gauche).
 *
 * Recalculé à chaque rotation / redimensionnement (Arcade.UI.layout) — le
 * jeu n'a plus à gérer ce recalcul pour cette partie du menu.
 */
(function () {
    "use strict";

    window.Arcade = window.Arcade || {};
    Arcade.UI = Arcade.UI || {};

    function colonnesPour(n) {
        if (n === 0) return 0;
        if (n <= 3) return n;
        if (n === 4) return 2;
        return 3;
    }

    Arcade.UI.menuActions = function (scene, o) {
        o = o || {};
        var UI = Arcade.UI;
        var secondaires = o.secondaires || [];
        var n = secondaires.length;
        var colonnes = colonnesPour(n);
        var lignes = colonnes > 0 ? Math.ceil(n / colonnes) : 0;
        var police = o.police;

        var largeurJouerPct = (typeof o.largeurJouerPct === "number") ? o.largeurJouerPct : 80;
        var hauteurJouerU = (typeof o.hauteurJouerU === "number") ? o.hauteurJouerU : 11.5;
        var hauteurSecondaireU = (typeof o.hauteurSecondaireU === "number") ? o.hauteurSecondaireU : 10.5;
        var largeurReglagesU = (typeof o.largeurReglagesU === "number") ? o.largeurReglagesU : 15;
        var espaceU = (typeof o.espaceU === "number") ? o.espaceU : 4.5;
        var ancrageBasPct = (typeof o.ancrageBasPct === "number") ? o.ancrageBasPct : 0.965;

        // --- Construction des boutons (une seule fois) ------------------
        var boutonJouer = o.jouer ? Arcade.UI.boutonMenu(scene, {
            variante: "jouer",
            label: o.jouer.label,
            police: police,
            onClick: o.jouer.onClick
        }) : null;

        var tuiles = secondaires.map(function (sec) {
            return Arcade.UI.boutonMenu(scene, {
                variante: "secondaire",
                icone: sec.icone,
                label: sec.label,
                police: police,
                onClick: sec.onClick
            });
        });

        var boutonReglages = o.reglages ? Arcade.UI.boutonMenu(scene, {
            variante: "accent",
            icone: o.reglages.icone || "⚙️",
            label: o.reglages.label,
            police: police,
            onClick: o.reglages.onClick
        }) : null;

        // --- Mise en page (empilement ancré en bas) ----------------------
        var miseEnPage = function (w, h) {
            var u = function (v) { return UI.u(scene, v); };
            var espace = u(espaceU);
            var largeurJouer = w * (largeurJouerPct / 100);
            var hauteurJouer = u(hauteurJouerU);
            var hauteurSec = u(hauteurSecondaireU);
            var ySol = h * ancrageBasPct;

            var hauteurGrille = lignes > 0
                ? lignes * hauteurSec + (lignes - 1) * espace
                : 0;

            var yReglages = null;
            var basGrille;
            if (boutonReglages) {
                yReglages = ySol - hauteurSec / 2;
                basGrille = yReglages - hauteurSec / 2 - espace;
            } else {
                basGrille = ySol;
            }

            var hautGrille = basGrille - hauteurGrille;
            var basJouer = hautGrille - espace;
            var yJouer = basJouer - hauteurJouer / 2;

            if (boutonJouer) {
                boutonJouer.redimensionner(largeurJouer, hauteurJouer)
                    .setPosition(w / 2, yJouer);
            }

            // Grille : chaque LIGNE reprend la largeur de référence
            // (largeurJouer), ses tuiles se la partagent séparées par
            // `espace`. Une dernière ligne incomplète est centrée (son
            // propre nombre d'items sert de référence, pas `colonnes`).
            for (var i = 0; i < n; i++) {
                var ligne = Math.floor(i / colonnes);
                var indexDansLigne = i - ligne * colonnes;
                var itemsCetteLigne = Math.min(colonnes, n - ligne * colonnes);
                var largeurSec = (largeurJouer - (itemsCetteLigne - 1) * espace) / itemsCetteLigne;
                var pasX = largeurSec + espace;
                var pasY = hauteurSec + espace;
                var x = w / 2 - ((itemsCetteLigne - 1) / 2) * pasX + indexDansLigne * pasX;
                var y = hautGrille + hauteurSec / 2 + ligne * pasY;
                tuiles[i].redimensionner(largeurSec, hauteurSec).setPosition(x, y);
            }

            if (boutonReglages) {
                var largeurReglages = u(largeurReglagesU);
                // Position horizontale identique à celle déjà validée dans
                // Waggis/Similitude (marge fixe u(8.5) depuis le bord droit).
                boutonReglages.redimensionner(largeurReglages, hauteurSec)
                    .setPosition(w - u(8.5), yReglages);
            }
        };

        Arcade.UI.layout(scene, miseEnPage);

        return {
            boutonJouer: boutonJouer,
            secondaires: tuiles,
            boutonReglages: boutonReglages
        };
    };
})();
