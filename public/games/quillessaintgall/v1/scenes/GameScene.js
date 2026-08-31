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

        // Quille DEBOUT (32x32, vue du dessus) : disque + contour + reflet,
        // base neutre (blanche) — la couleur réelle (jaune = en place,
        // rouge = prépondérante) est appliquée au runtime via setTint,
        // cf. GameScene._appliquerEtatQuille (demande John 31/08 :
        // reproduit le panneau lumineux du vrai jeu, pas une quille
        // physiquement différente).
        g.fillStyle(Phaser.Display.Color.HexStringToColor(C.couleurs.quilleContour).color, 1);
        g.fillCircle(16, 16, 15);
        g.fillStyle(Phaser.Display.Color.HexStringToColor(C.couleurs.quilleBase).color, 1);
        g.fillCircle(16, 16, 12);
        g.fillStyle(0xffffff, 0.35);
        g.fillCircle(12, 12, 4);
        g.generateTexture("quille", 32, 32);
        g.clear();

        // Quille TOMBÉE (32x32, vue du dessus) : rectangle blanc (couchée
        // au sol), PAS de tint appliqué au runtime — reste toujours dans
        // cette couleur (demande John 31/08 : "la quille qui tombe doit
        // rester blanche mais devenir un rectangle").
        g.fillStyle(Phaser.Display.Color.HexStringToColor(C.couleurs.quilleContour).color, 1);
        g.fillRect(6, 2, 20, 28);
        g.fillStyle(Phaser.Display.Color.HexStringToColor(C.couleurs.quilleTombee).color, 1);
        g.fillRect(8, 4, 16, 24);
        g.generateTexture("quilleTombee", 32, 32);
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
        this.prependeranteTombee = false;

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
            // Jet 4 (phase B) : 2 bois/quille SI la prépondérante (idx8,
            // cf. config.js) est tombée, sinon 1 bois/quille (texte
            // fédéral) — jets 1-3 n'ont pas de `prependerante` et gardent
            // le barème flat `pointsParQuille`.
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

        for (let i = 0; i < 9; i++) {
            const q = this.add.sprite(0, 0, "quille").setDepth(4);
            q.setData("index", i);
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

        this.colLargeur = w / 3;   // largeur FIXE de la colonne d'info (droite), inchangée
        const budgetPiste = w - this.colLargeur;   // place MAX dispo pour piste+lancement (2/3 avant, un plafond désormais)

        // Zone piste + lancement (quilles + demi-cercle) : ratio FIXE 1×3
        // (largeur × hauteur, 3 fois plus haute que large — demande John,
        // 31/08, passé de 1×2 à 1×3). On prend le plus grand rectangle 1:3
        // qui tient dans (largeur ≤ budgetPiste, hauteur ≤ h) : soit la
        // largeur est le facteur limitant (hauteur totale = 3×largeur ≤ h),
        // soit la hauteur l'est (largeur = h/3 ≤ budgetPiste). Remplace le
        // plafond de largeur fixe à 2/3 (30/08-31/08) : cf.
        // _positionnerQuilles pour le pourquoi de la largeur (écart entre
        // quilles, ex. jet 9, quilles 4/5), le ratio garantit maintenant
        // qu'une piste ne devient jamais anormalement basse/étirée sur les
        // formats extrêmes, dans un sens comme dans l'autre.
        this.pisteLargeur = Math.min(budgetPiste, h / 3);
        // Piste+lancement SANS rallonge (comme avant le 31/08, dernière
        // passe) : sert de référence FIXE pour tout ce qui ne doit pas
        // bouger quand une rallonge apparaît (la grille de quilles, cf.
        // this.ligneLancerPiste plus bas) — cf. _positionnerQuilles.
        const pisteHauteurBase = this.pisteLargeur * 3;

        // Écran large/court (paysage) : la largeur devient < budgetPiste →
        // bande vide À GAUCHE de la piste (demande John) — la piste colle
        // toujours au bord de la colonne d'info, jamais l'inverse.
        this.pisteOffsetX = budgetPiste - this.pisteLargeur;

        // Zone de tir (sous la piste, dans la largeur de piste) :
        // UNIQUEMENT le demi-cercle de placement + la boule, rien d'autre
        // (demande John, 31/08 — les boutons de pivot/force/tirer sont
        // tous dans la colonne d'info, cf. _positionnerColonneInfo). Le
        // demi-cercle fait toute la largeur de la piste (diamètre =
        // pisteLargeur), donc sa hauteur (= son rayon) est pisteLargeur/2.
        this.cercleRayon = this.pisteLargeur / 2;
        // Limite piste/zone de tir SANS rallonge (fixe, dépend uniquement
        // de pisteLargeur) — sert de référence pour la grille de quilles
        // ET pour la mise en page des textes (_positionnerQuilles /
        // _positionnerTextes), qui ne doivent PAS s'étirer avec la
        // rallonge.
        this.ligneLancerPiste = pisteHauteurBase - this.cercleRayon;   // = 2.5 × pisteLargeur

        // --- Rallonge (ajoutée le 31/08, passe suivante, demande John :
        // "au lieu d'ajouter un espace vide [sous la piste], il faut
        // allonger la piste") --------------------------------------------
        // Écran haut/étroit (portrait extrême) : la piste+lancement au
        // ratio 1×3 (pisteHauteurBase) peut être plus basse que l'écran.
        // Avant : cet espace restait vide EN BAS. Désormais : comblé par
        // une rallonge de piste (même rectangle brun que la piste, cf.
        // _dessinerDecor qui dessine déjà tout jusqu'à this.ligneLancerY)
        // insérée ENTRE la piste (quilles, taille fixe) et la zone de tir,
        // pour que la zone de tir reste TOUJOURS collée en BAS de l'écran
        // dès qu'il y a de la place — sans toucher à pisteLargeur, au
        // ratio 1×3, ni à la taille/position des quilles ou du cercle.
        // Nulle dès que le ratio 1×3 atteint déjà `h` de lui-même (cas
        // hauteur-limitante : pisteLargeur = h/3 ⇒ pisteHauteurBase = h).
        this.rallongeHauteur = Math.max(0, h - pisteHauteurBase);

        // Limite piste/zone de tir RÉELLE (avec rallonge) : c'est elle qui
        // pilote la position du cercle de visée, de la jauge et le bas
        // réel de la piste dessinée (_dessinerDecor) — décalée vers le bas
        // de `rallongeHauteur` par rapport à this.ligneLancerPiste.
        this.ligneLancerY = this.ligneLancerPiste + this.rallongeHauteur;
        this.cercleX = this.pisteOffsetX + this.pisteLargeur / 2;
        this.cercleY = this.ligneLancerY;

        // Échelle réelle (demande John, 31/08) : this.pisteLargeur
        // (pixels) représente C.piste.largeurReelleCm (200cm réels) — sert
        // à convertir en pixels tout ce qui doit être proportionnel à la
        // piste (marge quilles, diagonale du losange, diamètre quille/
        // boule), cf. _positionnerQuilles et _poserBouleVisuel.
        this.pxParCm = this.pisteLargeur / C.piste.largeurReelleCm;

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
        this._positionnerColonneInfo();
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

        // Piste (brune, visible) : ratio 1×3 fixe (largeur × hauteur totale
        // piste+lancement — demande John 31/08, 3e passe, cf.
        // this.pisteLargeur/this.pisteOffsetX), ancrée en HAUT (y=0) et
        // collée au bord de la colonne d'info (this.pisteOffsetX = 0 sauf
        // écran large/court, où une bande vide apparaît à SA GAUCHE). Pas
        // toute la largeur de l'écran, pour se distinguer du panneau
        // d'info (demande John, 30/08). Ce rectangle va jusqu'à
        // this.ligneLancerY (PAS this.ligneLancerPiste) : il inclut donc
        // AUSSI la rallonge (même brun, aucun tracé séparé — cf.
        // this.rallongeHauteur dans _recalculerGeometrie) quand l'écran
        // est plus haut que le ratio 1×3 ne l'exige ; les quilles, elles,
        // restent ancrées en haut via this.ligneLancerPiste dans
        // _positionnerQuilles, donc n'en bougent pas.
        const wp = this.pisteLargeur;
        const ox = this.pisteOffsetX;
        // Bas réel de piste+lancement : = h dès qu'une rallonge existe
        // (31/08, passe suivante — la zone de tir colle désormais TOUJOURS
        // au bas de l'écran s'il y a de la place, plus de bande vide sous
        // le cercle), sinon inchangé (peut être < h sur écran large/court,
        // où la bande vide reste à GAUCHE, cf. this.pisteOffsetX).
        const pisteBas = this.ligneLancerY + this.cercleRayon;
        this.sol.clear();
        this.sol.fillStyle(cPiste, 1);
        this.sol.fillRect(ox, 0, wp, this.ligneLancerY);
        this.sol.lineStyle(Math.max(1, UI.u(this, 0.25)), cBord, 0.9);
        this.sol.strokeRect(ox, 0, wp, this.ligneLancerY);

        // Panneau d'info (colonne de droite, largeur FIXE this.colLargeur,
        // PLEINE HAUTEUR — demande John 31/08) : légèrement teinté sur
        // toute la hauteur pour se distinguer visuellement. Toujours collé
        // au bord droit de l'écran, largeur inchangée par la bande vide
        // éventuelle (qui se forme à GAUCHE de la piste, jamais en
        // rognant le panneau d'info). Contient TOUS les contrôles de tir
        // (pivot/force/tirer) + le jet/score, cf. _positionnerColonneInfo.
        const infoX = ox + wp;   // = w - this.colLargeur, par construction
        this.sol.fillStyle(cRecul, 0.6);
        this.sol.fillRect(infoX, 0, w - infoX, h);
        this.sol.lineStyle(Math.max(1, UI.u(this, 0.2)), cBord, 0.6);
        this.sol.lineBetween(infoX, 0, infoX, h);

        // Zone de tir (sous la piste, UNIQUEMENT le demi-cercle + la
        // boule — demande John 31/08 : plus aucun bouton ici, cf.
        // this.cercleRayon/_recalculerGeometrie) : même teinte que la
        // piste, continuité visuelle. S'arrête à `pisteBas`, qui vaut
        // désormais `h` dès qu'une rallonge comble l'écart (31/08, passe
        // suivante — la zone de tir colle TOUJOURS en bas de l'écran s'il
        // y a de la place, cf. this.rallongeHauteur) ; sur écran large/
        // court (bande vide À GAUCHE de la piste, this.pisteOffsetX),
        // `pisteBas` peut rester < h comme avant, sans rapport avec la
        // rallonge.
        this.sol.fillStyle(cRecul, 1);
        this.sol.fillRect(ox, this.ligneLancerY, wp, pisteBas - this.ligneLancerY);
        this.sol.fillStyle(cPiste, 0.35);
        this.sol.fillRect(ox, this.ligneLancerY, wp, pisteBas - this.ligneLancerY);
    }

    // --- Cercle de placement (zone de tir) --------------------------------------
    // Géométrie (cercleX/cercleY/cercleRayon) calculée directement dans
    // _recalculerGeometrie (demande John, 31/08, 2e passe : la zone de tir
    // est maintenant dimensionnée en 2/1 pour contenir JUSTE le demi-
    // cercle sur toute la largeur de la piste, plus de plafond lié aux
    // boutons puisqu'ils ne sont plus dans cette zone).

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

    /**
     * Colonne d'info (droite, 1/3 de large, PLEINE HAUTEUR — demande John,
     * 31/08, 2e passe) : plus aucun contrôle sous la piste, tout est
     * empilé ICI, de BAS en HAUT — bouton Tirer, boutons de pivot ◄ ►,
     * boutons de force -/+, barre + libellé « Force », puis jet/score en
     * haut (taille normale, pas étiré — le reste de l'espace au-dessus des
     * contrôles reste vide, demande John explicite).
     */
    _positionnerColonneInfo() {
        const C = window.QuillesSaintGallConfig;
        const UI = Arcade.UI;
        const w = this.w, h = this.h;
        const w3 = this.colLargeur;
        const infoX = w - w3;   // bord gauche du panneau d'info (PAS this.pisteLargeur : diffère quand une bande vide sépare piste et panneau, cf. this.pisteOffsetX)
        const xCentre = infoX + w3 / 2;
        const marge = UI.u(this, 1.5);

        // --- Bouton Tirer (tout en bas). ---
        const hauteurTirer = h * 0.11;
        const tirerY0 = h - marge - hauteurTirer;
        this.boutonTirer.redimensionner(w3 * 0.7, hauteurTirer)
            .setPosition(xCentre, tirerY0 + hauteurTirer / 2);

        // --- Boutons de pivot ◄ ► (au-dessus de Tirer, côte à côte). ---
        const hauteurPivot = h * 0.09;
        const pivotY0 = tirerY0 - marge - hauteurPivot;
        const yPivot = pivotY0 + hauteurPivot / 2;
        const largeurPivot = w3 / 2 - marge * 1.5;
        this.boutonRotGauche.redimensionner(largeurPivot, hauteurPivot)
            .setPosition(infoX + marge + largeurPivot / 2, yPivot);
        this.boutonRotDroite.redimensionner(largeurPivot, hauteurPivot)
            .setPosition(infoX + w3 - marge - largeurPivot / 2, yPivot);

        // --- Boutons de force -/+ (au-dessus du pivot). ---
        const hauteurForceBtn = h * 0.09;
        const forceBtnY0 = pivotY0 - marge - hauteurForceBtn;
        const yForceBtn = forceBtnY0 + hauteurForceBtn / 2;
        const largeurForceBtn = w3 * 0.32;
        this.boutonForceMoins.redimensionner(largeurForceBtn, hauteurForceBtn)
            .setPosition(xCentre - largeurForceBtn / 2 - marge / 2, yForceBtn);
        this.boutonForcePlus.redimensionner(largeurForceBtn, hauteurForceBtn)
            .setPosition(xCentre + largeurForceBtn / 2 + marge / 2, yForceBtn);

        // --- Barre de force (au-dessus des boutons -/+). ---
        this.forceBarLargeur = w3 * 0.7;
        this.forceBarHauteur = h * 0.045;
        this.forceBarX = xCentre - this.forceBarLargeur / 2;
        this.forceBarY = forceBtnY0 - marge - this.forceBarHauteur;
        this._dessinerBarreForce();

        // --- Libellé « Force » (au-dessus de la barre). ---
        this.texteForce.setPosition(xCentre, this.forceBarY - UI.u(this, 3))
            .setFontSize(Math.round(UI.u(this, 2.8)) + "px");

        // --- Titre + sous-titre (tout en HAUT de la colonne — demande
        // John, 31/08, dernière passe : « pour libérer de l'espace en haut
        // de la piste, retire les textes pour les mettre dans la barre de
        // droite » — la piste ne porte plus AUCUN texte au-dessus de la
        // grille de quilles). Taille réduite + word-wrap : la colonne
        // (1/3 d'écran) est plus étroite que l'ancienne largeur de piste
        // (2/3) où ces textes étaient centrés avant. Empilage par HAUTEUR
        // RÉELLE mesurée (`displayHeight`, après word-wrap) plutôt que des
        // écarts fixes devinés — le titre peut retomber sur 1 ou 2 lignes
        // selon le format d'écran, un écart fixe aurait fait chevaucher le
        // sous-titre/le compteur sur les colonnes étroites (bug vu lors du
        // premier essai : « Quilles Saint-Gall » sur 2 lignes chevauchait
        // le sous-titre puis « Jet 1/17 »).
        let curY = h * 0.02;
        this.texteTitre.setFontSize(Math.round(UI.u(this, 3.6)) + "px")
            .setWordWrapWidth(w3 * 0.9, true)
            .setPosition(xCentre, curY + this.texteTitre.displayHeight / 2);
        curY += this.texteTitre.displayHeight + UI.u(this, 0.8);

        this.texteSousTitre.setFontSize(Math.round(UI.u(this, 1.9)) + "px")
            .setWordWrapWidth(w3 * 0.9, true)
            .setPosition(xCentre, curY + this.texteSousTitre.displayHeight / 2);
        curY += this.texteSousTitre.displayHeight + UI.u(this, 2.5);

        // --- Jet / Score (sous le sous-titre, taille normale — demande
        // John : ne pas étirer pour remplir l'espace, laisser le vide
        // entre ce texte et le libellé « Force »). ---
        this.texteCompteur.setFontSize(Math.round(UI.u(this, 3.2)) + "px")
            .setWordWrapWidth(w3 * 0.85, true)
            .setPosition(xCentre, curY + this.texteCompteur.displayHeight / 2);
    }

    // --- Quilles ---------------------------------------------------------------

    /**
     * Losange (quinconce 1-2-3-2-1), PAS un carré 3×3 — corrigé le
     * 30/08/2026 (soir) d'après le vrai schéma fédéral (article 780,
     * cf. en-tête de config.js). `POSITIONS[i]` donne, pour chaque indice
     * de quille (0-8, fond → avant), sa rangée (0=fond … 4=pointe avant)
     * et son décalage horizontal en fraction de la demi-largeur
     * de la rangée du milieu (la plus large, 3 quilles) — modèle "grille
     * 3×3 tournée à 45°" (rangées de 2 à mi-écart de la rangée de 3).
     */
    _positionnerQuilles() {
        const C = window.QuillesSaintGallConfig;
        const UI = Arcade.UI;
        // Grille FIXE 5×5, CARRÉE — refonte du 31/08 (dernière passe,
        // demande John : "peu importe l'espace que cela prend sur la
        // piste, la grille doit être carrée 1/1"). Largeur ET hauteur de
        // la grille = grilleLargeurPct % de pisteLargeur UNIQUEMENT (60%
        // par défaut) : les 2 dimensions suivent la MÊME base (la largeur
        // de piste), donc un vrai carré peu importe le format d'écran —
        // remplace l'ancien calcul qui dérivait la hauteur en % de LA
        // HAUTEUR de piste (this.ligneLancerY, une échelle différente),
        // ce qui écrasait le losange près du bord haut sur certains
        // formats.
        const grilleTaillePx = this.pisteLargeur * (C.piste.grilleLargeurPct / 100);
        const centreX = this.pisteOffsetX + this.pisteLargeur / 2;
        // Ancrage : marge FIXE en haut de la piste (% de LA HAUTEUR de
        // piste — volontairement la seule valeur ici liée à cette
        // échelle-là, cf. commentaire de piste.grilleHautYPct en config).
        // this.ligneLancerPiste (PAS this.ligneLancerY) : référence SANS
        // la rallonge (31/08, passe suivante) — les quilles ne doivent
        // jamais bouger quand la rallonge apparaît/change de taille.
        const grilleHautY = (C.piste.grilleHautYPct / 100) * this.ligneLancerPiste;

        const nbCases = C.piste.grilleCases;   // 5
        const tailleCase = grilleTaillePx / nbCases;   // 12% de pisteLargeur si grilleLargeurPct=60
        // Les quilles sont posées au CENTRE de leur case (demande John) —
        // col/row 0-4 (POSITIONS ci-dessous). Pas de quille physiquement
        // plus grosse ni de position fixe spéciale : « le Roi » = la
        // quille prépondérante DU JET EN COURS, indice propre à chaque
        // jet (cf. config.jets et en-tête de config.js, 5e passe 31/08).
        const colToX = (col) => centreX + (col - (nbCases - 1) / 2) * tailleCase;
        const rowToY = (row) => grilleHautY + (row + 0.5) * tailleCase;

        // Quinconce 1-2-3-2-1 (losange), désormais exprimé en cases
        // entières (col, row) de la grille 5×5 — mêmes emplacements
        // relatifs qu'avant (dx -1/-0.5/0/0.5/1 sur 5 rangées).
        const POSITIONS = [
            { row: 0, col: 2 },
            { row: 1, col: 1 }, { row: 1, col: 3 },
            { row: 2, col: 0 }, { row: 2, col: 2 }, { row: 2, col: 4 },
            { row: 3, col: 1 }, { row: 3, col: 3 },
            { row: 4, col: 2 }
        ];

        // Rayon RÉEL (diamètre en cm × this.pxParCm), demande John 31/08 —
        // remplace l'ancien % du plus petit côté de l'écran (UI.u), sans
        // lien avec l'échelle de la piste. Les 9 quilles ont TOUTES le même
        // rayon (pas de quille physiquement plus grosse — cf. en-tête de
        // config.js, 5e passe du 31/08 : « le Roi » = la quille prépondérante
        // du jet en cours, pas une quille distincte).
        this.rayonQuille = this.pxParCm * (C.quille.diametreCm / 2);

        const showNumeros = this.jetConfig && this.jetConfig.type === "ordre";

        this.quilles.forEach((q, i) => {
            const pos = POSITIONS[i];
            const x = colToX(pos.col);
            const y = rowToY(pos.row);

            q.setPosition(x, y);
            q.setDisplaySize(this.rayonQuille * 2, this.rayonQuille * 2);
            // Rayon de collision (test manuel, cf. _suivreBoule) : dérivé du
            // rayon visuel réel affiché à l'écran, pas d'un corps Arcade.
            q.setData("rayon", this.rayonQuille * C.quille.rayonCollisionFacteur);

            this._appliquerEtatQuille(q);

            const num = this.numerosQuille[i];
            num.setPosition(x, y).setFontSize(Math.round(UI.u(this, 2.4)) + "px");
            num.setVisible(showNumeros && q.getData("debout"));
        });
    }

    /**
     * Indice (0-8) de la quille prépondérante du jet en cours, ou
     * `undefined` si ce jet n'en a pas (phases D/E : `cible` joue un rôle
     * équivalent mais n'est pas une « prépondérante », cf. config.jets).
     * Lu directement depuis `config.jets` — CHAQUE jet a son propre indice,
     * indépendant des autres (pas de quille physique fixe/spéciale, cf.
     * en-tête de config.js).
     */
    _indexPrependeranteDuJet() {
        const jc = this.jetConfig;
        if (!jc) return undefined;
        if (jc.type === "figure") return jc.figure.prependerante;
        if (jc.type === "plein") return jc.prependerante;
        return undefined;
    }

    /**
     * `absente` (PRD §7 phase C) : la quille n'est PAS présente sur la
     * piste pour ce jet (hors figure) — entièrement invisible, jamais
     * collisionnable (elle reste `debout=false`, déjà exclue par
     * _suivreBoule).
     *
     * Reproduit le panneau lumineux du vrai jeu (demande John, 31/08) —
     * les 9 quilles réelles sont TOUTES identiques, seul l'affichage les
     * distingue, à 3 états : RIEN (absente, rien à l'écran) / JAUNE
     * (debout, en place) / ROUGE (debout ET prépondérante du jet en
     * cours — remplace l'ancien anneau doré séparé, la couleur de la
     * quille porte directement l'info). Une quille TOMBÉE reste BLANCHE
     * mais change de FORME (rectangle = couchée au sol, texture
     * "quilleTombee" générée dans genererTextures) plutôt que de
     * couleur — distincte d'une quille absente (invisible).
     */
    _appliquerEtatQuille(q) {
        const C = window.QuillesSaintGallConfig;
        if (q.getData("absente")) {
            q.setVisible(false);
            return;
        }
        q.setVisible(true);
        q.setAlpha(1);
        const debout = q.getData("debout");
        if (!debout) {
            q.setTexture("quilleTombee");
            q.setTint(0xffffff);
            return;
        }
        q.setTexture("quille");
        const estPrependerante = q.getData("index") === this._indexPrependeranteDuJet();
        q.setTint(Phaser.Display.Color.HexStringToColor(
            estPrependerante ? C.couleurs.quillePreponderante : C.couleurs.quilleEnPlace
        ).color);
    }

    _toucherQuille(quille) {
        if (!quille.getData("debout")) return;
        quille.setData("debout", false);
        this._appliquerEtatQuille(quille);
        this.quillesTombeesCount++;
        if (quille.getData("index") === this._indexPrependeranteDuJet()) this.prependeranteTombee = true;

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
        const C = window.QuillesSaintGallConfig;
        // Rayon RÉEL (diamètre en cm × this.pxParCm), demande John 31/08 —
        // même échelle que la piste/les quilles, remplace l'ancien % du
        // plus petit côté de l'écran (UI.u).
        const rayon = this.pxParCm * (C.boule.diametreCm / 2);
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
        // _positionnerTextes (demande John 31/08). `this.pisteOffsetX` :
        // décalage de la piste quand une bande vide se forme à sa gauche.
        const wp = this.pisteLargeur;
        const ox = this.pisteOffsetX;

        this.jaugeG.clear();
        if (this.etat !== "jauge" && this.etat !== "feedback") return;

        const largeur = (C.jauge.largeurPct / 100) * wp;
        const hauteur = UI.u(this, C.jauge.hauteurU);
        const x = ox + (wp - largeur) / 2;
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
        const dehors = this.boule.y < -20 ||
            this.boule.x < this.pisteOffsetX - 20 ||
            this.boule.x > this.pisteOffsetX + this.pisteLargeur + 20;

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
              (this.prependeranteTombee ? C.textes.prependeranteTombee : "");
        const pas = resultat.ricochet ? 2 : 1;
        const dernierJet = this.numeroJet + pas > 17;
        this._afficherRetourJet({
            texte: texteQuilles + "\n" + C.textes.pointsGagnes.replace("{n}", pointsTotal),
            boutonLabel: dernierJet ? C.textes.finPartie : C.textes.continuer,
            onContinuer: () => this._avancerApresJet(pas)
        });
    }

    // --- Mise en page des textes / boutons ---------------------------------------

    _positionnerTextes() {
        const C = window.QuillesSaintGallConfig;
        const UI = Arcade.UI;
        const h = this.h;
        const wp = this.pisteLargeur;
        // Centre RÉEL de la piste (pas juste wp/2) : la piste peut être
        // décalée de this.pisteOffsetX quand une bande vide se forme à sa
        // gauche (écran large/court, demande John 31/08, 3e passe).
        const pisteCentreX = this.pisteOffsetX + wp / 2;

        // Titre/sous-titre : déplacés dans le panneau d'info (demande
        // John, 31/08, dernière passe — libère le haut de la piste pour la
        // grille de quilles), positionnés dans _positionnerColonneInfo,
        // pas ici. Consignes/jauge/résultat restent centrés sur LA PISTE.

        // texteCompteur (jet n/17 + score) : positionné dans
        // _positionnerColonneInfo (colonne d'info, en haut) — pas ici.

        // Consignes/résultat/rejouer : positionnés en % de LA PISTE
        // (this.ligneLancerY), PAS % d'écran — demande John 31/08, 3e
        // passe : depuis que ligneLancerY suit le ratio 1×3 (peut être
        // bien moins que ~80% de l'écran), un % d'écran fixe pouvait
        // tomber SOUS ligneLancerY, dans la zone de tir, et chevaucher le
        // demi-cercle/la boule (même souci que pour les quilles, cf.
        // _positionnerQuilles).
        if (this.consigne1.visible) {
            this.consigne1.setPosition(pisteCentreX, this.ligneLancerY * 0.7)
                .setFontSize(Math.round(UI.u(this, 3.2)) + "px");
            this.consigne2.setPosition(pisteCentreX, this.ligneLancerY * 0.7 + UI.u(this, 4.2))
                .setFontSize(Math.round(UI.u(this, 3.2)) + "px")
                .setWordWrapWidth(wp * 0.85, true);
        }

        if (this.texteJauge.visible) {
            this.texteJauge.setPosition(pisteCentreX,
                this.ligneLancerY - UI.u(this, C.jauge.hauteurU) - UI.u(this, 7))
                .setFontSize(Math.round(UI.u(this, 4)) + "px");
        }

        if (this.texteResultat.visible) {
            this.texteResultat.setPosition(pisteCentreX, this.ligneLancerY * 0.55)
                .setFontSize(Math.round(UI.u(this, 4.5)) + "px")
                .setWordWrapWidth(wp * 0.8, true);
        }

        if (this.boutonRejouer) {
            this.boutonRejouer.redimensionner(UI.u(this, 30), UI.u(this, 10))
                .setPosition(pisteCentreX, this.ligneLancerY * 0.75);
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
