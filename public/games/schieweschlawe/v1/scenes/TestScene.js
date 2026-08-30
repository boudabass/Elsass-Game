/*
 * TestScene — scène de test UNIQUE du spike v2 « vue du dessus + visée
 * 3 points » de Schieweschlawe.
 *
 * Ce que cette scène valide (PRD article 873 §3-6) :
 *   1. VUE DU DESSUS + grille à 2 axes : gauche-droite = décalage latéral,
 *      haut-bas = distance au sol (haut = loin, bas = proche). Pierre de
 *      lancement fixe en bas, cible posée sur la grille.
 *   2. VISÉE À 3 POINTS alignés (pointeur / pierre-pivot / cible, façon
 *      billard-lance-pierre) : le pointeur part juste sous la pierre,
 *      l'éloigner vers le bas augmente la distance, le déplacer à droite
 *      envoie le disque à gauche (miroir par rapport à la pierre).
 *   3. HAUTEUR SIMULÉE PAR ÉCHELLE : le disque grossit à l'écran en montant,
 *      rétrécit en retombant ; la position sol (X/Y réelle) suit séparément
 *      une trajectoire à vitesse initiale + accélération de vent (2 axes).
 *   4. VENT 4 DIRECTIONS (vecteur 2D) : généralisation du spike v1 avec
 *      setAccelerationY en plus de setAccelerationX, flèche 4 directions.
 *
 * Contrôles (clic/tap uniquement) : glisser le pointeur pour viser, puis
 * toucher la jauge « Tirer » à droite. Boutons « Vent » (intensité) et
 * « Dir. » (direction) pour explorer les 5 paliers × 4 directions.
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

        this.etat = "repos";              // repos | vol | atterri
        this.glisse = false;              // vrai pendant qu'on tire le pointeur
        this.palierIndex = C.vent.palierInitial;
        this.directionIndex = C.vent.directionInitiale;
        this.trainee = [];
        this.traineeTimer = 0;
        this.marqueur = null;
        this.boutonRejouer = null;
        this.pointer = { x: 0, y: 0 };
        this.pull = { x: 0, y: 0 };
        this._pullInitialise = false;

        this._creerDecor();
        this._creerGrille();
        this._creerPierre();
        this._creerCible();
        this._creerDisqueEtOmbre();
        this._creerVisee();
        this._creerBraises();
        this._creerVent();
        this._creerJauge();
        this._creerTextes();

        // Zone de visée : la partie basse de l'écran (sous la pierre), où
        // l'on tire le pointeur. Interactive → ne gêne pas les boutons
        // (rendus au-dessus, hit-test Phaser topOnly).
        this.zoneVisee = this.add.zone(0, 0, 10, 10).setOrigin(0, 0).setInteractive();
        this.zoneVisee.on("pointerdown", (p) => this._debuterGlisser(p));
        this.zoneVisee.on("pointermove", (p) => { if (this.glisse) this._glisser(p); });
        this.zoneVisee.on("pointerup", () => { this.glisse = false; });
        this.zoneVisee.on("pointerupoutside", () => { this.glisse = false; });

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
        // Bouton « Vent » (intensité) et « Dir. » (direction) : ils font
        // défiler les paliers / les 4 directions. marqueurClic : un appui
        // dessus ne compte pas comme une visée.
        this.boutonVent = Arcade.UI.bouton(this, {
            label: "",
            couleur: C.couleurs.boutonVent,
            textColor: C.couleurs.texte,
            marqueurClic: true,
            onClick: () => this._cyclerVent()
        });
        this.boutonDirection = Arcade.UI.bouton(this, {
            label: "",
            couleur: C.couleurs.boutonVent,
            textColor: C.couleurs.texte,
            marqueurClic: true,
            onClick: () => this._cyclerDirection()
        });
    }

    _creerJauge() {
        const C = window.SchieweschlaweConfig;
        // Jauge « Tirer » à droite de l'écran : le déclencheur du tir.
        // (Hypothèse §5 du PRD : déclencheur seul — voir rapport 713.)
        this.boutonTirer = Arcade.UI.bouton(this, {
            label: C.textes.tirer,
            couleur: C.couleurs.bouton,
            textColor: C.couleurs.texte,
            marqueurClic: true,
            onClick: () => this._tirer()
        });
    }

    _creerTextes() {
        const C = window.SchieweschlaweConfig;
        this.texteTitre = Arcade.UI.text(this, 0, 0, C.titre, 7, C.couleurs.texte).setDepth(21);
        this.texteSousTitre = Arcade.UI.text(this, 0, 0, C.textes.sousTitre, 3, C.couleurs.texte).setDepth(21);
        this.consigne1 = Arcade.UI.text(this, 0, 0, C.textes.consigneLigne1, 3.5, C.couleurs.texte).setDepth(21);
        this.consigne2 = Arcade.UI.text(this, 0, 0, C.textes.consigneLigne2, 3.5, C.couleurs.texte).setDepth(21);
        this.texteResultat = Arcade.UI.text(this, 0, 0, "", 4.5, C.couleurs.ecart)
            .setDepth(21).setVisible(false);
    }

    // --- Mise en page (appelée au resize) --------------------------------------

    _recalculerGeometrie() {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;
        const w = this.w, h = this.h;

        this.pierreX = (C.lancer.pierreXPct / 100) * w;
        this.pierreY = (C.lancer.pierreYPct / 100) * h;
        this.cibleX = (C.lancer.cibleXPct / 100) * w;
        this.cibleY = (C.lancer.cibleYPct / 100) * h;

        this.rayonPull = UI.u(this, C.lancer.rayonPullPct);
        this.rayonCible = UI.u(this, C.lancer.rayonCiblePct);
        this.tailleDisque = UI.u(this, C.lancer.tailleDisquePct);
        this.vitesseMax = C.lancer.vitesseMaxPar_s * h;
        this.vMin = this.vitesseMax * C.lancer.vitesseMinRatio;
        this.graviteHauteur = C.lancer.graviteHauteurPar_s * h;

        // Accélération du vent (2 axes), dépend des dimensions de l'écran.
        const palier = C.vent.paliers[this.palierIndex];
        const dir = C.vent.directions[this.directionIndex];
        this.accelVentX = palier.valeur * dir.dx * w;
        this.accelVentY = palier.valeur * dir.dy * h;

        // Pointeur de visée : on conserve le vecteur de traction (relatif à la
        // pierre) et on recalcule sa position absolue. Au premier layout, le
        // pointeur part juste sous la pierre.
        if (!this._pullInitialise) {
            this.pull = { x: 0, y: this.rayonPull * 0.2 };
            this._pullInitialise = true;
        } else {
            const mag = Math.hypot(this.pull.x, this.pull.y);
            if (mag > this.rayonPull && mag > 0) {
                this.pull.x = (this.pull.x / mag) * this.rayonPull;
                this.pull.y = (this.pull.y / mag) * this.rayonPull;
            }
        }
        this.pointer = { x: this.pierreX + this.pull.x, y: this.pierreY + this.pull.y };

        // Zone de visée : la bande sous la pierre.
        this.zoneVisee.setPosition(0, this.pierreY);
        this.zoneVisee.setSize(w, h - this.pierreY);
        if (this.zoneVisee.input && this.zoneVisee.input.hitArea) {
            this.zoneVisee.input.hitArea.setSize(w, h - this.pierreY);
        }

        this._dessinerDecor();
        this._dessinerGrille();
        this._dessinerPierre();
        this._dessinerCible();
        this._dessinerVisee();
        this._positionnerBraises();
        this._dessinerVent();
        this._dessinerJauge();
        this._positionnerTextes();

        if (this.etat === "repos") {
            this._poserDisqueAuPierre();
        }
    }

    _dessinerDecor() {
        const C = window.SchieweschlaweConfig;
        const w = this.w, h = this.h;
        const cCiel = Phaser.Display.Color.HexStringToColor(C.couleurs.ciel).color;
        const cChamp = Phaser.Display.Color.HexStringToColor(C.couleurs.champ).color;
        const cPad = Phaser.Display.Color.HexStringToColor(C.couleurs.lancePad).color;

        this.ciel.clear();
        this.ciel.fillStyle(cCiel, 1);
        this.ciel.fillRect(0, 0, w, h);

        // Champ (zone de vol, au-dessus de la pierre) + zone de tir en bas.
        this.sol.clear();
        this.sol.fillStyle(cChamp, 1);
        this.sol.fillRect(0, 0, w, this.pierreY);
        this.sol.fillStyle(cPad, 1);
        this.sol.fillRect(0, this.pierreY, w, h - this.pierreY);
    }

    _dessinerGrille() {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;
        const w = this.w;
        const coul = Phaser.Display.Color.HexStringToColor(C.couleurs.grilleLigne).color;

        this.grilleG.clear();
        this.grilleG.lineStyle(Math.max(1, UI.u(this, 0.15)), coul, 0.7);

        // Lignes horizontales (distance au sol) : du haut jusqu'à la pierre.
        for (let i = 0; i <= C.lancer.grilleLignes; i++) {
            const y = (this.pierreY / C.lancer.grilleLignes) * i;
            this.grilleG.lineBetween(0, y, w, y);
        }
        // Lignes verticales (décalage latéral).
        for (let j = 0; j <= C.lancer.grilleColonnes; j++) {
            const x = (w / C.lancer.grilleColonnes) * j;
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

    _dessinerVisee() {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;
        const coul = Phaser.Display.Color.HexStringToColor(C.couleurs.ligneVisee).color;

        this.viseeG.clear();
        if (this.etat !== "repos") return;   // la visée ne s'affiche qu'au repos

        const p = this.pointer;
        // Ligne de traction pointeur -> pierre.
        this.viseeG.lineStyle(UI.u(this, 0.35), coul, 0.6);
        this.viseeG.lineBetween(p.x, p.y, this.pierreX, this.pierreY);

        // Aperçu du tir (miroir par rapport à la pierre) : ligne + flèche.
        const pullMag = Math.hypot(this.pull.x, this.pull.y);
        if (pullMag > 1) {
            const dirX = -this.pull.x / pullMag;
            const dirY = -this.pull.y / pullMag;
            const ratio = Phaser.Math.Clamp(pullMag / this.rayonPull, 0, 1);
            const vitesse = this.vMin + (this.vitesseMax - this.vMin) * ratio;
            const preview = vitesse * 0.4;    // ~0,4 s de vol en aperçu
            const ex = this.pierreX + dirX * preview;
            const ey = this.pierreY + dirY * preview;

            this.viseeG.lineStyle(UI.u(this, 0.6), coul, 0.9);
            this.viseeG.lineBetween(this.pierreX, this.pierreY, ex, ey);
            const t = UI.u(this, 2.2);
            const perpX = -dirY, perpY = dirX;
            this.viseeG.fillStyle(coul, 0.9);
            this.viseeG.fillTriangle(
                ex + dirX * t, ey + dirY * t,
                ex + perpX * t * 0.55, ey + perpY * t * 0.55,
                ex - perpX * t * 0.55, ey - perpY * t * 0.55
            );
        }

        // Marqueur du pointeur (croix + anneau).
        const r = UI.u(this, 2.6);
        this.viseeG.lineStyle(UI.u(this, 0.5), coul, 1);
        this.viseeG.strokeCircle(p.x, p.y, r);
        this.viseeG.lineBetween(p.x - r - UI.u(this, 1.2), p.y, p.x + r + UI.u(this, 1.2), p.y);
        this.viseeG.lineBetween(p.x, p.y - r - UI.u(this, 1.2), p.x, p.y + r + UI.u(this, 1.2));
        this.viseeG.fillStyle(coul, 1);
        this.viseeG.fillCircle(p.x, p.y, UI.u(this, 0.9));
    }

    _positionnerBraises() {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;
        const w = this.w, h = this.h;
        const taille = UI.u(this, C.vent.braiseTaillePct);

        this.braises.forEach((b) => {
            if (!this._braisesPlacees) {
                // 1er passage : fractions → positions réelles (champ, au-dessus
                // de la pierre, où le vent se lit avant le tir).
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
        const cy = h * 0.15;
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

        // Libellés des boutons.
        this.boutonVent.label.setText(
            C.textes.ventPrefixe + palier.nom + " (palier " + palier.palier + ")");
        this.boutonVent.redimensionner(UI.u(this, 32), UI.u(this, 6.5))
            .setPosition(cx, cy + demiAxe + UI.u(this, 5));

        this.boutonDirection.label.setText(C.textes.directionPrefixe + dir.nom);
        this.boutonDirection.redimensionner(UI.u(this, 22), UI.u(this, 6.5))
            .setPosition(cx, cy + demiAxe + UI.u(this, 12.5));
    }

    _dessinerJauge() {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;
        const w = this.w, h = this.h;
        // Jauge-trigger à droite : largeur en % de la largeur réelle (règle
        // jauge), hauteur en u().
        const jaugeW = w * 0.13;
        const jaugeH = UI.u(this, 24);
        this.boutonTirer.redimensionner(jaugeW, jaugeH)
            .setPosition(w - jaugeW / 2 - UI.u(this, 2), h * 0.52);
    }

    _positionnerTextes() {
        const UI = Arcade.UI;
        const w = this.w, h = this.h;

        this.texteTitre.setPosition(w / 2, h * 0.035)
            .setFontSize(Math.round(UI.u(this, 7)) + "px");
        this.texteSousTitre.setPosition(w / 2, h * 0.035 + UI.u(this, 4))
            .setFontSize(Math.round(UI.u(this, 3)) + "px");

        if (this.consigne1.visible) {
            // À gauche du champ, à l'écart de la trajectoire (pierre→cible).
            this.consigne1.setPosition(w * 0.20, h * 0.44)
                .setFontSize(Math.round(UI.u(this, 3.5)) + "px");
            this.consigne2.setPosition(w * 0.20, h * 0.44 + UI.u(this, 4.5))
                .setFontSize(Math.round(UI.u(this, 3.5)) + "px");
        }

        if (this.texteResultat.visible) {
            this.texteResultat.setPosition(w / 2, h * 0.40)
                .setFontSize(Math.round(UI.u(this, 4.5)) + "px");
        }

        if (this.boutonRejouer) {
            this.boutonRejouer.redimensionner(UI.u(this, 30), UI.u(this, 10))
                .setPosition(w / 2, h * 0.54);
        }
    }

    // --- Interactions ----------------------------------------------------------

    _debuterGlisser(p) {
        if (this.etat !== "repos") return;
        this.glisse = true;
        this._glisser(p);
    }

    _glisser(p) {
        if (this.etat !== "repos") return;
        // Pointeur borné : sous la pierre (jamais au-dessus) et dans le rayon
        // de traction max. La direction du tir est le miroir du vecteur
        // pierre → pointeur.
        let px = Phaser.Math.Clamp(p.x, 0, this.w);
        let py = Math.max(this.pierreY, p.y);
        let dx = px - this.pierreX;
        let dy = py - this.pierreY;
        const mag = Math.hypot(dx, dy);
        if (mag > this.rayonPull && mag > 0) {
            dx = (dx / mag) * this.rayonPull;
            dy = (dy / mag) * this.rayonPull;
        }
        this.pointer = { x: this.pierreX + dx, y: this.pierreY + dy };
        this.pull = { x: dx, y: dy };
        this._dessinerVisee();
    }

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

    _majAccelVent() {
        const C = window.SchieweschlaweConfig;
        const palier = C.vent.paliers[this.palierIndex];
        const dir = C.vent.directions[this.directionIndex];
        this.accelVentX = palier.valeur * dir.dx * this.w;
        this.accelVentY = palier.valeur * dir.dy * this.h;
    }

    _tirer() {
        if (this.etat !== "repos") return;
        const C = window.SchieweschlaweConfig;

        const pullMag = Math.hypot(this.pull.x, this.pull.y);
        let dirX = 0, dirY = -1;
        if (pullMag > 1) {
            dirX = -this.pull.x / pullMag;
            dirY = -this.pull.y / pullMag;
        }
        const ratio = Phaser.Math.Clamp(pullMag / this.rayonPull, 0, 1);
        const vitesse = this.vMin + (this.vitesseMax - this.vMin) * ratio;
        const vx = dirX * vitesse;
        const vy = dirY * vitesse;

        this.disque.body.setAllowGravity(false);
        this.disque.body.setAccelerationX(this.accelVentX);
        this.disque.body.setAccelerationY(this.accelVentY);
        this.disque.body.setVelocity(vx, vy);

        // Hauteur simulée (séparée de la position sol).
        this.z = 0;
        this.zVel = vitesse * C.lancer.facteurHauteur;
        this.zMax = Math.max(1, (this.zVel * this.zVel) / (2 * this.graviteHauteur));

        this.etat = "vol";
        this.traineeTimer = 0;
        this._cacherConsignes();
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
            const distPct = Math.round((Math.hypot(lx - this.pierreX, ly - this.pierreY) / this.h) * 100);
            if (ecartPx <= this.rayonCible * 0.4) {
                texte = C.textes.pleinCentre;
            } else if (ecartPx <= this.rayonCible) {
                texte = C.textes.touche;
            } else {
                texte = C.textes.rate + " — " +
                    C.textes.distance.replace("{p}", distPct) + " · " +
                    C.textes.ecart.replace("{p}", ecartPct);
            }
        }
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
        const C = window.SchieweschlaweConfig;
        this.etat = "repos";

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

        // Le pointeur repart juste sous la pierre (visée neutre).
        this.pointer = { x: this.pierreX, y: this.pierreY + this.rayonPull * 0.2 };
        this.pull = { x: 0, y: this.rayonPull * 0.2 };

        this._poserDisqueAuPierre();
        this._dessinerVisee();
        this._montrerConsignes();
        this._positionnerTextes();
    }

    _poserDisqueAuPierre() {
        const UI = Arcade.UI;
        this.disque.setDisplaySize(this.tailleDisque, this.tailleDisque);
        this.disque.setPosition(this.pierreX, this.pierreY - this.tailleDisque * 0.2);
        this.disque.setAngle(0);
        this.disque.body.setVelocity(0, 0);
        this.disque.body.setAccelerationX(0);
        this.disque.body.setAccelerationY(0);
        this.disque.body.setAllowGravity(false);
        this.disque.body.updateFromGameObject();
        this.ombreDisque.setPosition(this.pierreX, this.pierreY);
        this.ombreDisque.setRadius(this.tailleDisque * 0.42);
        this.ombreDisque.setVisible(true);
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
