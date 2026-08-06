/*
 * GameScene — la partie elle-même.
 *
 * ÉTAPE 5 : le personnage et les contrôles arrivent (100 % clic/tap,
 * article 409 — AUCUN clavier, le socle boot.js désactive keyboard et
 * gamepad) :
 *  - 1 action = 1 bond d'une case, 4 directions (haut/bas/gauche/droite),
 *    pas de déplacement continu — les entrées sont ignorées pendant le bond ;
 *  - swipe (mobile, et clic-glissé PC) : haut = avancer, bas/gauche/droite
 *    = reculer/latéral (CDC 706 §Contrôles) ;
 *  - pavé directionnel VISIBLE à l'écran (équivalent PC obligatoire du
 *    clavier — « tout élément interactif doit être visible », article 409 ;
 *    le CDC préfère les boutons visibles au geste invisible).
 * Le monde glisse pour suivre le joueur (LaneGenerator.defilerBas/Haut +
 * avancer/reculer, pooling) : le joueur reste dans la même zone de l'écran
 * en avançant à l'infini. Le score = nombre de bonds vers l'avant réussis,
 * il ne recule jamais (il suit la position la plus avancée, CDC 706).
 *
 * Le personnage est un piéton p8city (placeholder) : aucun sprite de Waggis
 * dans l'atelier (vérifié 06/08 — POINT OUVERT ASSETS, même statut que le
 * train : à remplacer quand l'atelier livrera le vrai Waggis).
 *
 * Le bouton « Terminer (provisoire) » reste nécessaire tant qu'il n'y a pas
 * de conditions de mort : sans lui, aucune partie ne peut se finir et la
 * chaîne menu → jeu → fin n'est plus testable. Il est relégué en haut à
 * droite (petit) pour ne pas masquer le terrain, et disparaîtra à l'étape
 * collisions. Aucun contrôle V1 (tap par case) n'est conservé.
 */
class GameScene extends Phaser.Scene {
    static KEY = "jeu";

    constructor() {
        super(GameScene.KEY);
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
        this._zonesBoutons = []; // zones interactives « bouton » (pas de swipe)

        // --- Terrain généré (étapes 2-4) -----------------------------------
        this.lanes = new LaneGenerator(this);
        this.lanes.genererInitiales(0);
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

        // --- Bouton provisoire (retiré quand la mort arrive, étape 4) ------
        const finir = UI.button(this, {
            width: UI.u(this, 24), height: UI.u(this, 8),
            label: C.textes.finirProvisoire,
            color: C.couleurs.bouton,
            textColor: C.couleurs.texteClair,
            onClick: () => this.terminer()
        });
        this._zonesBoutons.push(finir.zone);
        UI.layout(this, (w, h) => {
            finir.redimensionner(UI.u(this, 24), UI.u(this, 8))
                 .setPosition(w - UI.u(this, 13), UI.u(this, 6));
        });

        // --- Pavé directionnel (équivalent PC obligatoire, article 409) ----
        this._creerPaveDirectionnel();

        // --- Swipe / clic-glissé (mobile + PC, CDC 706 §Contrôles) ---------
        // Un geste qui COMMENCE sur un bouton n'est pas un swipe : il
        // déclenche le bouton (bond immédiat au pointerdown, réactivité
        // tactile) — jamais les deux pour la même action.
        this.input.on("pointerdown", (p) => {
            this._geste = null;
            const cibles = (this.input.hitTestPointer && this.input.hitTestPointer(p)) || [];
            for (const c of cibles) {
                if (this._zonesBoutons.indexOf(c) !== -1) return; // bouton
            }
            this._geste = { x: p.x, y: p.y };
        });
        this.input.on("pointerup", (p) => {
            if (!this._geste) return;
            const dx = p.x - this._geste.x;
            const dy = p.y - this._geste.y;
            this._geste = null;
            const seuil = UI.u(this, C.controles.seuilSwipePct);
            if (Math.abs(dx) < seuil && Math.abs(dy) < seuil) return; // tap sans direction
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
            this.ombre.setSize(taillePerso * 0.6, taillePerso * 0.2);
            const x = Math.max(
                this.lanes.hauteur / 2,
                Math.min(w - this.lanes.hauteur / 2, this.perso.x)
            );
            this._poserPerso(x, this.bandeJoueur.y);
            this.texteScore.setPosition(w / 2, h * 0.06);
        });
    }

    /**
     * Fait tourner le monde (véhicules, nénuphars, trains) et applique la
     * position du personnage pendant un bond (déplacement + arc).
     */
    update(time, delta) {
        if (this.lanes) this.lanes.update(time, delta);
        if (this._etatBond) {
            this.perso.setPosition(this._etatBond.x, this._etatBond.y - this._altitude);
            this.ombre.setPosition(this._etatBond.x, this._etatBond.y + this._ombreOffset);
        }
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
        });
    }

    /** Bond vers la bande au-dessous : ne fait jamais reculer le score. */
    bondArriere() {
        if (this.enBond || this._finEnCours) return;
        // Chaque recul fait glisser le monde vers le haut : la bande du
        // haut (hors écran) est recyclée EN DESSOUS avec un nouveau type
        // (monde infini vers le bas, terrain ré-ensemencé), puis le monde
        // remonte d'une bande — le joueur reste à la même hauteur d'écran,
        // comme en avant (l'inverse exact d'avancer()). Le décalage reste
        // invariant : la compensation de reculer() (+hauteur) et
        // defilerHaut() (−hauteur) s'annulent, le monde couvre l'écran.
        this.lanes.reculer(this.score);
        this.lanes.defilerHaut();
        const bandes = this.lanes.bandes;
        const idx = bandes.indexOf(this.bandeJoueur);   // +1 après le unshift
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

    /** Expédie un bond dans la direction demandée (boutons du pavé). */
    bond(direction) {
        if (direction === "haut") this.bondAvant();
        else if (direction === "bas") this.bondArriere();
        else if (direction === "gauche") this.bondGauche();
        else this.bondDroite();
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

    /**
     * Pavé directionnel (4 boutons VISIBLES, article 409) : la croix
     * classique ▲ / ◀ ▶ / ▼, en bas à droite. Chaque bouton déclenche son
     * bond au POINTERDOWN (réponse immédiate au toucher) ; le pointerup du
     * bouton ne fait rien (un geste commencé sur un bouton n'est jamais un
     * swipe, cf. create()).
     */
    _creerPaveDirectionnel() {
        const C = this.C;
        const UI = Arcade.UI;
        const taille = () => UI.u(this, C.controles.boutonTaille);
        const ecart = () => UI.u(this, C.controles.boutonEcart);

        const fabriquer = (fleche, direction) => {
            const bouton = UI.button(this, {
                width: taille(), height: taille(),
                label: fleche,
                color: C.couleurs.bouton,
                textColor: C.couleurs.texteClair,
                onClick: () => {} // bond déclenché au pointerdown (réactivité)
            });
            bouton.zone.on("pointerdown", () => this.bond(direction));
            this._zonesBoutons.push(bouton.zone);
            return bouton;
        };

        this.btnHaut = fabriquer(C.textes.flecheHaut, "haut");
        this.btnBas = fabriquer(C.textes.flecheBas, "bas");
        this.btnGauche = fabriquer(C.textes.flecheGauche, "gauche");
        this.btnDroite = fabriquer(C.textes.flecheDroite, "droite");

        UI.layout(this, (w, h) => {
            const t = taille();
            const e = ecart();
            const cx = w * (C.controles.paveX / 100);
            const cy = h * (C.controles.paveY / 100);
            this.btnHaut.redimensionner(t, t).setPosition(cx, cy - e);
            this.btnBas.redimensionner(t, t).setPosition(cx, cy + e);
            this.btnGauche.redimensionner(t, t).setPosition(cx - e, cy);
            this.btnDroite.redimensionner(t, t).setPosition(cx + e, cy);
        });
    }

    /**
     * Fin de partie : le score réel (bonds vers l'avant réussis) est passé
     * à l'écran de fin. Remplacé aux étapes suivantes par les conditions de
     * mort (collision véhicule, chute à l'eau, train, menace anti-attente).
     */
    terminer() {
        if (this._finEnCours) return;
        this._finEnCours = true;
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => {
            this.scene.start(OverScene.KEY, { score: this.score });
        });
    }
}
