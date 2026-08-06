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
 * 1 action = 1 bond d'une case, le monde défile et recycle ses bandes
 * pour une avancée infinie.
 *
 * ÉTAPE 6 : les collisions (Arcade Physics, décision actée) et les
 * conditions de mort du CDC 706 §Conditions arrivent : contact véhicule =
 * mort, chute à l'eau (hors nénuphar) = mort, présent sur les rails au
 * passage du train = mort (bande.estMortelAuPoint). Le bouton « Terminer »
 * provisoire disparaît (la mort le remplace). La menace anti-attente
 * (cigogne) n'est PAS dans cette étape (étape 8 dédiée).
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

        // Score affiché pendant la partie (en haut au centre).
        scoreEnCours: "Score : {score}"
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
        version: 2
    },

    // --- Couleurs -----------------------------------------------------------
    couleurs: {
        ciel: "#87ceeb",
        texte: "#141210",
        texteClair: "#ffffff",
        bouton: "#E31B23",
        // Encadré du record sur l'écran de fin : orange, texte noir à
        // l'intérieur (lisible sur le fond bleu ciel).
        encadreRecord: "#F2B93D",
        // Bande rails : lit de ballast (gravier) sous la voie — la texture
        // rogrpg_rails est ajourée, le fond opaque est dessiné en dessous.
        ballast: "#5c5750",
        // Feux de croisement des bandes rails (cercles, signal visuel avant
        // le passage du train). Couleur NUMÉRIQUE obligatoire : le renderer
        // WebGL ne convertit pas les chaînes CSS pour les Graphics — une
        // chaîne '#ff2222' rend les cercles en noir (QA 06/08).
        feuSignal: 0xff2222
    }
};
