/*
 * GameScene — Quilles Saint-Gall, une VRAIE partie (PRD 875 §7-9) : 17
 * jets en 6 phases, par-dessus la mécanique de tir et la physique de
 * collision du spike v1, VALIDÉES par John le 30/08/2026 (commit
 * 6fa096e) : placement dans un demi-cercle (remplacé le 27/09 par la
 * planche de tir, cf. Visee.js), visée par boutons ◄/►, force
 * réglable, jauge de précision à zone fixe — NON MODIFIÉES ici. La
 * collision boule/quilles et quille/quille, elle, a été refaite le
 * 31/08/2026 (demande John : « on connaît maintenant le poids des boules
 * et des quilles, il faut rendre ça plus réaliste ») : remplace l'ancien
 * test de distance manuel + fractions empiriques par de VRAIS corps
 * Arcade Physics circulaires avec masse réelle (`config.quille.masseKg`/
 * `config.boule.masseKg`) — Phaser calcule lui-même l'échange de vitesse
 * par conservation de quantité de mouvement, cf. _creerColliders /
 * _processCollisionBouleQuille / _processCollisionQuilleQuille.
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
 *      on distingue 2 cas (PRD 875 §9, décision John 09/09/2026) :
 *      - cible non tombée SANS violation → 0 point, jet suivant (art. 877
 *        art. 10) ;
 *      - violation (ordre non respecté, 2+ quilles requises simultanément
 *        hors ricochet) → les quilles requises du jet se relèvent,
 *        réédition SANS LIMITE de reprises.
 *      Cf. _calculerOrdreJet.
 *   4. L'ÉCRAN DE FIN DE PARTIE (jet 17 résolu) : score final /200,
 *      envoi à Arcade.Score (meilleur score), bouton pour rejouer une
 *      partie complète depuis le jet 1, ou revenir au menu (changer de
 *      palier).
 *
 * AJOUTÉ le 04/09/2026 (PRD §10/12, tranché par John) : palier de
 * difficulté choisi dans MenuScene (nouvelle scène), reçu ici via
 * `data.palier` — 'normal' par défaut si la scène est lancée sans passer
 * par le menu. Décision explicite de John : la difficulté NE TOUCHE
 * JAMAIS aux règles d'une partie (toujours 17 jets, 6 phases, barème
 * fixe, pas de mode tutoriel séparé/raccourci) — seulement 3 leviers sur
 * la PRÉCISION du tir (config.paliers) : vitesse de l'aiguille de la
 * jauge (JaugePrecision.avancer), largeur de sa zone orange
 * (JaugePrecision.demarrer), longueur de la ligne d'aide à la visée
 * (Visee.dessiner).
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
        // une texture par couleur (jaune = en place, rouge = à viser),
        // choisie dans Quilles._appliquerEtatQuille (demande John 31/08 :
        // reproduit le panneau lumineux du vrai jeu, pas une quille
        // physiquement différente).
        // 07/11/2026 : la couleur n'est plus appliquée par setTint mais par
        // une texture par couleur. En rendu Canvas (navigateur sans carte
        // graphique, ex. le Chrome du VPS de John), Phaser ignore setTint :
        // toutes les quilles restaient blanches et la quille à viser ne se
        // distinguait pas. "quille" (base blanche) reste pour l'animation de
        // chute (cf. Quilles._toucherQuille).
        const dessinerQuille = (cle, couleurBase) => {
            g.fillStyle(Phaser.Display.Color.HexStringToColor(C.couleurs.quilleContour).color, 1);
            g.fillCircle(16, 16, 15);
            g.fillStyle(Phaser.Display.Color.HexStringToColor(couleurBase).color, 1);
            g.fillCircle(16, 16, 12);
            g.fillStyle(0xffffff, 0.35);
            g.fillCircle(12, 12, 4);
            g.generateTexture(cle, 32, 32);
            g.clear();
        };
        dessinerQuille("quille", C.couleurs.quilleBase);
        dessinerQuille("quilleEnPlace", C.couleurs.quilleEnPlace);
        dessinerQuille("quilleAViser", C.couleurs.quillePreponderante);

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

    create(data) {
        const C = window.QuillesSaintGallConfig;

        // Palier de difficulté choisi dans MenuScene (§10/12, ajouté le
        // 04/09/2026) — 'normal' par défaut si la scène est lancée
        // directement sans passer par le menu (lien direct, debug). Ne
        // touche JAMAIS aux règles de la partie (toujours 17 jets, 6
        // phases, barème fixe) — seulement 3 leviers sur la PRÉCISION du
        // tir (cf. JaugePrecision / Visee),
        // décision explicite de John : pas de mode tutoriel séparé, pas de
        // quilles/jauge modifiées en taille, juste ces 3 leviers.
        this.palier = (data && C.paliers[data.palier]) ? data.palier : "normal";
        this.palierConf = C.paliers[this.palier];

        // Vue du dessus : pas de gravité de monde.
        this.physics.world.gravity.y = 0;

        // États : placement → jauge → feedback → lancer → jetResultat →
        // (placement du jet suivant, OU finPartie après le jet 17).
        this.etat = "placement";
        this.glisse = false;

        // Jauge de précision (état interne au tir en cours, indépendant
        // du jet/de la partie).
        this.feedbackRestant = 0;
        this.boutonRejouer = null;
        this.boutonMenu = null;

        // Compteur monotone (jamais remis à zéro par jet) : sert à dater les chutes
        // (chuteFrame) pour Quilles._estCouchee.
        this.frameMoteur = 0;
        this.regles = new Regles(this);
        this.quillesSys = new Quilles(this);
        this._creerDecor();
        this.quillesSys._creerQuilles();
        this._creerBouleEtOmbre();
        this.bandes = new BandesLaterales(this);
        this.bandes.creer();
        this.quillesSys._creerColliders();
        this.contacts = new ContactsCouchees(this);
        this.visee = new Visee(this);
        this.visee.creer();
        this.jauge = new JaugePrecision(this);
        this.jauge.creer();
        this._creerBouton();
        this._creerBoutonsRotation();
        this._creerBarreForce();
        this._creerBoutonsForce();
        this._creerTextes();

        // PRD 875 §12 : le flag toucheBande peut être levé pendant la
        // création (boule et bandes se chevauchent à l'origine avant
        // positionnement) — on le réinitialise ici, une fois tous les
        // corps en place.
        this.bandes.toucheBande = false;

        // Démarre la partie (jet 1) : ne positionne rien visuellement tant
        // que la géométrie de l'écran (this.w/this.h) n'est pas connue —
        // _demarrerJet() s'en charge lui-même (cf. son commentaire).
        this._demarrerPartie();

        // Zone de saisie globale (clic/tap).
        this.zoneGlobale = this.add.zone(0, 0, 10, 10)
            .setOrigin(0, 0).setInteractive();
        this.zoneGlobale.on("pointerdown", (p) => this._pointerDown(p));
        this.zoneGlobale.on("pointermove", (p) => {
            if (this.glisse && this.etat === "placement") this.visee.poser(p);
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
        this.frameMoteur++;
        if (this.etat === "jauge") {
            this.jauge.avancer(dt);
        } else if (this.etat === "feedback") {
            this.feedbackRestant -= delta;
            if (this.feedbackRestant <= 0) this._lancer();
        } else if (this.etat === "lancer") {
            this._suivreBoule(dt);
        }
        // Les quilles envoyées en mouvement par un choc continuent de
        // ralentir (jusqu'à l'arrêt) même une fois le jet terminé — leur
        // déplacement lui-même et les collisions quille↔quille sont
        // gérées par Arcade Physics (cf. _creerColliders), sauf celles qui
        // touchent une quille couchée (ContactsCouchees).
        this.quillesSys._amortirQuillesMobiles(dt);
        // Quilles couchées : contacts boule / quille / bande en capsule,
        // résolus à chaque frame (cf. ContactsCouchees.js).
        this.contacts.resoudre();
    }

    // --- Partie / jets (PRD §7-9) ----------------------------------------------

    /** Démarre une NOUVELLE partie complète : score à 0, jet 1. */
    _demarrerPartie() {
        this.scoreTotal = 0;
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
        this.bandes.toucheBande = false;   // PRD 875 §12 : flag persistant jusqu'à l'arrêt complet

        // Phases D/E (ordre imposé) : la figure reste posée UNE SEULE FOIS
        // pour toute la phase (règlement fédéral : "jets d'affilée" sur la
        // même figure, pas remise à neuf à chaque jet) — remplace la
        // simplification "reset à chaque jet" de la 1re correction, sur
        // demande explicite de John. `this.ordrePhaseAbattues` (Set des
        // indices déjà légitimement tombés) n'est réinitialisé qu'au 1er
        // jet de la phase (9 ou 14) ; cf. _calculerOrdreJet pour son usage.
        // Une quille déjà légitimement abattue est RETIRÉE de la piste pour
        // les jets suivants (absente : invisible, sans collision), et non
        // laissée couchée. Règlement, art. 877 fig. 8 : « Le jet sur la quille
        // N°4 (25) doit être effectué avec cette seule quille sur le jeu » ; les
        // quilles régulièrement abattues sont retirées par le préposé et ne sont
        // PAS relevées (demande John du 07/11/2026). Une quille tombée PAR ERREUR
        // (jet fautif) n'est pas dans ce Set : elle est relevée.
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
            q.setData("absente", !dansLeJet || dejaAbattue);
            q.body.setVelocity(0, 0);
            q.body.setAngularVelocity(0);
            q.setAngle(0);
        });

        this.force = C.force.defaut;
        this.visee.reset();
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
        // Boutons de fin aux couleurs de la marque (refonte charte 24/09) :
        // action principale rouge, retour au menu en tuile crème.
        this.boutonRejouer = Arcade.UI.boutonMenu(this, {
            variante: "jouer",
            label: C.textes.rejouerPartie,
            onClick: () => this._demarrerPartie()
        });
        // Retour au menu (§10/12, ajouté 04/09) : seul moyen de CHANGER de
        // palier — « Rejouer » garde le palier en cours (this.palierConf
        // inchangé, cf. _demarrerPartie).
        if (this.boutonMenu) { this.boutonMenu.destroy(); this.boutonMenu = null; }
        this.boutonMenu = Arcade.UI.boutonMenu(this, {
            variante: "secondaire",
            label: C.textes.menu,
            onClick: () => this.scene.start(MenuScene.KEY)
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
        if (this.boutonMenu) { this.boutonMenu.destroy(); this.boutonMenu = null; }
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
        this.boutonRejouer = Arcade.UI.boutonMenu(this, {
            variante: "jouer",
            label: o.boutonLabel,
            onClick: o.onContinuer
        });

        this._positionnerTextes();
    }

    // --- Création des éléments ------------------------------------------------

    _creerDecor() {
        this.ciel = this.add.graphics().setDepth(0);
        this.sol = this.add.graphics().setDepth(1);
    }

    _creerBouleEtOmbre() {
        const C = window.QuillesSaintGallConfig;
        this.ombreBoule = this.add.circle(0, 0, 4, C.couleurs.ombreBoule, 0.35).setDepth(5);
        this.boule = this.physics.add.sprite(0, 0, "boule");
        this.boule.setDepth(6);
        this.boule.body.setAllowGravity(false);
        // Rayon LOCAL = moitié de la texture "boule" (48×48, halo inclus,
        // cf. genererTextures) — même convention que l'ancien calcul manuel
        // (`displayWidth / 2`, cf. historique) : le corps Arcade suit
        // ensuite l'échelle appliquée par setDisplaySize dans
        // Visee.positionnerBoule.
        this.boule.body.setCircle(24);
        this.boule.body.mass = C.boule.masseKg;
        this.boule.body.setBounce(C.boule.bounce);
    }

    _creerBouton() {
        const C = window.QuillesSaintGallConfig;
        // Charte (24/09) : « Tirer » = LA prochaine action (rouge) ; les
        // réglages de tir (rotation, force) en tuiles crème secondaires.
        this.boutonTirer = Arcade.UI.boutonMenu(this, {
            variante: "jouer",
            label: C.textes.tirer,
            marqueurClic: true,
            onClick: () => {
                if (this.etat === "placement") this._demarrerJauge();
                else if (this.etat === "jauge") this._arreterJauge();
            }
        });
    }

    _creerBoutonsRotation() {
        const C = window.QuillesSaintGallConfig;
        this.boutonRotGauche = Arcade.UI.boutonMenu(this, {
            variante: "secondaire",
            label: "◄",
            marqueurClic: true,
            onClick: () => this.visee.pivoter(-1)
        });
        this.boutonRotDroite = Arcade.UI.boutonMenu(this, {
            variante: "secondaire",
            label: "►",
            marqueurClic: true,
            onClick: () => this.visee.pivoter(1)
        });
    }

    _creerBarreForce() {
        this.forceBarG = this.add.graphics().setDepth(21);
    }

    _creerBoutonsForce() {
        const C = window.QuillesSaintGallConfig;
        this.boutonForceMoins = Arcade.UI.boutonMenu(this, {
            variante: "secondaire",
            label: "-",
            marqueurClic: true,
            onClick: () => this._ajusterForce(-1)
        });
        this.boutonForcePlus = Arcade.UI.boutonMenu(this, {
            variante: "secondaire",
            label: "+",
            marqueurClic: true,
            onClick: () => this._ajusterForce(1)
        });
    }

    _creerTextes() {
        const C = window.QuillesSaintGallConfig;
        this.texteTitre = Arcade.UI.text(this, 0, 0, C.titre, 7, C.couleurs.texte).setDepth(21);
        this.texteSousTitre = Arcade.UI.text(this, 0, 0,
            C.textes.sousTitre.replace("{palier}", this.palierConf.label),
            3, C.couleurs.texte).setDepth(21);
        this.consigne1 = Arcade.UI.text(this, 0, 0, C.textes.consigneLigne1, 3.2, C.couleurs.texte).setDepth(21);
        this.consigne2 = Arcade.UI.text(this, 0, 0, C.textes.consigneLigne2, 3.2, C.couleurs.texte).setDepth(21);
        this.texteJauge = Arcade.UI.text(this, 0, 0, C.textes.arreter, 4, C.couleurs.texte)
            .setDepth(21).setVisible(false);
        this.texteCompteur = Arcade.UI.text(this, 0, 0, "", 3.2, C.couleurs.texte).setDepth(21);
        this.texteForce = Arcade.UI.text(this, 0, 0, C.textes.force, 2.8, C.couleurs.texte).setDepth(21);
        this.texteResultat = Arcade.UI.text(this, 0, 0, "", 4.5, C.couleurs.resultat)
            .setDepth(21).setVisible(false);

        // Polices de la charte (24/09) : titre en Azimut, le reste en
        // Montserrat — Arcade.UI.text crée en police système.
        const P = Arcade.UI.polices;
        this.texteTitre.setFontFamily(P.titre);
        [this.texteSousTitre, this.consigne1, this.consigne2, this.texteCompteur,
            this.texteForce].forEach((t) => t.setFontFamily(P.texte));
        [this.texteJauge, this.texteResultat].forEach((t) =>
            t.setFontFamily(P.texte).setFontStyle("bold"));
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
        // UNIQUEMENT la planche de tir + la boule, rien d'autre (demande
        // John, 31/08 — les boutons de pivot/force/tirer sont tous dans la
        // colonne d'info, cf. _positionnerColonneInfo). Hauteur héritée de
        // l'ancien demi-cercle de placement (rayon = pisteLargeur/2),
        // conservée telle quelle le 27/09 quand la planche l'a remplacé :
        // le ratio 1×3 de la piste ne change pas.
        this.zoneTirHauteur = this.pisteLargeur / 2;
        // Limite piste/zone de tir SANS rallonge (fixe, dépend uniquement
        // de pisteLargeur) — sert de référence pour la grille de quilles
        // ET pour la mise en page des textes (_positionnerQuilles /
        // _positionnerTextes), qui ne doivent PAS s'étirer avec la
        // rallonge.
        this.ligneLancerPiste = pisteHauteurBase - this.zoneTirHauteur;   // = 2.5 × pisteLargeur

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
        // ratio 1×3, ni à la taille/position des quilles ou de la planche.
        // Nulle dès que le ratio 1×3 atteint déjà `h` de lui-même (cas
        // hauteur-limitante : pisteLargeur = h/3 ⇒ pisteHauteurBase = h).
        this.rallongeHauteur = Math.max(0, h - pisteHauteurBase);

        // Limite piste/zone de tir RÉELLE (avec rallonge) : c'est elle qui
        // pilote la position de la planche, de la jauge et le bas réel de
        // la piste dessinée (_dessinerDecor) — décalée vers le bas de
        // `rallongeHauteur` par rapport à this.ligneLancerPiste.
        this.ligneLancerY = this.ligneLancerPiste + this.rallongeHauteur;

        // Échelle réelle (demande John, 31/08) : this.pisteLargeur
        // (pixels) représente C.piste.largeurReelleCm (200cm réels) — sert
        // à convertir en pixels tout ce qui doit être proportionnel à la
        // piste (marge quilles, diagonale du losange, diamètre quille/
        // boule, planche), cf. _positionnerQuilles et Visee.positionnerBoule.
        this.pxParCm = this.pisteLargeur / C.piste.largeurReelleCm;

        // Planche de tir (27/09, demande John — article 780 : « la boule
        // doit être déposée sur la planche avant de toucher la piste ») :
        // largeur RÉELLE en cm, centrée dans la zone de tir, collée à la
        // ligne de lancer, longueur en % de la zone de tir (cf.
        // config.planche). La boule ne peut être posée QUE dessus
        // (Visee.poser), donc jamais de jet fautif pour « boule hors
        // planche » : la règle est garantie par construction.
        this.planche = {
            cx: this.pisteOffsetX + this.pisteLargeur / 2,
            largeur: this.pxParCm * C.planche.largeurCm,
            haut: this.ligneLancerY,
            bas: this.ligneLancerY + this.zoneTirHauteur * C.planche.longueurPctZoneTir / 100
        };

        this.quillesSys._positionnerQuilles();
        this.bandes.positionner();
        this.visee.majPosition();

        this.zoneGlobale.setPosition(0, 0);
        this.zoneGlobale.setSize(w, h);
        if (this.zoneGlobale.input && this.zoneGlobale.input.hitArea) {
            this.zoneGlobale.input.hitArea.setSize(w, h);
        }

        this._dessinerDecor();
        this.visee.dessiner();
        this.jauge.dessiner();
        this._positionnerColonneInfo();
        this._positionnerTextes();

        if (this.etat === "placement") this.visee.positionnerBoule();
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
        // la planche), sinon inchangé (peut être < h sur écran large/court,
        // où la bande vide reste à GAUCHE, cf. this.pisteOffsetX).
        const pisteBas = this.ligneLancerY + this.zoneTirHauteur;
        this.sol.clear();
        this.sol.fillStyle(cPiste, 1);
        this.sol.fillRect(ox, 0, wp, this.ligneLancerY);
        this.sol.lineStyle(Math.max(1, UI.u(this, 0.25)), cBord, 0.9);
        this.sol.strokeRect(ox, 0, wp, this.ligneLancerY);

        // Bandes latérales (PRD 875 §12) : dessin délégué à
        // BandesLaterales.dessiner(), appelé ICI (juste après le tracé de
        // la piste, avant le panneau d'info plus bas) pour préserver
        // l'empilement visuel exact sur ce même Graphics (depth=1,
        // l'ordre d'appel fait l'empilement).
        this.bandes.dessiner(this.sol);

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

        // Zone de tir (sous la piste, UNIQUEMENT la planche + la boule —
        // demande John 31/08 : plus aucun bouton ici, cf.
        // this.zoneTirHauteur/_recalculerGeometrie) : même teinte que la
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

        // Planche de tir (27/09, article 780 — géométrie : this.planche,
        // cf. _recalculerGeometrie) : fibre de verre/acier, gris clair.
        const pl = this.planche;
        this.sol.fillStyle(Phaser.Display.Color.HexStringToColor(C.planche.couleur).color, 1);
        this.sol.fillRect(pl.cx - pl.largeur / 2, pl.haut, pl.largeur, pl.bas - pl.haut);
        this.sol.lineStyle(Math.max(1, UI.u(this, 0.2)),
            Phaser.Display.Color.HexStringToColor(C.planche.couleurBord).color, 1);
        this.sol.strokeRect(pl.cx - pl.largeur / 2, pl.haut, pl.largeur, pl.bas - pl.haut);

        // Ligne de faute blanche (article 780 : « après la planche et sur
        // la piste », 3 cm de large) : sur la piste, juste au-dessus de la
        // ligne de lancer, toute la largeur. Jamais sous 2 px, sinon
        // invisible sur petit écran (3 cm ≈ 1,5 % de la largeur de piste).
        const epFaute = Math.max(2, this.pxParCm * C.planche.ligneFauteCm);
        this.sol.fillStyle(Phaser.Display.Color.HexStringToColor(C.planche.couleurLigneFaute).color, 1);
        this.sol.fillRect(ox, this.ligneLancerY - epFaute, wp, epFaute);
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

        // --- Bouton Tirer (tout en bas). Jamais sous la cible tactile de
        // l'arcade (44 px) : button.js applique déjà ce plancher tout seul
        // depuis le 25/09, mais SANS budgeter le même plancher ICI dans
        // l'empilement, un écran écrasé (paysage, h ~390) faisait rendre
        // le bouton plus grand que la place réservée — chevauchement avec
        // la rangée du dessus (bug trouvé en vérifiant la critique du
        // 25/09, jamais vu par John). ---
        const hauteurTirer = Math.max(UI.cibleMinPx, h * 0.11);
        const tirerY0 = h - marge - hauteurTirer;
        this.boutonTirer.redimensionner(w3 * 0.7, hauteurTirer)
            .setPosition(xCentre, tirerY0 + hauteurTirer / 2);

        // --- Boutons de pivot ◄ ► (au-dessus de Tirer, côte à côte). ---
        const hauteurPivot = Math.max(UI.cibleMinPx, h * 0.09);
        const pivotY0 = tirerY0 - marge - hauteurPivot;
        const yPivot = pivotY0 + hauteurPivot / 2;
        const largeurPivot = w3 / 2 - marge * 1.5;
        this.boutonRotGauche.redimensionner(largeurPivot, hauteurPivot)
            .setPosition(infoX + marge + largeurPivot / 2, yPivot);
        this.boutonRotDroite.redimensionner(largeurPivot, hauteurPivot)
            .setPosition(infoX + w3 - marge - largeurPivot / 2, yPivot);

        // --- Boutons de force -/+ (au-dessus du pivot). ---
        const hauteurForceBtn = Math.max(UI.cibleMinPx, h * 0.09);
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

        // --- Libellé « Force » (au-dessus de la barre). Jamais sous le
        // plancher de lisibilité de l'arcade (13 px, critique du 25/09). ---
        this.texteForce.setPosition(xCentre, this.forceBarY - UI.u(this, 3))
            .setFontSize(Math.round(Math.max(UI.policeMinPx, UI.u(this, 2.8))) + "px");

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

        // Jamais sous le plancher de lisibilité de l'arcade (13 px, critique
        // du 25/09) : sous-titre, compteur et consignes tombaient sous ce
        // seuil sur les petits téléphones (colonne à 1/3 d'écran).
        this.texteSousTitre.setFontSize(Math.round(Math.max(UI.policeMinPx, UI.u(this, 1.9))) + "px")
            .setWordWrapWidth(w3 * 0.9, true)
            .setPosition(xCentre, curY + this.texteSousTitre.displayHeight / 2);
        curY += this.texteSousTitre.displayHeight + UI.u(this, 2.5);

        // --- Jet / Score (sous le sous-titre, taille normale — demande
        // John : ne pas étirer pour remplir l'espace, laisser le vide
        // entre ce texte et le libellé « Force »). ---
        this.texteCompteur.setFontSize(Math.round(Math.max(UI.policeMinPx, UI.u(this, 3.2))) + "px")
            .setWordWrapWidth(w3 * 0.85, true)
            .setPosition(xCentre, curY + this.texteCompteur.displayHeight / 2);
        curY += this.texteCompteur.displayHeight + UI.u(this, 2.5);

        // --- Consignes de tir, 2 lignes (sous le compteur) — DÉPLACÉES ICI
        // le 04/09/2026 (demande John : elles étaient centrées sur la
        // piste et s'y chevauchaient, elles doivent être dans la colonne
        // de droite, comme le reste du texte). Empilage par hauteur
        // mesurée, même principe que titre/sous-titre/compteur ci-dessus.
        this.consigne1.setFontSize(Math.round(Math.max(UI.policeMinPx, UI.u(this, 2.6))) + "px")
            .setWordWrapWidth(w3 * 0.85, true)
            .setPosition(xCentre, curY + this.consigne1.displayHeight / 2);
        curY += this.consigne1.displayHeight + UI.u(this, 1);

        this.consigne2.setFontSize(Math.round(Math.max(UI.policeMinPx, UI.u(this, 2.6))) + "px")
            .setWordWrapWidth(w3 * 0.85, true)
            .setPosition(xCentre, curY + this.consigne2.displayHeight / 2);
    }

    // --- Jauge de précision (étape 2) -----------------------------------------

    _demarrerJauge() {
        if (this.etat !== "placement") return;
        this.etat = "jauge";
        this.jauge.demarrer();
        this.texteJauge.setVisible(true);
        this._cacherConsignes();
        this.visee.dessiner();
        this._positionnerTextes();
    }

    _arreterJauge() {
        if (this.etat !== "jauge") return;
        const C = window.QuillesSaintGallConfig;
        const conforme = this.jauge.arreter();
        this.etat = "feedback";
        this.feedbackRestant = C.jauge.delaiFeedbackMs;
        this.texteJauge.setText(conforme ? C.textes.conforme : C.textes.manque);
    }

    // --- Interactions ------------------------------------------------------------

    _pointerDown(p) {
        if (this.etat === "placement") {
            // Le glisser démarre n'importe où dans la ZONE DE TIR (toute la
            // largeur de la piste, sous la ligne de lancer), pas seulement
            // sur la planche : à 30 cm réels, elle ne fait qu'une vingtaine
            // de pixels sur téléphone, sous la cible tactile de 44 px.
            // Visee.poser ramène ensuite la boule sur la planche. Les
            // boutons ◄/► et « Tirer » sont ailleurs, hors de cette zone.
            const dansLargeur = p.x >= this.pisteOffsetX &&
                p.x <= this.pisteOffsetX + this.pisteLargeur;
            const dansHauteur = p.y >= this.ligneLancerY &&
                p.y <= this.ligneLancerY + this.zoneTirHauteur;
            if (dansLargeur && dansHauteur) {
                this.glisse = true;
                this.visee.poser(p);
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
        const deviationDeg = this.jauge.deviation * C.jauge.deviationAngleMaxDeg * signe;
        const angleRad = Phaser.Math.DegToRad(this.visee.angleDeg + deviationDeg);

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
        this.visee.dessiner();
    }

    _suivreBoule(dt) {
        const C = window.QuillesSaintGallConfig;
        this.ombreBoule.setPosition(this.boule.x, this.boule.y);

        // Un frame de plus pour cette course de la boule (sert à détecter
        // les chutes simultanées d'un ordre imposé, cf. _calculerOrdreJet).
        this.frameId++;

        // Collision boule/quilles : déléguée à Arcade Physics (corps
        // circulaires massiques, cf. _creerColliders/_processCollisionBouleQuille) —
        // s'applique aussi bien aux quilles ENCORE DEBOUT (mur, ou tombent
        // si le choc est assez fort) qu'à celles déjà TOMBÉES (`!absente`,
        // corps mobile au repos, la boule ne les traverse jamais : demande
        // John, 31/08). Les quilles COUCHÉES sont résolues en capsule par
        // ContactsCouchees (cf. update()).

        // Ralentissement continu une fois que la boule a touché au moins
        // une quille (demande John, 30/08 : sinon une boule qui continue
        // tout droit après un choc ne ralentit plus jamais toute seule).
        if (this.boule.getData("dejaTouche")) {
            const amorti = Math.max(0, 1 - C.boule.frictionApresChocPar_s * dt);
            const vf = this.boule.body.velocity;
            this.boule.body.setVelocity(vf.x * amorti, vf.y * amorti);
        }

        // Sortie de piste : la fosse en haut, OU les bords RÉELS au-delà
        // des bandes latérales (PRD 875 §12, cf. BandesLaterales.estHorsBornes)
        // — la boule peut rebondir sur les bandes (collision physique), ne
        // compte "dehors" qu'une fois passée la bordure extérieure de la bande.
        const dehors = this.boule.y < -20 || this.bandes.estHorsBornes(this.boule.x);

        // Filet de sécurité : après plusieurs rebonds amortis, la boule
        // peut devenir trop lente pour jamais sortir de la zone de quilles
        // — on l'arrête plutôt que de la laisser trembler indéfiniment.
        const v = this.boule.body.velocity;
        const tropLente = Math.hypot(v.x, v.y) < (C.boule.vitesseArretPct / 100) * this.h;
        if (dehors || tropLente) this._jetTermine();
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

        // PRD 875 §12 : tout jet dont la boule touche une bande latérale
        // est FAUTIF — réédition sans limite (même traitement que la
        // faute d'ordre, carte parent t_a543158c).
        if (this.bandes.toucheBande) {
            this._afficherRetourJet({
                texte: C.textes.fauteBande,
                boutonLabel: C.textes.rejouerJet,
                onContinuer: () => this._demarrerJet(this.numeroJet)
            });
            return;
        }

        const jc = this.jetConfig;
        const resultat = this.regles._calculerScoreJet();

        if (resultat.annule) {
            if (resultat.violation) {
                // Violation (ordre non respecté, 2+ quilles requises
                // ensemble hors ricochet) : réédition sans limite
                // (PRD 875 §9, décision John 09/09/2026).
                this._afficherRetourJet({
                    texte: C.textes.ordreNonRespecte,
                    boutonLabel: C.textes.rejouerJet,
                    onContinuer: () => this._demarrerJet(this.numeroJet)
                });
                return;
            }
            // Cible non atteinte SANS violation (art. 877 art. 10) :
            // 0 point, on passe au jet suivant.
            this._afficherRetourJet({
                texte: C.textes.cibleNonAtteinte,
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
                this.ordrePhaseAbattues.add(this.regles._dernierCiblePhase(jc.phase).cible);
            }
        }

        const pointsTotal = resultat.points + (resultat.pointsSupplementaires || 0);
        this.scoreTotal += pointsTotal;
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

        // Consignes : DÉPLACÉES dans la colonne d'info le 04/09/2026
        // (demande John : les 2 lignes en blanc sur la piste se
        // chevauchaient, elles doivent être « sur la droite ») — cf.
        // _positionnerColonneInfo. Résultat/rejouer restent ici, centrés
        // sur LA PISTE (this.ligneLancerY), inchangé.

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

        // Bouton Menu : seulement présent sur l'écran de FIN DE PARTIE
        // (pas sur le retour entre 2 jets), juste sous Rejouer.
        if (this.boutonMenu) {
            this.boutonMenu.redimensionner(UI.u(this, 30), UI.u(this, 10))
                .setPosition(pisteCentreX, this.ligneLancerY * 0.75 + UI.u(this, 12));
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
