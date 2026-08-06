/*
 * config.js — tous les réglages de Waggis au même endroit.
 *
 * Waggis est un jeu type Frogger : le joueur remonte l'écran (de bas en
 * haut), traverse d'abord une route avec des véhicules, puis un cours d'eau
 * en sautant sur des éléments flottants.
 *
 * Les valeurs sont exprimées en PROPORTION de l'écran, jamais en pixels :
 * le jeu se comporte donc exactement pareil sur un téléphone en portrait et
 * sur un grand écran de PC.
 *
 * ÉTAPE 1 : squelette structurel. Seul le personnage qui remonte l'écran au
 * tap est en place ; les véhicules, la rivière et les vies arrivent aux
 * étapes suivantes. Les réglages sont déjà prévus pour elles.
 */
window.WaggisConfig = {
    key: "waggis",
    titre: "Waggis",

    // --- Textes (libellés français) -----------------------------------------
    textes: {
        jouer: "Jouer",
        consigne: "Touche l'écran\npour avancer",
        arrivee: "Arrivée !",
        rejouer: "Rejouer",
        menu: "Menu"
    },

    // --- Personnage ----------------------------------------------------------
    // Taille en % du plus petit côté de l'écran.
    taillePersoPct: 9,
    // Position horizontale fixe (le perso ne bouge que verticalement).
    positionXPct: 50,
    // Hauteur remontée à chaque tap, en % de la hauteur d'écran.
    pasPct: 10,

    // --- Le terrain (de bas en haut, % de la hauteur d'écran) ----------------
    // Bandes du bas vers le haut : berge départ, route, rivière, berge arrivée.
    // Somme = 100. Les véhicules rouleront sur la route, les flottants sur la
    // rivière (étapes suivantes).
    bergeDepPct: 12,     // berge de départ (herbe, en bas)
    routePct: 28,        // la route (pavés)
    rivierePct: 38,      // le cours d'eau
    bergeArrPct: 22,     // berge d'arrivée (herbe, en haut)

    // --- Couleurs -----------------------------------------------------------
    couleurs: {
        ciel: "#87ceeb",
        herbe: 0x6aa84f,
        herbeSombre: 0x4e8a3a,
        eau: 0x3a7bd5,
        texte: "#141210",
        texteClair: "#ffffff",
        bouton: "#E31B23"
    }
};
