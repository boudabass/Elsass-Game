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
 * ÉTAPE 3 : le terrain généré par LaneGenerator comprend en plus les bandes
 * eau (cours d'eau avec nénuphars rogrpg qui dérivent — le joueur devra
 * rester dessus, la chute à l'eau = mort sera branchée à l'étape collisions).
 * Les rails arrivent à l'étape suivante. Le personnage et les contrôles
 * (100 % clic/tap, article 409) aussi. L'ObstaclePool (véhicules/rondins/
 * trains) sera déduit du pooling déjà en place dans LaneGenerator.
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
        finirProvisoire: "Terminer (provisoire)"
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
        // le passage du train).
        feuSignal: "#ff2222"
    }
};
