/*
 * GameScene — la partie elle-même.
 *
 * ÉTAPE 5 : le personnage et les contrôles arrivent (100 % clic/tap,
 * article 409 — AUCUN clavier, le socle boot.js désactive keyboard et
 * gamepad) : 1 action = 1 bond d'une case, 4 directions, pas de
 * déplacement continu — les entrées sont ignorées pendant le bond.
 * Le monde glisse pour suivre le joueur (LaneGenerator.defilerBas +
 * avancer, pooling) : le joueur reste dans la même zone de l'écran en
 * avançant à l'infini. Le score = nombre de bonds vers l'avant réussis,
 * il ne recule jamais (il suit la position la plus avancée, CDC 706).
 *
 * FIX 06/08/2026 (Décision 1, article 704 — validée John) : AUCUN
 * contrôleur affiché à l'écran — le pavé directionnel et le swipe sont
 * supprimés. Le perso se déplace uniquement par clic/tap AUTOUR de lui,
 * 1 case par clic, dans la direction du clic par rapport au perso :
 * au-dessus → monte, gauche/droite → latéral, en dessous → descend vers
 * une case qui existe déjà (celle qu'on a quittée en avançant). Le recul
 * ne génère plus de terrain (reculer()/defilerHaut() ne sont plus
 * appelés — Décisions 2/3 génération procédurale, hors périmètre).
 *
 * ÉTAPE 6 — collisions (Arcade Physics, décision actée) et conditions de
 * mort (CDC 706 §Conditions) :
 *  - bande route : contact avec un véhicule = mort (overlap du corps du
 *    personnage avec les corps des véhicules de la bande) ;
 *  - bande eau : chute à l'eau = mort si le joueur n'est PAS sur un
 *    nénuphar ; s'il est porté par un nénuphar, il dérive avec le courant
 *    (comme Crossy Road) et meurt s'il est emporté hors de l'écran ;
 *  - bande rails : présent sur les rails au passage du train = mort
 *    (contrat bande.estMortelAuPoint exposé par LaneGenerator — phase
 *    "passage" + emprise du convoi).
 * La menace anti-attente (cigogne) n'est PAS dans cette étape (étape 8).
 * Le bouton « Terminer (provisoire) » disparaît : la mort le remplace.
 *
 * Le personnage est un piéton p8city (placeholder) : aucun sprite de Waggis
 * dans l'atelier (vérifié 06/08 — POINT OUVERT ASSETS, même statut que le
 * train : à remplacer quand l'atelier livrera le vrai Waggis).
 *
 * ⭐ D2-3 (spec 708 §1/§8/§9/§10) — niveaux finis + fin de niveau :
 *  - le niveau joué vient de la save (registry data.currentLevel), il
 *    n'est plus dérivé du score ; lignesNiveau = lignes(niveau) = 42 +
 *    niveau (708 §1, levels.json) ;
 *  - FIN DE NIVEAU (708 §10) : quand l'index du joueur atteint
 *    lignes(niveau) → victoire (gagner()), passage au niveau suivant via
 *    l'écran de fin (OverScene en mode victoire, qui écrit la save) ;
 *  - MORT (708 §8) : relance le MÊME niveau avec le MÊME generatedRows
 *    tant que la session est en cours (Rejouer de l'écran de fin ne touche
 *    pas au monde), aucun système de vies — tentatives illimitées ;
 *  - SAVE (708 §9) : aucune écriture en cours de partie — la save
 *    n'intervient qu'à la victoire du niveau (OverScene mode victoire) ;
 *    une fermeture en cours de niveau laisse le joueur sur son niveau
 *    (currentLevel inchangé), régénéré à zéro au prochain lancement.
 */
class GameScene extends Phaser.Scene {
    static KEY = "jeu";

    constructor() {
        super(GameScene.KEY);
    }

    /**
     * ⭐ MENU-3 (spec 709) : l'écran Niveaux peut lancer un niveau précis
     * (scene.start(GameScene.KEY, { niveau })). Sans donnée, le niveau
     * vient du registry (create() — voir niveauSession / currentLevel).
     *
     * PIÈGE PHASER (corrigé 07/08, QA MENU-3) : le SceneManager ne
     * remplace settings.data que si le scene.start passe un objet. Sans
     * data, la scène reçoit celle du démarrage PRÉCÉDENT ({ niveau } de
     * l'écran Niveaux) → le niveau rejoué repartirait au lieu du niveau
     * en cours. RÈGLE : tout scene.start(GameScene.KEY) passe TOUJOURS
     * une data explicite — { niveau } (écran Niveaux) ou {} (menu /
     * Rejouer / Niveau suivant = niveau courant du registry).
     */
    init(data) {
        const n = data && data.niveau;
        this._niveauDemande = (typeof n === "number" && n >= 1) ? n : null;
    }

    create() {
        const C = window.WaggisConfig;
        const UI = Arcade.UI;
        this.C = C; // config accessible aux méthodes (bonds, score, layout)

        this.cameras.main.setBackgroundColor(C.couleurs.ciel);

        // --- État du joueur ------------------------------------------------
        this.score = 0;          // bonds vers l'avant réussis (ne recule jamais)
        this.progression = 0;    // position courante (bandes depuis le départ)
        this.enBond = false;     // un bond en cours : entrées ignorées
        this._finEnCours = false;

        // --- Niveau (D2-3, spec 708 §1/§10) -------------------------------
        // Le niveau joué vient de la save (data.currentLevel, registry) —
        // il n'est plus dérivé du score. ⭐ MENU-3 (spec 709) : l'écran
        // Niveaux peut lancer un niveau précis ({ niveau }, init) ; la
        // relance après mort (Rejouer, 708 §8) reprend le même niveau via
        // niveauSession ; « Jouer » du menu repart de data.currentLevel.
        // lignesNiveau = lignes(niveau) = 42 + niveau (levels.json) : c'est
        // le bornage de la fin de niveau.
        if (this._niveauDemande) {
            this.niveau = this._niveauDemande;
        } else {
            this.niveau = this.registry.get("niveauSession")
                || this.registry.get("currentLevel") || 1;
        }
        this.registry.set("niveauSession", this.niveau);

        // --- Terrain généré (étapes 2-4, D2-1 : monde stable) ------------
        // ⭐ D2-1 (spec 708 §8) : à la mort, le joueur relance le MÊME
        // niveau avec le MÊME generatedRows (rien n'est réinventé). Le
        // monde de la session est conservé dans le registry (partagé
        // entre les scènes) ; une nouvelle partie depuis le menu le
        // remet à zéro (voir MenuScene). D2-3 : le monde est aussi
        // remis à zéro au passage au niveau suivant (victoire).
        this.lanes = new LaneGenerator(this, this.registry.get("generatedRows") || null);
        // D2-3 : le générateur n'a plus de dérivation score→niveau — le
        // niveau lui est fixé ici (spec 708 §5 : vitesse/densité en
        // découlent), avant la génération initiale.
        this.lanes.niveau = this.niveau;
        this.lignesNiveau = this.lanes.lignesNiveau(this.niveau);
        this.lanes.genererInitiales(0);
        // Le monde généré reste accessible aux prochaines scènes (mort →
        // rejouer) : c'est lui qui sera persisté dans la save (v2, D2-1).
        this.registry.set("generatedRows", this.lanes.generatedRows);
        UI.layout(this, () => this.lanes.redimensionner());

        // --- Personnage (placeholder p8city, cf. en-tête) ------------------
        const cote = this.lanes.hauteur * C.controles.persoTaille;
        if (!this.anims.exists("pieton_marche")) {
            // 3 frames de marche du piéton p8city (8x8, agrandies).
            this.anims.create({
                key: "pieton_marche",
                frames: [
                    { key: "pieton_rouge_1" },
                    { key: "pieton_rouge_2" },
                    { key: "pieton_rouge_3" }
                ],
                frameRate: 14,
                repeat: -1
            });
        }
        const depart = this.lanes.bandeDepart();
        this.perso = this.add.sprite(this.scale.width / 2, depart.y, "pieton_rouge_1")
            .setDisplaySize(cote, cote)
            .setDepth(10);   // au-dessus des bandes (max 5), sous l'UI (50)
        // Corps Arcade du personnage (étape 6 — collisions, CDC 706 :
        // Arcade Physics décision actée). Immobile et sans gravité : le
        // personnage est déplacé par les bonds (tweens), le corps suit
        // le sprite automatiquement (synchronisé par le monde Arcade).
        // La hitbox est plus petite que le sprite (fair-play, cf. config).
        this.physics.add.existing(this.perso);
        this.perso.body.setAllowGravity(false);
        this.perso.body.setImmovable(true);
        this._tailleHitboxPerso();
        // Ombre portée au sol : ancre visuelle pendant les bonds.
        this.ombre = this.add.ellipse(
            this.perso.x, this.perso.y + cote * 0.3,
            cote * 0.6, cote * 0.2, 0x000000, 0.25
        ).setDepth(9);
        this.bandeJoueur = depart;
        this._poserPerso(this.perso.x, this.bandeJoueur.y);

        // --- Score en cours (haut au centre, non interactif) ---------------
        this.texteScore = UI.text(this, 0, 0, "", 4, C.couleurs.texte);
        this.texteScore.setDepth(40);
        this._afficherScore();

        // D2-3 : niveau en cours (haut à gauche). Le niveau joué vient de
        // la save (data.currentLevel) — il n'est plus dérivé du score.
        this.texteNiveau = UI.text(this, 0, 0, "", 3.5, C.couleurs.texte);
        this.texteNiveau.setDepth(40);
        this._afficherNiveau();

        // --- Contrôles (FIX 06/08 — Décision 1, article 704) --------------
        // AUCUN contrôleur à l'écran : le perso se déplace uniquement par
        // clic/tap AUTOUR de lui, 1 case par clic, dans la direction du
        // clic par rapport au perso (au-dessus → monte, gauche/droite →
        // latéral, en dessous → descend vers une case qui existe déjà).
        // Un clic sur le perso lui-même (zone morte) ne déclenche rien.
        this.input.on("pointerup", (p) => {
            const dx = p.x - this.perso.x;
            const dy = p.y - this.perso.y;
            const zone = this.perso.displayWidth * C.controles.zoneMorteClic;
            if (Math.abs(dx) < zone && Math.abs(dy) < zone) return; // sur le perso
            if (Math.abs(dy) >= Math.abs(dx)) {
                if (dy < 0) this.bondAvant(); else this.bondArriere();
            } else {
                if (dx > 0) this.bondDroite(); else this.bondGauche();
            }
        });

        // --- Redimensionnement : le joueur suit sa bande -------------------
        UI.layout(this, (w, h) => {
            if (!this.perso || !this.bandeJoueur) return;
            // Le personnage et son ombre suivent la hauteur des bandes.
            const taillePerso = this.lanes.hauteur * this.C.controles.persoTaille;
            this.perso.setDisplaySize(taillePerso, taillePerso);
            this._tailleHitboxPerso();   // hitbox resynchronisée (collisions)
            this.ombre.setSize(taillePerso * 0.6, taillePerso * 0.2);
            const x = Math.max(
                this.lanes.hauteur / 2,
                Math.min(w - this.lanes.hauteur / 2, this.perso.x)
            );
            this._poserPerso(x, this.bandeJoueur.y);
            this.texteScore.setPosition(w / 2, h * 0.06);
            this.texteNiveau.setPosition(w * 0.08, h * 0.06);
        });
    }

    /** Dimensionne la hitbox Arcade du personnage (fraction de sa taille). */
    _tailleHitboxPerso() {
        if (!this.perso || !this.perso.body) return;
        const c = this.perso.displayWidth * this.C.collisions.persoHitbox;
        // setSize dimensionne en pixels de TEXTURE SOURCE, puis le corps
        // est multiplié par le scale du sprite (corps écran = source ×
        // scale). On divise donc par le scale pour que le corps ÉCRAN soit
        // exactement la fraction demandée (fix NC-1, QA e6a571d).
        const sx = Math.abs(this.perso.scaleX) || 1;
        const sy = Math.abs(this.perso.scaleY) || 1;
        this.perso.body.setSize(c / sx, c / sy);
    }

    /**
     * Fait tourner le monde (véhicules, nénuphars, trains) et applique la
     * position du personnage pendant un bond (déplacement + arc), puis
     * vérifie les conditions de mort (étape 6) quand le joueur est posé.
     */
    update(time, delta) {
        if (this.lanes) this.lanes.update(time, delta);
        if (this._etatBond) {
            this.perso.setPosition(this._etatBond.x, this._etatBond.y - this._altitude);
            this.ombre.setPosition(this._etatBond.x, this._etatBond.y + this._ombreOffset);
        }
        // Collisions (étape 6) : uniquement quand le joueur est posé (pas
        // en plein bond) et que la partie n'est pas déjà finie.
        if (!this.enBond && !this._finEnCours) this._verifierMort(delta);
    }

    // ------------------------------------------------------------------
    // Bonds (1 action = 1 bond d'une case, 4 directions)
    // ------------------------------------------------------------------

    /** Bond vers la bande au-dessus : +1 au score (jamais de recul). */
    bondAvant() {
        if (this.enBond || this._finEnCours) return;
        const bandes = this.lanes.bandes;
        const idx = bandes.indexOf(this.bandeJoueur);
        if (idx + 1 >= bandes.length) return; // sécurité : plus de bande au-dessus

        this.bandeJoueur = bandes[idx + 1];
        this.progression++;
        if (this.progression > this.score) {
            this.score = this.progression;
            this._afficherScore();
        }

        const yCible = this.bandeJoueur.y;
        this._jouerSonBond();
        this._sauterVers(this.perso.x, yCible, () => {
            // Le joueur est trop haut : le monde glisse d'une bande vers le
            // bas et la bande du bas (hors écran) est recyclée en haut.
            if (this.bandeJoueur.y < this.scale.height * this.C.controles.seuilDefileHaut) {
                this.lanes.defilerBas();
                this.lanes.avancer(this.score);
                this._poserPerso(this.perso.x, this.bandeJoueur.y);
            }
            // D2-3 (spec 708 §10) : fin de niveau — quand l'index du joueur
            // atteint lignes(niveau) (42 + niveau, levels.json), victoire.
            if (this.bandeJoueur.index >= this.lignesNiveau) this.gagner();
        });
    }

    /**
     * Bond vers la bande au-dessous (Décision 1, article 704) : le perso
     * descend d'une case, UNIQUEMENT vers une case qui existe déjà (celle
     * qu'on a quittée en avançant). Le score ne recule jamais.
     *
     * ⭐ D2-1 (Décisions 2/3, spec 708 §7) : quand le joueur est sur la
     * bande la plus basse du pool, descendre encore fait glisser le monde
     * vers le haut (reculer() + defilerHaut()) : la bande recréée en
     * dessous est RELUE depuis generatedRows (retour sur nos pas = la même
     * ligne, jamais régénérée — le monde ne se réinvente pas), et le recul
     * est BORNÉ à l'index 0 : reculer() retourne null avant le début (rien
     * ne peut exister avant le point de départ, Décision 2). Au départ
     * (première ligne) aucune case n'existe sous le perso : aucun bond, et
     * cliquer en dessous est physiquement impossible (article 704).
     */
    bondArriere() {
        if (this.enBond || this._finEnCours) return;
        const bandes = this.lanes.bandes;
        const idx = bandes.indexOf(this.bandeJoueur);
        if (idx <= 0) {
            // Plus de bande sous le joueur dans le pool : le monde doit
            // glisser pour révéler la ligne du dessous (relue, jamais
            // régénérée). reculer() retourne null si on est à l'index 0.
            const bandeEnDessous = this.lanes.reculer(this.score);
            if (!bandeEnDessous) return; // début du monde : rien en dessous
            this.lanes.defilerHaut();
            this.bandeJoueur = bandeEnDessous;
            this.progression = Math.max(0, this.progression - 1);
            const yCible = this.bandeJoueur.y;
            this._jouerSonBond();
            this._sauterVers(this.perso.x, yCible, null);
            return;
        }
        this.bandeJoueur = bandes[idx - 1];
        this.progression = Math.max(0, this.progression - 1);

        const yCible = this.bandeJoueur.y;
        this._jouerSonBond();
        this._sauterVers(this.perso.x, yCible, null);
    }

    /** Bond latéral d'une case (la case = la hauteur d'une bande). */
    bondGauche() {
        if (this.enBond || this._finEnCours) return;
        const pas = this.lanes.hauteur;
        const xCible = Math.max(pas / 2, this.perso.x - pas);
        if (xCible === this.perso.x) return; // déjà au bord
        this._jouerSonBond();
        this._sauterVers(xCible, this.perso.y, null);
    }

    /** Bond latéral d'une case (la case = la hauteur d'une bande). */
    bondDroite() {
        if (this.enBond || this._finEnCours) return;
        const pas = this.lanes.hauteur;
        const xCible = Math.min(this.scale.width - pas / 2, this.perso.x + pas);
        if (xCible === this.perso.x) return; // déjà au bord
        this._jouerSonBond();
        this._sauterVers(xCible, this.perso.y, null);
    }


    /**
     * Anime un bond : la position de base glisse de l'ancienne case à la
     * nouvelle (déplacement), pendant qu'un compteur en yo-yo ajoute l'arc
     * (le personnage monte puis redescend). Les entrées restent ignorées
     * pendant toute la durée du bond (1 action = 1 bond).
     * @param {number} xCible abscisse d'arrivée
     * @param {number} yCible ordonnée d'arrivée
     * @param {Function} [apres] appelé une fois le bond terminé
     */
    _sauterVers(xCible, yCible, apres) {
        const C = this.C.controles;
        this.enBond = true;
        const duree = C.bondDureeMs;
        const arc = this.lanes.hauteur * C.bondHauteur;

        this._etatBond = { x: this.perso.x, y: this.perso.y };
        this._altitude = 0;
        this._ombreOffset = this.ombre.y - this._etatBond.y;
        if (this.perso.anims) this.perso.play("pieton_marche", true);

        // Arc du bond (monte puis redescend, yo-yo sur la moitié de durée).
        this.tweens.addCounter({
            from: 0, to: arc, duration: duree / 2, ease: "Quad.easeOut", yoyo: true,
            onUpdate: (t) => { this._altitude = t.getValue(); }
        });
        // Déplacement de base (la position du personnage est appliquée
        // dans update(), cf. _etatBond).
        this.tweens.add({
            targets: this._etatBond, x: xCible, y: yCible,
            duration: duree, ease: "Linear",
            onComplete: () => {
                this.enBond = false;
                this._etatBond = null;
                this._altitude = 0;
                this._poserPerso(xCible, yCible);
                if (this.perso.anims) {
                    this.perso.stop();
                    // Les frames de marche sont des textures distinctes
                    // (piéton p8city 8x8) : on remet la texture de repos.
                    this.perso.setTexture("pieton_rouge_1");
                }
                if (apres) apres();
            }
        });
    }

    /** Pose le personnage et son ombre (hors bond). */
    _poserPerso(x, y) {
        if (!this.perso || !this.ombre) return;
        this.perso.setPosition(x, y);
        this.ombre.setPosition(x, y + this.perso.displayHeight * 0.3);
    }

    /** Son du bond : snd_jump de l'atelier (décision John 06/08). */
    _jouerSonBond() {
        if (!this.sound || this.sound.locked) return; // audio pas déverrouillée
        this.sound.play("snd_jump", { volume: 0.3 });
    }

    /** Rafraîchit le texte du score en haut au centre. */
    _afficherScore() {
        if (this.texteScore) {
            this.texteScore.setText(
                this.C.textes.scoreEnCours.replace("{score}", this.score)
            );
        }
    }

    /** Rafraîchit le texte du niveau en haut à gauche (D2-3). */
    _afficherNiveau() {
        if (this.texteNiveau) {
            this.texteNiveau.setText("Niveau " + this.niveau);
        }
    }


    /**
     * Conditions de mort (étape 6, CDC 706 §Conditions — Arcade Physics).
     * Appelée à chaque frame quand le joueur est posé (pas en plein bond) :
     *  - bande route/piste : contact avec un véhicule = mort (overlap du
     *    corps du personnage avec les corps des véhicules de la bande) ;
     *  - bande eau : chute à l'eau = mort si aucun flottant (plante ou
     *    bateau, spec 708 §6) ne porte le joueur ; sinon le joueur dérive
     *    avec le courant et meurt s'il est emporté hors de l'écran ;
     *  - bande train : présent sur les rails au passage du train = mort
     *    (contrat bande.estMortelAuPoint exposé par LaneGenerator).
     * @param {number} delta ms écoulées depuis la dernière frame (dérive)
     */
    _verifierMort(delta) {
        const bande = this.bandeJoueur;
        if (!bande) return;
        const T = LaneGenerator.TYPES;

        if (bande.type === T.ROUTE || bande.type === T.PISTE) {
            // Contact véhicule = mort (la piste d'atterrissage est un type
            // « comportement identique à une route », spec 708 §3). Le
            // corps du personnage (hitbox réduite) overlap les corps des
            // véhicules de la bande.
            for (const v of bande.vehicules) {
                if (this._chevauche(this.perso, v.sprite)) {
                    this.mourir("vehicule");
                    return;
                }
            }
        } else if (bande.type === T.EAU) {
            // Chute à l'eau = mort si aucun flottant (plante OU bateau —
            // les deux sont des supports, spec 708 §6) ne porte le joueur.
            let support = null;
            for (const f of bande.flottants) {
                if (this._chevauche(this.perso, f.sprite)) {
                    support = f;
                    break;
                }
            }
            if (!support) {
                this.mourir("eau");
                return;
            }
            // Porté par le courant : le joueur dérive avec le flottant
            // (mécanique Crossy Road). Emporté hors de l'écran = chute.
            const cellW = this.scale.width / this.C.lanes.largeurCases;
            const dx = support.direction * support.vitesseCases * cellW * (delta / 1000);
            const nx = this.perso.x + dx;
            const w = this.scale.width;
            if (nx < 0 || nx > w) {
                this.mourir("eau");
                return;
            }
            this._poserPerso(nx, this.perso.y);
            // Le corps du personnage suit le sprite (monde Arcade).
        } else if (bande.type === T.TRAIN) {
            // Présent sur les rails au passage du train = mort (contrat
            // exposé par LaneGenerator : phase "passage" + emprise du
            // convoi, demi-largeur du personnage incluse).
            if (bande.estMortelAuPoint(this.perso.x, this.perso.displayWidth / 2)) {
                this.mourir("train");
            }
        }
    }

    /**
     * Test de chevauchement Arcade entre deux sprites. Les corps sont
     * d'abord resynchronisés depuis leur sprite : les obstacles sont
     * déplacés dans lanes.update() pendant le update() de la scène, or le
     * monde Arcade synchronise les bodies AVANT ce déplacement — sans
     * resynchronisation, l'overlap testerait des positions vieilles d'une
     * frame (faux négatif au pixel près, vérifié au harnais).
     * @returns {boolean} true si les deux corps se chevauchent
     */
    _chevauche(a, b) {
        if (a.body) a.body.updateFromGameObject();
        if (b.body && b.body.enable) b.body.updateFromGameObject();
        return this.physics.overlap(a, b);
    }

    /**
     * Fin de partie (étape 6) : le score réel (bonds vers l'avant réussis)
     * est passé à l'écran de fin. Remplace le bouton « Terminer »
     * provisoire des étapes 1-5.
     * @param {string} cause "vehicule" | "eau" | "train" (son dédié)
     */
    mourir(cause) {
        if (this._finEnCours) return;
        this._finEnCours = true;
        this._jouerSonMort(cause);
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => {
            this.scene.start(OverScene.KEY, { score: this.score });
        });
    }

    /**
     * D2-3 (spec 708 §10) : fin de niveau — l'index du joueur a atteint
     * lignes(niveau) (42 + niveau) → victoire, passage au niveau suivant.
     * L'écran de fin s'ouvre en mode victoire (OverScene) : c'est là que la
     * save est écrite (UNIQUEMENT à la victoire, spec 708 §9) et que le
     * bouton « Niveau suivant » lance le niveau suivant avec un monde neuf.
     * Le score (bonds vers l'avant réussis) est passé à l'écran de fin
     * comme à la mort (CDC 706 §Score — envoyé à core/score.js par
     * OverScene).
     */
    gagner() {
        if (this._finEnCours) return;
        this._finEnCours = true;
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => {
            this.scene.start(OverScene.KEY, {
                score: this.score,
                victoire: true,
                niveau: this.niveau
            });
        });
    }

    /**
     * Son de la mort (MP3 de l'atelier, décision John 06/08 — réutiliser
     * les sons, pas de dédiés) : snd_hurt pour véhicule/train, snd_fall
     * pour la chute à l'eau.
     */
    _jouerSonMort(cause) {
        if (!this.sound || this.sound.locked) return; // audio pas déverrouillée
        const son = cause === "eau" ? "snd_fall" : "snd_hurt";
        this.sound.play(son, { volume: 0.4 });
    }
}
