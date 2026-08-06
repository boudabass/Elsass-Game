/*
 * OverScene — écran d'arrivée : le personnage a traversé, on propose de
 * rejouer ou de revenir au menu.
 */
class OverScene extends Phaser.Scene {
    static KEY = "fin";

    constructor() {
        super(OverScene.KEY);
    }

    create() {
        const C = window.WaggisConfig;
        const UI = Arcade.UI;

        this.cameras.main.setBackgroundColor(C.couleurs.ciel);

        this.decor = new WaggisDecor(this);
        this.decor.creerFond();

        const titre = UI.text(this, 0, 0, C.textes.arrivee, 10, C.couleurs.texte).setDepth(30);
        const rejouer = UI.button(this, {
            width: UI.u(this, 40), height: UI.u(this, 12),
            label: C.textes.rejouer,
            color: C.couleurs.bouton,
            textColor: C.couleurs.texteClair,
            onClick: () => this.scene.start(GameScene.KEY)
        });
        const menu = UI.button(this, {
            width: UI.u(this, 40), height: UI.u(this, 10),
            label: C.textes.menu,
            color: "#141210",
            textColor: C.couleurs.texteClair,
            onClick: () => this.scene.start(MenuScene.KEY)
        });

        UI.layout(this, (w, h) => {
            titre.setPosition(w / 2, h * 0.12)
                 .setFontSize(Math.round(UI.u(this, 10)) + "px");
            rejouer.redimensionner(UI.u(this, 40), UI.u(this, 12))
                   .setPosition(w / 2, h * 0.55);
            menu.redimensionner(UI.u(this, 40), UI.u(this, 10))
                  .setPosition(w / 2, h * 0.7);
        });

        // Comptage des parties (sauvegardé en local et sur le serveur)
        this.registry.set("parties", (this.registry.get("parties") || 0) + 1);
        Arcade.Save.save();
    }
}
