/*
 * tests/grille.test.js — test headless du cœur de jeu de Similitude
 * (spec 473 §9 : Grille.js est une logique pure, testable sans Phaser).
 *
 * Couvre les règles de la spec §2, §3, §4, §5 :
 *   - tirage initial : 30 items, zéro alignement ≥ 3 (règle du re-tirage) ;
 *   - sélection : sélection / désélection / déplacement de sélection, coût
 *     jamais prélevé à la sélection ;
 *   - déplacement : coût en ⚡ prélevé AU DÉPLACEMENT, refus sur case
 *     occupée / origine vide / énergie insuffisante ;
 *   - résolution : croisement ligne/colonne (l'item du croisement n'est
 *     retiré qu'UNE fois), alignement de 6+, combo doublé ;
 *   - coup raté : spawn de 2 nouveaux items sur des cases vides ;
 *   - séquence de fusions enchaînées avec score qui monte.
 *
 * La VRAIE config du jeu (config.js) est chargée : les valeurs attendues
 * sont TOUJOURS calculées depuis le barème de config.js, jamais en dur
 * (spec §10).
 *
 * Lancement : node tests/grille.test.js   (depuis public/games/similitude/v1)
 */
"use strict";

const assert = require("assert");

// --- Charge la vraie config du jeu -----------------------------------------
global.window = global;
require("../config.js");
const CFG = global.SimilitudeConfig;

const Grille = require("../Grille.js");

const NB_ITEMS = CFG.itemsDepart;
const TIRAGES = 200;          // on répète pour couvrir l'aléa du tirage

function compterAlignements(grille) {
    return grille.detecterAlignements().length;
}

// --- 1. Tirage initial : 30 items, zéro alignement ≥ 3 (spec §4) ----------
for (let i = 0; i < TIRAGES; i++) {
    const g = new Grille(CFG);
    const poses = g.tirageInitial(NB_ITEMS);

    assert.strictEqual(
        poses, NB_ITEMS,
        `tirage ${i} : ${poses} items posés au lieu de ${NB_ITEMS}`
    );
    assert.strictEqual(
        g.compterItems(), NB_ITEMS,
        `tirage ${i} : la grille contient ${g.compterItems()} items, attendu ${NB_ITEMS}`
    );
    assert.strictEqual(
        compterAlignements(g), 0,
        `tirage ${i} : alignement ≥ 3 détecté au départ : ` +
        JSON.stringify(g.detecterAlignements())
    );
}

// --- 2. La grille démarre vide ---------------------------------------------
const vide = new Grille(CFG);
assert.strictEqual(vide.compterItems(), 0, "grille neuve : 0 item");
assert.strictEqual(compterAlignements(vide), 0, "grille neuve : aucun alignement");
assert.strictEqual(vide.energie, CFG.energieDepart, "énergie de départ (spec §4)");
assert.strictEqual(vide.temps, CFG.tempsDepart, "chrono de départ (spec §4)");

// --- 3. Détection d'alignement : cas positifs (grilles construites à la main)
const ligne = new Grille(CFG);
ligne.set(4, 2, 0);
ligne.set(4, 3, 0);
ligne.set(4, 4, 0);
assert.strictEqual(
    compterAlignements(ligne), 1,
    "3 identiques en ligne → 1 alignement"
);

const colonne = new Grille(CFG);
colonne.set(1, 7, 3);
colonne.set(2, 7, 3);
colonne.set(3, 7, 3);
assert.strictEqual(
    compterAlignements(colonne), 1,
    "3 identiques en colonne → 1 alignement"
);

// --- 4. Cas limites de détection -------------------------------------------
const deuxSeuls = new Grille(CFG);
deuxSeuls.set(0, 0, 1);
deuxSeuls.set(0, 1, 1);
assert.strictEqual(compterAlignements(deuxSeuls), 0, "2 identiques ≠ alignement");

const quatre = new Grille(CFG);
quatre.set(2, 5, 2);
quatre.set(2, 6, 2);
quatre.set(2, 7, 2);
quatre.set(2, 8, 2);
assert.strictEqual(
    compterAlignements(quatre), 1,
    "4 identiques en ligne → 1 alignement de longueur 4"
);

// peutPlacer : interdire un placement qui compléterait un alignement
const presque = new Grille(CFG);
presque.set(3, 0, 4);
presque.set(3, 1, 4);
assert.strictEqual(
    presque.peutPlacer(3, 2, 4), false,
    "placement qui ferait 3 en ligne → interdit"
);
assert.strictEqual(
    presque.peutPlacer(3, 2, 5), true,
    "placement d'un autre type à la même case → autorisé"
);

// --- 5. Sélection (spec §3) ------------------------------------------------
const sel = new Grille(CFG);
sel.set(2, 2, 3);
sel.set(5, 5, 3);

let r = sel.selectionner(2, 2);
assert.strictEqual(r.changement, "selection", "clic 1 sur un item → sélection");
assert.deepStrictEqual(sel.selection, { l: 2, c: 2 }, "l'item est sélectionné");

r = sel.selectionner(2, 2);
assert.strictEqual(r.changement, "deselection", "re-clic sur le même item → désélection");
assert.strictEqual(sel.selection, null, "plus de sélection");

sel.selectionner(2, 2);
r = sel.selectionner(5, 5);
assert.strictEqual(r.changement, "selection", "clic sur un AUTRE item → la sélection se déplace");
assert.deepStrictEqual(sel.selection, { l: 5, c: 5 }, "la sélection est sur le nouvel item");
assert.strictEqual(sel.get(2, 2), 3, "l'item d'origine n'a pas bougé");
assert.strictEqual(sel.get(5, 5), 3, "l'autre item n'a pas bougé — jamais d'échange");

r = sel.selectionner(0, 0);
assert.strictEqual(r.changement, "vide", "clic sur une case vide → ignoré");
assert.deepStrictEqual(sel.selection, { l: 5, c: 5 }, "la sélection est conservée");

assert.strictEqual(
    sel.energie, CFG.energieDepart,
    "le coût n'est JAMAIS prélevé à la sélection (spec §3)"
);

// --- 6. Déplacement (spec §3) ----------------------------------------------
const dep = new Grille(CFG);
dep.set(1, 1, 0);
dep.set(2, 2, 1);

r = dep.deplacer(1, 1, 1, 5);
assert.strictEqual(r.ok, true, "déplacement vers une case vide → accepté");
assert.strictEqual(dep.get(1, 5), 0, "l'item a bougé vers la case vide");
assert.strictEqual(dep.get(1, 1), null, "la case d'origine est vide");
assert.strictEqual(
    dep.energie, CFG.energieDepart - CFG.energieDeplacement,
    "coût : 1 ⚡ prélevé AU DÉPLACEMENT (spec §3)"
);

r = dep.deplacer(1, 5, 2, 2);
assert.strictEqual(r.ok, false, "déplacement vers une case occupée → refus");
assert.strictEqual(r.raison, "cible-occupee");

r = dep.deplacer(0, 0, 0, 1);
assert.strictEqual(r.ok, false, "déplacement depuis une case vide → refus");
assert.strictEqual(r.raison, "origine-vide");

const sansEnergie = new Grille(CFG);
sansEnergie.set(0, 0, 2);
sansEnergie.energie = 0;
r = sansEnergie.deplacer(0, 0, 0, 1);
assert.strictEqual(r.ok, false, "sans énergie → déplacement refusé");
assert.strictEqual(r.raison, "plus-energie");
assert.strictEqual(sansEnergie.get(0, 0), 2, "l'item n'a pas bougé");

dep.selectionner(2, 2);
r = dep.deplacer(2, 2, 2, 6);
assert.strictEqual(r.ok, true);
assert.strictEqual(dep.selection, null, "le déplacement efface la sélection (fin du tour)");

// --- 7. Résolution : croisement ligne/colonne (spec §3, §5) ----------------
// Ligne (4, 2..4) + colonne (2..4, 3), même type 0 : croisement en (4, 3).
const croix = new Grille(CFG);
[[4, 2], [4, 3], [4, 4], [2, 3], [3, 3]].forEach(([l, c]) => croix.set(l, c, 0));

const resCroix = croix.resoudre();
assert.strictEqual(resCroix.aucun, false, "des alignements ont sauté");
assert.strictEqual(
    resCroix.alignements.length, 2,
    "1 ligne + 1 colonne valides → 2 alignements"
);
assert.strictEqual(
    resCroix.retires.length, 5,
    "l'item du croisement n'est retiré qu'UNE seule fois (5 items, pas 6)"
);
assert.strictEqual(croix.compterItems(), 0, "tous les items des deux alignements ont disparu");
assert.strictEqual(resCroix.combo, true, "2 alignements dans le même coup → combo");

const pts3 = CFG.bareme.points(3);
const en3 = CFG.bareme.energie(3);
const tm3 = CFG.bareme.temps(3);
assert.strictEqual(
    resCroix.gains.score, (pts3 + pts3) * 2,
    "croisement : (30 + 30) × 2 = 120 pts (combo doublé)"
);
assert.strictEqual(resCroix.gains.energie, (en3 + en3) * 2, "énergie doublée");
assert.strictEqual(resCroix.gains.temps, (tm3 + tm3) * 2, "temps doublé");
assert.strictEqual(croix.score, (pts3 + pts3) * 2, "le score de la partie est à jour");

// --- 8. Résolution : alignement de 6+ (spec §5) ----------------------------
const six = new Grille(CFG);
for (let c = 0; c < 6; c++) six.set(1, c, 2);
const resSix = six.resoudre();
assert.strictEqual(resSix.alignements.length, 1, "6 identiques → 1 seul alignement");
assert.strictEqual(resSix.alignements[0].longueur, 6);
assert.strictEqual(resSix.combo, false, "1 seul alignement → pas de combo");
assert.strictEqual(resSix.gains.score, CFG.bareme.points(6), "10×6×(6−2) = 240 pts");
assert.strictEqual(resSix.gains.energie, CFG.bareme.energie(6), "+(6−1) ⚡");
assert.strictEqual(resSix.gains.temps, CFG.bareme.temps(6), "+6 s");

const sept = new Grille(CFG);
for (let c = 0; c < 7; c++) sept.set(3, c, 4);
const resSept = sept.resoudre();
assert.strictEqual(resSept.alignements[0].longueur, 7, "7 identiques → longueur 7");
assert.strictEqual(resSept.gains.score, CFG.bareme.points(7), "formule 10×n×(n−2) pour 6+");

// --- 9. Résolution : combo double (2 alignements distincts, même coup) -----
const combo = new Grille(CFG);
[[0, 0], [0, 1], [0, 2]].forEach(([l, c]) => combo.set(l, c, 0));   // ligne 0
[[8, 0], [8, 1], [8, 2]].forEach(([l, c]) => combo.set(l, c, 1));   // ligne 8

const resCombo = combo.resoudre();
assert.strictEqual(resCombo.alignements.length, 2, "2 alignements détectés");
assert.strictEqual(resCombo.combo, true, "combo déclenché");
assert.strictEqual(resCombo.gains.score, (pts3 + pts3) * 2, "total doublé (score)");
assert.strictEqual(resCombo.gains.energie, (en3 + en3) * 2, "total doublé (énergie)");
assert.strictEqual(resCombo.gains.temps, (tm3 + tm3) * 2, "total doublé (temps)");
assert.strictEqual(combo.score, (pts3 + pts3) * 2, "score de la partie à jour");
assert.strictEqual(combo.compterItems(), 0, "les 6 items ont disparu");

// --- 10. Coup raté : spawn de 2 nouveaux items (spec §3) -------------------
const rate = new Grille(CFG);
rate.set(0, 0, 3);
rate.set(0, 1, 4);
rate.set(8, 8, 3);

r = rate.deplacer(0, 0, 0, 7);   // (0,7)=3 : aucun voisin identique → coup raté
assert.strictEqual(r.ok, true);
const resRate = rate.resoudre();
assert.strictEqual(resRate.aucun, true, "rien n'a sauté → coup raté");
assert.strictEqual(resRate.gains.score, 0, "aucun gain");
assert.strictEqual(rate.score, 0, "le score reste à zéro");

// Cases vides avant le spawn
const videsAvant = new Set();
for (let l = 0; l < CFG.grilleTaille; l++) {
    for (let c = 0; c < CFG.grilleTaille; c++) {
        if (rate.get(l, c) === null) videsAvant.add(l + "," + c);
    }
}
const avantSpawn = rate.compterItems();
const poses = rate.spawner(CFG.itemsParCoupRate);
assert.strictEqual(poses.length, CFG.itemsParCoupRate, "2 items posés");
assert.strictEqual(
    rate.compterItems(), avantSpawn + CFG.itemsParCoupRate,
    "la grille contient 2 items de plus"
);
poses.forEach((p) => {
    assert.ok(videsAvant.has(p.l + "," + p.c), `posé sur une case vide (${p.l},${p.c})`);
    assert.notStrictEqual(rate.get(p.l, p.c), null, "la case contient bien un item");
});

// --- 11. Grille pleine : aucune case vide (spec §6, fin de partie) ---------
const pleine = new Grille(CFG);
for (let l = 0; l < CFG.grilleTaille; l++) {
    for (let c = 0; c < CFG.grilleTaille; c++) {
        pleine.set(l, c, (l + c) % CFG.typesItems);
    }
}
assert.strictEqual(
    pleine.estPleine(), true,
    "81 cases remplies → grille saturée (fin « Grille pleine »)"
);
const presquePleine = new Grille(CFG);
for (let l = 0; l < CFG.grilleTaille; l++) {
    for (let c = 0; c < CFG.grilleTaille; c++) {
        if (l === 4 && c === 4) continue;   // une seule case vide
        presquePleine.set(l, c, (l + c) % CFG.typesItems);
    }
}
assert.strictEqual(
    presquePleine.estPleine(), false,
    "une case vide suffit pour que la partie continue"
);
const neuve = new Grille(CFG);
assert.strictEqual(neuve.estPleine(), false, "grille neuve : pas saturée");

// --- 12. Séquence de fusions enchaînées : le score monte (spec §3, §5) -----
const seq = new Grille(CFG);

// Fusion 1 : on assemble une ligne (3, 0..2) en déplaçant un item.
seq.set(3, 1, 0);
seq.set(3, 2, 0);
seq.set(8, 8, 0);
r = seq.deplacer(8, 8, 3, 0);
assert.strictEqual(r.ok, true);
let resSeq = seq.resoudre();
assert.strictEqual(resSeq.aucun, false);
assert.strictEqual(seq.score, CFG.bareme.points(3), "1re fusion : 30 pts");
assert.strictEqual(seq.compterItems(), 0, "fusion réussie → AUCUN nouvel item (récompense)");

// Fusion 2 : une autre ligne (5, 0..2).
seq.set(5, 1, 1);
seq.set(5, 2, 1);
seq.set(0, 8, 1);
r = seq.deplacer(0, 8, 5, 0);
assert.strictEqual(r.ok, true);
resSeq = seq.resoudre();
assert.strictEqual(
    seq.score, CFG.bareme.points(3) * 2,
    "2e fusion : le score monte (60 pts)"
);
assert.strictEqual(seq.compterItems(), 0, "toujours aucun spawn après une fusion");

// Fusion 3 : une colonne (2..4, 4).
seq.set(2, 4, 2);
seq.set(3, 4, 2);
seq.set(0, 0, 2);
r = seq.deplacer(0, 0, 4, 4);
assert.strictEqual(r.ok, true);
resSeq = seq.resoudre();
assert.strictEqual(
    seq.score, CFG.bareme.points(3) * 3,
    "3e fusion : le score monte encore (90 pts)"
);
assert.strictEqual(seq.compterItems(), 0, "grille vide : tout a fusionné");

// Bilan énergie / temps : 3 déplacements (−1 ⚡ chacun), 3 fusions de 3
// (+2 ⚡ / +3 s chacune, spec §5).
assert.strictEqual(
    seq.energie,
    CFG.energieDepart - CFG.energieDeplacement * 3 + CFG.bareme.energie(3) * 3,
    "énergie : 25 − 3 + 6 = 28 ⚡"
);
assert.strictEqual(
    seq.temps,
    CFG.tempsDepart + CFG.bareme.temps(3) * 3,
    "temps : 120 + 9 = 129 s"
);

console.log(`✔ Grille.js : ${TIRAGES} tirages initiaux OK (${NB_ITEMS} items, 0 alignement ≥ 3)`);
console.log("✔ Sélection : sélection / désélection / déplacement de sélection, coût zéro OK");
console.log("✔ Déplacement : coût ⚡ au déplacement, refus cible occupée / origine vide / sans énergie OK");
console.log("✔ Résolution : croisement ligne/colonne (5 items retirés, combo doublé), alignement 6+, combo OK");
console.log("✔ Coup raté : spawn de 2 items sur cases vides OK");
console.log("✔ Séquence de 3 fusions enchaînées : score 30 → 60 → 90, énergie/temps cumulés OK");
