/*
 * config.js — TOUS les réglages de Similitude au même endroit (spec 473 §10).
 *
 * Les valeurs sont exprimées en PROPORTION de l'écran, jamais en pixels :
 * le jeu se comporte donc exactement pareil sur un téléphone en portrait et
 * sur un grand écran de PC. Toute valeur chiffrée vit ici — rien en dur dans
 * le code (John rééquilibrera après son test sans toucher au gameplay).
 */
window.SimilitudeConfig = {
    key: "similitude",
    titre: "Similitude",

    // --- Textes (libellés français) -----------------------------------------
    // {score} est un emplacement : la valeur est insérée au moment de
    // l'affichage (voir MenuScene / OverScene).
    textes: {
        meilleurScore: "Meilleur score : {score}",
        nouveauRecord: "Nouveau record !",

        // Règle en une phrase (spec §1), affichée sur le menu.
        regle: "Alignez 3 items identiques ou plus en ligne ou en colonne pour les faire disparaître !",

        // Motifs de fin de partie (spec §6) — affichés par OverScene.
        finChrono: "Temps écoulé",
        finEnergie: "Plus d'énergie",
        finGrillePleine: "Grille pleine",

        // Libellés des icônes persistantes Quitter / Plein écran (lus par
        // Arcade.UI.iconesPlateforme via les options de boot — main.js).
        retour: "Retour",
        pleinEcran: "Plein écran"
    },

    // --- Grille (spec §2, §4) ----------------------------------------------
    grilleTaille: 9,          // grille fixe 9×9, sans défilement
    itemsDepart: 30,          // items placés au hasard au début d'une partie
    typesItems: 6,            // les 6 items alsaciens (spec §7)
    itemsParCoupRate: 2,      // nouveaux items après un coup raté (spec §3)
    tailleCasePct: 8,         // côté d'une case, en % du plus petit côté

    // --- Énergie / chrono (spec §4, §5) ------------------------------------
    energieDepart: 25,        // ⚡ de départ
    tempsDepart: 120,         // chrono de départ, en secondes
    dureeDeplacementMs: 150,  // animation de translation d'un déplacement
    chronoAlerteS: 15,        // le chrono passe en rouge sous 15 s (spec §8)
    energieAlerte: 5,         // l'énergie passe en rouge sous 5 ⚡ (spec §8)

    // --- Barème (spec §5) ---------------------------------------------------
    bareme: {
        // Points d'un alignement de longueur n : 10 × n × (n − 2)
        // (3 → 30, 4 → 80, 5 → 150, 6+ → 10×n×(n−2)).
        points: function (n) { return 10 * n * (n - 2); },
        // Énergie gagnée : +(n − 1) ⚡
        energie: function (n) { return n - 1; },
        // Temps gagné : +n s (le chrono n'est pas plafonné)
        temps: function (n) { return n; },
        // Combo (2 alignements ou plus dans le même coup) : total doublé
        comboDouble: true
    },

    // --- Les 6 items (spec §7 — point clos) ---------------------------------
    // Chemins DÉFINITIFS, listés UNE SEULE FOIS ici. L'ordre du tableau est
    // l'ordre des types (0 à 5) utilisé par Grille.js. John écrasera les PNG
    // le jour où il livre ses dessins : zéro ligne de code à toucher.
    items: [
        { cle: "bretzel",    chemin: "assets/items/bretzel.png" },
        { cle: "cigogne",    chemin: "assets/items/cigogne.png" },
        { cle: "kougelhopf", chemin: "assets/items/kougelhopf.png" },
        { cle: "chope",      chemin: "assets/items/chope.png" },
        { cle: "choucroute", chemin: "assets/items/choucroute.png" },
        { cle: "geranium",   chemin: "assets/items/geranium.png" }
    ],

    // --- Couleurs -----------------------------------------------------------
    couleurs: {
        fond: "#1f3a2d",
        caseFond: "#2c4f3c",
        caseBordure: "#3d6b52",
        texte: "#141210",
        texteClair: "#f5f0e6",
        bouton: "#E31B23",
        boutonJouer: "#2E9E4F"
    }
};
