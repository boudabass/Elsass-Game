/*
 * config.js — réglages du spike technique « vent » de Schieweschlawe.
 *
 * Prototype isolé (une scène de test) : AUCUN niveau, AUCUNE progression.
 * Il sert uniquement à valider la physique de vent (Phaser 4 Arcade) avant
 * de construire les 100 niveaux (PRD article 873 §4).
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
        sousTitre: "Spike technique — vent",
        consigneLigne1: "Touche 1 : lancer la jauge de puissance",
        consigneLigne2: "Touche 2 : tirer le disque",
        puissance: "Puissance",
        ventPrefixe: "Vent : ",
        ventCalme: "Vent calme",
        distance: "Distance : {p}%",
        ecart: "Écart cible : {p}%",
        horsEcran: "Hors écran",
        rejouer: "Rejouer",
        enVol: "En vol…"
    },

    // --- Lancer ------------------------------------------------------------
    lancer: {
        angleDeg: 50,              // angle de tir fixe (la précision tap 3 est
                                   // hors périmètre du spike)
        gravitePar_h: 3.2,         // gravité en hauteurs d'écran / s² (vers le bas)
        cibleDistPct: 62,          // distance de la cible, en % de la largeur
        puissanceMinRatio: 0.35,   // vitesse mini = 35 % de la vitesse maxi
        lanceurXPct: 18,           // position X du lanceur, en % de largeur
        lanceurHautPct: 2,         // hauteur du lanceur au-dessus du sol, % de hauteur
        solPct: 7,                 // bande de sol en bas, en % de hauteur
        chargeAllerRetourPar_s: 0.9, // vitesse d'aller-retour de la jauge (0→1 / s)
        traineeIntervalMs: 28,     // espacement des points de la traînée de feu
        tailleDisquePct: 6         // taille du disque, en % du plus petit côté
    },

    // --- Vent ---------------------------------------------------------------
    // La force de vent est une ACCÉLÉRATION latérale appliquée au corps Arcade
    // pendant le vol : accel = valeur × largeur d'écran (px/s²).
    // Les paliers reprennent la progression des 100 niveaux (PRD §5) : calme au
    // palier 1, très fort au palier 10.
    vent: {
        direction: 1,              // +1 = souffle vers la droite, -1 = vers la gauche
        paliers: [
            { nom: "Calme",     palier: 1,  valeur: 0 },
            { nom: "Léger",     palier: 3,  valeur: 0.25 },
            { nom: "Moyen",     palier: 5,  valeur: 0.6 },
            { nom: "Fort",      palier: 8,  valeur: 1.15 },
            { nom: "Très fort", palier: 10, valeur: 1.6 }
        ],
        palierInitial: 0,          // index de départ dans `paliers`
        // Particules d'ambiance (braises) qui dérivent dans le décor pour
        // rendre le sens du vent lisible AVANT le tir.
        braisesNombre: 22,
        braisesPar_w: 0.35,        // vitesse de base des braises, en % de largeur / s
        braisesFacteurVent: 0.8,   // vitesse des braises = base + valeur_vent × facteur
        braiseTaillePct: 1.2       // taille d'une braise, en % du plus petit côté
    },

    // --- Couleurs (nuit de la vallée) --------------------------------------
    couleurs: {
        cielHaut: "#0b1030",
        cielBas: "#233154",
        etoile: "#cdd7ee",
        sol: "#171209",
        solHerbe: "#26331f",
        lanceur: "#4a3a2c",
        lanceurBord: "#6b5138",
        disque: 0xff7a1a,
        disqueCoeur: 0xffd23f,
        disqueClair: 0xfff3c4,
        trainee: 0xff9a3d,
        braise: 0xffb45c,
        vent: "#8fd3ff",
        cible: "#ff5252",
        texte: "#e8eef7",
        texteSombre: "#141210",
        bouton: "#2E9E4F",
        boutonVent: "#1d3557",
        jaugeFond: "#26304a",
        jaugePlein: "#ff9a3d",
        ecart: "#ffd23f"
    }
};
