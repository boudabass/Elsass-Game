/*
 * GameScene — la partie elle-même.
 *
 * ÉTAPE 1 (ébauche) : le personnage remonte l'écran d'un pas à chaque tap.
 * La route et la rivière sont visibles mais vides ; les véhicules, les
 * flottants et les vies arrivent aux étapes suivantes.
 */
class GameScene extends Phaser.Scene {
    static KEY = "jeu";

    constructor() {
        super(GameScene.KEY);
    }

    create() {
        const C = window.WaggisConfig;
        const UI = Arcade.UI;
        const w = this.scale.width;
        const h = this.scale.height;

        this.termine = false;
        this.consigneVisible = true;
        this.tweenPas = null;

        // Terrain : berge départ, route, rivière, berge arrivée.
        this.decor = new WaggisDecor(this);
        this.decor.creerFond();

        // --- Le personnage (piéton qui remonte l'écran) --------------------
        // Départ au centre de la berge basse.
        const departY = h * (1 - C.bergeDepPct / 200);
        this.perso = this.add.sprite(w * (C.positionXPct / 100), departY, "pieton_1");
        this.perso.setDepth(20);
        this.perso.play("marcher");

        // --- Interface -------------------------------------------------------
        // Consigne placée sur la bande de route (fond clair, texte lisible).
        this.consigne = UI.text(
            this, w / 2, h * 0.74, C.textes.consigne, 5, C.couleurs.texte
        ).setDepth(30);

        UI.tapAnywhere(this, () => this.avancer());

        // --- Réglages dépendant de la taille de l'écran ----------------------
        UI.layout(this, (lw, lh) => {
            this.perso.setX(lw * (C.positionXPct / 100));
            const taille = UI.u(this, C.taillePersoPct);
            this.perso.setDisplaySize(taille, taille);
            if (this.consigne) this.consigne.setPosition(lw / 2, lh * 0.74);
        });
    }

    /** Un tap = un pas vers le haut (l'ébauche de l'étape 1). */
    avancer() {
        if (this.termine) return;
        const C = window.WaggisConfig;

        // La consigne disparaît au premier appui, comme chez Cigogne.
        if (this.consigneVisible) {
            this.consigneVisible = false;
            if (this.consigne) {
                this.consigne.destroy();
                this.consigne = null;
            }
        }

        const pas = this.scale.height * (C.pasPct / 100);
        const arrivee = this.decor.arriveeY();

        // On ne dépasse jamais le centre de la berge d'arrivée. Si un
        // déplacement est déjà en cours (tap rapide), on le termine d'abord
        // pour repartir de la position courante sans empiler les tweens.
        if (this.tweenPas) this.tweenPas.stop();
        const cible = Math.max(arrivee, this.perso.y - pas);

        this.tweenPas = this.tweens.add({
            targets: this.perso,
            y: cible,
            duration: 150,
            ease: "Sine.easeInOut",
            onComplete: () => {
                this.tweenPas = null;
                if (this.perso.y <= arrivee + 0.5) this.arriver();
            }
        });
    }

    /** Le personnage a atteint la berge d'arrivée. */
    arriver() {
        if (this.termine) return;
        this.termine = true;

        this.perso.stop();
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => {
            this.scene.start(OverScene.KEY);
        });
    }
}
