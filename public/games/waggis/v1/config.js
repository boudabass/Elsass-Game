/*
 * config.js — tous les réglages de Waggis V2 au même endroit.
 *
 * Waggis V2 est un hopper infini façon Crossy Road (PRD : article Odoo 705,
 * CDC technique : article 706) : le joueur incarne un Waggis qui avance sans
 * fin, bande par bande, à travers des bandes de terrain générées
 * aléatoirement (route, eau, rails, zone sûre). Pas de fin de niveau : on
 * joue jusqu'à la mort, le score est le nombre de bonds vers l'avant.
 *
 * Le concept V1 (Frogger, tap par case, terrain fixe berge/route/rivière/
 * berge) est ABANDONNÉ : ce fichier ne conserve aucun réglage de la V1.
 *
 * Les valeurs sont exprimées en PROPORTION de l'écran, jamais en pixels :
 * le jeu se comporte donc exactement pareil sur un téléphone en portrait et
 * sur un grand écran de PC.
 *
 * ÉTAPE 1 : squelette structurel. Les scènes sont vides mais fonctionnelles
 * (menu → jeu → fin). La génération des bandes (LaneGenerator) et le pooling
 * des obstacles (ObstaclePool) arrivent aux étapes suivantes, avec leurs
 * réglages dédiés.
 */
window.WaggisConfig = {
    key: "waggis",
    titre: "Waggis",

    // --- Textes (libellés français) -----------------------------------------
    // {score} est un emplacement : la valeur du score est insérée au moment
    // de l'affichage (voir MenuScene / OverScene).
    textes: {
        jouer: "Jouer",
        rejouer: "Rejouer",
        menu: "Menu",
        fin: "Partie terminée",
        score: "Score : {score}",
        meilleurScore: "Meilleur score : {score}",
        nouveauRecord: "Nouveau record !",
        // Étape 1 : panneau provisoire de la scène de jeu, affiché en
        // attendant la génération des bandes (étape 2).
        jeuVide: "Squelette étape 1 —\nles bandes arrivent à l'étape 2",
        finirProvisoire: "Terminer (provisoire)"
    },

    // --- Couleurs -----------------------------------------------------------
    couleurs: {
        ciel: "#87ceeb",
        texte: "#141210",
        texteClair: "#ffffff",
        bouton: "#E31B23",
        // Encadré du record sur l'écran de fin : orange, texte noir à
        // l'intérieur (lisible sur le fond bleu ciel).
        encadreRecord: "#F2B93D"
    }
};
