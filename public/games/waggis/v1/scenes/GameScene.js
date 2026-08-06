/*
 * GameScene — la partie elle-même.
 *
 * ÉTAPE 1 (squelette) : scène vide mais fonctionnelle. Le terrain généré
 * (LaneGenerator) et les obstacles poolés (ObstaclePool) arrivent aux étapes
 * suivantes, avec les contrôles V2 (swipe sur mobile, boutons visibles sur
 * PC — 100 % tap/clic, zéro clavier, article 409).
 *
 * Pour que la chaîne menu → jeu → fin soit testable dès maintenant, un
 * bouton PROVISOIRE « Terminer » termine la partie (score 0 : aucun bond
 * possible sans terrain). Il disparaîtra avec l'arrivée du vrai gameplay.
 * Aucun contrôle V1 (tap par case) n'est conservé.
 */
class GameScene extends Phaser.Scene {
    static KEY = "jeu";

    constructor() {
        super(GameScene.KEY);
    }

    create() {
        const C = window.WaggisConfig;
        const UI = Arcade.UI;

        this.cameras.main.setBackgroundColor(C.couleurs.ciel);

        // Panneau provisoire : explique où en est le squelette.
        const panneau = UI.text(this, 0, 0, C.textes.jeuVide, 5, C.couleurs.texte);

        const finir = UI.button(this, {
            width: UI.u(this, 40), height: UI.u(this, 10),
            label: C.textes.finirProvisoire,
            color: C.couleurs.bouton,
            textColor: C.couleurs.texteClair,
            onClick: () => this.terminer()
        });

        UI.layout(this, (w, h) => {
            panneau.setPosition(w / 2, h * 0.38)
                  .setFontSize(Math.round(UI.u(this, 5)) + "px");
            finir.redimensionner(UI.u(this, 40), UI.u(this, 10))
                 .setPosition(w / 2, h * 0.55);
        });
    }

    /**
     * Fin de partie provisoire de l'étape 1 : score 0 tant qu'il n'y a pas
     * de bonds. Remplacé aux étapes suivantes par les conditions de mort
     * (collision véhicule, chute à l'eau, train, menace anti-attente).
     */
    terminer() {
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => {
            this.scene.start(OverScene.KEY, { score: 0 });
        });
    }
}
