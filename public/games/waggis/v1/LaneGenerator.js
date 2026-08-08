/*
 * LaneGenerator.js — génération procédurale des bandes horizontales de
 * Waggis V2 (concept Crossy Road, CDC : article Odoo 706).
 *
 * Le monde est découpé en bandes horizontales de hauteur fixe, empilées
 * vers le haut au fur et à mesure que le joueur avance. Chaque bande est
 * tirée parmi les 7 types de la spec (article 708 §3) : herbe (sans
 * danger), buisson (variante d'herbe, tampon de la route), route
 * (véhicules), eau (plantes + bateaux), train (voie ferrée avec un train
 * rapide prévenu par signal), terre (tampon du train) et piste
 * d'atterrissage (véhicules volants, comportement identique à une route).
 *
 * ⭐ D2-2 (spec 708 §2/§3/§4/§5/§6 — spec détaillée chiffrée, elle fait
 * foi pour tous les chiffres) : les RÈGLES DE GÉNÉRATION détaillées
 * remplacent les anciennes règles anti-frustration génériques (CDC 706) :
 *   - grille : une ligne fait 20 cases de large (§2) ; les positions,
 *     largeurs (1 à 4 cases) et densités (75 % max) sont en cases ;
 *   - TAMPONS (§4) : eau → herbe avant ET après (obligatoire), train →
 *     terre avant ET après (obligatoire), route → buisson avant ET après
 *     (obligatoire) ; une ligne tampon = 1 à 3 lignes d'affilée (tiré
 *     dans la plage) ; Route → Train : groupes de routes qui s'enchaînent,
 *     transition avec tampon (1-3 terres puis train forcé) ou SANS tampon
 *     (train direct, exception documentée) — tiré au hasard ; Piste
 *     d'atterrissage : tampon aléatoire avec ou sans, type non imposé ;
 *   - VÉHICULES (§5) : 1 à 4 cases, tous types d'assets mélangés (route/
 *     eau/piste), direction ALTERNÉE par ligne (sens opposé de la ligne
 *     de véhicules précédente, comme Frogger), vitesse base(niveau) =
 *     1.00 + 0.01×(niveau−1) ±30 % PAR VÉHICULE (niveau 1 : 0.70 à 1.30),
 *     densité route/piste de faible en début de jeu jusqu'à 75 % max de
 *     la ligne occupée ;
 *   - EAU (§6) : plantes = plateformes (JAMAIS 0 par bande), courbe 75 %
 *     de la bande en début → 1 à 2 plantes en fin ; bateaux en miroir
 *     (0 % → 75 % max) en REMPLACEMENT des plantes (pas d'addition) ;
 *     case ni plante ni bateau = eau vide = mort au contact ;
 *   - toujours au moins un passage traversable par ligne : plafond 75 %
 *     (route/piste), plantes ≥ 1 (eau), phases d'attente du train —
 *     aucune ligne n'est jamais 100 % bloquée.
 * La structure des tampons est stockée dans la définition de la ligne
 * (def.tampon = { type, reste, apres }) : la génération reste LAZY et
 * DÉTERMINISTE depuis generatedRows (relue au retour, jamais régénérée).
 *
 * ⭐ D2-3 (spec 708 §1/§8/§10) : le niveau est une donnée du jeu (fixée
 * par GameScene depuis la save : data.currentLevel), PLUS dérivée du
 * score. La CONFIG PAR NIVEAU vit dans levels.json (chargé par main.js
 * et exposé via WaggisConfig.levels) et est consultée ici : lignes(niveau)
 * = 42 + niveau (§1, bornage de la fin de niveau), types autorisés (§3),
 * densité (§5/§6), vitesse base 1.00 + 0.01×(niveau−1) ±30 % (§5) et max
 * consécutifs (groupes de routes et tampons, §4). Chaque lecture a un
 * REPLI sur les défauts de config.js (valeurs identiques) si levels.json
 * ne charge pas — le jeu ne casse jamais.
 *
 * ⭐ FIN DE NIVEAU (Décision John 08/08/2026, art. 704) : le pattern
 * VISUEL FIXE remplace la fin « nue » de la spec 708 §10 (victoire à
 * lignes(niveau)). Chaque niveau se termine par 3 lignes de BÉTON puis
 * 4 lignes d'HERBE avec une MAISON posée sur la dernière ligne d'herbe —
 * pattern IDENTIQUE sur tous les niveaux (levels.json finNiveau fait foi,
 * repli config.js). Le joueur TRAVERSE les 3 lignes de béton (lignes
 * SÛRES, aucun danger) puis l'herbe, et la victoire se déclenche quand il
 * ATTEINT LA MAISON — l'index de la maison est exposé via indexFin()
 * (lignesNiveau + beton + herbe − 1) et consommé par GameScene. Les
 * lignes de fin sont générées LAZY comme toutes les autres (elles
 * n'apparaissent que quand le joueur approche, jamais dès le début du
 * niveau) et restent déterministes dans generatedRows (relues au retour).
 *
 * ⭐ D2-1 (Décisions 2/3/4, articles 704 + 708 §7 — le monde ne se
 * régénère JAMAIS) : toute ligne générée est une DÉFINITION sérialisable
 * { index, type, obstacles[], vitesse } stockée dans `generatedRows`
 * indexé par POSITION, persistée dans la save ({v, t, data}, versionnée —
 * voir main.js). La génération est LAZY : une ligne n'est créée que quand
 * le joueur s'en approche (buffer = bandes visibles + margeBandesHaut
 * d'avance) ; si generatedRows[index] existe déjà, on RELIT la définition
 * et on rejoue son rendu à l'identique — jamais de régénération (corrige
 * le bug « ça se réinvente au retour » signalé par John). Rien avant le
 * début : l'index 0 est la première ligne, le retour en arrière est
 * possible mais jamais avant l'index 0 (reculer() est borné).
 *
 * TRAIN (étape 4, comportement conservé) : chaque bande train alterne
 * trois phases (bande.phase) :
 *   - "attente"      : voie libre, les feux de croisement sont visibles
 *                      (rouge sombre, fixes) ;
 *   - "avertissement": signal AVANT le passage — les feux clignotent en
 *                      rouge vif et un son (snd_error de l'atelier,
 *                      décision John 06/08) retentit ; le train n'est pas
 *                      encore sur l'écran, c'est la fenêtre pour QUITTER
 *                      les rails ;
 *   - "passage"      : le train (convoi de wagonnets rogrpg, placeholder
 *                      faute de sprite de locomotive dans l'atelier —
 *                      signalé, CDC 706 §Assets) traverse l'écran à
 *                      grande vitesse ; tout point de la bande recouvert
 *                      par le train à cet instant = mort (contrat exposé
 *                      via bande.estMortelAuPoint(x, demiLargeur)).
 *
 * POOLING (ObstaclePool.js, CDC 706 §Performance) : les bandes déjà
 * traversées (sorties en bas de l'écran) ne sont ni détruites ni
 * recréées : elles sont recyclées en haut avec une nouvelle définition
 * (avancer()). Les sprites de décor, de véhicules et de wagons passent
 * par ObstaclePool et changent de texture plutôt que d'être détruits —
 * aucun monde infini n'est gardé en mémoire. Chaque sprite porte un
 * corps Arcade Physics créé une seule fois ; seuls les obstacles
 * (véhicules, nénuphars, bateaux, wagons) ont le corps ACTIF (collisions
 * étape 6), le décor garde un corps inerte.
 *
 * DÉFILEMENT (étape 5, contrôles) : le joueur reste dans la même zone de
 * l'écran ; c'est le MONDE qui glisse. `decalage` (px) décale toutes les
 * bandes (redimensionner() applique : y = base(slot) + decalage) :
 *  - avancer (joueur vers le haut) : defilerBas() (decalage += hauteur)
 *    puis avancer() recycle la bande du bas en haut ; la rotation du pool
 *    est compensée (decalage -= hauteur) — le décalage reste invariant
 *    (≈0) et le monde couvre toujours l'écran ;
 *  - reculer (joueur vers le bas) : reculer() recycle la bande du haut en
 *    DESSOUS (compensation : decalage += hauteur) puis defilerHaut()
 *    (decalage -= hauteur) — l'inverse exact d'avancer(). D2-1 : la bande
 *    recréée en dessous est RELUE depuis generatedRows[index] quand elle
 *    existe (retour sur nos pas = exactement la même ligne), et reculer()
 *    est BORNÉ à l'index 0 — rien ne peut exister avant le départ.
 *
 * Rendu : chaque bande est un tileSprite de sol (herbe pour les zones
 * sûres, asphalte + marquage pour les routes, pave pour la piste
 * d'atterrissage, lit de ballast + voie pour le train, terre pour le
 * tampon du train), décorée (arbres/buissons, haies de buissons), 
 * parcourue de véhicules latéraux (route/piste), de plantes et bateaux
 * (eau) ou d'un train périodique (train). Tout est exprimé en PROPORTION
 * de l'écran (config lanes) + en CASES de la grille (20 cases de large,
 * spec 708 §2). Depuis D2-1, le rendu est TOUJOURS construit depuis la
 * définition stockée dans generatedRows (jamais de tirage aléatoire au
 * recyclage).
 *
 * Utilisation (GameScene) :
 *   this.lanes = new LaneGenerator(this);
 *   this.lanes.genererInitiales(score);
 *   // dans update() : this.lanes.update(time, delta);
 *   // bond avant  : this.lanes.defilerBas(); this.lanes.avancer(score);
 *   //   (quand le joueur franchit le seuil haut, voir GameScene)
 *   // bond arrière : this.lanes.reculer(score); this.lanes.defilerHaut();
 *   //   (à chaque recul — relecture generatedRows, borné à l'index 0)
 */
class LaneGenerator {
    static TYPES = Object.freeze({
        // Les 7 types de lignes (spec 708 §3). Les chaînes sont persistées
        // dans generatedRows / la save — ne pas renommer sans migration.
        HERBE: "herbe",        // sans danger
        BUISSON: "buisson",    // variante d'herbe, tampon devant/derrière une route
        ROUTE: "route",        // véhicules qui roulent
        EAU: "eau",            // plantes (plateformes) + bateaux
        TRAIN: "train",        // voie ferrée, tampon terre devant/derrière
        TERRE: "terre",        // tampon du train
        PISTE: "piste",        // piste d'atterrissage, véhicules volants
        // ⭐ Fin de niveau (Décision John 08/08/2026, art. 704) : BÉTON —
        // 8e type RÉSERVÉ au pattern de fin (3 lignes avant l'herbe de la
        // maison). Ligne SÛRE sans danger (le joueur la traverse) : elle
        // n'est JAMAIS tirée par _choisirLibre (absente des candidats et
        // de levels.json typesAutorisés) — seul _choisirType la produit,
        // dans la zone de fin du niveau.
        BETON: "beton"
    });

    /**
     * @param {Phaser.Scene} scene la scène de jeu
     * @param {object|null} [monde] generatedRows existant (reprise après
     *   mort : même monde, spec 708 §8 — « le joueur relance le même
     *   niveau avec le même generatedRows ») ou null pour un monde neuf.
     */
    constructor(scene, monde) {
        this.scene = scene;
        this.C = window.WaggisConfig;
        this.bandes = [];        // bandes vivantes, de bas en haut
        // Pool unique des sprites d'obstacles ET de décor (CDC 706
        // §Performance) : véhicules, nénuphars, bateaux, wagons du train,
        // mais aussi arbres/buissons — aucun sprite n'est recréé/détruit
        // en continu, il change de texture. Les corps Arcade Physics des
        // obstacles sont activés à la prise, désactivés au rendu.
        this.pool = new ObstaclePool(scene);
        // D2-3 : le niveau (1-based, spec 708) est fixé par GameScene depuis
        // la save (data.currentLevel) — plus dérivé du score. Il pilote la
        // config par niveau (levels.json : lignes, vitesse, densité).
        this.niveau = 1;

        // ⭐ D2-1 (spec 708 §7) : le monde généré, indexé par POSITION
        // (index absolu de ligne, 0 = départ). Chaque entrée est une
        // DÉFINITION sérialisable { index, type, obstacles[], vitesse }
        // (+ champs de rendu : sousType, sol, direction, decor, train,
        // tampon). Une ligne n'est créée QU'UNE FOIS (lazy) ; si l'index
        // existe déjà, on relit — jamais de régénération. Persisté dans la
        // save ({v, t, data}) — voir main.js (contrat versionné).
        this.generatedRows = (monde && typeof monde === "object") ? monde : {};

        // Compteurs exposés pour la QA (probes window.__q / Arcade.game) :
        // nombre de signaux sonores déclenchés et de passages de train.
        this.compteurs = { avertissements: 0, passages: 0 };
        // Horodatage (scene.time.now) jusqu'auquel un signal sonore est en
        // cours : un seul train peut « sonner » à la fois (pas de
        // cacophonie si deux bandes train avertissent en même temps).
        this._sonSignalFin = null;

        // Décalage de défilement du monde (px) : toutes les bandes sont
        // rendues à y = base(slot) + decalage (voir redimensionner()).
        // Il augmente quand le joueur avance (le monde glisse vers le bas)
        // et diminue quand il recule. Étape 5 — contrôles.
        this.decalage = 0;

        this.hauteur = 0;        // recalculée par redimensionner()
        this.redimensionner();
    }

    /** Profondeurs de rendu (le joueur arrivera au-dessus, ~10). */
    static DEPTH = Object.freeze({
        ballast: 0,      // lit de gravier sous la voie (texture rails ajourée)
        sol: 1,
        marquage: 2,
        decor: 3,
        signal: 4,       // feux de croisement des bandes train
        vehicule: 5,
        flottant: 5,
        train: 5
    });

    // ------------------------------------------------------------------
    // Cycle de vie
    // ------------------------------------------------------------------

    /**
     * Nombre de lignes du niveau donné — spec 708 §1 : lignes(niveau) =
     * 42 + niveau (42 lignes de base + le numéro du niveau). Ex. : niveau
     * 10 → 52 lignes. Niveau 100 = repère pour la courbe de vitesse, PAS
     * un niveau maximum (aucun plafond défini pour l'instant). C'est le
     * BORNAGE de la fin de niveau (spec 708 §10 : quand l'index du joueur
     * atteint lignes(niveau) → victoire).
     * @param {number} n numéro du niveau (1-based)
     * @returns {number} nombre de lignes du niveau
     */
    lignesNiveau(n) {
        const l = this._niveaux().lignes || {};
        const base = (typeof l.base === "number") ? l.base : 42;
        const parNiveau = (typeof l.parNiveau === "number") ? l.parNiveau : 1;
        return base + parNiveau * n;
    }

    /**
     * ⭐ Fin de niveau (Décision John 08/08/2026, art. 704) : le pattern
     * VISUEL FIXE de fin — 3 lignes de BÉTON puis 4 lignes d'HERBE avec
     * une MAISON posée sur la dernière. levels.json finNiveau fait foi,
     * repli silencieux sur config.js lanes.finNiveau (valeurs identiques)
     * si le fichier ne charge pas — le jeu ne casse jamais.
     * @returns {{beton: number, herbe: number}}
     */
    _finNiveau() {
        const f = this._niveaux().finNiveau || {};
        const repli = this.C.lanes.finNiveau || {};
        return {
            beton: (typeof f.beton === "number") ? f.beton : (repli.beton || 3),
            herbe: (typeof f.herbe === "number") ? f.herbe : (repli.herbe || 4)
        };
    }

    /**
     * ⭐ Fin de niveau (Décision John 08/08/2026, art. 704) : index de la
     * ligne de la MAISON — la DERNIÈRE ligne du pattern de fin
     * (lignesNiveau + beton + herbe − 1). C'est le nouveau bornage de la
     * victoire (spec 708 §10) : le joueur traverse les 3 lignes de béton
     * puis les 4 lignes d'herbe et ATTEINT LA MAISON = fin de partie
     * (précision John : pas d'arrêt à la 1ʳᵉ ligne de béton). Consommé
     * par GameScene (bondAvant → gagner()).
     * @returns {number} index absolu de la ligne de la maison
     */
    indexFin() {
        const fin = this._finNiveau();
        return this.lignesNiveau(this.niveau) + fin.beton + fin.herbe - 1;
    }

    /**
     * Config par niveau (spec 708) : levels.json chargé par main.js et
     * exposé sur WaggisConfig.levels. Repli silencieux sur {} (les
     * accesseurs retombent sur les défauts de config.js, valeurs
     * identiques) si le fichier n'a pas chargé — le jeu ne casse jamais.
     * @returns {object} la config par niveau
     */
    _niveaux() {
        return (this.C && this.C.levels) || {};
    }

    /**
     * Types de lignes AUTORISÉS au niveau courant (spec 708 §3) : les 7
     * types par défaut, filtrables par levels.json (typesAutorisés) pour
     * restreindre un niveau sans toucher au générateur.
     * @returns {string[]} types autorisés (constantes LaneGenerator.TYPES)
     */
    _typesAutorises() {
        const T = LaneGenerator.TYPES;
        const liste = this._niveaux().typesAutorises;
        if (Array.isArray(liste) && liste.length) {
            const connus = Object.keys(T).map((k) => T[k]);
            return liste.filter((t) => connus.indexOf(t) !== -1);
        }
        return Object.keys(T).map((k) => T[k]);
    }

    /**
     * Courbes de densité (spec 708 §5/§6) : route/piste de faible → 75 %
     * max de la ligne occupée, eau plantes 75 % → 1-2 plantes (jamais 0),
     * bateaux en miroir 0 % → 75 % max (remplacement des plantes).
     * @returns {{routePiste: {minFrac: number, maxFrac: number},
     *            eauPlantes: {minFrac: number, maxFrac: number},
     *            eauBateaux: {minFrac: number, maxFrac: number}}}
     */
    _densite() {
        const C = this.C.lanes;
        const d = this._niveaux().densite || {};
        const frac = (src, repli) => ({
            minFrac: (typeof src.minFrac === "number") ? src.minFrac : repli.minFrac,
            maxFrac: (typeof src.maxFrac === "number") ? src.maxFrac : repli.maxFrac
        });
        return {
            routePiste: frac(d.routePiste || {}, C.routeDensite),
            eauPlantes: frac(d.eauPlantes || {}, C.eauPlantes),
            eauBateaux: frac(d.eauBateaux || {}, C.eauBateaux)
        };
    }

    /**
     * Repère de niveau pour les courbes (spec 708 §1) : niveau 100 =
     * repère pour la courbe de vitesse, pas un niveau maximum. Les courbes
     * de densité progressent sur les niveaux 1 → repère (progres =
     * (niveau−1)/(repère−1)).
     * @returns {number} le repère (100 par défaut)
     */
    _niveauMaxRepere() {
        const L = this._niveaux();
        return (typeof L.niveauMaxRepere === "number") ? L.niveauMaxRepere : 100;
    }

    /**
     * Nombre maximum de routes CONSÉCUTIVES dans un groupe (spec 708 §4 —
     * « groupes de routes qui s'enchaînent », borné pour rester
     * franchissable). levels.json maxConsecutifs.route, repli config.js.
     * @returns {number}
     */
    _maxConsecutifsRoute() {
        const m = this._niveaux().maxConsecutifs || {};
        return (typeof m.route === "number") ? m.route : this.C.lanes.routeGroupe.max;
    }

    /**
     * Plage de longueur d'un run de tampon (spec 708 §4 — « une ligne
     * tampon = 1 à 3 lignes d'affilée »). levels.json
     * maxConsecutifs.tampon, repli config.js.
     * @returns {{min: number, max: number}}
     */
    _tamponLignes() {
        const t = (this._niveaux().maxConsecutifs || {}).tampon || {};
        return {
            min: (typeof t.min === "number") ? t.min : this.C.lanes.tamponLignes.min,
            max: (typeof t.max === "number") ? t.max : this.C.lanes.tamponLignes.max
        };
    }

    /**
     * Construit la séquence initiale : la bande de départ affleure le bas
     * de l'écran, puis les bandes s'empilent jusqu'à couvrir l'écran plus
     * la marge d'avance au-dessus. Chaque ligne passe par _obtenirLigne() :
     * si elle existe déjà (reprise après mort), elle est RELUE, jamais
     * régénérée (D2-1, spec 708 §7 — le monde ne se réinvente pas).
     * D2-3 : le niveau a été fixé par GameScene (this.niveau, depuis
     * data.currentLevel) avant l'appel — la difficulté de départ (vitesse,
     * densité) en découle.
     * @param {number} score score courant (conservé pour compatibilité ;
     *   la difficulté dépend désormais du niveau, spec 708 §5)
     */
    genererInitiales(score) {
        const h = this.scene.scale.height;
        const nb = Math.ceil(h / this.hauteur) + this.C.lanes.margeBandesHaut;

        for (let i = 0; i < nb; i++) {
            const def = this._obtenirLigne(i);
            const y = h - this.hauteur / 2 - i * this.hauteur;
            this._ajouterBande(i, y, def);
        }
    }

    /**
     * Un bond avant : le monde a déjà glissé vers le bas (defilerBas(),
     * appelé par la scène quand le joueur franchit le seuil haut) ; la
     * bande du bas (hors écran) est recyclée en haut avec la définition
     * de la ligne suivante. À appeler à chaque bond avant du joueur
     * (étape 5 : contrôles).
     *
     * COMPENSATION DU DÉCALAGE : la rotation du pool (shift + push) décale
     * chaque bande d'un slot vers le haut du tableau ; redimensionner()
     * positionne par slot, donc sans compensation le monde dériverait d'une
     * bande vers le bas à CHAQUE recyclage (le joueur grimperait le pool et
     * se retrouverait sans bande au-dessus — bug révélé par le harnais,
     * bond 17). On soustrait donc une hauteur à `decalage` : le défilement
     * visible (defilerBas) et la rotation se compensent, et `decalage`
     * reste invariant (≈0) — le monde couvre toujours l'écran.
     * @param {number} score score courant (difficulté qui monte)
     * @returns {object} la bande recyclée (nouvelle bande en haut)
     */
    avancer(score) {
        // La nouvelle bande est posée AU-DESSUS de la plus haute (`haut`) :
        // c'est elle qui sert de référence aux règles de tampon.
        const bas = this.bandes.shift();
        const haut = this.bandes[this.bandes.length - 1];
        const nouvelIndex = haut.index + 1;

        // D2-1 : relire la définition si la ligne existe déjà (le joueur
        // est redescendu puis remonte), sinon la générer et la stocker.
        const def = this._obtenirLigne(nouvelIndex, "haut");
        // y provisoire (0) : redimensionner() replace chaque bande à son
        // slot + decalage — la bande recyclée reprend le slot du haut.
        this._recyclerBande(bas, 0, def, "haut");
        bas.index = nouvelIndex;
        this.bandes.push(bas);
        this.decalage -= this.hauteur;   // compensation de la rotation
        this.redimensionner();
        return bas;
    }

    /**
     * Un bond arrière : s'il n'y a plus de bande sous le joueur (bande du
     * bas du pool), la bande du haut — sortie de l'écran — est recyclée EN
     * DESSOUS avec la définition de la ligne précédente. La scène enchaîne
     * avec defilerHaut() pour faire entrer la nouvelle bande par le bas
     * sans sortir le joueur de l'écran.
     *
     * ⭐ D2-1 (spec 708 §7) : la ligne recréée en dessous est RELUE depuis
     * generatedRows[index] quand elle existe (retour sur nos pas = la même
     * ligne, rien n'est réinventé) ; elle n'est générée que si le joueur
     * ne l'a jamais atteinte (lazy). Et le monde est BORNÉ : reculer()
     * retourne null si la ligne visée est avant l'index 0 — rien ne peut
     * exister avant le début (Décision 2, article 704).
     *
     * COMPENSATION DU DÉCALAGE (miroir d'avancer()) : le unshift décale
     * chaque bande d'un slot vers le bas du tableau ; on ajoute une hauteur
     * à `decalage` pour que le monde reste immobile pendant la rotation.
     * @param {number} score score courant (difficulté qui monte)
     * @returns {object|null} la bande recyclée (nouvelle bande en bas), ou
     *   null si la ligne visée est avant l'index 0 (début du monde)
     */
    reculer(score) {
        // La nouvelle bande est posée AU-DESSOUS de la plus basse (`bas`).
        const haut = this.bandes.pop();
        const bas = this.bandes[0];
        const nouvelIndex = bas.index - 1;

        // D2-1 : jamais avant le début — l'index 0 est la première ligne.
        if (nouvelIndex < 0) {
            this.bandes.push(haut);   // on remet la bande du haut en place
            return null;
        }

        // D2-1 : relire la définition si la ligne existe déjà (retour sur
        // nos pas), sinon la générer et la stocker (lazy).
        const def = this._obtenirLigne(nouvelIndex, "bas");
        this._recyclerBande(haut, 0, def, "bas");
        haut.index = nouvelIndex;
        this.bandes.unshift(haut);
        this.decalage += this.hauteur;   // compensation de la rotation
        this.redimensionner();
        return haut;
    }

    /**
     * Fait glisser le monde d'une bande vers le bas (le joueur avance) :
     * chaque bande descend d'une hauteur ; la bande du bas sort de l'écran
     * (elle sera recyclée en haut par avancer()).
     */
    defilerBas() {
        this.decalage += this.hauteur;
        this.redimensionner();
    }

    /**
     * Fait glisser le monde d'une bande vers le haut (le joueur recule) :
     * chaque bande monte d'une hauteur ; la bande du haut sort de l'écran
     * (elle reste dans le pool, prête à revenir).
     */
    defilerHaut() {
        this.decalage -= this.hauteur;
        this.redimensionner();
    }

    /**
     * Fait avancer les obstacles latéraux : véhicules (route, piste),
     * plantes/bateaux (eau) et trains (train), recyclés quand ils sortent
     * de l'écran à gauche ou à droite. À appeler depuis update() de la
     * scène.
     */
    update(time, delta) {
        const w = this.scene.scale.width;
        const marge = this.hauteur; // marge de sortie latérale

        // Fin de la fenêtre de son du signal (un seul à la fois).
        if (this._sonSignalFin !== null && time >= this._sonSignalFin) {
            this._sonSignalFin = null;
        }

        for (const bande of this.bandes) {
            if (bande.type === LaneGenerator.TYPES.ROUTE ||
                bande.type === LaneGenerator.TYPES.PISTE) {
                this._deriver(bande.vehicules, w, marge, delta);
            } else if (bande.type === LaneGenerator.TYPES.EAU) {
                this._deriver(bande.flottants, w, marge, delta);
            } else if (bande.type === LaneGenerator.TYPES.TRAIN) {
                this._mettreAJourRails(bande, w, marge, delta);
            }
        }
    }

    /**
     * Fait dériver une liste d'obstacles latéraux (recyclage aux bords).
     * Depuis D2-2 (spec 708 §5), la vitesse de chaque obstacle est
     * individuelle (cases/seconde, ±30 % autour de la base) : le
     * déplacement en pixels est recalculé à chaque frame avec la largeur
     * de case courante (indépendant de la résolution, comme les positions).
     */
    _deriver(obstacles, w, marge, delta) {
        const cellW = w / this.C.lanes.largeurCases;
        for (const o of obstacles) {
            // Le sens de circulation applique la direction : les obstacles
            // direction=-1 (« gauche ») dérivent vers la gauche, les
            // direction=+1 vers la droite (fix NC-1 review t_d8bbd197).
            o.sprite.x += o.direction * o.vitesseCases * cellW * (delta / 1000);
            if (o.direction > 0 && o.sprite.x - o.demiLargeur > w + marge) {
                o.sprite.x = -o.demiLargeur - marge;   // ressort à gauche
            } else if (o.direction < 0 && o.sprite.x + o.demiLargeur < -marge) {
                o.sprite.x = w + o.demiLargeur + marge; // ressort à droite
            }
        }
    }

    /**
     * Recalcule les tailles et positions quand l'écran change (rotation,
     * redimensionnement). À brancher via Arcade.UI.layout().
     */
    redimensionner() {
        const C = this.C;
        const w = this.scene.scale.width;
        const h = this.scene.scale.height;

        this.hauteur = h * (C.lanes.hauteurBandePct / 100);
        const cellW = w / C.lanes.largeurCases;   // largeur d'une case (grille 20)

        this.bandes.forEach((bande, i) => {
            // Position de la bande : slot de base (bande 0 en bas de
            // l'écran) + décalage de défilement du monde (étape 5).
            bande.y = h - this.hauteur / 2 - i * this.hauteur + this.decalage;
            bande.sol.setSize(w, this.hauteur).setPosition(0, bande.y - this.hauteur / 2);
            if (bande.ballast) {
                bande.ballast
                    .setSize(w, this.hauteur)
                    .setPosition(0, bande.y - this.hauteur / 2);
            }
            if (bande.marquage) {
                bande.marquage
                    .setSize(w, this.hauteur * 0.22)
                    .setPosition(0, bande.y);
            }
            if (bande.type === LaneGenerator.TYPES.TRAIN) {
                // Une seule voie par bande : le motif 16x16 est mis à
                // l'échelle de la hauteur de bande (sinon il se tuilerait
                // plusieurs fois verticalement).
                bande.sol.setTileScale(this.hauteur / 16, this.hauteur / 16);
                if (bande.signal) this._positionnerSignal(bande);
                if (bande.train) {
                    bande.train.vitesse = w / bande.train.dureeTraversee;
                    bande.train.cote = this.hauteur * 0.9;
                    bande.train.demiLargeur = bande.train.nb * bande.train.cote / 2;
                    for (const s of bande.train.sprites) {
                        s.y = bande.y;
                        // Corps Arcade resynchronisé avec la nouvelle taille
                        // (le corps ne suit pas le displaySize tout seul).
                        this.pool.taille(s, bande.train.cote);
                    }
                }
            }
            // Véhicules (route/piste) : largeur = cases × case (min. une
            // demi-bande), hauteur ≈ bande — recalculées à la résolution
            // courante ; vitesse en cases/s inchangée (convertie à la frame).
            for (const v of bande.vehicules) {
                v.sprite.y = bande.y;
                v.largeurPx = Math.max(v.largeurCases * cellW, this.hauteur * 0.5);
                v.cote = this.hauteur * v.fracHauteur;
                v.demiLargeur = v.largeurPx / 2;
                this.pool.tailleRect(v.sprite, v.largeurPx, v.cote);
            }
            // Flottants (eau : plantes et bateaux) — idem.
            for (const f of bande.flottants) {
                f.sprite.y = bande.y;
                f.largeurPx = Math.max(f.largeurCases * cellW, this.hauteur * 0.6);
                f.cote = this.hauteur * f.fracHauteur;
                f.demiLargeur = f.largeurPx / 2;
                this.pool.tailleRect(f.sprite, f.largeurPx, f.cote);
            }
            for (const d of bande.decor) {
                d.sprite.y = bande.y + (d.offsetY - 0.5) * this.hauteur;
                this.pool.taille(d.sprite, d.taille);
            }
        });
    }

    // ------------------------------------------------------------------
    // Interrogation (utile aux étapes suivantes : contrôles, collisions)
    // ------------------------------------------------------------------

    /** Bande contenant la position verticale y, ou null si hors monde. */
    bandeAt(y) {
        for (const bande of this.bandes) {
            if (y >= bande.y - this.hauteur / 2 && y < bande.y + this.hauteur / 2) {
                return bande;
            }
        }
        return null;
    }

    /** Bande de départ (celle où le joueur apparaît). */
    bandeDepart() {
        return this.bandes[0];
    }

    // ------------------------------------------------------------------
    // ⭐ D2-1 — generatedRows : lecture lazy / génération unique (spec 708 §7)
    // ------------------------------------------------------------------

    /**
     * Renvoie la définition de la ligne d'index donné, en la générant SI
     * ET SEULEMENT SI elle n'existe pas encore. C'est le cœur du monde
     * stable : si generatedRows[index] existe déjà, on RELIT — jamais de
     * régénération (corrige le bug « ça se réinvente au retour »).
     * @param {number} index index absolu de la ligne (0 = départ)
     * @param {string} [cote] "haut" (défaut) ou "bas" — côté où la ligne
     *   est posée, transmis aux règles de tampon et de direction
     * @returns {object} la définition { index, type, obstacles[], vitesse, ... }
     */
    _obtenirLigne(index, cote) {
        let def = this.generatedRows[index];
        if (def) {
            // D2-2 : normalisation des types hérités de sauvegardes v2
            // d'avant D2-2 (zone_sure/rails n'existent plus — les 7 types
            // de la spec 708 §3 font foi). Les défauts de rendu (obstacles
            // vides, largeur 1) gardent la ligne jouable.
            if (def.type === "zone_sure") {
                def.type = LaneGenerator.TYPES.HERBE;
                if (!def.sousType) def.sousType = "prairie";
            } else if (def.type === "rails") {
                def.type = LaneGenerator.TYPES.TRAIN;
            }
            return def;
        }
        const nouvelle = this._definirLigne(index, cote);
        this.generatedRows[index] = nouvelle;
        return nouvelle;
    }

    // ------------------------------------------------------------------
    // ⭐ D2-2 — Règles de génération des lignes (spec 708 §3/§4/§5/§6)
    // ------------------------------------------------------------------

    /**
     * Construit la DÉFINITION complète d'une ligne jamais vue : type
     * (règles de tampon de la spec 708 §4, cf. _choisirType), sous-type,
     * texture de sol, sens, vitesse, densité et obstacles (positions en
     * FRACTION de largeur d'écran — indépendant de la résolution pour la
     * persistance). La définition est sérialisable (JSON) : c'est elle
     * qui est stockée dans generatedRows et persistée dans la save.
     * @param {number} index index absolu de la ligne (0 = départ)
     * @param {string} [cote] côté où la ligne est posée ("haut"/"bas")
     * @returns {object} la définition complète de la ligne
     */
    _definirLigne(index, cote) {
        const T = LaneGenerator.TYPES;
        const C = this.C.lanes;

        // Choix du type : { type, tampon } — tampon = run de tampon ouvert
        // par CETTE ligne (spec 708 §4), stocké dans la définition pour
        // rester déterministe au retour (jamais régénéré).
        const choix = this._choisirType(index, cote);
        const type = choix.type;

        // ⭐ Fin de niveau (Décision John 08/08/2026, art. 704) : détection
        // de la zone de fin (index ≥ lignesNiveau) pour le RENDU — les
        // herbes du pattern sont des prairies SANS vigne (pattern identique
        // sur tous les niveaux) et la DERNIÈRE porte la maison.
        const debutFin = this.lignesNiveau(this.niveau);
        const dansFin = index - debutFin;
        const estZoneFin = index >= debutFin;
        const fin = this._finNiveau();

        let sousType = null;
        if (type === T.HERBE) {
            // La bande de départ (index 0/1) est toujours une prairie :
            // comportement historique, gardé pour la stabilité visuelle.
            sousType = (index > 1 && !estZoneFin && Math.random() < C.probVigne) ? "vigne" : "prairie";
        }

        const def = {
            index: index,
            type: type,
            obstacles: [],   // spec 708 §7 : obstacles de la ligne
            vitesse: 0,      // spec 708 §7 : vitesse de la ligne (cases/s)
            // Champs de rendu (sérialisables, nécessaires pour rejouer la
            // ligne à l'identique au retour) :
            sousType: sousType,
            direction: null,   // route/piste/eau/train : -1 (gauche) ou +1 (droite)
            densite: 0,        // route/piste/eau : nombre d'obstacles
            sol: null,         // texture du sol (stabilité au retour)
            solTileX: 0,       // décalage du motif du sol (stabilité)
            decor: [],         // zone sûre : [{texture, x, offsetY, taille}]
            train: null,       // train : définition du convoi
            // spec 708 §4 : run de tampon ouvert par cette ligne, ex.
            // eau → { type: "herbe", reste: 1..3, apres: null },
            // route→train « avec » → { type: "terre", reste: 1..3, apres: "train" }.
            // Décidé UNE FOIS ici, relu au retour — jamais régénéré.
            tampon: choix.tampon || null
        };

        const w = this.scene.scale.width;
        if (type === T.ROUTE) {
            def.sol = "route_pleine";
            def.solTileX = Math.floor(Math.random() * w);
            this._definirRoute(def, index, cote);
        } else if (type === T.PISTE) {
            def.sol = this._texturePisteSol();
            def.solTileX = Math.floor(Math.random() * w);
            this._definirPiste(def, index, cote);
        } else if (type === T.EAU) {
            def.sol = this._textureEau();
            def.solTileX = Math.floor(Math.random() * w);
            this._definirEau(def, index, cote);
        } else if (type === T.TRAIN) {
            def.sol = this._textureRails();
            def.solTileX = Math.floor(Math.random() * 16);
            this._definirTrain(def, index, cote);
        } else if (type === T.TERRE) {
            def.sol = this._textureTerre();
            def.solTileX = Math.floor(Math.random() * w);
            this._definirTerre(def);
        } else if (type === T.BUISSON) {
            def.sol = this._textureHerbe();
            def.solTileX = Math.floor(Math.random() * w);
            this._definirBuisson(def);
        } else if (type === T.BETON) {
            // ⭐ Fin de niveau (Décision John 08/08/2026, art. 704) : le
            // béton est une ligne SÛRE sans danger (le joueur la
            // TRAVERSE) — sol pave, aucun obstacle, aucun décor. Les 3
            // lignes de béton marquent visuellement l'approche de la fin.
            def.sol = this._textureBeton();
            def.solTileX = Math.floor(Math.random() * w);
        } else {
            def.sol = this._textureHerbe();
            def.solTileX = Math.floor(Math.random() * w);
            if (estZoneFin) {
                // ⭐ Fin de niveau (art. 704) : les herbes du pattern de fin
                // sont des prairies NUE (aucun arbre — la maison est le
                // seul décor, pattern identique sur tous les niveaux) ; la
                // MAISON est posée sur la DERNIÈRE ligne d'herbe (celle
                // d'index indexFin(), qui déclenche la victoire).
                if (dansFin === fin.beton + fin.herbe - 1) {
                    def.decor.push(this._definirMaison());
                }
            } else if (sousType === "vigne") {
                this._definirVigne(def);
            } else {
                this._definirPrairie(def);
            }
        }
        return def;
    }

    /**
     * Choisit le type de la ligne d'index donné, posée du côté `cote`.
     * Règles de tampon de la spec 708 §4, déterministes depuis
     * generatedRows (la génération reste lazy et relue — jamais régénérée) :
     *
     *  1. TAMPON EN COURS : une ligne dangereuse déjà posée impose 1 à 3
     *     lignes de son tampon APRÈS elle (eau→herbe, train→terre,
     *     route→buisson, piste→tampon aléatoire), et la transition
     *     route→train « avec tampon » impose terre puis train (apres).
     *  2. TRANSITION depuis la ligne voisine déjà posée : eau → herbe,
     *     train → terre (filets de sécurité pour les définitions héritées
     *     sans champ tampon) ; route → groupe de routes / train direct /
     *     buisson (voir _typeApresRoute).
     *  3. CHOIX LIBRE pondéré, avec tampon AVANT : une route ne suit
     *     qu'un buisson, une eau qu'une herbe, un train qu'une terre, la
     *     piste accepte n'importe quel voisin sûr (spec 708 §4).
     *
     * @param {number} index index absolu de la ligne (0 = départ)
     * @param {string} [cote] "haut" (défaut) ou "bas"
     * @returns {{type: string, tampon: object|null}} type choisi + run de
     *   tampon ouvert par cette ligne (le cas échéant)
     */
    _choisirType(index, cote) {
        const T = LaneGenerator.TYPES;
        cote = cote || "haut";

        // Départ en douceur (comportement historique) : index 0 et 1
        // toujours herbe — aucun danger si tôt, le joueur prend ses marques.
        if (index <= 1) return { type: T.HERBE, tampon: null };

        // ⭐ FIN DE NIVEAU (Décision John 08/08/2026, art. 704) : le
        // pattern VISUEL FIXE remplace la fin « nue » de la spec 708 §10.
        // Dès que l'index atteint lignes(niveau), le monde entre dans la
        // zone de fin — 3 lignes de BÉTON puis 4 lignes d'HERBE, une
        // MAISON posée sur la dernière (indexFin()). Aucun tirage
        // aléatoire, aucun tampon : le pattern est IDENTIQUE sur tous les
        // niveaux. Au-delà du pattern, herbe neutre (marge d'avance
        // seulement — le joueur gagne à la maison, jamais plus loin).
        const debutFin = this.lignesNiveau(this.niveau);
        if (index >= debutFin) {
            const fin = this._finNiveau();
            const dansFin = index - debutFin;
            if (dansFin >= fin.beton + fin.herbe) {
                return { type: T.HERBE, tampon: null };
            }
            if (dansFin < fin.beton) {
                return { type: T.BETON, tampon: null };
            }
            return { type: T.HERBE, tampon: null };
        }

        // 1) Tampon en cours (spec 708 §4) : ligne déjà posée qui impose
        // son tampon (ou la fin d'un tampon route→train : train forcé).
        const force = this._tamponEnCours(index, cote);
        if (force) {
            // Une ligne DANGEREUSE forcée (ex. train après le tampon terre
            // de la transition route→train) ouvre elle-même son tampon
            // APRÈS elle (terre après train, obligatoire).
            const tampon = (force === T.EAU || force === T.TRAIN || force === T.PISTE)
                ? this._tamponApres(force)
                : null;
            return { type: force, tampon: tampon };
        }

        // 2) Transition depuis la ligne voisine déjà posée (côté où la
        // nouvelle ligne est posée). En pratique la génération est toujours
        // vers le haut (avancer()) ; le côté « bas » (reculer()) relit des
        // lignes déjà générées — les règles symétriques ci-dessous
        // garantissent aussi le tampon AVANT d'une dangereuse.
        const idxVoisin = cote === "bas" ? index + 1 : index - 1;
        const voisin = (this.generatedRows[idxVoisin] || {}).type || null;

        // Eau et train : leur tampon APRÈS est stocké sur la ligne
        // dangereuse (capturé à l'étape 1) ; ces transitions directes sont
        // des filets de sécurité pour les définitions héritées d'avant D2-2.
        if (voisin === T.EAU) return { type: T.HERBE, tampon: null };
        if (voisin === T.TRAIN) return { type: T.TERRE, tampon: null };
        if (voisin === T.ROUTE) return this._typeApresRoute(index, cote);

        // 3) Choix libre pondéré (tampon AVANT inclus dans les candidats).
        return this._choisirLibre(voisin);
    }

    /**
     * Spec 708 §4 — tampon en cours pour la ligne `index` posée en haut :
     * on remonte les indices à la recherche de la ligne dangereuse (ou du
     * début de tampon) la plus proche portant un champ `tampon`
     * { type, reste, apres }. Les lignes j+1..j+reste sont de type
     * `type` ; la ligne j+reste+1 est `apres` (si défini — transition
     * route→train « avec tampon ») ; au-delà, plus aucun tampon n'est
     * actif (deux runs ne peuvent pas se chevaucher : une ligne à tampon
     * est une ligne dangereuse ou un début de tampon, jamais une ligne de
     * tampon — la cohérence est garantie par le générateur lui-même).
     * @returns {string|null} type imposé (tampon ou apres), ou null
     */
    _tamponEnCours(index, cote) {
        if (cote === "bas") return null;   // côté bas : relit des lignes existantes
        for (let j = index - 1; this.generatedRows[j] !== undefined; j--) {
            const t = this.generatedRows[j].tampon;
            if (!t) continue;
            const distance = index - j;
            if (distance <= t.reste) return t.type;
            if (distance === t.reste + 1 && t.apres) return t.apres;
            return null;   // au-delà du run le plus proche : aucun autre actif
        }
        return null;
    }

    /**
     * Spec 708 §4 — type de la ligne posée juste après une ROUTE : le
     * groupe de routes continue (taille max `routeGroupe.max`, tirage
     * `probContinuer`) ou se termine par la transition route→train (avec
     * ou sans tampon, tiré au hasard) ou par le tampon buisson obligatoire.
     * @param {number} index index de la nouvelle ligne
     * @param {string} cote côté où elle est posée
     * @returns {{type: string, tampon: object|null}}
     */
    _typeApresRoute(index, cote) {
        const C = this.C.lanes;
        const T = LaneGenerator.TYPES;

        // « Groupes de routes qui s'enchaînent » (spec 708 §4) : tant que
        // le groupe n'a pas atteint sa taille max (levels.json
        // maxConsecutifs.route) et que le tirage continue, la route
        // enchaîne (chaque route du groupe alterne son sens de circulation,
        // cf. _directionVehicules).
        const nb = this._consecutives(index, cote, T.ROUTE);
        if (nb < this._maxConsecutifsRoute() && Math.random() < C.routeGroupe.probContinuer) {
            return { type: T.ROUTE, tampon: null };
        }

        // Fin du groupe : transition route→train (tampon aléatoire, avec
        // ou sans) OU tampon buisson obligatoire après la route.
        if (Math.random() < C.probRouteVersTrain) {
            if (Math.random() < C.probTamponRouteTrain) {
                // « Avec » tampon : 1 à 3 lignes de terre, puis TRAIN forcé
                // (apres) — le train garde ensuite son propre tampon terre.
                return {
                    type: T.TERRE,
                    tampon: { type: T.TERRE, reste: this._tamponReste(), apres: T.TRAIN }
                };
            }
            // « Sans » tampon : le train enchaîne DIRECTEMENT sur le groupe
            // de routes (exception documentée — spec 708 §4).
            return { type: T.TRAIN, tampon: this._tamponApres(T.TRAIN) };
        }
        // Tampon buisson obligatoire après la route (1 à 3 lignes).
        return {
            type: T.BUISSON,
            tampon: { type: T.BUISSON, reste: this._tamponReste(), apres: null }
        };
    }

    /**
     * Spec 708 §4 — choix libre pondéré du type (voisin sûr ou absent) :
     * lignes sûres (herbe + buisson/terre libres, nécessaires pour OUVRIR
     * les chaînes route/train) + lignes dangereuses AUTORISÉES par le
     * voisin (tampon AVANT obligatoire : route après buisson, eau après
     * herbe, train après terre, piste après tout voisin sûr).
     * @param {string|null} voisin type de la ligne voisine déjà posée
     * @returns {{type: string, tampon: object|null}}
     */
    _choisirLibre(voisin) {
        const C = this.C.lanes;
        const T = LaneGenerator.TYPES;

        const pRoute = this._probDangereuse(C.probRoute);
        const pEau = this._probDangereuse(C.probEau);
        const pTrain = this._probDangereuse(C.probTrain);
        const pPiste = this._probDangereuse(C.probPiste);
        const pDanger = Math.min(C.dangerMax, pRoute + pEau + pTrain + pPiste);
        const pSain = Math.max(0, 1 - pDanger);

        const candidats = [];
        const ajouter = (type, poids, tampon) => {
            if (poids > 0) candidats.push({ type: type, poids: poids, tampon: tampon || null });
        };

        // Lignes sûres : herbe générique + buisson/terre libres (tampons
        // des chaînes — une route ne suit qu'un buisson, un train qu'une
        // terre : sans eux, aucune route/train ne pourrait jamais démarrer).
        ajouter(T.HERBE, pSain * C.poidsSains.herbe, null);
        ajouter(T.BUISSON, pSain * C.poidsSains.buisson, null);
        ajouter(T.TERRE, pSain * C.poidsSains.terre, null);

        // Lignes dangereuses autorisées par le voisin (tampon AVANT).
        const voisinSain = voisin === null || voisin === T.HERBE ||
            voisin === T.BUISSON || voisin === T.TERRE;
        if (voisin === T.BUISSON) ajouter(T.ROUTE, pRoute, null);   // route après buisson
        if (voisin === T.HERBE) ajouter(T.EAU, pEau, this._tamponApres(T.EAU));
        if (voisin === T.TERRE) ajouter(T.TRAIN, pTrain, this._tamponApres(T.TRAIN));
        if (voisinSain) ajouter(T.PISTE, pPiste, this._tamponApres(T.PISTE));

        // D2-3 (spec 708 §3) : seuls les types AUTORISÉS par levels.json
        // (typesAutorisés — les 7 par défaut) participent au tirage.
        const autorises = this._typesAutorises();
        const tirer = candidats.filter((c) => autorises.indexOf(c.type) !== -1);

        // Tirage pondéré.
        const total = tirer.reduce((s, c) => s + c.poids, 0);
        if (total <= 0) return { type: T.HERBE, tampon: null };
        let r = Math.random() * total;
        for (const c of tirer) {
            r -= c.poids;
            if (r <= 0) return { type: c.type, tampon: c.tampon };
        }
        return tirer[tirer.length - 1];
    }

    /**
     * Spec 708 §4 — tampon APRÈS une ligne dangereuse : le run de tampon
     * { type, reste, apres } que la ligne ouvre. Eau → herbe (obligatoire),
     * train → terre (obligatoire), piste → tampon aléatoire avec ou sans
     * (type non imposé) ; route → null (les groupes sont gérés par
     * _typeApresRoute).
     * @param {string} type type de la ligne dangereuse
     * @returns {object|null}
     */
    _tamponApres(type) {
        const C = this.C.lanes;
        const T = LaneGenerator.TYPES;
        if (type === T.EAU) {
            return { type: T.HERBE, reste: this._tamponReste(), apres: null };
        }
        if (type === T.TRAIN) {
            return { type: T.TERRE, reste: this._tamponReste(), apres: null };
        }
        if (type === T.PISTE) {
            // Tampon aléatoire : avec ou sans, tiré au hasard ; type non
            // imposé (herbe, buisson ou terre — les seules lignes sûres,
            // restreintes aux types autorisés par levels.json).
            if (Math.random() < C.probPisteTampon) {
                const autorises = this._typesAutorises();
                const sains = [T.HERBE, T.BUISSON, T.TERRE]
                    .filter((t) => autorises.indexOf(t) !== -1);
                if (!sains.length) return null;
                return {
                    type: sains[Math.floor(Math.random() * sains.length)],
                    reste: this._tamponReste(),
                    apres: null
                };
            }
            return null;   // sans tampon
        }
        return null;
    }

    /** Spec 708 §4 : longueur d'un run de tampon, 1 à 3 lignes (levels.json). */
    _tamponReste() {
        const t = this._tamponLignes();
        return t.min + Math.floor(Math.random() * (t.max - t.min + 1));
    }

    /** Spec 708 §5 : probabilité d'un type dangereux au niveau courant. */
    _probDangereuse(cfg) {
        return Math.min(cfg.max, cfg.base + (this.niveau - 1) * cfg.parNiveau);
    }

    /**
     * Spec 708 §5 : vitesseBase(niveau) = 1.00 + 0.01 × (niveau − 1)
     * (multiplicateur ; ~2.0 au niveau 100, repère pas plafond — 708 §1).
     * Valeurs lues dans levels.json (config par niveau), repli défauts.
     * @returns {number} le multiplicateur (1.00 au niveau 1)
     */
    _vitesseBase() {
        const v = this._niveaux().vitesse || {};
        const base = (typeof v.base === "number") ? v.base : 1.00;
        const parNiveau = (typeof v.parNiveau === "number") ? v.parNiveau : 0.01;
        return base + parNiveau * (this.niveau - 1);
    }

    /**
     * Spec 708 §5 : variance aléatoire de ±30 % autour de la base PAR
     * VÉHICULE (ex. niveau 1 : 0.70 à 1.30). levels.json
     * vitesse.variance, repli config.js.
     * @returns {number} la variance (0.3 par défaut)
     */
    _varianceVitesse() {
        const v = this._niveaux().vitesse || {};
        return (typeof v.variance === "number") ? v.variance : this.C.lanes.varianceVitesse;
    }

    /**
     * Spec 708 §5 : direction ALTERNÉE — chaque ligne de véhicules va dans
     * le sens opposé de la ligne de véhicules précédente (route, eau ou
     * piste ; les tampons sûrs entre deux ne comptent pas, comme Frogger).
     * @param {number} index index de la ligne en cours
     * @param {string} [cote] côté où elle est posée
     * @returns {number} -1 (gauche) ou +1 (droite)
     */
    _directionVehicules(index, cote) {
        const T = LaneGenerator.TYPES;
        const sens = cote === "bas" ? 1 : -1;
        for (let j = index + sens; this.generatedRows[j] !== undefined; j += sens) {
            const d = this.generatedRows[j];
            if (d.type === T.ROUTE || d.type === T.EAU || d.type === T.PISTE) {
                const dir = d.direction || (Math.random() < 0.5 ? 1 : -1);
                return -dir;
            }
        }
        return Math.random() < 0.5 ? 1 : -1;
    }

    /**
     * Nombre de lignes consécutives du type donné à côté de la nouvelle
     * ligne, compté depuis generatedRows (D2-2 : déterministe, indépendant
     * du pool de bandes vivantes — le groupe de routes peut être plus bas
     * que la fenêtre de bandes rendues).
     * @param {number} index index de la nouvelle ligne
     * @param {string} cote côté où elle est posée ("haut"/"bas")
     * @param {string} type type à compter
     * @returns {number}
     */
    _consecutives(index, cote, type) {
        const sens = cote === "bas" ? 1 : -1;   // côté où la nouvelle ligne est posée
        let n = 0;
        for (let j = index + sens; (this.generatedRows[j] || {}).type === type; j += sens) {
            n++;
        }
        return n;
    }

    // ------------------------------------------------------------------
    // Construction / recyclage des bandes (rendu depuis la définition)
    // ------------------------------------------------------------------

    /**
     * Crée une bande neuve (index, y) et la rend depuis sa définition.
     * @param {number} index index absolu de la ligne
     * @param {number} y ordonnée initiale (px)
     * @param {object} def définition de la ligne (generatedRows[index])
     */
    _ajouterBande(index, y, def) {
        const bande = this._creerBande(index, def);
        bande.y = y;
        this._rendreBande(bande, def);
        this.bandes.push(bande);
        return bande;
    }

    /**
     * Crée la structure de bande VIDE (sans rendu) à partir de la
     * définition : type, sous-type, sens, vitesse, densité + conteneurs
     * de sprites + contrat de collision train.
     * @param {number} index index absolu de la ligne
     * @param {object} def définition de la ligne
     */
    _creerBande(index, def) {
        const bande = {
            index: index,
            type: def.type,
            sousType: def.sousType,
            y: 0,
            direction: def.direction,   // route/piste/eau/train : -1 ou +1
            vitesse: def.vitesse,       // route/piste/eau : cases/s commun (référence)
            densite: def.densite,       // route/piste/eau : nombre d'obstacles
            sol: null,         // tileSprite de fond
            marquage: null,    // route/piste : ligne pointillée centrale
            ballast: null,     // train : lit de gravier sous la voie
            signal: null,      // train : [feuHaut, feuBas] (feux de croisement)
            signalTemps: 0,    // train : accumulateur du clignotement (ms)
            signalAllume: false,
            phase: null,       // train : "attente" | "avertissement" | "passage"
            cycleTemps: 0,     // train : temps écoulé dans la phase (ms)
            attenteDuree: 0,   // train : durée d'attente avant le signal (ms)
            avertissementDuree: 0, // train : durée du signal avant passage (ms)
            train: null,       // train : convoi {direction, vitesse, x, cote,
                               //   nb, demiLargeur, dureeTraversee, sprites[]}
            decor: [],         // zone sûre : [{sprite, offsetY, taille}]
            vehicules: [],     // route/piste : [{sprite, direction, vitesseCases,
                               //   largeurCases, fracHauteur, cote, largeurPx, demiLargeur}]
            flottants: [],     // eau : [{sprite, direction, vitesseCases,
                               //   largeurCases, fracHauteur, cote, largeurPx, demiLargeur}]
            // Contrat exposé pour l'étape collisions : un point de la bande
            // (x, demiLargeur) est-il fauché par le train à cet instant ?
            estMortelAuPoint: function (x, demiLargeur) {
                if (bande.type !== LaneGenerator.TYPES.TRAIN) return false;
                if (!bande.train || bande.phase !== "passage") return false;
                return Math.abs(x - bande.train.x) <
                    bande.train.demiLargeur + (demiLargeur || 0);
            }
        };
        return bande;
    }

    /**
     * Recycle une bande : vide ses sprites (rendus au pool), lui réapplique
     * sa définition (type, sens, vitesse, obstacles) et la re-rend. Depuis
     * D2-1, la définition vient de generatedRows[index] (relue ou fraîche) :
     * le recyclage ne tire PLUS jamais de nouveau type au hasard.
     * @param {object} bande la bande vivante à recycler
     * @param {number} nouveauY ordonnée provisoire (redimensionner() fixera)
     * @param {object} def définition de la ligne (generatedRows[index])
     * @param {string} [cote] côté où la bande est posée ("haut" défaut /
     *   "bas") — transmis au rendu pour les règles de tampon et de
     *   direction (la ligne de référence n'est pas la même en haut et en
     *   bas du pool).
     */
    _recyclerBande(bande, nouveauY, def, cote) {
        for (const d of bande.decor) this.pool.rendre(d.sprite);
        for (const v of bande.vehicules) this.pool.rendre(v.sprite);
        for (const f of bande.flottants) this.pool.rendre(f.sprite);
        for (const s of (bande.train ? bande.train.sprites : [])) {
            this.pool.rendre(s);
        }
        bande.decor = [];
        bande.vehicules = [];
        bande.flottants = [];
        bande.train = null;
        bande.phase = null;
        bande.cycleTemps = 0;
        bande.type = def.type;
        bande.sousType = def.sousType;
        bande.direction = def.direction;
        bande.vitesse = def.vitesse;
        bande.densite = def.densite;
        bande.y = nouveauY;
        this._rendreBande(bande, def, cote);
    }

    /**
     * Rendu complet d'une bande depuis sa DÉFINITION (D2-1) : sol, décor,
     * véhicules ou train. Toutes les positions viennent de la définition
     * (fractions × taille d'écran) — le rendu est donc rejouable à
     * l'identique au retour, et indépendant de la résolution.
     * @param {object} bande la bande vivante (structure _creerBande)
     * @param {object} def définition de la ligne (generatedRows[index])
     * @param {string} [cote] côté où la bande est posée ("haut" défaut /
     *   "bas") — voir _recyclerBande.
     */
    _rendreBande(bande, def, cote) {
        const w = this.scene.scale.width;
        const T = LaneGenerator.TYPES;

        if (bande.type === T.ROUTE || bande.type === T.PISTE) {
            this._masquerVestigesRails(bande);
            this._rendreSol(bande, def.sol, def.solTileX);
            // Marquage central : ligne pointillée évoquant le milieu de
            // chaussée (route) ou la ligne de centre d'une piste.
            if (bande.marquage) {
                bande.marquage.setPosition(0, bande.y).setVisible(true); // bande recyclée
            } else {
                bande.marquage = this.scene.add
                    .tileSprite(0, bande.y, w, this.hauteur * 0.22, "route_ligne")
                    .setOrigin(0, 0.5)
                    .setDepth(LaneGenerator.DEPTH.marquage);
            }
            this._rendreRoute(bande, def, cote);
        } else if (bande.type === T.EAU) {
            // Bande recyclée qui n'est plus une route : le marquage fantôme
            // doit disparaître (il resterait visible au milieu de la rivière).
            if (bande.marquage) bande.marquage.setVisible(false);
            this._masquerVestigesRails(bande);
            this._rendreSol(bande, def.sol, def.solTileX);
            this._rendreEau(bande, def, cote);
        } else if (bande.type === T.TRAIN) {
            if (bande.marquage) bande.marquage.setVisible(false);
            // Lit de ballast sous la voie : la texture rails est ajourée
            // (ballast + traverses), le fond opaque est dessiné en dessous.
            this._rendreBallast(bande);
            this._rendreSol(bande, def.sol, def.solTileX);
            // Une seule voie par bande : le motif 16x16 est mis à l'échelle
            // de la hauteur de bande (sinon il se tuilerait plusieurs fois
            // verticalement), et décalé du tilePositionX de la définition.
            bande.sol.setTileScale(this.hauteur / 16, this.hauteur / 16);
            // Train D'ABORD (il fixe bande.direction), puis les feux :
            // _positionnerSignal place les feux du côté d'où arrive le train.
            this._initialiserTrain(bande, def, cote);
            this._creerSignal(bande);
        } else {
            if (bande.marquage) bande.marquage.setVisible(false);
            this._masquerVestigesRails(bande);
            this._rendreSol(bande, def.sol, def.solTileX);
            this._rendreZoneSure(bande, def);
        }
    }

    /** Masque les objets propres au train (feux, ballast) sur une bande recyclée. */
    _masquerVestigesRails(bande) {
        if (bande.signal) {
            bande.signal[0].setVisible(false);
            bande.signal[1].setVisible(false);
        }
        if (bande.ballast) bande.ballast.setVisible(false);
    }

    /** Pose (ou change) le tileSprite de sol de la bande. */
    _rendreSol(bande, texture, tileX) {
        const w = this.scene.scale.width;
        if (!bande.sol) {
            bande.sol = this.scene.add
                .tileSprite(0, bande.y - this.hauteur / 2, w, this.hauteur, texture)
                .setOrigin(0, 0)
                .setDepth(LaneGenerator.DEPTH.sol);
        } else {
            bande.sol.setTexture(texture).setSize(w, this.hauteur);
            // Bande recyclée : revenir à l'échelle 1 (une bande train avait
            // mis le tileScale à la taille de sa voie, cf. _rendreBande).
            bande.sol.setTileScale(1, 1);
        }
        // Décalage du motif stocké dans la définition (D2-1) : deux bandes
        // côte à côte ne sont pas identiques, et au retour la ligne rejoue
        // exactement le même rendu.
        bande.sol.tilePositionX = (typeof tileX === "number") ? tileX : 0;
    }

    /** Texture d'herbe de la zone sûre (3 variantes, une au hasard). */
    _textureHerbe() {
        const variantes = ["herbe", "herbe_fleurs_roses", "herbe_fleurs_vertes"];
        return variantes[Math.floor(Math.random() * variantes.length)];
    }

    /** Texture de terre du tampon du train (2 variantes atelier, tuilées). */
    _textureTerre() {
        const variantes = ["terre", "terre_v2"];
        return variantes[Math.floor(Math.random() * variantes.length)];
    }

    /** Texture de sol de la piste d'atterrissage (pave atelier, tuilé). */
    _texturePisteSol() {
        const variantes = ["piste", "piste_v2", "piste_v3"];
        return variantes[Math.floor(Math.random() * variantes.length)];
    }

    /**
     * ⭐ Fin de niveau (Décision John 08/08/2026, art. 704) : texture de
     * sol des lignes de BÉTON de fin (pave atelier, 2 variantes, tuilées).
     * @returns {string} clé de texture ("beton" / "beton_v2")
     */
    _textureBeton() {
        const variantes = ["beton", "beton_v2"];
        return variantes[Math.floor(Math.random() * variantes.length)];
    }

    // ------------------------------------------------------------------
    // Route + piste d'atterrissage : véhicules latéraux (spec 708 §5)
    // ------------------------------------------------------------------

    /**
     * Définit une bande route : sens (alterné, spec 708 §5), vitesse de
     * référence, densité (faible → 75 % max) et liste des véhicules
     * (positions en FRACTION de largeur, largeur 1 à 4 cases, vitesse
     * individuelle ±30 %). Rien n'est rendu ici — la définition est
     * stockée dans generatedRows puis rendue par _rendreRoute (et rejouée
     * à l'identique au retour, D2-1).
     */
    _definirRoute(def, index, cote) {
        const C = this.C.lanes;
        def.direction = this._directionVehicules(index, cote);
        // Vitesse de RÉFÉRENCE de la ligne (cases/s) : 1.00 + 0.01×(niveau−1)
        // × la référence absolue ; chaque véhicule applique sa variance ±30 %.
        def.vitesse = C.vitesseReferenceCasesParSec * this._vitesseBase();
        this._peuplerVehicules(def, this._densite().routePiste,
            (direction) => this._textureVehiculeRoute(direction));
    }

    /**
     * Définit une bande piste d'atterrissage (7e type, spec 708 §3) :
     * comportement IDENTIQUE à une route (véhicules volants qui se
     * déplacent comme des véhicules qui roulent, aucune mécanique spéciale
     * d'atterrissage/ombre d'alerte, spec 708 §5), même courbe de densité.
     * Seuls le sol (pave) et les textures (avions/hélicos) changent.
     */
    _definirPiste(def, index, cote) {
        const C = this.C.lanes;
        def.direction = this._directionVehicules(index, cote);
        def.vitesse = C.vitesseReferenceCasesParSec * this._vitesseBase();
        this._peuplerVehicules(def, this._densite().routePiste,
            (direction) => this._textureVehiculePiste(direction));
    }

    /**
     * Peuple une ligne de véhicules (route/piste, spec 708 §5) : cases
     * occupées 1 à 4 par véhicule (toutes textures mélangées via le
     * picker), densité de faible en début de jeu jusqu'à 75 % max de la
     * ligne occupée (plafond qui garantit « toujours au moins un passage
     * traversable » — jamais 100 % bloquée), vitesse INDIVIDUELLE
     * base ± 30 %. Positions en fractions de largeur d'écran (grille de
     * 20 cases) — sérialisable et rejouable à l'identique au retour.
     * @param {object} def définition de la ligne (route/piste)
     * @param {{minFrac: number, maxFrac: number}} densiteCfg courbe de densité
     * @param {Function} texturePicker (direction) => {texture, flipX}
     */
    _peuplerVehicules(def, densiteCfg, texturePicker) {
        const C = this.C.lanes;
        const nbCases = C.largeurCases;

        // Densité : linéaire de minFrac (début de jeu) à maxFrac 75 % (fin),
        // sur les niveaux 1 → repère 100 (spec 708 §1/§5 — pas un plafond).
        const progres = Math.min(1, (this.niveau - 1) / (this._niveauMaxRepere() - 1));
        const frac = densiteCfg.minFrac + (densiteCfg.maxFrac - densiteCfg.minFrac) * progres;
        const cible = Math.round(frac * nbCases);

        const base = C.vitesseReferenceCasesParSec * this._vitesseBase();
        const occupees = new Array(nbCases).fill(false);
        let restant = cible;
        let tours = 0;
        while (restant > 0 && tours < 400) {
            tours++;
            const debut = Math.floor(Math.random() * nbCases);
            if (occupees[debut]) continue;
            // Longueur 1 à 4 cases (spec 708 §5), bornée par la plage libre
            // contiguë à droite et par la densité restante (≤ 75 %).
            const tiree = C.vehiculeCases.min +
                Math.floor(Math.random() * (C.vehiculeCases.max - C.vehiculeCases.min + 1));
            let largeur = 1;
            while (largeur < tiree && debut + largeur < nbCases && !occupees[debut + largeur]) {
                largeur++;
            }
            largeur = Math.min(largeur, restant);
            for (let c = debut; c < debut + largeur; c++) occupees[c] = true;
            restant -= largeur;

            // Vitesse INDIVIDUELLE : base ± 30 % (spec 708 §5) — chaque
            // véhicule dérive à son propre rythme (pas métronomique).
            const alea = 1 + (Math.random() * 2 - 1) * this._varianceVitesse();
            const choixTexture = texturePicker(def.direction);
            def.obstacles.push({
                texture: choixTexture.texture,
                flipX: choixTexture.flipX || false,
                x: (debut + largeur / 2) / nbCases,   // centre en fraction
                largeur: largeur,                      // cases occupées
                vitesse: base * alea                   // cases/seconde
            });
        }
        def.densite = def.obstacles.length;
    }

    /** Rendu des véhicules d'une bande route/piste depuis sa définition. */
    _rendreRoute(bande, def, cote) {
        const w = this.scene.scale.width;
        const cellW = w / this.C.lanes.largeurCases;
        const baseVitesse = this.C.lanes.vitesseReferenceCasesParSec * this._vitesseBase();
        for (const o of def.obstacles) {
            const sprite = this.pool.prendre(o.texture, LaneGenerator.DEPTH.vehicule);
            sprite.setFlipX(!!o.flipX);
            // Largeur = cases occupées × case (min. une demi-bande pour que
            // les petits véhicules restent lisibles) ; hauteur ≈ bande.
            const largeurCases = o.largeur || 1;
            const largeurPx = Math.max(largeurCases * cellW, this.hauteur * 0.5);
            const hauteurPx = this.hauteur * 0.85;
            // Corps Arcade ACTIVÉ : le véhicule participe aux collisions
            // (contact = mort, étape 6).
            this.pool.activerRect(sprite, largeurPx, hauteurPx);
            const v = {
                sprite: sprite,
                direction: def.direction,
                // Vitesse en cases/s (définition, héritée ou fraîche) :
                // convertie en px à la frame (résolution indépendante).
                vitesseCases: (o.vitesse !== undefined) ? o.vitesse : baseVitesse,
                largeurCases: largeurCases,
                fracHauteur: 0.85,
                cote: hauteurPx,
                largeurPx: largeurPx,
                demiLargeur: largeurPx / 2
            };
            sprite.setPosition(o.x * w, bande.y);
            bande.vehicules.push(v);
        }
    }

    /**
     * Texture d'un véhicule de route selon le sens de circulation.
     * « Tous types mélangés » (spec 708 §5) : voitures vue de dessus (sens
     * dédiés droite/gauche, 3 couleurs) + taxi vu de côté (symétrique) +
     * bus vu de côté (calandre à gauche — vérifié pixel par pixel 06/08,
     * miroir quand il roule vers la droite).
     */
    _textureVehiculeRoute(direction) {
        const dessus = direction > 0
            ? ["voiture_rouge_dessus_droite", "voiture_verte_dessus_droite", "voiture_rose_dessus_droite"]
            : ["voiture_rouge_dessus_gauche", "voiture_verte_dessus_gauche", "voiture_rose_dessus_gauche"];
        const t = Math.random();
        if (t < 0.55) {
            return { texture: dessus[Math.floor(Math.random() * dessus.length)], flipX: false };
        }
        if (t < 0.85) {
            const taxis = ["taxi_jaune_cote", "taxi_jaune_cote_v2"];
            return { texture: taxis[Math.floor(Math.random() * taxis.length)], flipX: false };
        }
        return { texture: "bus_jaune_1", flipX: direction > 0 };
    }

    /**
     * Texture d'un véhicule volant de la piste d'atterrissage (spec 708
     * §3/§5 : même comportement qu'un véhicule de route) : avions vue de
     * dessus et hélicos, TOUS vérifiés pixel par pixel le 07/08 (fix
     * post-D2, t_2282d963 — règle studio : tout asset directionnel
     * orienté dans le sens de sa circulation) :
     *   - avions battle : le NEZ (verrière blanche) est à DROITE dans la
     *     texture (centre du cockpit x≈11/16) → miroir quand ils volent
     *     vers la gauche (direction < 0) — corrige le bug « avions à
     *     reculons » signalé par John ;
     *   - hélicos battle : la QUEUE (rotor de queue) est à DROITE dans la
     *     texture (vérifié 06/08) → miroir quand ils volent vers la
     *     droite (direction > 0), comportement conservé.
     */
    _textureVehiculePiste(direction) {
        if (Math.random() < 0.6) {
            const avions = ["avion_rouge", "avion_vert", "avion_bleu"];
            return { texture: avions[Math.floor(Math.random() * avions.length)], flipX: direction < 0 };
        }
        const helicos = ["helico_rouge", "helico_vert"];
        return { texture: helicos[Math.floor(Math.random() * helicos.length)], flipX: direction > 0 };
    }

    // ------------------------------------------------------------------
    // Eau : plantes (plateformes) + bateaux (spec 708 §6)
    // ------------------------------------------------------------------

    /** Texture d'eau de la bande (4 variantes, une au hasard). */
    _textureEau() {
        const variantes = ["eau", "eau_v2", "eau_v3", "eau_v4"];
        return variantes[Math.floor(Math.random() * variantes.length)];
    }

    /**
     * Définit une bande eau (spec 708 §6) : sens du courant (alterné),
     * vitesse du courant (formule spec 708 §5 appliquée à l'eau, ±30 % par
     * ligne — plantes et bateaux dérivent ENSEMBLE, comportement conservé
     * de l'étape 3 : « le joueur porté dérive avec le courant »),
     * plantes = plateformes (JAMAIS 0, courbe 75 % → 1-2 plantes) et
     * bateaux en REMPLACEMENT des plantes (miroir 0 % → 75 %, cases libres
     * uniquement — pas d'addition). Case ni plante ni bateau = eau vide =
     * mort au contact. Stockée dans generatedRows puis rendue par
     * _rendreEau (rejouable au retour).
     */
    _definirEau(def, index, cote) {
        const C = this.C.lanes;
        const nbCases = C.largeurCases;

        def.direction = this._directionVehicules(index, cote);
        // Courant : base(niveau) ± 30 % (spec 708 §5, variance levels.json),
        // en cases/seconde.
        def.vitesse = C.vitesseReferenceCasesParSec * this._vitesseBase() *
            (1 + (Math.random() * 2 - 1) * this._varianceVitesse());

        // Plantes : 75 % de la bande en début de jeu → 1 à 2 plantes en fin
        // (jamais 0 — garantit « toujours au moins un passage traversable »).
        // Bateaux : miroir de la route — 0 % en début → 75 % max en fin,
        // bornés par les cases restantes (remplacement, pas addition).
        // Courbes lues dans levels.json (config par niveau, spec 708 §6).
        const d = this._densite();
        const progres = Math.min(1, (this.niveau - 1) / (this._niveauMaxRepere() - 1));
        const fracPlantes = d.eauPlantes.maxFrac -
            (d.eauPlantes.maxFrac - d.eauPlantes.minFrac) * progres;
        const nbPlantes = Math.max(1, Math.round(fracPlantes * nbCases));

        const fracBateaux = d.eauBateaux.minFrac +
            (d.eauBateaux.maxFrac - d.eauBateaux.minFrac) * progres;
        const nbBateaux = Math.min(Math.round(fracBateaux * nbCases), nbCases - nbPlantes);

        const occupees = new Array(nbCases).fill(false);

        // Plantes : 1 case chacune, positions aléatoires distinctes.
        let posees = 0;
        let tours = 0;
        while (posees < nbPlantes && tours < 400) {
            tours++;
            const c = Math.floor(Math.random() * nbCases);
            if (occupees[c]) continue;
            occupees[c] = true;
            posees++;
            def.obstacles.push({
                type: "plante",
                texture: this._textureNenuphar(),
                x: (c + 0.5) / nbCases,
                largeur: 1
            });
        }

        // Bateaux : 1 à 4 cases (spec 708 §5), posés sur les cases NON
        // plantes (remplacement des plantes — spec 708 §6).
        let poses = 0;
        tours = 0;
        while (poses < nbBateaux && tours < 400) {
            tours++;
            const debut = Math.floor(Math.random() * nbCases);
            if (occupees[debut]) continue;
            const tiree = C.vehiculeCases.min +
                Math.floor(Math.random() * (C.vehiculeCases.max - C.vehiculeCases.min + 1));
            let largeur = 1;
            while (largeur < tiree && debut + largeur < nbCases && !occupees[debut + largeur]) {
                largeur++;
            }
            largeur = Math.min(largeur, nbBateaux - poses);
            for (let c = debut; c < debut + largeur; c++) occupees[c] = true;
            poses += largeur;
            const bateau = this._textureBateau(def.direction);
            def.obstacles.push({
                type: "bateau",
                texture: bateau.texture,
                flipX: bateau.flipX || false,
                x: (debut + largeur / 2) / nbCases,
                largeur: largeur
            });
        }
        def.densite = nbPlantes + poses;
    }

    /** Rendu des flottants d'une bande eau (plantes + bateaux) depuis sa définition. */
    _rendreEau(bande, def, cote) {
        const w = this.scene.scale.width;
        const cellW = w / this.C.lanes.largeurCases;
        for (const o of def.obstacles) {
            const sprite = this.pool.prendre(o.texture, LaneGenerator.DEPTH.flottant);
            sprite.setFlipX(!!o.flipX);
            const largeurCases = o.largeur || 1;
            const largeurPx = Math.max(largeurCases * cellW, this.hauteur * 0.6);
            const fracHauteur = o.type === "plante" ? 0.8 : 0.85;
            const hauteurPx = this.hauteur * fracHauteur;
            // Corps Arcade ACTIVÉ : un flottant est un support solide — le
            // joueur qui le chevauche n'est PAS tombé à l'eau (le « sol »
            // de la bande eau, étape 6).
            this.pool.activerRect(sprite, largeurPx, hauteurPx);
            const f = {
                sprite: sprite,
                direction: def.direction,
                vitesseCases: def.vitesse,   // courant uniforme (plantes + bateaux)
                largeurCases: largeurCases,
                fracHauteur: fracHauteur,
                cote: hauteurPx,
                largeurPx: largeurPx,
                demiLargeur: largeurPx / 2
            };
            sprite.setPosition(o.x * w, bande.y);
            bande.flottants.push(f);
        }
    }

    /** Texture d'un nénuphar flottant (rogrpg : simple, double, fleur). */
    _textureNenuphar() {
        const textures = ["nenuphar_simple", "nenuphar_double", "nenuphar_fleur"];
        return textures[Math.floor(Math.random() * textures.length)];
    }

    /**
     * Texture d'un bateau (véhicule de l'eau, spec 708 §6) : barques
     * rogrpg de l'atelier. Fix post-D2 (t_2282d963, règle studio : tout
     * asset directionnel orienté dans le sens de sa circulation) :
     *   - les textures sont TOURNÉES de 90° au chargement (main.js :
     *     barque_v1_h/v2_h/v3_h, comme rails_v3_h le 06/08) — elles
     *     étaient dessinées avec la longueur VERTICALE (extrémités
     *     relevées en haut/bas du sprite) alors que les barques
     *     NAVIGUENT horizontalement ; après rotation, la longueur suit
     *     le courant ;
     *   - la proue (grandes extrémités relevées) est à DROITE dans les
     *     textures tournées (vérifié pixel par pixel le 07/08) → miroir
     *     quand la bande va vers la gauche (direction < 0), comme les
     *     avions de la piste.
     * @param {number} direction sens de circulation de la bande (-1/+1)
     * @returns {{texture: string, flipX: boolean}}
     */
    _textureBateau(direction) {
        const textures = ["barque_v1_h", "barque_v2_h", "barque_v3_h"];
        return {
            texture: textures[Math.floor(Math.random() * textures.length)],
            flipX: direction < 0
        };
    }

    // ------------------------------------------------------------------
    // Train : voie ferrée et train périodique (étape 4, comportement
    // conservé — seule la terre tamponne désormais autour, spec 708 §4)
    // ------------------------------------------------------------------

    /**
     * Texture de la voie (3 variantes, une au hasard).
     * rails_v3_h = rogrpg_rails_horizontal_v3.png tournée de 90° au
     * chargement (ses barres métalliques étaient verticales — décision
     * John 06/08, CDC 706 §Assets — pour que les rails suivent le sens
     * du train, comme v1/v2 déjà horizontales).
     */
    _textureRails() {
        const variantes = ["rails_v1", "rails_v2", "rails_v3_h"];
        return variantes[Math.floor(Math.random() * variantes.length)];
    }

    /** Lit de ballast opaque sous la voie (la texture rails est ajourée). */
    _rendreBallast(bande) {
        const w = this.scene.scale.width;
        if (!bande.ballast) {
            bande.ballast = this.scene.add
                .rectangle(0, bande.y - this.hauteur / 2, w, this.hauteur,
                    this.C.couleurs.ballast)
                .setOrigin(0, 0)
                .setDepth(LaneGenerator.DEPTH.ballast);
        }
        bande.ballast
            .setVisible(true)
            .setSize(w, this.hauteur)
            .setPosition(0, bande.y - this.hauteur / 2);
    }

    /**
     * Feux de croisement de la bande : deux cercles rouges empilés, posés
     * du côté d'où arrive le train. Au repos ils sont visibles en rouge
     * sombre (le passage existe) ; pendant l'avertissement et le passage
     * ils clignotent en alternance (cf. _clignoterSignal).
     */
    _creerSignal(bande) {
        if (!bande.signal) {
            const feu = () => this.scene.add
                .circle(0, 0, this.hauteur * 0.15, this.C.couleurs.feuSignal)
                .setDepth(LaneGenerator.DEPTH.signal);
            bande.signal = [feu(), feu()];
        }
        bande.signalTemps = 0;
        bande.signalAllume = false;
        this._positionnerSignal(bande);
        // Au repos : les deux feux visibles en rouge sombre (fixes).
        bande.signal[0].setVisible(true);
        bande.signal[1].setVisible(true);
    }

    /** Repositionne les feux (création, recyclage, redimensionnement). */
    _positionnerSignal(bande) {
        const w = this.scene.scale.width;
        const rayon = this.hauteur * 0.15;
        const ecart = this.hauteur * 0.24;
        const x = bande.direction > 0 ? w * 0.05 : w * 0.95;
        bande.signal[0].setRadius(rayon).setPosition(x, bande.y - ecart);
        bande.signal[1].setRadius(rayon).setPosition(x, bande.y + ecart);
    }

    /**
     * Clignotement des feux. `actif` = phase d'avertissement/passage :
     * les feux s'allument en alternance (~5,5 Hz). Au repos (attente) :
     * les deux feux reviennent fixes et visibles.
     */
    _clignoterSignal(bande, delta, actif) {
        bande.signalTemps += delta;
        if (bande.signalTemps < 180) return;
        bande.signalTemps -= 180;
        if (!actif) {
            // Repos : les deux feux visibles (rouge sombre, fixes) —
            // le passage existe, mais aucun train n'arrive.
            bande.signal[0].setVisible(true);
            bande.signal[1].setVisible(true);
            return;
        }
        bande.signalAllume = !bande.signalAllume;
        bande.signal[0].setVisible(bande.signalAllume);
        bande.signal[1].setVisible(!bande.signalAllume);
    }

    /**
     * Prépare le cycle du train d'une bande train depuis la DÉFINITION
     * (D2-1) : direction, durées et textures du convoi sont stockées dans
     * generatedRows — au retour sur une ligne déjà vue, le même train
     * repart exactement du même cycle (rien n'est réinventé). Phase
     * "attente", convoi caché hors de l'écran.
     */
    _initialiserTrain(bande, def, cote) {
        const C = this.C.lanes;
        const w = this.scene.scale.width;

        bande.direction = def.direction;

        // Durée de traversée : stockée dans la définition (stabilité au
        // retour) ; l'attente avant le signal est re-tirée à chaque cycle
        // (comportement vivant), mais la durée de signal est fixe.
        bande.avertissementDuree = def.avertissementDuree || C.railAvertissementMs;
        bande.attenteDuree = this._dureeAttente();

        const taille = this.hauteur * def.train.cote;
        const nb = def.train.nb;
        const train = {
            direction: bande.direction,
            vitesse: w / def.train.dureeTraversee,
            dureeTraversee: def.train.dureeTraversee,
            cote: taille,
            nb: nb,
            demiLargeur: (nb * taille) / 2,
            x: 0,
            sprites: []
        };
        for (let i = 0; i < nb; i++) {
            const sprite = this.pool.prendre(def.train.textures[i], LaneGenerator.DEPTH.train);
            // Corps Arcade ACTIVÉ : le train tue au contact (étape 6 — la
            // détection passe par bande.estMortelAuPoint, le corps reste
            // cohérent pour le debug &debug=1).
            this.pool.activer(sprite, taille);
            // Positionné hors écran du côté d'où il arrivera, masqué.
            sprite.setPosition(
                (i - (nb - 1) / 2) * taille + (bande.direction > 0 ? -w : w),
                bande.y
            );
            sprite.setVisible(false);
            train.sprites.push(sprite);
        }
        bande.train = train;
        bande.phase = "attente";
        bande.cycleTemps = 0;
    }

    /**
     * Durée d'attente (ms) avant le prochain signal : diminue avec la
     * difficulté (trains plus fréquents), aléa ±30 % pour que les passages
     * ne soient pas métronomiques.
     */
    _dureeAttente() {
        const C = this.C.lanes;
        let duree = C.railAttente.base - this.niveau * C.railAttente.parNiveau;
        duree = Math.max(C.railAttente.min, duree);
        return duree * (0.7 + Math.random() * 0.6);
    }

    /** « Locomotive » du convoi : wagonnet charbon (placeholder, cf. en-tête). */
    _textureLoco() {
        return "wagonnet_charbon";
    }

    /** Texture d'un wagon du convoi (cargaisons rogrpg variées). */
    _textureWagon() {
        const textures = [
            "wagonnet_vide", "wagonnet_terre", "wagonnet_pierres", "wagonnet_or"
        ];
        return textures[Math.floor(Math.random() * textures.length)];
    }

    /**
     * Définit une bande train : sens de circulation, durée de traversée
     * (stockée), signal et convoi (textures des wagons) — le tout en
     * fractions, sérialisable et rejouable à l'identique au retour (D2-1).
     * L'état du cycle (attente/avertissement/passage) reste un comportement
     * vivant re-tiré à chaque rendu, comme les positions des véhicules.
     * D2-2 : les tampons terre autour du train sont gérés par les règles
     * de tampon (spec 708 §4) — la notion d'« 2e rails consécutive » a
     * disparu (deux bandes train ne peuvent plus être adjacentes).
     */
    _definirTrain(def, index, cote) {
        const C = this.C.lanes;
        def.direction = Math.random() < 0.5 ? 1 : -1;

        // Durée de traversée : rapide, diminue avec la difficulté.
        let duree = C.railDureeTraversee.base -
            this.niveau * C.railDureeTraversee.parNiveau;
        duree = Math.max(C.railDureeTraversee.min, duree);
        def.dureeTraversee = duree;

        // Signal avant passage : constante — c'est la fenêtre pour QUITTER.
        def.avertissementDuree = C.railAvertissementMs;

        // Convoi : 1 « loco » (wagonnet charbon) + 2 wagons (placeholder,
        // cf. en-tête), textures stockées pour rejouer le même train.
        const nb = 3;
        const textures = [this._textureLoco()];
        for (let i = 1; i < nb; i++) textures.push(this._textureWagon());
        def.train = {
            direction: def.direction,
            dureeTraversee: duree,
            cote: 0.9,          // fraction de la hauteur de bande
            nb: nb,
            textures: textures
        };
    }

    /**
     * Fait tourner le cycle du train d'une bande train (appelé depuis
     * update()) : attente → avertissement (signal sonore + feux qui
     * clignotent) → passage (le convoi traverse à grande vitesse) →
     * attente.
     */
    _mettreAJourRails(bande, w, marge, delta) {
        bande.cycleTemps += delta;

        if (bande.phase === "attente") {
            this._clignoterSignal(bande, delta, false);
            if (bande.cycleTemps >= bande.attenteDuree) {
                bande.phase = "avertissement";
                bande.cycleTemps = 0;
                this.compteurs.avertissements++;
                this._jouerSignalSonore();
            }
        } else if (bande.phase === "avertissement") {
            this._clignoterSignal(bande, delta, true);
            if (bande.cycleTemps >= bande.avertissementDuree) {
                bande.phase = "passage";
                bande.cycleTemps = 0;
                this.compteurs.passages++;
                this._demarrerPassage(bande, w, marge);
            }
        } else {  // "passage"
            this._clignoterSignal(bande, delta, true);
            const t = bande.train;
            t.x += t.direction * t.vitesse * (delta / 1000);
            for (let i = 0; i < t.sprites.length; i++) {
                t.sprites[i].x = t.x + (i - (t.nb - 1) / 2) * t.cote;
            }
            // Convoi entièrement sorti de l'autre côté : retour à l'attente.
            const sorti = t.direction > 0
                ? t.x - t.demiLargeur > w + marge
                : t.x + t.demiLargeur < -marge;
            if (sorti) {
                for (const s of t.sprites) s.setVisible(false);
                bande.phase = "attente";
                bande.cycleTemps = 0;
                bande.attenteDuree = this._dureeAttente();
            }
        }
    }

    /** Place le convoi juste hors de l'écran, côté d'où il arrive. */
    _demarrerPassage(bande, w, marge) {
        const t = bande.train;
        t.x = t.direction > 0 ? -t.demiLargeur - marge : w + t.demiLargeur + marge;
        for (let i = 0; i < t.sprites.length; i++) {
            t.sprites[i].x = t.x + (i - (t.nb - 1) / 2) * t.cote;
            t.sprites[i].y = bande.y;
            t.sprites[i].setVisible(true);
        }
    }

    /**
     * Signal sonore du train : snd_error (MP3 de l'atelier, décision John
     * 06/08 — pas de sons dédiés), 3 bips rapprochés. Un seul signal sonore
     * à la fois sur tout le terrain (pas de cacophonie si deux bandes
     * train avertissent en même temps) ; si l'audio n'est pas encore
     * déverrouillée (pas de geste utilisateur), le signal visuel reste seul.
     */
    _jouerSignalSonore() {
        if (this._sonSignalFin !== null) return;  // un signal sonore en cours
        const scene = this.scene;
        if (!scene.sound || scene.sound.locked) return;  // audio verrouillée
        this._sonSignalFin = scene.time.now + 900;       // ~3 bips espacés
        try {
            const jouer = () => scene.sound.play("snd_error", { volume: 0.4 });
            jouer();
            scene.time.addEvent({ delay: 280, repeat: 1, callback: jouer });
        } catch (e) {
            this._sonSignalFin = null;
        }
    }

    // ------------------------------------------------------------------
    // Lignes sûres : herbe, buisson (tampon route), terre (tampon train)
    // ------------------------------------------------------------------

    /** Définition d'une prairie : herbe + quelques arbres/buissons épars. */
    _definirPrairie(def) {
        const C = this.C.lanes;
        const nb = C.decor.min + Math.floor(Math.random() * (C.decor.max - C.decor.min + 1));
        for (let i = 0; i < nb; i++) {
            def.decor.push(this._definirDecor(Math.random(), false));
        }
    }

    /** Définition d'une vigne : rangées verticales régulières de buissons. */
    _definirVigne(def) {
        const w = this.scene.scale.width;
        const rangs = 3;
        for (let i = 0; i < rangs; i++) {
            // x en fraction de largeur : rangée régulière + aléa d'une
            // demi-hauteur de bande (comme l'ancien rendu en pixels).
            const x = (i + 0.5) / rangs + (Math.random() - 0.5) * (this.hauteur / w);
            def.decor.push(this._definirDecor(x, true));
        }
    }

    /**
     * Définition d'une ligne BUISSON (spec 708 §3 — variante d'herbe, même
     * rôle, visuel différent ; tampon devant/derrière une route, spec 708
     * §4) : une haie de buissons denses qui la distingue d'une prairie.
     */
    _definirBuisson(def) {
        // 3 à 6 buissons serrés — la bande « borde » la route.
        const nb = 3 + Math.floor(Math.random() * 4);
        for (let i = 0; i < nb; i++) {
            def.decor.push(this._definirDecor(Math.random(), true));
        }
    }

    /**
     * Définition d'une ligne TERRE (spec 708 §3 — tampon du train, spec
     * 708 §4) : sol nu (texture terre), quelques buissons épars seulement
     * (plus clairsemés qu'une prairie).
     */
    _definirTerre(def) {
        const C = this.C.lanes;
        const nb = C.decorTerre.min +
            Math.floor(Math.random() * (C.decorTerre.max - C.decorTerre.min + 1));
        for (let i = 0; i < nb; i++) {
            def.decor.push(this._definirDecor(Math.random(), false));
        }
    }

    /**
     * Définition d'un décor (arbre ou buisson) : texture, position x en
     * FRACTION de largeur, offset vertical et taille en FRACTION de la
     * hauteur de bande — sérialisable, rejouable à l'identique au retour.
     * @param {number} x position en fraction de largeur d'écran (0..1)
     * @param {boolean} buissonForce buisson imposé (rangée de vigne, haie)
     */
    _definirDecor(x, buissonForce) {
        const textures = buissonForce
            ? ["buisson_vert"]
            : ["buisson_vert", "arbre_vert", "arbre_vert_v2", "arbre_vert_v3",
               "arbre_vert_v4", "arbre_orange", "arbre_orange_v2", "arbre_orange_v3"];
        const texture = textures[Math.floor(Math.random() * textures.length)];
        return {
            texture: texture,
            x: x,
            offsetY: 0.5 + (Math.random() - 0.5) * 0.5, // centre ± 25 % de la bande
            taille: buissonForce ? 0.55 : (0.7 + Math.random() * 0.3)
        };
    }

    /**
     * ⭐ Fin de niveau (Décision John 08/08/2026, art. 704) : définition de
     * la MAISON posée sur la dernière ligne d'herbe du pattern de fin
     * (indexFin()). Même format sérialisable qu'un décor (texture, x,
     * offsetY, taille) — rendue par _rendreZoneSure et rejouée à
     * l'identique au retour (D2-1, jamais régénérée). Posée au CENTRE de
     * la ligne (x 0.5, là où le joueur monte), plus grande que les
     * décors (1.4 × bande) et légèrement aval (offsetY 0.55) pour
     * paraître posée sur l'herbe : marqueur visuel clair de fin de niveau.
     * @returns {{texture: string, x: number, offsetY: number, taille: number}}
     */
    _definirMaison() {
        return {
            texture: "maison",
            x: 0.5,
            offsetY: 0.55,
            taille: 1.4
        };
    }

    /** Rendu du décor d'une ligne sûre depuis sa définition. */
    _rendreZoneSure(bande, def) {
        const w = this.scene.scale.width;
        for (const d of def.decor) {
            // Décor : sprite du pool, corps RESTE inerte (jamais activé) —
            // les arbres ne tuent pas et ne bloquent pas (top-down, pas de
            // couverture).
            const sprite = this.pool.prendre(d.texture, LaneGenerator.DEPTH.decor);
            const taille = this.hauteur * d.taille;
            this.pool.taille(sprite, taille);
            sprite.setPosition(d.x * w, bande.y + (d.offsetY - 0.5) * this.hauteur);
            bande.decor.push({ sprite: sprite, offsetY: d.offsetY, taille: taille });
        }
    }

    // ------------------------------------------------------------------
    // Pool de sprites (ObstaclePool.js — CDC 706 §Performance)
    // ------------------------------------------------------------------
    // Le pool est la propriété du LaneGenerator (this.pool, voir
    // constructor) : prendre()/rendre()/activer()/taille() évitent de
    // recréer ou détruire des sprites en continu pendant le recyclage
    // des bandes. Les corps Arcade Physics sont créés une seule fois
    // par sprite et activés/désactivés avec lui. Depuis D2-2, les
    // véhicules et flottants sont RECTANGULAIRES (1 à 4 cases de large) :
    // activerRect()/tailleRect() dimensionnent le corps en conséquence.
}
