/*
 * horloge.js — horloge jour/nuit + saisons d'Elsass Farm (proposition
 * Bloc A, point 4).
 *
 * Source de vérité : un compteur unique t = temps de jeu écoulé en ms,
 * cumulé dans update(delta) de GameScene avec le facteur
 * config.horloge.facteur (1 s réelle = 60 s jeu).
 * Toutes les valeurs (heure, jour, saison, année) sont DÉRIVÉES de t par
 * formules pures — jamais stockées séparément, donc sans dérive :
 *   - heure : 0..23            (1 min réelle = 1 h jeu)
 *   - jour  : 1..112           (jour = 24 min réelles)
 *   - saison : 4 × 28 jours    (printemps j.1-28, été j.29-56,
 *                               automne j.57-84, hiver j.85-112)
 */
window.FarmHorloge = {
    /** Minutes de jeu écoulées depuis t (entier). */
    minutes: function (t) {
        return Math.floor(t / 60000);
    },

    /** Heure de jeu 0..23. */
    heure: function (t) {
        // ⭐ FIX horloge 60x trop rapide : minutes(t) est le total de
        // MINUTES de jeu écoulées (cf. jour(), qui divise par 1440 = 24×60
        // minutes/jour) — il faut diviser par 60 pour obtenir l'heure du
        // jour, pas prendre le modulo 24 directement sur des minutes.
        // Avant ce fix, l'horloge (et la teinte jour/nuit, dérivée de
        // heure()) bouclait sur 24 "heures" toutes les 24 MINUTES de jeu
        // (24 secondes réelles à facteur=60) au lieu de 24 heures de jeu
        // (24 minutes réelles) — 60x trop vite.
        return Math.floor(this.minutes(t) / 60) % 24;
    },

    /** Jour de jeu 1..112 (cycle de 112 jours, puis année suivante). */
    jour: function (t) {
        return Math.floor(this.minutes(t) / 1440) + 1;
    },

    /** Saison 0..3 (printemps, été, automne, hiver). */
    saison: function (t) {
        return Math.floor((this.jour(t) - 1) / 28) % 4;
    },

    /** Année de jeu (1 au premier cycle de 112 jours). */
    annee: function (t) {
        return Math.floor((this.jour(t) - 1) / 112) + 1;
    },

    /** Nom de la saison courante (depuis config.textes.saisons). */
    saisonNom: function (t, C) {
        return C.textes.saisons[this.saison(t)];
    },

    /**
     * Temps t (ms de jeu) du réveil : config.horloge.heureReveil du
     * jour SUIVANT (le sommeil saute au lendemain matin).
     */
    versReveil: function (t, C) {
        const minutes = this.minutes(t);
        const jourCourant = Math.floor(minutes / 1440);
        const cible = (jourCourant + 1) * 1440 + C.horloge.heureReveil * 60;
        return cible * 60000;
    }
};
