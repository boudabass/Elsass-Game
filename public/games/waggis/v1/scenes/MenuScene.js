/*
 * MenuScene — écran d'accueil : titre, meilleur score, bouton Jouer.
 */
class MenuScene extends Phaser.Scene {
    static KEY = "menu";

    constructor() {
        super(MenuScene.KEY);
    }

    async create() {
        const C = window.WaggisConfig;
        const UI = Arcade.UI;

        this.cameras.main.setBackgroundColor(C.couleurs.ciel);

        // ÉTAPE 1 : pas encore de décor de bandes (LaneGenerator, étape 2).
        const titre = UI.text(this, 0, 0, C.titre, 11, C.couleurs.texte);
        const record = UI.text(this, 0, 0, "", 4.5, C.couleurs.texte);
        const bouton = UI.button(this, {
            width: UI.u(this, 40), height: UI.u(this, 12),
            label: C.textes.jouer,
            color: C.couleurs.bouton,
            textColor: C.couleurs.texteClair,
            onClick: () => this.scene.start(GameScene.KEY)
        });

        // Mise en page recalculée à chaque rotation de l'écran
        UI.layout(this, (w, h) => {
            titre.setPosition(w / 2, h * 0.16)
                 .setFontSize(Math.round(UI.u(this, 11)) + "px");
            record.setPosition(w / 2, h * 0.52)
                  .setFontSize(Math.round(UI.u(this, 4.5)) + "px");
            bouton.redimensionner(UI.u(this, 40), UI.u(this, 12))
                  .setPosition(w / 2, h * 0.68);
        });

        // Meilleur score : local d'abord, puis confirmation par le serveur
        await Arcade.Score.load();
        record.setText(C.textes.meilleurScore.replace("{score}", Arcade.Score.best));
    }
}
