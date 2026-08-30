/*
 * TestScene — scène de test UNIQUE du spike « vent » Schieweschlawe.
 *
 * Ce que cette scène valide (PRD article 873 §4) :
 *   1. une trajectoire parabolique + vent latéral crédible et lisible
 *      (traînée de feu qui dessine l'arc, le joueur voit la courbe) ;
 *   2. un vent communiqué AVANT le tir (flèche + jauge + braises qui dérivent
 *      dans le décor) ;
 *   3. le comportement à vent fort (palier 10), via un bouton qui fait défiler
 *      les paliers de vent.
 *
 * Contrôles (clic/tap uniquement) : Touche 1 lance la jauge de puissance,
 * Touche 2 tire le disque. Le bouton « Vent » change l'intensité du vent.
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

        // Point de traînée (32x32) : point chaud qui dessine l'arc.
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

        this.etat = "repos";                 // repos | charge | vol | atterri
        this.puissance = 0;                  // 0..1
        this.chargeSens = 1;                 // +1 monte, -1 descend
        this.palierIndex = C.vent.palierInitial;
        this.directionVent = C.vent.direction;
        this.trainee = [];
        this.traineeTimer = 0;
        this.marqueur = null;
        this.boutonRejouer = null;

        this._creerDecor();
        this._creerCible();
        this._creerLanceurEtDisque();
        this._creerBraises();
        this._creerVent();
        this._creerJauge();
        this._creerTextes();

        // Clic / tap uniquement. On ignore les appuis secondaires (2e doigt)
        // et les clics sur les boutons plateforme (marqueur _clicPlateforme).
        this.input.on("pointerup", (pointer) => {
            if (pointer.isPrimary === false) return;
            if (Arcade.UI._clicPlateforme) {
                Arcade.UI._clicPlateforme = false;
                return;
            }
            this._tap();
        });

        // Mise en page immédiate + à chaque rotation / redimensionnement.
        Arcade.UI.layout(this, (w, h) => {
            this.w = w;
            this.h = h;
            this.physics.world.gravity.y = C.lancer.gravitePar_h * h;
            this._recalculerGeometrie();
        });
    }

    update(time, delta) {
        const dt = delta / 1000;
        if (this.etat === "charge") {
            this._avancerCharge(dt);
        } else if (this.etat === "vol") {
            this._suivreVol(dt);
        }
        this._fonduTrainee(dt);
        this._animerBraises(dt);
    }

    // --- Création des éléments ------------------------------------------------

    _creerDecor() {
        this.ciel = this.add.graphics().setDepth(0);
        this.sol = this.add.graphics().setDepth(3);

        // Étoiles : positions relatives stables, redessinées au resize.
        this.etoiles = [];
        const couleurEtoile = Phaser.Display.Color.HexStringToColor(
            window.SchieweschlaweConfig.couleurs.etoile).color;
        for (let i = 0; i < 40; i++) {
            const e = this.add.circle(0, 0, 2, couleurEtoile, 0.7).setDepth(1);
            this.etoiles.push({ obj: e, fx: Math.random(), fy: Math.random() });
        }
    }

    _creerCible() {
        this.cibleG = this.add.graphics().setDepth(4);
    }

    _creerLanceurEtDisque() {
        this.lanceurG = this.add.graphics().setDepth(4);
        this.disque = this.physics.add.sprite(0, 0, "disque");
        this.disque.setDepth(6);
        this.disque.body.setAllowGravity(false);
    }

    _creerBraises() {
        const C = window.SchieweschlaweConfig;
        this.braises = [];
        for (let i = 0; i < C.vent.braisesNombre; i++) {
            const b = this.add.image(0, 0, "braise").setDepth(2);
            this.braises.push({
                obj: b,
                fx: Math.random(),
                fy: Math.random(),
                x: undefined,
                vitesse: 0.5 + Math.random() * 0.7
            });
        }
    }

    _creerVent() {
        const C = window.SchieweschlaweConfig;
        this.ventG = this.add.graphics().setDepth(20);
        // Le bouton « Vent » affiche l'état courant et fait défiler les
        // paliers au clic. marqueurClic : un appui dessus ne compte pas
        // comme un tir (Touche 1 / Touche 2).
        this.boutonVent = Arcade.UI.bouton(this, {
            label: "",
            couleur: C.couleurs.boutonVent,
            textColor: C.couleurs.texte,
            marqueurClic: true,
            onClick: () => this._cyclerVent()
        });
    }

    _creerJauge() {
        const C = window.SchieweschlaweConfig;
        this.jaugeFond = this.add.graphics().setDepth(20);
        this.jaugePlein = this.add.graphics().setDepth(21);
        this.texteJauge = Arcade.UI.text(this, 0, 0, C.textes.puissance, 3.5, C.couleurs.texte)
            .setDepth(21);
    }

    _creerTextes() {
        const C = window.SchieweschlaweConfig;
        this.texteTitre = Arcade.UI.text(this, 0, 0, C.titre, 7, C.couleurs.texte).setDepth(20);
        this.texteSousTitre = Arcade.UI.text(this, 0, 0, C.textes.sousTitre, 3.5, C.couleurs.texte).setDepth(20);
        this.consigne1 = Arcade.UI.text(this, 0, 0, C.textes.consigneLigne1, 3.5, C.couleurs.texte).setDepth(20);
        this.consigne2 = Arcade.UI.text(this, 0, 0, C.textes.consigneLigne2, 3.5, C.couleurs.texte).setDepth(20);
        this.texteResultat = Arcade.UI.text(this, 0, 0, "", 4.5, C.couleurs.ecart)
            .setDepth(21).setVisible(false);
    }

    // --- Mise en page (appelée au resize) --------------------------------------

    _recalculerGeometrie() {
        const C = window.SchieweschlaweConfig;
        const w = this.w, h = this.h;

        this.solY = h * (1 - C.lancer.solPct / 100);
        this.lanceurX = (C.lancer.lanceurXPct / 100) * w;
        this.lanceurY = this.solY - (C.lancer.lanceurHautPct / 100) * h;
        this.cibleX = (C.lancer.cibleDistPct / 100) * w;

        // Vitesses de lancer dérivées : pleine puissance = atteindre la cible
        // SANS vent (sur terrain plat). La puissance règle la distance, le vent
        // décale latéralement.
        const g = C.lancer.gravitePar_h * h;
        const theta = (C.lancer.angleDeg * Math.PI) / 180;
        const D = this.cibleX - this.lanceurX;
        const sin2 = Math.sin(2 * theta);
        if (sin2 > 0.01 && D > 0) {
            this.vMax = Math.sqrt((D * g) / sin2);
        } else {
            this.vMax = C.lancer.gravitePar_h * h; // repli si géométrie dégénérée
        }
        this.vMin = this.vMax * C.lancer.puissanceMinRatio;

        // Accélération latérale du vent (dépend de la largeur d'écran).
        this.accelVent = this.directionVent *
            C.vent.paliers[this.palierIndex].valeur * w;

        this._dessinerDecor();
        this._dessinerCible();
        this._dessinerLanceur();
        this._positionnerBraises();
        this._dessinerVent();
        this._dessinerJauge();
        this._positionnerTextes();

        if (this.etat === "repos" || this.etat === "charge") {
            this._poserDisqueAuLanceur();
        }
    }

    _dessinerDecor() {
        const C = window.SchieweschlaweConfig;
        const w = this.w, h = this.h;
        const cH = Phaser.Display.Color.HexStringToColor(C.couleurs.cielHaut);
        const cB = Phaser.Display.Color.HexStringToColor(C.couleurs.cielBas);

        this.ciel.clear();
        this.ciel.fillGradientStyle(cH.color, cH.color, cB.color, cB.color, 1);
        this.ciel.fillRect(0, 0, w, h);

        this.etoiles.forEach((e) => {
            e.obj.setPosition(e.fx * w, e.fy * h * 0.7);
        });

        this.sol.clear();
        this.sol.fillStyle(Phaser.Display.Color.HexStringToColor(C.couleurs.sol).color, 1);
        this.sol.fillRect(0, this.solY, w, h - this.solY);
        this.sol.fillStyle(Phaser.Display.Color.HexStringToColor(C.couleurs.solHerbe).color, 1);
        this.sol.fillRect(0, this.solY, w, Math.max(2, h * 0.01));
    }

    _dessinerCible() {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;
        const x = this.cibleX;
        const haut = this.solY - UI.u(this, 22);

        this.cibleG.clear();
        this.cibleG.lineStyle(UI.u(this, 0.5),
            Phaser.Display.Color.HexStringToColor(C.couleurs.cible).color, 1);
        this.cibleG.lineBetween(x, this.solY, x, haut);
        this.cibleG.fillStyle(Phaser.Display.Color.HexStringToColor(C.couleurs.cible).color, 1);
        this.cibleG.fillTriangle(x, haut, x - UI.u(this, 4), haut + UI.u(this, 3), x, haut + UI.u(this, 6));
        this.cibleG.lineStyle(UI.u(this, 0.35),
            Phaser.Display.Color.HexStringToColor(C.couleurs.cible).color, 0.8);
        this.cibleG.strokeCircle(x, this.solY, UI.u(this, 3));
    }

    _dessinerLanceur() {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;
        const x = this.lanceurX;
        const y = this.solY;
        const baseW = UI.u(this, 8);
        const baseH = UI.u(this, 4);

        this.lanceurG.clear();
        this.lanceurG.fillStyle(Phaser.Display.Color.HexStringToColor(C.couleurs.lanceur).color, 1);
        this.lanceurG.fillRoundedRect(x - baseW / 2, y - baseH, baseW, baseH, baseH * 0.3);
        this.lanceurG.fillStyle(Phaser.Display.Color.HexStringToColor(C.couleurs.lanceurBord).color, 1);
        this.lanceurG.fillTriangle(x - baseW / 2, y, x + baseW / 2, y, x - baseW / 2, y - baseH);
    }

    _positionnerBraises() {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;
        const w = this.w, h = this.h;
        const taille = UI.u(this, C.vent.braiseTaillePct);

        this.braises.forEach((b) => {
            if (b.x === undefined) b.x = b.fx * w;
            else b.x = Phaser.Math.Clamp(b.x, -20, w + 20);
            b.obj.setPosition(b.x, b.fy * h * 0.75)
                .setDisplaySize(taille, taille)
                .setAlpha(0.4 + b.fx * 0.4);
        });
    }

    _dessinerVent() {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;
        const w = this.w, h = this.h;
        const palier = C.vent.paliers[this.palierIndex];

        const yFleche = h * 0.12;
        const yJauge = h * 0.165;
        const cx = w / 2;
        const dir = this.directionVent;
        const maxValeur = C.vent.paliers[C.vent.paliers.length - 1].valeur;
        const ratio = Math.min(1, palier.valeur / maxValeur);
        const demiLargeur = w * 0.18;
        const longueur = demiLargeur * ratio;
        const couleurVent = Phaser.Display.Color.HexStringToColor(C.couleurs.vent).color;

        this.ventG.clear();

        // Axe central + flèche directionnelle (longueur ∝ intensité).
        this.ventG.lineStyle(UI.u(this, 0.4), couleurVent, 1);
        this.ventG.lineBetween(cx - demiLargeur, yFleche, cx + demiLargeur, yFleche);
        if (ratio > 0) {
            const xFin = cx + dir * longueur;
            const t = UI.u(this, 1.6);
            this.ventG.fillStyle(couleurVent, 1);
            this.ventG.fillTriangle(xFin + dir * t, yFleche, xFin, yFleche - t * 0.7, xFin, yFleche + t * 0.7);
        } else {
            this.ventG.fillStyle(couleurVent, 1);
            this.ventG.fillCircle(cx, yFleche, UI.u(this, 1));
        }

        // Jauge d'intensité du vent (barre centrée qui se remplit dans le
        // sens du vent).
        const jaugeW = w * 0.36;
        const jaugeH = UI.u(this, 1.2);
        this.ventG.fillStyle(Phaser.Display.Color.HexStringToColor(C.couleurs.jaugeFond).color, 1);
        this.ventG.fillRoundedRect(cx - jaugeW / 2, yJauge - jaugeH / 2, jaugeW, jaugeH, jaugeH * 0.5);
        if (ratio > 0) {
            const lw = jaugeW * ratio;
            this.ventG.fillStyle(couleurVent, 1);
            if (dir > 0) {
                this.ventG.fillRoundedRect(cx, yJauge - jaugeH / 2, lw, jaugeH, jaugeH * 0.5);
            } else {
                this.ventG.fillRoundedRect(cx - lw, yJauge - jaugeH / 2, lw, jaugeH, jaugeH * 0.5);
            }
        }

        // Libellé + bouton de défilement des paliers.
        const libelle = C.textes.ventPrefixe + palier.nom + " (palier " + palier.palier + ")";
        this.boutonVent.label.setText(libelle);
        this.boutonVent.redimensionner(UI.u(this, 34), UI.u(this, 7))
            .setPosition(cx, yJauge + jaugeH + UI.u(this, 3.5));
    }

    _dessinerJauge() {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;
        const w = this.w, h = this.h;
        const railW = w * 0.6;              // % de la largeur réelle (règle jauge)
        const railH = UI.u(this, 3);
        const x = w / 2;
        const y = h * 0.88;

        this.jaugeFond.clear();
        this.jaugeFond.fillStyle(Phaser.Display.Color.HexStringToColor(C.couleurs.jaugeFond).color, 1);
        this.jaugeFond.fillRoundedRect(x - railW / 2, y - railH / 2, railW, railH, railH * 0.5);

        this.jaugePlein.clear();
        const lw = railW * this.puissance;
        if (lw > 0) {
            this.jaugePlein.fillStyle(Phaser.Display.Color.HexStringToColor(C.couleurs.jaugePlein).color, 1);
            this.jaugePlein.fillRoundedRect(x - railW / 2, y - railH / 2, lw, railH, railH * 0.5);
        }

        this.texteJauge.setPosition(x, y - railH - UI.u(this, 2.5));
        this.texteJauge.setFontSize(Math.round(UI.u(this, 3.5)) + "px");
    }

    _positionnerTextes() {
        const UI = Arcade.UI;
        const w = this.w, h = this.h;

        this.texteTitre.setPosition(w / 2, h * 0.035)
            .setFontSize(Math.round(UI.u(this, 7)) + "px");
        this.texteSousTitre.setPosition(w / 2, h * 0.035 + UI.u(this, 4))
            .setFontSize(Math.round(UI.u(this, 3.5)) + "px");

        if (this.consigne1.visible) {
            this.consigne1.setPosition(w / 2, h * 0.42)
                .setFontSize(Math.round(UI.u(this, 3.5)) + "px");
            this.consigne2.setPosition(w / 2, h * 0.42 + UI.u(this, 4.5))
                .setFontSize(Math.round(UI.u(this, 3.5)) + "px");
        }

        if (this.texteResultat.visible) {
            this.texteResultat.setPosition(w / 2, h * 0.44)
                .setFontSize(Math.round(UI.u(this, 4.5)) + "px");
        }

        if (this.boutonRejouer) {
            this.boutonRejouer.redimensionner(UI.u(this, 30), UI.u(this, 10))
                .setPosition(w / 2, h * 0.56);
        }
    }

    // --- Interactions ----------------------------------------------------------

    _tap() {
        if (this.etat === "repos") {
            this.etat = "charge";
            this.puissance = 0;
            this.chargeSens = 1;
            this._cacherConsignes();
        } else if (this.etat === "charge") {
            this._tirer();
        }
        // En "vol" ou "atterri", un tap n'a aucun effet.
    }

    _cyclerVent() {
        const C = window.SchieweschlaweConfig;
        this.palierIndex = (this.palierIndex + 1) % C.vent.paliers.length;
        this.accelVent = this.directionVent *
            C.vent.paliers[this.palierIndex].valeur * this.w;
        this._dessinerVent();
    }

    _avancerCharge(dt) {
        const C = window.SchieweschlaweConfig;
        this.puissance += this.chargeSens * C.lancer.chargeAllerRetourPar_s * dt;
        if (this.puissance >= 1) {
            this.puissance = 1;
            this.chargeSens = -1;
        } else if (this.puissance <= 0) {
            this.puissance = 0;
            this.chargeSens = 1;
        }
        this._dessinerJauge();
    }

    _tirer() {
        const C = window.SchieweschlaweConfig;
        const theta = (C.lancer.angleDeg * Math.PI) / 180;
        const vitesse = this.vMin + (this.vMax - this.vMin) * this.puissance;
        const vx = vitesse * Math.cos(theta);
        const vy = -vitesse * Math.sin(theta);

        this.disque.body.setAllowGravity(true);
        this.disque.body.setAccelerationX(this.accelVent);
        this.disque.body.setVelocity(vx, vy);

        this.etat = "vol";
        this.traineeTimer = 0;
    }

    _suivreVol(dt) {
        const C = window.SchieweschlaweConfig;
        const v = this.disque.body.velocity;

        // Orientation du disque selon sa vitesse.
        if (Math.abs(v.x) + Math.abs(v.y) > 1) {
            this.disque.setAngle(Phaser.Math.RadToDeg(Math.atan2(v.y, v.x)));
        }

        // Traînée de feu : dessine l'arc (courbure due au vent lisible).
        this.traineeTimer += dt * 1000;
        if (this.traineeTimer >= C.lancer.traineeIntervalMs) {
            this.traineeTimer -= C.lancer.traineeIntervalMs;
            this._poserTrainee();
        }

        const solLimite = this.solY - this.disque.displayHeight * 0.3;
        const sorti = this.disque.x < -60 || this.disque.x > this.w + 60 ||
            this.disque.y > this.h + 60;
        if ((this.disque.y >= solLimite && v.y > 0) || sorti) {
            this._atterrir(sorti);
        }
    }

    _poserTrainee() {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;
        const t = this.add.image(this.disque.x, this.disque.y, "trainee").setDepth(5);
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
        const w = this.w, h = this.h;
        const palier = C.vent.paliers[this.palierIndex];
        const vVent = (C.vent.braisesPar_w +
            palier.valeur * C.vent.braisesFacteurVent) * w;
        const dir = this.directionVent;

        this.braises.forEach((b) => {
            b.x += dir * vVent * b.vitesse * dt;
            if (b.x > w + 20) b.x = -20;
            if (b.x < -20) b.x = w + 20;
            b.obj.setPosition(b.x, b.fy * h * 0.75);
        });
    }

    _atterrir(sorti) {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;

        this.etat = "atterri";
        this.disque.body.setVelocity(0, 0);
        this.disque.body.setAccelerationX(0);
        this.disque.body.setAllowGravity(false);

        const xAtterrissage = Phaser.Math.Clamp(this.disque.x, 0, this.w);
        this.marqueur = this.add.graphics().setDepth(5);
        this.marqueur.lineStyle(UI.u(this, 0.4),
            Phaser.Display.Color.HexStringToColor(C.couleurs.ecart).color, 1);
        this.marqueur.strokeCircle(xAtterrissage, this.solY, UI.u(this, 2.5));

        let texte;
        if (sorti) {
            texte = C.textes.horsEcran;
        } else {
            const dist = Math.round((xAtterrissage / this.w) * 100);
            const ecart = Math.round(((xAtterrissage - this.cibleX) / this.w) * 100);
            texte = C.textes.distance.replace("{p}", dist) + "   " +
                C.textes.ecart.replace("{p}", (ecart > 0 ? "+" : "") + ecart);
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
        this.etat = "repos";
        this.puissance = 0;
        this.chargeSens = 1;

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

        this._poserDisqueAuLanceur();
        this._montrerConsignes();
        this._positionnerTextes();
        this._dessinerJauge();
    }

    _poserDisqueAuLanceur() {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;
        const taille = UI.u(this, C.lancer.tailleDisquePct);

        this.disque.setDisplaySize(taille, taille);
        this.disque.setPosition(this.lanceurX, this.lanceurY - taille * 0.2);
        this.disque.setAngle(0);
        this.disque.body.setVelocity(0, 0);
        this.disque.body.setAccelerationX(0);
        this.disque.body.setAllowGravity(false);
        this.disque.body.updateFromGameObject();
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
