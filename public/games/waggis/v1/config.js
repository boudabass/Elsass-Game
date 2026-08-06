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
 * ÉTAPE 5 : le personnage et les contrôles arrivent (100 % clic/tap,
 * article 409 — aucun clavier) : swipe mobile (haut = avancer, bas/gauche/
 * droite = reculer/latéral) et pavé directionnel VISIBLE à l'écran pour le
 * PC (équivalent obligatoire du clavier, CDC 706 §Contrôles — tout élément
 * interactif est visible). 1 action = 1 bond d'une case, le monde défile et
 * recycle ses bandes pour une avancée infinie. Les collisions et la mort
 * restent à l'étape suivante (le bouton « Terminer » provisoire demeure).
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
        // Étape 1 : panneau provisoire de la scène de jeu, affiché en
        // attendant la génération des bandes (étape 2). Retiré à l'étape 2 :
        // le terrain généré remplace le panneau.
        finirProvisoire: "Terminer (provisoire)",

        // Étape 5 : pavé directionnel (PC — équivalent obligatoire du
        // clavier, article 409). Flèches Unicode, lisibles partout.
        flecheHaut: "▲",
        flecheBas: "▼",
        flecheGauche: "◀",
        flecheDroite: "▶",
        // Score affiché pendant la partie (en haut au centre).
        scoreEnCours: "Score : {score}"
    },

    // --- Génération des bandes (LaneGenerator) ------------------------------
    // Étape 2 : bandes zone_sure (prairie/vigne) et route (véhicules
    // latéraux). Étape 3 : bandes eau (nénuphars qui dérivent). Étape 4 :
    // bandes rails (voie ferrée, train rapide prévenu par signal). Toutes
    // les valeurs sont en PROPORTION de l'écran — jamais en pixels.
    lanes: {
        // Hauteur d'une bande, en % de la HAUTEUR d'écran (les bandes sont
        // empilées verticalement, c'est la hauteur qui compte) : 10 % = dix
        // bandes visibles environ, comme Crossy Road.
        hauteurBandePct: 10,

        // Bandes gardées hors écran au-dessus : la génération a toujours
        // quelques bandes d'avance quand le joueur monte (pooling).
        margeBandesHaut: 2,

        // Route : durée (en secondes) qu'un véhicule met à traverser
        // l'écran. Elle diminue avec la difficulté (trafic plus rapide).
        routeDureeTraversee: { base: 8, parNiveau: 0.6, min: 3.5 },

        // Route : nombre de véhicules par bande (densité du trafic).
        routeVehicules: { min: 1, max: 6, base: 2, parNiveau: 0.5 },

        // Anti-frustration (CDC 706 §Génération) : deux bandes route
        // consécutives, la deuxième est plus clémente (moins de véhicules,
        // véhicules plus lents) pour rester franchissable.
        route2eConsecutive: { densite: 0.7, vitesse: 0.85 },

        // Eau : durée (en secondes) qu'un nénuphar met à traverser l'écran
        // (le courant). Elle diminue avec la difficulté (dérive plus rapide).
        eauDureeTraversee: { base: 9, parNiveau: 0.5, min: 4 },

        // Eau : nombre de nénuphars par bande (densité de prise — plus il y
        // en a, plus la traversée est facile).
        eauFlottants: { min: 2, max: 6, base: 3, parNiveau: 0.4 },

        // Anti-frustration (CDC 706 §Génération) : deux bandes eau
        // consécutives, la deuxième est plus clémente (courant plus lent,
        // nénuphars plus nombreux) pour rester franchissable.
        eau2eConsecutive: { densite: 1.3, vitesse: 0.85 },

        // Rails : durée (en secondes) que le train met à traverser l'écran.
        // Rapide (2-3x plus court que les voitures) et diminue avec la
        // difficulté.
        railDureeTraversee: { base: 2.2, parNiveau: 0.15, min: 1.2 },

        // Rails : durée du signal (feux + son) avant le passage, en ms.
        // Constante — c'est la fenêtre pour QUITTER les rails.
        railAvertissementMs: 2000,

        // Rails : attente moyenne (ms) entre deux passages ; diminue avec
        // la difficulté (trains plus fréquents). Un aléa ±30 % est appliqué
        // par LaneGenerator pour éviter des passages métronomiques.
        railAttente: { base: 6500, parNiveau: 400, min: 3500 },

        // Anti-frustration (CDC 706 §Génération) : deux bandes rails
        // consécutives, la deuxième est plus clémente (signal plus long,
        // train plus rare et plus lent) pour rester franchissable.
        rail2eConsecutive: { avertissement: 1.3, attente: 1.3, vitesse: 0.85 },

        // Choix du type de bande : probabilité de route, d'eau et de rails,
        // qui montent avec la difficulté. Jamais plus de 2 bandes
        // dangereuses consécutives du même type (cf. LaneGenerator).
        probRoute: { base: 0.35, parNiveau: 0.07, max: 0.7 },
        probEau: { base: 0.2, parNiveau: 0.05, max: 0.45 },
        probRails: { base: 0.12, parNiveau: 0.035, max: 0.32 },

        // Probabilité cumulée maximale d'une bande dangereuse (route + eau +
        // rails) : quel que soit le niveau, il reste au moins (1 - dangerMax)
        // de zones sûres (respiration obligatoire, CDC 706 §Génération).
        dangerMax: 0.85,

        // Bande juste au-dessus du départ : quasi toujours une zone sûre,
        // pour laisser le joueur prendre ses marques.
        probZoneSureApresDepart: 0.8,

        // Zone sûre : probabilité que ce soit une vigne plutôt qu'une
        // prairie, et nombre de décorations (arbres/buissons) sur une
        // prairie.
        probVigne: 0.3,
        decor: { min: 0, max: 3 }
    },

    // --- Contrôles (étape 5, CDC 706 §Contrôles — 100 % clic/tap, article
    // 409, AUCUN clavier) ----------------------------------------------------
    // 1 action = 1 bond d'une case, pas de déplacement continu. Les deux
    // entrées coexistent sur tous les appareils :
    //  - swipe (mobile) : haut = avancer, bas/gauche/droite = reculer/latéral ;
    //  - pavé directionnel VISIBLE à l'écran (PC — équivalent obligatoire
    //    du clavier ; « tout élément interactif doit être visible », article
    //    409 — préféré au clic-glissé par le CDC).
    controles: {
        // Distance minimale du geste (en % du plus petit côté) pour être un
        // swipe : en dessous, c'est un tap sans direction (aucun bond).
        seuilSwipePct: 3,

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

        // Pavé directionnel : taille des boutons et écart centre-à-centre
        // en % du plus petit côté (u), position du centre du pavé en % de
        // la largeur / hauteur de l'écran. (82 % : le pavé reste entière-
        // ment à l'écran sur mobile portrait ET desktop — le bouton ▼ ne
        // dépasse pas en bas, le ▶ pas à droite, cf. tests.)
        boutonTaille: 10,
        boutonEcart: 12,
        paveX: 82,
        paveY: 82
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
