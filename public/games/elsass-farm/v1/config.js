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
        // 3e bloc du HUD (décision John 13/08) : zone libre à DROITE,
        // réservée au futur indicateur or / énergie. Vide pour l'instant
        // (zone libre) — la place est réservée dans le layout de GameScene.
        hudDroit: "",
        saisons: ["Printemps", "Été", "Automne", "Hiver"],

        // Nom de zone affiché dans le HUD (décision John 11/08) : une
        // entrée par id de zone de zones.json, montrée en haut à gauche
        // quand le joueur change de zone.
        zones: {
            ferme: "Ferme",
            "maison-rdc": "Maison RDC",
            "maison-etage": "Maison étage"
        },

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

    // --- Caméra à paliers (décision John 11/08) ----------------------------
    // Le nombre de paliers est adapté à la taille de la zone :
    //   paliers = (plus grande dimension de la zone + 10) ÷ 10, arrondi au
    //   supérieur, borné [1, paliersMax]. Ferme 28×18 → (28+10)/10 = 3.8 → 4
    //   paliers (10/20/30/40 cases). Zone 0-10 → 1 palier. Zone 90-100 → 10.
    // Le palier i = casesParPalier × i cases visibles sur le PETIT côté de
    // l'écran (zoom 1 = 10×10 cases min, centré sur le perso). La marge qui
    // sépare le perso du bord de l'écran GRANDIT de margeCasesParPalier cases
    // à chaque palier, dès le palier 1 : marge(palier i) = margeCasesParPalier
    // × i (3 cases au palier 1, 6 au palier 2, … — consigne 13/08). Le dézoom
    // ne dépasse jamais la zone + cette marge de chaque côté. Au dézoom, la
    // caméra glisse le long de la ligne perso → centre de la zone (zoom 1 =
    // perso, zoom max = centre).
    camera: {
        casesParPalier: 10,
        paliersMax: 10,
        margeCasesParPalier: 3,   // marge(palier i) = 3 × i cases (13/08)
        glisse: 0.12   // lissage du suivi caméra (X et Y)
    },

    // --- Machine à états sol (proposition point 5) -------------------------
    // GRAINE DE TEST (substitut temporaire assumé — Bloc B) : pas de vraie
    // culture alsacienne. Remplacée par cultures.json au Bloc B.
    sol: {
        graineTest: "🥕",
        etapesPousse: 3,      // seuil : etapes >= etapesPousse → prête
        // Ids des tuiles dans le tileset sol_16px (calculés par
        // scripts/generer_maps.mjs, alignés sur le .tsx) — à ajuster si le
        // tileset change (pnpm assets:atlas).
        tuileHerbeId: 465,    // repli : sol/town_herbe_centre.png (case vide)
        tuileLaboureeId: 138, // sol/farm_sol_butte_seul_v1.png (labourée)
        // Sol de base PAR ZONE (cartes de test différenciées visuellement).
        // Ferme = herbe (12/08 : la ferme était en terre nue déjà "labourée"
        // partout, ce qui ne correspondait à aucun état de la machine à
        // états — l'herbe est déjà tuileHerbeId, l'état "vide" cohérent ;
        // la ferme démarre en prairie, le joueur laboure au fur et à
        // mesure). Maison-rdc = parquet, maison-etage = bois clair
        // (inchangés). Ids alignés sur scripts/generer_maps.mjs.
        tuileBaseParZone: {
            ferme: 465,            // sol/town_herbe_centre.png
            "maison-rdc": 286,     // sol/rogrpg_plancher_v1.png
            "maison-etage": 289    // sol/rogrpg_plancher_v3.png
        }
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
    // 3 blocs répartis sur toute la largeur (décision John 13/08) :
    //   GAUCHE  nom de zone (tailleZoneU)
    //   CENTRE  horloge jour · saison · heure (tailleTexteU)
    //   DROITE  zone libre or/énergie (tailleTexteU, vide pour l'instant)
    hud: {
        tailleZoneU: 5,      // nom de zone (haut gauche, décision John 11/08)
                             // — 13/08 : 2.8 → 5, aligné sur Similitude
                             // (hudTailleTextePct 5), lisible sur mobile
        tailleTexteU: 5,     // horloge (heure/saison/jour) — 13/08 : 3.4 → 5
        margeU: 1.5,
        // Repli sur 2 lignes (25/08). À 5 u, les 3 blocs ne tiennent pas
        // côte à côte en PORTRAIT : « Maison étage » et l'horloge se
        // chevauchaient de 25 px (360×800) à 65 px (768×1024, mesuré au
        // Canvas 2D, même moteur de texte que Phaser). Plutôt que de
        // rapetisser le texte — il vient justement d'être agrandi pour
        // mobile le 13/08 — l'horloge descend d'une ligne quand la place
        // manque, comme Waggis réduit le NOMBRE d'éléments par page et non
        // leur taille. En paysage et sur desktop il reste 189 à 219 px
        // libres : la disposition 3 blocs du 13/08 y est inchangée.
        ecartMinU: 2,        // vide exigé entre deux blocs voisins
        interligneU: 1       // écart vertical zone → horloge en repli
    },

    // --- Barre d'outils (tailles u(), pattern barreJokers Similitude) ------
    // 13/08 : agrandie pour être lisible sur mobile (constat John) — icône
    // alignée sur le bouton zoom (10 u), emoji et quantité agrandies en
    // proportion. Tout reste en u() = % du plus petit côté.
    barreOutils: {
        tailleIconeU: 10,     // côté d'une icône (7 → 10)
        tailleEmojiU: 6.5,    // emoji dans l'icône (4.5 → 6.5)
        tailleQuantiteU: 3.8, // nombre sous l'icône (2.6 → 3.8)
        margeU: 1.5,
        // Plancher tactile en PIXELS ABSOLUS — même entorse assumée au
        // « tout en % » que policeMinPx / tuileMinPx de Waggis : 44 px est
        // la cible tactile iOS/Android, un seuil d'accessibilité qui doit
        // rester fixe (en u() il suivrait l'écran et raterait justement le
        // cas qu'il attrape). À 10 u, une icône tombait à 36 px sur un
        // mobile 360×800 et 41 px sur 412×915.
        cibleMinPx: 44,
        // 25/08 : 0.25 → 1. Le grisage de core/ui/iconbar.js signale une
        // QUANTITÉ à zéro ; aucun outil du Bloc A n'a de quantité (pelle,
        // arrosoir, main…), donc setBadge n'est jamais appelé et les 5
        // icônes restaient à 25 % d'opacité en permanence — une barre qui
        // paraissait désactivée alors qu'elle est pleinement cliquable.
        // À remettre à 0.25 le jour où un outil aura un stock.
        grisAlpha: 1,
        eclatCouleur: "#fff3c4"   // fond de l'icône ARMÉE
    },

    // --- Boutons zoom +/− ---------------------------------------------------
    zoom: {
        tailleBoutonU: 10,
        cibleMinPx: 44,   // même plancher tactile que barreOutils.cibleMinPx
        pas: 1,   // un palier de zoom par clic (paliers adaptés à la zone)
        margeU: 1.5
    },

    // --- Police -------------------------------------------------------------
    police: {
        famille: "system-ui, -apple-system, Segoe UI, sans-serif"
    }
};
