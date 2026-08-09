/*
 * tests/soundPref.test.js — test headless de la préférence son de
 * Similitude (spec 728 §7 — Réglages son on/off, préférence LOCALE hors
 * save cloud, pattern soundPref.js de Waggis).
 *
 * Couvre :
 *   - défaut : son ACTIVÉ (jamais réglé) ;
 *   - bascule : ecrire(false) → lire() === false (persisté localStorage) ;
 *   - rechargement : la préférence survit (relue depuis le stockage) ;
 *   - appliquer() : mute le SoundManager global de la scène ;
 *   - stockage indisponible : repli silencieux sur « son on ».
 *
 * Lancement : node tests/soundPref.test.js
 *             (depuis public/games/similitude/v1)
 */
"use strict";

const assert = require("assert");

// --- localStorage simulé (mémoire, comme core/save.js en test) -------------
const memoire = {};
global.window = {
    localStorage: {
        getItem: (k) => (k in memoire ? memoire[k] : null),
        setItem: (k, v) => { memoire[k] = String(v); },
        removeItem: (k) => { delete memoire[k]; }
    }
};

const Sound = require("../soundPref.js");

// --- 1. Jamais réglé : son ACTIVÉ (défaut) ---------------------------------
assert.strictEqual(Sound.lire(), true, "défaut : son activé");

// --- 2. Bascule + persistance locale ---------------------------------------
Sound.ecrire(false);
assert.strictEqual(Sound.lire(), false, "après ecrire(false) : coupé");
Sound.ecrire(true);
assert.strictEqual(Sound.lire(), true, "après ecrire(true) : activé");
assert.strictEqual(memoire[Sound.CLE], "1", "persisté en localStorage ('1')");

// --- 3. Rechargement : la préférence survit (même clé socle arcade:...) ----
Sound.ecrire(false);
// Simule un rechargement de page : purge du cache require pour que le
// module soit réévalué avec le MÊME localStorage (persistance réelle).
delete require.cache[require.resolve("../soundPref.js")];
const Sound2 = require("../soundPref.js");   // rechargé « comme après un F5 »
assert.strictEqual(Sound2.lire(), false, "préférence conservée au rechargement");
assert.ok(Sound.CLE.startsWith("arcade:"), "clé au format socle 'arcade:...'");

// --- 4. appliquer() : mute le SoundManager global --------------------------
let muteApplique = null;
Sound.appliquer({ sound: { set mute(v) { muteApplique = v; } } });
assert.strictEqual(muteApplique, true, "son coupé → sound.mute = true");
Sound.ecrire(true);
Sound.appliquer({ sound: { set mute(v) { muteApplique = v; } } });
assert.strictEqual(muteApplique, false, "son activé → sound.mute = false");

// --- 5. Stockage indisponible : repli silencieux sur « son on » ------------
global.window.localStorage = null;
assert.strictEqual(Sound.lire(), true, "stockage absent : son on (jamais de crash)");
assert.doesNotThrow(() => Sound.ecrire(false), "ecrire sans stockage : silencieux");

console.log("soundPref.test.js : 8 assertions OK");
