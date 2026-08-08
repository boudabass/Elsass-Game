/*
 * tests/grille.test.js — test headless de Grille.js (spec 473 §9).
 *
 * Aucun navigateur, aucun Phaser : on importe Grille.js en Node et on vérifie
 * la règle du tirage initial (spec §4) — 30 items posés sur 81 cases parmi
 * les 6 types, avec GARANTIE d'aucun alignement ≥ 3 en ligne ou en colonne.
 *
 * Lancement : node tests/grille.test.js   (depuis public/games/similitude/v1)
 */
"use strict";

const assert = require("assert");
const Grille = require("../Grille.js");

// Config minimale = celle de la spec (config.js du jeu, mêmes valeurs).
const CFG = { grilleTaille: 9, typesItems: 6 };
const NB_ITEMS = 30;
const TIRAGES = 200;          // on répète pour couvrir l'aléa du tirage

function compterAlignements(grille) {
    return grille.detecterAlignements().length;
}

// --- 1. Tirage initial : 30 items, zéro alignement ≥ 3 --------------------
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

// --- 2. La grille démarre vide --------------------------------------------
const vide = new Grille(CFG);
assert.strictEqual(vide.compterItems(), 0, "grille neuve : 0 item");
assert.strictEqual(compterAlignements(vide), 0, "grille neuve : aucun alignement");

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

// --- 4. Cas limites --------------------------------------------------------
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

console.log(`✔ Grille.js : ${TIRAGES} tirages initiaux OK (${NB_ITEMS} items, 0 alignement ≥ 3)`);
console.log("✔ Détection d'alignements : ligne, colonne, 4 à la suite, cas limites OK");
