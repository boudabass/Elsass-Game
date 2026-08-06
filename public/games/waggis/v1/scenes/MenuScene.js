/*
 * MenuScene — écran d'accueil : titre, bouton Jouer.
 */
class MenuScene extends Phaser.Scene {
    static KEY = "menu";

    constructor() {
        super(MenuScene.KEY);
    }

    create() {
        const C = window.WaggisConfig;
        const UI = Arcade.UI;

        this.cameras.main.setBackgroundColor(C.couleurs.ciel);

        // Terrain en fond pour donner le ton (route + rivière visibles).
        this.decor = new WaggisDecor(this);
        this.decor.creerFond();

        const titre = UI.text(this, 0, 0, C.titre, 12, C.couleurs.texte).setDepth(30);
        const bouton = UI.button(this, {
            width: UI.u(this, 40), height: UI.u(this, 12),
            label: C.textes.jouer,
            color: C.couleurs.bouton,
            textColor: C.couleurs.texteClair,
            onClick: () => this.scene.start(GameScene.KEY)
        });

        // Mise en page recalculée à chaque rotation de l'écran
        UI.layout(this, (w, h) => {
            titre.setPosition(w / 2, h * 0.12)
                 .setFontSize(Math.round(UI.u(this, 12)) + "px");
            bouton.redimensionner(UI.u(this, 40), UI.u(this, 12))
                  .setPosition(w / 2, h * 0.42);
        });
    }
}
