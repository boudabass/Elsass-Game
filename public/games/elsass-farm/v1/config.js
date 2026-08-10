/*
 * config.js — TOUS les réglages d'Elsass Farm au même endroit (proposition
 * Bloc A, art. 713 : « config.js — window.FarmConfig : key, titre, textes
 * (TOUT le texte joueur), et toutes les valeurs chiffrées (horloge, grille,
 * sol, zoom, couleurs) »).
 *
 * Valeurs en PROPORTION de l'écran (u() = % du plus petit côté, % de la
 * largeur w), jamais en pixels — même comportement sur mobile et PC.
 * Clic / tap uniquement (pas de clavier, pas de manette).
 */
window.FarmConfig = {
    key: "elsass-farm",
    titre: "Elsass Farm",

    // --- Textes (TOUT le texte joueur) -------------------------------------
    // {jour}, {saison}, {heure} sont des emplacements : les valeurs sont
    // insérées à l'affichage (HUD de GameScene).
    textes: {
        jouer: "Jouer",
        accroche: "Une ferme alsacienne à faire pousser…",
        retour: "Retour",
        pleinEcran: "Plein écran",

        // HUD (GameScene).
        hudHorloge: "Jour {jour} · {saison} · {heure}h",
        saisons: ["Printemps", "Été", "Automne", "Hiver"],

        // Popup sommeil (interaction sur le lit).
        dormir: "Dormir jusqu'au lendemain ?",
        dormirOui: "Dormir",
        dormirNon: "Rester debout",

        // Popup portail à choix.
        ouAller: "Où aller ?"
    },

    // --- Horloge jour/nuit + saisons (proposition point 4) -----------------
    // Source de vérité : un compteur unique t = temps de jeu en ms, cumulé
    // dans update(delta) de GameScene avec le facteur ci-dessous.
    // 1 s réelle = 60 s jeu → 1 min réelle = 1 h jeu, jour = 24 min réelles.
    horloge: {
        facteur: 60,
        heureReveil: 6,        // réveil à 6 h du jour+1 après le sommeil
        // Teinte plein écran par plage horaire (début d'heure, triées par
        // heure croissante — le code prend la dernière dont debut <= heure).
        teintes: [
            { debut: 0, couleur: "#050523", alpha: 0.55 },   // nuit profonde
            { debut: 5, couleur: "#32285a", alpha: 0.35 },   // aube
            { debut: 6, couleur: "#000000", alpha: 0 },      // jour
            { debut: 18, couleur: "#ff9632", alpha: 0.15 },  // coucher
            { debut: 21, couleur: "#0a0a32", alpha: 0.45 }   // nuit tombée
        ]
    },

    // --- Grille + déplacement au clic (proposition point 3) ----------------
    grille: {
        rayonAction: 1,              // zone d'action Chebyshev (tuiles)
        vitesseTuilesParSeconde: 6   // vitesse de suivi du chemin BFS
    },

    // --- Caméra (proposition point 3) --------------------------------------
    camera: {
        zoomDefaut: 0.85,   // ferme (28×18 tuiles) entière visible sur mobile
        zoomMin: 0.5,
        zoomMax: 3
    },

    // --- Machine à états sol (proposition point 5) -------------------------
    // GRAINE DE TEST (substitut temporaire assumé — Bloc B) : pas de vraie
    // culture alsacienne. Remplacée par cultures.json au Bloc B.
    sol: {
        graineTest: "🥕",
        etapesPousse: 3,      // seuil : etapes >= etapesPousse → prête
        // Ids des tuiles dans le tileset sol_16px (calculés par
        // scripts/generer_maps_test.py, alignés sur le .tsx) — à ajuster
        // si le tileset change (pnpm assets:atlas).
        tuileHerbeId: 465,    // sol/town_herbe_centre.png (case vide)
        tuileLaboureeId: 138  // sol/farm_sol_butte_seul_v1.png (labourée)
    },

    // --- Barre d'outils (proposition point 3 : 5 slots) --------------------
    // Pelle (labourer) · Arrosoir (arroser) · Main (récolter) · Graines
    // (planter — graine de TEST) · + 1 slot libre (futur Bloc B).
    outils: [
        { cle: "pelle", icone: "⛏️" },
        { cle: "arrosoir", icone: "🚿" },
        { cle: "main", icone: "✋" },
        { cle: "graines", icone: "🥕" },  // remplacé par C.sol.graineTest
        { cle: "libre", icone: "❔" }
    ],

    // --- Couches de profondeur (SIM-FIX-DEPTH pattern, art. 704) -----------
    profondeurs: {
        sol: 0,
        obstacles: 1,
        joueur: 5,
        decors: 6,     // rendue AU-DESSUS du joueur (convention Bloc A)
        pousse: 7,     // emojis de pousse (graphisme simple, pas d'asset)
        nuit: 8,       // voile de nuit (sommeil)
        hud: 10,       // HUD + barre d'outils + boutons zoom
        popup: 50      // popups de confirmation
    },

    // --- Couleurs -----------------------------------------------------------
    couleurs: {
        fond: "#3d7a4f",
        texte: "#f5f0e6",
        contour: "#141210",
        boutonJouer: "#2E9E4F",          // VERT charte (Jouer, Dormir)
        bouton: "#E31B23",               // ROUGE charte (Retour, Plein écran)
        boutonSecondaire: "#141210",     // NOIR charte (barre d'outils)
        ombreBouton: "rgba(20, 18, 16, 0.28)"
    },

    // --- Menu principal -----------------------------------------------------
    menu: {
        largeurJouerPct: 80,   // « Jouer » : % de la LARGEUR d'écran (pattern
                               // Waggis/Similitude)
        hauteurJouerU: 11.5,
        titreY: 0.3,           // centre du titre (fraction de la hauteur)
        tailleTitreU: 13.5,
        tailleAccrocheU: 4
    },

    // --- HUD en jeu ---------------------------------------------------------
    hud: {
        tailleTexteU: 3.4,     // horloge (heure/saison/jour)
        margeU: 1.5
    },

    // --- Barre d'outils (tailles u(), pattern barreJokers Similitude) ------
    barreOutils: {
        tailleIconeU: 7,
        tailleEmojiU: 4.5,
        tailleQuantiteU: 2.6,
        margeU: 1.5,
        grisAlpha: 0.25,
        eclatCouleur: "#fff3c4"   // fond de l'icône ARMÉE
    },

    // --- Boutons zoom +/− ---------------------------------------------------
    zoom: {
        tailleBoutonU: 10,
        pas: 0.25,
        margeU: 1.5
    },

    // --- Police -------------------------------------------------------------
    police: {
        famille: "system-ui, -apple-system, Segoe UI, sans-serif"
    }
};
