/*
 * GameScene — la partie elle-même.
 *
 * Principe : la cigogne tombe, chaque tap lui donne un coup d'aile. Les
 * maisons alsaciennes défilent de droite à gauche ; passer entre deux
 * maisons rapporte un point.
 */
class GameScene extends Phaser.Scene {
    static KEY = "jeu";

    constructor() {
        super(GameScene.KEY);
    }

    create() {
        const C = window.CigogneConfig;
        const UI = Arcade.UI;
        const w = this.scale.width;
        const h = this.scale.height;

        this.score = 0;
        this.enCours = false;   // la partie démarre au premier tap
        this.termine = false;
        this.maisonsList = [];  // suivi des obstacles pour le score

        this.decor = new CigogneDecor(this);

        // --- La cigogne ------------------------------------------------------
        this.oiseau = this.physics.add.sprite(w * (C.positionXPct / 100), h * 0.4, "cigogne");
        this.oiseau.play("voler");
        this.oiseau.setDepth(20);
        this.oiseau.body.setAllowGravity(false);
        this.redimensionnerOiseau();

        // --- Obstacles -------------------------------------------------------
        this.maisons = this.physics.add.group();
        this.physics.add.overlap(this.oiseau, this.maisons, () => this.perdre(), null, this);

        // Le sol est dessiné APRÈS les maisons pour passer devant.
        this.decor.creerFond();

        // --- Interface -------------------------------------------------------
        this.texteScore = UI.text(this, w / 2, h * 0.12, "0", 9, C.couleurs.texte).setDepth(30);
        this.consigne = UI.text(
            this, w / 2, h * 0.62, "Touche l'écran\npour voler", 5, C.couleurs.texte
        ).setDepth(30);

        UI.tapAnywhere(this, () => this.battre());

        // --- Réglages dépendant de la taille de l'écran ----------------------
        UI.layout(this, (lw, lh) => {
            this.physics.world.gravity.y = C.gravitePar_h * lh;
            this.vitesse = C.vitessePar_w * lw;
            this.ecart = C.ecartPar_w * lw;
            this.oiseau.setX(lw * (C.positionXPct / 100));
            this.redimensionnerOiseau();
            this.texteScore.setPosition(lw / 2, lh * 0.12);
            if (this.consigne) this.consigne.setPosition(lw / 2, lh * 0.62);
        });
    }

    /**
     * Ajuste la taille de la cigogne à l'écran ET sa boîte de collision.
     *
     * L'image source fait 256 x 256 avec beaucoup de vide autour de l'oiseau.
     * La boîte de collision se définit en pixels de l'IMAGE SOURCE (Phaser
     * applique ensuite l'échelle tout seul) : lui passer des pixels d'écran
     * donnait une boîte bien plus grande que la cigogne — d'où l'impression
     * de heurter un mur invisible.
     */
    redimensionnerOiseau() {
        const C = window.CigogneConfig;
        const taille = Arcade.UI.u(this, C.tailleOiseauPct);

        this.oiseau.setDisplaySize(taille, taille);

        const cote = 256 * C.hitboxRatio;          // en pixels de l'image source
        this.oiseau.body.setSize(cote, cote, true); // true = centré sur l'image
        this.oiseau.body.updateFromGameObject();
    }

    /** Un coup d'aile (et le lancement de la partie au premier appui). */
    battre() {
        if (this.termine) return;
        const C = window.CigogneConfig;

        if (!this.enCours) {
            this.enCours = true;
            if (this.consigne) {
                this.consigne.destroy();
                this.consigne = null;
            }
            this.oiseau.body.setAllowGravity(true);
            this.creerMaison(this.scale.width * 1.1);
        }

        this.oiseau.body.setVelocityY(C.battementPar_h * this.scale.height);
    }

    /** Crée une paire de maisons (haut + bas) avec un passage au milieu. */
    creerMaison(x) {
        const C = window.CigogneConfig;
        const h = this.scale.height;
        const w = this.scale.width;

        const largeur = w * (C.largeurMaisonPct / 100);
        const hauteurToit = largeur * 0.28;
        const ouverture = h * (C.ouverturePct / 100);
        const solY = this.decor.niveauSol();

        // Position verticale du passage, en évitant le haut de l'écran et le sol
        const minY = h * (C.margeHautPct / 100) + ouverture / 2;
        const maxY = solY - h * (C.margeBasPct / 100) - ouverture / 2;
        const centre = Phaser.Math.Between(minY, Math.max(minY, maxY));

        const hautY = centre - ouverture / 2;   // bas de la maison du haut
        const basY = centre + ouverture / 2;    // haut de la maison du bas

        const parts = [];

        // Maison suspendue au plafond
        const hMurHaut = Math.max(1, hautY - hauteurToit);
        parts.push(this.ajouterPart(
            this.add.tileSprite(x, hMurHaut / 2, largeur, hMurHaut, "facade")
        ));
        parts.push(this.ajouterPart(
            this.add.image(x, hautY - hauteurToit / 2, "toit")
                .setDisplaySize(largeur * 1.15, hauteurToit)
        ));

        // Maison posée au sol
        const hMurBas = Math.max(1, solY - basY - hauteurToit);
        parts.push(this.ajouterPart(
            this.add.tileSprite(x, basY + hauteurToit + hMurBas / 2, largeur, hMurBas, "facade")
        ));
        parts.push(this.ajouterPart(
            this.add.image(x, basY + hauteurToit / 2, "toit")
                .setDisplaySize(largeur * 1.15, hauteurToit)
                .setFlipY(true)
        ));

        this.maisonsList.push({ parts: parts, reference: parts[0], passee: false });
    }

    /** Donne un corps physique à un élément de maison et le fait défiler. */
    ajouterPart(obj) {
        obj.setDepth(5);
        this.maisons.add(obj);
        obj.body.setAllowGravity(false);
        obj.body.setImmovable(true);

        // La boîte de collision doit coller EXACTEMENT à l'image affichée.
        // Arcade raisonne en pixels de texture puis applique l'échelle du
        // sprite : lui donner des pixels d'écran fausserait tout (c'était la
        // cause du « mur invisible »). updateFromGameObject fait ce calcul.
        obj.body.setSize(obj.width, obj.height, true);
        obj.body.updateFromGameObject();

        obj.body.setVelocityX(-this.vitesse);
        return obj;
    }

    update(time, delta) {
        if (this.termine) return;

        const C = window.CigogneConfig;
        const h = this.scale.height;

        // Le sol défile même avant le départ, ça donne vie à l'écran
        this.decor.defiler(this.enCours ? this.vitesse : this.vitesse * 0.3, delta);

        if (!this.enCours) return;

        // Inclinaison : piqué vers le bas quand elle tombe
        const ratio = Phaser.Math.Clamp(this.oiseau.body.velocity.y / (h * 1.2), -1, 1);
        this.oiseau.setAngle(ratio * C.inclinaisonMax);

        // Sortie par le haut : on bloque au lieu de tuer (moins frustrant)
        if (this.oiseau.y < 0) {
            this.oiseau.setY(0);
            this.oiseau.body.setVelocityY(0);
        }

        // Chute au sol
        if (this.oiseau.y >= this.decor.niveauSol() - this.oiseau.displayHeight * 0.3) {
            this.perdre();
            return;
        }

        // Nouvelle maison quand la dernière a assez avancé
        const derniere = this.maisonsList[this.maisonsList.length - 1];
        if (!derniere || derniere.reference.x < this.scale.width - this.ecart) {
            this.creerMaison(this.scale.width * 1.1);
        }

        // Score + ménage
        for (let i = this.maisonsList.length - 1; i >= 0; i--) {
            const m = this.maisonsList[i];
            if (!m.passee && m.reference.x < this.oiseau.x) {
                m.passee = true;
                this.score++;
                this.texteScore.setText(String(this.score));
            }
            if (m.reference.x < -m.reference.displayWidth) {
                m.parts.forEach((p) => p.destroy());
                this.maisonsList.splice(i, 1);
            }
        }
    }

    /** Fin de partie : on fige tout et on passe à l'écran de score. */
    perdre() {
        if (this.termine) return;
        this.termine = true;

        this.oiseau.stop();                       // arrête l'animation d'ailes
        this.maisons.getChildren().forEach((o) => o.body.setVelocityX(0));
        this.cameras.main.shake(200, 0.008);

        // Petite chute avant l'écran de fin
        this.time.delayedCall(600, () => {
            this.scene.start(OverScene.KEY, { score: this.score });
        });
    }
}
