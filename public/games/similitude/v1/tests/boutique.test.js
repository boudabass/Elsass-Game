/*
 * tests/boutique.test.js — test headless de la Boutique + Inventaire de
 * Similitude (spec 728 §5, §6 — SIM-8).
 *
 * Couvre :
 *   - achat possible (Profil.acheter) : wallet déduit du PRIX EXACT
 *     (config.boutique.prix — jamais en dur), inventaire incrémenté de 1,
 *     rachetable à l'infini ;
 *   - achat impossible : JAMAIS d'échec en silence — {ok:false,
 *     raison:"pas_assez"} et RIEN ne bouge (spec 728 §5) ;
 *   - joker inconnu / sans prix : refus propre (raison:"inconnu") ;
 *   - la BOUCLE COMPLÈTE (fini-quand n°5) : gagner des pièces (SIM-5) →
 *     acheter un joker (cette carte) → le retrouver dans l'inventaire
 *     après un rechargement — persistance RÉELLE via core/save.js
 *     (local + cloud), le VRAI cycle du jeu.
 *
 * Lancement : node tests/boutique.test.js   (depuis public/games/similitude/v1)
 */
"use strict";

const assert = require("assert");

// --- Charge la vraie config du jeu -----------------------------------------
global.window = global;
require("../config.js");
const CFG = global.SimilitudeConfig;
const PRIX = CFG.boutique.prix;

const Profil = require("../Profil.js");

// --- 1. Prix de départ dans config.js (spec 728 §5) ------------------------
assert.strictEqual(PRIX.marteau, 30, "Marteau : 30 pièces");
assert.strictEqual(PRIX.melange, 40, "Mélange : 40 pièces");
assert.strictEqual(PRIX.sablier, 60, "Sablier : 60 pièces");
assert.strictEqual(PRIX.foudre, 60, "Foudre : 60 pièces");

// --- 2. Achat possible : wallet déduit, inventaire incrémenté --------------
const profil = Profil.creer(CFG);
profil.wallet = 100;

const res = Profil.acheter(profil, "marteau", CFG);
assert.deepStrictEqual(res, { ok: true }, "achat possible : {ok:true}");
assert.strictEqual(profil.wallet, 100 - PRIX.marteau,
    "wallet déduit du prix exact (config)");
assert.strictEqual(profil.inventaire.marteau, 1, "inventaire incrémenté de 1");
assert.strictEqual(profil.inventaire.melange, 0, "les autres jokers ne bougent pas");

// Rachetable à l'infini (spec 728 §5) : pas de plafond, rachat à l'unité.
const res2 = Profil.acheter(profil, "marteau", CFG);
assert.deepStrictEqual(res2, { ok: true }, "rachat à l'infini : ok");
assert.strictEqual(profil.inventaire.marteau, 2, "quantité cumulée : 2 marteaux");
assert.strictEqual(profil.wallet, 100 - 2 * PRIX.marteau, "wallet déduit à chaque achat");

// --- 3. Achat impossible : refus propre, RIEN ne bouge (spec 728 §5) -------
const pauvre = Profil.creer(CFG);
pauvre.wallet = PRIX.marteau - 1;   // 29 pièces, marteau à 30
const refus = Profil.acheter(pauvre, "marteau", CFG);
assert.strictEqual(refus.ok, false, "pièces manquantes : ok=false");
assert.strictEqual(refus.raison, "pas_assez", "raison : pas_assez (jamais en silence)");
assert.strictEqual(pauvre.wallet, PRIX.marteau - 1, "wallet intact");
assert.strictEqual(pauvre.inventaire.marteau, 0, "inventaire intact");

// Juste assez → ça passe (limite exacte incluse).
const juste = Profil.creer(CFG);
juste.wallet = PRIX.melange;   // 40 pièces, mélange à 40
assert.deepStrictEqual(Profil.acheter(juste, "melange", CFG), { ok: true },
    "wallet = prix exact : achat possible");
assert.strictEqual(juste.wallet, 0, "wallet à 0 après l'achat");

// --- 4. Joker inconnu / sans prix : refus propre ---------------------------
const ok = Profil.creer(CFG);
ok.wallet = 500;
assert.deepStrictEqual(Profil.acheter(ok, "tornade", CFG),
    { ok: false, raison: "inconnu" }, "joker inconnu → inconnu (ignoré, wallet intact)");
assert.strictEqual(ok.wallet, 500, "wallet intact après joker inconnu");

const sansPrix = Profil.creer(CFG);
sansPrix.wallet = 500;
assert.deepStrictEqual(Profil.acheter(sansPrix, "marteau",
    { jokers: CFG.jokers, boutique: { prix: {} } }),
    { ok: false, raison: "inconnu" }, "joker sans prix → inconnu (refus propre)");

// --- 5. La BOUCLE COMPLÈTE : gagner → acheter → retrouver en inventaire ----
// Le VRAI core/save.js est chargé avec un navigateur simulé (localStorage +
// cloud) : le cycle est identique à celui du jeu (configure → load → gain →
// achat → saveLocal+saveCloud → rechargement → load).
const stockage = {};
global.localStorage = {
    getItem: (k) => (k in stockage ? stockage[k] : null),
    setItem: (k, v) => { stockage[k] = String(v); },
    removeItem: (k) => { delete stockage[k]; }
};
let cloudLu = null;
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
        key: "similitude-test-boutique",
        version: 1,
        gather: () => etat.profil,
        apply: (data) => { etat.profil = Profil.assainir(data, CFG); }
    });
}

async function main() {
    let etat = { profil: Profil.creer(CFG) };
    cabler(etat);
    await Arcade.Save.load();

    // 1) GAGNER des pièces (SIM-5) : 3700 points + record → 37 + prime.
    const gain = Profil.calculerGain(3700, true, CFG);
    Profil.appliquerGain(etat.profil, gain);
    Arcade.Save.saveLocal();   // fin de partie (spec 728 §2)
    assert.ok(etat.profil.wallet >= PRIX.marteau, "assez de pièces pour un marteau");

    // 2) ACHETER un joker (cette carte) : déduction + inventaire + save
    // IMMÉDIATE local + cloud (spec 728 §5 — action explicite du joueur).
    const avant = etat.profil.wallet;
    assert.deepStrictEqual(Profil.acheter(etat.profil, "marteau", CFG), { ok: true });
    assert.strictEqual(etat.profil.wallet, avant - PRIX.marteau, "wallet déduit");
    assert.strictEqual(etat.profil.inventaire.marteau, 1, "inventaire incrémenté");
    Arcade.Save.saveLocal();
    await Arcade.Save.saveCloud();

    // 3) RETROUVER le joker dans l'inventaire après un rechargement
    // (SIM-8 fini-quand n°5) : l'état en mémoire est perdu, la save reste.
    etat = { profil: Profil.creer(CFG) };
    cabler(etat);
    const trouve = await Arcade.Save.load();
    assert.strictEqual(trouve, true, "sauvegarde trouvée au rechargement");
    assert.strictEqual(etat.profil.wallet, avant - PRIX.marteau,
        "le wallet déduit survit au rechargement");
    assert.strictEqual(etat.profil.inventaire.marteau, 1,
        "le joker acheté est bien dans l'inventaire (boucle complète)");

    // 4) L'inventaire est un écran de CONSULTATION (spec 728 §6) : rien à
    // utiliser ici — vérifié par le fait qu'aucune fonction de Profil ne
    // consomme un joker (la consommation est en partie, SIM-6).
    const clesProfil = Object.keys(Profil);
    assert.ok(clesProfil.includes("acheter"), "Profil.acheter exposé (boutique)");
    assert.ok(!clesProfil.some((c) => /consommer|utiliser/.test(c)),
        "aucune consommation de joker hors partie (consultation pure)");
}

main().then(() => {
    console.log("✔ Boutique : prix config.js (30/40/60/60) OK");
    console.log("✔ Achat : wallet déduit du prix exact + inventaire incrémenté, rachetable à l'infini OK");
    console.log("✔ Refus propre : pièces manquantes → {ok:false, raison:'pas_assez'}, rien ne bouge OK");
    console.log("✔ Joker inconnu / sans prix → refus propre (raison:'inconnu') OK");
    console.log("✔ Boucle complète : gagner → acheter → retrouver en inventaire au rechargement OK");
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
