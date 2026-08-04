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
            this.creerMaison(this.scale.width * 1.05);
        }

        this.oiseau.body.setVelocityY(C.battementPar_h * this.scale.height);
    }

    /**
     * Crée une paire de maisons (haut + bas) avec un passage au milieu.
     *
     * `bordGauche` = position du bord GAUCHE de la maison (et non son centre) :
     * comme la largeur est tirée au hasard, c'est le seul repère qui permet de
     * garder un trou constant entre deux maisons.
     */
    creerMaison(bordGauche) {
        const C = window.CigogneConfig;
        const h = this.scale.height;

        // Le bloc de colombage est l'unité de construction. La maison mesure un
        // nombre ENTIER de blocs (1 à 4), donc la texture tombe toujours juste.
        const bloc = Arcade.UI.u(this, C.blocPct);
        const nbBlocs = Phaser.Math.Between(C.blocsMin, C.blocsMax);
        const largeur = bloc * nbBlocs;
        // La texture source fait 64 px : on la met à l'échelle d'un bloc.
        const echelle = bloc / 64;

        // Toit et débord se mesurent en BLOCS, pas en largeur de maison :
        // une maison large garde ainsi un toit de la même épaisseur.
        const hauteurToit = bloc * C.hauteurToitBloc;
        const largeurToit = largeur + bloc * C.debordToitBloc * 2;

        const x = bordGauche + largeur / 2;
        const ouverture = h * (C.ouverturePct / 100);
        const solY = this.decor.niveauSol();

        // Position verticale du passage, en évitant le haut de l'écran et le sol
        const minY = h * (C.margeHautPct / 100) + ouverture / 2;
        const maxY = solY - h * (C.margeBasPct / 100) - ouverture / 2;
        const centre = Phaser.Math.Between(minY, Math.max(minY, maxY));

        const hautY = centre - ouverture / 2;   // bas de la maison du haut
        const basY = centre + ouverture / 2;    // haut de la maison du bas

        const parts = [];

        // --- Maison suspendue au plafond -------------------------------------
        const hMurHaut = Math.max(1, hautY - hauteurToit);
        const murHaut = this.add
            .tileSprite(x, hMurHaut / 2, largeur, hMurHaut, "facade")
            .setTileScale(echelle, echelle);
        // La hauteur, elle, ne peut pas être un multiple de bloc (le passage est
        // tiré au hasard). On décale donc la texture pour que le bloc entier
        // s'arrête pile au bord du passage : la coupe part en haut, hors écran.
        murHaut.tilePositionY = -this.resteDeBloc(hMurHaut, bloc) / echelle;
        parts.push(this.ajouterPart(murHaut));

        parts.push(this.ajouterPart(
            this.add.image(x, hautY - hauteurToit / 2, "toit")
                .setDisplaySize(largeurToit, hauteurToit)
        ));

        // --- Maison posée au sol ---------------------------------------------
        // Ici le bloc entier démarre en haut (au bord du passage) et la coupe
        // se retrouve en bas, cachée derrière la bande de sol.
        const hMurBas = Math.max(1, solY - basY - hauteurToit);
        parts.push(this.ajouterPart(
            this.add
                .tileSprite(x, basY + hauteurToit + hMurBas / 2, largeur, hMurBas, "facade")
                .setTileScale(echelle, echelle)
        ));
        parts.push(this.ajouterPart(
            this.add.image(x, basY + hauteurToit / 2, "toit")
                .setDisplaySize(largeurToit, hauteurToit)
                .setFlipY(true)
        ));

        this.maisonsList.push({
            parts: parts,
            reference: parts[0],
            largeur: largeur,
            passee: false
        });
    }

    /** Ce qu'il manque à `hauteur` pour tomber sur un nombre entier de blocs. */
    resteDeBloc(hauteur, bloc) {
        return (bloc - (hauteur % bloc)) % bloc;
    }

    /** Bord droit de la dernière maison créée (null s'il n'y en a aucune). */
    dernierBordDroit() {
        const derniere = this.maisonsList[this.maisonsList.length - 1];
        return derniere ? derniere.reference.x + derniere.largeur / 2 : null;
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

        // Nouvelle maison quand le BORD DROIT de la dernière a assez avancé :
        // le trou entre deux maisons reste le même, quelle que soit leur largeur.
        const bordDroit = this.dernierBordDroit();
        if (bordDroit === null || bordDroit < this.scale.width - this.ecart) {
            const depart = bordDroit === null
                ? this.scale.width * 1.05
                : Math.max(this.scale.width * 1.05, bordDroit + this.ecart);
            this.creerMaison(depart);
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
