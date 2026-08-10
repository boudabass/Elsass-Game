/*
 * soundPref.js — préférence son de Similitude (écran Réglages, spec 728 §7).
 *
 * spec 728 §7 — « Réglages » : « son on/off uniquement, préférence LOCALE
 * hors save cloud, pattern soundPref.js de Waggis ».
 *
 * DÉCISION (SIM-7, 09/08/2026) : préférence LOCALE (localStorage), PAS dans
 * la save cloud (le contrat de save v1 reste inchangé — spec 728 §8). Raisons
 * identiques à Waggis (soundPref.js) :
 *  - c'est une préférence d'appareil ;
 *  - la save n'intervient qu'aux moments explicites (fin de partie, achat,
 *    utilisation d'un joker — spec 728 §2) : un toggle de son ne doit JAMAIS
 *    déclencher d'écriture de save (ni locale ni cloud) ;
 *  - la clé suit la convention du socle ("arcade:...").
 *
 * Le mute est appliqué au SoundManager GLOBAL (scene.sound.mute) : il couvre
 * TOUS les sons du jeu, où qu'ils soient joués. Appliqué dès le BOOT
 * (main.js, après le chargement de la save) : un son coupé le reste au
 * lancement du jeu. (Similitude ne joue encore aucun son — le réglage est
 * prêt, les sons futurs passeront tous par scene.sound et seront couverts.)
 *
 * Module propre à Similitude (spec 728 §10 : rien dans core/ tant qu'un 2e
 * jeu n'en a pas besoin — Waggis a déjà le sien, volontairement séparé).
 * Chargé dans le navigateur (window.SimilitudeSound) ET importable sous
 * Node (module.exports) pour les tests headless (même pattern que
 * Profil.js / Grille.js).
 */
(function (root, factory) {
    if (typeof module !== "undefined" && module.exports) {
        module.exports = factory();
    } else {
        root.SimilitudeSound = factory();
    }
}(typeof self !== "undefined" ? self : this, function () {
    "use strict";

    var S = {};

    var CLE = "arcade:son:similitude";   // convention socle "arcade:..."

    /** État courant : true = son activé (défaut), false = coupé. */
    function lire() {
        try {
            var raw = window.localStorage.getItem(CLE);
            if (raw === null) return true;   // jamais réglé : son ACTIVÉ
            return raw !== "0";
        } catch (e) {
            return true;                     // stockage indisponible : son on
        }
    }

    /** Persiste la préférence (locale uniquement — cf. commentaire). */
    function ecrire(on) {
        try {
            window.localStorage.setItem(CLE, on ? "1" : "0");
        } catch (e) { /* stockage indisponible : rien à persister */ }
    }

    /** Applique la préférence au SoundManager global de la scène. */
    function appliquer(scene) {
        if (!scene || !scene.sound) return;
        scene.sound.mute = !lire();
    }

    S.CLE = CLE;
    S.lire = lire;
    S.ecrire = ecrire;
    S.appliquer = appliquer;
    return S;
}));
