/*
 * config.js — réglages de Quilles Saint-Gall (PRD article 875).
 *
 * La visée/physique (§3-6) est le spike v1 VALIDÉ par John le 30/08/2026
 * (commit 6fa096e) — non modifiée ici :
 *   1. la VUE DU DESSUS + les 9 quilles (cf. disposition en losange
 *      ci-dessous) ;
 *   2. la PHYSIQUE DE COLLISION boule/quilles (test de distance manuel,
 *      cf. GameScene) : la boule roule en ligne droite vers le haut,
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
 * Section `jets` (§7-9, ajoutée le 30/08/2026) : la VRAIE structure d'une
 * partie — 17 jets en 6 phases, barème fidèle aux règles fédérales (max
 * 200 points).
 *
 * CORRECTION DU 30/08/2026, 1re passe (soir) — disposition ET barème des
 * phases C/D/E refaits d'après l'image Wikimedia « Schema_emplacements_
 * quilles_saint_gall.png » (article Odoo 780), lue pixel par pixel. Roi
 * en pointe isolée du losange (idx8).
 *
 * CORRECTION DU 30/08/2026, 2e passe (même soir, après retour de John :
 * "au moins la moitié des formes n'est pas bonne") — trouvé un règlement
 * technique fédéral (PDF FFBSQ, via web.archive.org) dont un schéma
 * vectoriel semblait montrer le Roi au CENTRE du losange plutôt qu'en
 * pointe. Cette 2e passe a déplacé le Roi/prépondérante à idx4 partout.
 * ELLE ÉTAIT FAUSSE — cf. 3e passe : ce schéma était une illustration
 * générique des cotes de la piste, pas une indication de la quille
 * prépondérante par figure.
 *
 * CORRECTION DU 30/08/2026, 3e passe (même soir) — John a directement
 * ajouté à l'article 780 les RÈGLES DU CLUB OFFICIEL avec la disposition
 * exacte des 9 quilles pour CHACUNE des 8 figures (grille chiffrée avec
 * légende 0=vide/1=prépondérante/2=présente), bien plus fiable que les 2
 * sources précédentes. Comparée à cette grille :
 *   - Le Roi/prépondérante est bien en POINTE ISOLÉE (idx8), PAS au
 *     centre — la 1re passe avait raison, la 2e passe (théorie du PDF
 *     fédéral) est ANNULÉE. Reconfirmé sur la figure du jet 4 (jeu plein
 *     renforcé) ET les figures des jets 5-6 (idx8 présent et
 *     prépondérante) — le schéma du PDF fédéral montrait juste les
 *     cotes générales de la piste, pas la prépondérante par figure.
 *   - Les 4 sous-ensembles + prépondérante des jets 5-8 (indices lus sur
 *     l'image Wikimedia en 1re passe) sont VALIDÉS À L'IDENTIQUE par
 *     cette grille officielle, chiffre par chiffre — aucun changement.
 *     Fait confirmé : la prépondérante n'est PAS toujours le Roi (jets
 *     7-8 : une quille normale de la figure, idx7/idx6 — le Roi n'est
 *     même pas posé sur ces 2 figures-là).
 *   - Phases D/E (jets 9-17, indices/ordre/points par quille) : VALIDÉES
 *     À L'IDENTIQUE, aucun changement — y compris les 2 exceptions de
 *     ricochet (jets 12 et 16) et le modèle de persistance de la 2e passe
 *     (la grille officielle montre explicitement les quilles déjà
 *     tombées passer de "2" à "0" jet après jet, sans jamais se
 *     réinitialiser en cours de phase — confirme le modèle implémenté).
 *
 * Disposition (inchangée depuis la 1re passe, toujours un LOSANGE) :
 * indices 0-8 numérotés rangée par rangée, fond → avant : 0 = fond
 * (1 quille) ; 1,2 = rangée suivante (2, gauche→droite) ; 3,4,5 = rangée
 * du milieu, la plus large (3, gauche/centre/droite) ; 6,7 = rangée
 * suivante (2) ; 8 = pointe avant (1 quille) = LE ROI, plus gros.
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
        sousTitre: "Partie complète — 17 jets, 6 phases",
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
        aucune: "Aucune quille touchée",

        // --- Progression (colonne de gauche, remplace le compteur en
        // direct du spike — PRD §3) ------------------------------------
        jetProgression: "Jet {n}/17",
        scoreCumule: "Score : {score}/200",

        // --- Info du jet en cours (remplace consigneLigne2 pour les
        // phases C/D/E, cf. GameScene._texteConsigne2PourJet) -----------
        prependerante: "★ Prépondérante : quille {n}",
        cibleARenverser: "Quille à renverser : n°{n}",

        // --- Retour de jet (écran entre 2 jets) -------------------------
        pointsGagnes: "+{n} point(s)",
        ordreNonRespecte: "Ordre non respecté — nouvel essai ({n}/3)",
        jetAnnuleDefinitif: "3 essais épuisés — 0 point",
        continuer: "Jet suivant",
        rejouerJet: "Nouvel essai",

        // --- Fin de partie ------------------------------------------------
        finPartie: "Partie terminée !",
        scoreFinalTexte: "Score : {score}/200",
        nouveauRecord: "Nouveau record !",
        meilleurScore: "Meilleur score : {score}/200",
        rejouerPartie: "Rejouer la partie"
    },

    // --- Piste (vue du dessus) ----------------------------------------------
    piste: {
        ligneLancerYPct: 80,        // % hauteur : ligne de lancer (haut de la zone de recul)
        // Bornes du losange de 9 quilles (quinconce 1-2-3-2-1, cf. en-tête
        // de fichier) : les 3 rangées intermédiaires sont réparties à
        // intervalles réguliers entre ces 2 bornes par GameScene
        // ._positionnerQuilles — pas de valeur séparée par rangée ici.
        quillesZoneHautYPct: 12,    // % hauteur : quille du fond (idx 0)
        quillesZoneBasYPct: 34,     // % hauteur : pointe avant = le Roi (idx 8)
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

    // --- Quilles (9, en losange/quinconce, quille 9 = le Roi en pointe
    // avant — cf. l'en-tête de ce fichier pour la disposition exacte) -------
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
        amortissementRebond: 0.72,
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
        transfertFacteurMax: 0.55,
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
        vitesseArretPct: 5,
        // Vitesse minimale (% de hauteur écran / s) pour RENVERSER une
        // quille au contact (demande John, 30/08). En dessous, la boule
        // rebondit quand même (choc réel, cf. TestScene._reagirCollision)
        // mais la quille reste debout — trop lente pour avoir la force de
        // la faire tomber. Entre `vitesseArretPct` (3) et la vitesse de
        // lancer (55), pour laisser 2-3 quilles tomber sur un tir fort
        // avant que la boule, ralentie par les rebonds, devienne trop
        // faible.
        vitesseMinRenversePct: 7,
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

    // --- Structure d'une partie (PRD §7-9) -----------------------------------
    partie: {
        // Nombre d'essais avant qu'un jet à ordre imposé (D/E) rejoué sans
        // succès soit compté à 0 point (PRD §9, proposition retenue).
        tentativesMax: 3
    },

    // --- Les 17 jets, en 6 phases (PRD §7-9) ---------------------------------
    // Indices de quilles 0-8, losange fond → avant (cf. en-tête de fichier) :
    // 0 = fond ; 1,2 = rangée suivante (G/D) ; 3,4,5 = rangée du milieu, la
    // plus large (G/CENTRE=LE ROI/D) ; 6,7 = rangée suivante (G/D) ; 8 =
    // pointe avant. Même numérotation dans GameScene._creerQuilles.
    // type: 'plein' (phases A/B, 9 quilles, points = quilles tombées ×
    //   pointsParQuille — ou, si `prependerante` est défini (jet 4),
    //   × pointsSiPrependerante/pointsSinon selon que le Roi est tombé) |
    //   'figure' (phase C, sous-ensemble de 4 quilles, points = quilles
    //   tombées × (pointsSiPrependerante si la prépondérante est tombée,
    //   sinon pointsSinon)) | 'ordre' (phases D/E, sous-ensemble FIGÉ POUR
    //   TOUTE LA PHASE — persistance : les quilles restent tombées d'un
    //   jet à l'autre —, `cible` = la seule quille à faire tomber CE jet,
    //   `points` = valeur propre à ce jet, `ricochetAutorise` (jets 12/16
    //   seulement) = si la cible ET la toute dernière quille de la phase
    //   tombent ensemble, ce n'est pas une faute (exception fédérale) —
    //   cf. GameScene._calculerOrdreJet / _demarrerJet.
    jets: [
        // --- Phase A — jeu plein (jets 1-3, 1 bois/quille, max 27) -------
        { numero: 1, phase: "A", type: "plein", quillesDebout: "toutes", pointsParQuille: 1 },
        { numero: 2, phase: "A", type: "plein", quillesDebout: "toutes", pointsParQuille: 1 },
        { numero: 3, phase: "A", type: "plein", quillesDebout: "toutes", pointsParQuille: 1 },
        // --- Phase B — jeu plein renforcé (jet 4, max 18) ----------------
        // 2 bois/quille SI le Roi (idx8, pointe isolée) est renversé,
        // sinon 1 bois/quille — confirmé par la grille officielle
        // (légende 0/1/2) ajoutée par John à l'article 780.
        { numero: 4, phase: "B", type: "plein", quillesDebout: "toutes",
          prependerante: 8, pointsSiPrependerante: 2, pointsSinon: 1 },
        // --- Phase C — figures (jets 5-8, 1 jet/figure, max 20 chacun) ---
        // Sous-ensembles ET prépondérante VALIDÉS chiffre par chiffre par
        // la grille officielle du club (article 780, légende 0/1/2)
        // ajoutée par John — identiques à la 1re lecture de l'image
        // Wikimedia. Prépondérante = le Roi (idx8) pour les figures 5-6 ;
        // PAS le Roi pour 7-8 (il n'est même pas posé sur ces figures-là,
        // la prépondérante y est une quille normale).
        { numero: 5, phase: "C", type: "figure",
          figure: { indices: [1, 4, 7, 8], prependerante: 8 },
          pointsSiPrependerante: 5, pointsSinon: 2, maxPoints: 20 },
        // Figure 2 : symétrique de la figure 1 (miroir gauche/droite).
        { numero: 6, phase: "C", type: "figure",
          figure: { indices: [2, 4, 6, 8], prependerante: 8 },
          pointsSiPrependerante: 5, pointsSinon: 2, maxPoints: 20 },
        { numero: 7, phase: "C", type: "figure",
          figure: { indices: [1, 4, 5, 7], prependerante: 7 },
          pointsSiPrependerante: 5, pointsSinon: 2, maxPoints: 20 },
        // Figure 4 : symétrique de la figure 3 (miroir gauche/droite).
        { numero: 8, phase: "C", type: "figure",
          figure: { indices: [2, 3, 4, 6], prependerante: 6 },
          pointsSiPrependerante: 5, pointsSinon: 2, maxPoints: 20 },
        // --- Phase D — ordre imposé court (jets 9-13, total 50) ----------
        // Les 5 quilles (rangées 1 et milieu, idx 1/2/3/4/5) sont posées
        // UNE FOIS pour toute la phase (persistance) ; l'ordre ET les
        // points par quille (6/8/10/12/14) viennent de l'image Wikimedia.
        // Exception fédérale sur le jet 12 (ricochet vers le jet 13).
        { numero: 9, phase: "D", type: "ordre",
          figure: { indices: [1, 2, 3, 4, 5] }, cible: 1, points: 6 },
        { numero: 10, phase: "D", type: "ordre",
          figure: { indices: [1, 2, 3, 4, 5] }, cible: 2, points: 8 },
        { numero: 11, phase: "D", type: "ordre",
          figure: { indices: [1, 2, 3, 4, 5] }, cible: 4, points: 10 },
        { numero: 12, phase: "D", type: "ordre", ricochetAutorise: true,
          figure: { indices: [1, 2, 3, 4, 5] }, cible: 3, points: 12 },
        { numero: 13, phase: "D", type: "ordre",
          figure: { indices: [1, 2, 3, 4, 5] }, cible: 5, points: 14 },
        // --- Phase E — ordre imposé long (jets 14-17, total 25) ----------
        // 4 quilles debout (rangée 1 + milieu-centre + pointe avant, idx
        // 1/2/4/8), posées UNE FOIS pour toute la phase (persistance) ;
        // ordre ET points (5/5/10/5) lus sur l'image Wikimedia. Exception
        // fédérale sur le jet 16 (ricochet vers le jet 17).
        { numero: 14, phase: "E", type: "ordre",
          figure: { indices: [1, 2, 4, 8] }, cible: 1, points: 5 },
        { numero: 15, phase: "E", type: "ordre",
          figure: { indices: [1, 2, 4, 8] }, cible: 2, points: 5 },
        { numero: 16, phase: "E", type: "ordre", ricochetAutorise: true,
          figure: { indices: [1, 2, 4, 8] }, cible: 8, points: 10 },
        { numero: 17, phase: "E", type: "ordre",
          figure: { indices: [1, 2, 4, 8] }, cible: 4, points: 5 }
    ],

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
