/*
 * config.js — réglages du spike v2 « vue du dessus + visée 3 points » de
 * Schieweschlawe.
 *
 * Prototype isolé (une scène de test) : AUCUN niveau, AUCUNE progression.
 * Il valide le nouveau rendu top-down (PRD article 873 §3-6) avant de
 * construire les 100 niveaux :
 *   - vue du dessus + grille à 2 axes (gauche-droite = décalage latéral,
 *     haut-bas = distance au sol) ;
 *   - visée à 3 points alignés (pointeur / pierre-pivot / cible) en miroir ;
 *   - hauteur simulée par échelle (le disque grossit en montant) ;
 *   - vent en vecteur 2D (4 directions), réutilisant la physique validée par
 *     le spike v1 (accélération constante sur le corps Arcade).
 *
 * Même convention que les autres jeux : toutes les valeurs chiffrées vivent
 * ICI (rien en dur dans une scène), tous les textes joueur dans `textes`,
 * tailles en % d'écran (u() pour polices/hauteurs, % de largeur réelle pour
 * la jauge horizontale).
 */
window.SchieweschlaweConfig = {
    key: "schieweschlawe",
    titre: "Schieweschlawe",

    // --- Textes (libellés français, tous les textes joueur) ----------------
    textes: {
        sousTitre: "Spike v2 — vue du dessus + visée 3 points",
        consigneLigne1: "Glisse le pointeur pour viser (miroir)",
        consigneLigne2: "Puis touche « Tirer » (jauge à droite)",
        tirer: "Tirer",
        ventPrefixe: "Vent : ",
        directionPrefixe: "Dir. : ",
        ventCalme: "calme",
        distance: "Distance : {p}%",
        ecart: "Écart cible : {p}%",
        pleinCentre: "PLEIN CENTRE !",
        touche: "Touché !",
        rate: "Raté",
        horsEcran: "Hors écran",
        rejouer: "Rejouer",
        enVol: "En vol…"
    },

    // --- Lancer / visée ----------------------------------------------------
    lancer: {
        // Pierre de lancement (fixe, bas d'écran — laisse de la place en
        // dessous pour tirer le pointeur vers le bas).
        pierreXPct: 50,             // % de largeur
        pierreYPct: 70,             // % de hauteur
        // Visée 3 points : le pointeur s'éloigne de la pierre (rayon max),
        // le disque part en miroir (direction opposée au pointeur).
        rayonPullPct: 26,           // éloignement max du pointeur, % du plus petit côté
        vitesseMaxPar_s: 0.85,      // vitesse sol à pleine traction (hauteurs d'écran / s)
        vitesseMinRatio: 0.15,      // vitesse mini = 15 % de la vitesse maxi
        // Hauteur simulée par échelle (le disque grossit en montant).
        facteurHauteur: 1.0,        // vitesse verticale de départ = vitesse sol × facteur
        graviteHauteurPar_s: 3.2,   // gravité qui ramène l'altitude au sol (hauteurs / s²)
        grossissementMax: 0.9,      // le disque grossit de +90 % à l'apogée
        tailleDisquePct: 6,         // taille du disque au sol, % du plus petit côté
        traineeIntervalMs: 30,      // espacement des points de la traînée de feu
        // Cible (sur la grille, en % largeur / hauteur).
        cibleXPct: 60,
        cibleYPct: 28,
        rayonCiblePct: 5,           // rayon de la cible, % du plus petit côté
        // Grille 2 axes.
        grilleLignes: 6,            // lignes (distance, axe haut-bas)
        grilleColonnes: 6           // colonnes (décalage latéral, axe gauche-droite)
    },

    // --- Vent (vecteur 2D, 4 directions) ------------------------------------
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
        lancePad: "#0e1620",        // zone de tir en bas (où l'on tire le pointeur)
        pierre: "#4a3a2c",
        pierreBord: "#6b5138",
        pointeur: "#8fd3ff",
        ligneVisee: "#8fd3ff",
        disque: 0xff7a1a,
        disqueCoeur: 0xffd23f,
        disqueClair: 0xfff3c4,
        ombreDisque: 0x000000,
        trainee: 0xff9a3d,
        braise: 0xffb45c,
        vent: "#8fd3ff",
        cible: "#ff5252",
        ciblePlein: "#ffd23f",
        texte: "#e8eef7",
        texteSombre: "#141210",
        bouton: "#2E9E4F",
        boutonVent: "#1d3557",
        jaugeFond: "#26304a",
        jaugePlein: "#ff9a3d",
        ecart: "#ffd23f"
    }
};
