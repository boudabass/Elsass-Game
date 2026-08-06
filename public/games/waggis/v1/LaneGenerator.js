/*
 * LaneGenerator.js — génération procédurale des bandes horizontales de
 * Waggis V2 (concept Crossy Road, CDC : article Odoo 706).
 *
 * Le monde est découpé en bandes horizontales de hauteur fixe, empilées
 * vers le haut au fur et à mesure que le joueur avance. Chaque bande est
 * tirée aléatoirement parmi les types (étape 2 : `zone_sure` prairie/vigne
 * et `route` ; étape 3 : `eau` ; étape 4 : `rails` — voie ferrée avec un
 * train rapide périodique), avec des règles anti-frustration
 * (CDC 706 §Génération) :
 *   - jamais plus de 2 bandes dangereuses consécutives du même type
 *     (route, eau ou rails) ;
 *   - la 2e bande dangereuse consécutive est plus clémente (route : moins
 *     de véhicules et plus lents ; eau : courant plus lent et plus de
 *     nénuphars ; rails : signal plus long et train plus rare/lent) pour
 *     rester franchissable ;
 *   - il reste toujours une part de zones sûres (respiration), quel que
 *     soit le niveau de difficulté ;
 *   - la bande de départ et celle qui la suit sont des zones sûres (jamais
 *     d'eau en bande 1) ;
 *   - la difficulté monte par palier de score (trafic plus dense et plus
 *     rapide, courant plus fort, trains plus fréquents, tous les 10
 *     points) ;
 *   - CDC 706 : « pas de rails juste après une bande d'eau » — garanti
 *     structurellement par la règle « même type au plus 2 fois de suite » :
 *     une bande eau n'est suivie que d'eau ou de zone_sure, jamais d'un
 *     autre type dangereux (voir _choisirType).
 *
 * RAILS (étape 4) : chaque bande rails alterne trois phases (bande.phase) :
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
 *                      via bande.estMortelAuPoint(x, demiLargeur) pour
 *                      l'étape collisions).
 *
 * POOLING (ObstaclePool.js, CDC 706 §Performance) : les bandes déjà
 * traversées (sorties en bas de l'écran) ne sont ni détruites ni
 * recréées : elles sont recyclées en haut avec un nouveau type
 * (avancer()). Les sprites de décor, de véhicules et de wagons passent
 * par ObstaclePool et changent de texture plutôt que d'être détruits —
 * aucun monde infini n'est gardé en mémoire. Chaque sprite porte un
 * corps Arcade Physics créé une seule fois ; seuls les obstacles
 * (véhicules, nénuphars, wagons) ont le corps ACTIF (collisions étape
 * 6), le décor garde un corps inerte.
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
 *    (decalage -= hauteur) — l'inverse exact d'avancer(), monde infini
 *    vers le bas aussi (le terrain derrière le joueur est ré-ensemencé,
 *    comme l'avant, une fois la fenêtre de 12 bandes dépassée).
 * Sans cette compensation, la rotation du pool ferait dériver le monde
 * d'une bande à chaque recyclage (bug révélé par le harnais : plus de
 * bande au-dessus du joueur au 17e bond).
 *
 * Rendu : chaque bande est un tileSprite de sol (herbe pour les zones
 * sûres, asphalte + marquage pour les routes, lit de ballast + voie pour
 * les rails), décorée d'arbres/buissons (zone sûre), parcourue de
 * véhicules latéraux (route) ou d'un train périodique (rails). Tout est
 * exprimé en PROPORTION de l'écran (config lanes), comme le reste du jeu.
 *
 * Utilisation (GameScene) :
 *   this.lanes = new LaneGenerator(this);
 *   this.lanes.genererInitiales(score);
 *   // dans update() : this.lanes.update(time, delta);
 *   // bond avant  : this.lanes.defilerBas(); this.lanes.avancer(score);
 *   //   (quand le joueur franchit le seuil haut, voir GameScene)
 *   // bond arrière : this.lanes.reculer(score); this.lanes.defilerHaut();
 *   //   (à chaque recul — monde infini vers le bas, voir GameScene)
 */
class LaneGenerator {
    static TYPES = Object.freeze({
        ZONE_SURE: "zone_sure",
        ROUTE: "route",
        EAU: "eau",
        RAILS: "rails"
    });

    static SOUS_TYPES_ZONE_SURE = Object.freeze(["prairie", "vigne"]);

    /**
     * @param {Phaser.Scene} scene la scène de jeu
     */
    constructor(scene) {
        this.scene = scene;
        this.C = window.WaggisConfig;
        this.bandes = [];        // bandes vivantes, de bas en haut
        // Pool unique des sprites d'obstacles ET de décor (CDC 706
        // §Performance) : véhicules, nénuphars, wagons du train, mais
        // aussi arbres/buissons — aucun sprite n'est recréé/détruit en
        // continu, il change de texture. Les corps Arcade Physics des
        // obstacles sont activés à la prise, désactivés au rendu.
        this.pool = new ObstaclePool(scene);
        this.niveau = 0;         // palier de difficulté (score / 10)

        // Compteurs exposés pour la QA (probes window.__q / Arcade.game) :
        // nombre de signaux sonores déclenchés et de passages de train.
        this.compteurs = { avertissements: 0, passages: 0 };
        // Horodatage (scene.time.now) jusqu'auquel un signal sonore est en
        // cours : un seul train peut « sonner » à la fois (pas de
        // cacophonie si deux bandes rails avertissent en même temps).
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
        signal: 4,       // feux de croisement des bandes rails
        vehicule: 5,
        flottant: 5,
        train: 5
    });

    // ------------------------------------------------------------------
    // Cycle de vie
    // ------------------------------------------------------------------

    /**
     * Construit la séquence initiale : la bande de départ affleure le bas
     * de l'écran, puis les bandes s'empilent jusqu'à couvrir l'écran plus
     * la marge d'avance au-dessus.
     * @param {number} score score courant (difficulté de départ)
     */
    genererInitiales(score) {
        this.niveau = Math.floor(score / 10);

        const h = this.scene.scale.height;
        const nb = Math.ceil(h / this.hauteur) + this.C.lanes.margeBandesHaut;

        // Bande 0 (départ) : toujours une zone sûre, le joueur y respire.
        this._ajouterBande(0, h - this.hauteur / 2, LaneGenerator.TYPES.ZONE_SURE, "prairie");

        for (let i = 1; i < nb; i++) {
            const y = h - this.hauteur / 2 - i * this.hauteur;
            const avant = this.bandes[this.bandes.length - 1];
            const type = this._choisirType(avant, i);
            const sousType = this._choisirSousType(type);
            this._ajouterBande(i, y, type, sousType);
        }
    }

    /**
     * Un bond avant : le monde a déjà glissé vers le bas (defilerBas(),
     * appelé par la scène quand le joueur franchit le seuil haut) ; la
     * bande du bas (hors écran) est recyclée en haut avec un nouveau type.
     * À appeler à chaque bond avant du joueur (étape 5 : contrôles).
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
        this.niveau = Math.floor(score / 10);

        // La nouvelle bande est posée AU-DESSUS de la plus haute (`haut`) :
        // c'est elle qui sert de référence aux règles anti-frustration.
        const bas = this.bandes.shift();
        const haut = this.bandes[this.bandes.length - 1];
        const nouvelIndex = haut.index + 1;

        const type = this._choisirType(haut, nouvelIndex);
        const sousType = this._choisirSousType(type);
        // y provisoire (0) : redimensionner() replace chaque bande à son
        // slot + decalage — la bande recyclée reprend le slot du haut.
        this._recyclerBande(bas, 0, type, sousType);
        bas.index = nouvelIndex;
        this.bandes.push(bas);
        this.decalage -= this.hauteur;   // compensation de la rotation
        this.redimensionner();
        return bas;
    }

    /**
     * Un bond arrière (étape 5) : s'il n'y a plus de bande sous le joueur
     * (bande du bas du pool), la bande du haut — sortie de l'écran — est
     * recyclée EN DESSOUS avec un nouveau type. Le monde est ainsi infini
     * vers le bas aussi (le terrain derrière le joueur est ré-ensemencé,
     * comme l'avant ; CDC 706 §Contrôles : « reculer » est une direction à
     * part entière). La scène enchaîne avec defilerHaut() pour faire
     * entrer la nouvelle bande par le bas sans sortir le joueur de l'écran.
     *
     * COMPENSATION DU DÉCALAGE (miroir d'avancer()) : le unshift décale
     * chaque bande d'un slot vers le bas du tableau ; on ajoute une hauteur
     * à `decalage` pour que le monde reste immobile pendant la rotation.
     * @param {number} score score courant (difficulté qui monte)
     * @returns {object} la bande recyclée (nouvelle bande en bas)
     */
    reculer(score) {
        this.niveau = Math.floor(score / 10);

        // La nouvelle bande est posée AU-DESSOUS de la plus basse (`bas`) :
        // c'est elle qui sert de référence aux règles anti-frustration.
        const haut = this.bandes.pop();
        const bas = this.bandes[0];
        const nouvelIndex = bas.index - 1;

        const type = this._choisirType(bas, nouvelIndex, "bas");
        const sousType = this._choisirSousType(type);
        this._recyclerBande(haut, 0, type, sousType, "bas");
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
     * Fait avancer les obstacles latéraux : véhicules (route), nénuphars
     * (eau) et trains (rails), recyclés quand ils sortent de l'écran à
     * gauche ou à droite. À appeler depuis update() de la scène.
     */
    update(time, delta) {
        const w = this.scene.scale.width;
        const marge = this.hauteur; // marge de sortie latérale

        // Fin de la fenêtre de son du signal (un seul à la fois).
        if (this._sonSignalFin !== null && time >= this._sonSignalFin) {
            this._sonSignalFin = null;
        }

        for (const bande of this.bandes) {
            if (bande.type === LaneGenerator.TYPES.ROUTE) {
                this._deriver(bande.vehicules, w, marge, delta);
            } else if (bande.type === LaneGenerator.TYPES.EAU) {
                this._deriver(bande.flottants, w, marge, delta);
            } else if (bande.type === LaneGenerator.TYPES.RAILS) {
                this._mettreAJourRails(bande, w, marge, delta);
            }
        }
    }

    /** Fait dériver une liste d'obstacles latéraux (recyclage aux bords). */
    _deriver(obstacles, w, marge, delta) {
        for (const o of obstacles) {
            // Le sens de circulation applique la direction : les obstacles
            // direction=-1 (« gauche ») dérivent vers la gauche, les
            // direction=+1 vers la droite (fix NC-1 review t_d8bbd197 —
            // auparavant la direction n'agissait que sur le recyclage, les
            // obstacles « gauche » roulaient à l'envers et ne recyclaient
            // jamais).
            o.sprite.x += o.direction * o.vitesse * (delta / 1000);
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
            if (bande.type === LaneGenerator.TYPES.RAILS) {
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
            for (const v of bande.vehicules) {
                v.sprite.y = bande.y;
                this.pool.taille(v.sprite, v.cote);
            }
            for (const f of bande.flottants) {
                f.sprite.y = bande.y;
                this.pool.taille(f.sprite, f.cote);
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
    // Règles anti-frustration (CDC 706 §Génération)
    // ------------------------------------------------------------------

    /**
     * Tire le type de la prochaine bande, posée AU-DESSUS de `avant`.
     *
     * Règles anti-frustration étendues (CDC 706 §Génération) :
     *  - départ et bande 1 : zone sûre (jamais d'eau ni de rails si tôt) ;
     *  - jamais plus de 2 bandes dangereuses consécutives DU MÊME type
     *    (route, eau ou rails) : après deux routes, deux eaux ou deux
     *    rails, zone sûre ;
     *  - une 2e bande du même type reste possible mais nettement moins
     *    probable qu'une zone sûre (respiration) ;
     *  - part de zones sûres garantie (dangerMax plafonne route + eau +
     *    rails) ;
     *  - « pas de rails juste après une bande d'eau » (CDC 706) : garanti
     *    structurellement — après une eau, seules eau ou zone_sure suivent
     *    (règle « même type au plus 2 fois » ci-dessus), jamais un autre
     *    type dangereux.
     *
     * @param {object} avant bande déjà en place (au-dessous de la nouvelle)
     * @param {number} index index absolu de la nouvelle bande (0 = départ)
     * @param {string} [cote] "haut" (défaut : bande posée au-dessus de
     *   toutes, avancer) ou "bas" (bande posée en dessous de toutes,
     *   reculer) — détermine le côté où compter les bandes consécutives
     * @returns {string} un type de LaneGenerator.TYPES
     */
    _choisirType(avant, index, cote) {
        const C = this.C.lanes;
        cote = cote || "haut";

        // Le départ et la bande suivante : toujours (ou presque) zone sûre.
        if (index === 0) return LaneGenerator.TYPES.ZONE_SURE;
        if (index === 1 && Math.random() < C.probZoneSureApresDepart) {
            return LaneGenerator.TYPES.ZONE_SURE;
        }

        const pRoute = Math.min(
            C.probRoute.max,
            C.probRoute.base + this.niveau * C.probRoute.parNiveau
        );
        const pEau = Math.min(
            C.probEau.max,
            C.probEau.base + this.niveau * C.probEau.parNiveau
        );
        const pRails = Math.min(
            C.probRails.max,
            C.probRails.base + this.niveau * C.probRails.parNiveau
        );

        // Bande 1 non zone sûre : route uniquement, jamais d'eau ni de
        // rails (le joueur vient de commencer, pas de danger si tôt).
        let pDangereux = Math.min(C.dangerMax, pRoute + pEau + pRails);
        if (index === 1) pDangereux = pRoute;

        // Nombre de bandes dangereuses consécutives DU MÊME type à côté de
        // la nouvelle bande, calculé sur les bandes vivantes (robuste au
        // recyclage). `cote` = côté où la bande est posée : "haut" (défaut,
        // au-dessus de toutes) ou "bas" (reculer() : en dessous de toutes).
        const routesConsecutives = this._consecutives(cote, LaneGenerator.TYPES.ROUTE);
        const eauxConsecutives = this._consecutives(cote, LaneGenerator.TYPES.EAU);
        const railsConsecutives = this._consecutives(cote, LaneGenerator.TYPES.RAILS);

        // Jamais plus de 2 bandes dangereuses consécutives du même type :
        // après deux routes, deux eaux ou deux rails, une zone sûre est
        // obligatoire.
        if (routesConsecutives >= 2 || eauxConsecutives >= 2 ||
            railsConsecutives >= 2) {
            return LaneGenerator.TYPES.ZONE_SURE;
        }

        // Une 2e du même type d'affilée reste possible mais nettement moins
        // probable qu'une zone sûre (respiration).
        if (routesConsecutives === 1) {
            if (Math.random() < pDangereux * 0.35) return LaneGenerator.TYPES.ROUTE;
            return LaneGenerator.TYPES.ZONE_SURE;
        }
        if (eauxConsecutives === 1) {
            if (Math.random() < pDangereux * 0.35) return LaneGenerator.TYPES.EAU;
            return LaneGenerator.TYPES.ZONE_SURE;
        }
        if (railsConsecutives === 1) {
            if (Math.random() < pDangereux * 0.35) return LaneGenerator.TYPES.RAILS;
            return LaneGenerator.TYPES.ZONE_SURE;
        }

        // Aucune bande du même type au-dessus : tirage normal, réparti
        // route / eau / rails proportionnellement à leurs probabilités.
        if (Math.random() >= pDangereux) return LaneGenerator.TYPES.ZONE_SURE;
        // Bande 1 : jamais d'eau ni de rails (départ en douceur) — route
        // ou zone sûre.
        if (index === 1) return LaneGenerator.TYPES.ROUTE;
        const tirage = Math.random() * (pRoute + pEau + pRails);
        if (tirage < pRoute) return LaneGenerator.TYPES.ROUTE;
        if (tirage < pRoute + pEau) return LaneGenerator.TYPES.EAU;
        return LaneGenerator.TYPES.RAILS;
    }

    /**
     * Nombre de bandes consécutives du type donné à côté de la nouvelle
     * bande. `cote` = côté où elle sera posée : "haut" → on compte depuis
     * le sommet du pool (bandes déjà en place au-dessous d'elle) ; "bas" →
     * on compte depuis le bas du pool (bandes déjà en place au-dessus).
     */
    _consecutives(cote, type) {
        const b = this.bandes;
        let n = 0;
        if (cote === "bas") {
            for (let i = 0; i < b.length && b[i].type === type; i++) n++;
        } else {
            for (let i = b.length - 1; i >= 0 && b[i].type === type; i--) n++;
        }
        return n;
    }

    /**
     * La bande en cours de placement est-elle la 2e consécutive du type
     * donné ? (Anti-frustration, CDC 706 §Génération : la 2e bande
     * dangereuse consécutive est plus clémente.) La bande voisine du côté
     * où elle est posée doit être du type, et celle d'encore avant non.
     * @param {string} [cote] "haut" (défaut) ou "bas" — voir _consecutives
     */
    _est2eConsecutive(cote, type) {
        const b = this.bandes;
        if (cote === "bas") {
            return b.length >= 1 && b[0].type === type &&
                (b.length < 2 || b[1].type !== type);
        }
        return b.length >= 1 && b[b.length - 1].type === type &&
            (b.length < 2 || b[b.length - 2].type !== type);
    }

    /** Sous-type d'une bande (vigne ou prairie pour une zone sûre). */
    _choisirSousType(type) {
        if (type !== LaneGenerator.TYPES.ZONE_SURE) return null;
        const C = this.C.lanes;
        return Math.random() < C.probVigne ? "vigne" : "prairie";
    }

    // ------------------------------------------------------------------
    // Construction / recyclage des bandes
    // ------------------------------------------------------------------

    /** Crée une bande neuve (index, y, type) avec son rendu complet. */
    _ajouterBande(index, y, type, sousType) {
        const bande = {
            index: index,
            type: type,
            sousType: sousType,
            y: y,
            direction: null,   // route/eau/rails : -1 (gauche) ou +1 (droite)
            vitesse: 0,        // route/eau : px/s commun à tous les obstacles
            densite: 0,        // route/eau : nombre d'obstacles
            sol: null,         // tileSprite de fond
            marquage: null,    // route : ligne pointillée centrale
            ballast: null,     // rails : lit de gravier sous la voie
            signal: null,      // rails : [feuHaut, feuBas] (feux de croisement)
            signalTemps: 0,    // rails : accumulateur du clignotement (ms)
            signalAllume: false,
            phase: null,       // rails : "attente" | "avertissement" | "passage"
            cycleTemps: 0,     // rails : temps écoulé dans la phase (ms)
            attenteDuree: 0,   // rails : durée d'attente avant le signal (ms)
            avertissementDuree: 0, // rails : durée du signal avant passage (ms)
            train: null,       // rails : convoi {direction, vitesse, x, cote,
                               //   nb, demiLargeur, dureeTraversee, sprites[]}
            decor: [],         // zone sûre : [{sprite, offsetY, taille}]
            vehicules: [],     // route : [{sprite, vitesse, direction, cote, demiLargeur}]
            flottants: [],     // eau : [{sprite, vitesse, direction, cote, demiLargeur}]
            // Contrat exposé pour l'étape collisions : un point de la bande
            // (x, demiLargeur) est-il fauché par le train à cet instant ?
            estMortelAuPoint: function (x, demiLargeur) {
                if (bande.type !== LaneGenerator.TYPES.RAILS) return false;
                if (!bande.train || bande.phase !== "passage") return false;
                return Math.abs(x - bande.train.x) <
                    bande.train.demiLargeur + (demiLargeur || 0);
            }
        };
        this._rendreBande(bande);
        this.bandes.push(bande);
        return bande;
    }

    /**
     * Recycle une bande : vide ses sprites (rendus au pool), lui donne un
     * nouveau type et la re-rend à sa nouvelle position.
     * @param {string} [cote] côté où la bande est posée ("haut" défaut /
     *   "bas") — transmis au rendu pour les règles « 2e consécutive
     *   clémente » (la bande de référence n'est pas la même en haut et en
     *   bas du pool).
     */
    _recyclerBande(bande, nouveauY, type, sousType, cote) {
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
        bande.type = type;
        bande.sousType = sousType;
        bande.y = nouveauY;
        this._rendreBande(bande, cote);
    }

    /**
     * Rendu complet d'une bande selon son type (sol + décor/véhicules/train).
     * @param {string} [cote] côté où la bande est posée ("haut" défaut /
     *   "bas") — voir _recyclerBande.
     */
    _rendreBande(bande, cote) {
        const w = this.scene.scale.width;

        if (bande.type === LaneGenerator.TYPES.ROUTE) {
            this._masquerVestigesRails(bande);
            this._rendreSol(bande, "route_pleine");
            // Marquage central : ligne pointillée évoquant le milieu de
            // chaussée (une bande route = une voie par sens).
            if (bande.marquage) {
                bande.marquage.setPosition(0, bande.y).setVisible(true); // bande recyclée
            } else {
                bande.marquage = this.scene.add
                    .tileSprite(0, bande.y, w, this.hauteur * 0.22, "route_ligne")
                    .setOrigin(0, 0.5)
                    .setDepth(LaneGenerator.DEPTH.marquage);
            }
            this._peuplerRoute(bande, cote);
        } else if (bande.type === LaneGenerator.TYPES.EAU) {
            // Bande recyclée qui n'est plus une route : le marquage fantôme
            // doit disparaître (il resterait visible au milieu de la rivière).
            if (bande.marquage) bande.marquage.setVisible(false);
            this._masquerVestigesRails(bande);
            this._rendreSol(bande, this._textureEau());
            this._peuplerEau(bande, cote);
        } else if (bande.type === LaneGenerator.TYPES.RAILS) {
            if (bande.marquage) bande.marquage.setVisible(false);
            // Lit de ballast sous la voie : la texture rails est ajourée
            // (ballast + traverses), le fond opaque est dessiné en dessous.
            this._rendreBallast(bande);
            this._rendreSol(bande, this._textureRails());
            // Une seule voie par bande : le motif 16x16 est mis à l'échelle
            // de la hauteur de bande (sinon il se tuilerait plusieurs fois
            // verticalement), et décalé d'un motif au hasard pour varier.
            bande.sol.setTileScale(this.hauteur / 16, this.hauteur / 16);
            bande.sol.tilePositionX = Math.floor(Math.random() * 16);
            // Train D'ABORD (il fixe bande.direction), puis les feux :
            // _positionnerSignal place les feux du côté d'où arrive le train.
            this._initialiserTrain(bande, cote);
            this._creerSignal(bande);
        } else {
            if (bande.marquage) bande.marquage.setVisible(false);
            this._masquerVestigesRails(bande);
            const texture = this._textureHerbe();
            this._rendreSol(bande, texture);
            if (bande.sousType === "vigne") {
                this._peuplerVigne(bande);
            } else {
                this._peuplerPrairie(bande);
            }
        }
    }

    /** Masque les objets propres aux rails (feux, ballast) sur une bande recyclée. */
    _masquerVestigesRails(bande) {
        if (bande.signal) {
            bande.signal[0].setVisible(false);
            bande.signal[1].setVisible(false);
        }
        if (bande.ballast) bande.ballast.setVisible(false);
    }

    /** Pose (ou change) le tileSprite de sol de la bande. */
    _rendreSol(bande, texture) {
        const w = this.scene.scale.width;
        if (!bande.sol) {
            bande.sol = this.scene.add
                .tileSprite(0, bande.y - this.hauteur / 2, w, this.hauteur, texture)
                .setOrigin(0, 0)
                .setDepth(LaneGenerator.DEPTH.sol);
        } else {
            bande.sol.setTexture(texture).setSize(w, this.hauteur);
            // Bande recyclée : revenir à l'échelle 1 (une bande rails avait
            // mis le tileScale à la taille de sa voie, cf. _rendreBande).
            bande.sol.setTileScale(1, 1);
        }
        // Décalage du motif : deux bandes côte à côte ne sont pas identiques.
        bande.sol.tilePositionX = Math.floor(Math.random() * w);
    }

    /** Texture d'herbe de la zone sûre (3 variantes, une au hasard). */
    _textureHerbe() {
        const variantes = ["herbe", "herbe_fleurs_roses", "herbe_fleurs_vertes"];
        return variantes[Math.floor(Math.random() * variantes.length)];
    }

    // ------------------------------------------------------------------
    // Route : véhicules latéraux
    // ------------------------------------------------------------------

    /**
     * Remplit une bande route de véhicules : même vitesse pour toute la
     * bande (les véhicules ne se doublent pas), espacement régulier.
     */
    _peuplerRoute(bande, cote) {
        const C = this.C.lanes;
        const w = this.scene.scale.width;

        // 2e route consécutive = la bande voisine (du côté où la nouvelle
        // bande est posée) est une route et celle d'encore avant n'en est
        // pas une (celle-ci serait la 2e d'affilée) → plus clémente.
        const est2eRoute = this._est2eConsecutive(cote, LaneGenerator.TYPES.ROUTE);

        // Densité : base + paliers, plafonnée, allégée sur une 2e route.
        let densite = C.routeVehicules.base + this.niveau * C.routeVehicules.parNiveau;
        densite = Math.max(C.routeVehicules.min, Math.min(C.routeVehicules.max, densite));
        if (est2eRoute) densite = Math.max(1, Math.round(densite * C.route2eConsecutive.densite));
        densite = Math.round(densite);

        // Vitesse : durée de traversée qui diminue avec la difficulté.
        let duree = C.routeDureeTraversee.base - this.niveau * C.routeDureeTraversee.parNiveau;
        duree = Math.max(C.routeDureeTraversee.min, duree);
        let vitesse = w / duree;
        if (est2eRoute) vitesse *= C.route2eConsecutive.vitesse;

        bande.direction = Math.random() < 0.5 ? 1 : -1;
        bande.vitesse = vitesse;
        bande.densite = densite;

        const pas = w / densite;
        const phase = Math.random() * pas;   // décalage global du trafic
        const taille = this.hauteur * 0.9;   // véhicule carré, presque la bande

        for (let i = 0; i < densite; i++) {
            const sprite = this.pool.prendre(
                this._textureVehicule(bande.direction),
                LaneGenerator.DEPTH.vehicule
            );
            // Corps Arcade ACTIVÉ : le véhicule participe aux collisions
            // (contact = mort, étape 6).
            this.pool.activer(sprite, taille);
            const v = {
                sprite: sprite,
                vitesse: vitesse,
                direction: bande.direction,
                cote: taille,
                demiLargeur: taille / 2
            };
            sprite.setPosition(phase + pas * (i + 0.5), bande.y);
            bande.vehicules.push(v);
        }
    }

    /** Texture d'un véhicule selon le sens de circulation. */
    _textureVehicule(direction) {
        const couleurs = ["rouge", "verte", "rose"];
        const couleur = couleurs[Math.floor(Math.random() * couleurs.length)];
        const sens = direction > 0 ? "droite" : "gauche";
        return "voiture_" + couleur + "_" + sens;
    }

    // ------------------------------------------------------------------
    // Eau : nénuphars qui dérivent
    // ------------------------------------------------------------------

    /** Texture d'eau de la bande (4 variantes, une au hasard). */
    _textureEau() {
        const variantes = ["eau", "eau_v2", "eau_v3", "eau_v4"];
        return variantes[Math.floor(Math.random() * variantes.length)];
    }

    /**
     * Remplit une bande eau de nénuphars dérivants : même courant pour
     * toute la bande (les nénuphars ne se doublent pas), espacement
     * régulier. Le joueur devra sauter de nénuphar en nénuphar (étape
     * collisions) ; ici on génère et on anime la dérive.
     */
    _peuplerEau(bande, cote) {
        const C = this.C.lanes;
        const w = this.scene.scale.width;

        // 2e bande eau consécutive = la bande voisine (du côté où la
        // nouvelle bande est posée) est une eau et celle d'encore avant
        // n'en est pas une (celle-ci serait la 2e d'affilée) → plus
        // clémente (plus de nénuphars, courant plus lent).
        const est2eEau = this._est2eConsecutive(cote, LaneGenerator.TYPES.EAU);

        // Densité de nénuphars : base + paliers, plafonnée, augmentée sur
        // une 2e eau (plus de prise pour traverser).
        let densite = C.eauFlottants.base + this.niveau * C.eauFlottants.parNiveau;
        densite = Math.max(C.eauFlottants.min, Math.min(C.eauFlottants.max, densite));
        if (est2eEau) {
            densite = Math.min(C.eauFlottants.max, Math.round(densite * C.eau2eConsecutive.densite));
        }
        densite = Math.round(densite);

        // Courant : durée de traversée qui diminue avec la difficulté.
        let duree = C.eauDureeTraversee.base - this.niveau * C.eauDureeTraversee.parNiveau;
        duree = Math.max(C.eauDureeTraversee.min, duree);
        let vitesse = w / duree;
        if (est2eEau) vitesse *= C.eau2eConsecutive.vitesse;

        bande.direction = Math.random() < 0.5 ? 1 : -1;
        bande.vitesse = vitesse;
        bande.densite = densite;

        const pas = w / densite;
        const phase = Math.random() * pas;   // décalage global du courant
        const taille = this.hauteur * 0.8;   // nénuphar un peu plus petit qu'un véhicule

        for (let i = 0; i < densite; i++) {
            const sprite = this.pool.prendre(
                this._textureNenuphar(),
                LaneGenerator.DEPTH.flottant
            );
            // Corps Arcade ACTIVÉ : un nénuphar est un support solide —
            // le joueur qui le chevauche n'est PAS tombé à l'eau (le
            // « sol » de la bande eau, étape 6).
            this.pool.activer(sprite, taille);
            const f = {
                sprite: sprite,
                vitesse: vitesse,
                direction: bande.direction,
                cote: taille,
                demiLargeur: taille / 2
            };
            sprite.setPosition(phase + pas * (i + 0.5), bande.y);
            bande.flottants.push(f);
        }
    }

    /** Texture d'un nénuphar flottant (rogrpg : simple, double, fleur). */
    _textureNenuphar() {
        const textures = ["nenuphar_simple", "nenuphar_double", "nenuphar_fleur"];
        return textures[Math.floor(Math.random() * textures.length)];
    }

    // ------------------------------------------------------------------
    // Rails : voie ferrée et train périodique (étape 4)
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
     * Prépare le cycle du train d'une bande rails : phase "attente",
     * durées (attente aléatoire, signal fixe), sens de circulation, convoi
     * de wagonnets (placeholder, cf. en-tête) caché hors de l'écran.
     */
    _initialiserTrain(bande, cote) {
        const C = this.C.lanes;
        const w = this.scene.scale.width;

        // 2e rails consécutive = la bande voisine (du côté où la nouvelle
        // bande est posée) est une rails et celle d'encore avant n'en est
        // pas une (celle-ci serait la 2e d'affilée) → plus clémente
        // (signal plus long, train plus rare et plus lent).
        const est2eRails = this._est2eConsecutive(cote, LaneGenerator.TYPES.RAILS);
        bande.est2eRails = est2eRails;

        bande.direction = Math.random() < 0.5 ? 1 : -1;

        // Durée de traversée : rapide, diminue avec la difficulté, allégée
        // sur une 2e rails (train plus lent, plus de temps pour réagir).
        let duree = C.railDureeTraversee.base -
            this.niveau * C.railDureeTraversee.parNiveau;
        duree = Math.max(C.railDureeTraversee.min, duree);
        if (est2eRails) duree /= C.rail2eConsecutive.vitesse;

        // Signal avant passage : constante, plus long sur une 2e rails.
        bande.avertissementDuree = C.railAvertissementMs;
        if (est2eRails) {
            bande.avertissementDuree *= C.rail2eConsecutive.avertissement;
        }
        bande.attenteDuree = this._dureeAttente(est2eRails);

        const taille = this.hauteur * 0.9;
        const nb = 3;  // 1 « loco » (wagonnet charbon) + 2 wagons
        const train = {
            direction: bande.direction,
            vitesse: w / duree,
            dureeTraversee: duree,
            cote: taille,
            nb: nb,
            demiLargeur: (nb * taille) / 2,
            x: 0,
            sprites: []
        };
        const textures = [this._textureLoco()];
        for (let i = 1; i < nb; i++) textures.push(this._textureWagon());
        for (let i = 0; i < nb; i++) {
            const sprite = this.pool.prendre(textures[i], LaneGenerator.DEPTH.train);
            // Corps Arcade ACTIVÉ : le train tue au contact (étape 6 —
            // la détection passe par bande.estMortelAuPoint, le corps
            // reste cohérent pour le debug &debug=1).
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
    _dureeAttente(est2eRails) {
        const C = this.C.lanes;
        let duree = C.railAttente.base - this.niveau * C.railAttente.parNiveau;
        duree = Math.max(C.railAttente.min, duree);
        if (est2eRails) duree *= C.rail2eConsecutive.attente;
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
     * Fait tourner le cycle du train d'une bande rails (appelé depuis
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
                bande.attenteDuree = this._dureeAttente(bande.est2eRails);
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
     * avertissent en même temps) ; si l'audio n'est pas encore déverrouillée
     * (pas de geste utilisateur), le signal visuel reste seul.
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
    // Zone sûre : prairie et vigne
    // ------------------------------------------------------------------

    /** Prairie : herbe + quelques arbres/buissons épars. */
    _peuplerPrairie(bande) {
        const C = this.C.lanes;
        const w = this.scene.scale.width;
        const nb = C.decor.min + Math.floor(Math.random() * (C.decor.max - C.decor.min + 1));
        for (let i = 0; i < nb; i++) {
            this._poserDecor(bande, Math.random() * w);
        }
    }

    /** Vigne : rangées verticales régulières de buissons (vignoble alsacien). */
    _peuplerVigne(bande) {
        const w = this.scene.scale.width;
        const rangs = 3;
        for (let i = 0; i < rangs; i++) {
            const x = w * ((i + 0.5) / rangs) + (Math.random() - 0.5) * this.hauteur;
            this._poserDecor(bande, x, true);
        }
    }

    /** Pose un décor (arbre ou buisson) sur la bande, à l'abscisse x. */
    _poserDecor(bande, x, buissonForce) {
        const textures = buissonForce
            ? ["buisson_vert"]
            : ["buisson_vert", "arbre_vert", "arbre_vert_v2", "arbre_vert_v3",
               "arbre_vert_v4", "arbre_orange", "arbre_orange_v2", "arbre_orange_v3"];
        const texture = textures[Math.floor(Math.random() * textures.length)];
        // Décor : sprite du pool, corps RESTE inerte (jamais activé) —
        // les arbres ne tuent pas et ne bloquent pas (top-down, pas de
        // couverture).
        const sprite = this.pool.prendre(texture, LaneGenerator.DEPTH.decor);
        const taille = this.hauteur * (buissonForce ? 0.55 : (0.7 + Math.random() * 0.3));
        this.pool.taille(sprite, taille);
        const offsetY = 0.5 + (Math.random() - 0.5) * 0.5; // centre ± 25 % de la bande
        sprite.setPosition(x, bande.y + (offsetY - 0.5) * this.hauteur);
        bande.decor.push({ sprite: sprite, offsetY: offsetY, taille: taille });
    }

    // ------------------------------------------------------------------
    // Pool de sprites (ObstaclePool.js — CDC 706 §Performance)
    // ------------------------------------------------------------------
    // Le pool est la propriété du LaneGenerator (this.pool, voir
    // constructor) : prendre()/rendre()/activer()/taille() évitent de
    // recréer ou détruire des sprites en continu pendant le recyclage
    // des bandes. Les corps Arcade Physics sont créés une seule fois
    // par sprite et activés/désactivés avec lui.
}
