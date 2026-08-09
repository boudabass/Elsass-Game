/*
 * tests/profil.test.js — test headless du profil persistant de Similitude
 * (spec 728 §4, §8).
 *
 * Couvre :
 *   - contrat de save v1 : Profil.creer() / Profil.assainir() (wallet
 *     entier ≥ 0, quantités entières ≥ 0, joker inconnu ignoré) ;
 *   - économie : gain de fin de partie = 1 pièce par tranche de
 *     pointsParPiece points (arrondi à l'inférieur) + primeRecordPieces
 *     de prime si la partie bat le record personnel — valeurs TOUJOURS
 *     calculées depuis CFG.economie (spec 728 §10), jamais en dur ;
 *   - persistance : les pièces survivent à un rechargement — le VRAI
 *     core/save.js est chargé avec un localStorage simulé, la save est
 *     écrite en fin de partie puis relue comme après un rechargement ;
 *   - contrat « la copie la plus récente gagne » (local vs cloud).
 *
 * Lancement : node tests/profil.test.js   (depuis public/games/similitude/v1)
 */
"use strict";

const assert = require("assert");

// --- Charge la vraie config du jeu -----------------------------------------
global.window = global;
require("../config.js");
const CFG = global.SimilitudeConfig;
const e = CFG.economie;

const Profil = require("../Profil.js");

// --- 1. Profil neuf : la forme du contrat spec 728 §8 ----------------------
const neuf = Profil.creer(CFG);
assert.strictEqual(neuf.wallet, 0, "profil neuf : 0 pièce");
assert.deepStrictEqual(
    Object.keys(neuf.inventaire).sort(),
    ["foudre", "marteau", "melange", "sablier"],
    "inventaire : les 4 jokers du contrat, à 0"
);
Object.keys(neuf.inventaire).forEach((cle) => {
    assert.strictEqual(neuf.inventaire[cle], 0, `joker ${cle} : 0`);
});

// --- 2. assainir() : entiers ≥ 0, joker inconnu ignoré (spec 728 §8) -------
const propre = Profil.assainir(
    { wallet: 5, inventaire: { marteau: 1, melange: 2, sablier: 3, foudre: 4 } },
    CFG
);
assert.strictEqual(propre.wallet, 5, "wallet conservé tel quel");
assert.strictEqual(propre.inventaire.marteau, 1);
assert.strictEqual(propre.inventaire.melange, 2);
assert.strictEqual(propre.inventaire.sablier, 3);
assert.strictEqual(propre.inventaire.foudre, 4);

assert.strictEqual(
    Profil.assainir({ wallet: -3 }, CFG).wallet, 0,
    "wallet négatif → 0"
);
assert.strictEqual(
    Profil.assainir({ wallet: 3.9 }, CFG).wallet, 3,
    "wallet décimal → tronqué (entier)"
);
assert.strictEqual(
    Profil.assainir({ wallet: "12" }, CFG).wallet, 0,
    "wallet non numérique → 0"
);
assert.strictEqual(
    Profil.assainir({ inventaire: { marteau: -2 } }, CFG).inventaire.marteau, 0,
    "quantité négative → 0"
);
assert.strictEqual(
    Profil.assainir({ inventaire: { melange: 2.7 } }, CFG).inventaire.melange, 2,
    "quantité décimale → tronquée"
);

const inconnu = Profil.assainir({ inventaire: { tornade: 9 } }, CFG);
assert.ok(!("tornade" in inconnu.inventaire), "joker inconnu → ignoré (absent)");
Object.keys(inconnu.inventaire).forEach((cle) => {
    assert.strictEqual(inconnu.inventaire[cle], 0, `joker inconnu : ${cle} reste à 0`);
});

const sansInventaire = Profil.assainir({ wallet: 2 }, CFG);
assert.strictEqual(sansInventaire.inventaire.marteau, 0, "inventaire manquant → 0");

const vide = Profil.assainir(null, CFG);
assert.strictEqual(vide.wallet, 0, "données null → profil par défaut");
const chaine = Profil.assainir("n'importe quoi", CFG);
assert.strictEqual(chaine.wallet, 0, "données non-objet → profil par défaut");

// --- 3. Économie : gain de fin de partie (spec 728 §4) ---------------------
assert.deepStrictEqual(
    Profil.calculerGain(0, false, CFG), { pieces: 0, prime: 0, total: 0 },
    "0 point → 0 pièce"
);
assert.deepStrictEqual(
    Profil.calculerGain(e.pointsParPiece - 1, false, CFG),
    { pieces: 0, prime: 0, total: 0 },
    "sous la tranche → 0 pièce (arrondi à l'inférieur)"
);
assert.deepStrictEqual(
    Profil.calculerGain(e.pointsParPiece, false, CFG),
    { pieces: 1, prime: 0, total: 1 },
    "1 tranche complète → 1 pièce"
);
assert.deepStrictEqual(
    Profil.calculerGain(e.pointsParPiece * 2 + 50, false, CFG),
    { pieces: 2, prime: 0, total: 2 },
    "2 tranches complètes + reste → 2 pièces"
);
// Exemple de la spec §4 : 3700 points → 37 pièces
assert.deepStrictEqual(
    Profil.calculerGain(e.pointsParPiece * 37, false, CFG),
    { pieces: 37, prime: 0, total: 37 },
    "3700 points → 37 pièces (exemple spec 728 §4)"
);

// Prime de record : + primeRecordPieces si la partie bat le record
assert.deepStrictEqual(
    Profil.calculerGain(e.pointsParPiece, true, CFG),
    { pieces: 1, prime: e.primeRecordPieces, total: 1 + e.primeRecordPieces },
    "record battu → prime de record ajoutée"
);

// --- 4. appliquerGain() : le porte-monnaie suit ----------------------------
const porteMonnaie = Profil.creer(CFG);
Profil.appliquerGain(porteMonnaie, { total: 47 });
assert.strictEqual(porteMonnaie.wallet, 47, "gain ajouté au porte-monnaie");
Profil.appliquerGain(porteMonnaie, { total: 0 });
assert.strictEqual(porteMonnaie.wallet, 47, "gain nul → rien ne change");
Profil.appliquerGain(porteMonnaie, { total: -5 });
assert.strictEqual(porteMonnaie.wallet, 47, "gain négatif ignoré (jamais de dette)");

// --- 5. Persistance : les pièces survivent à un rechargement ---------------
// Le VRAI core/save.js est chargé avec un navigateur simulé (localStorage +
// cloud) : le cycle est identique à celui du jeu (configure → load → fin de
// partie → saveLocal → rechargement → load).
const stockage = {};
global.localStorage = {
    getItem: (k) => (k in stockage ? stockage[k] : null),
    setItem: (k, v) => { stockage[k] = String(v); },
    removeItem: (k) => { delete stockage[k]; }
};
let cloudLu = null;   // sauvegarde renvoyée par le "serveur"
global.Arcade = global.Arcade || {};
global.Arcade.Platform = {
    cloud: {
        read: async () => cloudLu,
        write: async () => true,
        writeBeacon: () => true
    }
};
require("../../../core/save.js");

function cabler(etat) {
    Arcade.Save.configure({
        key: "similitude-test",
        version: 1,
        gather: () => etat.profil,
        apply: (data) => { etat.profil = Profil.assainir(data, CFG); }
    });
}

async function main() {
    // 1er lancement : aucune sauvegarde
    let etat = { profil: Profil.creer(CFG) };
    cabler(etat);
    const trouve = await Arcade.Save.load();
    assert.strictEqual(trouve, false, "premier lancement : aucune sauvegarde");
    assert.strictEqual(etat.profil.wallet, 0);

    // Fin de partie : 3700 points + record → 37 pièces + prime de record.
    const gain = Profil.calculerGain(3700, true, CFG);
    assert.strictEqual(gain.total, 37 + e.primeRecordPieces, "gain : 37 + prime");
    Profil.appliquerGain(etat.profil, gain);
    Arcade.Save.saveLocal();   // fin de partie = moment explicite (spec 728 §2)

    // Rechargement : l'état en mémoire est perdu, la save locale reste.
    etat = { profil: Profil.creer(CFG) };
    cabler(etat);
    const trouve2 = await Arcade.Save.load();
    assert.strictEqual(trouve2, true, "sauvegarde trouvée au rechargement");
    assert.strictEqual(
        etat.profil.wallet, 37 + e.primeRecordPieces,
        "les pièces survivent à un rechargement"
    );
    assert.strictEqual(etat.profil.inventaire.marteau, 0, "inventaire intact au rechargement");

    // Lecture d'une sauvegarde corrompue : apply() assainit, rien ne casse.
    stockage["arcade:save:similitude-test"] = JSON.stringify({
        v: 1,
        t: Date.now(),
        data: { wallet: -3, inventaire: { marteau: 2.7, tornade: 9 } }
    });
    etat = { profil: Profil.creer(CFG) };
    cabler(etat);
    await Arcade.Save.load();
    assert.strictEqual(etat.profil.wallet, 0, "wallet négatif assaini à 0 à la lecture");
    assert.strictEqual(etat.profil.inventaire.marteau, 2, "quantité flottante tronquée à la lecture");
    assert.ok(!("tornade" in etat.profil.inventaire), "joker inconnu ignoré à la lecture");

    // « La copie la plus récente gagne » (contrat spec 728 §8) : un cloud
    // plus récent que la locale écrase.
    Arcade.Save.saveLocal();   // la locale est écrite à l'instant T
    cloudLu = { v: 1, t: Date.now() + 10000, data: { wallet: 99, inventaire: {} } };
    etat = { profil: Profil.creer(CFG) };
    cabler(etat);
    await Arcade.Save.load();
    assert.strictEqual(etat.profil.wallet, 99, "la copie la plus récente (cloud) gagne");
}

main().then(() => {
    console.log("✔ Profil : contrat de save v1 (creer / assainir) OK");
    console.log("✔ Économie : gain par tranche de 100 pts + prime de record OK (valeurs config.js)");
    console.log("✔ Persistance : les pièces survivent à un rechargement (core/save.js réel) OK");
    console.log("✔ Copie la plus récente gagne (locale vs cloud) OK");
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
