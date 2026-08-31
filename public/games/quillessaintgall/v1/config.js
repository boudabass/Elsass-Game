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
 *   3e passe ANNULÉE SUR LE SEUL POINT DU ROI par la 4e passe ci-dessous —
 *   tout le reste (sous-ensembles/prépondérantes des figures 5-8, phases
 *   D/E) reste valide.
 *
 * CORRECTION DU 31/08/2026, 4e passe — John a entièrement réécrit
 * l'article 780 (et ajouté 2 sous-articles, 876/877) d'après le
 * règlement de la Commission Technique & Sportive de l'Amicale des
 * Quilles Saint-Gall. L'article 876 dit explicitement : « La quille
 * centrale du parallélogramme, nommée "le Roi"... ». Question posée à
 * John (le code plaçait le Roi en pointe depuis la 3e passe) : le Roi
 * est-il TOUJOURS au centre, ou sa position dépend-elle de la figure
 * jouée ? Réponse : le Roi (grande quille, reconnaissable à sa couronne)
 * est UNE QUILLE PHYSIQUE FIXE, toujours au centre du losange complet à
 * 9 quilles (jets 1-4, phases A/B) — ce n'est PAS lui qui bouge selon la
 * figure. Ce qui varie par figure (jets 5-8, phase C), d'après ce que
 * John a vu en vidéo de club, c'est UNIQUEMENT quelle quille est
 * « prépondérante » pour cette figure — une notion de scoring
 * indépendante de l'identité du Roi. Conséquence :
 *   - Position PHYSIQUE du Roi : idx8 (pointe) → idx4 (centre), partout
 *     où le code le traite comme UNE QUILLE PARTICULIÈRE du losange
 *     complet (rendu visuel plus gros, jet 4/phase B qui double SI le
 *     Roi tombe).
 *   - Sous-ensembles ET indices « prépondérante » des jets 5-8 (phase C) :
 *     INCHANGÉS (8, 8, 7, 6) — ce sont des propriétés PAR FIGURE, validées
 *     indépendamment contre la grille officielle du club en 3e passe, pas
 *     dérivées de la position du Roi. Conséquence du changement idx8→idx4 :
 *     AUCUNE des 4 figures n'a plus sa prépondérante sur le Roi (avant :
 *     jets 5-6 l'avaient) — la prépondérante d'une figure n'est donc
 *     JAMAIS le Roi dans ce jeu, ce qui est cohérent avec la clarification
 *     de John (le Roi n'est pas spécial pour le scoring des figures,
 *     seule la figure décide).
 *
 * Disposition (LOSANGE, inchangée depuis la 1re passe — seule l'identité
 * du Roi change en 4e passe) : indices 0-8 numérotés rangée par rangée,
 * fond → avant : 0 = fond (1 quille) ; 1,2 = rangée suivante (2,
 * gauche→droite) ; 3,4,5 = rangée du milieu, la plus large (3,
 * gauche/CENTRE=LE ROI/droite) ; 6,7 = rangée suivante (2) ; 8 = pointe
 * avant (1 quille, une quille normale comme les autres).
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
        // Pas de ligneLancerYPct ici (retiré le 31/08/2026) : la limite
        // piste/zone de tir (GameScene.ligneLancerY) est désormais calculée
        // à partir de la largeur de piste réelle (elle-même dérivée du
        // ratio 1×2, cf. plus bas), pas d'un pourcentage fixe de la
        // hauteur — cf. GameScene._recalculerGeometrie.
        // --- Échelle réelle (demande John, 31/08 : "il faut que ce soit
        // proportionnel car la piste fait 200cm de large") -----------------
        // Largeur RÉELLE de la piste (article 780 : "entre 180cm et 200cm
        // de large" — on prend la borne haute). Sert de référence commune :
        // GameScene calcule `pxParCm = pisteLargeur / largeurReelleCm` et
        // s'en sert pour dimensionner en cm réels tout ce qui doit être
        // proportionnel à la piste (marge quilles↔bord, diagonale du
        // losange, diamètre quille/boule) — plus aucune valeur indépendante
        // en % arbitraire pour ces éléments-là.
        largeurReelleCm: 200,
        // --- Grille fixe des quilles (refonte du 31/08, dernière passe) ---
        // John a remplacé l'approche précédente (diagonale en cm dérivée
        // de la marge quilles↔bord) par une GRILLE FIXE, CARRÉE, calculée
        // UNIQUEMENT sur la largeur de piste : "peu importe l'espace que
        // cela prend sur la piste, la grille doit être carrée 1/1". Cause
        // du bug précédent : la hauteur du losange était dérivée en % de
        // LA HAUTEUR de piste (this.ligneLancerY, échelle différente de la
        // largeur) — sur certains formats, ça écrasait le losange près du
        // bord haut (row 0 quasi collée à y=0, sous le titre).
        // Grille 5×5, largeur ET hauteur = grilleLargeurPct % de
        // pisteLargeur (60% → une case = 60/5 = 12% de pisteLargeur,
        // demande John), donc un vrai carré peu importe le format d'écran
        // (les 2 dimensions suivent la MÊME base : pisteLargeur).
        grilleLargeurPct: 60,
        grilleCases: 5,
        // Marge FIXE entre le haut de la piste et le haut de la grille, en
        // % de LA HAUTEUR de piste (this.ligneLancerY) — seule valeur ici
        // encore liée à cette échelle-là, volontairement : une simple
        // marge d'ancrage, pas une dimension de la grille elle-même. Peut
        // rester petite car le titre/sous-titre ne sont plus dessinés sur
        // la piste (demande John : les déplacer dans le panneau d'info
        // pour libérer cet espace, cf. GameScene._positionnerColonneInfo).
        grilleHautYPct: 6
        // Pas de largeur totale ici : la largeur de la piste est TOUJOURS
        // celle de GameScene.pisteLargeur, cf. GameScene._recalculerGeometrie
        // / _positionnerQuilles / _dessinerDecor. Passée de 1/3 à 2/3 le
        // 31/08/2026 1re passe (demande John) : à 1/3, l'écart entre 2
        // quilles voisines de la rangée du milieu (ex. jet 9, quilles 4/5)
        // devenait égal — voire inférieur — au diamètre de la boule en
        // portrait/carré (où u(), qui régit les rayons boule/quille, suit
        // la MÊME base que la largeur d'écran), rendant le passage entre
        // elles physiquement impossible. Doubler la largeur de piste double
        // l'écart sans toucher aux rayons. Puis, 31/08/2026 3e passe
        // (demande John) : ce 2/3 est devenu un PLAFOND, pas une largeur
        // fixe — la piste+zone de tir garde toujours un ratio 1×3
        // (largeur×hauteur, passé de 1×2 à 1×3 le 31/08), quitte à faire
        // moins de 2/3 (cf. `recul` ci-dessous). La colonne restante
        // (1/3 FIXE, à droite) est un panneau d'info dédié (jet, score, ET
        // tous les contrôles de tir) sur toute la hauteur de l'écran.
    },

    // --- Zone de tir : demi-cercle de placement (les boutons de pivot/
    // force/tirer sont dans la colonne d'info depuis le 31/08, cf.
    // GameScene._positionnerColonneInfo) ----------------------------------
    // (demande John, 30/08, revu plusieurs fois le 31/08). La boule se
    // place n'importe où DANS le demi-cercle (glisser 2D) ; la direction du
    // tir n'est PLUS déduite de la position de la boule mais des boutons
    // ◄/► (rotation). Les deux se combinent au lancer : la boule part de sa
    // position dans le demi-cercle, dans la direction choisie via les
    // boutons (+ déviation de la jauge en cas de tir raté).
    recul: {
        // Pas de largeur/plafond de rayon ici : la piste ENTIÈRE (quilles +
        // zone de tir) garde un ratio FIXE 1×3 — largeur × hauteur, 3 fois
        // plus haute que large (demande John, 31/08, passé de 1×2 à 1×3) —,
        // calculé dans GameScene._recalculerGeometrie comme le plus grand
        // rectangle 1:3 qui tient dans (largeur ≤ 2/3 écran, hauteur ≤
        // écran). Le demi-cercle fait TOUJOURS toute la largeur de la
        // piste (diamètre = pisteLargeur) et la zone de tir est
        // dimensionnée exactement à sa hauteur (rayon = pisteLargeur/2).
        // Écran large/court : bande vide À GAUCHE de la piste. Écran haut/
        // étroit : reste vide EN BAS. Les deux demandés explicitement par
        // John plutôt que d'étirer la piste hors de son ratio.
        rotationMaxDeg: 10,         // rotation max de la visée, de chaque côté du tout droit
        rotationStepDeg: 1          // incrément par clic sur un bouton ◄/► (10 clics = le max)
    },

    // --- Quilles (9, en losange/quinconce, quille 5 = idx4 = le Roi, au
    // CENTRE du losange (corrigé le 31/08, 4e passe) — cf. l'en-tête de ce
    // fichier pour la disposition exacte) -----------------------------------
    quille: {
        // Diamètre RÉEL en cm (article 780 : "diamètre maximum de 12cm"),
        // converti en pixels via GameScene.pxParCm (demande John, 31/08 :
        // proportionnel à la largeur réelle de piste, cf. piste.largeurReelleCm
        // ci-dessus) — remplace l'ancien rayonPct (% du plus petit côté de
        // l'écran, sans lien avec l'échelle de la piste). Confirmé par
        // John (31/08, dernière passe) : 12cm/200cm = 6% de la largeur de
        // piste, soit la moitié d'une case de la grille (12%, cf.
        // piste.grilleLargeurPct) — la quille tient centrée dans sa case.
        diametreCm: 12,
        // Le Roi (idx4) : l'article ne donne PAS de diamètre plus grand
        // (seulement "plus grande de 4cm" en HAUTEUR, invisible en vue du
        // dessus) — ce +4cm est repris ici sur le diamètre à défaut d'une
        // mesure séparée, uniquement pour rester visuellement distinct
        // (hypothèse déjà faite avant cette passe, juste reconvertie en cm).
        diametreRoiCm: 16,
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
        frictionGlissementPar_s: 4,
        // --- Collision QUILLE ↔ QUILLE (ajouté le 31/08, demande John :
        // « qu'une quille puisse en faire tomber une autre ») — jusqu'ici
        // une quille qui glisse traversait les autres sans effet. Règle
        // fédérale explicitement prévue (quille qui revient de la fosse
        // en renverse une autre, cf. exceptions de ricochet jets 12/16) :
        // désormais simulée pour de vrai, cf. GameScene
        // ._verifierCollisionsEntreQuilles. Modèle volontairement plus
        // simple que boule/quille (une fraction FIXE, pas de formule qui
        // varie avec la vitesse d'impact).
        vitesseMinRenverseAutreQuillePct: 8,   // seuil pour renverser une quille voisine
        transfertFacteurEntreQuilles: 0.5,      // fraction de vitesse héritée par la cible
        amortissementRebondEntreQuilles: 0.4    // rebond de la source si la cible ne tombe pas
    },

    // --- Boule ---------------------------------------------------------------
    boule: {
        // Diamètre RÉEL : 20cm = 10% de la largeur de piste (tranché par
        // John le 31/08, dernière passe — dernière pièce de la mise à
        // l'échelle réelle : piste/grille de quilles/quille/boule suivent
        // désormais TOUS la même base, this.pxParCm). Converti en pixels
        // via GameScene.pxParCm, même échelle que la piste/les quilles.
        diametreCm: 20,
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
        // Relevé le 31/08 (0.2→0.3 / 0.55→0.75, demande John : faire tomber
        // PLUS de quilles par tir) — la boule garde nettement plus de sa
        // vitesse d'impact après avoir renversé une quille.
        transfertFacteurMin: 0.3,
        transfertFacteurMax: 0.75,
        // Ralentissement continu appliqué à la boule à CHAQUE frame une
        // fois qu'elle a touché au moins une quille (demande John, 30/08 :
        // sans ça, une boule qui continue tout droit après un choc ne
        // ralentit plus jamais toute seule). Fraction de vitesse perdue par
        // seconde, en plus de l'éventuel rebond/transfert au contact lui-même.
        // Abaissé le 31/08 (1.2→0.6, demande John) : la boule perdait déjà
        // trop de vitesse ENTRE deux chocs pour espérer en renverser un 3e.
        frictionApresChocPar_s: 0.6,
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
        // 2 bois/quille SI le Roi (idx4, centre du losange — corrigé le
        // 31/08, 4e passe, cf. en-tête de fichier) est renversé, sinon 1
        // bois/quille (texte fédéral, article 780/876).
        { numero: 4, phase: "B", type: "plein", quillesDebout: "toutes",
          prependerante: 4, pointsSiPrependerante: 2, pointsSinon: 1 },
        // --- Phase C — figures (jets 5-8, 1 jet/figure, max 20 chacun) ---
        // Sous-ensembles ET prépondérante VALIDÉS chiffre par chiffre par
        // la grille officielle du club (article 780, légende 0/1/2)
        // ajoutée par John en 3e passe — identiques à la 1re lecture de
        // l'image Wikimedia, INCHANGÉS par la 4e passe (31/08) : la
        // prépondérante d'une figure est une propriété PAR FIGURE,
        // indépendante de l'identité du Roi (clarifié par John : le Roi
        // est une quille physique fixe au centre, ce n'est pas lui qui
        // "se déplace" selon la figure jouée — seule la figure décide
        // quelle quille y est prépondérante). Conséquence du Roi
        // maintenant en idx4 : aucune des 4 figures 5-8 n'a plus sa
        // prépondérante sur le Roi (avant la 4e passe, jets 5-6
        // l'avaient par coïncidence d'indice idx8=Roi) — la prépondérante
        // n'est donc JAMAIS le Roi dans ce jeu, sur aucune des 4 figures.
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
