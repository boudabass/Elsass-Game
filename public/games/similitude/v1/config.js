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
        // Menu principal façon Waggis (spec 728 §7 — SIM-7).
        jouer: "Jouer",
        accroche: "Aligne 3 saveurs d'Alsace avant la fin du temps !",
        boutique: "Boutique",
        inventaire: "Inventaire",
        classement: "Classement",
        commentJouer: "Comment jouer",
        reglages: "Réglages",
        // Boutique et Inventaire sont ouverts par la grille 2×2 (SIM-8 :
        // ShopScene / InventaireScene). Le libellé ci-dessous reste un
        // garde-fou pour toute clé de scène non encore enregistrée.
        bientot: "Bientôt disponible !",

        // Écran Réglages (spec 728 §7 — son on/off uniquement).
        sonOn: "Son : Activé",
        sonOff: "Son : Désactivé",

        // Écran Classement (spec 728 §7 — pattern ClassementScene Waggis).
        classementChargement: "Chargement du classement…",
        classementVide: "Aucun score pour l'instant — joue une partie pour apparaître !",
        classementHorsLigne: "Classement indisponible hors ligne.",
        pagePrecedente: "◀",
        pageSuivante: "▶",
        pageInfo: "Page {page} / {total}",

        // Écran Comment jouer (spec 728 §7 — règles courtes et illustrées :
        // la boucle en 3 images, les 3 causes de fin, les 4 jokers).
        commentTitreBoucle: "La boucle en 3 gestes",
        commentBoucle: [
            "Sélectionne un item",
            "Déplace-le sur une case vide",
            "Aligne 3 identiques ou plus : ils disparaissent !"
        ],
        commentTitreFin: "La partie se termine quand…",
        commentTitreJokers: "Les 4 jokers",
        commentJokersIntro: "Gagnés en alignant 5 items ou plus, ou achetés en Boutique (SIM-8).",
        // « La boucle en 3 images » (spec 728 §7) : emoji illustrant chaque
        // geste + libellé court. Les 3 causes de fin reprennent les clés
        // finChrono / finEnergie / finGrillePleine (spec 473 §6).
        commentBoucleEmojis: ["1️⃣", "2️⃣", "3️⃣"],
        commentFinEmojis: ["⏱️", "⚡", "🔲"],
        // Effet en une phrase de chaque joker (spec 728 §3) — {s}/{e} sont
        // les valeurs de config.effetsJokers (rien en dur, spec §10).
        commentJokerEffet: {
            marteau: "Supprime 1 item",
            melange: "Mélange toute la grille",
            sablier: "+{s} s au chrono",
            foudre: "+{e} ⚡"
        },

        meilleurScore: "🏆 Meilleur score : {score}",
        nouveauRecord: "Nouveau record !",

        // Écran de fin (spec §6) — affichés par OverScene.
        partieTerminee: "Partie terminée",
        scoreFinal: "Score : {score}",

        // HUD en jeu (spec §8) — affichés par GameScene. {score}, {s} et {e}
        // sont des emplacements : la valeur est insérée à chaque mise à jour.
        hudScore: "Score : {score}",
        hudChrono: "⏱ {s}",
        hudEnergie: "⚡ {e}",

        // Règle en une phrase (spec §1), affichée sur le menu.
        regle: "Alignez 3 items identiques ou plus en ligne ou en colonne pour les faire disparaître !",

        // Motifs de fin de partie (spec §6) — affichés par OverScene.
        finChrono: "Temps écoulé",
        finEnergie: "Plus d'énergie",
        finGrillePleine: "Grille pleine",

        // Profil persistant (spec 728 §4, §8) — affichés par OverScene
        // (gain de fin de partie) et MenuScene (porte-monnaie).
        gainPieces: "+{pieces} 🪙",      // gain total, écran de fin
        gainPrime: "dont {pieces} 🪙 de prime record !",  // détail prime
        porteMonnaie: "🪙 {pieces}",     // porte-monnaie, HUD du menu

        // Libellés des icônes persistantes Quitter / Plein écran (lus par
        // Arcade.UI.iconesPlateforme via les options de boot — main.js).
        retour: "Retour",
        pleinEcran: "Plein écran",

        // Écrans Boutique / Inventaire (spec 728 §5, §6 — SIM-8).
        // {prix} et {n} sont des emplacements : la valeur est insérée au
        // moment de l'affichage (voir ShopScene / InventaireScene).
        acheter: "Acheter",
        pasAssezPieces: "Pas assez de pièces",
        prixJoker: "{prix} 🪙",       // prix d'un joker en boutique
        possede: "Possédé : {n}",     // quantité déjà possédée (boutique)
        achete: "Acheté !",           // feedback après un achat réussi
        quantite: "× {n}",            // quantité possédée (inventaire)
        renvoiBoutique: "🛒 Achète-le en Boutique"   // renvoi inventaire → boutique (spec 728 §6)
    },

    // --- Grille (spec §2, §4) ----------------------------------------------
    grilleTaille: 9,          // grille fixe 9×9, sans défilement
    itemsDepart: 30,          // items placés au hasard au début d'une partie
    typesItems: 6,            // les 6 items alsaciens (spec §7)
    itemsParCoupRate: 2,      // nouveaux items après un coup raté (spec §3)
    tailleCasePct: 8,         // côté d'une case, en % du plus petit côté
    margeCasePct: 0.4,        // espace entre deux cases, en % du plus petit côté

    // --- Énergie / chrono (spec §4, §5) ------------------------------------
    energieDepart: 25,        // ⚡ de départ
    tempsDepart: 120,         // chrono de départ, en secondes
    energieDeplacement: 1,    // coût en ⚡ d'un déplacement (spec §3) — prélevé
                              // AU DÉPLACEMENT, jamais à la sélection
    dureeDeplacementMs: 150,  // animation de translation d'un déplacement
    chronoAlerteS: 15,        // le chrono passe en rouge sous 15 s (spec §8)
    energieAlerte: 5,         // l'énergie passe en rouge sous 5 ⚡ (spec §8)

    // --- Animation / affichage (spec §8) -----------------------------------
    dureeDisparitionMs: 250,  // fondu + réduction des items fusionnés
    tailleItemPct: 85,        // taille d'un item dans sa case, en % du côté
    selectionAgrandissementPct: 15,  // agrandissement de l'item sélectionné
    tailleTexteGainPct: 3,    // taille du texte flottant des gains, en % du
                              // plus petit côté
    dureeTexteGainMs: 700,    // durée de vie du texte flottant des gains

    // --- Couches de profondeur (SIM-FIX-DEPTH, art. 704) -------------------
    // Phaser dessine dans l'ordre de création : sans setDepth, le fond d'une
    // case créée après un item le recouvre (item sélectionné rogné par ses
    // voisins, items apparus en cours de partie par-dessus le HUD). Couches
    // explicites posées sur TOUS les objets de GameScene, lues ici — rien en
    // dur dans le code (spec §10). La profondeur des items est posée dans
    // _creerSprite pour que tout sprite créé après coup (spawn, déplacement,
    // mélange) reparte sur sa couche.
    profondeurs: {
        fondsCase: 0,          // rectangles des 81 cases
        items: 1,              // sprites des items (posée dans _creerSprite)
        itemSelectionne: 2,    // item agrandi, tant qu'il est sélectionné
        hud: 10,               // HUD (score / ⏱ / ⚡) et barre de jokers
        textesFlottants: 20    // +pts, +s, +⚡, « Combo ×2 ! », « +1 joker »
    },

    // --- HUD (spec §8) -----------------------------------------------------
    // Tout le HUD est en Phaser via Arcade.UI, tailles en % du plus petit
    // côté (u) — jamais d'overlay DOM, jamais de pixels. États d'alerte
    // (SIM-4) : sous chronoAlerteS s / energieAlerte ⚡, le texte concerné
    // passe en rouge et pulse (agrandissement-réduction répété).
    hudTailleTextePct: 5,     // taille des textes Score / ⏱ / ⚡
    hudMargePct: 2,           // marge du HUD par rapport au bord haut
    dureePulseAlerteMs: 300,  // durée d'un aller-retour de la pulsation
    amplitudePulseAlertePct: 12,  // agrandissement max pendant la pulsation

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

    // --- Profil persistant / économie (spec 728 §4, §8) ---------------------
    // Monnaie propre à Similitude (pas de porte-monnaie commun à l'arcade).
    // Aucun achat en argent réel, aucune pub, jamais (spec 728 §4).
    economie: {
        pointsParPiece: 100,      // 1 pièce par tranche de 100 points
                                  // (arrondi à l'inférieur, spec §4)
        primeRecordPieces: 10     // prime quand la partie bat le record
    },

    // Les 4 jokers (spec 728 §3) : la CLÉ est la clé d'inventaire de la
    // save (contrat §8). L'ordre du tableau est l'ordre d'affichage de la
    // barre de jokers (SIM-6). L'emoji est l'icône affichée en jeu (pas de
    // texture dédiée, comme le HUD ⏱ / ⚡ / 🪙). Les effets sont en
    // SIM-6 (effetsJokers ci-dessous).
    jokers: [
        { cle: "marteau", nom: "Marteau", emoji: "🔨" },
        { cle: "melange", nom: "Mélange", emoji: "🌀" },
        { cle: "sablier", nom: "Sablier", emoji: "⏳" },
        { cle: "foudre", nom: "Foudre", emoji: "⚡" }
    ],

    // Effets des jokers (spec 728 §3) — valeurs chiffrées, rééquilibrables.
    // Règle d'or : un joker ne rapporte JAMAIS de point par lui-même (une
    // fusion déclenchée mécaniquement par un joker rapporte 0).
    effetsJokers: {
        sablierSecondes: 30,       // ⏳ +30 s au chrono
        foudreEnergie: 10,         // ⚡ +10 d'énergie
        seuilJokerAlignement: 5    // un alignement de 5 items ou plus offre
                                   // 1 joker tiré au hasard (spec 728 §3)
    },

    // --- Boutique (spec 728 §5 — SIM-8) ------------------------------------
    // Prix d'achat d'un joker à l'unité, en pièces du jeu (data.wallet).
    // Rachetables à l'infini. Prix de départ — John rééquilibrera après
    // test (spec 728 §10 : toutes les valeurs chiffrées vivent ici).
    boutique: {
        prix: {
            marteau: 30,    // 🔨 Marteau
            melange: 40,    // 🌀 Mélange
            sablier: 60,    // ⏳ Sablier
            foudre: 60      // ⚡ Foudre
        }
    },

    // --- Barre de jokers (spec 728 §3) -------------------------------------
    // En bas de l'écran de jeu : une icône par joker avec sa quantité,
    // grisée à zéro. Clic = arme (l'icône s'éclaire) ; re-clic = désarme
    // (rien n'est consommé) ; les jokers à effet immédiat (Mélange,
    // Sablier, Foudre) s'appliquent au clic, le Marteau attend le clic
    // suivant sur un item. Tailles en % du plus petit côté (u), clic/tap.
    barreJokers: {
        tailleIconePct: 7,         // côté d'une icône
        tailleEmojiPct: 4.5,       // taille de l'emoji dans l'icône
        tailleQuantitePct: 2.6,    // taille du nombre (quantité)
        margePct: 1.5,             // espace entre icônes / bord bas
        grisAlpha: 0.25,           // alpha d'une icône à quantité 0
        eclatCouleur: "#fff3c4"    // fond de l'icône ARMÉE (spec §3)
    },

    // --- Menu principal (spec 728 §7 — façon Waggis, SIM-7) ----------------
    // Toutes les tailles en PROPORTION (u = % du plus petit côté) ; les
    // espacements verticaux sont UNIFORMES (menuEspaceU partout), tout est
    // empilé, jamais superposé (règle John 08/08).
    menu: {
        // Bouton « Jouer » pleine largeur : 80 % de la LARGEUR d'écran
        // (pattern Waggis) — référence de largeur de toute la page.
        largeurJouerPct: 80,
        hauteurJouerU: 11.5,
        hauteurSecondaireU: 10.5,
        largeurReglagesU: 15,     // Réglages : taille compacte découplée
        espaceU: 4.5,             // espacement vertical UNIFORME entre étages
        // HUD haut : record et porte-monnaie.
        hudRecordY: 0.055,        // centre du bandeau record (fraction hauteur)
        // Titre + accroche + illustration : ligne commune en paysage
        // (centreLigneY = fraction de la hauteur), empilés en portrait
        // (départ sous le HUD).
        titrePaysageY: 0.26,
        tailleTitreU: 13.5,
        tailleAccrocheU: 4,
        illustrationU: 21,        // hauteur du bloc d'illustration (emojis)
        // Emojis des 6 saveurs alsaciennes — l'« illustration » du menu
        // (pas de sprite dédié : les textures d'items manquent encore,
        // SIM-6 QA) : une ligne de 3 + une ligne de 3, comme une grille.
        illustration: ["🥨", "🐦", "🧁", "🍺", "🥬", "🌺"],
        // Grille 2×2 des boutons secondaires : libellés + emoji d'icône.
        secondaires: [
            { cle: "boutique",    emoji: "🛒", texte: "Boutique" },
            { cle: "inventaire",  emoji: "🎒", texte: "Inventaire" },
            { cle: "classement",  emoji: "🏆", texte: "Classement" },
            { cle: "commentJouer", emoji: "❓", texte: "Comment jouer" }
        ]
    },

    // --- Écran Comment jouer (spec 728 §7 — SIM-FIX-CJ 09/08) ---------------
    // ⭐ GATE John 09/08 : les textes se chevauchaient car les conteneurs
    // étaient dimensionnés depuis le PLUS PETIT côté (u(30)) au lieu de la
    // LARGEUR RÉELLEMENT DISPONIBLE (w) — le wrap serrait le texte dans
    // ~30 % de l'écran et il débordait par-dessus les cartes voisines.
    // Fix : la largeur des cartes = % de la LARGEUR d'écran (même pattern
    // que largeurJouerPct du menu), le texte est posé DANS sa carte avec
    // un wrap dans la largeur restante, espacements verticaux réguliers,
    // jamais superposé (règle John 08/08).
    commentJouer: {
        largeurCartePct: 88,    // largeur des cartes = % de la largeur d'écran
        margeCarteU: 3,         // marge interne gauche/droite d'une carte
        espaceCartesU: 1.2,     // espacement VERTICAL entre cartes empilées
        tailleSectionU: 3.2,    // titres de section (boucle / fins / jokers)
        tailleEmojiU: 4,        // emoji des cartes boucle / fins
        tailleLabelU: 2.7,      // libellé des cartes boucle / fins
        tailleIntroU: 2.5,      // phrase d'intro du bloc jokers
        tailleEmojiJokerU: 4.2, // emoji des cartes jokers
        tailleNomJokerU: 2.6,   // nom d'un joker
        tailleEffetJokerU: 2.2, // effet en une phrase d'un joker
        hauteurCarteMinU: 4.5,  // hauteur minimale d'une carte empilée
        espaceEmojiLabelU: 1.4, // espace entre l'emoji et le texte d'une carte
        // Un emoji est rendu PLUS LARGE que sa taille de police : on réserve
        // taille × ce facteur, sinon le libellé vient se coller à l'emoji.
        largeurEmojiFacteur: 1.25,
        margeTexteU: 0.8,       // marge de sécurité texte / bord de carte
        policeMinU: 1.6,        // plancher de l'ajustement anti-débordement
        // Structure de l'écran (mêmes pattern que Classement / Inventaire).
        titreY: 0.06,           // centre du titre (fraction de la hauteur)
        titreTailleU: 8.5,      // ⚠ doublon volontaire : police du titre
        retourHauteurU: 9,      // hauteur du bouton Retour
        retourLargeurU: 40,     // largeur du bouton Retour
        solY: 0.965,            // ancrage du Retour (fraction de la hauteur)
        bandeHautY: 0.12,       // haut de la bande de contenu
        blocMinU: 6             // hauteur minimale d'un des 3 blocs
    },

    // --- Couleurs -----------------------------------------------------------
    couleurs: {
        fond: "#1f3a2d",
        caseFond: "#2c4f3c",
        caseBordure: "#3d6b52",
        surbrillance: "#fff3c4",   // teinte de l'item sélectionné (spec §3)
        combo: "#F2B93D",          // bannière « Combo ×2 » (spec §5, §8)
        texteContour: "#000000",   // contour du texte flottant des gains
        texte: "#141210",
        texteClair: "#f5f0e6",
        alerte: "#E31B23",        // rouge des états d'alerte du HUD (spec §8)
        bouton: "#E31B23",        // ROUGE charte (Réglages, Retour, Plein écran)
        boutonJouer: "#2E9E4F",   // VERT charte (Jouer — spec 728 §7)
        boutonSecondaire: "#141210",  // NOIR charte (grille 2×2, spec 728 §7)
        // ⭐ Menu façon Waggis (spec 728 §7 — SIM-7) : dégradé de fond vert
        // charte (cielHaut en haut → cielBas en bas), ombre portée des
        // boutons, silhouette de toits alsaciens + bande de sol. Valeurs
        // NUMÉRIQUES obligatoires pour les Graphics (renderer WebGL — QA
        // 08/08, NC1) : ombrePortee s'utilise avec un alpha.
        cielHaut: "#3D7A4F",
        cielBas: "#BFDCC6",
        toits: "#2E5B3A",
        solMenu: "#2E9E4F",
        ombreBouton: "rgba(20, 18, 16, 0.28)",
        ombrePortee: 0x141210
    },

    // --- Police (spec 728 §7 — police Azimut, marque auto-hébergée) --------
    // Même choix que Waggis (spec 709 révision 08/08) : Azimut, police de
    // marque The Elsassisch, auto-hébergée public/fonts/azimut/ (pas de CDN).
    // Le @font-face est injecté par MenuScene ; repli silencieux sur les
    // polices système si la police n'arrive pas (hors ligne).
    police: {
        famille: "'Azimut', 'Baloo 2', 'Nunito', system-ui, sans-serif",
        url: "/fonts/azimut/Azimut-Regular.woff2"
    }
};
