/*
 * LaneGenerator.js — génération procédurale des bandes horizontales de
 * Waggis V2 (concept Crossy Road, CDC : article Odoo 706).
 *
 * Le monde est découpé en bandes horizontales de hauteur fixe, empilées
 * vers le haut au fur et à mesure que le joueur avance. Chaque bande est
 * tirée aléatoirement parmi les types (étape 2 : `zone_sure` prairie/vigne
 * et `route` ; eau et rails arrivent aux étapes suivantes), avec des règles
 * anti-frustration (CDC 706 §Génération) :
 *   - jamais plus de 2 bandes route consécutives ;
 *   - la 2e bande route consécutive est plus clémente (moins de véhicules,
 *     véhicules plus lents) pour rester franchissable ;
 *   - la bande de départ et celle qui la suit sont des zones sûres ;
 *   - la difficulté monte par palier de score (trafic plus dense et plus
 *     rapide tous les 10 points).
 *
 * POOLING : les bandes déjà traversées (sorties en bas de l'écran) ne sont
 * ni détruites ni recréées : elles sont recyclées en haut avec un nouveau
 * type (avancer()). Les sprites de décor et de véhicules passent par un
 * pool interne et changent de texture plutôt que d'être détruits — aucun
 * monde infini n'est gardé en mémoire.
 *
 * Rendu : chaque bande est un tileSprite de sol (herbe pour les zones
 * sûres, asphalte + marquage pour les routes), décorée d'arbres/buissons
 * (zone sûre) ou parcourue de véhicules latéraux (route). Tout est exprimé
 * en PROPORTION de l'écran (config lanes), comme le reste du jeu.
 *
 * Utilisation (GameScene) :
 *   this.lanes = new LaneGenerator(this);
 *   this.lanes.genererInitiales(score);
 *   // dans update() : this.lanes.update(time, delta);
 *   // à chaque bond avant : this.lanes.avancer(score);
 */
class LaneGenerator {
    static TYPES = Object.freeze({
        ZONE_SURE: "zone_sure",
        ROUTE: "route"
        // eau / rails : étapes suivantes (même contrat : un type, un rendu).
    });

    static SOUS_TYPES_ZONE_SURE = Object.freeze(["prairie", "vigne"]);

    /**
     * @param {Phaser.Scene} scene la scène de jeu
     */
    constructor(scene) {
        this.scene = scene;
        this.C = window.WaggisConfig;
        this.bandes = [];        // bandes vivantes, de bas en haut
        this.poolSprites = [];   // sprites décor/véhicule recyclés
        this.niveau = 0;         // palier de difficulté (score / 10)

        this.hauteur = 0;        // recalculée par redimensionner()
        this.redimensionner();
    }

    /** Profondeurs de rendu (le joueur arrivera au-dessus, ~10). */
    static DEPTH = Object.freeze({
        sol: 1,
        marquage: 2,
        decor: 3,
        vehicule: 5
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
     * Un bond avant : la bande du bas (déjà traversée, hors écran) est
     * recyclée en haut avec un nouveau type. À appeler quand le joueur
     * atteint une nouvelle bande (étape 3 : contrôles).
     * @param {number} score score courant (difficulté qui monte)
     * @returns {object} la bande recyclée (nouvelle bande en haut)
     */
    avancer(score) {
        this.niveau = Math.floor(score / 10);

        // La nouvelle bande est posée AU-DESSUS de la plus haute (`haut`) :
        // c'est elle qui sert de référence aux règles anti-frustration.
        const bas = this.bandes.shift();
        const haut = this.bandes[this.bandes.length - 1];
        const nouveauY = haut.y + this.hauteur;

        const type = this._choisirType(haut, haut.index + 1);
        const sousType = this._choisirSousType(type);
        this._recyclerBande(bas, nouveauY, type, sousType);
        this.bandes.push(bas);
        return bas;
    }

    /**
     * Fait avancer les véhicules (et les recycle quand ils sortent de
     * l'écran à gauche ou à droite). À appeler depuis update() de la scène.
     */
    update(time, delta) {
        const w = this.scene.scale.width;
        const marge = this.hauteur; // marge de sortie latérale

        for (const bande of this.bandes) {
            if (bande.type !== LaneGenerator.TYPES.ROUTE) continue;
            for (const v of bande.vehicules) {
                v.sprite.x += v.vitesse * (delta / 1000);
                if (v.direction > 0 && v.sprite.x - v.demiLargeur > w + marge) {
                    v.sprite.x = -v.demiLargeur - marge;   // ressort à gauche
                } else if (v.direction < 0 && v.sprite.x + v.demiLargeur < -marge) {
                    v.sprite.x = w + v.demiLargeur + marge; // ressort à droite
                }
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
            bande.y = h - this.hauteur / 2 - i * this.hauteur;
            bande.sol.setSize(w, this.hauteur).setPosition(0, bande.y - this.hauteur / 2);
            if (bande.marquage) {
                bande.marquage
                    .setSize(w, this.hauteur * 0.22)
                    .setPosition(0, bande.y);
            }
            for (const v of bande.vehicules) {
                v.sprite.y = bande.y;
                v.sprite.setDisplaySize(v.cote, v.cote);
            }
            for (const d of bande.decor) {
                d.sprite.y = bande.y + (d.offsetY - 0.5) * this.hauteur;
                d.sprite.setDisplaySize(d.taille, d.taille);
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
     * @param {object} avant bande déjà en place (au-dessous de la nouvelle)
     * @param {number} index index absolu de la nouvelle bande (0 = départ)
     * @param {number} score score courant
     * @returns {string} un type de LaneGenerator.TYPES
     */
    _choisirType(avant, index) {
        const C = this.C.lanes;

        // Le départ et la bande suivante : toujours (ou presque) zone sûre.
        if (index === 0) return LaneGenerator.TYPES.ZONE_SURE;
        if (index === 1 && Math.random() < C.probZoneSureApresDepart) {
            return LaneGenerator.TYPES.ZONE_SURE;
        }

        const pRoute = Math.min(
            C.probRoute.max,
            C.probRoute.base + this.niveau * C.probRoute.parNiveau
        );

        // Nombre de routes consécutives finissant à `avant`, calculé sur
        // les bandes vivantes (robuste au recyclage de la bande du bas).
        let routesConsecutives = 0;
        for (let i = this.bandes.length - 1;
             i >= 0 && this.bandes[i].type === LaneGenerator.TYPES.ROUTE; i--) {
            routesConsecutives++;
        }

        // Jamais plus de 2 bandes dangereuses consécutives : après deux
        // routes, une zone sûre est obligatoire.
        if (routesConsecutives >= 2) return LaneGenerator.TYPES.ZONE_SURE;
        if (routesConsecutives === 1) {
            // Une 2e route d'affilée reste possible mais nettement moins
            // probable qu'une zone sûre (respiration).
            if (Math.random() < pRoute * 0.35) return LaneGenerator.TYPES.ROUTE;
            return LaneGenerator.TYPES.ZONE_SURE;
        }

        return Math.random() < pRoute
            ? LaneGenerator.TYPES.ROUTE
            : LaneGenerator.TYPES.ZONE_SURE;
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
            direction: null,   // route : -1 (gauche) ou +1 (droite)
            vitesse: 0,        // route : px/s commun à tous les véhicules
            densite: 0,        // route : nombre de véhicules
            sol: null,         // tileSprite de fond
            marquage: null,    // route : ligne pointillée centrale
            decor: [],         // zone sûre : [{sprite, offsetY, taille}]
            vehicules: []      // route : [{sprite, vitesse, direction, cote, demiLargeur}]
        };
        this._rendreBande(bande);
        this.bandes.push(bande);
        return bande;
    }

    /**
     * Recycle une bande : vide ses sprites (rendus au pool), lui donne un
     * nouveau type et la re-rend à sa nouvelle position.
     */
    _recyclerBande(bande, nouveauY, type, sousType) {
        for (const d of bande.decor) this._rendreSprite(d.sprite);
        for (const v of bande.vehicules) this._rendreSprite(v.sprite);
        bande.decor = [];
        bande.vehicules = [];
        bande.type = type;
        bande.sousType = sousType;
        bande.y = nouveauY;
        this._rendreBande(bande);
    }

    /** Rendu complet d'une bande selon son type (sol + décor/véhicules). */
    _rendreBande(bande) {
        const w = this.scene.scale.width;

        if (bande.type === LaneGenerator.TYPES.ROUTE) {
            this._rendreSol(bande, "route_pleine");
            // Marquage central : ligne pointillée évoquant le milieu de
            // chaussée (une bande route = une voie par sens).
            if (bande.marquage) {
                bande.marquage.setPosition(0, bande.y);   // bande recyclée
            } else {
                bande.marquage = this.scene.add
                    .tileSprite(0, bande.y, w, this.hauteur * 0.22, "route_ligne")
                    .setOrigin(0, 0.5)
                    .setDepth(LaneGenerator.DEPTH.marquage);
            }
            this._peuplerRoute(bande);
        } else {
            const texture = this._textureHerbe();
            this._rendreSol(bande, texture);
            if (bande.sousType === "vigne") {
                this._peuplerVigne(bande);
            } else {
                this._peuplerPrairie(bande);
            }
        }
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
    _peuplerRoute(bande) {
        const C = this.C.lanes;
        const w = this.scene.scale.width;

        // 2e route consécutive = la bande du dessous est une route et celle
        // d'encore avant n'en est pas une (celle-ci serait la 2e d'affilée).
        const est2eRoute =
            this.bandes.length >= 1 &&
            this.bandes[this.bandes.length - 1].type === LaneGenerator.TYPES.ROUTE &&
            (this.bandes.length < 2 ||
             this.bandes[this.bandes.length - 2].type !== LaneGenerator.TYPES.ROUTE);

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
        const cote = this.hauteur * 0.9;     // véhicule carré, presque la bande

        for (let i = 0; i < densite; i++) {
            const sprite = this._prendreSprite(
                this._textureVehicule(bande.direction),
                LaneGenerator.DEPTH.vehicule
            );
            sprite.setDisplaySize(cote, cote);
            const v = {
                sprite: sprite,
                vitesse: vitesse,
                direction: bande.direction,
                cote: cote,
                demiLargeur: cote / 2
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
        const sprite = this._prendreSprite(texture, LaneGenerator.DEPTH.decor);
        const taille = this.hauteur * (buissonForce ? 0.55 : (0.7 + Math.random() * 0.3));
        sprite.setDisplaySize(taille, taille);
        const offsetY = 0.5 + (Math.random() - 0.5) * 0.5; // centre ± 25 % de la bande
        sprite.setPosition(x, bande.y + (offsetY - 0.5) * this.hauteur);
        bande.decor.push({ sprite: sprite, offsetY: offsetY, taille: taille });
    }

    // ------------------------------------------------------------------
    // Pool de sprites
    // ------------------------------------------------------------------

    /**
     * Prend un sprite du pool (texture changée) ou en crée un.
     * Le pool évite de créer/détruire en continu pendant le recyclage
     * des bandes (CDC 706 §Performance).
     */
    _prendreSprite(texture, depth) {
        let sprite = this.poolSprites.pop();
        if (!sprite) {
            sprite = this.scene.add.sprite(0, 0, texture);
        } else {
            sprite.setTexture(texture);
            sprite.setVisible(true).setActive(true);
        }
        sprite.setDepth(depth);
        return sprite;
    }

    /** Rend un sprite au pool (masqué, texture peu importe). */
    _rendreSprite(sprite) {
        sprite.setVisible(false).setActive(false);
        this.poolSprites.push(sprite);
    }
}
