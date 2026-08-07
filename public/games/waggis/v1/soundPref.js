/*
 * soundPref.js — préférence son de Waggis (écran Réglages, MENU-5).
 *
 * spec 709 §7 boutons — « Réglages » : « uniquement son on/off. Pas de
 * vibration, pas de langue pour l'instant. » ; §Données nécessaires :
 * « Réglage son on/off — à préciser si stocké côté save cloud ou juste
 * local (préférence appareil). »
 *
 * DÉCISION (MENU-5, 07/08/2026) : préférence LOCALE (localStorage), PAS
 * dans la save cloud (le contrat de save reste en v5, inchangé). Raisons :
 *  - c'est une préférence d'appareil (le libellé de la spec le suggère :
 *    « préférence appareil ») ;
 *  - règle 708 §9 : la save n'intervient QU'À LA VICTOIRE du niveau — un
 *    toggle de son ne doit JAMAIS déclencher d'écriture de save (ni
 *    locale ni cloud) ;
 *  - la clé suit la convention du socle ("arcade:...").
 *
 * Le mute est appliqué au SoundManager GLOBAL (scene.sound.mute) : il
 * couvre TOUS les sons du jeu, où qu'ils soient joués — bond snd_jump et
 * mort snd_hurt/snd_fall (GameScene), signal du train snd_error
 * (LaneGenerator). Appliqué dès le BOOT (main.js, après le chargement de
 * la save) : un son coupé le reste au lancement du jeu.
 *
 * Module propre à Waggis (article 709 : pas dans core/ tant qu'un 2e jeu
 * n'en a pas besoin).
 */
(function () {
    "use strict";

    var W = (window.WaggisSound = window.WaggisSound || {});

    var CLE = "arcade:son:waggis";   // convention socle "arcade:..."

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

    W.CLE = CLE;
    W.lire = lire;
    W.ecrire = ecrire;
    W.appliquer = appliquer;
})();
