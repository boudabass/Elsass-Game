/*
 * tests/jokers.test.js — test headless des jokers EN PARTIE (spec 728 §3,
 * carte SIM-6). Grille.js est une logique pure, testable sans navigateur
 * (spec 473 §9) : c'est ici que la QA vérifie les effets sans browser.
 *
 * Couvre :
 *   - Marteau : supprime l'item cliqué, 0 point, 0 ⚡ dépensé, sélection
 *     non consommée ; décompté UNIQUEMENT quand un item est réellement
 *     retiré (clic dans le vide : rien ne se passe, reste armé) ;
 *   - armement / désarmement : re-clic = désarme, RIEN n'est consommé ;
 *   - Mélange : redistribue TOUS les items (le nombre ne change pas), les
 *     alignements formés sont résolus à 0 point — ni ⚡, ni temps, NI
 *     joker (règle d'or) ;
 *   - Sablier : +sablierSecondes s au chrono ; Foudre : +foudreEnergie ⚡ ;
 *   - RÈGLE D'OR : aucun joker ne fait jamais monter le score par lui-même ;
 *   - un alignement de seuilJokerAlignement (5+) offre 1 joker tiré au
 *     hasard, ajouté immédiatement à la barre de la partie (3 ou 4 → aucun) ;
 *   - quantité 0 → refus (l'icône est grisée en jeu).
 *
 * La VRAIE config du jeu (config.js) est chargée : les valeurs attendues
 * sont TOUJOURS calculées depuis config.js, jamais en dur (spec §10).
 *
 * Lancement : node tests/jokers.test.js   (depuis public/games/similitude/v1)
 */
"use strict";

const assert = require("assert");

// --- Charge la vraie config du jeu -----------------------------------------
global.window = global;
require("../config.js");
const CFG = global.SimilitudeConfig;

const Grille = require("../Grille.js");

const EFFETS = CFG.effetsJokers;
assert.ok(EFFETS, "config.js doit exposer effetsJokers (spec 728 §3)");

// --- 1. Marteau : supprime l'item, 0 point, 0 ⚡, consommé à l'application --
{
    const g = new Grille(CFG);
    g.set(2, 3, 1);
    g.initialiserJokers({ marteau: 2, melange: 0, sablier: 0, foudre: 0 });
    const scoreAvant = g.score;
    const energieAvant = g.energie;

    // Armement : rien n'est consommé.
    const r = g.armerJoker("marteau");
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.applique, false);
    assert.strictEqual(r.arme, "marteau");
    assert.strictEqual(g.jokerArme, "marteau");
    assert.strictEqual(g.quantiteJoker("marteau"), 2, "l'armement ne consomme rien");

    // Application sur l'item : suppression + décompte.
    const a = g.appliquerMarteau(2, 3);
    assert.strictEqual(a.ok, true);
    assert.strictEqual(g.get(2, 3), null, "le marteau supprime l'item");
    assert.strictEqual(g.quantiteJoker("marteau"), 1, "décompté à l'application");
    assert.strictEqual(g.jokerArme, null, "désarmé après application");
    assert.strictEqual(g.score, scoreAvant, "règle d'or : le marteau ne rapporte AUCUN point");
    assert.strictEqual(g.energie, energieAvant, "le marteau ne coûte pas d'énergie");
    assert.strictEqual(g.temps, CFG.tempsDepart, "le marteau ne donne pas de temps");
}

// --- 2. Marteau sur une case vide : rien n'est consommé, reste armé --------
{
    const g = new Grille(CFG);
    g.set(0, 0, 2);
    g.initialiserJokers({ marteau: 1 });
    g.armerJoker("marteau");

    const a = g.appliquerMarteau(5, 5);   // case vide
    assert.strictEqual(a.ok, false);
    assert.strictEqual(a.raison, "case-vide");
    assert.strictEqual(g.quantiteJoker("marteau"), 1, "clic dans le vide : rien consommé");
    assert.strictEqual(g.jokerArme, "marteau", "le marteau reste armé");
    assert.strictEqual(g.get(0, 0), 2, "aucun item supprimé");
}

// --- 3. Marteau non armé : refus -------------------------------------------------
{
    const g = new Grille(CFG);
    g.set(0, 0, 2);
    g.initialiserJokers({ marteau: 1 });
    const a = g.appliquerMarteau(0, 0);
    assert.strictEqual(a.ok, false);
    assert.strictEqual(a.raison, "non-arme");
    assert.strictEqual(g.get(0, 0), 2);
    assert.strictEqual(g.quantiteJoker("marteau"), 1);
}

// --- 4. Désarmement : re-clic, rien n'est consommé --------------------------
{
    const g = new Grille(CFG);
    g.initialiserJokers({ marteau: 1 });
    g.armerJoker("marteau");

    const r = g.armerJoker("marteau");   // re-clic sur l'icône
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.applique, false);
    assert.strictEqual(r.arme, null);
    assert.strictEqual(g.jokerArme, null, "désarmé");
    assert.strictEqual(g.quantiteJoker("marteau"), 1, "rien n'est consommé au désarmement");
}

// --- 5. Marteau : la sélection n'est pas consommée (pas un déplacement) ------
{
    const g = new Grille(CFG);
    g.set(1, 1, 0);
    g.set(3, 3, 1);
    g.initialiserJokers({ marteau: 1 });
    g.selectionner(1, 1);
    g.armerJoker("marteau");
    g.appliquerMarteau(3, 3);   // frappe ailleurs que l'item sélectionné
    assert.deepStrictEqual(
        g.selection, { l: 1, c: 1 },
        "utiliser un joker ne compte pas comme un déplacement (sélection conservée)"
    );
}
{
    // Si le marteau frappe l'item SÉLECTIONNÉ, la sélection est effacée
    // proprement (elle ne doit pas rester sur une case vide).
    const g = new Grille(CFG);
    g.set(1, 1, 0);
    g.initialiserJokers({ marteau: 1 });
    g.selectionner(1, 1);
    g.armerJoker("marteau");
    g.appliquerMarteau(1, 1);
    assert.strictEqual(g.selection, null, "sélection effacée si l'item sélectionné est retiré");
}

// --- 6. Sablier : +sablierSecondes s, 0 point -------------------------------
{
    const g = new Grille(CFG);
    g.initialiserJokers({ sablier: 2 });
    const scoreAvant = g.score;
    const tempsAvant = g.temps;
    const energieAvant = g.energie;

    const r = g.armerJoker("sablier");   // effet immédiat
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.applique, true);
    assert.strictEqual(g.temps, tempsAvant + EFFETS.sablierSecondes, "+sablierSecondes s au chrono");
    assert.strictEqual(g.quantiteJoker("sablier"), 1, "décompté à l'application");
    assert.strictEqual(g.score, scoreAvant, "règle d'or : le sablier ne rapporte AUCUN point");
    assert.strictEqual(g.energie, energieAvant, "le sablier ne coûte pas d'énergie");
}

// --- 7. Foudre : +foudreEnergie ⚡, 0 point ----------------------------------
{
    const g = new Grille(CFG);
    g.initialiserJokers({ foudre: 3 });
    const scoreAvant = g.score;
    const energieAvant = g.energie;

    const r = g.armerJoker("foudre");   // effet immédiat
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.applique, true);
    assert.strictEqual(g.energie, energieAvant + EFFETS.foudreEnergie, "+foudreEnergie ⚡");
    assert.strictEqual(g.quantiteJoker("foudre"), 2, "décompté à l'application");
    assert.strictEqual(g.score, scoreAvant, "règle d'or : la foudre ne rapporte AUCUN point");
}

// --- 8. Quantité 0 : refus (icône grisée en jeu) ----------------------------
{
    const g = new Grille(CFG);
    const r = g.armerJoker("sablier");
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.raison, "aucun-joker");
    assert.strictEqual(g.temps, CFG.tempsDepart, "rien ne s'est passé");
    assert.strictEqual(g.energie, CFG.energieDepart);
    assert.strictEqual(g.score, 0);

    const m = g.armerJoker("marteau");
    assert.strictEqual(m.ok, false, "on ne peut pas armer un marteau qu'on n'a pas");
    assert.strictEqual(g.jokerArme, null);
}

// --- 9. Mélange : redistribution + résolution à 0 (règle d'or) --------------
// Grille UN SEUL type partout : après la redistribution (permutation), tous
// les items restent identiques → un alignement géant se forme → TOUT est
// résolu à 0. Déterministe : score inchangé, aucune énergie/temps gagné,
// aucun joker offert (même avec un alignement ≥ 5).
{
    const g = new Grille(CFG);
    for (let l = 0; l < g.taille; l++) {
        for (let c = 0; c < g.taille; c++) g.set(l, c, 0);
    }
    const nbAvant = g.compterItems();   // 81
    g.initialiserJokers({ melange: 1 });
    const scoreAvant = g.score;
    const energieAvant = g.energie;
    const tempsAvant = g.temps;

    const r = g.appliquerMelange();
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.items, nbAvant, "le mélange redistribue TOUS les items (même nombre)");
    assert.strictEqual(g.compterItems(), 0, "les alignements formés par le mélange sont résolus");
    assert.strictEqual(g.score, scoreAvant, "règle d'or : la fusion mécanique rapporte 0 point");
    assert.strictEqual(g.energie, energieAvant, "0 ⚡ gagné par le mélange");
    assert.strictEqual(g.temps, tempsAvant, "0 s gagné par le mélange");
    assert.strictEqual(g.quantiteJoker("melange"), 0, "le mélange est consommé à l'application");
    CFG.jokers.forEach((j) => {
        assert.strictEqual(g.quantiteJoker(j.cle), 0, "le mélange n'offre JAMAIS de joker (règle d'or)");
    });
}

// --- 10. Mélange via l'armement (effet immédiat) -----------------------------
{
    const g = new Grille(CFG);
    for (let l = 0; l < g.taille; l++) {
        for (let c = 0; c < g.taille; c++) g.set(l, c, 1);
    }
    g.initialiserJokers({ melange: 1 });
    const scoreAvant = g.score;

    const r = g.armerJoker("melange");   // clic sur l'icône = effet immédiat
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.applique, true);
    assert.strictEqual(g.score, scoreAvant);
    assert.strictEqual(g.quantiteJoker("melange"), 0);
    assert.strictEqual(g.jokerArme, null);
}

// --- 11. Mélange : invariant du nombre d'items sur grilles aléatoires -------
{
    for (let i = 0; i < 50; i++) {
        const g = new Grille(CFG);
        g.tirageInitial(CFG.itemsDepart);
        const nbAvant = g.compterItems();
        const scoreAvant = g.score;
        g.initialiserJokers({ melange: 1 });

        const r = g.appliquerMelange();
        assert.strictEqual(r.ok, true);
        assert.strictEqual(r.items, nbAvant, `mélange ${i} : même nombre d'items redistribués`);
        assert.ok(
            g.compterItems() <= nbAvant,
            `mélange ${i} : la résolution mécanique ne peut que retirer des items`
        );
        assert.strictEqual(g.score, scoreAvant, `mélange ${i} : 0 point (règle d'or)`);
        CFG.jokers.forEach((j) => {
            assert.strictEqual(g.quantiteJoker(j.cle), 0, `mélange ${i} : aucun joker offert`);
        });
    }
}

// --- 12. Alignement de 5+ → 1 joker aléatoire ajouté à la barre --------------
{
    // Un alignement horizontal de 5 (le seuil de config.js) : les points du
    // barème tombent (l'alignement est construit par le joueur) ET 1 joker
    // est offert en récompense — ajouté immédiatement à la barre de partie.
    const g = new Grille(CFG);
    for (let c = 0; c < 5; c++) g.set(0, c, 3);
    g.set(2, 0, 0);   // un item isolé, loin de l'alignement
    const scoreAvant = g.score;

    const res = g.resoudre();
    assert.strictEqual(res.aucun, false);
    assert.ok(res.jokerGagne !== null, "un alignement de 5+ doit offrir 1 joker");
    assert.ok(
        CFG.jokers.some((j) => j.cle === res.jokerGagne),
        "le joker gagné est l'un des jokers connus"
    );
    assert.strictEqual(g.quantiteJoker(res.jokerGagne), 1, "ajouté immédiatement à la barre");
    assert.ok(g.score > scoreAvant, "l'alignement du joueur rapporte quand même ses points");
    assert.strictEqual(g.get(0, 0), null, "l'alignement est résolu");
}

// --- 13. Alignement de 3 ou 4 : AUCUN joker ----------------------------------
{
    const g = new Grille(CFG);
    for (let c = 0; c < 4; c++) g.set(0, c, 3);
    const res4 = g.resoudre();
    assert.strictEqual(res4.jokerGagne, null, "un alignement de 4 n'offre AUCUN joker");
}
{
    const g = new Grille(CFG);
    for (let c = 0; c < 3; c++) g.set(0, c, 3);
    const res3 = g.resoudre();
    assert.strictEqual(res3.jokerGagne, null, "un alignement de 3 n'offre AUCUN joker");
}

// --- 14. initialiserJokers : l'inventaire du profil emplit la barre ----------
{
    const g = new Grille(CFG);
    g.initialiserJokers({ marteau: 3, sablier: 1, foudre: 2.9, inconnu: 99 });
    assert.strictEqual(g.quantiteJoker("marteau"), 3);
    assert.strictEqual(g.quantiteJoker("sablier"), 1);
    assert.strictEqual(g.quantiteJoker("foudre"), 2, "entier tronqué, jamais de décimal");
    assert.strictEqual(g.quantiteJoker("melange"), 0, "joker absent de l'inventaire → 0");
    assert.ok(!("inconnu" in g.jokers), "un joker inconnu est ignoré");
}
{
    const g = new Grille(CFG);
    g.initialiserJokers(null);
    g.initialiserJokers("n'importe quoi");
    assert.strictEqual(g.quantiteJoker("marteau"), 0, "inventaire invalide → barre à 0");
}

// --- 15. La barre de jokers n'interfère pas avec le gameplay normal ----------
{
    const g = new Grille(CFG);
    g.initialiserJokers({ marteau: 1, melange: 1, sablier: 1, foudre: 1 });
    g.set(4, 4, 0);
    g.set(4, 5, 0);
    g.set(4, 6, 0);   // alignement de 3
    const scoreAvant = g.score;

    const res = g.resoudre();   // coup normal, pas de joker utilisé
    assert.strictEqual(res.aucun, false);
    assert.strictEqual(res.jokerGagne, null, "alignement de 3 : pas de joker offert");
    assert.ok(g.score > scoreAvant, "les points normaux tombent");
    assert.strictEqual(g.quantiteJoker("marteau"), 1, "les jokers de la barre ne sont pas consommés par un coup normal");
}

console.log("jokers.test.js : tous les tests passent ✓");
