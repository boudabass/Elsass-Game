/*
 * GameScene — un niveau de Schieweschlawe (PRD 873).
 *
 * Reprise de la scène de test du spike v5 (TestScene, 30/08), validée par
 * John en navigateur réel : même visée proportionnelle au terrain (§4),
 * même jauge à zone orange fixe (§5), même physique (parabole simulée par
 * échelle + vent en accélération constante, §6). Ce qui change (24/09) :
 *   - la cible et le vent viennent du NIVEAU (Niveaux.js) — plus de boutons
 *     de test pour faire défiler le vent ou sa direction ;
 *   - 3 lancers par niveau (décision John) : cible touchée → fin de niveau
 *     réussie ; raté → lancer suivant ; 3 ratés → fin de niveau ratée ;
 *   - interface à la charte : pastilles (niveau, lancer, vent, résultat),
 *     bouton « Tirer » rouge.
 * Critique du 25/09 : bouton « Menu » (noir, haut-gauche) pour quitter un
 * niveau à tout moment — rien n'est perdu, la save n'est écrite qu'à la
 * réussite ; et UN SEUL bouton rouge, qui suit l'état : « Tirer » →
 * « Stop » (jauge) → caché (vol) → « Relancer » (raté, lancers restants).
 *
 * Coordonnées de visée 0-100 SANS NÉGATIF sur les deux axes : distance
 * (0 = sous la pierre, 100 = bas de l'écran → bout du terrain) et latéral
 * (0 = gauche, 100 = droite ; le tir part en miroir : 100 − position).
 *
 * États : placement → jauge → feedback → vol → resultat.
 */
class GameScene extends Phaser.Scene {
    static KEY = "jeu";

    constructor() {
        super(GameScene.KEY);
    }

    /**
     * Textures dessinées (aucune image téléchargée). Appelé une seule fois
     * depuis preload() de main.js.
     */
    static genererTextures(scene) {
        const C = window.SchieweschlaweConfig;
        const g = scene.make.graphics({ add: false });

        // Disque de feu (256x256, net aussi en grand dans le menu) :
        // halo -> corps orange -> cœur jaune.
        g.fillStyle(C.couleurs.disque, 0.35);
        g.fillCircle(128, 128, 120);
        g.fillStyle(C.couleurs.disque, 1);
        g.fillCircle(128, 128, 80);
        g.fillStyle(C.couleurs.disqueCoeur, 1);
        g.fillCircle(128, 128, 48);
        g.fillStyle(C.couleurs.disqueClair, 1);
        g.fillCircle(128, 128, 24);
        g.generateTexture("disque", 256, 256);
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
        g.clear();

        // Étincelle (8x8) : point pâle qui scintille, halo doux — décor
        // « vallée de nuit » du 25/09, distinct des braises (statique,
        // pas de dérive au vent).
        g.fillStyle(C.couleurs.etincelle, 0.35);
        g.fillCircle(4, 4, 4);
        g.fillStyle(C.couleurs.etincelle, 1);
        g.fillCircle(4, 4, 1.4);
        g.generateTexture("etincelle", 8, 8);

        g.destroy();
    }

    init(data) {
        const C = window.SchieweschlaweConfig;
        const courant = this.registry.get("currentLevel") || 1;
        const n = (data && data.niveau) || Math.min(courant, C.niveaux.total);
        this.niv = SchieweschlaweNiveaux.niveau(n, C);
    }

    create() {
        const C = window.SchieweschlaweConfig;

        // Vue du dessus : pas de gravité de monde sur le plan du sol (la
        // hauteur est simulée à part, par échelle).
        this.physics.world.gravity.y = 0;

        this.etat = "placement";
        this.glisse = false;               // vrai pendant qu'on déplace le disque
        this.lancerNum = 1;                // 1..lancersParNiveau

        this.posDistance = 50;             // 0 = sous la pierre, 100 = bas de l'écran
        this.posLateral = 50;              // 0 = gauche, 100 = droite, 50 = centre

        this.jaugeTemps = 0;
        this.jaugeNeedle = 0.5;
        this.jaugeZoneCentre = 0.5;
        this.jaugeDeviation = 0;
        this.feedbackRestant = 0;

        this.trainee = [];
        this.traineeTimer = 0;
        this.marqueur = null;
        this.peutRelancer = false;         // raté avec des lancers restants

        this.ciel = this.add.graphics().setDepth(0);
        this.sol = this.add.graphics().setDepth(1);
        this.grilleG = this.add.graphics().setDepth(2);
        this.nuitG = this.add.graphics().setDepth(3);   // voile de nuit, au-dessus du champ
        this.pierreG = this.add.graphics().setDepth(4);
        this.cibleG = this.add.graphics().setDepth(4);
        this.ombreDisque = this.add.circle(0, 0, 4, C.couleurs.ombreDisque, 0.35).setDepth(5);
        this.disque = this.physics.add.sprite(0, 0, "disque").setDepth(6);
        this.disque.body.setAllowGravity(false);
        this.viseeG = this.add.graphics().setDepth(9);
        this.ventG = this.add.graphics().setDepth(20);
        this.jaugeG = this.add.graphics().setDepth(22);
        this._creerBraises();
        this._creerEtincelles();
        this._creerInterface();

        // Zone de saisie globale (clic/tap), sous les boutons (hit-test
        // Phaser topOnly). Placement : glisser le disque dans la zone de
        // recul. Jauge : reclic n'importe où pour arrêter l'aiguille.
        this.zoneGlobale = this.add.zone(0, 0, 10, 10)
            .setOrigin(0, 0).setInteractive();
        this.zoneGlobale.on("pointerdown", (p) => this._pointerDown(p));
        this.zoneGlobale.on("pointermove", (p) => {
            if (this.glisse && this.etat === "placement") this._poserDisque(p);
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
        this._animerEtincelles(dt);
    }

    // --- Création ---------------------------------------------------------------

    _creerBraises() {
        const C = window.SchieweschlaweConfig;
        const u1 = Arcade.UI.u(this, 1);
        this.braises = [];
        for (let i = 0; i < C.vent.braisesNombre; i++) {
            this.braises.push({
                obj: this.add.image(0, 0, "braise").setDepth(8),
                x: Math.random(),
                y: Math.random(),
                vitesse: 0.5 + Math.random() * 0.7,
                baseVx: (Math.random() - 0.5) * 0.25 * u1,
                baseVy: (Math.random() - 0.5) * 0.25 * u1
            });
        }
        this._braisesPlacees = false;
    }

    /** Étincelles statiques qui scintillent (décor « vallée de nuit », 25/09). */
    _creerEtincelles() {
        const C = window.SchieweschlaweConfig;
        this.etincelles = [];
        for (let i = 0; i < C.nuit.etincellesNombre; i++) {
            this.etincelles.push({
                obj: this.add.image(0, 0, "etincelle").setDepth(3.5).setBlendMode(Phaser.BlendModes.ADD),
                x: Math.random(),
                y: Math.random(),
                phase: Math.random() * Math.PI * 2,
                vitesse: Phaser.Math.FloatBetween(
                    C.nuit.twinkleVitesseMinPar_s, C.nuit.twinkleVitesseMaxPar_s)
            });
        }
        this._etincellesPlacees = false;
    }

    _creerInterface() {
        const C = window.SchieweschlaweConfig;
        const T = C.textes;
        const UI = Arcade.UI;
        const pastille = (tailleU, ancre) =>
            UI.pastilleHud(this, { tailleU: tailleU, ancre: ancre, profondeur: 30 });

        // HUD : niveau (gauche) et lancer en cours (droite).
        this.hudNiveau = pastille(3.6, 0).setText(T.hudNiveau.replace("{n}", this.niv.n));
        this.hudLancer = pastille(3.6, 1);
        this._majHudLancer();

        // Vent (colonne de gauche du bas d'écran) : rose dessinée + libellé.
        this.hudVent = pastille(3.3, 0.5).setText(
            T.vent.replace("{nom}", T.ventNoms[this.niv.vent.nom] || this.niv.vent.nom));

        // Consignes : seulement au tout premier lancer du niveau 1 (visée),
        // ou du niveau 11 (vent — décision John 25/09, 1er niveau où il
        // cesse d'être Calme, §7). Les 3 pastilles sont toujours créées
        // (mêmes emplacements que le layout attend) ; les inutilisées
        // restent vides et ne comptent pour rien dans l'empilement.
        const consignesNiveau = this.niv.n === 1 ? T.consignes
            : this.niv.n === 11 ? [T.consigneVent]
            : [];
        this.consignes = T.consignes.map((_, i) =>
            pastille(3.4, 0.5).setText(consignesNiveau[i] || ""));

        this.texteJauge = pastille(3.6, 0.5);
        this.texteResultat = pastille(4.5, 0.5);

        // Quitter le niveau à tout moment (navigation = noir, charte).
        this.boutonMenu = UI.boutonMenu(this, {
            variante: "accent",
            label: T.menu,
            marqueurClic: true,
            onClick: () => this.scene.start(MenuScene.KEY)
        }).setDepth(30);

        // LE bouton d'action (rouge, un seul à l'écran) : son libellé et
        // son rôle suivent l'état (_majBoutonAction).
        this.boutonAction = UI.boutonMenu(this, {
            variante: "jouer",
            label: T.tirer,
            marqueurClic: true,
            onClick: () => {
                if (this.etat === "placement") this._demarrerJauge();
                else if (this.etat === "jauge") this._arreterJauge();
                else if (this.etat === "resultat") this._lancerSuivant();
            }
        }).setDepth(30);
    }

    /** Libellé du bouton d'action selon l'état ; caché s'il n'y a rien à faire. */
    _majBoutonAction() {
        const T = window.SchieweschlaweConfig.textes;
        const libelle = this.etat === "placement" ? T.tirer
            : this.etat === "jauge" ? T.stop
            : (this.etat === "resultat" && this.peutRelancer) ? T.relancer
            : null;
        if (libelle) {
            this.boutonAction.label.setText(libelle);
            this.boutonAction.setAlpha(1).refresh();
        } else {
            this.boutonAction.setAlpha(0);
        }
    }

    _majHudLancer() {
        const C = window.SchieweschlaweConfig;
        this.hudLancer.setText(C.textes.hudLancer
            .replace("{i}", this.lancerNum)
            .replace("{total}", C.niveaux.lancersParNiveau));
    }

    // --- Mise en page (appelée au resize) --------------------------------------

    _recalculerGeometrie() {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;
        const w = this.w, h = this.h;

        // Pierre + terrain (TOUT l'espace au-dessus de la pierre) + cible du
        // niveau, en % : les mêmes formules que Niveaux.viseeRequise.
        this.pierreX = (C.lancer.pierreXPct / 100) * w;
        this.pierreY = (C.lancer.pierreYPct / 100) * h;
        this.terrainLongueurPx = this.pierreY;
        this.cibleX = (this.niv.lateralPct / 100) * w;
        this.cibleY = this.pierreY - (this.niv.distancePct / 100) * this.terrainLongueurPx;

        this.rayonCible = UI.u(this, this.niv.rayonPct);
        this.tailleDisque = UI.u(this, C.lancer.tailleDisquePct);
        this.graviteHauteur = C.lancer.graviteHauteurPar_s * h;

        // Bas d'écran en 3 colonnes égales : vent / zone de recul / Tirer.
        this.colLargeur = w / 3;

        this.accelVentX = this.niv.vent.valeur * this.niv.vent.dx * w;
        this.accelVentY = this.niv.vent.valeur * this.niv.vent.dy * h;

        this._majVisee();

        this.zoneGlobale.setPosition(0, 0).setSize(w, h);
        if (this.zoneGlobale.input && this.zoneGlobale.input.hitArea) {
            this.zoneGlobale.input.hitArea.setSize(w, h);
        }

        this._dessinerDecor();
        this._dessinerGrille();
        this._dessinerPierre();
        this._dessinerCible();
        this._dessinerVisee();
        this._positionnerBraises();
        this._positionnerEtincelles();
        this._dessinerVent();
        this._dessinerJaugeBarre();
        this._positionnerInterface();

        if (this.etat === "placement") this._poserDisqueVisuel();
    }

    _dessinerDecor() {
        const C = window.SchieweschlaweConfig;
        const c = (s) => Phaser.Display.Color.HexStringToColor(s).color;
        const w = this.w, h = this.h;
        const w3 = this.colLargeur;
        const topY = this.pierreY - this.terrainLongueurPx;

        this.ciel.clear();
        this.ciel.fillStyle(c(C.couleurs.ciel), 1);
        this.ciel.fillRect(0, 0, w, h);

        // Champ borné à la longueur RÉELLE du terrain (sinon une zone non
        // atteignable s'affiche comme du terrain — bug du 30/08).
        this.sol.clear();
        this.sol.fillStyle(c(C.couleurs.champ), 1);
        this.sol.fillRect(0, topY, w, this.terrainLongueurPx);
        this.sol.fillStyle(c(C.couleurs.lancePad), 1);
        this.sol.fillRect(0, this.pierreY, w, h - this.pierreY);
        this.sol.fillStyle(c(C.couleurs.champ), 0.35);
        this.sol.fillRect(w3, this.pierreY, w3, h - this.pierreY);

        // Voile de nuit (25/09) : le fond du terrain (loin de la pierre)
        // sombre vers le noir, la lumière du disque domine près de la
        // pierre. Dégradé vertical superposé au champ, purement décoratif
        // — le champ garde exactement les mêmes dimensions (zone visuelle
        // = zone fonctionnelle).
        const cNuit = c(C.couleurs.ciel);
        this.nuitG.clear();
        this.nuitG.fillGradientStyle(cNuit, cNuit, cNuit, cNuit,
            C.nuit.voileAlphaHaut, C.nuit.voileAlphaHaut, 0, 0);
        this.nuitG.fillRect(0, topY, w, this.terrainLongueurPx);
        this.sol.lineStyle(Math.max(1, Arcade.UI.u(this, 0.15)), c(C.couleurs.grilleLigne), 0.8);
        this.sol.lineBetween(w3, this.pierreY, w3, h);
        this.sol.lineBetween(2 * w3, this.pierreY, 2 * w3, h);
    }

    _dessinerGrille() {
        const C = window.SchieweschlaweConfig;
        const w = this.w;
        const coul = Phaser.Display.Color.HexStringToColor(C.couleurs.grilleLigne).color;
        const topY = this.pierreY - this.terrainLongueurPx;

        this.grilleG.clear();
        this.grilleG.lineStyle(Math.max(1, Arcade.UI.u(this, 0.15)), coul, 0.7);
        const nb = 6;
        for (let i = 0; i <= nb; i++) {
            const y = topY + (this.terrainLongueurPx / nb) * i;
            this.grilleG.lineBetween(0, y, w, y);
            const x = (w / nb) * i;
            this.grilleG.lineBetween(x, topY, x, this.pierreY);
        }
    }

    _dessinerPierre() {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;
        const c = (s) => Phaser.Display.Color.HexStringToColor(s).color;
        // En longueur (dans l'axe du tir), centrée sur la limite terrain /
        // bande de lancement : moitié posée, moitié au-dessus du vide.
        const larg = UI.u(this, C.lancer.pierreLargeurU);
        const long = UI.u(this, C.lancer.pierreLongueurU);
        const x0 = this.pierreX - larg / 2;
        const y0 = this.pierreY - long / 2;

        this.pierreG.clear();
        this.pierreG.fillStyle(c(C.couleurs.pierre), 1);
        this.pierreG.fillRoundedRect(x0, y0, larg, long, larg * 0.3);
        // Pan incliné vers la vallée (côté terrain), plus clair.
        this.pierreG.fillStyle(c(C.couleurs.pierreBord), 1);
        this.pierreG.fillTriangle(x0, y0, x0 + larg, y0, x0, y0 + long);
    }

    /** Haut de la pierre (la jauge et son libellé se placent au-dessus). */
    _hautPierre() {
        const C = window.SchieweschlaweConfig;
        return this.pierreY - Arcade.UI.u(this, C.lancer.pierreLongueurU) / 2;
    }

    _dessinerCible() {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;
        const c = (s) => Phaser.Display.Color.HexStringToColor(s).color;
        const r = this.rayonCible;

        this.cibleG.clear();
        this.cibleG.fillStyle(c(C.couleurs.cible), 0.25);
        this.cibleG.fillCircle(this.cibleX, this.cibleY, r);
        this.cibleG.lineStyle(UI.u(this, 0.4), c(C.couleurs.cible), 1);
        this.cibleG.strokeCircle(this.cibleX, this.cibleY, r);
        this.cibleG.lineStyle(UI.u(this, 0.3), c(C.couleurs.ciblePlein), 1);
        this.cibleG.strokeCircle(this.cibleX, this.cibleY, r * C.cible.pleinCentreRatio);
    }

    _positionnerInterface() {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;
        const u = (n) => UI.u(this, n);
        const w = this.w, h = this.h;
        const w3 = this.colLargeur;
        const bande = h - this.pierreY;

        // Haut : Menu à gauche, puis Niveau ; Lancer à droite — centrés
        // sur la même ligne que le bouton.
        const minPx = C.lancer.cibleMinPx;
        const hMenu = Math.max(minPx, u(9));
        const lMenu = Math.max(minPx * 1.6, u(18));
        this.boutonMenu.redimensionner(lMenu, hMenu)
            .setPosition(u(2) + lMenu / 2, u(2) + hMenu / 2);
        const yHud = u(2) + (hMenu - this.hudNiveau.hauteur()) / 2;
        this.hudNiveau.placer(u(2) + this.boutonMenu.largeur() + u(2), yHud);
        this.hudLancer.placer(w - u(2), yHud);

        // Libellé du vent sous la rose (colonne de gauche).
        this.hudVent.placer(w3 / 2, this.pierreY + bande * 0.66);

        let yConsigne = h * 0.16;
        this.consignes.forEach((c) => {
            c.placer(w / 2, yConsigne);
            yConsigne += c.hauteur() + u(1.2);
        });

        // Libellé de la jauge, juste au-dessus de la barre.
        this.texteJauge.placer(w / 2,
            this._hautPierre() - u(C.jauge.hauteurU) - u(2) - u(8));
        this.texteResultat.placer(w / 2, h * 0.36);

        this.boutonAction.redimensionner(w3 * 0.8,
            Math.max(minPx, Math.min(u(10), bande * 0.6)))
            .setPosition(w - w3 / 2, this.pierreY + bande / 2);
        this._majBoutonAction();
    }

    // --- Visée proportionnelle (PRD §4) ----------------------------------------

    /** Position du disque et point visé, depuis les coordonnées 0-100. */
    _majVisee() {
        const w = this.w, h = this.h;
        this.disqueX = this.colLargeur + (this.posLateral / 100) * this.colLargeur;
        this.disqueY = this.pierreY + (this.posDistance / 100) * (h - this.pierreY);
        // Miroir : disque à gauche → tir à droite. distance_du_tir =
        // (position_disque / 100) × longueur_du_terrain.
        this.aimX = ((100 - this.posLateral) / 100) * w;
        this.aimY = this.pierreY - (this.posDistance / 100) * this.terrainLongueurPx;
    }

    _poserDisque(p) {
        const w3 = this.colLargeur;
        this.posLateral = Phaser.Math.Clamp(((p.x - w3) / w3) * 100, 0, 100);
        this.posDistance = Phaser.Math.Clamp(
            ((p.y - this.pierreY) / (this.h - this.pierreY)) * 100, 0, 100);
        this._majVisee();
        this._poserDisqueVisuel();
        this._dessinerVisee();
    }

    _poserDisqueVisuel() {
        this.disque.setDisplaySize(this.tailleDisque, this.tailleDisque);
        this.disque.setPosition(this.disqueX, this.disqueY);
        this.disque.setAngle(0);
        this.disque.body.setVelocity(0, 0);
        this.disque.body.setAcceleration(0, 0);
        this.disque.body.setAllowGravity(false);
        this.disque.body.updateFromGameObject();
        this.ombreDisque.setPosition(this.disqueX, this.disqueY)
            .setRadius(this.tailleDisque * 0.42).setVisible(true);
    }

    _dessinerVisee() {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;
        const coul = Phaser.Display.Color.HexStringToColor(C.couleurs.visee).color;

        this.viseeG.clear();
        if (this.etat !== "placement") return;

        // Ligne de traction disque → pierre.
        this.viseeG.lineStyle(UI.u(this, 0.3), coul, 0.45);
        this.viseeG.lineBetween(this.disqueX, this.disqueY, this.pierreX, this.pierreY);

        // Aperçu du tir (sans vent) : flèche pierre → point visé.
        const dx = this.aimX - this.pierreX;
        const dy = this.aimY - this.pierreY;
        const dist = Math.hypot(dx, dy);
        if (dist > 1) {
            const ux = dx / dist, uy = dy / dist;
            const t = UI.u(this, 2.2);
            this.viseeG.lineStyle(UI.u(this, 0.6), coul, 0.9);
            this.viseeG.lineBetween(this.pierreX, this.pierreY, this.aimX, this.aimY);
            this.viseeG.fillStyle(coul, 0.9);
            this.viseeG.fillTriangle(
                this.aimX + ux * t, this.aimY + uy * t,
                this.aimX - uy * t * 0.55, this.aimY + ux * t * 0.55,
                this.aimX + uy * t * 0.55, this.aimY - ux * t * 0.55
            );
        }
        this.viseeG.lineStyle(UI.u(this, 0.45), coul, 0.8);
        this.viseeG.strokeCircle(this.aimX, this.aimY, UI.u(this, 2.2));

        // Repère du disque (croix + anneau).
        const r = UI.u(this, 2.6);
        const b = r + UI.u(this, 1.2);
        this.viseeG.lineStyle(UI.u(this, 0.5), coul, 1);
        this.viseeG.strokeCircle(this.disqueX, this.disqueY, r);
        this.viseeG.lineBetween(this.disqueX - b, this.disqueY, this.disqueX + b, this.disqueY);
        this.viseeG.lineBetween(this.disqueX, this.disqueY - b, this.disqueX, this.disqueY + b);
    }

    // --- Jauge de précision (PRD §5) --------------------------------------------

    _demarrerJauge() {
        if (this.etat !== "placement") return;
        const C = window.SchieweschlaweConfig;
        this.etat = "jauge";
        this.jaugeTemps = 0;
        this.jaugeNeedle = 0.5;
        // Zone orange FIXE pour ce tir (tirée une seule fois) : un seul
        // élément bouge, l'aiguille.
        const demiOrange = C.jauge.zoneOrangeLargeurPct / 200;
        this.jaugeZoneCentre = demiOrange + Math.random() * (1 - 2 * demiOrange);
        this.jaugeDeviation = 0;
        this.texteJauge.setText(C.textes.arreter);
        this.consignes.forEach((c) => c.setVisible(false));
        this._dessinerVisee();
        this._majBoutonAction();
    }

    _avancerJauge(dt) {
        const C = window.SchieweschlaweConfig;
        this.jaugeTemps += dt;
        this.jaugeNeedle = 0.5 + 0.5 *
            Math.sin(2 * Math.PI * C.jauge.vitesseBalayagePar_s * this.jaugeTemps);
        this._dessinerJaugeBarre();
    }

    _arreterJauge() {
        if (this.etat !== "jauge") return;
        const C = window.SchieweschlaweConfig;
        const demiOrange = C.jauge.zoneOrangeLargeurPct / 200;
        const d = Math.abs(this.jaugeNeedle - this.jaugeZoneCentre);
        // Dans l'orange → conforme ; sinon déviation proportionnelle à
        // l'écart, bornée [0, 1].
        this.jaugeDeviation = d <= demiOrange ? 0
            : Phaser.Math.Clamp((d - demiOrange) / (1 - demiOrange), 0, 1);

        this.etat = "feedback";
        this.feedbackRestant = C.jauge.delaiFeedbackMs;
        this.texteJauge.setText(
            this.jaugeDeviation === 0 ? C.textes.conforme : C.textes.manque);
        this._dessinerJaugeBarre();
        this._majBoutonAction();
    }

    _dessinerJaugeBarre() {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;
        const c = (s) => Phaser.Display.Color.HexStringToColor(s).color;
        const w = this.w;

        this.jaugeG.clear();
        if (this.etat !== "jauge" && this.etat !== "feedback") return;

        const largeur = (C.jauge.largeurPct / 100) * w;
        const hauteur = UI.u(this, C.jauge.hauteurU);
        const x = (w - largeur) / 2;
        const y = this._hautPierre() - hauteur - UI.u(this, 2);   // juste au-dessus de la pierre

        this.jaugeG.fillStyle(c(C.couleurs.jaugeFond), 1);
        this.jaugeG.fillRoundedRect(x, y, largeur, hauteur, hauteur * 0.3);
        this.jaugeG.fillStyle(c(C.couleurs.jaugeBarre), 0.35);
        this.jaugeG.fillRoundedRect(x, y, largeur, hauteur, hauteur * 0.3);

        const oW = (C.jauge.zoneOrangeLargeurPct / 100) * largeur;
        const oC = x + this.jaugeZoneCentre * largeur;
        this.jaugeG.fillStyle(c(C.couleurs.jaugeZoneOrange), 0.9);
        this.jaugeG.fillRoundedRect(oC - oW / 2, y, oW, hauteur, hauteur * 0.3);

        const nX = x + this.jaugeNeedle * largeur;
        this.jaugeG.lineStyle(Math.max(1, UI.u(this, 0.4)), c(C.couleurs.jaugeAiguille), 1);
        this.jaugeG.lineBetween(nX, y - hauteur * 0.2, nX, y + hauteur * 1.2);
    }

    // --- Vent --------------------------------------------------------------------

    _positionnerBraises() {
        const C = window.SchieweschlaweConfig;
        const taille = Arcade.UI.u(this, C.vent.braiseTaillePct);
        this.braises.forEach((b) => {
            if (!this._braisesPlacees) {
                b.x = b.x * this.w;
                b.y = b.y * this.pierreY;
            } else {
                b.x = Phaser.Math.Clamp(b.x, -20, this.w + 20);
                b.y = Phaser.Math.Clamp(b.y, -20, this.h + 20);
            }
            b.obj.setPosition(b.x, b.y)
                .setDisplaySize(taille, taille)
                .setAlpha(0.4 + Math.random() * 0.4);
        });
        this._braisesPlacees = true;
    }

    /** Étincelles : positions fixes (fraction du champ), pas de dérive au vent. */
    _positionnerEtincelles() {
        const C = window.SchieweschlaweConfig;
        const taille = Arcade.UI.u(this, C.nuit.etincelleTaillePct);
        this.etincelles.forEach((e) => {
            if (!this._etincellesPlacees) {
                e.x = e.x * this.w;
                e.y = e.y * this.pierreY;    // champ = 0..pierreY (topY = 0)
            }
            e.obj.setPosition(e.x, e.y).setDisplaySize(taille, taille);
        });
        this._etincellesPlacees = true;
    }

    /** Rose des vents + flèche (longueur ∝ force), colonne de gauche. */
    _dessinerVent() {
        const C = window.SchieweschlaweConfig;
        const UI = Arcade.UI;
        const v = this.niv.vent;
        const bande = this.h - this.pierreY;
        const maxValeur = C.vent.parPalier[C.vent.parPalier.length - 1].valeur;
        const ratio = Math.min(1, v.valeur / maxValeur);
        const coul = Phaser.Display.Color.HexStringToColor(C.couleurs.vent).color;

        const cx = this.colLargeur / 2;
        const cy = this.pierreY + bande * 0.32;
        const demiAxe = Math.min(UI.u(this, 7), this.colLargeur * 0.35, bande * 0.24);

        this.ventG.clear();
        this.ventG.lineStyle(UI.u(this, 0.3), coul, 0.25);
        this.ventG.lineBetween(cx - demiAxe, cy, cx + demiAxe, cy);
        this.ventG.lineBetween(cx, cy - demiAxe, cx, cy + demiAxe);

        if (ratio > 0) {
            const longueur = demiAxe * (0.25 + ratio * 0.75);
            const tipX = cx + v.dx * longueur;
            const tipY = cy + v.dy * longueur;
            const t = Math.min(UI.u(this, 2), demiAxe * 0.4);
            this.ventG.lineStyle(UI.u(this, 0.5), coul, 1);
            this.ventG.lineBetween(cx, cy, tipX, tipY);
            this.ventG.fillStyle(coul, 1);
            this.ventG.fillTriangle(
                tipX + v.dx * t, tipY + v.dy * t,
                tipX - v.dy * t * 0.6, tipY + v.dx * t * 0.6,
                tipX + v.dy * t * 0.6, tipY - v.dx * t * 0.6
            );
        } else {
            this.ventG.fillStyle(coul, 1);
            this.ventG.fillCircle(cx, cy, UI.u(this, 1));
        }
    }

    _animerBraises(dt) {
        const C = window.SchieweschlaweConfig;
        const v = this.niv.vent;
        const w = this.w, h = this.h;
        const vVent = (C.vent.braisesPar_u + v.valeur * C.vent.braisesFacteurVent) *
            Arcade.UI.u(this, 1);

        this.braises.forEach((b) => {
            b.x += (v.dx * vVent * b.vitesse + b.baseVx) * dt;
            b.y += (v.dy * vVent * b.vitesse + b.baseVy) * dt;
            if (b.x > w + 20) b.x = -20;
            if (b.x < -20) b.x = w + 20;
            if (b.y > h + 20) b.y = -20;
            if (b.y < -20) b.y = h + 20;
            b.obj.setPosition(b.x, b.y);
        });
    }

    /** Scintillement des étincelles : alpha qui pulse, aucune dérive. */
    _animerEtincelles(dt) {
        this._tempsEtincelles = (this._tempsEtincelles || 0) + dt;
        const t = this._tempsEtincelles;
        this.etincelles.forEach((e) => {
            const pulse = 0.5 + 0.5 * Math.sin(t * e.vitesse * Math.PI * 2 + e.phase);
            e.obj.setAlpha(0.15 + pulse * 0.55);
        });
    }

    // --- Interactions ------------------------------------------------------------

    _pointerDown(p) {
        if (this.etat === "placement") {
            // Glisser le disque seulement dans la colonne du milieu, sous la pierre.
            const w3 = this.colLargeur;
            if (p.y > this.pierreY && p.x >= w3 && p.x <= 2 * w3) {
                this.glisse = true;
                this._poserDisque(p);
            }
        } else if (this.etat === "jauge") {
            this._arreterJauge();
        }
    }

    // --- Lancement / vol ------------------------------------------------------------

    _lancer() {
        if (this.etat !== "feedback") return;
        const C = window.SchieweschlaweConfig;

        // Déviation (arrêt raté) : ampleur calibrée dans config.js.
        const signD = Math.random() < 0.5 ? 1 : -1;
        const signL = Math.random() < 0.5 ? 1 : -1;
        const devDist = this.jaugeDeviation *
            (C.jauge.deviationDistanceMaxPct / 100) * this.terrainLongueurPx * signD;
        const devLat = this.jaugeDeviation *
            (C.jauge.deviationLateralMaxPct / 100) * this.w * signL;

        // Vitesse déduite pour retomber sur le point visé SANS vent
        // (portée = 2·facteur·v0²/g) — même physique que Niveaux.viseeRequise.
        const dx = this.aimX + devLat - this.pierreX;
        const dy = this.aimY - devDist - this.pierreY;
        const dist = Math.hypot(dx, dy);
        const dirX = dist > 1 ? dx / dist : 0;
        const dirY = dist > 1 ? dy / dist : -1;
        const v0 = Math.sqrt(Math.max(dist, 1) * this.graviteHauteur /
            (2 * C.lancer.facteurHauteur));

        // Le disque part de la PIERRE (point de frappe du rituel).
        this.disque.setPosition(this.pierreX, this.pierreY);
        this.disque.body.updateFromGameObject();
        this.disque.body.setAcceleration(this.accelVentX, this.accelVentY);
        this.disque.body.setVelocity(dirX * v0, dirY * v0);

        this.z = 0;
        this.zVel = v0 * C.lancer.facteurHauteur;
        this.zMax = Math.max(1, (this.zVel * this.zVel) / (2 * this.graviteHauteur));

        this.etat = "vol";
        this.traineeTimer = 0;
        this.texteJauge.setText("");
        this._dessinerJaugeBarre();
        this._dessinerVisee();
    }

    _suivreVol(dt) {
        const C = window.SchieweschlaweConfig;

        // Altitude simulée (parabole) → échelle du disque.
        this.zVel -= this.graviteHauteur * dt;
        this.z += this.zVel * dt;
        const zNorm = Phaser.Math.Clamp(this.z / this.zMax, 0, 1);
        const echelle = 1 + C.lancer.grossissementMax * zNorm;
        this.disque.setDisplaySize(this.tailleDisque * echelle, this.tailleDisque * echelle);
        this.ombreDisque.setPosition(this.disque.x, this.disque.y);

        this.traineeTimer += dt * 1000;
        if (this.traineeTimer >= C.lancer.traineeIntervalMs) {
            this.traineeTimer -= C.lancer.traineeIntervalMs;
            const t = this.add.image(this.disque.x, this.disque.y, "trainee").setDepth(7);
            const taille = Arcade.UI.u(this, C.lancer.tailleDisquePct * 0.7);
            t.setDisplaySize(taille, taille);
            this.trainee.push({ obj: t, vie: 0.6 });
        }

        const sorti = this.disque.x < -60 || this.disque.x > this.w + 60 ||
            this.disque.y < -60 || this.disque.y > this.h + 60;
        if ((this.z <= 0 && this.zVel < 0) || sorti) this._atterrir(sorti);
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

    // --- Résultat du lancer --------------------------------------------------------

    _atterrir(sorti) {
        const C = window.SchieweschlaweConfig;
        const T = C.textes;
        const UI = Arcade.UI;

        this.etat = "resultat";
        this.disque.body.setVelocity(0, 0);
        this.disque.body.setAcceleration(0, 0);
        this.disque.setDisplaySize(this.tailleDisque, this.tailleDisque);

        const lx = this.disque.x;
        const ly = this.disque.y;
        const dansTerrain = !sorti && lx >= 0 && lx <= this.w &&
            ly >= this.pierreY - this.terrainLongueurPx && ly <= this.pierreY;

        // Marqueur d'atterrissage (borné à l'écran pour rester visible).
        this.marqueur = this.add.graphics().setDepth(5);
        this.marqueur.lineStyle(UI.u(this, 0.4),
            Phaser.Display.Color.HexStringToColor(C.couleurs.marqueur).color, 1);
        this.marqueur.strokeCircle(
            Phaser.Math.Clamp(lx, 8, this.w - 8), Phaser.Math.Clamp(ly, 8, this.h - 8),
            UI.u(this, 2.5));

        const ecart = Math.hypot(lx - this.cibleX, ly - this.cibleY);
        const touche = dansTerrain && ecart <= this.rayonCible;
        // Proximité : 100 % au centre exact, 0 % au bord de la cible.
        const proximite = touche
            ? Math.round(100 * (1 - ecart / this.rayonCible)) : 0;

        if (touche) {
            const plein = ecart <= this.rayonCible * C.cible.pleinCentreRatio;
            this.texteResultat.setText((plein ? T.pleinCentre : T.touche)
                .replace("{p}", proximite));
            this.time.delayedCall(C.lancer.delaiResultatMs, () => {
                this.scene.start("fin", {
                    niveau: this.niv.n, reussi: true,
                    lancers: this.lancerNum, proximite: proximite
                });
            });
            return;
        }

        this.texteResultat.setText(dansTerrain ? T.rate : T.horsTerrain);
        if (this.lancerNum >= C.niveaux.lancersParNiveau) {
            this.time.delayedCall(C.lancer.delaiResultatMs, () => {
                this.scene.start("fin", { niveau: this.niv.n, reussi: false });
            });
            return;
        }
        // Le bouton d'action reste à sa place (bas-droite) et devient
        // « Relancer » : rien ne se pose sur le terrain, la cible et le
        // point d'impact restent visibles pour corriger le tir.
        this.peutRelancer = true;
        this._majBoutonAction();
    }

    _lancerSuivant() {
        if (this.etat !== "resultat" || !this.peutRelancer) return;
        this.peutRelancer = false;
        this.lancerNum += 1;
        this._majHudLancer();
        this.etat = "placement";

        this.trainee.forEach((t) => t.obj.destroy());
        this.trainee = [];
        if (this.marqueur) { this.marqueur.destroy(); this.marqueur = null; }
        this.texteResultat.setText("");

        // Le disque reprend la DERNIÈRE visée : le joueur corrige son tir
        // au lieu de tout recommencer depuis le centre.
        this._majVisee();
        this._poserDisqueVisuel();
        this._dessinerVisee();
        this._majBoutonAction();
    }
}
