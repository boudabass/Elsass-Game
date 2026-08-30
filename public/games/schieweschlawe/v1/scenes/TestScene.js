/*
 * TestScene — scène de test UNIQUE du spike v4 « visée proportionnelle au
 * terrain » de Schieweschlawe (PRD 873 §4-6, consigne 704 v4 du 30/08).
 *
 * Ce que cette scène valide (remplace le spike v2, ratio fixe 1:5 abandonné) :
 *   1. VISÉE PROPORTIONNELLE AU TERRAIN : distance_du_tir =
 *      (position_disque / 100) × longueur_totale_du_terrain_jouable. Disque
 *      à 50 → cible à mi-terrain, à 100 → bout du terrain. La longueur du
 *      terrain est PAR NIVEAU (config.js) ; le bouton « Terrain » la fait
 *      défiler pour vérifier le mapping sur ≥ 2 longueurs.
 *   2. COORDONNÉES 0-100 SANS NÉGATIF : axe distance (0 = sous la pierre,
 *      100 = bas de l'écran) + axe latéral (0 = gauche, 100 = droite, 50 =
 *      centre). Le miroir est DÉDUIT de la position : latéral_visé =
 *      100 - latéral_disque (jamais de coordonnée signée dans le code).
 *   3. TIR EN 2 ÉTAPES : (1) placement du disque, (2) bouton vert « Tirer »
 *      → jauge à indicateur mobile + zone orange défilante → reclic pour
 *      arrêter. Arrêt dans l'orange = conforme ; sinon déviation calibrée.
 *   4. ÉCHELLE-HAUTEUR : le disque grossit en montant, rétrécit en retombant ;
 *      la position sol réelle suit séparément parabole + vent (2 axes).
 *   5. VENT 4 DIRECTIONS (vecteur 2D) : setAccelerationX + setAccelerationY,
 *      5 paliers, flèche directionnelle 4 côtés.
 *
 * Contrôles (clic/tap uniquement) : glisser le disque dans la zone de recul
 * (sous la pierre), boutons « Vent » / « Dir. » / « Terrain » pour explorer,
 * bouton vert « Tirer » pour lancer la jauge, reclic pour arrêter l'aiguille.
 * AUCUN niveau, AUCUNE progression — prototype isolé.
 */
class TestScene extends Phaser.Scene {
    static KEY = "test";

    constructor() {
        super(TestScene.KEY);
    }

    /**
     * Génère les textures du spike (aucune image téléchargée). Appelé une
     * seule fois depuis preload() de main.js.
     */
    static genererTextures(scene) {
        const C = window.SchieweschlaweConfig;
        const g = scene.make.graphics({ add: false });

        // Disque de feu (64x64) : halo -> corps orange -> cœur jaune.
        g.fillStyle(C.couleurs.disque, 0.35);
        g.fillCircle(32, 32, 30);
        g.fillStyle(C.couleurs.disque, 1);
        g.fillCircle(32, 32, 20);
        g.fillStyle(C.couleurs.disqueCoeur, 1);
        g.fillCircle(32, 32, 12);
        g.fillStyle(C.couleurs.disqueClair, 1);
        g.fillCircle(32, 32, 6);
        g.generateTexture("disque", 64, 64);
        g.clear();

        // Point de traînée (32x32) : point chaud qui dessine la courbe.
        g.fillStyle(C.couleurs.trainee, 0.9);
        g.fillCircle(16, 16, 16);
        g.fillStyle(C.couleurs.disqueCoeur, 1);
        g.fillCircle(16, 16, 8);
        g.generateTexture("trainee", 32, 32);
        g.clear();

        // Braise (8x8) : particule d'ambiance qui rend le vent lisible.
        g.fillStyle(C.couleurs.braise, 1);
        g.fillCircle(4, 4, 4);
        g.generateTexture("braise", 8, 8);

        g.destroy();
    }

    create() {
        const C = window.SchieweschlaweConfig;

        // Vue du dessus : pas de gravité de monde sur le plan du sol (la
        // hauteur est simulée à part, par échelle).
        this.physics.world.gravity.y = 0;

        // États : placement → jauge → feedback → vol → atterri.
        this.etat = "placement";
        this.glisse = false;               // vrai pendant qu'on déplace le disque
        this.palierIndex = C.vent.palierInitial;
        this.directionIndex = C.vent.directionInitiale;
        this.terrainIndex = C.terrain.longueurIndexInitial;

        // Coordonnées 0-100 SANS NÉGATIF (les deux axes de la visée).
        this.posDistance = 50;             // 0 = sous la pierre, 100 = bas de l'écran
        this.posLateral = 50;              // 0 = gauche, 100 = droite, 50 = centre

        // Jauge (étape 2).
        this.jaugeTemps = 0;
        this.jaugeNeedle = 0.5;
        this.jaugeZoneCentre = 0.5;
        this.jaugeDeviation = 0;
        this.feedbackRestant = 0;

        this.trainee = [];
        this.traineeTimer = 0;
        this.marqueur = null;
        this.boutonRejouer = null;

        this._creerDecor();
        this._creerGrille();
        this._creerPierre();
        this._creerCible();
        this._creerDisqueEtOmbre();
        this._creerVisee();
        this._creerJauge();
        this._creerBraises();
        this._creerVent();
        this._creerBoutons();
        this._creerTextes();

        // Zone de saisie globale (clic/tap). Elle reçoit les interactions
        // qui ne tombent pas sur un bouton (les boutons sont au-dessus,
        // hit-test Phaser topOnly). Pendant le placement : glisser le disque
        // dans la zone de recul (sous la pierre). Pendant la jauge : reclic
        // pour arrêter l'aiguille.
        this.zoneGlobale = this.add.zone(0, 0, 10, 10)
            .setOrigin(0, 0).setInteractive();
        this.zoneGlobale.on("pointerdown", (p) => this._pointerDown(p));
        this.zoneGlobale.on("pointermove", (p) => {
            if (this.glisse && this.etat === "placement") this._poserDisque(p);
        });
        this.zoneGlobale.on("pointerup", () => { this.glisse = false; });
        this.zoneGlobale.on("pointerupoutside", () => { this.glisse = false; });

        // Mise en page immédiate + à chaque rotation / redimensionnement.
        Arcade.UI.layout(this, (w, h) => {
            this.w = w;
            this.h = h;
            this._recalculerGeometrie();
        });
    }

    update(time, delta) {
        const dt = delta / 1000;
        if (this.etat === "vol") {
            this._suivreVol(dt);
        } else if (this.etat === "jauge") {
            this._avancerJauge(dt);
        } else if (this.etat === "feedback") {
            this.feedbackRestant -= delta;
            if (this.feedbackRestant <= 0) this._lancer();
        }
        this._fonduTrainee(dt);
        this._animerBraises(dt);
    }

    // --- Création des éléments ------------------------------------------------

    _creerDecor() {
        const C = window.SchieweschlaweConfig;
        this.ciel = this.add.graphics().setDepth(0);
        this.sol = this.add.graphics().setDepth(1);
    }

    _creerGrille() {
        this.grilleG = this.add.graphics().setDepth(2);
    }

    _creerPierre() {
        this.pierreG = this.add.graphics().setDepth(4);
    }

    _creerCible() {
        this.cibleG = this.add.graphics().setDepth(4);
    }

    _creerDisqueEtOmbre() {
        const C = window.SchieweschlaweConfig;
        this.ombreDisque = this.add.circle(0, 0, 4, C.couleurs.ombreDisque, 0.35).setDepth(5);
        this.disque = this.physics.add.sprite(0, 0, "disque");
        this.disque.setDepth(6);
        this.disque.body.setAllowGravity(false);
    }

    _creerVisee() {
        this.viseeG = this.add.graphics().setDepth(9);
    }

    _creerJauge() {
        this.jaugeG = this.add.graphics().setDepth(22);
    }

    _creerBraises() {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;
        this.braises = [];
        const u1 = UI.u(this, 1);
        for (let i = 0; i < C.vent.braisesNombre; i++) {
            const b = this.add.image(0, 0, "braise").setDepth(8);
            this.braises.push({
                obj: b,
                x: Math.random(),
                y: Math.random(),
                vitesse: 0.5 + Math.random() * 0.7,
                baseVx: (Math.random() - 0.5) * 0.25 * u1,
                baseVy: (Math.random() - 0.5) * 0.25 * u1
            });
        }
        this._braisesPlacees = false;
    }

    _creerVent() {
        const C = window.SchieweschlaweConfig;
        this.ventG = this.add.graphics().setDepth(20);
        this.boutonVent = Arcade.UI.bouton(this, {
            label: "",
            couleur: C.couleurs.boutonVent,
            textColor: C.couleurs.texte,
            marqueurClic: true,
            onClick: () => { if (this.etat === "placement") this._cyclerVent(); }
        });
        this.boutonDirection = Arcade.UI.bouton(this, {
            label: "",
            couleur: C.couleurs.boutonVent,
            textColor: C.couleurs.texte,
            marqueurClic: true,
            onClick: () => { if (this.etat === "placement") this._cyclerDirection(); }
        });
        this.boutonTerrain = Arcade.UI.bouton(this, {
            label: "",
            couleur: C.couleurs.boutonVent,
            textColor: C.couleurs.texte,
            marqueurClic: true,
            onClick: () => { if (this.etat === "placement") this._cyclerTerrain(); }
        });
    }

    _creerBoutons() {
        const C = window.SchieweschlaweConfig;
        // Bouton vert « Tirer » : lance la jauge (placement) ou arrête
        // l'aiguille (reclic pendant la jauge).
        this.boutonTirer = Arcade.UI.bouton(this, {
            label: C.textes.tirer,
            couleur: C.couleurs.bouton,
            textColor: C.couleurs.texte,
            marqueurClic: true,
            onClick: () => {
                if (this.etat === "placement") this._demarrerJauge();
                else if (this.etat === "jauge") this._arreterJauge();
            }
        });
    }

    _creerTextes() {
        const C = window.SchieweschlaweConfig;
        this.texteTitre = Arcade.UI.text(this, 0, 0, C.titre, 7, C.couleurs.texte).setDepth(21);
        this.texteSousTitre = Arcade.UI.text(this, 0, 0, C.textes.sousTitre, 3, C.couleurs.texte).setDepth(21);
        this.consigne1 = Arcade.UI.text(this, 0, 0, C.textes.consigneLigne1, 3.2, C.couleurs.texte).setDepth(21);
        this.consigne2 = Arcade.UI.text(this, 0, 0, C.textes.consigneLigne2, 3.2, C.couleurs.texte).setDepth(21);
        this.texteVisee = Arcade.UI.text(this, 0, 0, "", 3.4, C.couleurs.vent).setDepth(21);
        this.texteJauge = Arcade.UI.text(this, 0, 0, C.textes.arreter, 4, C.couleurs.texte)
            .setDepth(21).setVisible(false);
        this.texteResultat = Arcade.UI.text(this, 0, 0, "", 4.5, C.couleurs.ecart)
            .setDepth(21).setVisible(false);
        this.texteResultat2 = Arcade.UI.text(this, 0, 0, "", 3.2, C.couleurs.texte)
            .setDepth(21).setVisible(false);
        // Étiquettes des axes 0-100 (petites, pour rendre l'échelle lisible).
        this.axeDist0 = Arcade.UI.text(this, 0, 0, "0", 2.4, C.couleurs.texte).setDepth(21).setAlpha(0.7);
        this.axeDist100 = Arcade.UI.text(this, 0, 0, "100", 2.4, C.couleurs.texte).setDepth(21).setAlpha(0.7);
        this.axeLat0 = Arcade.UI.text(this, 0, 0, "0", 2.4, C.couleurs.texte).setDepth(21).setAlpha(0.7);
        this.axeLat50 = Arcade.UI.text(this, 0, 0, "50", 2.4, C.couleurs.texte).setDepth(21).setAlpha(0.7);
        this.axeLat100 = Arcade.UI.text(this, 0, 0, "100", 2.4, C.couleurs.texte).setDepth(21).setAlpha(0.7);
    }

    // --- Mise en page (appelée au resize) --------------------------------------

    _recalculerGeometrie() {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;
        const w = this.w, h = this.h;

        // Pierre + cible + terrain.
        this.pierreX = (C.lancer.pierreXPct / 100) * w;
        this.pierreY = (C.lancer.pierreYPct / 100) * h;
        this.terrainLongueurPx = (C.terrain.longueurPct / 100) * h;
        this.cibleX = (C.cible.lateralPct / 100) * w;
        this.cibleY = this.pierreY - (C.cible.distancePct / 100) * this.terrainLongueurPx;

        this.rayonCible = UI.u(this, C.cible.rayonPct);
        this.tailleDisque = UI.u(this, C.lancer.tailleDisquePct);
        this.graviteHauteur = C.lancer.graviteHauteurPar_s * h;

        // Bas d'écran divisé en 3 colonnes égales : réservée (gauche) /
        // zone de recul du disque (milieu) / bouton Tirer (droite).
        this.colLargeur = w / 3;

        // Accélération du vent (2 axes), dépend des dimensions de l'écran.
        this._majAccelVent();

        // Recalcule la position du disque et l'aperçu de visée à partir des
        // coordonnées 0-100 conservées (résiste à la rotation).
        this._majVisee();

        // Zone de saisie globale : tout l'écran.
        this.zoneGlobale.setPosition(0, 0);
        this.zoneGlobale.setSize(w, h);
        if (this.zoneGlobale.input && this.zoneGlobale.input.hitArea) {
            this.zoneGlobale.input.hitArea.setSize(w, h);
        }

        this._dessinerDecor();
        this._dessinerGrille();
        this._dessinerPierre();
        this._dessinerCible();
        this._dessinerVisee();
        this._positionnerBraises();
        this._dessinerVent();
        this._dessinerJaugeBarre();
        this._positionnerBoutons();
        this._positionnerTextes();

        if (this.etat === "placement") this._poserDisqueVisuel();
    }

    _dessinerDecor() {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;
        const w = this.w, h = this.h;
        const cCiel = Phaser.Display.Color.HexStringToColor(C.couleurs.ciel).color;
        const cChamp = Phaser.Display.Color.HexStringToColor(C.couleurs.champ).color;
        const cPad = Phaser.Display.Color.HexStringToColor(C.couleurs.lancePad).color;

        this.ciel.clear();
        this.ciel.fillStyle(cCiel, 1);
        this.ciel.fillRect(0, 0, w, h);

        // Champ (terrain, au-dessus de la pierre, inchangé — pleine largeur)
        // + bas d'écran divisé en 3 colonnes égales (réservée / disque / tirer).
        const w3 = this.colLargeur;
        const coulDiviseur = Phaser.Display.Color.HexStringToColor(C.couleurs.grilleLigne).color;

        this.sol.clear();
        this.sol.fillStyle(cChamp, 1);
        this.sol.fillRect(0, 0, w, this.pierreY);
        this.sol.fillStyle(cPad, 1);
        this.sol.fillRect(0, this.pierreY, w, h - this.pierreY);
        // Colonne du milieu (zone de recul du disque) mise en évidence.
        this.sol.fillStyle(cChamp, 0.35);
        this.sol.fillRect(w3, this.pierreY, w3, h - this.pierreY);
        // Lignes de séparation des 3 colonnes.
        this.sol.lineStyle(Math.max(1, UI.u(this, 0.15)), coulDiviseur, 0.8);
        this.sol.lineBetween(w3, this.pierreY, w3, h);
        this.sol.lineBetween(2 * w3, this.pierreY, 2 * w3, h);
    }

    _dessinerGrille() {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;
        const w = this.w;
        const coul = Phaser.Display.Color.HexStringToColor(C.couleurs.grilleLigne).color;

        this.grilleG.clear();
        this.grilleG.lineStyle(Math.max(1, UI.u(this, 0.15)), coul, 0.7);

        // Lignes horizontales (distance au sol) : du haut jusqu'à la pierre.
        const nbLignes = 6;
        for (let i = 0; i <= nbLignes; i++) {
            const y = (this.pierreY / nbLignes) * i;
            this.grilleG.lineBetween(0, y, w, y);
        }
        // Lignes verticales (décalage latéral).
        const nbColonnes = 6;
        for (let j = 0; j <= nbColonnes; j++) {
            const x = (w / nbColonnes) * j;
            this.grilleG.lineBetween(x, 0, x, this.pierreY);
        }
    }

    _dessinerPierre() {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;
        const x = this.pierreX, y = this.pierreY;
        const baseW = UI.u(this, 11);
        const baseH = UI.u(this, 4.5);
        const cP = Phaser.Display.Color.HexStringToColor(C.couleurs.pierre).color;
        const cB = Phaser.Display.Color.HexStringToColor(C.couleurs.pierreBord).color;

        this.pierreG.clear();
        this.pierreG.fillStyle(cP, 1);
        this.pierreG.fillRoundedRect(x - baseW / 2, y - baseH, baseW, baseH, baseH * 0.3);
        this.pierreG.fillStyle(cB, 1);
        this.pierreG.fillTriangle(x - baseW / 2, y, x + baseW / 2, y, x - baseW / 2, y - baseH);
    }

    _dessinerCible() {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;
        const x = this.cibleX, y = this.cibleY;
        const r = this.rayonCible;
        const coul = Phaser.Display.Color.HexStringToColor(C.couleurs.cible).color;
        const coulPlein = Phaser.Display.Color.HexStringToColor(C.couleurs.ciblePlein).color;

        this.cibleG.clear();
        this.cibleG.lineStyle(UI.u(this, 0.4), coul, 1);
        this.cibleG.strokeCircle(x, y, r);
        this.cibleG.fillStyle(coul, 0.25);
        this.cibleG.fillCircle(x, y, r);
        this.cibleG.lineStyle(UI.u(this, 0.3), coulPlein, 1);
        this.cibleG.strokeCircle(x, y, r * 0.4);
    }

    // --- Visée proportionnelle (cœur du spike v4) -----------------------------

    /**
     * Recalcule, à partir des coordonnées 0-100 (posDistance, posLateral),
     * la position du disque et le point visé (aperçu de tir).
     */
    _majVisee() {
        const w = this.w, h = this.h;

        // Position du disque dans la colonne du milieu des 3 colonnes du bas
        // d'écran (pas la pleine largeur).
        this.disqueX = this.colLargeur + (this.posLateral / 100) * this.colLargeur;
        this.disqueY = this.pierreY + (this.posDistance / 100) * (h - this.pierreY);

        // Miroir déduit de la position : latéral visé = 100 - latéral disque
        // (disque à gauche → tir à droite). Aucune coordonnée signée.
        const lateralVise = 100 - this.posLateral;

        // distance_du_tir = (position_disque / 100) × longueur_du_terrain.
        this.aimX = (lateralVise / 100) * w;
        this.aimY = this.pierreY - (this.posDistance / 100) * this.terrainLongueurPx;

        this.texteVisee.setText(
            window.SchieweschlaweConfig.textes.viseReadout
                .replace("{d}", Math.round(this.posDistance))
                .replace("{l}", Math.round(this.posLateral))
                .replace("{v}", Math.round(this.posDistance)));
    }

    _poserDisque(p) {
        const h = this.h;
        const w3 = this.colLargeur;
        // Le glisser est confiné à la colonne du milieu (0 = bord gauche de
        // la colonne, 100 = bord droit) — cliquer/glisser au-delà se clampe
        // au bord le plus proche, comme un curseur.
        this.posLateral = Phaser.Math.Clamp(((p.x - w3) / w3) * 100, 0, 100);
        this.posDistance = Phaser.Math.Clamp(
            ((p.y - this.pierreY) / (h - this.pierreY)) * 100, 0, 100);
        this._majVisee();
        this._poserDisqueVisuel();
        this._dessinerVisee();
    }

    _poserDisqueVisuel() {
        const UI = Arcade.UI;
        this.disque.setDisplaySize(this.tailleDisque, this.tailleDisque);
        this.disque.setPosition(this.disqueX, this.disqueY);
        this.disque.setAngle(0);
        this.disque.body.setVelocity(0, 0);
        this.disque.body.setAccelerationX(0);
        this.disque.body.setAccelerationY(0);
        this.disque.body.setAllowGravity(false);
        this.disque.body.updateFromGameObject();
        this.ombreDisque.setPosition(this.disqueX, this.disqueY);
        this.ombreDisque.setRadius(this.tailleDisque * 0.42);
        this.ombreDisque.setVisible(true);
    }

    _dessinerVisee() {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;
        const coul = Phaser.Display.Color.HexStringToColor(C.couleurs.visee).color;

        this.viseeG.clear();
        if (this.etat !== "placement") return;   // la visée ne s'affiche qu'au placement

        // Ligne de traction disque -> pierre (fine).
        this.viseeG.lineStyle(UI.u(this, 0.3), coul, 0.45);
        this.viseeG.lineBetween(this.disqueX, this.disqueY, this.pierreX, this.pierreY);

        // Aperçu du tir : flèche pierre -> point visé.
        const dx = this.aimX - this.pierreX;
        const dy = this.aimY - this.pierreY;
        const dist = Math.hypot(dx, dy);
        if (dist > 1) {
            const ux = dx / dist, uy = dy / dist;
            this.viseeG.lineStyle(UI.u(this, 0.6), coul, 0.9);
            this.viseeG.lineBetween(this.pierreX, this.pierreY, this.aimX, this.aimY);
            const t = UI.u(this, 2.2);
            const px = -uy, py = ux;
            this.viseeG.fillStyle(coul, 0.9);
            this.viseeG.fillTriangle(
                this.aimX + ux * t, this.aimY + uy * t,
                this.aimX + px * t * 0.55, this.aimY + py * t * 0.55,
                this.aimX - px * t * 0.55, this.aimY - py * t * 0.55
            );
        }

        // Marqueur du point visé (anneau).
        this.viseeG.lineStyle(UI.u(this, 0.45), coul, 0.8);
        this.viseeG.strokeCircle(this.aimX, this.aimY, UI.u(this, 2.2));

        // Marqueur du disque (croix + anneau).
        const r = UI.u(this, 2.6);
        this.viseeG.lineStyle(UI.u(this, 0.5), coul, 1);
        this.viseeG.strokeCircle(this.disqueX, this.disqueY, r);
        this.viseeG.lineBetween(this.disqueX - r - UI.u(this, 1.2), this.disqueY,
            this.disqueX + r + UI.u(this, 1.2), this.disqueY);
        this.viseeG.lineBetween(this.disqueX, this.disqueY - r - UI.u(this, 1.2),
            this.disqueX, this.disqueY + r + UI.u(this, 1.2));
    }

    // --- Jauge de précision (étape 2) -----------------------------------------

    _demarrerJauge() {
        if (this.etat !== "placement") return;
        this.etat = "jauge";
        this.jaugeTemps = 0;
        this.jaugeNeedle = 0.5;
        this.jaugeZoneCentre = 0.5;
        this.jaugeDeviation = 0;
        this.texteJauge.setVisible(true);
        this._cacherConsignes();
        this._dessinerVisee();          // efface la visée pendant la jauge
        this._positionnerTextes();
    }

    _avancerJauge(dt) {
        const C = window.SchieweschlaweConfig;
        this.jaugeTemps += dt;
        // Aiguille : balayage aller-retour (0..1).
        this.jaugeNeedle = 0.5 + 0.5 *
            Math.sin(2 * Math.PI * C.jauge.vitesseBalayagePar_s * this.jaugeTemps);
        // Zone orange : défile (centre qui oscille autour de 0.5).
        this.jaugeZoneCentre = 0.5 + 0.35 *
            Math.sin(2 * Math.PI * C.jauge.vitesseZoneOrangePar_s * this.jaugeTemps + 0.7);
        this._dessinerJaugeBarre();
    }

    _arreterJauge() {
        if (this.etat !== "jauge") return;
        const C = window.SchieweschlaweConfig;

        const demiOrange = C.jauge.zoneOrangeLargeurPct / 200;
        const d = Math.abs(this.jaugeNeedle - this.jaugeZoneCentre);
        if (d <= demiOrange) {
            this.jaugeDeviation = 0;                       // pile dans l'orange → conforme
        } else {
            // Manqué : déviation proportionnelle à l'écart, bornée [0,1].
            this.jaugeDeviation = Phaser.Math.Clamp(
                (d - demiOrange) / (1 - demiOrange), 0, 1);
        }

        this.etat = "feedback";
        this.feedbackRestant = C.jauge.delaiFeedbackMs;
        this.texteJauge.setText(
            this.jaugeDeviation === 0 ? C.textes.conforme : C.textes.manque);
        this._dessinerJaugeBarre();
    }

    _dessinerJaugeBarre() {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;
        const w = this.w, h = this.h;

        this.jaugeG.clear();
        if (this.etat !== "jauge" && this.etat !== "feedback") return;

        const largeur = (C.jauge.largeurPct / 100) * w;
        const hauteur = UI.u(this, C.jauge.hauteurU);
        const x = (w - largeur) / 2;
        const y = h * 0.45 - hauteur / 2;

        const cFond = Phaser.Display.Color.HexStringToColor(C.couleurs.jaugeFond).color;
        const cBarre = Phaser.Display.Color.HexStringToColor(C.couleurs.jaugeBarre).color;
        const cOrange = Phaser.Display.Color.HexStringToColor(C.couleurs.jaugeZoneOrange).color;
        const cAiguille = Phaser.Display.Color.HexStringToColor(C.couleurs.jaugeAiguille).color;

        // Fond sombre.
        this.jaugeG.fillStyle(cFond, 1);
        this.jaugeG.fillRoundedRect(x, y, largeur, hauteur, hauteur * 0.3);
        // Corps vert.
        this.jaugeG.fillStyle(cBarre, 0.35);
        this.jaugeG.fillRoundedRect(x, y, largeur, hauteur, hauteur * 0.3);

        // Zone orange (le bon endroit) qui défile.
        const oW = (C.jauge.zoneOrangeLargeurPct / 100) * largeur;
        const oC = x + this.jaugeZoneCentre * largeur;
        this.jaugeG.fillStyle(cOrange, 0.9);
        this.jaugeG.fillRoundedRect(oC - oW / 2, y, oW, hauteur, hauteur * 0.3);

        // Aiguille (indicateur mobile).
        const nX = x + this.jaugeNeedle * largeur;
        this.jaugeG.lineStyle(Math.max(1, UI.u(this, 0.4)), cAiguille, 1);
        this.jaugeG.lineBetween(nX, y - hauteur * 0.2, nX, y + hauteur * 1.2);
    }

    // --- Vent / terrain (boutons d'exploration) -------------------------------

    _cyclerVent() {
        const C = window.SchieweschlaweConfig;
        this.palierIndex = (this.palierIndex + 1) % C.vent.paliers.length;
        this._majAccelVent();
        this._dessinerVent();
    }

    _cyclerDirection() {
        const C = window.SchieweschlaweConfig;
        this.directionIndex = (this.directionIndex + 1) % C.vent.directions.length;
        this._majAccelVent();
        this._dessinerVent();
    }

    _cyclerTerrain() {
        const C = window.SchieweschlaweConfig;
        this.terrainIndex = (this.terrainIndex + 1) % C.terrain.longueursTest.length;
        C.terrain.longueurPct = C.terrain.longueursTest[this.terrainIndex];
        // Recalcule longueur + cible + visée sur la nouvelle longueur.
        this.terrainLongueurPx = (C.terrain.longueurPct / 100) * this.h;
        this.cibleY = this.pierreY - (C.cible.distancePct / 100) * this.terrainLongueurPx;
        this._majVisee();
        this._dessinerCible();
        this._dessinerVisee();
        this._dessinerVent();
        this._positionnerTextes();
    }

    _majAccelVent() {
        const C = window.SchieweschlaweConfig;
        const palier = C.vent.paliers[this.palierIndex];
        const dir = C.vent.directions[this.directionIndex];
        this.accelVentX = palier.valeur * dir.dx * this.w;
        this.accelVentY = palier.valeur * dir.dy * this.h;
    }

    _positionnerBraises() {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;
        const w = this.w, h = this.h;
        const taille = UI.u(this, C.vent.braiseTaillePct);

        this.braises.forEach((b) => {
            if (!this._braisesPlacees) {
                b.x = b.x * w;
                b.y = b.y * this.pierreY;
            } else {
                b.x = Phaser.Math.Clamp(b.x, -20, w + 20);
                b.y = Phaser.Math.Clamp(b.y, -20, h + 20);
            }
            b.obj.setPosition(b.x, b.y)
                .setDisplaySize(taille, taille)
                .setAlpha(0.4 + Math.random() * 0.4);
        });
        this._braisesPlacees = true;
    }

    _dessinerVent() {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;
        const w = this.w, h = this.h;
        const palier = C.vent.paliers[this.palierIndex];
        const dir = C.vent.directions[this.directionIndex];
        const maxValeur = C.vent.paliers[C.vent.paliers.length - 1].valeur;
        const ratio = Math.min(1, palier.valeur / maxValeur);
        const coul = Phaser.Display.Color.HexStringToColor(C.couleurs.vent).color;

        const cx = w * 0.5;
        const cy = h * 0.13;
        const demiAxe = UI.u(this, 8);

        this.ventG.clear();

        // Rose des vents : croix fixe (les 4 directions possibles).
        this.ventG.lineStyle(UI.u(this, 0.3), coul, 0.25);
        this.ventG.lineBetween(cx - demiAxe, cy, cx + demiAxe, cy);
        this.ventG.lineBetween(cx, cy - demiAxe, cx, cy + demiAxe);

        if (ratio > 0) {
            // Flèche directionnelle (longueur ∝ intensité), 4 directions.
            const longueur = demiAxe * (0.25 + ratio * 0.75);
            const tipX = cx + dir.dx * longueur;
            const tipY = cy + dir.dy * longueur;
            this.ventG.lineStyle(UI.u(this, 0.5), coul, 1);
            this.ventG.lineBetween(cx, cy, tipX, tipY);
            const t = UI.u(this, 2);
            const perpX = -dir.dy, perpY = dir.dx;
            this.ventG.fillStyle(coul, 1);
            this.ventG.fillTriangle(
                tipX + dir.dx * t, tipY + dir.dy * t,
                tipX + perpX * t * 0.6, tipY + perpY * t * 0.6,
                tipX - perpX * t * 0.6, tipY - perpY * t * 0.6
            );
        } else {
            this.ventG.fillStyle(coul, 1);
            this.ventG.fillCircle(cx, cy, UI.u(this, 1));
        }

        // Libellés des boutons (Vent / Dir. / Terrain).
        this.boutonVent.label.setText(
            C.textes.ventPrefixe + palier.nom + " (palier " + palier.palier + ")");
        this.boutonDirection.label.setText(C.textes.directionPrefixe + dir.nom);
        this.boutonTerrain.label.setText(
            C.textes.terrainPrefixe.replace("{p}", C.terrain.longueurPct));
    }

    _positionnerBoutons() {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;
        const w = this.w, h = this.h;
        const cx = w * 0.5;

        this.boutonVent.redimensionner(UI.u(this, 32), UI.u(this, 6))
            .setPosition(cx, h * 0.13 + UI.u(this, 8) + UI.u(this, 4));
        this.boutonDirection.redimensionner(UI.u(this, 22), UI.u(this, 6))
            .setPosition(cx, h * 0.13 + UI.u(this, 8) + UI.u(this, 11));
        this.boutonTerrain.redimensionner(UI.u(this, 24), UI.u(this, 6))
            .setPosition(cx, h * 0.13 + UI.u(this, 8) + UI.u(this, 18));

        // Bouton vert « Tirer » : colonne de droite des 3 colonnes du bas
        // d'écran (gauche = réservée, milieu = zone de recul du disque).
        const w3 = this.colLargeur;
        this.boutonTirer.redimensionner(w3 * 0.7, UI.u(this, 9))
            .setPosition(w - w3 / 2, this.pierreY + (h - this.pierreY) / 2);
    }

    _positionnerTextes() {
        const UI = Arcade.UI;
        const w = this.w, h = this.h;

        this.texteTitre.setPosition(w / 2, h * 0.035)
            .setFontSize(Math.round(UI.u(this, 7)) + "px");
        this.texteSousTitre.setPosition(w / 2, h * 0.035 + UI.u(this, 4))
            .setFontSize(Math.round(UI.u(this, 3)) + "px");

        if (this.consigne1.visible) {
            this.consigne1.setPosition(w * 0.5, h * 0.62)
                .setFontSize(Math.round(UI.u(this, 3.2)) + "px");
            this.consigne2.setPosition(w * 0.5, h * 0.62 + UI.u(this, 4.2))
                .setFontSize(Math.round(UI.u(this, 3.2)) + "px");
        }

        // Ligne de lecture de la visée (sous le titre, au-dessus du champ).
        if (this.texteVisee.visible) {
            this.texteVisee.setPosition(w / 2, h * 0.10)
                .setFontSize(Math.round(UI.u(this, 3.4)) + "px");
        }

        if (this.texteJauge.visible) {
            this.texteJauge.setPosition(w / 2, h * 0.45 - UI.u(this, 5))
                .setFontSize(Math.round(UI.u(this, 4)) + "px");
        }

        if (this.texteResultat.visible) {
            this.texteResultat.setPosition(w / 2, h * 0.40)
                .setFontSize(Math.round(UI.u(this, 4.5)) + "px");
            this.texteResultat2.setPosition(w / 2, h * 0.40 + UI.u(this, 5.2))
                .setFontSize(Math.round(UI.u(this, 3.2)) + "px");
        }

        if (this.boutonRejouer) {
            this.boutonRejouer.redimensionner(UI.u(this, 30), UI.u(this, 10))
                .setPosition(w / 2, h * 0.54);
        }

        // Étiquettes des axes 0-100.
        const fs = Math.round(UI.u(this, 2.4)) + "px";
        this.axeDist0.setPosition(this.pierreX - UI.u(this, 7), this.pierreY + UI.u(this, 1.5)).setFontSize(fs);
        this.axeDist100.setPosition(this.pierreX - UI.u(this, 7), h - UI.u(this, 1.5)).setFontSize(fs);
        this.axeLat0.setPosition(UI.u(this, 1.5), this.pierreY - UI.u(this, 1.5)).setFontSize(fs);
        this.axeLat50.setPosition(w / 2, this.pierreY - UI.u(this, 1.5)).setFontSize(fs);
        this.axeLat100.setPosition(w - UI.u(this, 3), this.pierreY - UI.u(this, 1.5)).setFontSize(fs);
    }

    // --- Interactions ----------------------------------------------------------

    _pointerDown(p) {
        if (this.etat === "placement") {
            // Glisser le disque uniquement dans la colonne du milieu de la
            // zone de recul (sous la pierre) — colonnes gauche (réservée) et
            // droite (bouton Tirer) ne déclenchent pas le glisser.
            const w3 = this.colLargeur;
            if (p.y > this.pierreY && p.x >= w3 && p.x <= 2 * w3) {
                this.glisse = true;
                this._poserDisque(p);
            }
        } else if (this.etat === "jauge") {
            this._arreterJauge();
        }
    }

    // --- Lancement / vol -------------------------------------------------------

    _lancer() {
        if (this.etat !== "feedback") return;
        const C = window.SchieweschlaweConfig;
        const w = this.w;

        // Déviation (arrêt raté) : ampleur calibrée dans config.js.
        const signD = Math.random() < 0.5 ? 1 : -1;
        const signL = Math.random() < 0.5 ? 1 : -1;
        const devDist = this.jaugeDeviation *
            (C.jauge.deviationDistanceMaxPct / 100) * this.terrainLongueurPx * signD;
        const devLat = this.jaugeDeviation *
            (C.jauge.deviationLateralMaxPct / 100) * w * signL;

        // Point d'atterrissage visé (avec déviation), puis vitesse de lancer
        // dérivée pour l'atteindre SANS vent (portée = 2·facteur·v0²/g).
        const ax = this.aimX + devLat;
        const ay = this.aimY - devDist;
        const dx = ax - this.pierreX;
        const dy = ay - this.pierreY;
        const dist = Math.hypot(dx, dy);
        const dirX = dist > 1 ? dx / dist : 0;
        const dirY = dist > 1 ? dy / dist : -1;
        const v0 = Math.sqrt(Math.max(dist, 1) * this.graviteHauteur /
            (2 * C.lancer.facteurHauteur));
        const vx = dirX * v0;
        const vy = dirY * v0;

        this.disque.body.setAllowGravity(false);
        this.disque.body.setAccelerationX(this.accelVentX);
        this.disque.body.setAccelerationY(this.accelVentY);
        this.disque.body.setVelocity(vx, vy);

        // Hauteur simulée (séparée de la position sol).
        this.z = 0;
        this.zVel = v0 * C.lancer.facteurHauteur;
        this.zMax = Math.max(1, (this.zVel * this.zVel) / (2 * this.graviteHauteur));

        this.etat = "vol";
        this.traineeTimer = 0;
        this.texteJauge.setVisible(false);
        this._dessinerVisee();   // efface la visée pendant le vol
    }

    _suivreVol(dt) {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;

        // Altitude simulée (parabole) → échelle du disque.
        this.zVel -= this.graviteHauteur * dt;
        this.z += this.zVel * dt;
        const zNorm = Phaser.Math.Clamp(this.z / this.zMax, 0, 1);
        const echelle = 1 + C.lancer.grossissementMax * zNorm;
        this.disque.setDisplaySize(this.tailleDisque * echelle, this.tailleDisque * echelle);

        // Ombre au sol : reste à la taille sol, suit la position X/Y réelle.
        this.ombreDisque.setPosition(this.disque.x, this.disque.y);
        this.ombreDisque.setRadius(this.tailleDisque * 0.42);

        // Traînée de feu (dessine la courbe au sol).
        this.traineeTimer += dt * 1000;
        if (this.traineeTimer >= C.lancer.traineeIntervalMs) {
            this.traineeTimer -= C.lancer.traineeIntervalMs;
            this._poserTrainee();
        }

        const sorti = this.disque.x < -60 || this.disque.x > this.w + 60 ||
            this.disque.y < -60 || this.disque.y > this.h + 60;
        if ((this.z <= 0 && this.zVel < 0) || sorti) {
            this._atterrir(sorti);
        }
    }

    _poserTrainee() {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;
        const t = this.add.image(this.disque.x, this.disque.y, "trainee").setDepth(7);
        const taille = UI.u(this, C.lancer.tailleDisquePct * 0.7);
        t.setDisplaySize(taille, taille);
        this.trainee.push({ obj: t, vie: 0.6 });
    }

    _fonduTrainee(dt) {
        for (let i = this.trainee.length - 1; i >= 0; i--) {
            const t = this.trainee[i];
            t.vie -= dt;
            if (t.vie <= 0) {
                t.obj.destroy();
                this.trainee.splice(i, 1);
            } else {
                t.obj.setAlpha(Math.max(0, t.vie / 0.6));
            }
        }
    }

    _animerBraises(dt) {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;
        const w = this.w, h = this.h;
        const palier = C.vent.paliers[this.palierIndex];
        const dir = C.vent.directions[this.directionIndex];
        const u1 = UI.u(this, 1);
        const vVent = (C.vent.braisesPar_u +
            palier.valeur * C.vent.braisesFacteurVent) * u1;

        this.braises.forEach((b) => {
            b.x += (dir.dx * vVent * b.vitesse + b.baseVx) * dt;
            b.y += (dir.dy * vVent * b.vitesse + b.baseVy) * dt;
            if (b.x > w + 20) b.x = -20;
            if (b.x < -20) b.x = w + 20;
            if (b.y > h + 20) b.y = -20;
            if (b.y < -20) b.y = h + 20;
            b.obj.setPosition(b.x, b.y);
        });
    }

    _atterrir(sorti) {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;

        this.etat = "atterri";
        this.disque.body.setVelocity(0, 0);
        this.disque.body.setAccelerationX(0);
        this.disque.body.setAccelerationY(0);
        this.disque.body.setAllowGravity(false);
        this.disque.setDisplaySize(this.tailleDisque, this.tailleDisque);

        const lx = this.disque.x;
        const ly = this.disque.y;

        // Marqueur d'atterrissage (borné à l'écran pour rester visible).
        const mx = Phaser.Math.Clamp(lx, 8, this.w - 8);
        const my = Phaser.Math.Clamp(ly, 8, this.h - 8);
        this.marqueur = this.add.graphics().setDepth(5);
        this.marqueur.lineStyle(UI.u(this, 0.4),
            Phaser.Display.Color.HexStringToColor(C.couleurs.ecart).color, 1);
        this.marqueur.strokeCircle(mx, my, UI.u(this, 2.5));

        let texte;
        if (sorti || lx < 0 || lx > this.w || ly < 0 || ly > this.h) {
            texte = C.textes.horsEcran;
        } else {
            const ecartPx = Math.hypot(lx - this.cibleX, ly - this.cibleY);
            const ecartPct = Math.round((ecartPx / Math.min(this.w, this.h)) * 100);
            if (ecartPx <= this.rayonCible * 0.4) {
                texte = C.textes.pleinCentre;
            } else if (ecartPx <= this.rayonCible) {
                texte = C.textes.touche;
            } else {
                texte = C.textes.rate + " — " +
                    C.textes.ecart.replace("{p}", ecartPct);
            }
        }
        this.texteResultat.setText(texte).setVisible(true);

        // Seconde ligne : position du tir en % du terrain (valide le mapping).
        const tirPct = this.terrainLongueurPx > 0
            ? Math.round(((this.pierreY - ly) / this.terrainLongueurPx) * 100)
            : 0;
        this.texteResultat2.setText(
            C.textes.tirResultat
                .replace("{t}", Math.max(0, tirPct))
                .replace("{v}", Math.round(this.posDistance)))
            .setVisible(true);

        if (!this.boutonRejouer) {
            this.boutonRejouer = Arcade.UI.bouton(this, {
                label: C.textes.rejouer,
                couleur: C.couleurs.bouton,
                textColor: C.couleurs.texte,
                onClick: () => this._reinitialiser()
            });
        }
        this._positionnerTextes();
    }

    _reinitialiser() {
        const C = window.SchieweschlaweConfig;
        this.etat = "placement";

        this.trainee.forEach((t) => t.obj.destroy());
        this.trainee = [];
        if (this.marqueur) {
            this.marqueur.destroy();
            this.marqueur = null;
        }
        if (this.boutonRejouer) {
            this.boutonRejouer.destroy();
            this.boutonRejouer = null;
        }
        this.texteResultat.setVisible(false).setText("");
        this.texteResultat2.setVisible(false).setText("");
        this.texteJauge.setVisible(false);

        // Le disque repart au centre de la zone de recul (50 / 50).
        this.posDistance = 50;
        this.posLateral = 50;
        this._majVisee();

        this._poserDisqueVisuel();
        this._dessinerVisee();
        this._montrerConsignes();
        this._positionnerTextes();
    }

    _cacherConsignes() {
        this.consigne1.setVisible(false);
        this.consigne2.setVisible(false);
    }

    _montrerConsignes() {
        this.consigne1.setVisible(true);
        this.consigne2.setVisible(true);
    }
}
