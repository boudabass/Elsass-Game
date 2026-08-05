/*
 * OverScene — fin de partie : score, record, rejouer / retour au menu.
 */
class OverScene extends Phaser.Scene {
    static KEY = "fin";

    constructor() {
        super(OverScene.KEY);
    }

    init(data) {
        this.scoreFinal = (data && data.score) || 0;
    }

    async create() {
        const C = window.CigogneConfig;
        const UI = Arcade.UI;

        this.decor = new CigogneDecor(this);
        this.decor.creerFond();

        const titre = UI.text(this, 0, 0, "Perdu !", 9, C.couleurs.texte);
        const score = UI.text(this, 0, 0, "Score : " + this.scoreFinal, 6, C.couleurs.texte);
        const record = UI.text(this, 0, 0, "", 4.5, C.couleurs.texte);

        const rejouer = UI.button(this, {
            width: UI.u(this, 40), height: UI.u(this, 12),
            label: "Rejouer",
            color: C.couleurs.bouton,
            textColor: C.couleurs.texteClair,
            onClick: () => this.scene.start(GameScene.KEY)
        });
        const menu = UI.button(this, {
            width: UI.u(this, 40), height: UI.u(this, 10),
            label: "Menu",
            color: "#141210",
            textColor: C.couleurs.texteClair,
            onClick: () => this.scene.start(MenuScene.KEY)
        });

        UI.layout(this, (w, h) => {
            titre.setPosition(w / 2, h * 0.2).setFontSize(Math.round(UI.u(this, 9)) + "px");
            score.setPosition(w / 2, h * 0.34).setFontSize(Math.round(UI.u(this, 6)) + "px");
            record.setPosition(w / 2, h * 0.44).setFontSize(Math.round(UI.u(this, 4.5)) + "px");
            rejouer.redimensionner(UI.u(this, 40), UI.u(this, 12)).setPosition(w / 2, h * 0.6);
            menu.redimensionner(UI.u(this, 40), UI.u(this, 10)).setPosition(w / 2, h * 0.75);
        });

        // Comptage des parties (sauvegardé en local et sur le serveur)
        this.registry.set("parties", (this.registry.get("parties") || 0) + 1);
        Arcade.Save.save();

        // Envoi du score : le serveur ne garde que le meilleur
        const nouveauRecord = await Arcade.Score.submit(this.scoreFinal);
        record.setText(
            nouveauRecord
                ? C.textes.nouveauRecord
                : C.textes.meilleurScore.replace("{score}", Arcade.Score.best)
        );
        if (nouveauRecord) record.setColor("#F2B93D");
    }
}
