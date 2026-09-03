/*
 * config.js — réglages du spike « visée proportionnelle au terrain » de
 * Schieweschlawe (PRD article 873 §4, consigne 704 du 30/08).
 *
 * Prototype isolé (une scène de test) : AUCUN niveau, AUCUNE progression.
 * Valide, avant de construire les 100 niveaux :
 *   1. la VISÉE PROPORTIONNELLE au terrain (§4) : distance_du_tir =
 *      (position_disque / 100) × longueur_du_terrain. Le terrain fait
 *      TOUJOURS tout l'espace disponible au-dessus de la pierre (pas une
 *      longueur configurable plus courte) — sa taille suit l'écran ;
 *   2. les COORDONNÉES 0-100 SANS NÉGATIF sur les deux axes (distance
 *      haut-bas + latéral gauche-droite, centre à 50, miroir = 100 - pos) ;
 *   3. le TIR EN 2 ÉTAPES (§5) : placement du disque, puis jauge à aiguille
 *      mobile + zone orange FIXE (tirée au hasard au démarrage, un seul
 *      élément bouge), reclic pour arrêter (arrêt dans l'orange = conforme,
 *      sinon déviation calibrée ici) ;
 *   4. l'ÉCHELLE-HAUTEUR (le disque grossit en montant, rétrécit en
 *      retombant) ;
 *   5. le VENT 4 DIRECTIONS (vecteur 2D, setAccelerationX + setAccelerationY,
 *      5 paliers, indicateur direction + intensité dans la colonne de
 *      gauche du bas d'écran).
 *
 * Même convention que les autres jeux : toutes les valeurs chiffrées vivent
 * ICI (rien en dur dans une scène), tous les textes joueur dans `textes`,
 * tailles en % d'écran (u() pour polices/hauteurs/marges, % de largeur
 * réelle pour la jauge).
 */
window.SchieweschlaweConfig = {
    key: "schieweschlawe",
    titre: "Schieweschlawe",

    // --- Textes (libellés français, tous les textes joueur) ----------------
    textes: {
        sousTitre: "Spike v4 — visée proportionnelle au terrain",
        consigneLigne1: "Glisse le disque : bas = loin, gauche/droite = miroir",
        consigneLigne2: "Puis « Tirer » → arrête l'aiguille dans l'orange",
        tirer: "Tirer",
        arreter: "Tape pour arrêter",
        conforme: "Conforme !",
        manque: "Manqué",
        rejouer: "Rejouer",
        ventPrefixe: "Vent : ",
        directionPrefixe: "Dir. : ",
        ecart: "Écart cible : {p}%",
        pleinCentre: "PLEIN CENTRE !",
        touche: "Touché !",
        rate: "Raté",
        horsEcran: "Hors écran",
        enVol: "En vol…",
        // Résultat après atterrissage : pour valider le mapping proportionnel.
        tirResultat: "Tir à {t}% du terrain (visé {v}%)"
    },

    // --- Lancer / visée ----------------------------------------------------
    lancer: {
        // Pierre de lancement (fixe). L'axe distance (haut-bas) va de la
        // pierre (position disque 0) vers le bas de l'écran (position 100).
        pierreXPct: 50,             // % de largeur
        pierreYPct: 76,             // % de hauteur (le terrain s'étend AU-DESSUS)
        // Hauteur simulée par échelle (le disque grossit en montant).
        facteurHauteur: 0.9,        // vitesse verticale de départ = vitesse sol × facteur
        graviteHauteurPar_s: 3.0,   // gravité qui ramène l'altitude au sol (hauteurs / s²)
        grossissementMax: 0.9,      // le disque grossit de +90 % à l'apogée
        tailleDisquePct: 6,         // taille du disque au sol, % du plus petit côté
        traineeIntervalMs: 30       // espacement des points de la traînée de feu
    },

    // --- Cible (sur le terrain, pour comparer avec la visée) --------------
    cible: {
        distancePct: 50,            // position de la cible, % de la LONGUEUR du terrain
        lateralPct: 50,             // position latérale de la cible, % de largeur (50 = centre)
        rayonPct: 5                 // rayon de la cible, % du plus petit côté
    },

    // --- Jauge de précision (étape 2 du tir, PRD §5) ----------------------
    // Barre verte + un SEUL élément mobile (l'aiguille qui balaye). La zone
    // orange (l'endroit où cliquer) est FIXE pour tout le tir — tirée au
    // hasard une seule fois au démarrage de la jauge, elle ne bouge plus.
    // Le joueur reclique pour arrêter l'aiguille. Arrêt dans l'orange =
    // conforme (aucune déviation) ; sinon déviation calibrée.
    jauge: {
        vitesseBalayagePar_s: 1.1,  // cycles/s de l'aiguille (aller-retour)
        zoneOrangeLargeurPct: 16,   // largeur de la zone orange, % de la barre
        delaiFeedbackMs: 600,       // pause après l'arrêt (affiche conforme/manqué)
        // Ampleur de la déviation en cas d'arrêt raté (proposition à
        // calibrer — valeur documentée dans le rapport 713) :
        deviationDistanceMaxPct: 15, // écart distance max (arrêt raté extrême), % longueur terrain
        deviationLateralMaxPct: 10,  // écart latéral max, % largeur d'écran
        largeurPct: 60,             // largeur de la barre, % de la largeur réelle (règle jauge)
        hauteurU: 5                 // hauteur de la barre (u())
    },

    // --- Vent (vecteur 2D, 4 directions) -----------------------------------
    // La force de vent est une ACCÉLÉRATION constante appliquée au corps
    // Arcade pendant le vol, sur les 2 axes (généralisation du spike v1 qui
    // n'utilisait que setAccelerationX). accel = valeur × direction × écran.
    // Les paliers reprennent la progression des 100 niveaux (PRD §7) ; seule
    // la DIRECTION devient variable (4 côtés de l'écran).
    vent: {
        // Vecteur unitaire de la POUSSÉE (là où le disque dérive).
        directions: [
            { nom: "→ droite", dx: 1,  dy: 0 },
            { nom: "← gauche", dx: -1, dy: 0 },
            { nom: "↑ loin",   dx: 0,  dy: -1 },
            { nom: "↓ proche", dx: 0,  dy: 1 }
        ],
        paliers: [
            { nom: "Calme",     palier: 1,  valeur: 0 },
            { nom: "Léger",     palier: 3,  valeur: 0.25 },
            { nom: "Moyen",     palier: 5,  valeur: 0.6 },
            { nom: "Fort",      palier: 8,  valeur: 1.15 },
            { nom: "Très fort", palier: 10, valeur: 1.6 }
        ],
        palierInitial: 0,           // index de départ dans `paliers`
        directionInitiale: 0,       // index de départ dans `directions`
        // Particules d'ambiance (braises) qui dérivent en 2D dans le décor
        // pour rendre le sens du vent lisible AVANT le tir.
        braisesNombre: 24,
        braisesPar_u: 0.35,         // vitesse de base des braises, % du plus petit côté / s
        braisesFacteurVent: 0.8,    // vitesse des braises = base + valeur_vent × facteur
        braiseTaillePct: 1.2        // taille d'une braise, % du plus petit côté
    },

    // --- Couleurs (nuit de la vallée, vue du dessus) ------------------------
    couleurs: {
        ciel: "#0b1030",
        champ: "#17241a",           // fond du champ (vu du dessus)
        grille: "#24331f",
        grilleLigne: "#2e4630",
        lancePad: "#0e1620",        // zone de recul (sous la pierre)
        pierre: "#4a3a2c",
        pierreBord: "#6b5138",
        disque: 0xff7a1a,
        disqueCoeur: 0xffd23f,
        disqueClair: 0xfff3c4,
        ombreDisque: 0x000000,
        trainee: 0xff9a3d,
        braise: 0xffb45c,
        vent: "#8fd3ff",
        visee: "#8fd3ff",
        cible: "#ff5252",
        ciblePlein: "#ffd23f",
        texte: "#e8eef7",
        texteSombre: "#141210",
        bouton: "#2E9E4F",          // bouton vert « Tirer »
        boutonVent: "#1d3557",
        jaugeFond: "#14212b",       // fond de la barre (sombre)
        jaugeBarre: "#2E9E4F",      // corps vert de la barre
        jaugeZoneOrange: "#ff8c1a",
        jaugeAiguille: "#ffffff",
        ecart: "#ffd23f"
    }
};
