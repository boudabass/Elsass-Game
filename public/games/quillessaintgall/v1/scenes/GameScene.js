/*
 * GameScene — Quilles Saint-Gall, une VRAIE partie (PRD 875 §7-9) : 17
 * jets en 6 phases, par-dessus la mécanique de tir et la physique de
 * collision du spike v1, VALIDÉES par John le 30/08/2026 (commit
 * 6fa096e) et NON MODIFIÉES ici : placement dans un demi-cercle, visée
 * par boutons ◄/►, force réglable, jauge de précision à zone fixe,
 * collision boule/quilles par test de distance manuel (cf. commentaires
 * de chaque méthode concernée, tous conservés tels quels).
 *
 * Ce que cette scène ajoute (30/08/2026, PRD §7-9, hors studio) :
 *   1. LES 17 JETS / 6 PHASES (config.jets) : chaque jet démarre avec un
 *      sous-ensemble de quilles debout (toutes, sauf en phase C — figure,
 *      cf. §8), et un barème propre (points/quille, figure, ordre imposé).
 *   2. LE SCORE CUMULÉ (0-200), affiché dans le panneau d'info (colonne de
 *      droite, pleine hauteur depuis le 31/08) à la place du compteur de
 *      quilles tombées EN DIRECT du spike (PRD §3).
 *   3. L'ORDRE IMPOSÉ (phases D/E) : la chute de chaque quille est
 *      horodatée (`ordreChute`) pendant le jet ; à l'arrêt de la boule,
 *      on vérifie que les quilles REQUISES sont tombées dans le bon
 *      ordre, sans que 2 d'entre elles tombent au même frame (sinon jet
 *      ANNULÉ, quilles relevées, jusqu'à `config.partie.tentativesMax`
 *      essais — cf. _calculerOrdreJet, interprétation prototype
 *      documentée dans l'en-tête de config.js).
 *   4. L'ÉCRAN DE FIN DE PARTIE (jet 17 résolu) : score final /200,
 *      envoi à Arcade.Score (meilleur score), bouton pour rejouer une
 *      partie complète depuis le jet 1.
 *
 * Volontairement HORS SCOPE (PRD §10/12, non tranché par John) : paliers
 * de difficulté, mode tutoriel, scène Menu séparée — la partie démarre
 * directement au jet 1 à l'ouverture du jeu, comme le spike.
 */
class GameScene extends Phaser.Scene {
    static KEY = "jeu";

    constructor() {
        super(GameScene.KEY);
    }

    /**
     * Génère les textures du jeu (aucune image téléchargée). Appelé une
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
        // Vue du dessus : pas de gravité de monde.
        this.physics.world.gravity.y = 0;

        // États : placement → jauge → feedback → lancer → jetResultat →
        // (placement du jet suivant, OU finPartie après le jet 17).
        this.etat = "placement";
        this.glisse = false;

        // Jauge de précision (état interne au tir en cours, indépendant
        // du jet/de la partie).
        this.jaugeTemps = 0;
        this.jaugeNeedle = 0.5;
        this.jaugeZoneCentre = 0.5;
        this.jaugeDeviation = 0;
        this.jaugeZoneOrangeLargeurPctActuelle = window.QuillesSaintGallConfig.jauge.zoneOrangeLargeurMaxPct;
        this.feedbackRestant = 0;
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

        // Démarre la partie (jet 1) : ne positionne rien visuellement tant
        // que la géométrie de l'écran (this.w/this.h) n'est pas connue —
        // _demarrerJet() s'en charge lui-même (cf. son commentaire).
        this._demarrerPartie();

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
        // Une quille qui glisse peut à son tour en renverser une autre
        // (règle fédérale des ricochets, cf. GameScene._verifierCollisionsEntreQuilles).
        this._verifierCollisionsEntreQuilles();
    }

    // --- Partie / jets (PRD §7-9) ----------------------------------------------

    /** Démarre une NOUVELLE partie complète : score à 0, jet 1. */
    _demarrerPartie() {
        this.scoreTotal = 0;
        this.tentativeCourante = 1;
        this._masquerRetourJet();
        this._demarrerJet(1);
    }

    /**
     * Démarre (ou REJOUE, si `n` est le même jet après une annulation
     * d'ordre imposé) le jet `n` : résout sa config, remet les quilles à
     * l'état de CE jet (toutes debout, sauf en phase C où seules les 4
     * quilles de la figure sont présentes — les 5 autres sont ABSENTES,
     * cf. _appliquerEtatQuille), remet visée/force par défaut.
     *
     * Ne positionne RIEN visuellement tant que `this.w` n'est pas encore
     * connu (1er appel, depuis create(), avant que Arcade.UI.layout ait
     * tourné une première fois) — le layout initial s'en chargera. Pour
     * tous les appels suivants (jet suivant, retry, rejouer la partie),
     * `this.w` existe déjà : on peut directement redessiner via
     * _recalculerGeometrie(), qui fait tout le travail (quilles, visée,
     * boule, textes) sans rien dupliquer.
     */
    _demarrerJet(n) {
        const C = window.QuillesSaintGallConfig;
        this.numeroJet = n;
        this.jetConfig = C.jets[n - 1];
        this.ordreChute = [];
        this.frameId = 0;
        this.quillesTombeesCount = 0;
        this.roiTombe = false;

        // Phases D/E (ordre imposé) : la figure reste posée UNE SEULE FOIS
        // pour toute la phase (règlement fédéral : "jets d'affilée" sur la
        // même figure, pas remise à neuf à chaque jet) — remplace la
        // simplification "reset à chaque jet" de la 1re correction, sur
        // demande explicite de John. `this.ordrePhaseAbattues` (Set des
        // indices déjà légitimement tombés) n'est réinitialisé qu'au 1er
        // jet de la phase (9 ou 14) ; cf. _calculerOrdreJet pour son usage.
        const jc = this.jetConfig;
        if (jc.type === "ordre" && (n === 9 || n === 14)) {
            this.ordrePhaseAbattues = new Set();
        }

        // Sous-ensemble de quilles présentes pour ce jet : phase C
        // (figure) ET phases D/E (ordre imposé) ont un `figure.indices`
        // propre — seules les phases A/B ("plein") gardent les 9 quilles.
        const figureIndices = (jc.type === "figure" || jc.type === "ordre")
            ? jc.figure.indices : null;
        const abattuesPhase = jc.type === "ordre" ? this.ordrePhaseAbattues : null;
        this.quilles.forEach((q) => {
            const idx = q.getData("index");
            const dansLeJet = !figureIndices || figureIndices.includes(idx);
            const dejaAbattue = !!abattuesPhase && abattuesPhase.has(idx);
            q.setData("debout", dansLeJet && !dejaAbattue);
            q.setData("absente", !dansLeJet);
            q.setData("vx", 0);
            q.setData("vy", 0);
            q.setAngle(0);
        });

        this.force = C.force.defaut;
        this.placementFracX = 0;
        this.placementFracY = 0.5;
        this.aimAngleDeg = 0;
        this.etat = "placement";

        this._majTextesProgression();
        this._majConsigneJet();
        this._montrerConsignes();
        this._masquerRetourJet();

        if (this.w !== undefined) this._recalculerGeometrie();
    }

    /**
     * Avance au jet suivant (ou de 2, en cas de ricochet validant aussi
     * le jet suivant d'un coup — cf. _calculerOrdreJet), ou termine la
     * partie si on dépasse le jet 17.
     */
    _avancerApresJet(pas = 1) {
        const prochain = this.numeroJet + pas;
        if (prochain <= 17) {
            this._demarrerJet(prochain);
        } else {
            this._terminerPartie();
        }
    }

    /**
     * Fin de partie (jet 17 résolu, succès ou échec définitif) : envoie
     * le score au classement (Arcade.Score ne garde que le meilleur),
     * affiche le score final et propose de rejouer une partie complète.
     */
    async _terminerPartie() {
        const C = window.QuillesSaintGallConfig;
        this.etat = "finPartie";
        this._cacherConsignes();

        const nouveauRecord = await Arcade.Score.submit(this.scoreTotal);
        const texteRecord = nouveauRecord
            ? C.textes.nouveauRecord
            : C.textes.meilleurScore.replace("{score}", Arcade.Score.best);

        this.texteResultat.setText(
            C.textes.finPartie + "\n" +
            C.textes.scoreFinalTexte.replace("{score}", this.scoreTotal) + "\n" +
            texteRecord
        ).setVisible(true);

        if (this.boutonRejouer) { this.boutonRejouer.destroy(); this.boutonRejouer = null; }
        this.boutonRejouer = Arcade.UI.bouton(this, {
            label: C.textes.rejouerPartie,
            couleur: C.couleurs.bouton,
            textColor: C.couleurs.texte,
            onClick: () => this._demarrerPartie()
        });

        this._positionnerTextes();
    }

    /** Texte de progression du panneau d'info (colonne de droite) : « Jet n/17 · Score ». */
    _majTextesProgression() {
        const C = window.QuillesSaintGallConfig;
        const jet = C.textes.jetProgression.replace("{n}", this.numeroJet);
        const score = C.textes.scoreCumule.replace("{score}", this.scoreTotal);
        this.texteCompteur.setText(jet + "\n" + score);
    }

    /**
     * consigne2 (2e ligne d'instructions) devient spécifique au jet en
     * cours pour les phases C (prépondérante) et D/E (ordre imposé) — les
     * phases A/B gardent l'instruction générique sur la force.
     */
    _majConsigneJet() {
        const C = window.QuillesSaintGallConfig;
        const jc = this.jetConfig;
        if (jc.type === "figure") {
            this.consigne2.setText(
                C.textes.prependerante.replace("{n}", jc.figure.prependerante + 1));
        } else if (jc.type === "ordre") {
            this.consigne2.setText(C.textes.cibleARenverser.replace("{n}", jc.cible + 1));
        } else if (jc.type === "plein" && jc.prependerante !== undefined) {
            this.consigne2.setText(
                C.textes.prependerante.replace("{n}", jc.prependerante + 1));
        } else {
            this.consigne2.setText(C.textes.consigneLigne2);
        }
    }

    _masquerRetourJet() {
        if (this.boutonRejouer) { this.boutonRejouer.destroy(); this.boutonRejouer = null; }
        this.texteResultat.setVisible(false).setText("");
    }

    /**
     * Affiche l'écran entre 2 jets (résultat du jet qui vient de se
     * terminer + un bouton dont le libellé et l'action dépendent du cas :
     * jet suivant, nouvel essai (ordre non respecté), ou fin de partie.
     * Le bouton est toujours RECRÉÉ (jamais réutilisé) : Arcade.UI.bouton
     * ne permet pas de changer son onClick après coup.
     */
    _afficherRetourJet(o) {
        this.etat = "jetResultat";
        this._cacherConsignes();
        this.texteResultat.setText(o.texte).setVisible(true);

        if (this.boutonRejouer) { this.boutonRejouer.destroy(); this.boutonRejouer = null; }
        const C = window.QuillesSaintGallConfig;
        this.boutonRejouer = Arcade.UI.bouton(this, {
            label: o.boutonLabel,
            couleur: C.couleurs.bouton,
            textColor: C.couleurs.texte,
            onClick: o.onContinuer
        });

        this._positionnerTextes();
    }

    // --- Score du jet (PRD §7-9) -------------------------------------------

    /**
     * Calcule le résultat du jet qui vient de se terminer, selon son
     * type (cf. config.jets) : { annule, points }. `annule` ne peut être
     * vrai que pour un jet à ordre imposé (D/E) — cf. _calculerOrdreJet.
     */
    _calculerScoreJet() {
        const jc = this.jetConfig;
        if (jc.type === "plein") {
            // Jet 4 (phase B) : 2 bois/quille SI le Roi (idx4) est tombé,
            // sinon 1 bois/quille (texte fédéral) — jets 1-3 n'ont pas de
            // `prependerante` et gardent le barème flat `pointsParQuille`.
            if (jc.prependerante !== undefined) {
                const prependeranteEstTombee = this._quilleEstTombee(jc.prependerante);
                const parQuille = prependeranteEstTombee ? jc.pointsSiPrependerante : jc.pointsSinon;
                return { annule: false, points: this.quillesTombeesCount * parQuille };
            }
            return { annule: false, points: this.quillesTombeesCount * jc.pointsParQuille };
        }
        if (jc.type === "figure") {
            const prependeranteEstTombee = this._quilleEstTombee(jc.figure.prependerante);
            const parQuille = prependeranteEstTombee ? jc.pointsSiPrependerante : jc.pointsSinon;
            return { annule: false, points: this.quillesTombeesCount * parQuille };
        }
        return this._calculerOrdreJet(jc);
    }

    _quilleEstTombee(index) {
        const q = this.quilles[index];
        return !!q && !q.getData("debout") && !q.getData("absente");
    }

    /**
     * Ordre imposé (phases D/E, règlement fédéral, persistance des
     * quilles tombées cf. _demarrerJet) : la figure est posée une seule
     * fois pour toute la phase, ce jet ne vise qu'UNE quille cible
     * (jc.cible, les autres quilles ENCORE debout de la figure restent
     * des obstacles), avec sa propre valeur en points (jc.points).
     *   - la cible tombe SEULE → points = jc.points, elle reste tombée
     *     pour la suite de la phase (cf. _jetTermine) ;
     *   - EXCEPTION fédérale (jc.ricochetAutorise, jets 12/16
     *     uniquement) : la cible ET la TOUTE DERNIÈRE quille de la phase
     *     tombent ENSEMBLE (ricochet), rien d'autre → pas une faute, les
     *     2 jets sont validés d'un coup (cf. _jetTermine, avance de 2) ;
     *   - tout autre cas (cible non tombée, ou une AUTRE quille tombe) →
     *     jet annulé (nouvel essai, article 11).
     */
    _calculerOrdreJet(jc) {
        const chutes = this.ordreChute.filter((c) => jc.figure.indices.includes(c.index));
        const indicesChus = chutes.map((c) => c.index);

        if (jc.ricochetAutorise) {
            const derniere = this._dernierCiblePhase(jc.phase);
            const estRicochet = indicesChus.length === 2 &&
                indicesChus.includes(jc.cible) && indicesChus.includes(derniere.cible);
            if (estRicochet) {
                return { annule: false, points: jc.points, ricochet: true,
                    pointsSupplementaires: derniere.points };
            }
        }

        if (indicesChus.length !== 1 || indicesChus[0] !== jc.cible) return { annule: true };
        return { annule: false, points: jc.points };
    }

    /** Cible + points du DERNIER jet de la phase D ou E (exception de
     * ricochet, cf. _calculerOrdreJet / _jetTermine). */
    _dernierCiblePhase(phase) {
        const C = window.QuillesSaintGallConfig;
        const jetsPhase = C.jets.filter((j) => j.phase === phase);
        const dernier = jetsPhase[jetsPhase.length - 1];
        return { cible: dernier.cible, points: dernier.points };
    }

    // --- Création des éléments ------------------------------------------------

    _creerDecor() {
        this.ciel = this.add.graphics().setDepth(0);
        this.sol = this.add.graphics().setDepth(1);
    }

    _creerQuilles() {
        const C = window.QuillesSaintGallConfig;
        this.quilles = [];
        this.numerosQuille = [];
        // Marqueur (anneau) de la quille prépondérante — phase C uniquement.
        this.prependeranteG = this.add.graphics().setDepth(4.5);

        for (let i = 0; i < 9; i++) {
            const q = this.add.sprite(0, 0, "quille").setDepth(4);
            q.setData("index", i);
            q.setData("roi", i === 8);
            q.setData("debout", true);
            q.setData("absente", false);
            q.setData("rayon", 0);
            q.setData("vx", 0);
            q.setData("vy", 0);
            this.quilles.push(q);

            // Numéro (1-9) affiché UNIQUEMENT pendant les jets à ordre
            // imposé (D/E) — indispensable pour que le joueur sache quelle
            // quille est laquelle (le PRD §6 ne prévoyait cette
            // numérotation que comme référence interne à config.js).
            const num = Arcade.UI.text(this, 0, 0, String(i + 1), 2.4, C.couleurs.texteSombre)
                .setDepth(5).setVisible(false);
            this.numerosQuille.push(num);
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
        // Largeur totale de la piste (demande John, 31/08 : passée de 1/3 à
        // 2/3 de l'écran, À GAUCHE — colonne de droite = 1/3, dédiée au
        // panneau d'info sur toute la hauteur, cf. _dessinerDecor /
        // _positionnerTextes). Cf. _positionnerQuilles pour le pourquoi :
        // l'écart entre quilles voisines (ex. jet 9, quilles 4/5) est
        // proportionnel à CETTE largeur, alors que le rayon boule/quille
        // suit u() (plus petit côté) — en portrait/carré, où u() = w, une
        // piste à 1/3 de large rendait cet écart tout juste égal au
        // diamètre de la boule (infranchissable sans toucher les 2 quilles).
        // Doubler la largeur double l'écart sans toucher aux rayons.
        this.pisteLargeur = this.colLargeur * 2;

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

        // Piste (brune, visible) : les 2/3 de GAUCHE de l'écran (seule zone
        // atteignable par la boule), du haut de l'écran (fosse) à la ligne
        // de lancer — pas toute la largeur, pour qu'elle se distingue
        // clairement du panneau d'info (demande John, 30/08). Passée de 1/3
        // à 2/3 le 31/08 (demande John, cf. this.pisteLargeur) : le 1/3
        // restant (droite) devient un panneau d'info sur TOUTE la hauteur,
        // pas seulement la zone de recul.
        const w3 = this.colLargeur;
        const wp = this.pisteLargeur;
        this.sol.clear();
        this.sol.fillStyle(cPiste, 1);
        this.sol.fillRect(0, 0, wp, this.ligneLancerY);
        this.sol.lineStyle(Math.max(1, UI.u(this, 0.25)), cBord, 0.9);
        this.sol.strokeRect(0, 0, wp, this.ligneLancerY);

        // Panneau d'info (colonne de droite, 1/3, PLEINE HAUTEUR — demande
        // John 31/08) : légèrement teinté sur toute la hauteur pour se
        // distinguer visuellement, y compris au-dessus de la ligne de
        // lancer (où il n'y avait rien avant, juste le ciel).
        this.sol.fillStyle(cRecul, 0.6);
        this.sol.fillRect(wp, 0, w - wp, h);
        this.sol.lineStyle(Math.max(1, UI.u(this, 0.2)), cBord, 0.6);
        this.sol.lineBetween(wp, 0, wp, h);

        // Zone de recul (bas d'écran, piste sur ses 2 colonnes — visée à
        // gauche, force/tirer à droite) : même teinte que la piste,
        // continuité visuelle.
        this.sol.fillStyle(cRecul, 1);
        this.sol.fillRect(0, this.ligneLancerY, wp, h - this.ligneLancerY);
        this.sol.fillStyle(cPiste, 0.35);
        this.sol.fillRect(0, this.ligneLancerY, wp, h - this.ligneLancerY);
        this.sol.lineStyle(Math.max(1, UI.u(this, 0.15)), cBord, 0.8);
        this.sol.lineBetween(w3, this.ligneLancerY, w3, h);
    }

    // --- Cercle de placement (zone de recul) ------------------------------------

    /**
     * Demi-cercle dans lequel la boule peut se placer (demande John,
     * 30/08) : le côté plat est collé à la ligne de lancer, la courbe
     * descend dans la zone de recul. Confiné à la colonne de GAUCHE de la
     * piste (this.colLargeur, PAS this.pisteLargeur — demande John 31/08 :
     * la piste s'est élargie à 2/3 pour l'écart entre quilles, mais la
     * visée/le tir gardent la même colonne qu'avant, désormais à gauche,
     * pour laisser la colonne de droite aux contrôles de force/tirer sans
     * chevauchement). Rayon plafonné à une fraction de la hauteur de la
     * zone de recul (`demiCercleRayonMaxFacteurHauteur`) pour TOUJOURS
     * laisser de la place aux boutons ◄/► en bas.
     */
    _calculerGeometrieCercle() {
        const C = window.QuillesSaintGallConfig;
        const w = this.w, h = this.h;
        const hauteurZone = h - this.ligneLancerY;
        const rayonMaxHauteur = hauteurZone * C.recul.demiCercleRayonMaxFacteurHauteur;
        this.cercleRayon = Math.min(this.colLargeur / 2, rayonMaxHauteur);
        this.cercleX = this.colLargeur / 2;
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

        // Colonne de GAUCHE (0..w3, même colonne que le demi-cercle —
        // demande John 31/08, cf. _calculerGeometrieCercle).
        this.boutonRotGauche.redimensionner(largeurBtn, hauteurDispo)
            .setPosition(marge + largeurBtn / 2, yCentre);
        this.boutonRotDroite.redimensionner(largeurBtn, hauteurDispo)
            .setPosition(w3 - marge - largeurBtn / 2, yCentre);
    }

    /**
     * Libellé « Force » + barre + boutons -/+ : 2e colonne de la piste
     * (w3..pisteLargeur — demande John 31/08 : la piste occupe maintenant
     * les 2/3 gauches en 2 colonnes, visée à gauche / force+tirer au
     * milieu ; auparavant colonne de DROITE quand la piste ne faisait que
     * 1/3), AU-DESSUS du bouton « Tirer » (demande John, 30/08, précisée
     * 2 fois : Tirer en bas de la colonne pour laisser la place ; un vrai
     * espace entre la barre et les boutons, pas collés). Utilise
     * `this.tirerTop`, calculé par `_positionnerBouton()` — DOIT être
     * appelée avant.
     *
     * Empilement en fractions de l'espace disponible (haut → bas), avec un
     * espace explicite (16%) entre la barre et les boutons :
     * libellé 0-14% / barre 16-32% / ESPACE 32-48% / boutons 48-92%.
     */
    _positionnerControlesForce() {
        const UI = Arcade.UI;
        const w3 = this.colLargeur;
        const marge = UI.u(this, 1.5);
        const xCentre = w3 + w3 / 2;

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

    /**
     * Losange (quinconce 1-2-3-2-1), PAS un carré 3×3 — corrigé le
     * 30/08/2026 (soir) d'après le vrai schéma fédéral (article 780,
     * cf. en-tête de config.js). `POSITIONS[i]` donne, pour chaque indice
     * de quille (0-8, fond → avant), sa rangée (0=fond … 4=pointe avant =
     * le Roi) et son décalage horizontal en fraction de la demi-largeur
     * de la rangée du milieu (la plus large, 3 quilles) — modèle "grille
     * 3×3 tournée à 45°" (rangées de 2 à mi-écart de la rangée de 3).
     */
    _positionnerQuilles() {
        const C = window.QuillesSaintGallConfig;
        const UI = Arcade.UI;
        const h = this.h;
        // Largeur de la rangée du milieu (la plus large) = largeur de la
        // piste (this.pisteLargeur, 2/3 de l'écran depuis le 31/08 — demande
        // John, cf. commentaire de this.pisteLargeur : avant 1/3, l'écart
        // entre 2 quilles voisines de cette rangée pouvait devenir plus
        // étroit que le diamètre de la boule en portrait/carré), moins une
        // marge de chaque côté (quillesMargeLateralePct, demande John
        // 30/08) pour laisser de l'espace visible entre les quilles et le
        // bord de la piste.
        const margeFacteur = C.piste.quillesMargeLateralePct / 100;
        const zoneLargeurPx = this.pisteLargeur * (1 - 2 * margeFacteur);
        const centreX = this.pisteLargeur / 2;
        // 5 rangées réparties à intervalles réguliers entre les 2 bornes
        // de config (0=fond=quillesZoneHautYPct … 4=pointe avant/Roi=
        // quillesZoneBasYPct).
        const yHaut = C.piste.quillesZoneHautYPct;
        const yBas = C.piste.quillesZoneBasYPct;
        const rangeesYPct = [0, 1, 2, 3, 4].map((r) => yHaut + (r / 4) * (yBas - yHaut));

        const POSITIONS = [
            { row: 0, dx: 0 },
            { row: 1, dx: -0.5 }, { row: 1, dx: 0.5 },
            { row: 2, dx: -1 }, { row: 2, dx: 0 }, { row: 2, dx: 1 },
            { row: 3, dx: -0.5 }, { row: 3, dx: 0.5 },
            { row: 4, dx: 0 }
        ];

        this.rayonQuille = UI.u(this, C.quille.rayonPct);
        this.rayonRoi = UI.u(this, C.quille.rayonRoiPct);

        const showNumeros = this.jetConfig && this.jetConfig.type === "ordre";

        this.quilles.forEach((q, i) => {
            const pos = POSITIONS[i];
            const x = centreX + pos.dx * (zoneLargeurPx / 2);
            const y = (rangeesYPct[pos.row] / 100) * h;
            const rayonVisuel = q.getData("roi") ? this.rayonRoi : this.rayonQuille;

            q.setPosition(x, y);
            q.setDisplaySize(rayonVisuel * 2, rayonVisuel * 2);
            // Rayon de collision (test manuel, cf. _suivreBoule) : dérivé du
            // rayon visuel réel affiché à l'écran, pas d'un corps Arcade.
            q.setData("rayon", rayonVisuel * C.quille.rayonCollisionFacteur);

            this._appliquerEtatQuille(q);

            const num = this.numerosQuille[i];
            num.setPosition(x, y).setFontSize(Math.round(UI.u(this, 2.4)) + "px");
            num.setVisible(showNumeros && q.getData("debout"));
        });

        this._dessinerMarqueurPrependerante();
    }

    /**
     * Anneau doré autour de la quille prépondérante du jet en cours
     * (phase C uniquement) — nécessaire pour que le joueur sache laquelle
     * compte le plus, sans quoi le barème « 5 bois si la prépondérante
     * tombe » n'est pas jouable.
     */
    _dessinerMarqueurPrependerante() {
        const C = window.QuillesSaintGallConfig;
        const UI = Arcade.UI;
        this.prependeranteG.clear();
        const jc = this.jetConfig;
        if (!jc) return;
        let idx;
        if (jc.type === "figure") idx = jc.figure.prependerante;
        else if (jc.type === "plein" && jc.prependerante !== undefined) idx = jc.prependerante;
        else return;
        const q = this.quilles[idx];
        const coul = Phaser.Display.Color.HexStringToColor(C.couleurs.quilleRoi).color;
        this.prependeranteG.lineStyle(UI.u(this, 0.5), coul, 0.9);
        this.prependeranteG.strokeCircle(q.x, q.y, this.rayonQuille * 1.5);
    }

    /**
     * `absente` (nouveau, PRD §7 phase C) : la quille n'est PAS présente
     * sur la piste pour ce jet (hors figure) — entièrement invisible,
     * jamais collisionnable (elle reste `debout=false`, déjà exclue par
     * _suivreBoule). Distinct d'une quille simplement TOMBÉE (visible,
     * grisée).
     */
    _appliquerEtatQuille(q) {
        const C = window.QuillesSaintGallConfig;
        if (q.getData("absente")) {
            q.setVisible(false);
            return;
        }
        q.setVisible(true);
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

        // Horodatage de la chute (frame courant) — utilisé par
        // _calculerOrdreJet pour vérifier l'ordre imposé et détecter les
        // chutes simultanées (phases D/E uniquement, inoffensif sinon).
        this.ordreChute.push({ index: quille.getData("index"), frame: this.frameId });
        this.numerosQuille[quille.getData("index")].setVisible(false);

        // Petite chute visuelle (rotation + tassement).
        this.tweens.add({
            targets: quille,
            angle: 90,
            scaleY: 0.5,
            duration: 220,
            ease: "Quad.easeOut"
        });
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
        // Centrée sur la PISTE (pas tout l'écran) — même raison que
        // _positionnerTextes (demande John 31/08).
        const wp = this.pisteLargeur;

        this.jaugeG.clear();
        if (this.etat !== "jauge" && this.etat !== "feedback") return;

        const largeur = (C.jauge.largeurPct / 100) * wp;
        const hauteur = UI.u(this, C.jauge.hauteurU);
        const x = (wp - largeur) / 2;
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
        // du tir, au-dessus de « Tirer »).
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

        // Un frame de plus pour cette course de la boule (sert à détecter
        // les chutes simultanées d'un ordre imposé, cf. _calculerOrdreJet).
        this.frameId++;

        // Collision boule/quilles : test de distance manuel (cf. commentaire
        // de classe) contre chaque quille encore PRÉSENTE (`!absente`), pas
        // seulement celles encore debout — une quille déjà tombée reste un
        // obstacle physique au sol, la boule ne doit jamais la traverser
        // (demande John, 31/08 : avant, une quille tombée était totalement
        // ignorée par la détection de collision, la boule passait au
        // travers dès qu'elle avait marqué). Une quille déjà tombée est
        // toujours traitée comme un "mur" (`renverse` forcé à faux) : elle
        // ne peut plus marquer de point ni retomber une 2e fois, mais
        // bloque/dévie la boule comme n'importe quel obstacle. Si le choc
        // est trop faible (vitesseMinRenversePct) sur une quille ENCORE
        // debout, elle agit aussi comme un mur (rebond quasi complet, elle
        // reste debout). Sinon elle tombe ET reçoit une partie de la
        // quantité de mouvement de la boule (demande John, 30/08) : cf.
        // _reagirCollision.
        const rBoule = this.boule.displayWidth / 2;
        const seuilRenverse = (C.boule.vitesseMinRenversePct / 100) * this.h;
        const vitesseMax = this._vitesseMaxLancer();
        this.quilles.forEach((q) => {
            if (q.getData("absente")) return;
            const rQ = q.getData("rayon");
            const dx = this.boule.x - q.x;
            const dy = this.boule.y - q.y;
            const rSomme = rBoule + rQ;
            const distSq = dx * dx + dy * dy;
            if (distSq <= rSomme * rSomme) {
                const v0 = this.boule.body.velocity;
                const vitesseImpact = Math.hypot(v0.x, v0.y);
                const debout = q.getData("debout");
                const renverse = debout && vitesseImpact >= seuilRenverse;
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
        // piste (this.pisteLargeur de large, pas toute la largeur de
        // l'écran) — le vrai jeu interdit à la boule de toucher les côtés
        // de la piste avant les quilles (article 780), on modélise ça comme
        // fin du jet, cohérent avec les rebonds qui peuvent maintenant la
        // dévier latéralement.
        const dehors = this.boule.y < -20 || this.boule.x < -20 || this.boule.x > this.pisteLargeur + 20;

        // Filet de sécurité : après plusieurs rebonds amortis, la boule
        // peut devenir trop lente pour jamais sortir de la zone de quilles
        // — on l'arrête plutôt que de la laisser trembler indéfiniment.
        const v = this.boule.body.velocity;
        const tropLente = Math.hypot(v.x, v.y) < (C.boule.vitesseArretPct / 100) * this.h;
        if (dehors || tropLente) this._jetTermine();
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
     * Si la quille NE tombe PAS (choc trop faible, ou quille déjà tombée
     * mais toujours présente au sol) : elle agit comme un obstacle, la
     * boule DÉVIE sur le côté (composante vers l'obstacle retirée de sa
     * vitesse) amortie par `boule.amortissementRebond` — PAS de rebond en
     * arrière façon billard (v' = v - 2(v·n)n aurait pu renvoyer la boule
     * vers le lanceur ; demande John, 31/08 : au bowling/aux quilles, la
     * boule ne revient jamais en arrière, elle continue toujours vers
     * l'avant, quitte à dévier).
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
            // Modèle "obstacle" : la quille ne bouge pas, la boule NE
            // REBONDIT JAMAIS EN ARRIÈRE — on retire seulement la
            // composante de vitesse qui fonce DANS l'obstacle (le long de
            // la normale de contact), la composante tangentielle (le long
            // de la quille) est conservée : la boule glisse/dévie sur le
            // côté et continue sa route, elle ne repart pas vers le
            // lanceur comme un rebond de billard.
            const vN = v.x * nx + v.y * ny;
            let vx = v.x, vy = v.y;
            if (vN < 0) {   // la boule allait bien VERS la quille
                vx = v.x - vN * nx;
                vy = v.y - vN * ny;
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

    /**
     * Une quille qui GLISSE après avoir été renversée peut à son tour en
     * renverser une autre encore debout — règle fédérale explicitement
     * prévue ("dans le cas où une quille régulièrement renversée revenait
     * de la fosse pour en renverser une autre, le jet est considéré comme
     * valable", cf. article 780 + exceptions de ricochet des jets 12/16)
     * mais jamais simulée physiquement jusqu'ici (demande John, 31/08).
     *
     * Même principe que la collision boule/quille (_reagirCollision), en
     * plus simple (pas de formule qui varie avec la vitesse d'impact —
     * une seule fraction fixe) :
     *   - vitesse de la quille qui glisse EN DESSOUS du seuil → la cible
     *     agit comme un mur, la quille source rebondit (amorti) ;
     *   - AU-DESSUS → la cible tombe (_toucherQuille, même bookkeeping
     *     que pour un choc de boule : score, ordreChute, numéro, animation)
     *     et hérite d'une fraction de la vitesse de la source, qui
     *     continue elle-même sa glissade à vitesse réduite d'autant —
     *     la chaîne peut donc se poursuivre sur plusieurs quilles.
     */
    _verifierCollisionsEntreQuilles() {
        const C = window.QuillesSaintGallConfig;
        const seuil = (C.quille.vitesseMinRenverseAutreQuillePct / 100) * this.h;
        this.quilles.forEach((source) => {
            const vx = source.getData("vx") || 0;
            const vy = source.getData("vy") || 0;
            const vitesse = Math.hypot(vx, vy);
            if (vitesse <= 0) return;

            this.quilles.forEach((cible) => {
                if (cible === source || !cible.getData("debout")) return;
                const dx = source.x - cible.x, dy = source.y - cible.y;
                const dist = Math.hypot(dx, dy);
                const rSomme = source.getData("rayon") + cible.getData("rayon");
                if (dist > rSomme) return;

                const nx = dist > 0.001 ? dx / dist : 0;
                const ny = dist > 0.001 ? dy / dist : -1;
                // Repousse la source hors du chevauchement (évite un
                // contact permanent qui redéclencherait la collision en boucle).
                source.x += nx * (rSomme - dist);
                source.y += ny * (rSomme - dist);

                if (vitesse < seuil) {
                    const vN = vx * nx + vy * ny;
                    if (vN < 0) {
                        const amorti = C.quille.amortissementRebondEntreQuilles;
                        source.setData("vx", (vx - 2 * vN * nx) * amorti);
                        source.setData("vy", (vy - 2 * vN * ny) * amorti);
                    }
                    return;
                }

                this._toucherQuille(cible);
                const fraction = C.quille.transfertFacteurEntreQuilles;
                const dirX = vx / vitesse, dirY = vy / vitesse;
                cible.setData("vx", dirX * vitesse * fraction);
                cible.setData("vy", dirY * vitesse * fraction);
                source.setData("vx", vx * (1 - fraction));
                source.setData("vy", vy * (1 - fraction));
            });
        });
    }

    /**
     * La boule s'arrête : le jet est terminé — calcule le score (ou
     * l'annulation) via _calculerScoreJet(), puis affiche l'écran de
     * retour de jet avec l'action appropriée (nouvel essai / jet suivant
     * / fin de partie). Remplace l'ancien `_arreterBoule` du spike (qui
     * ne faisait que compter les quilles tombées et proposer "Rejouer").
     */
    _jetTermine() {
        const C = window.QuillesSaintGallConfig;
        this.etat = "jetResultat";
        this.boule.body.setVelocity(0, 0);
        this.ombreBoule.setVisible(false);

        const jc = this.jetConfig;
        const resultat = this._calculerScoreJet();

        if (resultat.annule) {
            this.tentativeCourante++;
            if (this.tentativeCourante <= C.partie.tentativesMax) {
                this._afficherRetourJet({
                    texte: C.textes.ordreNonRespecte.replace("{n}", this.tentativeCourante),
                    boutonLabel: C.textes.rejouerJet,
                    onContinuer: () => this._demarrerJet(this.numeroJet)
                });
                return;
            }
            // 3 essais épuisés : 0 point pour ce jet, on avance. En ordre
            // imposé, la cible reste debout (obstacle pour la suite de la
            // phase, cf. _calculerOrdreJet) — pas ajoutée à
            // ordrePhaseAbattues puisqu'elle n'est jamais tombée.
            this.tentativeCourante = 1;
            this._afficherRetourJet({
                texte: C.textes.jetAnnuleDefinitif,
                boutonLabel: this.numeroJet < 17 ? C.textes.continuer : C.textes.finPartie,
                onContinuer: () => this._avancerApresJet()
            });
            return;
        }

        // Ordre imposé (D/E) : la cible reste abattue pour le reste de la
        // phase (persistance, cf. _demarrerJet) ; un ricochet valide (jets
        // 12/16) abat aussi la toute dernière quille de la phase.
        if (jc.type === "ordre") {
            this.ordrePhaseAbattues.add(jc.cible);
            if (resultat.ricochet) {
                this.ordrePhaseAbattues.add(this._dernierCiblePhase(jc.phase).cible);
            }
        }

        const pointsTotal = resultat.points + (resultat.pointsSupplementaires || 0);
        this.scoreTotal += pointsTotal;
        this.tentativeCourante = 1;
        this._majTextesProgression();

        const texteQuilles = this.quillesTombeesCount === 0
            ? C.textes.aucune
            : C.textes.quillesTombees.replace("{n}", this.quillesTombeesCount) +
              (this.roiTombe ? C.textes.roiTombe : "");
        const pas = resultat.ricochet ? 2 : 1;
        const dernierJet = this.numeroJet + pas > 17;
        this._afficherRetourJet({
            texte: texteQuilles + "\n" + C.textes.pointsGagnes.replace("{n}", pointsTotal),
            boutonLabel: dernierJet ? C.textes.finPartie : C.textes.continuer,
            onContinuer: () => this._avancerApresJet(pas)
        });
    }

    // --- Mise en page des textes / boutons ---------------------------------------

    /**
     * En bas de la 2e colonne de la piste (w3..pisteLargeur, même principe
     * que les boutons ◄/► de la colonne de visée, cf.
     * `_positionnerBoutonsRotation` — demande John, 30/08 : Tirer restait
     * centré et empiétait sur l'espace des contrôles de force ; colonne
     * décalée le 31/08 quand la piste est passée à 2/3 de large, cf.
     * `_positionnerControlesForce`). Calcule `this.tirerTop`, utilisé par
     * `_positionnerControlesForce()` (DOIT être appelée après celle-ci).
     */
    _positionnerBouton() {
        const UI = Arcade.UI;
        const h = this.h;
        const w3 = this.colLargeur;
        const marge = UI.u(this, 1.5);
        const hauteurZone = h - this.ligneLancerY;

        const hauteurBtn = hauteurZone * 0.38;
        this.tirerTop = h - marge - hauteurBtn;
        const yCentre = this.tirerTop + hauteurBtn / 2;

        this.boutonTirer.redimensionner(w3 * 0.7, hauteurBtn)
            .setPosition(w3 + w3 / 2, yCentre);
    }

    _positionnerTextes() {
        const C = window.QuillesSaintGallConfig;
        const UI = Arcade.UI;
        const w = this.w, h = this.h;
        const w3 = this.colLargeur;
        const wp = this.pisteLargeur;

        // Titre + consignes + jauge + résultat : centrés sur la PISTE
        // (0..pisteLargeur, 2/3 gauche), pas sur tout l'écran — demande
        // John 31/08 : le 1/3 de droite est un panneau d'info dédié, ces
        // éléments n'y ont plus leur place (avant, la piste ne faisant que
        // 1/3, centrer sur `w` tombait par coïncidence au bon endroit).
        this.texteTitre.setPosition(wp / 2, h * 0.035)
            .setFontSize(Math.round(UI.u(this, 7)) + "px");
        this.texteSousTitre.setPosition(wp / 2, h * 0.035 + UI.u(this, 4))
            .setFontSize(Math.round(UI.u(this, 3)) + "px");

        // Panneau d'info (colonne de droite, 1/3, PLEINE HAUTEUR — demande
        // John 31/08, remplace l'ancienne colonne de gauche cantonnée à la
        // zone de recul) : progression de la partie (jet n/17 + score
        // cumulé), remplace le compteur de quilles tombées en direct du
        // spike (PRD §3).
        this.texteCompteur.setPosition(w - w3 / 2, h * 0.5)
            .setFontSize(Math.round(UI.u(this, 4)) + "px")
            .setWordWrapWidth(w3 * 0.85, true);

        if (this.consigne1.visible) {
            this.consigne1.setPosition(wp * 0.5, h * 0.55)
                .setFontSize(Math.round(UI.u(this, 3.2)) + "px");
            this.consigne2.setPosition(wp * 0.5, h * 0.55 + UI.u(this, 4.2))
                .setFontSize(Math.round(UI.u(this, 3.2)) + "px")
                .setWordWrapWidth(wp * 0.85, true);
        }

        if (this.texteJauge.visible) {
            this.texteJauge.setPosition(wp / 2,
                this.ligneLancerY - UI.u(this, C.jauge.hauteurU) - UI.u(this, 7))
                .setFontSize(Math.round(UI.u(this, 4)) + "px");
        }

        if (this.texteResultat.visible) {
            this.texteResultat.setPosition(wp / 2, h * 0.44)
                .setFontSize(Math.round(UI.u(this, 4.5)) + "px")
                .setWordWrapWidth(wp * 0.8, true);
        }

        if (this.boutonRejouer) {
            this.boutonRejouer.redimensionner(UI.u(this, 30), UI.u(this, 10))
                .setPosition(wp / 2, h * 0.6);
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
