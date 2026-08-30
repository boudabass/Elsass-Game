/*
 * TestScene — scène de test UNIQUE du spike « collision boule/quilles » de
 * Quilles Saint-Gall (PRD 875 §3-6).
 *
 * Ce que cette scène valide :
 *   1. VUE DU DESSUS + 9 QUILLES en carré 3×3 (numérotées 1-9 comme dans le
 *      PRD, quille 5 = le Roi, plus grande).
 *   2. PHYSIQUE DE COLLISION boule/quilles (test de distance manuel, à
 *      chaque frame — plus simple et plus fiable qu'un corps Arcade
 *      circulaire ré-échelonné à chaque resize) : la boule roule en ligne
 *      droite, chaque quille touchée tombe et sort du jeu ; la boule
 *      continue sa route (elle peut toucher plusieurs quilles, comme en
 *      vrai).
 *   3. TIR EN 2 ÉTAPES RÉUTILISÉ de Schieweschlawe (873 §5), revu plusieurs
 *      fois le 30/08 (demandes John) : la boule se place n'importe où dans
 *      un DEMI-CERCLE (glisser libre 2D) dont le côté plat est collé à la
 *      ligne de lancer et fait toute la largeur de la piste ; la DIRECTION
 *      du tir vient de 2 BOUTONS ◄/► EN BAS de la zone de recul, sous le
 *      demi-cercle (jamais superposés — 1° par clic, max 10°) ; la FORCE
 *      vient de 2 BOUTONS -/+ EN HAUT de la colonne de droite (au-dessus de
 *      « Tirer », avec une barre de niveau) — plus haute = tir plus rapide
 *      MAIS zone orange de la jauge plus étroite. Puis jauge à aiguille
 *      mobile + zone orange fixe (dont la largeur dépend de la force) : la
 *      déviation d'un tir raté est un ANGLE qui s'ajoute à l'angle choisi.
 *
 * Volontairement HORS SCOPE de ce spike (à construire ensuite, PRD §6-8) :
 * les 6 phases et les 17 jets d'une vraie partie, le barème de points par
 * phase, les figures et les ordres de quilles imposés. Ici : un seul jet
 * « jeu plein » (les 9 quilles debout), rejouable à l'infini, qui compte
 * juste le nombre de quilles tombées — de quoi valider la physique et la
 * sensation de viser/tirer avant de complexifier.
 *
 * Contrôles (clic/tap uniquement) : glisser la boule dans le demi-cercle de
 * placement, boutons ◄/► (en bas) pour orienter la visée, boutons -/+ (en
 * haut à droite) pour la force, bouton vert « Tirer » pour lancer la
 * jauge, reclic pour arrêter l'aiguille.
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
        const C = window.QuillesSaintGallConfig;
        const g = scene.make.graphics({ add: false });

        // Quille (32x32, vue du dessus) : disque clair + contour + reflet.
        g.fillStyle(Phaser.Display.Color.HexStringToColor(C.couleurs.quilleContour).color, 1);
        g.fillCircle(16, 16, 15);
        g.fillStyle(Phaser.Display.Color.HexStringToColor(C.couleurs.quille).color, 1);
        g.fillCircle(16, 16, 12);
        g.fillStyle(0xffffff, 0.35);
        g.fillCircle(12, 12, 4);
        g.generateTexture("quille", 32, 32);
        g.clear();

        // Boule (48x48) : halo -> corps orange -> cœur clair.
        g.fillStyle(C.couleurs.boule, 0.3);
        g.fillCircle(24, 24, 23);
        g.fillStyle(C.couleurs.boule, 1);
        g.fillCircle(24, 24, 16);
        g.fillStyle(C.couleurs.bouleClair, 1);
        g.fillCircle(19, 19, 5);
        g.generateTexture("boule", 48, 48);

        g.destroy();
    }

    create() {
        const C = window.QuillesSaintGallConfig;

        // Vue du dessus : pas de gravité de monde.
        this.physics.world.gravity.y = 0;

        // États : placement → jauge → feedback → lancer → resultat.
        this.etat = "placement";
        this.glisse = false;
        // Position de la boule dans le cercle de placement, en fraction du
        // rayon (-1..1 sur chaque axe, résiste au resize/rotation d'écran —
        // même principe que les coordonnées 0-100 de Schieweschlawe).
        this.placementFracX = 0;
        this.placementFracY = 0.5;      // centrée dans la hauteur du demi-cercle
        // Angle de visée choisi via les boutons ◄/► (degrés, 0 = tout droit).
        this.aimAngleDeg = 0;
        // Force du tir, choisie via les boutons -/+ (0-100, cf. config
        // `force`) : plus haute = tir plus rapide MAIS zone orange de la
        // jauge plus étroite (plus difficile).
        this.force = C.force.defaut;
        // Largeur réelle de la zone orange pour LE TIR EN COURS, figée au
        // moment où la jauge démarre (interpolée depuis la force) — cf.
        // _demarrerJauge / _dessinerJaugeBarre / _arreterJauge.
        this.jaugeZoneOrangeLargeurPctActuelle = C.jauge.zoneOrangeLargeurMaxPct;

        this.jaugeTemps = 0;
        this.jaugeNeedle = 0.5;
        this.jaugeZoneCentre = 0.5;
        this.jaugeDeviation = 0;
        this.feedbackRestant = 0;

        this.quillesTombeesCount = 0;
        this.roiTombe = false;
        this.boutonRejouer = null;

        this._creerDecor();
        this._creerQuilles();
        this._creerBouleEtOmbre();
        this._creerVisee();
        this._creerJauge();
        this._creerBouton();
        this._creerBoutonsRotation();
        this._creerBarreForce();
        this._creerBoutonsForce();
        this._creerTextes();
        this._majTexteCompteur();

        // Zone de saisie globale (clic/tap).
        this.zoneGlobale = this.add.zone(0, 0, 10, 10)
            .setOrigin(0, 0).setInteractive();
        this.zoneGlobale.on("pointerdown", (p) => this._pointerDown(p));
        this.zoneGlobale.on("pointermove", (p) => {
            if (this.glisse && this.etat === "placement") this._poserBoule(p);
        });
        this.zoneGlobale.on("pointerup", () => { this.glisse = false; });
        this.zoneGlobale.on("pointerupoutside", () => { this.glisse = false; });

        Arcade.UI.layout(this, (w, h) => {
            this.w = w;
            this.h = h;
            this._recalculerGeometrie();
        });
    }

    update(time, delta) {
        const dt = delta / 1000;
        if (this.etat === "jauge") {
            this._avancerJauge(dt);
        } else if (this.etat === "feedback") {
            this.feedbackRestant -= delta;
            if (this.feedbackRestant <= 0) this._lancer();
        } else if (this.etat === "lancer") {
            this._suivreBoule(dt);
        }
        // Les quilles envoyées en mouvement par un choc continuent de
        // glisser (et de ralentir) même une fois le jet terminé.
        this._glisserQuillesTombees(dt);
    }

    // --- Création des éléments ------------------------------------------------

    _creerDecor() {
        this.ciel = this.add.graphics().setDepth(0);
        this.sol = this.add.graphics().setDepth(1);
    }

    _creerQuilles() {
        this.quilles = [];
        for (let i = 0; i < 9; i++) {
            const q = this.add.sprite(0, 0, "quille").setDepth(4);
            q.setData("index", i);
            q.setData("roi", i === 4);
            q.setData("debout", true);
            q.setData("rayon", 0);
            q.setData("vx", 0);
            q.setData("vy", 0);
            this.quilles.push(q);
        }
    }

    _creerBouleEtOmbre() {
        const C = window.QuillesSaintGallConfig;
        this.ombreBoule = this.add.circle(0, 0, 4, C.couleurs.ombreBoule, 0.35).setDepth(5);
        this.boule = this.physics.add.sprite(0, 0, "boule");
        this.boule.setDepth(6);
        this.boule.body.setAllowGravity(false);
    }

    _creerVisee() {
        this.viseeG = this.add.graphics().setDepth(3);
    }

    _creerJauge() {
        this.jaugeG = this.add.graphics().setDepth(22);
    }

    _creerBouton() {
        const C = window.QuillesSaintGallConfig;
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

    _creerBoutonsRotation() {
        const C = window.QuillesSaintGallConfig;
        this.boutonRotGauche = Arcade.UI.bouton(this, {
            label: "◄",
            couleur: C.couleurs.boutonRotation,
            textColor: C.couleurs.texte,
            marqueurClic: true,
            onClick: () => this._pivoterVisee(-1)
        });
        this.boutonRotDroite = Arcade.UI.bouton(this, {
            label: "►",
            couleur: C.couleurs.boutonRotation,
            textColor: C.couleurs.texte,
            marqueurClic: true,
            onClick: () => this._pivoterVisee(1)
        });
    }

    _creerBarreForce() {
        this.forceBarG = this.add.graphics().setDepth(21);
    }

    _creerBoutonsForce() {
        const C = window.QuillesSaintGallConfig;
        this.boutonForceMoins = Arcade.UI.bouton(this, {
            label: "-",
            couleur: C.couleurs.force,
            textColor: C.couleurs.texte,
            marqueurClic: true,
            onClick: () => this._ajusterForce(-1)
        });
        this.boutonForcePlus = Arcade.UI.bouton(this, {
            label: "+",
            couleur: C.couleurs.force,
            textColor: C.couleurs.texte,
            marqueurClic: true,
            onClick: () => this._ajusterForce(1)
        });
    }

    _creerTextes() {
        const C = window.QuillesSaintGallConfig;
        this.texteTitre = Arcade.UI.text(this, 0, 0, C.titre, 7, C.couleurs.texte).setDepth(21);
        this.texteSousTitre = Arcade.UI.text(this, 0, 0, C.textes.sousTitre, 3, C.couleurs.texte).setDepth(21);
        this.consigne1 = Arcade.UI.text(this, 0, 0, C.textes.consigneLigne1, 3.2, C.couleurs.texte).setDepth(21);
        this.consigne2 = Arcade.UI.text(this, 0, 0, C.textes.consigneLigne2, 3.2, C.couleurs.texte).setDepth(21);
        this.texteJauge = Arcade.UI.text(this, 0, 0, C.textes.arreter, 4, C.couleurs.texte)
            .setDepth(21).setVisible(false);
        this.texteCompteur = Arcade.UI.text(this, 0, 0, "", 3.2, C.couleurs.texte).setDepth(21);
        this.texteForce = Arcade.UI.text(this, 0, 0, C.textes.force, 2.8, C.couleurs.texte).setDepth(21);
        this.texteResultat = Arcade.UI.text(this, 0, 0, "", 4.5, C.couleurs.resultat)
            .setDepth(21).setVisible(false);
    }

    // --- Mise en page (appelée au resize) --------------------------------------

    _recalculerGeometrie() {
        const C = window.QuillesSaintGallConfig;
        const UI = Arcade.UI;
        const w = this.w, h = this.h;

        this.ligneLancerY = (C.piste.ligneLancerYPct / 100) * h;
        this.colLargeur = w / 3;

        this._calculerGeometrieCercle();
        this._positionnerQuilles();
        this._majVisee();

        this.zoneGlobale.setPosition(0, 0);
        this.zoneGlobale.setSize(w, h);
        if (this.zoneGlobale.input && this.zoneGlobale.input.hitArea) {
            this.zoneGlobale.input.hitArea.setSize(w, h);
        }

        this._dessinerDecor();
        this._dessinerVisee();
        this._dessinerJaugeBarre();
        this._positionnerBouton();
        this._positionnerBoutonsRotation();
        this._positionnerControlesForce();
        this._positionnerTextes();

        if (this.etat === "placement") this._poserBouleVisuel();
    }

    _dessinerDecor() {
        const C = window.QuillesSaintGallConfig;
        const UI = Arcade.UI;
        const w = this.w, h = this.h;
        const cCiel = Phaser.Display.Color.HexStringToColor(C.couleurs.ciel).color;
        const cPiste = Phaser.Display.Color.HexStringToColor(C.couleurs.piste).color;
        const cBord = Phaser.Display.Color.HexStringToColor(C.couleurs.pisteBord).color;
        const cRecul = Phaser.Display.Color.HexStringToColor(C.couleurs.recul).color;

        this.ciel.clear();
        this.ciel.fillStyle(cCiel, 1);
        this.ciel.fillRect(0, 0, w, h);

        // Piste (brune, visible) : UNIQUEMENT la colonne du milieu (seule
        // zone atteignable par la boule), du haut de l'écran (fosse) à la
        // ligne de lancer — pas toute la largeur de l'écran, pour qu'elle
        // se distingue clairement du reste (demande John, 30/08).
        const w3 = this.colLargeur;
        this.sol.clear();
        this.sol.fillStyle(cPiste, 1);
        this.sol.fillRect(w3, 0, w3, this.ligneLancerY);
        this.sol.lineStyle(Math.max(1, UI.u(this, 0.25)), cBord, 0.9);
        this.sol.strokeRect(w3, 0, w3, this.ligneLancerY);

        // Zone de recul (bas d'écran, 3 colonnes) : colonne du milieu mise
        // en évidence, même teinte que la piste (continuité visuelle).
        this.sol.fillStyle(cRecul, 1);
        this.sol.fillRect(0, this.ligneLancerY, w, h - this.ligneLancerY);
        this.sol.fillStyle(cPiste, 0.35);
        this.sol.fillRect(w3, this.ligneLancerY, w3, h - this.ligneLancerY);
        this.sol.lineStyle(Math.max(1, UI.u(this, 0.15)), cBord, 0.8);
        this.sol.lineBetween(w3, this.ligneLancerY, w3, h);
        this.sol.lineBetween(2 * w3, this.ligneLancerY, 2 * w3, h);
    }

    // --- Cercle de placement (zone de recul) ------------------------------------

    /**
     * Demi-cercle dans lequel la boule peut se placer (demande John,
     * 30/08) : le côté plat est collé à la ligne de lancer et fait TOUTE la
     * largeur de la piste (diamètre = this.colLargeur), la courbe descend
     * dans la zone de recul. Rayon plafonné à une fraction de la hauteur de
     * la zone de recul (`demiCercleRayonMaxFacteurHauteur`) pour TOUJOURS
     * laisser de la place aux boutons ◄/► en bas.
     */
    _calculerGeometrieCercle() {
        const C = window.QuillesSaintGallConfig;
        const w = this.w, h = this.h;
        const hauteurZone = h - this.ligneLancerY;
        const rayonMaxHauteur = hauteurZone * C.recul.demiCercleRayonMaxFacteurHauteur;
        this.cercleRayon = Math.min(this.colLargeur / 2, rayonMaxHauteur);
        this.cercleX = w / 2;
        this.cercleY = this.ligneLancerY;   // côté plat = ligne de lancer
    }

    _pivoterVisee(sens) {
        if (this.etat !== "placement") return;
        const C = window.QuillesSaintGallConfig;
        this.aimAngleDeg = Phaser.Math.Clamp(
            this.aimAngleDeg + sens * C.recul.rotationStepDeg,
            -C.recul.rotationMaxDeg, C.recul.rotationMaxDeg);
        this._dessinerVisee();
    }

    _ajusterForce(sens) {
        if (this.etat !== "placement") return;
        const C = window.QuillesSaintGallConfig;
        this.force = Phaser.Math.Clamp(
            this.force + sens * C.force.step, C.force.min, C.force.max);
        this._dessinerBarreForce();
    }

    _dessinerBarreForce() {
        const C = window.QuillesSaintGallConfig;
        const cFond = Phaser.Display.Color.HexStringToColor(C.couleurs.jaugeFond).color;
        const cBarre = Phaser.Display.Color.HexStringToColor(C.couleurs.force).color;

        this.forceBarG.clear();
        if (this.forceBarLargeur === undefined) return;   // pas encore de géométrie

        const x = this.forceBarX, y = this.forceBarY;
        const largeur = this.forceBarLargeur, hauteur = this.forceBarHauteur;
        this.forceBarG.fillStyle(cFond, 1);
        this.forceBarG.fillRoundedRect(x, y, largeur, hauteur, hauteur * 0.3);

        const t = (this.force - C.force.min) / (C.force.max - C.force.min);
        this.forceBarG.fillStyle(cBarre, 1);
        this.forceBarG.fillRoundedRect(x, y, largeur * t, hauteur, hauteur * 0.3);
    }

    _positionnerBoutonsRotation() {
        const UI = Arcade.UI;
        const w = this.w, h = this.h;
        const w3 = this.colLargeur;
        const marge = UI.u(this, 1.5);

        // En bas de la zone de recul, SOUS le demi-cercle (jamais dessus —
        // demande John, 30/08 : les boutons flottaient par-dessus le cercle
        // avant, ils doivent être intégrés à la mise en page, pas superposés).
        // Un bouton occupe chaque moitié (gauche/droite) de la colonne,
        // sur toute la hauteur restante sous le demi-cercle.
        // Espace sous le demi-cercle : TOUJOURS ≥ 40% de la hauteur de la
        // zone de recul, garanti par le plafond de rayon dans
        // _calculerGeometrieCercle (demiCercleRayonMaxFacteurHauteur=0.6).
        const basDemiCercle = this.ligneLancerY + this.cercleRayon;
        const yCentre = (basDemiCercle + h) / 2;
        const hauteurDispo = h - basDemiCercle - marge;
        const largeurBtn = w3 / 2 - marge * 1.5;

        this.boutonRotGauche.redimensionner(largeurBtn, hauteurDispo)
            .setPosition(w3 + marge + largeurBtn / 2, yCentre);
        this.boutonRotDroite.redimensionner(largeurBtn, hauteurDispo)
            .setPosition(2 * w3 - marge - largeurBtn / 2, yCentre);
    }

    /**
     * Libellé « Force » + barre + boutons -/+ : colonne de DROITE,
     * AU-DESSUS du bouton « Tirer » (demande John, 30/08, précisée 2 fois :
     * Tirer en bas de la colonne pour laisser la place ; un vrai espace
     * entre la barre et les boutons, pas collés). Utilise `this.tirerTop`,
     * calculé par `_positionnerBouton()` — DOIT être appelée avant.
     *
     * Empilement en fractions de l'espace disponible (haut → bas), avec un
     * espace explicite (16%) entre la barre et les boutons :
     * libellé 0-14% / barre 16-32% / ESPACE 32-48% / boutons 48-92%.
     */
    _positionnerControlesForce() {
        const UI = Arcade.UI;
        const w = this.w;
        const w3 = this.colLargeur;
        const marge = UI.u(this, 1.5);
        const xCentre = w - w3 / 2;

        const espaceHaut = Math.max(0, this.tirerTop - this.ligneLancerY);

        // Libellé « Force ».
        this.texteForce.setPosition(xCentre, this.ligneLancerY + espaceHaut * 0.07)
            .setFontSize(Math.round(UI.u(this, 2.8)) + "px");

        // Barre.
        this.forceBarLargeur = w3 * 0.7;
        this.forceBarHauteur = espaceHaut * 0.16;
        this.forceBarX = xCentre - this.forceBarLargeur / 2;
        this.forceBarY = this.ligneLancerY + espaceHaut * 0.16;

        // Boutons -/+ : après un espace explicite sous la barre (32-48%).
        const largeurBtn = w3 * 0.32;
        const hauteurBtn = espaceHaut * 0.44;
        const yBtn = this.ligneLancerY + espaceHaut * (0.48 + 0.44 / 2);
        this.boutonForceMoins.redimensionner(largeurBtn, hauteurBtn)
            .setPosition(xCentre - largeurBtn / 2 - marge / 2, yBtn);
        this.boutonForcePlus.redimensionner(largeurBtn, hauteurBtn)
            .setPosition(xCentre + largeurBtn / 2 + marge / 2, yBtn);

        this._dessinerBarreForce();
    }

    // --- Quilles ---------------------------------------------------------------

    _positionnerQuilles() {
        const C = window.QuillesSaintGallConfig;
        const UI = Arcade.UI;
        const w = this.w, h = this.h;
        // Largeur des 3 colonnes de quilles = largeur de la piste
        // (this.colLargeur, 1/3 de l'écran), moins une marge de chaque côté
        // (quillesMargeLateralePct, demande John 30/08) pour laisser de
        // l'espace visible entre les quilles et le bord de la piste.
        const margeFacteur = C.piste.quillesMargeLateralePct / 100;
        const zoneLargeurPx = this.colLargeur * (1 - 2 * margeFacteur);
        const centreX = w / 2;
        const rangeesYPct = [
            C.piste.quillesZoneHautYPct,
            (C.piste.quillesZoneHautYPct + C.piste.quillesZoneBasYPct) / 2,
            C.piste.quillesZoneBasYPct
        ];

        this.rayonQuille = UI.u(this, C.quille.rayonPct);
        this.rayonRoi = UI.u(this, C.quille.rayonRoiPct);

        this.quilles.forEach((q, i) => {
            const row = Math.floor(i / 3);
            const col = i % 3;
            const x = centreX + (col - 1) * (zoneLargeurPx / 2);
            const y = (rangeesYPct[row] / 100) * h;
            const rayonVisuel = q.getData("roi") ? this.rayonRoi : this.rayonQuille;

            q.setPosition(x, y);
            q.setDisplaySize(rayonVisuel * 2, rayonVisuel * 2);
            // Rayon de collision (test manuel, cf. _suivreBoule) : dérivé du
            // rayon visuel réel affiché à l'écran, pas d'un corps Arcade.
            q.setData("rayon", rayonVisuel * C.quille.rayonCollisionFacteur);

            this._appliquerEtatQuille(q);
        });
    }

    _appliquerEtatQuille(q) {
        const C = window.QuillesSaintGallConfig;
        const debout = q.getData("debout");
        const roi = q.getData("roi");
        q.setAlpha(debout ? 1 : 0.45);
        q.setTint(debout
            ? (roi ? Phaser.Display.Color.HexStringToColor(C.couleurs.quilleRoi).color : 0xffffff)
            : Phaser.Display.Color.HexStringToColor(C.couleurs.quilleTombee).color);
    }

    _toucherQuille(quille) {
        if (!quille.getData("debout")) return;
        quille.setData("debout", false);
        this._appliquerEtatQuille(quille);
        this.quillesTombeesCount++;
        if (quille.getData("roi")) this.roiTombe = true;
        this._majTexteCompteur();

        // Petite chute visuelle (rotation + tassement).
        this.tweens.add({
            targets: quille,
            angle: 90,
            scaleY: 0.5,
            duration: 220,
            ease: "Quad.easeOut"
        });
    }

    _majTexteCompteur() {
        const C = window.QuillesSaintGallConfig;
        let t = C.textes.quillesTombees.replace("{n}", this.quillesTombeesCount);
        if (this.roiTombe) t += C.textes.roiTombe;
        this.texteCompteur.setText(t);
    }

    // --- Visée (placement dans le cercle + rotation par boutons) -------------

    _majVisee() {
        if (this.cercleRayon === undefined) return;   // pas encore de géométrie
        this.bouleX = this.cercleX + this.placementFracX * this.cercleRayon;
        this.bouleY = this.cercleY + this.placementFracY * this.cercleRayon;
    }

    _poserBoule(p) {
        // Glisser libre en 2D, clampé au DEMI-cercle de placement : jamais
        // au-dessus de la ligne de lancer (dy < 0 interdit — le côté plat
        // du demi-cercle), et jamais au-delà du rayon (glisser au-delà
        // colle au bord, comme un curseur).
        const dx = p.x - this.cercleX;
        const dy = Math.max(0, p.y - this.cercleY);
        const dist = Math.hypot(dx, dy);
        if (dist <= this.cercleRayon) {
            this.placementFracX = dx / this.cercleRayon;
            this.placementFracY = dy / this.cercleRayon;
        } else if (dist > 0) {
            this.placementFracX = dx / dist;
            this.placementFracY = dy / dist;
        }
        this._majVisee();
        this._poserBouleVisuel();
        this._dessinerVisee();
    }

    _poserBouleVisuel() {
        const UI = Arcade.UI;
        const C = window.QuillesSaintGallConfig;
        const rayon = UI.u(this, C.boule.rayonPct);
        this.boule.setDisplaySize(rayon * 2, rayon * 2);
        this.boule.setPosition(this.bouleX, this.bouleY);
        this.boule.body.setVelocity(0, 0);
        this.boule.body.updateFromGameObject();
        this.ombreBoule.setPosition(this.bouleX, this.bouleY);
        this.ombreBoule.setRadius(rayon * 0.42);
        this.ombreBoule.setVisible(true);
    }

    _dessinerVisee() {
        const C = window.QuillesSaintGallConfig;
        const UI = Arcade.UI;
        const coulCercle = Phaser.Display.Color.HexStringToColor(C.couleurs.cercle).color;
        const coul = Phaser.Display.Color.HexStringToColor(C.couleurs.trajectoire).color;

        this.viseeG.clear();
        if (this.etat !== "placement") return;

        // Demi-cercle de placement (zone où la boule peut être posée) :
        // seulement l'arc du BAS (0 → PI, sens horaire = vers le bas en
        // coordonnées écran), le côté plat coïncide avec la ligne de lancer
        // déjà dessinée par la piste (pas besoin de la retracer).
        this.viseeG.lineStyle(UI.u(this, 0.4), coulCercle, 0.5);
        this.viseeG.beginPath();
        this.viseeG.arc(this.cercleX, this.cercleY, this.cercleRayon, 0, Math.PI, false);
        this.viseeG.strokePath();

        // Ligne de visée : direction choisie via les boutons ◄/►, depuis la
        // position actuelle de la boule (angle 0 = tout droit vers le haut).
        const angleRad = Phaser.Math.DegToRad(this.aimAngleDeg);
        const dirX = Math.sin(angleRad), dirY = -Math.cos(angleRad);
        const longueur = this.bouleY;
        this.viseeG.lineStyle(UI.u(this, 0.5), coul, 0.9);
        this.viseeG.lineBetween(this.bouleX, this.bouleY,
            this.bouleX + dirX * longueur, this.bouleY + dirY * longueur);
        this.viseeG.strokeCircle(this.bouleX, this.bouleY, UI.u(this, 3));
    }

    // --- Jauge de précision (étape 2) -----------------------------------------

    _demarrerJauge() {
        if (this.etat !== "placement") return;
        const C = window.QuillesSaintGallConfig;
        this.etat = "jauge";
        this.jaugeTemps = 0;
        this.jaugeNeedle = 0.5;

        // Largeur de la zone orange pour CE tir, interpolée depuis la force
        // choisie (demande John, 30/08 : plus la force est haute, plus le
        // tir peut être dévié — la zone orange se réduit). Figée ici, ne
        // change plus pendant la jauge même si on pouvait toucher -/+.
        const t = (this.force - C.force.min) / (C.force.max - C.force.min);
        this.jaugeZoneOrangeLargeurPctActuelle = C.jauge.zoneOrangeLargeurMaxPct +
            t * (C.jauge.zoneOrangeLargeurMinPct - C.jauge.zoneOrangeLargeurMaxPct);

        const demiOrange = this.jaugeZoneOrangeLargeurPctActuelle / 200;
        this.jaugeZoneCentre = demiOrange + Math.random() * (1 - 2 * demiOrange);
        this.jaugeDeviation = 0;
        this.texteJauge.setVisible(true);
        this._cacherConsignes();
        this._dessinerVisee();
        this._positionnerTextes();
    }

    _avancerJauge(dt) {
        const C = window.QuillesSaintGallConfig;
        this.jaugeTemps += dt;
        this.jaugeNeedle = 0.5 + 0.5 *
            Math.sin(2 * Math.PI * C.jauge.vitesseBalayagePar_s * this.jaugeTemps);
        this._dessinerJaugeBarre();
    }

    _arreterJauge() {
        if (this.etat !== "jauge") return;
        const C = window.QuillesSaintGallConfig;

        const demiOrange = this.jaugeZoneOrangeLargeurPctActuelle / 200;
        const d = Math.abs(this.jaugeNeedle - this.jaugeZoneCentre);
        if (d <= demiOrange) {
            this.jaugeDeviation = 0;
        } else {
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
        const C = window.QuillesSaintGallConfig;
        const UI = Arcade.UI;
        const w = this.w;

        this.jaugeG.clear();
        if (this.etat !== "jauge" && this.etat !== "feedback") return;

        const largeur = (C.jauge.largeurPct / 100) * w;
        const hauteur = UI.u(this, C.jauge.hauteurU);
        const x = (w - largeur) / 2;
        const y = this.ligneLancerY - hauteur - UI.u(this, 2);

        const cFond = Phaser.Display.Color.HexStringToColor(C.couleurs.jaugeFond).color;
        const cBarre = Phaser.Display.Color.HexStringToColor(C.couleurs.jaugeBarre).color;
        const cOrange = Phaser.Display.Color.HexStringToColor(C.couleurs.jaugeZoneOrange).color;
        const cAiguille = Phaser.Display.Color.HexStringToColor(C.couleurs.jaugeAiguille).color;

        this.jaugeG.fillStyle(cFond, 1);
        this.jaugeG.fillRoundedRect(x, y, largeur, hauteur, hauteur * 0.3);
        this.jaugeG.fillStyle(cBarre, 0.35);
        this.jaugeG.fillRoundedRect(x, y, largeur, hauteur, hauteur * 0.3);

        const oW = (this.jaugeZoneOrangeLargeurPctActuelle / 100) * largeur;
        const oC = x + this.jaugeZoneCentre * largeur;
        this.jaugeG.fillStyle(cOrange, 0.9);
        this.jaugeG.fillRoundedRect(oC - oW / 2, y, oW, hauteur, hauteur * 0.3);

        const nX = x + this.jaugeNeedle * largeur;
        this.jaugeG.lineStyle(Math.max(1, UI.u(this, 0.4)), cAiguille, 1);
        this.jaugeG.lineBetween(nX, y - hauteur * 0.2, nX, y + hauteur * 1.2);
    }

    // --- Interactions ------------------------------------------------------------

    _pointerDown(p) {
        if (this.etat === "placement") {
            // Le glisser ne démarre que si le clic tombe DANS le demi-cercle
            // de placement (jamais au-dessus de la ligne de lancer) — les
            // boutons ◄/► et « Tirer » sont ailleurs, hors de cette zone.
            const dx = p.x - this.cercleX;
            const dy = p.y - this.cercleY;
            if (dy >= 0 && Math.hypot(dx, dy) <= this.cercleRayon) {
                this.glisse = true;
                this._poserBoule(p);
            }
        } else if (this.etat === "jauge") {
            this._arreterJauge();
        }
    }

    // --- Lancement / roulement --------------------------------------------------

    _lancer() {
        if (this.etat !== "feedback") return;
        const C = window.QuillesSaintGallConfig;
        const h = this.h;

        // Angle total = angle choisi via les boutons ◄/► + déviation en cas
        // d'arrêt raté sur la jauge (par rapport à CET angle, pas au tout
        // droit).
        const signe = Math.random() < 0.5 ? 1 : -1;
        const deviationDeg = this.jaugeDeviation * C.jauge.deviationAngleMaxDeg * signe;
        const angleRad = Phaser.Math.DegToRad(this.aimAngleDeg + deviationDeg);

        // Vitesse = vitesse de base × un facteur qui dépend de la force
        // choisie (demande John, 30/08 : 2 boutons -/+ pour régler la force
        // du tir, colonne de droite au-dessus de « Tirer »).
        const t = (this.force - C.force.min) / (C.force.max - C.force.min);
        const facteurForce = C.boule.forceVitesseMinFacteur +
            t * (C.boule.forceVitesseMaxFacteur - C.boule.forceVitesseMinFacteur);
        const vitesse = (C.boule.vitessePctH_par_s / 100) * h * facteurForce;
        const vx = Math.sin(angleRad) * vitesse;
        const vy = -Math.cos(angleRad) * vitesse;

        this.boule.body.setVelocity(vx, vy);
        this.boule.setData("dejaTouche", false);

        this.etat = "lancer";
        this.texteJauge.setVisible(false);
        this._dessinerVisee();
    }

    _suivreBoule(dt) {
        const C = window.QuillesSaintGallConfig;
        this.ombreBoule.setPosition(this.boule.x, this.boule.y);

        // Collision boule/quilles : test de distance manuel (cf. commentaire
        // de classe) contre chaque quille encore debout. Si le choc est
        // trop faible (vitesseMinRenversePct), la quille agit comme un mur
        // (rebond quasi complet, elle reste debout). Sinon elle tombe ET
        // reçoit une partie de la quantité de mouvement de la boule
        // (demande John, 30/08) : cf. _reagirCollision.
        const rBoule = this.boule.displayWidth / 2;
        const seuilRenverse = (C.boule.vitesseMinRenversePct / 100) * this.h;
        const vitesseMax = this._vitesseMaxLancer();
        this.quilles.forEach((q) => {
            if (!q.getData("debout")) return;
            const rQ = q.getData("rayon");
            const dx = this.boule.x - q.x;
            const dy = this.boule.y - q.y;
            const rSomme = rBoule + rQ;
            const distSq = dx * dx + dy * dy;
            if (distSq <= rSomme * rSomme) {
                const v0 = this.boule.body.velocity;
                const vitesseImpact = Math.hypot(v0.x, v0.y);
                const renverse = vitesseImpact >= seuilRenverse;
                if (renverse) this._toucherQuille(q);
                this._reagirCollision(q, dx, dy, Math.sqrt(distSq), rSomme,
                    renverse, vitesseImpact, vitesseMax, seuilRenverse);
            }
        });

        // Ralentissement continu une fois que la boule a touché au moins
        // une quille (demande John, 30/08 : sinon une boule qui continue
        // tout droit après un choc ne ralentit plus jamais toute seule).
        if (this.boule.getData("dejaTouche")) {
            const amorti = Math.max(0, 1 - C.boule.frictionApresChocPar_s * dt);
            const vf = this.boule.body.velocity;
            this.boule.body.setVelocity(vf.x * amorti, vf.y * amorti);
        }

        // Sortie de piste : la fosse en haut, OU les bords RÉELS de la
        // piste (this.colLargeur de large, pas toute la largeur de l'écran)
        // — le vrai jeu interdit à la boule de toucher les côtés de la
        // piste avant les quilles (article 780), on modélise ça comme fin
        // du jet, cohérent avec les rebonds qui peuvent maintenant la
        // dévier latéralement.
        const w3 = this.colLargeur;
        const dehors = this.boule.y < -20 || this.boule.x < w3 - 20 || this.boule.x > 2 * w3 + 20;

        // Filet de sécurité : après plusieurs rebonds amortis, la boule
        // peut devenir trop lente pour jamais sortir de la zone de quilles
        // — on l'arrête plutôt que de la laisser trembler indéfiniment.
        const v = this.boule.body.velocity;
        const tropLente = Math.hypot(v.x, v.y) < (C.boule.vitesseArretPct / 100) * this.h;
        if (dehors || tropLente) this._arreterBoule();
    }

    _vitesseMaxLancer() {
        const C = window.QuillesSaintGallConfig;
        return (C.boule.vitessePctH_par_s / 100) * this.h * C.boule.forceVitesseMaxFacteur;
    }

    /**
     * Réaction de la boule (et de la quille, si elle tombe) au contact.
     * Repousse d'abord la boule hors du chevauchement (évite qu'elle
     * reste "collée" et déclenche le contact en boucle). Marque la boule
     * comme "déjà touchée" (cf. `_suivreBoule`, ralentissement continu).
     *
     * Si la quille NE tombe PAS (choc trop faible) : elle agit comme un
     * mur, la boule rebondit presque intégralement (réflexion sur la
     * normale de contact, formule standard v' = v - 2(v·n)n, amortie par
     * `boule.amortissementRebond`).
     *
     * Si la quille TOMBE : la boule NE REBONDIT JAMAIS vers l'arrière
     * (demande John, 30/08, précisée une 2e fois : « si je tape une quille
     * de face, elle doit pouvoir continuer ») — elle continue TOUJOURS dans
     * sa direction initiale, à une fraction de sa vitesse d'impact qui
     * monte avec cette vitesse d'impact (`transfertFacteurMin` juste au
     * seuil de renversement → `transfertFacteurMax` à la vitesse de lancer
     * max). La quille encaisse la même fraction et glisse dans cette même
     * direction (pas juste écartée sur la normale de contact).
     *
     * @param quille  la quille touchée (reçoit une vitesse si `renverse`)
     * @param dx,dy   vecteur quille → boule (PAS encore normalisé)
     * @param dist    longueur de ce vecteur
     * @param rSomme  rayon boule + rayon quille (distance de contact)
     * @param renverse  la quille tombe-t-elle sur ce choc ?
     * @param vitesseImpact  vitesse de la boule au moment du contact
     * @param vitesseMax     vitesse de lancer maximale (force à 100%)
     * @param seuilRenverse  vitesse minimale pour renverser une quille
     */
    _reagirCollision(quille, dx, dy, dist, rSomme, renverse, vitesseImpact, vitesseMax, seuilRenverse) {
        const C = window.QuillesSaintGallConfig;
        const nx = dist > 0.001 ? dx / dist : 0;
        const ny = dist > 0.001 ? dy / dist : -1;

        const chevauchement = rSomme - dist;
        if (chevauchement > 0) {
            this.boule.x += nx * chevauchement;
            this.boule.y += ny * chevauchement;
            this.boule.body.updateFromGameObject();
        }

        this.boule.setData("dejaTouche", true);
        const v = this.boule.body.velocity;

        if (!renverse) {
            // Modèle "mur" : la quille ne bouge pas, la boule rebondit
            // presque intégralement (réflexion sur la normale de contact).
            const vN = v.x * nx + v.y * ny;
            let vx = v.x, vy = v.y;
            if (vN < 0) {   // la boule allait bien VERS la quille
                vx = v.x - 2 * vN * nx;
                vy = v.y - 2 * vN * ny;
            }
            this.boule.body.setVelocity(vx * C.boule.amortissementRebond, vy * C.boule.amortissementRebond);
            return;
        }

        // La quille tombe : la boule continue TOUJOURS vers l'avant (jamais
        // en arrière). t=0 juste au seuil de renversement (fraction min),
        // t=1 à la vitesse de lancer maximale (fraction max).
        const plage = Math.max(1, vitesseMax - seuilRenverse);
        const t = Phaser.Math.Clamp((vitesseImpact - seuilRenverse) / plage, 0, 1);
        const fraction = C.boule.transfertFacteurMin +
            t * (C.boule.transfertFacteurMax - C.boule.transfertFacteurMin);

        const dirX = v.x / vitesseImpact, dirY = v.y / vitesseImpact;
        const vitesseTransfert = vitesseImpact * fraction;

        this.boule.body.setVelocity(dirX * vitesseTransfert, dirY * vitesseTransfert);

        // La quille encaisse la même fraction et glisse dans cette même
        // direction.
        quille.setData("vx", dirX * vitesseTransfert);
        quille.setData("vy", dirY * vitesseTransfert);
    }

    /**
     * Fait glisser (et ralentir) les quilles renversées auxquelles une
     * vitesse a été donnée par _reagirCollision — appelé à chaque frame
     * depuis update(), indépendamment de l'état du jet.
     */
    _glisserQuillesTombees(dt) {
        const C = window.QuillesSaintGallConfig;
        const amorti = Math.max(0, 1 - C.quille.frictionGlissementPar_s * dt);
        this.quilles.forEach((q) => {
            const vx = q.getData("vx") || 0;
            const vy = q.getData("vy") || 0;
            if (vx === 0 && vy === 0) return;
            q.x += vx * dt;
            q.y += vy * dt;
            let nvx = vx * amorti, nvy = vy * amorti;
            if (Math.hypot(nvx, nvy) < 2) { nvx = 0; nvy = 0; }
            q.setData("vx", nvx);
            q.setData("vy", nvy);
        });
    }

    _arreterBoule() {
        const C = window.QuillesSaintGallConfig;
        this.etat = "resultat";
        this.boule.body.setVelocity(0, 0);
        this.ombreBoule.setVisible(false);

        const texte = this.quillesTombeesCount === 0
            ? C.textes.aucune
            : C.textes.quillesTombees.replace("{n}", this.quillesTombeesCount) +
              (this.roiTombe ? C.textes.roiTombe : "");
        this.texteResultat.setText(texte).setVisible(true);

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
        const C = window.QuillesSaintGallConfig;
        this.etat = "placement";
        this.force = C.force.defaut;
        this._dessinerBarreForce();

        // Remet chaque quille debout puis recalcule taille/position via
        // _positionnerQuilles() (ne PAS faire setScale(1,1) ici : la taille
        // affichée est un % d'écran, pas la taille native de la texture).
        this.quilles.forEach((q) => {
            q.setData("debout", true);
            q.setData("vx", 0);
            q.setData("vy", 0);
            q.setAngle(0);
        });
        this._positionnerQuilles();
        this.quillesTombeesCount = 0;
        this.roiTombe = false;
        this._majTexteCompteur();

        if (this.boutonRejouer) {
            this.boutonRejouer.destroy();
            this.boutonRejouer = null;
        }
        this.texteResultat.setVisible(false).setText("");
        this.texteJauge.setVisible(false);

        this.placementFracX = 0;
        this.placementFracY = 0.5;      // centrée dans la hauteur du demi-cercle
        this.aimAngleDeg = 0;
        this._majVisee();
        this._poserBouleVisuel();
        this._dessinerVisee();
        this._montrerConsignes();
        this._positionnerTextes();
    }

    // --- Mise en page des textes / boutons ---------------------------------------

    /**
     * En bas de la colonne de droite (même principe que les boutons ◄/►
     * de la colonne du milieu, cf. `_positionnerBoutonsRotation`) — demande
     * John, 30/08 : Tirer restait centré et empiétait sur l'espace des
     * contrôles de force. Calcule `this.tirerTop`, utilisé par
     * `_positionnerControlesForce()` (DOIT être appelée après celle-ci).
     */
    _positionnerBouton() {
        const UI = Arcade.UI;
        const w = this.w, h = this.h;
        const w3 = this.colLargeur;
        const marge = UI.u(this, 1.5);
        const hauteurZone = h - this.ligneLancerY;

        const hauteurBtn = hauteurZone * 0.38;
        this.tirerTop = h - marge - hauteurBtn;
        const yCentre = this.tirerTop + hauteurBtn / 2;

        this.boutonTirer.redimensionner(w3 * 0.7, hauteurBtn)
            .setPosition(w - w3 / 2, yCentre);
    }

    _positionnerTextes() {
        const C = window.QuillesSaintGallConfig;
        const UI = Arcade.UI;
        const w = this.w, h = this.h;
        const w3 = this.colLargeur;

        this.texteTitre.setPosition(w / 2, h * 0.035)
            .setFontSize(Math.round(UI.u(this, 7)) + "px");
        this.texteSousTitre.setPosition(w / 2, h * 0.035 + UI.u(this, 4))
            .setFontSize(Math.round(UI.u(this, 3)) + "px");

        // Colonne de gauche : compteur de quilles debout/tombées en direct.
        this.texteCompteur.setPosition(w3 / 2, this.ligneLancerY + (h - this.ligneLancerY) * 0.5)
            .setFontSize(Math.round(UI.u(this, 3.2)) + "px")
            .setWordWrapWidth(w3 * 0.85, true);

        if (this.consigne1.visible) {
            this.consigne1.setPosition(w * 0.5, h * 0.55)
                .setFontSize(Math.round(UI.u(this, 3.2)) + "px");
            this.consigne2.setPosition(w * 0.5, h * 0.55 + UI.u(this, 4.2))
                .setFontSize(Math.round(UI.u(this, 3.2)) + "px");
        }

        if (this.texteJauge.visible) {
            this.texteJauge.setPosition(w / 2,
                this.ligneLancerY - UI.u(this, C.jauge.hauteurU) - UI.u(this, 7))
                .setFontSize(Math.round(UI.u(this, 4)) + "px");
        }

        if (this.texteResultat.visible) {
            this.texteResultat.setPosition(w / 2, h * 0.44)
                .setFontSize(Math.round(UI.u(this, 4.5)) + "px")
                .setWordWrapWidth(w * 0.8, true);
        }

        if (this.boutonRejouer) {
            this.boutonRejouer.redimensionner(UI.u(this, 30), UI.u(this, 10))
                .setPosition(w / 2, h * 0.56);
        }
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
