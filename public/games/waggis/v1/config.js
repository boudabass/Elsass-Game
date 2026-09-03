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
 * FIX 06/08/2026 (Décision 1, article 704 — validée John) : AUCUN
 * contrôleur affiché à l'écran — le pavé directionnel et le swipe sont
 * supprimés. Le perso se déplace uniquement par clic/tap AUTOUR de lui,
 * 1 case par clic, dans la direction du clic par rapport au perso
 * (au-dessus → monte, gauche/droite → latéral, en dessous → descend vers
 * une case qui existe déjà). 100 % clic/tap, article 409 — aucun clavier.
 * 1 action = 1 bond d'une case, le monde défile et recycle ses bandes.
 *
 * ÉTAPE 6 : les collisions (Arcade Physics, décision actée) et les
 * conditions de mort du CDC 706 §Conditions arrivent : contact véhicule =
 * mort, chute à l'eau (hors nénuphar) = mort, présent sur les rails au
 * passage du train = mort (bande.estMortelAuPoint). Le bouton « Terminer »
 * provisoire disparaît (la mort le remplace). La menace anti-attente
 * (cigogne) n'est PAS dans cette étape (étape 8 dédiée).
 *
 * D2-3 (spec 708 §1/§8/§9/§10) : le jeu est découpé en NIVEAUX FINIS.
 * La config par niveau vit dans `levels.json` (consultée par
 * LaneGenerator : lignes(niveau) = 42 + niveau, types autorisés, densité,
 * vitesse, max consécutifs — spec 708 §1/§2/§3/§5/§6) ; les valeurs de la
 * section `lanes` ci-dessous deviennent les REPLIS (défauts identiques)
 * si levels.json ne charge pas.
 * ⭐ FIN DE NIVEAU (Décision John 08/08/2026, art. 704) : le pattern
 * VISUEL FIXE remplace la fin « nue » de la spec 708 §10 — chaque niveau
 * se termine par 3 lignes de BÉTON puis 4 lignes d'HERBE avec une MAISON
 * posée sur la dernière ; le joueur traverse les 3 lignes de béton puis
 * l'herbe et ATTEINT LA MAISON = victoire (pas d'arrêt à la 1ʳᵉ ligne de
 * béton, précision John). Pattern identique sur tous les niveaux
 * (levels.json finNiveau fait foi, repli ci-dessous).
 * Mort : relance le même niveau avec le même generatedRows, pas de vies
 * (708 §8). Save : uniquement à la victoire du niveau (708 §9).
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
        // ⭐ REFONTE 08/08/2026 (spec 709 — révision 08/08) : le record du
        // menu passe en « 🏆 Meilleur score : X » (trophée) et une accroche
        // est affichée sous le titre.
        meilleurScore: "🏆 Meilleur score : {score}",
        accroche: "Traverse Strasbourg sans te faire écraser !",
        nouveauRecord: "Nouveau record !",

        // Score affiché pendant la partie (en haut au centre).
        scoreEnCours: "Score : {score}",

        // D2-3 (spec 708 §10 — fin de niveau) : titre de l'écran de
        // victoire et libellé du bouton de passage au niveau suivant.
        niveauReussi: "Niveau {niveau} réussi !",
        niveauSuivant: "Niveau suivant",
        // ⭐ 09/08/2026 : ces deux libellés étaient concaténés en dur dans
        // le code ("Niveau " + n, "★ " + score). Tout texte vu par le
        // joueur vit ici, avec ses emplacements.
        niveauEnCours: "Niveau {niveau}",   // HUD en jeu (haut à gauche)
        meilleurNiveau: "★ {score}",        // score d'une tuile de Niveaux

        // MENU-1 (spec 709, verrouillée 07/08/2026) : les 7 boutons du
        // menu principal (MenuScene). « Jouer » lance le prochain niveau
        // non terminé ; « Quitter » a le même comportement que le bouton
        // retour de la barre du haut (Décision John 07/08 — le jeu tourne
        // en iframe, le retour ramène à la page de l'arcade).
        niveaux: "Niveaux",
        personnages: "Personnages",
        boutique: "Boutique",
        reglages: "Réglages",
        classement: "Classement",
        quitter: "Quitter",

        // « Retour » ramène au menu depuis les écrans du menu (Niveaux,
        // Personnages, Boutique, Réglages, Classement).
        retour: "Quitter",

        // ⭐ FIX 08/08/2026 (assets icônes plateforme, décision John 08/08 —
        // art. 704 Chantier B) : libellés affichés SOUS les icônes
        // persistantes Quitter (haut-gauche) et Plein écran (haut-droite) —
        // lus par Arcade.UI.iconesPlateforme (core/ui.js) via les options de
        // boot (main.js). Le bouton Quitter affiche « Retour » (même
        // comportement que l'ancien lien Retour de la barre GameShell).
        pleinEcran: "Plein écran",

        // MENU-3 (spec 709 §7 boutons — écran Niveaux, LevelsScene) :
        // pagination de la grille (5 × 5 = 25 niveaux par page, ◀ / ▶) et
        // cadenas des niveaux verrouillés (déverrouillage strictement
        // linéaire : terminer le niveau N débloque N+1).
        pagePrecedente: "◀",
        pageSuivante: "▶",
        pageInfo: "Page {page} / {total}",
        verrouille: "🔒",

        // MENU-4 (spec 709 §7 boutons — écran Personnages, CharactersScene,
        // et Boutique, ShopScene) : pièces affichées (data.wallet), sélection
        // du skin actif (un seul à la fois — spec 709), achat des
        // personnages avec les pièces (Boutique — 3 à l'achat + Waggis
        // gratuit de départ). Cosmétique pur, aucun impact gameplay.
        pieces: "Pièces : {pieces}",
        selectionner: "Sélectionner",
        actif: "Actif",
        acheter: "Acheter",
        dejaDebloque: "Déjà débloqué",
        pasAssezPieces: "Pas assez de pièces",
        // ⭐ 09/08 : versions COURTES, utilisées quand la colonne est trop
        // étroite (mobile portrait). Mieux vaut un mot juste et lisible
        // qu'une phrase rétrécie jusqu'à 11 px.
        pasAssezPiecesCourt: "Trop cher",
        dejaDebloqueCourt: "Débloqué",
        gratuit: "Gratuit",
        // ⭐ REFONTE 08/08/2026 (spec 709 — révision 08/08) : le texte des
        // personnages verrouillés passe de « À débloquer dans la Boutique »
        // (répété à l'identique) à « 🔒 Débloque-le en Boutique » — l'icône
        // 🔒 vient du préfixe textes.verrouille (CharactersScene concatène
        // verrouille + aDebloquer).
        aDebloquer: "Débloque-le en Boutique",

        // MENU-5 (spec 709 §7 boutons — écran Réglages, SettingsScene, et
        // Classement, ClassementScene) : le son (on/off UNIQUEMENT — pas de
        // vibration, pas de langue pour l'instant, spec 709), et le
        // classement GÉNÉRAL entre joueurs (cloud — endpoint d'agrégation
        // GET /api/scores vérifié EXISTANT côté backend le 07/08,
        // Arcade.Platform.score.leaderboard).
        sonOn: "Son : Activé",
        sonOff: "Son : Désactivé",
        classementChargement: "Chargement du classement…",
        classementVide: "Aucun score pour l'instant — joue une partie pour apparaître !",
        classementHorsLigne: "Classement indisponible hors ligne."
    },

    // --- Génération des bandes (LaneGenerator) ------------------------------
    // D2-2 (spec 708 §2/§3/§4/§5/§6 — spec détaillée chiffrée, article 708) :
    // 7 types de lignes (herbe, buisson, route, eau, train, terre, piste
    // d'atterrissage), grille de 20 cases de large, tampons obligatoires et
    // aléatoires, véhicules 1 à 4 cases avec vitesse 1.00+0.01×(niveau−1)
    // ±30 %, eau plantes/bateaux en miroir. Toutes les valeurs sont en
    // PROPORTION de l'écran — jamais en pixels.
    lanes: {
        // Hauteur d'une bande, en % de la HAUTEUR d'écran (les bandes sont
        // empilées verticalement, c'est la hauteur qui compte) : 10 % = dix
        // bandes visibles environ, comme Crossy Road.
        hauteurBandePct: 10,

        // Bandes gardées hors écran au-dessus : la génération a toujours
        // quelques bandes d'avance quand le joueur monte (pooling).
        margeBandesHaut: 2,

        // Grille : une ligne fait 20 cases de large (spec 708 §2). Toutes
        // les positions d'obstacles, les largeurs de véhicules (1 à 4 cases)
        // et les densités (75 % max) sont exprimées dans cette grille.
        largeurCases: 20,

        // --- Vitesse des véhicules (spec 708 §5) --------------------------
        // vitesseBase(niveau) = 1.00 + 0.01 × (niveau − 1) → ~2.0 au niveau
        // 100 (repère, pas un plafond). Variance aléatoire de ±30 % autour
        // de la base PAR VÉHICULE (ex. niveau 1 : 0.70 à 1.30).
        // La spec ne fixe pas l'unité absolue du multiplicateur : 1.00 =
        // `vitesseReferenceCasesParSec` cases/seconde, soit ~8 s pour
        // traverser les 20 cases au niveau 1 — cohérent avec l'ancien
        // réglage (routeDureeTraversee base 8 s), conservé pour le game-feel.
        vitesseReferenceCasesParSec: 2.5,
        varianceVitesse: 0.3,

        // --- Véhicules (spec 708 §5) --------------------------------------
        // Occupent 1 à 4 cases, tous types de véhicules mélangés (route/eau/
        // piste), direction alternée par ligne (sens opposé de la ligne de
        // véhicules précédente, comme Frogger).
        vehiculeCases: { min: 1, max: 4 },
        // Densité route/piste : progresse de faible en début de jeu jusqu'à
        // un maximum de 75 % de la ligne occupée par des véhicules. Le
        // plafond 75 % garantit structurellement « toujours au moins un
        // passage traversable » (jamais 100 % bloquée).
        routeDensite: { minFrac: 0.12, maxFrac: 0.75 },

        // --- Eau (spec 708 §6) --------------------------------------------
        // Plantes (plateformes) : 75 % de la bande en début de jeu → 1 à 2
        // plantes seulement en fin de jeu (JAMAIS 0 — garantit le passage).
        eauPlantes: { minFrac: 0.075, maxFrac: 0.75 },
        // Bateaux : miroir de la route — 0 % en début → 75 % max en fin, en
        // REMPLACEMENT des plantes (pas d'addition) : les cases libérées par
        // la baisse du % de plantes sont prises par les bateaux. Case ni
        // plante ni bateau = eau vide = mort au contact.
        eauBateaux: { minFrac: 0, maxFrac: 0.75 },

        // --- Tampons (spec 708 §4) ----------------------------------------
        // Une ligne tampon = 1 à 3 lignes d'affilée (tiré dans cette plage).
        tamponLignes: { min: 1, max: 3 },
        // Groupes de routes qui s'enchaînent (spec 708 §4) : une route peut
        // être suivie d'une autre route (groupe), borné par `max` pour
        // rester franchissable ; à la fin du groupe, transition route→train
        // (avec/sans tampon, tiré au hasard) ou tampon buisson obligatoire.
        routeGroupe: { max: 3, probContinuer: 0.5 },
        // Route → Train : tampon aléatoire, avec ou sans (booléen simple,
        // pas de pourcentage fixé — à caler en jouant, spec 708 §4).
        probRouteVersTrain: 0.5,
        probTamponRouteTrain: 0.5,
        // Piste d'atterrissage : même principe que Route→Train — tampon
        // aléatoire avec ou sans, pas de type de tampon imposé.
        probPisteTampon: 0.5,

        // --- Probabilités des lignes dangereuses, par niveau --------------
        // (niveau − 1) est utilisé : niveau 1 = valeurs de base.
        probRoute: { base: 0.35, parNiveau: 0.07, max: 0.7 },
        probEau: { base: 0.2, parNiveau: 0.05, max: 0.45 },
        probTrain: { base: 0.12, parNiveau: 0.035, max: 0.32 },
        probPiste: { base: 0.08, parNiveau: 0.03, max: 0.25 },

        // Probabilité cumulée maximale d'une bande dangereuse (route + eau +
        // train + piste) : quel que soit le niveau, il reste au moins
        // (1 − dangerMax) de lignes sûres (respiration obligatoire).
        dangerMax: 0.85,

        // Répartition des lignes SÛRES (choix libre) : herbe (générique) +
        // buisson et terre libres — nécessaires pour OUVRIR les chaînes de
        // tampons (une route ne suit qu'un buisson, un train qu'une terre,
        // une eau qu'une herbe, spec 708 §4).
        poidsSains: { herbe: 0.6, buisson: 0.2, terre: 0.2 },

        // ⭐ Fin de niveau (Décision John 08/08/2026, art. 704) : pattern
        // VISUEL FIXE de fin — 3 lignes de BÉTON puis 4 lignes d'HERBE avec
        // une MAISON posée sur la dernière (voir levels.json finNiveau,
        // qui fait foi ; ce bloc est le repli si le fichier ne charge pas).
        // Le béton est une ligne SÛRE (le joueur la traverse sans danger),
        // simple marqueur visuel d'approche de la fin ; la victoire se
        // déclenche quand le joueur ATTEINT LA MAISON (GameScene).
        finNiveau: { beton: 3, herbe: 4 },

        // --- Train (comportement étape 4 conservé) ------------------------
        // Durée (en secondes) que le train met à traverser l'écran. Rapide
        // (2-3x plus court que les voitures) et diminue avec la difficulté.
        railDureeTraversee: { base: 2.2, parNiveau: 0.15, min: 1.2 },

        // Durée du signal (feux + son) avant le passage, en ms. Constante —
        // c'est la fenêtre pour QUITTER les rails.
        railAvertissementMs: 2000,

        // Attente moyenne (ms) entre deux passages ; diminue avec la
        // difficulté (trains plus fréquents). Un aléa ±30 % est appliqué
        // par LaneGenerator pour éviter des passages métronomiques.
        railAttente: { base: 6500, parNiveau: 400, min: 3500 },

        // --- Herbe (zone sûre) : vigne et décor ---------------------------
        // Probabilité que ce soit une vigne plutôt qu'une prairie, et nombre
        // de décorations (arbres/buissons) sur une prairie.
        probVigne: 0.3,
        decor: { min: 0, max: 3 },
        // Terre (tampon du train) : quelques buissons épars, plus clairsemés
        // qu'une prairie (sol nu).
        decorTerre: { min: 0, max: 2 }
    },

    // --- Contrôles (FIX 06/08/2026 — Décision 1, article 704 : 100 %
    // clic/tap, article 409, AUCUN clavier) -------------------------------
    // AUCUN contrôleur affiché à l'écran : le perso se déplace par
    // clic/tap AUTOUR de lui, 1 case par clic, dans la direction du clic
    // par rapport au perso (au-dessus → monte, gauche/droite → latéral,
    // en dessous → descend vers une case qui existe déjà). Un clic sur le
    // perso lui-même (zone morte) ne déclenche rien.
    controles: {
        // Zone morte autour du perso, en fraction de SA TAILLE affichée :
        // un clic/tap dans ce carré (sur le perso) n'a pas de direction et
        // ne déclenche aucun bond (article 704 — « autour du perso »).
        zoneMorteClic: 0.5,

        // Durée d'un bond (ms). Les entrées sont ignorées pendant le bond :
        // 1 action = 1 bond.
        bondDureeMs: 170,

        // Hauteur de l'arc du bond, en fraction de la hauteur d'une bande.
        bondHauteur: 0.35,

        // Défilement du monde : quand le joueur franchit ce seuil
        // (fraction de la HAUTEUR d'écran) en avançant, le monde glisse
        // d'une bande pour le rattraper — bandes sorties recyclées
        // (pooling) — et le joueur reste dans la même zone de l'écran, à
        // l'infini. Reculer est l'inverse exact : le monde glisse vers le
        // haut à chaque bond arrière (voir LaneGenerator.reculer()).
        seuilDefileHaut: 0.38,

        // Personnage : taille en fraction de la hauteur d'une bande.
        persoTaille: 0.75,

    },

    // --- Collisions (étape 6, CDC 706 §Conditions — Arcade Physics) ------
    collisions: {
        // Taille de la HITBOX du personnage, en fraction de sa taille
        // affichée (persoTaille × hauteur de bande). Plus petite que le
        // sprite : un contact « de justesse » sur le coin du dessin ne
        // tue pas (fair-play, comme Crossy Road où la hitbox est plus
        // petite que le personnage).
        persoHitbox: 0.5
    },

    // --- Sauvegarde (D2-1, spec 708 §7 — contrat { v, t, data }) --------
    save: {
        // Version du FORMAT de sauvegarde Waggis (cf. core/save.js).
        // Incrémenter à chaque changement de format ET écrire la migration
        // correspondante dans main.js — on ne casse jamais la partie d'un
        // joueur (règle du socle). v2 = generatedRows (le monde procédural
        // généré, spec 708 §7) ajouté au format.
        // v3 (ETAPE-7, CDC 706 §Score/save) = data.wallet (pièces, monnaie
        // de déblocage) et data.unlockedCharacters (skins débloqués)
        // ajoutés au format. La MÉCANIQUE pièces/déblocage est post-MVP
        // (scope PRD 705) : le contrat est prêt, les valeurs restent à
        // leurs défauts (0 pièce, seul le Waggis débloqué — le perso de
        // départ est gratuit, comme le poulet de Crossy Road).
        // v4 (D2-3, spec 708 §1/§9/§10) = data.currentLevel (le niveau en
        // cours, CDC 706 §Score/save) ajouté au format. La save n'intervient
        // QU'À LA VICTOIRE du niveau (708 §9) : currentLevel y progresse
        // (victoire du niveau N → currentLevel N+1), generatedRows y est
        // celui du niveau gagné — une fermeture en cours de niveau ne
        // sauvegarde RIEN (le niveau est régénéré à zéro au relancement).
        // v5 (MENU-2, spec 709 §Données nécessaires) = data.activeCharacter
        // (personnage actif sélectionné, défaut "waggis" — le seul débloqué
        // au MVP, la sélection arrive avec l'écran Personnages MENU-4) et
        // data.bestScores (meilleur score PAR NIVEAU, map niveau→score,
        // défaut {}) ajoutés au format — l'écran Niveaux (MENU-3) affichera
        // l'état de chaque niveau + son meilleur score (709).
        version: 5
    },

    // --- Personnages (MENU-4, spec 709 §7 boutons) -------------------------
    // Les SKINS jouables : le Waggis (gratuit, débloqué d'office — le perso
    // de départ, PRD 705) + les 3 personnages disponibles À L'ACHAT au
    // lancement (Boutique, achat avec les pièces de data.wallet).
    // Cosmétique pur : un skin ne change AUCUNE mécanique de jeu (709).
    //
    // ASSETS : aucun sprite de Waggis dans l'atelier (vérifié 06/08) — les 4
    // personnages sont des piétons p8city (8×8, 3 frames de marche chacun,
    // cf. GameScene). Le rouge est le Waggis actuel (placeholder), le bleu,
    // l'orange et le rose sont les 3 skins à l'achat. Chaque entrée :
    //   id      : identifiant de save (data.unlockedCharacters /
    //             data.activeCharacter)
    //   nom     : libellé affiché (écrans Personnages / Boutique)
    //   prix    : coût en pièces (data.wallet) — 0 = gratuit (débloqué
    //             d'office, jamais dans la boutique)
    //   frames  : textures de marche (repos = frames[0]), clés chargées
    //             dans main.js
    personnages: {
        waggis: {
            nom: "Waggis",
            prix: 0,
            frames: ["pieton_rouge_1", "pieton_rouge_2", "pieton_rouge_3"]
        },
        pieton_bleu: {
            nom: "Piéton bleu",
            prix: 100,
            frames: ["pieton_bleu_1", "pieton_bleu_2", "pieton_bleu_3"]
        },
        pieton_orange: {
            nom: "Piéton orange",
            prix: 200,
            frames: ["pieton_orange_1", "pieton_orange_2", "pieton_orange_3"]
        },
        pieton_rose: {
            nom: "Piéton rose",
            prix: 300,
            frames: ["pieton_rose_1", "pieton_rose_2", "pieton_rose_3"]
        }
    },

    // --- Listes des écrans (Personnages, Boutique, Classement) --------------
    // ⭐ FIX 09/08/2026 : ces largeurs étaient calculées avec u() — donc en
    // % du PLUS PETIT CÔTÉ. Sur un écran paysage, une liste u(76) ne fait
    // que ~37 % de la largeur : lignes étriquées au milieu de l'écran et
    // textes qui se replient pour rien. La largeur d'un conteneur
    // horizontal se calcule TOUJOURS en % de la largeur réelle `w`
    // (les hauteurs et les polices, elles, restent en u()).
    listes: {
        largeurPct: 76,         // Personnages / Boutique : % de la largeur
        largeurClassementPct: 60,   // Classement : tableau rang/nom/score
        largeurMaxU: 110,       // garde-fou : jamais plus large que u(110),
                                // sinon une ligne s'étire sur un écran très
                                // large et le texte se perd dans le vide
        // Marge latérale de la grille de Niveaux : sans elle, la tuile est
        // calculée sur (w − gaps) / 5 et la grille colle EXACTEMENT aux
        // deux bords de l'écran en mobile portrait (412 px sur 412).
        margeGrilleU: 4,
        // ⭐ Pagination ADAPTATIVE (09/08). Sur un écran écrasé en hauteur
        // (mobile en paysage), remplir la page au nombre maximal donnait
        // des lignes de 22 px et des tuiles de 38 px : illisible et
        // difficile à viser du doigt. On affiche donc MOINS d'éléments par
        // page plutôt que des éléments trop petits.
        entreesParPageMax: 10,      // Classement : 10 entrées au mieux…
        entreesParPageMin: 4,       // …mais jamais moins de 4
        grilleLignesMax: 5,         // Niveaux : grille 5 × 5 au mieux…
        grilleLignesMin: 3,         // …mais jamais moins de 3 lignes
        // ⚠️ Les DEUX seuils ci-dessous sont en PIXELS ABSOLUS, seule
        // entorse assumée à la règle « tout en % de l'écran ». Ce sont des
        // seuils d'ACCESSIBILITÉ, pas des dimensions de mise en page : un
        // texte de 10 px reste illisible et une cible de 38 px reste
        // difficile à viser, quelle que soit la taille de l'écran. Un
        // seuil exprimé en u() suivrait la taille de l'écran et raterait
        // donc exactement le cas qu'il doit attraper.
        policeMinPx: 13,            // sous 13 px, une ligne ne se lit plus
        tuileMinPx: 44              // cible tactile minimale (règle iOS/Android)
    },

    // --- Couleurs -----------------------------------------------------------
    couleurs: {
        ciel: "#87ceeb",
        texte: "#141210",
        texteClair: "#ffffff",
        bouton: "#E31B23",
        // ⭐ FIX 08/08/2026 (couleurs des boutons, décision John 08/08 —
        // couleur PAR BOUTON dans le composant Arcade.UI.bouton) : NOIR
        // par défaut pour les boutons secondaires (Niveaux, Personnages,
        // Boutique, Classement — grille 2×2), ROUGE pour Retour / Plein
        // écran / Réglages, VERT pour le bouton Jouer.
        boutonSecondaire: "#141210",
        boutonJouer: "#2E9E4F",
        // Encadré du record sur l'écran de fin : orange, texte noir à
        // l'intérieur (lisible sur le fond bleu ciel).
        encadreRecord: "#F2B93D",
        // MENU-3 (spec 709 — écran Niveaux, LevelsScene) : couleurs des
        // tuiles selon l'état du niveau — complété (vert), verrouillé
        // (gris) ; « en cours » utilise la couleur bouton (rouge Waggis).
        complete: "#2E9E4F",
        verrouille: "#8A8A8A",
        // Bande rails : lit de ballast (gravier) sous la voie — la texture
        // rogrpg_rails est ajourée, le fond opaque est dessiné en dessous.
        ballast: "#5c5750",
        // Feux de croisement des bandes rails (cercles, signal visuel avant
        // le passage du train). Couleur NUMÉRIQUE obligatoire : le renderer
        // WebGL ne convertit pas les chaînes CSS pour les Graphics — une
        // chaîne '#ff2222' rend les cercles en noir (QA 06/08).
        feuSignal: 0xff2222,

        // ⭐ REFONTE menu 08/08/2026 (spec 709 — révision 08/08) : visuel
        // du menu principal — dégradé de ciel (deux teintes interpolées,
        // cielHaut en haut → cielBas en bas), silhouette des toits
        // alsaciens + bande de sol en bas d'écran, ombre portée des
        // boutons, fond blanc des boutons ronds d'icônes (liseré rouge
        // Waggis = couleur bouton).
        cielHaut: "#4FA8E8",
        cielBas: "#D9EFFC",
        toits: "#8C3B42",
        solMenu: "#7CB85C",
        ombreBouton: "rgba(20, 18, 16, 0.28)",
        iconeFond: "#FFFFFF",

        // ⭐ REFONTE écrans secondaires 08/08/2026 (spec 709 — révision
        // 08/08) : cartes niveaux/personnages avec ombre portée + coins
        // arrondis, état verrouillé = overlay semi-transparent + cadenas
        // fin, sélection active = bordure/glow au lieu de l'aplat vert.
        // VALEURS NUMÉRIQUES OBLIGATOIRES pour les Graphics (le renderer
        // WebGL ne convertit pas les chaînes CSS — QA 08/08, NC1) :
        // ombrePortee s'utilise avec un alpha (ex. fillStyle(0x141210,
        // 0.25)) ; fondCarte et liseretActif sont convertis par
        // Phaser.Display.Color.HexStringToColor(...).color.
        ombrePortee: 0x141210,
        fondCarte: "#FFFFFF",
        liseretActif: "#2E9E4F",
    },

    // --- Police (REFONTE 08/08/2026, spec 709 — révision 08/08) -----------
    // « Police système par défaut → police ronde/friendly type jeu mobile ».
    // Choix studio : Azimut, la police de marque The Elsassisch, déjà
    // auto-hébergée dans public/fonts/azimut/ (licence CC BY-ND 4.0, voir
    // src/lib/fonts.ts) — pas de CDN externe. Seul le Regular est chargé
    // (règle marque : pas de graisse grasse — l'emphase se fait par la
    // taille et les MAJUSCULES). Le @font-face est injecté par MenuScene ;
    // repli silencieux sur les polices système si la police n'arrive pas
    // (hors ligne).
    police: {
        famille: "'Azimut', 'Baloo 2', 'Nunito', system-ui, sans-serif",
        url: "/fonts/azimut/Azimut-Regular.woff2"
    }
};
