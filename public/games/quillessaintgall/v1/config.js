/*
 * config.js — réglages du spike « collision boule/quilles » de Quilles
 * Saint-Gall (PRD article 875 §3-6).
 *
 * Prototype isolé (une scène de test) : AUCUN niveau, AUCUNE des 6 phases
 * des 17 jets (article 875 §6-8) — un seul jet « jeu plein » rejouable à
 * l'infini. Ce spike valide, avant de construire la structure complète :
 *   1. la VUE DU DESSUS + les 9 quilles en carré 3×3 (numérotées 1-9,
 *      quille 5 = le Roi, plus grande) ;
 *   2. la PHYSIQUE DE COLLISION boule/quilles (test de distance manuel,
 *      cf. TestScene) : la boule roule en ligne droite vers le haut,
 *      chaque quille touchée tombe et sort du jeu ;
 *   3. le TIR EN 2 ÉTAPES RÉUTILISÉ de Schieweschlawe (873 §5) : placement
 *      de la boule dans un DEMI-CERCLE (glisser libre 2D) dont le côté
 *      plat est collé à la ligne de lancer, orientation de la visée via 2
 *      boutons ◄/► EN BAS de la zone de recul (rotation, 1° par clic, max
 *      10° de chaque côté), FORCE du tir réglable via 2 boutons -/+ EN
 *      HAUT de la colonne de droite (au-dessus de « Tirer », avec une
 *      barre de niveau) : plus la force est haute, plus le tir est rapide
 *      MAIS plus la zone orange de la jauge est étroite (plus dur à
 *      réussir). Puis jauge à aiguille mobile + zone orange fixe. Ici la
 *      déviation est un ANGLE (pas une distance) : un tir manqué fait
 *      dévier la trajectoire de la boule par rapport à l'angle choisi
 *      plutôt que de rater le terrain.
 *
 * Même convention que les autres jeux : toutes les valeurs chiffrées vivent
 * ICI, tous les textes joueur dans `textes`, tailles en % d'écran (u() pour
 * polices/hauteurs/marges, % de largeur réelle pour la jauge).
 */
window.QuillesSaintGallConfig = {
    key: "quillessaintgall",
    titre: "Quilles Saint-Gall",

    // --- Textes (libellés français, tous les textes joueur) ----------------
    textes: {
        sousTitre: "Spike — collision boule / quilles",
        consigneLigne1: "Place la boule, oriente avec ◄ ►",
        consigneLigne2: "Règle la force avec -/+, puis « Tirer »",
        force: "Force",
        tirer: "Tirer",
        arreter: "Tape pour arrêter",
        conforme: "Conforme !",
        manque: "Manqué",
        rejouer: "Rejouer",
        quillesTombees: "Quilles tombées : {n}/9",
        roiTombe: " · Roi touché !",
        aucune: "Aucune quille touchée"
    },

    // --- Piste (vue du dessus) ----------------------------------------------
    piste: {
        ligneLancerYPct: 80,        // % hauteur : ligne de lancer (haut de la zone de recul)
        quillesZoneHautYPct: 12,    // % hauteur : rangée du fond (quilles 1-2-3)
        quillesZoneBasYPct: 34,     // % hauteur : rangée avant (quilles 7-8-9)
        // Marge latérale entre les quilles et le bord de la piste, % de la
        // largeur de la piste (demande John, 30/08 : laisser de l'espace
        // visible de chaque côté plutôt que des quilles collées au bord).
        quillesMargeLateralePct: 20
        // Pas de largeur totale ici : la largeur de la piste (et donc des 3
        // colonnes de quilles, marge déduite) est TOUJOURS celle de la
        // colonne du milieu du bas d'écran (1/3 de l'écran, cf.
        // TestScene._positionnerQuilles / _dessinerDecor) — c'est la seule
        // zone que la boule peut atteindre (elle part de la colonne du
        // milieu et roule tout droit). Une largeur de quilles différente de
        // la largeur de visée rend des quilles hors de portée (bug corrigé
        // le 30/08 : les quilles débordaient sur 46% d'écran contre 33%
        // visable).
    },

    // --- Zone de recul : demi-cercle de placement + boutons de rotation -----
    // (demande John, 30/08, revu une 2e fois le même jour). La boule se
    // place n'importe où DANS le demi-cercle (glisser 2D) ; la direction du
    // tir n'est PLUS déduite de la position de la boule mais des boutons
    // ◄/► (rotation). Les deux se combinent au lancer : la boule part de sa
    // position dans le demi-cercle, dans la direction choisie via les
    // boutons (+ déviation de la jauge en cas de tir raté).
    recul: {
        // Le demi-cercle « part de la piste sur toute sa largeur » : son
        // diamètre = la largeur pleine de la piste (colLargeur), le côté
        // plat collé à la ligne de lancer, la courbe vers le bas. Rayon
        // plafonné à ce facteur × la hauteur de la zone de recul pour
        // TOUJOURS laisser de la place aux boutons en bas (même en paysage,
        // où la zone de recul est large mais basse).
        demiCercleRayonMaxFacteurHauteur: 0.6,
        rotationMaxDeg: 10,         // rotation max de la visée, de chaque côté du tout droit
        rotationStepDeg: 1          // incrément par clic sur un bouton ◄/► (10 clics = le max)
    },

    // --- Quilles (9, carré 3×3, quille 5 = le Roi) --------------------------
    quille: {
        rayonPct: 2.4,               // % du plus petit côté (quilles normales)
        rayonRoiPct: 3.1,            // le Roi, plus grand (rappel : +4 cm en réel)
        // Rayon de collision = rayon visuel × ce facteur. À 1, la hitbox est
        // PILE la taille visuelle de la quille (demande John, 30/08 — plus
        // d'inflation artificielle). Une boule qui ne peut pas passer sans
        // toucher entre le Roi et sa voisine est un résultat PHYSIQUE
        // correct (le Roi est réellement plus gros, donc l'écart réel entre
        // lui et sa voisine est plus petit) — pas un bug de hitbox.
        rayonCollisionFacteur: 1,
        // Ralentissement d'une quille qui glisse après avoir été renversée
        // (demande John, 30/08 : la quille doit vraiment se déplacer, pas
        // juste basculer sur place) — fraction de sa vitesse perdue par
        // seconde. Plus haut = elle s'arrête plus vite.
        frictionGlissementPar_s: 4
    },

    // --- Boule ---------------------------------------------------------------
    boule: {
        rayonPct: 2.6,
        vitessePctH_par_s: 55,       // vitesse de déplacement, % de hauteur écran / s
        // Vitesse conservée après un rebond sur une quille QUI NE TOMBE PAS
        // (choc trop faible, § vitesseMinRenversePct) : la quille agit comme
        // un mur, la boule rebondit presque intégralement (1 = rebond
        // parfait, 0 = arrêt net).
        amortissementRebond: 0.7,
        // Transfert de quantité de mouvement quand la quille TOMBE (demande
        // John, 30/08, précisée une 2e fois) : la boule NE REBONDIT JAMAIS
        // vers l'arrière dans ce cas — elle continue TOUJOURS dans sa
        // direction initiale (« si je tape une quille de face, elle doit
        // pouvoir continuer »), le rebond façon "mur" ne s'applique QUE si
        // la quille ne tombe pas (cf. `amortissementRebond` ci-dessus). La
        // FRACTION de vitesse conservée (par la boule ET la quille, qui est
        // poussée dans cette même direction) monte avec la vitesse
        // d'impact : `transfertFacteurMin` juste au-dessus du seuil de
        // renversement, jusqu'à `transfertFacteurMax` à la vitesse de
        // lancer maximale (force à 100%). Cf. TestScene._reagirCollision.
        transfertFacteurMin: 0.2,
        transfertFacteurMax: 0.45,
        // Ralentissement continu appliqué à la boule à CHAQUE frame une
        // fois qu'elle a touché au moins une quille (demande John, 30/08 :
        // sans ça, une boule qui continue tout droit après un choc ne
        // ralentit plus jamais toute seule). Fraction de vitesse perdue par
        // seconde, en plus de l'éventuel rebond/transfert au contact lui-même.
        frictionApresChocPar_s: 1.2,
        // Vitesse en dessous de laquelle la boule est considérée arrêtée
        // (% de hauteur écran / s) — filet de sécurité après plusieurs
        // rebonds qui l'ont ralentie, pour ne jamais la laisser trembler
        // indéfiniment coincée entre des quilles.
        vitesseArretPct: 3,
        // Vitesse minimale (% de hauteur écran / s) pour RENVERSER une
        // quille au contact (demande John, 30/08). En dessous, la boule
        // rebondit quand même (choc réel, cf. TestScene._reagirCollision)
        // mais la quille reste debout — trop lente pour avoir la force de
        // la faire tomber. Entre `vitesseArretPct` (3) et la vitesse de
        // lancer (55), pour laisser 2-3 quilles tomber sur un tir fort
        // avant que la boule, ralentie par les rebonds, devienne trop
        // faible.
        vitesseMinRenversePct: 15,
        // Vitesse du lancer = vitessePctH_par_s × un facteur qui dépend de
        // la FORCE choisie (§ force ci-dessous), interpolé entre ces 2
        // bornes (demande John, 30/08 : 2 boutons pour régler la force).
        forceVitesseMinFacteur: 0.6,
        forceVitesseMaxFacteur: 1.4
    },

    // --- Force du tir (2 boutons -/+ , colonne de droite au-dessus de
    // « Tirer », demande John 30/08) --------------------------------------
    // Plus la force est haute, plus le tir est rapide (boule.force*Facteur)
    // MAIS plus il est risqué : la zone orange de la jauge de précision
    // rétrécit (jauge.zoneOrangeLargeur Max→Min ci-dessous).
    force: {
        min: 0,
        max: 100,
        step: 10,        // incrément par clic sur -/+ (10 clics = min→max)
        defaut: 50
    },

    // --- Jauge de précision (étape 2 du tir, réutilisation de 873 §5) -------
    // Un seul élément mobile (l'aiguille) ; la zone orange (le bon endroit)
    // est tirée au hasard une seule fois par tir et ne bouge plus. Sa
    // LARGEUR dépend de la force choisie (interpolée Max→Min).
    jauge: {
        // ÷2 (demande John, 30/08 : l'aiguille allait trop vite à 1.1).
        vitesseBalayagePar_s: 0.55,
        zoneOrangeLargeurMaxPct: 24,   // force = 0 (facile)
        zoneOrangeLargeurMinPct: 8,    // force = 100 (difficile)
        delaiFeedbackMs: 500,
        deviationAngleMaxDeg: 20,    // déviation angulaire max en cas d'arrêt raté extrême
        largeurPct: 60,
        hauteurU: 5
    },

    // --- Couleurs (vue du dessus, piste couverte — pas de vent/nuit) --------
    couleurs: {
        ciel: "#12161f",
        piste: "#7a5233",           // brun (bois/asphalte) — demande John : piste visible
        pisteBord: "#4a3220",
        recul: "#0e1420",
        texte: "#e8eef7",
        texteSombre: "#141210",
        quille: "#e8e2d0",
        quilleTombee: "#4a4f5c",
        quilleRoi: "#ffd23f",
        quilleContour: "#2b3547",
        boule: 0xff7a1a,
        bouleClair: 0xffd23f,
        ombreBoule: 0x000000,
        trajectoire: "#8fd3ff",
        cercle: "#8fd3ff",
        bouton: "#2E9E4F",
        boutonRotation: "#1d3557",
        force: "#e08f2b",
        jaugeFond: "#14212b",
        jaugeBarre: "#2E9E4F",
        jaugeZoneOrange: "#ff8c1a",
        jaugeAiguille: "#ffffff",
        resultat: "#ffd23f"
    }
};
