/*
 * GameScene — LE monde d'Elsass Farm (proposition Bloc A, point 1).
 *
 * Une seule scène de monde qui change de zone par redémarrage :
 *   this.scene.restart({ zone, apparition }) → init(data) réinjecte la
 *   donnée (mécanisme Phaser natif). L'état du jeu (horloge, sols,
 *   position) vit dans window.FarmEtat (objet HORS scène) : le restart ne
 *   perd rien, et la sauvegarde se fait au passage de portail.
 *
 * Contenu du Bloc A :
 *   - zone Tiled courante (tilemapTiledJSON), caméra qui suit le joueur,
 *     bornée à la map, zoom de base + boutons zoom +/− (toujours visibles) ;
 *   - grille = la tilemap (worldToTileXY / tileToWorldXY) ; clic/tap →
 *     tuile ciblée ; zone d'action Chebyshev (rayonAction) sinon
 *     déplacement BFS suivi en setPosition déterministe (vitesse en
 *     tuiles/s) — le BFS ne traverse que des tuiles passables ;
 *   - portails data-driven (zones.json) : simple → restart direct, à choix →
 *     popup de confirmation (Arcade.UI.bouton, une option par choix) ;
 *   - machine à états sol (sol.js), rendu par tuile labourée + emoji de
 *     pousse (graphisme simple, aucun asset de culture en Bloc A) ;
 *   - horloge jour/nuit + saisons (horloge.js), HUD heure/saison/jour,
 *     teinte plein écran par plage horaire ;
 *   - sommeil : interaction sur le lit (zones.json) → popup → voile de
 *     nuit → tick quotidien → réveil à heureReveil du jour+1 → save forcée ;
 *   - barre d'outils (Arcade.UI.barreIcones, 5 slots).
 */
class GameScene extends Phaser.Scene {
    static KEY = "jeu";

    constructor() {
        super(GameScene.KEY);
    }

    init(data) {
        const C = window.FarmConfig;
        const E = window.FarmEtat;
        data = data || {};

        // Zone courante : donnée du restart (portail), sinon position
        // sauvegardée, sinon première zone de zones.json (garde-fou
        // FarmZones.zone). La zone est validée au preload (this.zone).
        const idDemandee = data.zone || (E.position && E.position.zone) || null;
        const zone = FarmZones.zone(this, idDemandee);
        this.zoneId = zone ? zone.id : null;
        this.zone = zone;

        // Point d'apparition : donnée du restart, sinon position
        // sauvegardée (si elle est dans CETTE zone), sinon apparition par
        // défaut de la zone.
        this.apparition = data.apparition || null;
        if (!this.apparition && E.position && E.position.zone === this.zoneId &&
                typeof E.position.x === "number" && typeof E.position.y === "number") {
            this.apparition = { x: E.position.x, y: E.position.y };
        }
    }

    preload() {
        // zones.json est déjà dans le cache (chargé au boot par main.js).
        this.zone = FarmZones.zone(this, this.zoneId);
        if (!this.zone) {
            console.error("[Farm] Aucune zone dans zones.json.");
            return;
        }
        this.zoneId = this.zone.id;
        // ⭐ FIX gel/mauvaise zone post-portail (2) : clé de chargement PAR
        // ZONE, pas une clé fixe "carte" partagée. Avec une clé fixe,
        // rejouer this.load.tilemapTiledJSON("carte", <autre fichier>) à un
        // 2e passage dans preload() (scene.restart) ne remplaçait pas la
        // tilemap déjà en cache : create() retombait sur l'ancienne carte
        // malgré this.zoneId/le HUD correctement mis à jour sur la nouvelle
        // zone. Bug préexistant, jamais détecté par le studio car ses 5
        // passes QA échouaient toutes avant d'atteindre un vrai changement
        // de zone (clic mort, cf. fix this.voile ci-dessous).
        this.load.tilemapTiledJSON("carte-" + this.zoneId, this.zone.tiled);

        // Tilesets partagés de l'arcade (public/games/assets/tilesets/,
        // consigne 704) : les textures DOIVENT exister dans le
        // TextureManager avant create() — addTilesetImage référence la
        // texture par clé = nom du tileset dans la carte Tiled. Même
        // chemin que l'image référencée dans les .json Tiled.
        this.load.image("sol_16px", "/games/assets/tilesets/sol_16px.png");
        this.load.image("batiment_16px", "/games/assets/tilesets/batiment_16px.png");
        this.load.image("decor_16px", "/games/assets/tilesets/decor_16px.png");
    }

    create() {
        const C = window.FarmConfig;
        const E = window.FarmEtat;
        this.C = C;
        this.E = E;

        // --- Tilemap Tiled : la grille (point 3) ---------------------------
        this.map = this.make.tilemap({ key: "carte-" + this.zoneId });
        const tsSol = this.map.addTilesetImage("sol_16px");
        const tsBat = this.map.addTilesetImage("batiment_16px");
        const tsDec = this.map.addTilesetImage("decor_16px");
        const tsListe = [tsSol, tsBat, tsDec].filter(Boolean);

        // Convention de calques (point 2) : "sol" (fond), "obstacles"
        // (bloquante), "decors" (rendue au-dessus du joueur).
        const coucheSol = this.map.createLayer("sol", tsListe)
            .setDepth(C.profondeurs.sol);
        this.coucheSol = coucheSol;
        this.coucheObstacles = this.map.createLayer("obstacles", tsListe)
            .setDepth(C.profondeurs.obstacles)
            .setCollisionByProperty({ passable: false });
        const coucheDecors = this.map.createLayer("decors", tsListe)
            .setDepth(C.profondeurs.decors);
        this.coucheDecors = coucheDecors;

        // --- Joueur (graphisme simple : emoji — pas d'asset en Bloc A) -----
        // API Phaser 4.2.1 : Tilemap expose tileWidth/tileHeight (camelCase) —
        // map.tilewidth (minuscule) est undefined → NaN partout (fix 2e QA).
        const tuile = this.map.tileWidth;
        const p = this.apparition || this.zone.apparition || { x: 1, y: 1 };
        // API Phaser 4.2.1 : Tilemap.tileToWorldXY(tileX, tileY, point,
        // camera, layer) — le dernier argument est la COUCHE (nom, index ou
        // TilemapLayer), pas un décalage de tuile. On passe la couche "sol"
        // et on centre sur la tuile manuellement (coin + demi-tuile).
        const posDepart = this._tileCentre(p.x, p.y);
        this.joueur = this.add.text(posDepart.x, posDepart.y, "🧑‍🌾", {
            fontFamily: C.police.famille,
            fontSize: Math.round(tuile * 1.1) + "px",
            align: "center"
        })
            .setOrigin(0.5)
            .setDepth(C.profondeurs.joueur);
        // ⭐ FIX 5e QA : déplacement DÉTERMINISTE (setPosition le long du
        // chemin BFS) — plus de corps Arcade sur le joueur. Sur les 4
        // passes QA, setVelocity sur le body du texte n'a JAMAIS déplacé
        // le joueur (S2 échec à chaque passe). Le BFS ne traverse que des
        // tuiles passables → la collision Arcade était redondante ; le
        // déplacement manuel est indépendant du corps.

        this.tuileJoueur = { x: p.x, y: p.y };
        E.position = { zone: this.zoneId, x: p.x, y: p.y };

        // --- Caméra à paliers adaptés à la zone (décision John 11/08) -----
        // nbPaliers = (plus grande dimension de la zone + 10) ÷ 10, arrondi
        // au supérieur, borné [1, paliersMax]. Palier i = casesParPalier × i
        // cases visibles sur le PETIT côté de l'écran (zoom 1 = 10×10 cases
        // min). Le dézoom est borné par la marge : jamais plus de 5 cases de
        // vide autour de la zone → zoomMin = max(écranW/((W+10)×tuile),
        // écranH/((H+10)×tuile)). Les paliers dont le zoom théorique descend
        // sous zoomMin sont écrasés (dédupliqués) : le nombre EFFECTIF peut
        // être < nbPaliers (ex. ferme en portrait → 2 paliers au lieu de 4).
        // Au dézoom, la caméra glisse le long de la ligne perso → centre de
        // la zone : on suit un point factice interpolé (t = 0 sur le perso
        // au palier 1, t = 1 sur le centre au palier max).
        this._cibleCam = this.add.zone(0, 0, 1, 1);
        this.palier = 0;
        this._calculerPaliers();
        const marge = C.camera.margeMaxCases * this.map.tileWidth;
        this.cameras.main.setBounds(
            -marge,
            -marge,
            this.map.widthInPixels + 2 * marge,
            this.map.heightInPixels + 2 * marge
        );
        this.cameras.main.startFollow(this._cibleCam, true,
            C.camera.glisse, C.camera.glisse);
        // Recalcul au redimensionnement (rotation, plein écran) : les zooms
        // des paliers dépendent de la taille de l'écran.
        Arcade.UI.layout(this, () => {
            this._calculerPaliers();
            this._appliquerPalier(false);
        });
        this._appliquerPalier(true);

        // --- Caméra UI dédiée (fix 3e QA — bug John « l'UI bouge avec le
        // zoom ») ---------------------------------------------------------
        // Phaser 4.2.1 : scrollFactor(0) ne compense QUE le scroll de la
        // caméra (translation e/f de la matrice) — la partie linéaire a/d
        // (le ZOOM) s'applique TOUJOURS, même à scrollFactor 0. Une UI
        // vraiment fixe à l'écran (indépendante du zoom ET du scroll) exige
        // donc une CAMÉRA UI DÉDIÉE, rendue par-dessus la caméra du monde :
        //   - camUI : zoom 1, scroll 0, pas de follow → espace écran ;
        //   - chaque objet HUD est EXCLU de la caméra du monde via
        //     cameraFilter = main.id (helper _hud) → il n'est rendu QUE
        //     par la camUI, et reçoit les clics via la camUI
        //     (inputCandidate exige willRender) ;
        //   - le monde (couches, joueur, emojis) est exclu de la camUI.
        // ⭐ FIX 5e QA (CAUSE COMMUNE) : PLUS DE CONTAINER. Dans ce build
        // Phaser 4.2.1, les enfants d'un Container ont displayList = null
        // (addHandler → removeFromDisplayList, sans réassignation) →
        // GameObject.willRender(camera) renvoie false → le rendu du
        // container IGNORE les enfants ET inputCandidate() les ignore
        // (il exige willRender) : HUD invisible + boutons zoom/barre
        // d'outils/popups morts (4 passes QA, fixes 3 et 4 impuissants).
        // Le filtre s'applique donc OBJET PAR OBJET, jamais via container.
        // ⭐ FIX 4e QA : la camUI est recalée à CHAQUE layout. En
        // Scale.RESIZE (boot.js) la taille du canvas évolue (desktop /
        // mobile / rotation) ; le CameraManager.onResize ne redimensionne
        // une caméra ajoutée via cameras.add QUE s'il la trouve avec
        // exactement l'ancienne taille du scale (0×0 au premier frame,
        // jamais rattrapé) → viewport camUI décalé ou vide → HUD invisible.
        this.camUI = this.cameras.add(0, 0, this.scale.width, this.scale.height);
        this.camUI.ignore([this.coucheSol, this.coucheObstacles, this.coucheDecors, this.joueur]);
        Arcade.UI.layout(this, (w, h) => this.camUI.setViewport(0, 0, w, h));
        // Nettoyage défensif : Phaser détruit déjà camUI au shutdown (scene.restart
        // fait stop+start), mais on le rend explicite pour documenter l'intention.
        this.events.once("shutdown", () => this.cameras.remove(this.camUI));

        // --- Sols : rendu initial (tuile labourée + emojis de pousse) -----
        this._emojis = {};
        this._labourees = {};
        this._rendreSols();

        // --- HUD + barre d'outils + zoom -----------------------------------
        this._creerHUD();

        // --- Clic / tap (point 3) ------------------------------------------
        this.chemin = [];
        this._actionApresArrivee = null;
        const surClic = (pointeur) => this._clic(pointeur);
        this.input.on("pointerdown", surClic);
        // Nettoyage défensif (cf. commentaire camUI ci-dessus, même raison).
        this.events.once("shutdown", () => this.input.off("pointerdown", surClic));

        // --- Horloge : état initial de l'affichage --------------------------
        this.derniereHeure = null;
        this.nuit = null;
        // ⭐ FIX gel post-portail : this.voile (voile de l'écran de sommeil,
        // créé paresseusement dans _dormir() via `if (!this.voile)`) est une
        // propriété d'INSTANCE, pas de la scène Phaser — elle survit à
        // scene.restart(). Sans ce reset, le voile de la zone précédente
        // (détruit par Phaser avec le display-list) reste référencé : au 2e
        // sommeil, `if (!this.voile)` est faux, aucun voile n'est recréé, et
        // le tween anime un GameObject détruit.
        this.voile = null;
        this._rafraichirHorloge(true);
    }

    /**
     * Centre (px) de la tuile (x, y) dans le monde. API Phaser 4.2.1 :
     * Tilemap.tileToWorldXY(tileX, tileY, point, camera, layer) — la couche
     * doit être passée explicitement (5e argument ; la méthode de la
     * TilemapLayer délègue avec elle-même), la caméra par défaut suffit.
     * Le point retourné est le COIN de la tuile : on centre en ajoutant
     * une demi-tuile (l'ancien (null, 0.5, 0.5) de Phaser 3 n'existe plus).
     */
    _tileCentre(x, y) {
        const pos = this.coucheSol.tileToWorldXY(x, y, null, null);
        return {
            x: pos.x + this.map.tileWidth / 2,
            y: pos.y + this.map.tileHeight / 2
        };
    }

    /**
     * ⭐ FIX 5e QA : place un objet d'interface dans l'espace ÉCRAN (caméra
     * UI dédiée) en l'excluant de la caméra du monde. cameraFilter = id de
     * la caméra principale → willRender(main) = false (non rendu par le
     * monde) et willRender(camUI) = true (rendu + cliquable via la camUI,
     * zoom 1 / scroll 0 → fixe sous zoom/scroll). Sans container (voir
     * create() — cause commune HUD + clics).
     */
    _hud(obj) {
        obj.cameraFilter = this.cameras.main.id;
        return obj;
    }

    // ======================================================================
    // Caméra à paliers (décision John 11/08)
    // ======================================================================

    /**
     * Calcule la liste des zooms de paliers pour la zone courante.
     *   nbPaliers = (plus grande dimension de la zone + 10) ÷ 10, arrondi au
     *   supérieur, borné [1, paliersMax] ; palier i = casesParPalier × i
     *   cases visibles sur le PETIT côté de l'écran.
     * Le dézoom est borné par la marge (jamais plus de 5 cases de vide
     * autour de la zone) : zoomMin = max(écranW/((W+10)×tuile),
     * écranH/((H+10)×tuile)) — les paliers dont le zoom théorique descend
     * sous zoomMin sont écrasés (dédupliqués) : le nombre EFFECTIF peut
     * être < nbPaliers (ex. ferme en portrait → 2 paliers au lieu de 4).
     * Recalculé à chaque layout (la taille d'écran change les zooms).
     */
    _calculerPaliers() {
        const C = this.C;
        const tuile = this.map.tileWidth;
        const W = this.map.width;
        const H = this.map.height;
        const maxDim = Math.max(W, H);
        const nbPaliers = Phaser.Math.Clamp(
            Math.ceil((maxDim + 10) / 10), 1, C.camera.paliersMax);
        const marge = C.camera.margeMaxCases;
        const zoomMin = Math.max(
            this.scale.width / ((W + 2 * marge) * tuile),
            this.scale.height / ((H + 2 * marge) * tuile)
        );
        const petitCote = Math.min(this.scale.width, this.scale.height);
        const paliers = [];
        for (let i = 1; i <= nbPaliers; i++) {
            const z = Math.max(
                petitCote / (C.camera.casesParPalier * i * tuile), zoomMin);
            if (!paliers.length || z < paliers[paliers.length - 1] - 1e-6) {
                paliers.push(z);
            }
        }
        this._paliers = paliers;
        // t le long de la ligne perso → centre de la zone pour chaque palier
        // effectif : 0 = sur le perso (zoom 1), 1 = sur le centre (zoom max).
        this._tPaliers = paliers.map((_, j) =>
            paliers.length > 1 ? j / (paliers.length - 1) : 0);
        if (this.palier >= paliers.length) this.palier = paliers.length - 1;
    }

    /** Applique le zoom du palier courant (et cale la cible si demandé). */
    _appliquerPalier(instantane) {
        const z = this._paliers[this.palier]
            || this._paliers[this._paliers.length - 1];
        this.cameras.main.setZoom(z);
        if (instantane) this._positionnerCible();
    }

    /**
     * Positionne la cible suivie sur la ligne perso → centre de la zone,
     * à la fraction t du palier courant (0 = perso, 1 = centre). Appelé à
     * chaque frame : la caméra glisse (lerp du follow) quand le palier ou
     * la position du joueur change.
     *
     * ⭐ FIX retour John 11/08 : la règle des 5 cases s'applique à TOUS les
     * paliers. Sans garde-fou, la cible glisse vers le centre dès le palier
     * 2 et, quand le perso est près du bord de la zone, la caméra s'éloigne
     * du bord (vide > 5 cases en paysage, perso/bord de zone hors-écran en
     * portrait). On borne donc la cible pour que la vue garde :
     *   - le perso à ≥ margeMaxCases du bord de l'écran (jamais de bord de
     *     zone collé à l'écran, le bord reste à 5 cases quand le perso est
     *     au bord) ;
     *   - la zone à ≤ margeMaxCases de vide autour d'elle (bornes zone+marge,
     *     doublon sûr du setBounds).
     * À zoom 1 (demi-vue = 5 cases sur le petit côté) la fenêtre se réduit
     * au perso lui-même → centrage zoom 1 strictement inchangé.
     */
    _positionnerCible() {
        const C = this.C;
        const t = this._tPaliers[this.palier] || 0;
        const cx = this.map.widthInPixels / 2;
        const cy = this.map.heightInPixels / 2;
        const z = this._paliers[this.palier]
            || this._paliers[this._paliers.length - 1];
        // Cible de glissement le long de la ligne perso → centre (inchangée).
        const gx = this.joueur.x + t * (cx - this.joueur.x);
        const gy = this.joueur.y + t * (cy - this.joueur.y);
        // Règle des 5 cases à tous les paliers : demi-vue (px monde) à zoom
        // courant, marge en px, fenêtre autorisée pour la cible.
        const marge = C.camera.margeMaxCases * this.map.tileWidth;
        const dX = this.scale.width / (2 * z);
        const dY = this.scale.height / (2 * z);
        const minX = Math.max(this.joueur.x - dX + marge, -marge + dX);
        const maxX = Math.min(this.joueur.x + dX - marge,
            this.map.widthInPixels + marge - dX);
        const minY = Math.max(this.joueur.y - dY + marge, -marge + dY);
        const maxY = Math.min(this.joueur.y + dY - marge,
            this.map.heightInPixels + marge - dY);
        this._cibleCam.setPosition(
            Phaser.Math.Clamp(gx, minX, maxX),
            Phaser.Math.Clamp(gy, minY, maxY)
        );
    }

    update(time, delta) {
        const E = this.E;
        // Compteur unique t, cumulé avec le facteur (1 s réelle = 60 s jeu).
        E.horloge.t += delta * this.C.horloge.facteur;
        this._rafraichirHorloge(false);
        this._suivreChemin(time, delta);
        this._positionnerCible();
    }

    // ======================================================================
    // Clic : zone d'action Chebyshev ou déplacement BFS (point 3)
    // ======================================================================
    _clic(pointeur) {
        const C = this.C;
        if (this.popup) return;   // popup ouvert : le clic ne traverse pas

        // Clic sur un bouton (zoom) : le bouton a posé le marqueur.
        if (Arcade.UI._clicPlateforme) {
            Arcade.UI._clicPlateforme = false;
            return;
        }

        // ⭐ FIX 4e QA : coordonnées MONDE explicites. Avec la caméra UI
        // dédiée, pointeur.worldX/worldY ne sont PAS fiables : le
        // hit-testing (InputPlugin.hitTestPointer) itère les caméras sous
        // le pointeur dans l'ordre [camUI, main] (getCamerasBelowPointer
        // inverse la liste via unshift) et écrase worldX/worldY à CHAQUE
        // caméra testée — coordonnées ÉCRAN si le clic tombe sur un objet
        // HUD (camUI : scroll 0, zoom 1), MONDE sinon. Interprétées comme
        // monde, des coordonnées écran donnent des tuiles hors map
        // (ty=27 > 18 sur ferme) → « rien ne se déclenche ». On transforme
        // donc toujours la position écran du pointeur avec la caméra du
        // monde : déterministe quel que soit l'ordre des caméras.
        const pt = this.cameras.main.getWorldPoint(pointeur.x, pointeur.y);
        const tx = Math.floor(pt.x / this.map.tileWidth);
        const ty = Math.floor(pt.y / this.map.tileHeight);
        if (tx < 0 || ty < 0 || tx >= this.map.width || ty >= this.map.height) return;
        const cible = { x: tx, y: ty };

        // Zone d'action Chebyshev : distance = max(|dx|, |dy|) en tuiles.
        const dist = Math.max(
            Math.abs(tx - this.tuileJoueur.x),
            Math.abs(ty - this.tuileJoueur.y)
        );
        if (dist <= C.grille.rayonAction) {
            this._action(cible);
            return;
        }

        // ⭐ FIX interaction objet bloquant (lit) depuis une seule direction :
        // un clic lointain DIRECTEMENT sur le lit (passable=false depuis le
        // fix collision) faisait échouer le BFS en silence (_bfs refuse une
        // destination non praticable) — AUCUN déplacement, donc rien ne se
        // passait, sauf quand le clic tombait par chance sur une case
        // adjacente libre plutôt que sur le lit lui-même (d'où l'impression
        // que ça ne marchait que depuis un seul côté). Restreint au lit
        // (objet interactif connu) : un mur/la clôture cliqués de loin
        // restent un no-op, pas une marche inutile jusqu'au mur.
        const lit = FarmZones.lit(this, this.zoneId);
        if (lit && lit.x === cible.x && lit.y === cible.y) {
            const voisin = this._voisinPraticableLePlusProche(cible);
            if (voisin) {
                const chemin = this._bfs(this.tuileJoueur, voisin);
                if (chemin) {
                    this.chemin = chemin;
                    this._actionApresArrivee = cible;
                }
            }
            return;
        }

        // Sinon : déplacement BFS vers la tuile cliquée.
        const chemin = this._bfs(this.tuileJoueur, cible);
        if (chemin) this.chemin = chemin;
    }

    /** Case praticable la plus proche (chemin le plus court) autour de `cible` (8 voisins). */
    _voisinPraticableLePlusProche(cible) {
        const voisins = [
            { x: cible.x, y: cible.y - 1 }, { x: cible.x, y: cible.y + 1 },
            { x: cible.x - 1, y: cible.y }, { x: cible.x + 1, y: cible.y },
            { x: cible.x - 1, y: cible.y - 1 }, { x: cible.x + 1, y: cible.y - 1 },
            { x: cible.x - 1, y: cible.y + 1 }, { x: cible.x + 1, y: cible.y + 1 },
        ];
        let meilleur = null;
        let meilleureLongueur = Infinity;
        for (const v of voisins) {
            if (v.x < 0 || v.y < 0 || v.x >= this.map.width || v.y >= this.map.height) continue;
            const chemin = this._bfs(this.tuileJoueur, v);
            if (chemin && chemin.length < meilleureLongueur) {
                meilleur = v;
                meilleureLongueur = chemin.length;
            }
        }
        return meilleur;
    }

    /** Action immédiate sur une case dans la zone d'action (point 5). */
    _action(cible) {
        const C = this.C;
        const E = this.E;

        // Sommeil : interaction sur le lit (déclaré dans zones.json).
        const lit = FarmZones.lit(this, this.zoneId);
        if (lit && lit.x === cible.x && lit.y === cible.y) {
            this._proposerSommeil();
            return;
        }

        // Les actions sol ne s'appliquent pas aux murs (non passables).
        const tuile = this.map.getTileAt(cible.x, cible.y, true, "sol");
        if (tuile && tuile.properties && tuile.properties.passable === false) return;

        const outil = this.barre.actif();
        if (!outil) return;

        const c = FarmSol.case(E, this.zoneId, cible.x, cible.y);
        if (outil === "pelle") {
            if (!c) FarmSol.labourer(E, this.zoneId, cible.x, cible.y);
        } else if (outil === "graines") {
            if (c && c.etat === "labouree") {
                FarmSol.planter(E, this.zoneId, cible.x, cible.y, C,
                    FarmHorloge.jour(E.horloge.t));
            }
        } else if (outil === "arrosoir") {
            if (c && c.etat === "plantee" && !c.arrosee) {
                FarmSol.arroser(E, this.zoneId, cible.x, cible.y);
            }
        } else if (outil === "main") {
            if (c && c.etat === "prete") {
                FarmSol.recolter(E, this.zoneId, cible.x, cible.y, C);
            }
        }
        this._rendreSols();
    }

    // ======================================================================
    // Déplacement : BFS + suivi du chemin en Arcade Physics (point 3)
    // ======================================================================

    /**
     * Plus court chemin (BFS 4-directions) entre deux tuiles, sur la
     * grille passable (les tuiles non passables = murs). Retourne la liste
     * des tuiles à parcourir (sans la tuile de départ), ou null si la
     * cible est inaccessible.
     */
    _bfs(depart, cible) {
        const map = this.map;
        const W = map.width;
        const H = map.height;
        const passable = (x, y) => {
            if (x < 0 || y < 0 || x >= W || y >= H) return false;
            const t = map.getTileAt(x, y, true, "obstacles");
            if (t && t.properties && t.properties.passable === false) return false;
            return true;
        };
        if (!passable(cible.x, cible.y)) return null;

        const cle = (x, y) => x + "," + y;
        const pred = new Map();
        const vu = new Set([cle(depart.x, depart.y)]);
        const file = [{ x: depart.x, y: depart.y }];

        while (file.length) {
            const cur = file.shift();
            if (cur.x === cible.x && cur.y === cible.y) {
                const chemin = [];
                let c = cur;
                while (c.x !== depart.x || c.y !== depart.y) {
                    chemin.unshift(c);
                    c = pred.get(cle(c.x, c.y));
                }
                return chemin;
            }
            const voisins = [
                { x: cur.x + 1, y: cur.y }, { x: cur.x - 1, y: cur.y },
                { x: cur.x, y: cur.y + 1 }, { x: cur.x, y: cur.y - 1 }
            ];
            for (const v of voisins) {
                const k = cle(v.x, v.y);
                if (!vu.has(k) && passable(v.x, v.y)) {
                    vu.add(k);
                    pred.set(k, cur);
                    file.push(v);
                }
            }
        }
        return null;
    }

    /**
     * Suit le chemin tuile par tuile (fix 5e QA : setPosition DÉTERMINISTE,
     * vitesse en tuiles/s — indépendant du corps Arcade qui n'a jamais
     * déplacé le joueur sur les 4 passes QA).
     */
    _suivreChemin(time, delta) {
        if (!this.chemin || !this.chemin.length) return;
        const C = this.C;
        const tuile = this.map.tileWidth;
        const cible = this.chemin[0];
        const pos = this._tileCentre(cible.x, cible.y);
        const dx = pos.x - this.joueur.x;
        const dy = pos.y - this.joueur.y;
        const dist = Math.hypot(dx, dy);
        const pasMax = C.grille.vitesseTuilesParSeconde * tuile * (delta / 1000);

        if (dist <= Math.max(2, pasMax)) {
            // Tuile atteinte : on passe à la suivante.
            this.joueur.setPosition(pos.x, pos.y);
            this.chemin.shift();
            this.tuileJoueur = { x: cible.x, y: cible.y };
            this.E.position = { zone: this.zoneId, x: cible.x, y: cible.y };
            if (!this.chemin.length) this._arrive();
        } else {
            this.joueur.setPosition(
                this.joueur.x + (dx / dist) * pasMax,
                this.joueur.y + (dy / dist) * pasMax
            );
        }
    }

    /** Arrivée à destination : portail éventuel sur la tuile (point 2). */
    _arrive() {
        const portails = FarmZones.portails(this, this.zoneId);
        const p = portails.find((p) =>
            p.tuile.x === this.tuileJoueur.x && p.tuile.y === this.tuileJoueur.y);
        if (p) {
            this._activerPortail(p);
            return;
        }

        // Action en attente (clic lointain sur une case bloquante-mais-
        // interactive, ex. le lit) : on vient de marcher jusqu'à la case
        // libre la plus proche, on déclenche l'action maintenant.
        if (this._actionApresArrivee) {
            const cible = this._actionApresArrivee;
            this._actionApresArrivee = null;
            const dist = Math.max(
                Math.abs(cible.x - this.tuileJoueur.x),
                Math.abs(cible.y - this.tuileJoueur.y)
            );
            if (dist <= this.C.grille.rayonAction) this._action(cible);
        }
    }

    // ======================================================================
    // Portails (point 2) : simple → restart direct ; choix → popup
    // ======================================================================
    _activerPortail(p) {
        if (p.type === "simple") {
            this._sauvegarder();
            this.scene.restart({ zone: p.cible.zone, apparition: p.cible.apparition });
        } else if (p.type === "choix") {
            this._popupChoix(p);
        }
    }

    /** Save au passage de portail (point 2 : gather/apply existants). */
    _sauvegarder() {
        Arcade.Save.saveLocal();
        Arcade.Save.saveCloud();
    }

    _popupChoix(p) {
        if (this.popup) return;
        const C = this.C;
        const fond = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.55)
            .setOrigin(0).setScrollFactor(0).setDepth(C.profondeurs.popup);
        const titre = this.add.text(0, 0, C.textes.ouAller, {
            fontFamily: C.police.famille,
            color: "#ffffff",
            align: "center"
        })
            .setOrigin(0.5).setScrollFactor(0).setDepth(C.profondeurs.popup + 1)
            .setStroke(C.couleurs.contour, 3);

        // Espace écran (fix 3e QA) : le popup est rendu par la caméra UI.
        // Fix 5e QA : filtre par objet (cameraFilter), sans container.
        this._hud(fond);
        this._hud(titre);

        const boutons = p.choix.map((ch) => this._creerBoutonHUD({
            label: ch.label,
            couleur: ch.cible ? C.couleurs.boutonJouer : C.couleurs.boutonSecondaire,
            ombre: C.couleurs.ombreBouton,
            police: C.police.famille,
            onClick: () => {
                this._fermerPopup();
                if (ch.cible) {
                    this._sauvegarder();
                    this.scene.restart({ zone: ch.cible.zone, apparition: ch.cible.apparition });
                }
            }
        }));

        Arcade.UI.layout(this, (w, h) => {
            fond.setSize(w, h);
            titre.setFontSize(Math.round(Arcade.UI.u(this, 5)) + "px")
                .setPosition(w / 2, h * 0.32);
            const bh = Arcade.UI.u(this, 10);
            const bw = w * 0.6;
            boutons.forEach((b, i) => {
                b.redimensionner(bw, bh)
                    .setPosition(w / 2, h * 0.45 + i * (bh + Arcade.UI.u(this, 2)));
            });
        });

        this.popup = { fond: fond, titre: titre, boutons: boutons };
    }

    _fermerPopup() {
        if (!this.popup) return;
        this.popup.fond.destroy();
        this.popup.titre.destroy();
        this.popup.boutons.forEach((b) => b.destroy());
        this.popup = null;
    }

    // ======================================================================
    // Sommeil (point 6) : lit → popup → voile de nuit → tick → réveil
    // ======================================================================
    _proposerSommeil() {
        if (this.popup) return;
        const C = this.C;
        const fond = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.55)
            .setOrigin(0).setScrollFactor(0).setDepth(C.profondeurs.popup);
        const titre = this.add.text(0, 0, C.textes.dormir, {
            fontFamily: C.police.famille,
            color: "#ffffff",
            align: "center"
        })
            .setOrigin(0.5).setScrollFactor(0).setDepth(C.profondeurs.popup + 1)
            .setStroke(C.couleurs.contour, 3);

        // Espace écran (fix 3e QA) : le popup est rendu par la caméra UI.
        // Fix 5e QA : filtre par objet (cameraFilter), sans container.
        this._hud(fond);
        this._hud(titre);

        const oui = this._creerBoutonHUD({
            label: C.textes.dormirOui,
            couleur: C.couleurs.boutonJouer,
            ombre: C.couleurs.ombreBouton,
            police: C.police.famille,
            onClick: () => {
                this._fermerPopup();
                this._dormir();
            }
        });
        const non = this._creerBoutonHUD({
            label: C.textes.dormirNon,
            couleur: C.couleurs.boutonSecondaire,
            ombre: C.couleurs.ombreBouton,
            police: C.police.famille,
            onClick: () => this._fermerPopup()
        });

        Arcade.UI.layout(this, (w, h) => {
            fond.setSize(w, h);
            titre.setFontSize(Math.round(Arcade.UI.u(this, 5)) + "px")
                .setPosition(w / 2, h * 0.35);
            const bh = Arcade.UI.u(this, 10);
            const bw = w * 0.6;
            oui.redimensionner(bw, bh).setPosition(w / 2, h * 0.5);
            non.redimensionner(bw, bh)
                .setPosition(w / 2, h * 0.5 + bh + Arcade.UI.u(this, 2));
        });

        this.popup = { fond: fond, titre: titre, boutons: [oui, non] };
    }

    _dormir() {
        const C = this.C;
        const E = this.E;

        // Voile de nuit (fondu) — recalculé à la rotation. Espace écran
        // (fix 3e QA) : rendu par la caméra UI (fix 5e QA : _hud).
        if (!this.voile) {
            this.voile = this.add.rectangle(0, 0, 10, 10, 0x000000, 0)
                .setOrigin(0).setScrollFactor(0).setDepth(C.profondeurs.nuit + 1);
            this._hud(this.voile);
            Arcade.UI.layout(this, (w, h) => this.voile.setSize(w, h));
        }

        const tAvant = E.horloge.t;
        const tApres = FarmHorloge.versReveil(tAvant, C);

        this.tweens.add({
            targets: this.voile,
            alpha: 0.92,
            duration: 600,
            onComplete: () => {
                // Tick quotidien : pousse, reset arrosage, changement de saison.
                FarmSol.tickNuit(E, C, tAvant, tApres);
                E.horloge.t = tApres;
                this._rendreSols();
                this._rafraichirHorloge(true);
                // Réveil : le voile se lève.
                this.tweens.add({ targets: this.voile, alpha: 0, duration: 800 });
                // Save FORCÉE au réveil (point de non-retour du jour, point 6).
                Arcade.Save.saveLocal();
                Arcade.Save.saveCloud();
            }
        });
    }

    // ======================================================================
    // HUD : horloge (heure/saison/jour), barre d'outils, zoom +/−
    // ======================================================================
    _creerHUD() {
        const C = this.C;

        // Nom de zone (décision John 11/08) : affiché en haut à gauche quand
        // le joueur change de zone. Espace écran (fix 5e QA : _hud par
        // objet, sans container). Texte depuis config.textes.zones.
        this.hudZone = this.add.text(0, 0,
            C.textes.zones[this.zoneId] || this.zoneId, {
                fontFamily: C.police.famille,
                color: C.couleurs.texte,
                align: "left"
            })
            .setOrigin(0, 0.5)
            .setScrollFactor(0)
            .setDepth(C.profondeurs.hud)
            .setStroke(C.couleurs.contour, 3);
        this._hud(this.hudZone);

        // Horloge (haut, centré).
        this.hudHorloge = this.add.text(0, 0, "", {
            fontFamily: C.police.famille,
            color: C.couleurs.texte,
            align: "center"
        })
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(C.profondeurs.hud)
            .setStroke(C.couleurs.contour, 3);
        this._hud(this.hudHorloge);

        // Barre d'outils (bas, 5 slots — point 3). Le clic sur une icône ne
        // traverse pas vers la grille (stopPropagation du composant).
        // Les objets créés par le composant sont passés à la caméra UI
        // (espace écran) via l'API objets(cle) + _hud.
        this.barre = Arcade.UI.barreIcones(this, {
            items: [
                { cle: "pelle", icone: "⛏️" },
                { cle: "arrosoir", icone: "🚿" },
                { cle: "main", icone: "✋" },
                { cle: "graines", icone: C.sol.graineTest },
                { cle: "libre", icone: "❔" }
            ],
            couleurFond: C.couleurs.boutonSecondaire,
            couleurBordure: "#3d6b52",
            couleurActif: C.barreOutils.eclatCouleur,
            grisAlpha: C.barreOutils.grisAlpha,
            police: C.police.famille,
            profondeur: C.profondeurs.hud,
            onClic: (cle) => this._choisirOutil(cle)
        });
        C.outils.forEach((it) => {
            const o = this.barre.objets(it.cle);
            if (!o) return;
            // Espace écran (fix 5e QA) : filtre par objet, sans container.
            this._hud(o.fond);
            this._hud(o.icone);
            this._hud(o.badge);
            this._hud(o.zone);
        });

        // Boutons zoom +/− (toujours visibles — point 3). marqueurClic :
        // le clic sur un bouton ne déclenche pas le déplacement (_clic).
        // Créés via le helper HUD : les objets internes du composant sont
        // filtrés vers la caméra UI (espace écran) par _hud.
        this.zoomPlus = this._creerBoutonHUD({
            label: "+",
            couleur: C.couleurs.boutonSecondaire,
            ombre: C.couleurs.ombreBouton,
            police: C.police.famille,
            marqueurClic: true,
            onClick: () => this._zoom(C.zoom.pas)
        });
        this.zoomMoins = this._creerBoutonHUD({
            label: "−",
            couleur: C.couleurs.boutonSecondaire,
            ombre: C.couleurs.ombreBouton,
            police: C.police.famille,
            marqueurClic: true,
            onClick: () => this._zoom(-C.zoom.pas)
        });

        // Mise en page recalculée à chaque rotation.
        Arcade.UI.layout(this, (w, h) => {
            const u = (n) => Arcade.UI.u(this, n);
            this.hudZone
                .setFontSize(Math.round(u(C.hud.tailleZoneU)) + "px")
                .setPosition(u(C.hud.margeU), u(C.hud.margeU));
            this.hudHorloge
                .setFontSize(Math.round(u(C.hud.tailleTexteU)) + "px")
                .setPosition(w / 2, u(C.hud.margeU));

            const cote = u(C.barreOutils.tailleIconeU);
            this.barre.placer({
                x: w / 2,
                y: h - cote / 2 - u(C.barreOutils.margeU),
                cote: cote,
                tailleIcone: u(C.barreOutils.tailleEmojiU),
                tailleBadge: u(C.barreOutils.tailleQuantiteU)
            });

            const zb = u(C.zoom.tailleBoutonU);
            const xZoom = w - u(C.zoom.margeU) - zb / 2;
            this.zoomPlus.redimensionner(zb, zb).setPosition(xZoom, h * 0.42);
            this.zoomMoins.redimensionner(zb, zb)
                .setPosition(xZoom, h * 0.42 + zb + u(1));
        });
    }

    /**
     * Crée un bouton core (Arcade.UI.bouton) puis filtre les objets Phaser
     * qu'il a ajoutés à la scène vers la caméra UI (espace écran — fix 3e
     * QA : l'UI doit rester fixe sous zoom/scroll ; fix 5e QA : _hud par
     * objet, sans container). Le composant crée ses objets via scene.add.* :
     * on les capture dans le displayList entre l'avant et l'après de l'appel.
     */
    _creerBoutonHUD(options) {
        const enfants = this.sys.displayList.getChildren();
        const avant = enfants.length;
        const bouton = Arcade.UI.bouton(this, options);
        // Espace écran (fix 5e QA) : filtre par objet, sans container.
        enfants.slice(avant).forEach((o) => this._hud(o));
        return bouton;
    }

    /** Sélection d'un outil (toggle ; le slot libre désarme). */
    _choisirOutil(cle) {
        if (cle === "libre") {
            this.barre.setActif(null);
            return;
        }
        const actif = this.barre.actif() === cle ? null : cle;
        this.barre.setActif(actif);
    }

    /**
     * Zoom caméra : change de palier (paliers adaptés à la zone, décision
     * John 11/08). pas > 0 = zoom avant (palier suivant vers le rapproché),
     * pas < 0 = dézoom (vers la vue d'ensemble). La position de la caméra
     * glisse le long de la ligne perso → centre via _positionnerCible()
     * appelé à chaque frame (update).
     */
    _zoom(pas) {
        const nb = this._paliers.length;
        this.palier = Phaser.Math.Clamp(this.palier - pas, 0, nb - 1);
        this._appliquerPalier(false);
    }

    // ======================================================================
    // Horloge : HUD + teinte jour/nuit, rafraîchis au changement d'heure
    // ======================================================================
    _rafraichirHorloge(force) {
        const C = this.C;
        const E = this.E;
        const h = FarmHorloge.heure(E.horloge.t);
        if (!force && h === this.derniereHeure) return;
        this.derniereHeure = h;

        this.hudHorloge.setText(
            C.textes.hudHorloge
                .replace("{jour}", FarmHorloge.jour(E.horloge.t))
                .replace("{saison}", FarmHorloge.saisonNom(E.horloge.t, C))
                .replace("{heure}", h)
        );

        // Teinte jour/nuit : overlay plein écran coloré par plage horaire.
        // Espace écran (fix 3e QA) : rendu par la caméra UI (fix 5e QA : _hud).
        const teinte = this._teinte(h);
        if (!this.nuit) {
            this.nuit = this.add.rectangle(0, 0, 10, 10, 0x000000, 0)
                .setOrigin(0).setScrollFactor(0).setDepth(C.profondeurs.nuit);
            this._hud(this.nuit);
            Arcade.UI.layout(this, (w, hh) => this.nuit.setSize(w, hh));
        }
        this.nuit.setFillStyle(
            parseInt(teinte.couleur.slice(1), 16),
            teinte.alpha
        );
    }

    /** Teinte de la plage horaire courante (dernière dont debut <= heure). */
    _teinte(heure) {
        const teintes = this.C.horloge.teintes;
        let courante = teintes[teintes.length - 1];
        for (const t of teintes) {
            if (heure >= t.debut) courante = t;
        }
        return courante;
    }

    // ======================================================================
    // Rendu des sols (point 5) : tuile labourée + emoji de pousse
    // ======================================================================
    _rendreSols() {
        const C = this.C;
        const E = this.E;
        const zone = E.sols[this.zoneId] || {};

        // Détruit les emojis de pousse précédents.
        for (const k in this._emojis) {
            this._emojis[k].destroy();
            delete this._emojis[k];
        }

        // Cases actives de CETTE zone (labourée / plantée / prête).
        const actives = {};
        for (const k in zone) {
            const c = zone[k];
            if (c.etat !== "labouree" && c.etat !== "plantee" && c.etat !== "prete") continue;
            actives[k] = true;
            const [x, y] = k.split(",").map(Number);
            this.map.putTileAt(C.sol.tuileLaboureeId + 1, x, y, true, "sol");

            let emoji = null;
            if (c.etat === "plantee") emoji = "🌱";
            else if (c.etat === "prete") emoji = C.sol.graineTest;
            if (emoji) {
                const pos = this._tileCentre(x, y);
                const texte = this.add.text(pos.x, pos.y, emoji, {
                    fontFamily: C.police.famille,
                    fontSize: Math.round(this.map.tileWidth * 0.85) + "px",
                    align: "center"
                })
                    .setOrigin(0.5)
                    .setDepth(C.profondeurs.pousse);
                // Objet du MONDE : pas rendu par la caméra UI (espace écran).
                this.camUI.ignore(texte);
                this._emojis[k] = texte;
            }
        }

        // Les cases qui ne sont plus actives (ex. récoltée → vide) reviennent
        // à la tuile de base de la zone courante (décision John 11/08 : les
        // cartes de test ont un sol distinct — ferme = terre, maison-rdc =
        // parquet, maison-etage = bois clair), avec repli sur l'herbe.
        const baseId = (C.sol.tuileBaseParZone
            && C.sol.tuileBaseParZone[this.zoneId]) || C.sol.tuileHerbeId;
        for (const k in this._labourees) {
            if (!actives[k]) {
                const [x, y] = k.split(",").map(Number);
                this.map.putTileAt(baseId + 1, x, y, true, "sol");
            }
        }
        this._labourees = actives;
    }
}
