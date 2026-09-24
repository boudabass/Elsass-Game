/*
 * Niveaux.js — les 100 niveaux de Schieweschlawe, CALCULÉS (PRD 873 §7).
 *
 * Aucun niveau n'est écrit à la main : chacun se déduit de son numéro et
 * des réglages de config.js. Logique pure, sans Phaser — utilisable par le
 * jeu (window.SchieweschlaweNiveaux) et par les tests Node
 * (tests/niveaux.test.js).
 *
 * Décisions John du 24/09/2026 :
 *   - 10 paliers de 10 niveaux ; la cible rétrécit et s'écarte du centre
 *     d'un palier à l'autre ;
 *   - DANS un palier, la cible s'éloigne (1er niveau = proche, 10e = fond
 *     du terrain) ;
 *   - le vent est FIXÉ par niveau : sa force suit le palier, sa direction
 *     dépend du numéro du niveau. Un même niveau a toujours la même cible
 *     et le même vent (on peut s'entraîner dessus).
 *
 * ATTEIGNABILITÉ — un vent fort dans le mauvais sens peut rendre une cible
 * impossible (ex. cible au fond du terrain + vent qui ramène vers la
 * pierre : même en visant le bout du terrain, le disque retombe trop
 * court). Pour chaque niveau, on calcule la visée qu'il FAUDRAIT pour
 * toucher le centre de la cible (même physique que GameScene : parabole +
 * accélération constante du vent) et on vérifie qu'elle reste dans la zone
 * de visée (0-100 sur les deux axes, avec une marge), sur plusieurs formats
 * d'écran. Sinon on essaie une autre direction de vent, puis une cible
 * recentrée, puis un vent d'un cran plus faible.
 *
 *   SchieweschlaweNiveaux.niveau(n, C) →
 *     { n, palier, rang, distancePct, lateralPct, rayonPct,
 *       vent: { nom, valeur, dx, dy } }
 *   SchieweschlaweNiveaux.viseeRequise(niv, C, w, h) → { lateral, distance }
 */
(function (root, factory) {
    if (typeof module !== "undefined" && module.exports) {
        module.exports = factory();
    } else {
        root.SchieweschlaweNiveaux = factory();
    }
})(typeof window !== "undefined" ? window : this, function () {
    "use strict";

    /** Pseudo-aléa DÉTERMINISTE dans [0, 1[ : même niveau → même valeur. */
    function alea(n, sel) {
        var x = Math.sin(n * 12.9898 + sel * 78.233) * 43758.5453;
        return x - Math.floor(x);
    }

    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    /**
     * Visée (0-100 sur chaque axe) qu'il faut pour que le disque retombe
     * au CENTRE de la cible, vent compris, sur un écran w × h.
     *
     * Physique de GameScene._lancer : sans vent, le disque retombe
     * exactement au point visé A (vitesse déduite de la distance pierre→A).
     * Le vol dure t, avec t² = 2·f·d / g (f = facteurHauteur, d = |A − P|,
     * g = gravité de hauteur en px/s²) ; le vent (accélération a) décale
     * l'atterrissage de a·t²/2 = a·f·d / g. On cherche A tel que
     * A + a·f·|A − P| / g = cible (point fixe, converge car a·f/g < 1).
     */
    function viseeRequise(niv, C, w, h) {
        var L = C.lancer;
        var px = (L.pierreXPct / 100) * w;
        var py = (L.pierreYPct / 100) * h;
        var longueur = py;                       // terrain = tout l'espace au-dessus
        var tx = (niv.lateralPct / 100) * w;
        var ty = py - (niv.distancePct / 100) * longueur;
        var g = L.graviteHauteurPar_s * h;
        var f = L.facteurHauteur;
        var axv = niv.vent.valeur * niv.vent.dx * w;
        var ayv = niv.vent.valeur * niv.vent.dy * h;

        var ax = tx, ay = ty;
        for (var i = 0; i < 60; i++) {
            var d = Math.hypot(ax - px, ay - py);
            ax = tx - axv * f * d / g;
            ay = ty - ayv * f * d / g;
        }
        // Retour dans les coordonnées de visée de GameScene._majVisee :
        // latéral visé = ax / w ; distance visée = (py − ay) / longueur.
        return {
            lateral: (ax / w) * 100,
            distance: ((py - ay) / longueur) * 100
        };
    }

    function atteignable(niv, C) {
        var m = C.vent.margeViseePct;
        return C.vent.ecransReference.every(function (e) {
            var v = viseeRequise(niv, C, e.w, e.h);
            return v.lateral >= m && v.lateral <= 100 - m &&
                v.distance >= m && v.distance <= 100 - m;
        });
    }

    function niveau(n, C) {
        var N = C.niveaux;
        var Ci = C.cible;
        n = clamp(Math.round(n), 1, N.total);
        var palier = Math.ceil(n / N.parPalier);          // 1..10
        var rang = n - (palier - 1) * N.parPalier;         // 1..10 dans le palier
        var p = palier - 1;

        var distancePct = Ci.distanceMinPct +
            (Ci.distanceMaxPct - Ci.distanceMinPct) * (rang - 1) / (N.parPalier - 1);
        var ecart = Ci.lateralEcartParPalierPct[p] || 0;
        var lateralPct = clamp(50 + ecart * (2 * alea(n, 1) - 1),
            Ci.lateralBornesPct[0], Ci.lateralBornesPct[1]);

        var base = {
            n: n,
            palier: palier,
            rang: rang,
            distancePct: distancePct,
            lateralPct: lateralPct,
            rayonPct: Ci.rayonParPalierPct[p]
        };

        var dirs = C.vent.directions;
        var depart = Math.floor(alea(n, 2) * dirs.length);
        var laterals = [lateralPct, 50];                   // puis cible recentrée
        for (var cran = p; cran >= 0; cran--) {            // puis vent plus faible
            var force = C.vent.parPalier[cran];
            for (var li = 0; li < laterals.length; li++) {
                for (var k = 0; k < dirs.length; k++) {
                    var d = dirs[(depart + k) % dirs.length];
                    var niv = Object.assign({}, base, {
                        lateralPct: laterals[li],
                        vent: { nom: force.nom, valeur: force.valeur, dx: d.dx, dy: d.dy }
                    });
                    if (force.valeur === 0 || atteignable(niv, C)) return niv;
                }
            }
        }
        // Inatteignable même sans vent : impossible avec des réglages
        // cohérents (les tests le vérifient) — niveau sans vent par sécurité.
        var calme = C.vent.parPalier[0];
        return Object.assign({}, base, {
            vent: { nom: calme.nom, valeur: 0, dx: 0, dy: 0 }
        });
    }

    return {
        niveau: niveau,
        viseeRequise: viseeRequise,
        atteignable: atteignable
    };
});
