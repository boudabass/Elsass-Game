/*
 * config.js — tous les réglages de Schieweschlawe (PRD article Odoo 873).
 *
 * Golf de lancer alsacien, vue du dessus : le joueur place le disque
 * enflammé sous la pierre (visée proportionnelle au terrain, §4), arrête
 * l'aiguille de la jauge dans la zone orange (§5), et doit faire retomber
 * le disque dans la cible. 100 niveaux en 10 paliers de 10 (§7), 3 lancers
 * par niveau (décision John 24/09).
 *
 * Même convention que les autres jeux : toutes les valeurs chiffrées vivent
 * ICI (rien en dur dans une scène), tous les textes joueur dans `textes`,
 * tailles en % d'écran (u() pour polices/hauteurs/marges, % de largeur
 * réelle pour la jauge).
 */
window.SchieweschlaweConfig = {
    key: "schieweschlawe",
    titre: "Schieweschlawe",

    // --- Textes (tous les textes joueur) -----------------------------------
    textes: {
        // Menu (MenuScene)
        accroche: "Lance le disque enflammé depuis la pierre et fais-le retomber dans la cible.",
        jouer: "Jouer",
        jouerNiveau: "Jouer · niveau {n}",
        niveaux: "Niveaux",
        progression: "{n} / {total} niveaux réussis",
        retour: "Quitter",
        pleinEcran: "Plein écran",

        // Écran Niveaux (NiveauxScene)
        retourMenu: "Menu",
        palier: "Palier {p} / {total}",
        niveauTuile: "Niveau {n}",
        resultatTuile: "{lancers} · {p} %",
        lancer1: "1 lancer",
        lancerN: "{n} lancers",
        aJouer: "À jouer",
        verrouille: "🔒",

        // En jeu (GameScene)
        hudNiveau: "Niveau {n}",
        hudLancer: "Lancer {i} / {total}",
        // Consignes du niveau 1 : une idée par ligne, courtes pour tenir
        // sur un téléphone à 13 px. La 2e explique la visée en miroir (le
        // disque se tire comme une fronde — décision John 25/09 : on garde,
        // on explique).
        consignes: [
            "Glisse le disque : plus bas = plus loin",
            "Disque à gauche → tir à droite",
            "« Tirer », puis « Stop » dans l'orange"
        ],
        tirer: "Tirer",
        stop: "Stop",
        arreter: "Tape pour arrêter",
        conforme: "Parfait !",
        manque: "Dévié…",
        vent: "Vent : {nom}",
        ventNoms: {
            calme: "Calme",
            leger: "Léger",
            moyen: "Moyen",
            fort: "Fort",
            tresFort: "Très fort"
        },
        pleinCentre: "Plein centre ! {p} %",
        touche: "Touché ! {p} %",
        rate: "Raté",
        horsTerrain: "Hors du terrain",
        relancer: "Relancer",

        // Fin de niveau (FinScene)
        niveauReussi: "Niveau {n} réussi !",
        niveauRate: "Niveau {n} raté",
        jeuTermine: "Les 100 niveaux sont réussis !",
        infoLancers: "{lancers}",
        infoProximite: "Proximité : {p} %",
        infoRecord: "🏆 Nouveau record",
        infoMeilleur: "Meilleur : {lancers} · {p} %",
        infoRateLancers: "Aucun des {total} lancers dans la cible",
        niveauSuivant: "Niveau suivant",
        reessayer: "Réessayer",
        rejouer: "Rejouer",
        menu: "Menu"
    },

    // --- Progression (PRD §7, décisions John 24/09) ------------------------
    niveaux: {
        total: 100,
        parPalier: 10,
        lancersParNiveau: 3     // 3 lancers ; tous ratés → on réessaie le niveau
    },

    // --- Cible : générée par niveau (Niveaux.js) ---------------------------
    // Dans un palier, la cible s'éloigne (niveau 1 du palier = proche,
    // niveau 10 = fond du terrain) ; d'un palier à l'autre elle rétrécit et
    // s'écarte davantage du centre. Chaque niveau a TOUJOURS la même cible.
    cible: {
        rayonParPalierPct: [7, 6.4, 5.8, 5.3, 4.8, 4.3, 3.9, 3.5, 3.2, 2.9], // % plus petit côté
        distanceMinPct: 30,     // % de la longueur du terrain (1er niveau du palier)
        distanceMaxPct: 88,     // % de la longueur du terrain (10e niveau du palier)
        // Décalage gauche/droite max autour du centre (50), par palier.
        lateralEcartParPalierPct: [0, 8, 12, 16, 20, 24, 28, 30, 32, 34],
        lateralBornesPct: [12, 88], // la cible reste loin des bords
        pleinCentreRatio: 0.4       // « plein centre » = dans 40 % du rayon
    },

    // --- Lancer / visée ----------------------------------------------------
    lancer: {
        // Pierre de lancement (fixe). Le terrain = tout l'espace au-dessus.
        pierreXPct: 50,             // % de largeur
        pierreYPct: 76,             // % de hauteur (limite terrain / bande de lancement)
        // La pierre est posée EN LONGUEUR, dans l'axe du tir (décision John
        // 24/09), à cheval sur la limite : moitié sur la bande de lancement,
        // moitié au-dessus du vide (le terrain).
        pierreLongueurU: 11,        // dans l'axe du tir (vertical), u()
        pierreLargeurU: 4.5,        // en travers, u()
        // Hauteur simulée par échelle (le disque grossit en montant).
        facteurHauteur: 0.9,        // vitesse verticale de départ = vitesse sol × facteur
        graviteHauteurPar_s: 3.0,   // gravité qui ramène l'altitude au sol (hauteurs / s²)
        grossissementMax: 0.9,      // le disque grossit de +90 % à l'apogée
        tailleDisquePct: 6,         // taille du disque au sol, % du plus petit côté
        traineeIntervalMs: 30,      // espacement des points de la traînée de feu
        delaiResultatMs: 1400,      // temps d'affichage du résultat avant la suite
        // Plancher tactile en PIXELS (seuil d'accessibilité iOS/Android,
        // même entorse assumée au « tout en % » que les autres jeux).
        cibleMinPx: 44
    },

    // --- Jauge de précision (PRD §5) ----------------------------------------
    // Un SEUL élément mobile (l'aiguille). La zone orange est FIXE pour le
    // tir (tirée au hasard au démarrage de la jauge). Arrêt dans l'orange =
    // tir conforme ; sinon déviation proportionnelle à l'écart.
    jauge: {
        vitesseBalayagePar_s: 0.77, // cycles/s de l'aiguille (aller-retour) — 1.1 → 0.77 (−30 %, John 24/09)
        zoneOrangeLargeurPct: 16,   // largeur de la zone orange, % de la barre
        delaiFeedbackMs: 600,       // pause après l'arrêt (affiche conforme/dévié)
        deviationDistanceMaxPct: 15, // écart distance max (arrêt raté extrême), % longueur terrain
        deviationLateralMaxPct: 10,  // écart latéral max, % largeur d'écran
        largeurPct: 60,             // largeur de la barre, % de la largeur réelle
        hauteurU: 5                 // hauteur de la barre (u())
    },

    // --- Vent (vecteur 2D, fixé par niveau — décision John 24/09) ----------
    // Accélération constante pendant le vol : accel = valeur × direction ×
    // taille d'écran. La force suit le palier ; la direction dépend du
    // niveau (Niveaux.js), choisie pour que la cible reste atteignable.
    vent: {
        directions: [
            { dx: 1,  dy: 0 },      // pousse vers la droite
            { dx: -1, dy: 0 },      // vers la gauche
            { dx: 0,  dy: -1 },     // vers le fond du terrain
            { dx: 0,  dy: 1 }       // vers la pierre
        ],
        parPalier: [
            { nom: "calme",    valeur: 0 },
            { nom: "leger",    valeur: 0.15 },
            { nom: "leger",    valeur: 0.25 },
            { nom: "moyen",    valeur: 0.4 },
            { nom: "moyen",    valeur: 0.6 },
            { nom: "fort",     valeur: 0.8 },
            { nom: "fort",     valeur: 1.0 },
            { nom: "fort",     valeur: 1.15 },
            { nom: "tresFort", valeur: 1.35 },
            { nom: "tresFort", valeur: 1.6 }
        ],
        // Visée requise gardée à distance des bords (0-100) : un niveau dont
        // la visée tomberait au-delà est jugé non atteignable (Niveaux.js).
        margeViseePct: 5,
        // Écrans de référence pour ce contrôle (portrait, paysage mobile, PC).
        ecransReference: [
            { w: 390, h: 844 },
            { w: 844, h: 390 },
            { w: 1280, h: 720 }
        ],
        // Particules d'ambiance (braises) qui rendent le vent lisible.
        braisesNombre: 24,
        braisesPar_u: 0.35,         // vitesse de base, % du plus petit côté / s
        braisesFacteurVent: 0.8,    // vitesse = base + valeur_vent × facteur
        braiseTaillePct: 1.2        // taille d'une braise, % du plus petit côté
    },

    // --- Couleurs (nuit de la vallée, vue du dessus) ------------------------
    // Interface (pastilles, boutons, cartes) : couleurs de la marque, fournies
    // par le socle (core/ui/tokens.js). Ici : le monde du jeu.
    couleurs: {
        ciel: "#0b1030",
        champ: "#17241a",
        grilleLigne: "#2e4630",
        lancePad: "#0e1620",
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
        cible: "#E31B23",
        ciblePlein: "#F2B93D",
        marqueur: "#F2B93D",
        jaugeFond: "#14212b",
        jaugeBarre: "#2E9E4F",
        jaugeZoneOrange: "#ff8c1a",
        jaugeAiguille: "#ffffff",
        // Texte secondaire posé sur une carte (niveau verrouillé).
        texteDiscret: "#7A7064"
    },

    police: {
        famille: "'Montserrat', system-ui, -apple-system, 'Segoe UI', sans-serif"
    }
};
