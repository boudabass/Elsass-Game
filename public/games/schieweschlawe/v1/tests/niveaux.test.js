/*
 * tests/niveaux.test.js — contrôle des 100 niveaux calculés par Niveaux.js
 * (PRD 873 §7, décisions John du 24/09/2026).
 *
 * Vérifie, avec la VRAIE config du jeu :
 *   - les 100 niveaux existent, numérotés 1..100, 10 paliers de 10 ;
 *   - chaque niveau est ATTEIGNABLE (visée requise dans la zone de visée,
 *     vent compris) sur les écrans de référence ;
 *   - dans un palier, la cible s'éloigne ; d'un palier à l'autre, elle
 *     rétrécit et le vent ne faiblit pas en moyenne ;
 *   - un niveau donne toujours le même résultat (déterminisme).
 * Affiche aussi les niveaux dont le vent a dû être adouci.
 *
 * Lancement : node tests/niveaux.test.js   (depuis public/games/schieweschlawe/v1)
 */
"use strict";

const assert = require("assert");

global.window = global;
require("../config.js");
const C = global.SchieweschlaweConfig;
const Niveaux = require("../Niveaux.js");

const total = C.niveaux.total;
const liste = [];
for (let n = 1; n <= total; n++) liste.push(Niveaux.niveau(n, C));

// --- 1. Numérotation et paliers ---------------------------------------------
assert.strictEqual(liste.length, 100, "100 niveaux");
liste.forEach((niv, i) => {
    assert.strictEqual(niv.n, i + 1);
    assert.strictEqual(niv.palier, Math.floor(i / 10) + 1);
    assert.strictEqual(niv.rang, (i % 10) + 1);
});

// --- 2. Atteignabilité sur tous les écrans de référence ---------------------
liste.forEach((niv) => {
    assert.ok(Niveaux.atteignable(niv, C) || niv.vent.valeur === 0,
        "niveau " + niv.n + " atteignable");
    C.vent.ecransReference.forEach((e) => {
        const v = Niveaux.viseeRequise(niv, C, e.w, e.h);
        assert.ok(v.lateral >= 0 && v.lateral <= 100 && v.distance >= 0 && v.distance <= 100,
            "niveau " + niv.n + " visée dans la zone sur " + e.w + "×" + e.h +
            " (" + v.lateral.toFixed(1) + ", " + v.distance.toFixed(1) + ")");
    });
});

// --- 3. Progression ---------------------------------------------------------
for (let p = 1; p <= 10; p++) {
    const palier = liste.filter((niv) => niv.palier === p);
    for (let i = 1; i < palier.length; i++) {
        assert.ok(palier[i].distancePct > palier[i - 1].distancePct,
            "palier " + p + " : la cible s'éloigne");
    }
    if (p > 1) {
        const avant = liste.filter((niv) => niv.palier === p - 1);
        assert.ok(palier[0].rayonPct < avant[0].rayonPct, "palier " + p + " : cible plus petite");
        const moy = (arr) => arr.reduce((s, x) => s + x.vent.valeur, 0) / arr.length;
        assert.ok(moy(palier) >= moy(avant) - 1e-9, "palier " + p + " : vent moyen pas plus faible");
    }
}
assert.ok(liste.slice(0, 10).every((niv) => niv.vent.valeur === 0), "palier 1 sans vent");

// --- 4. Déterminisme --------------------------------------------------------
liste.forEach((niv) => {
    assert.deepStrictEqual(Niveaux.niveau(niv.n, C), niv, "niveau " + niv.n + " stable");
});

// --- Rapport : vents adoucis / cibles recentrées ----------------------------
const adoucis = liste.filter((niv) => niv.vent.valeur < C.vent.parPalier[niv.palier - 1].valeur);
const recentres = liste.filter((niv) => niv.lateralPct === 50 && C.cible.lateralEcartParPalierPct[niv.palier - 1] > 0);
console.log("Vent adouci sur " + adoucis.length + " niveau(x) : " +
    adoucis.map((n) => n.n).join(", "));
console.log("Cible recentrée sur " + recentres.length + " niveau(x) : " +
    recentres.map((n) => n.n).join(", "));
const dirs = { "1,0": 0, "-1,0": 0, "0,-1": 0, "0,1": 0 };
liste.filter((n) => n.vent.valeur > 0).forEach((n) => { dirs[n.vent.dx + "," + n.vent.dy]++; });
console.log("Directions de vent (→ ← ↑ ↓) : " + Object.values(dirs).join(" / "));
console.log("OK — 100 niveaux atteignables.");
