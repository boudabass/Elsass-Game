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

        // ⭐ Décision John 08/08 (art. 704 Chantier B) : les boutons Retour
        // et Plein écran ne sont affichés QUE sur le menu principal — plus
        // d'icônes plateforme sur les autres scènes.

        this.decor = new CigogneDecor(this);
        this.decor.creerFond();

        // Encadré du record : dessiné AVANT le texte pour passer dessous.
        const recordFond = this.add.graphics();
        const titre = UI.text(this, 0, 0, "Perdu !", 9, C.couleurs.texte);
        const score = UI.text(this, 0, 0, "Score : " + this.scoreFinal, 6, C.couleurs.texte);
        const record = UI.text(this, 0, 0, "", 4.5, C.couleurs.texte);

        // Encadré orange arrondi dans le style des boutons, avec le texte en
        // noir à l'intérieur (lisible sur le fond bleu ciel). La HAUTEUR et le
        // texte sont ceux des boutons (« Rejouer ») ; la largeur fait au moins
        // celle des boutons et s'élargit si le texte du record est long, pour
        // ne jamais déborder de l'encadré. L'encadré n'apparaît qu'une fois le
        // texte du record connu (après l'envoi du score).
        const dessinerRecord = () => {
            const w = this.scale.width;
            const h = this.scale.height;
            const lh = UI.u(this, 12);
            const x = w / 2;
            const y = h * 0.44;
            recordFond.clear();
            // Même taille de texte que le libellé des boutons (0.42 x hauteur)
            record.setPosition(x, y).setFontSize(Math.round(lh * 0.42) + "px");
            if (record.text) {
                const lw = Math.max(UI.u(this, 40), record.width + UI.u(this, 4));
                recordFond.fillStyle(
                    Phaser.Display.Color.HexStringToColor(C.couleurs.encadreRecord).color,
                    1
                );
                recordFond.fillRoundedRect(x - lw / 2, y - lh / 2, lw, lh, lh * 0.25);
            }
        };

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
            dessinerRecord();
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
        // L'encadré apparaît avec le texte : fond orange, texte noir.
        dessinerRecord();
    }
}
