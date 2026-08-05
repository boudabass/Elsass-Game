/*
 * MenuScene — écran d'accueil : titre, meilleur score, bouton Jouer.
 */
class MenuScene extends Phaser.Scene {
    static KEY = "menu";

    constructor() {
        super(MenuScene.KEY);
    }

    async create() {
        const C = window.CigogneConfig;
        const UI = Arcade.UI;

        // Fond du menu : ciel orange (crépuscule) — volontairement différent
        // du ciel bleu des autres scènes pour une vérification visuelle immédiate.
        this.cameras.main.setBackgroundColor("#f28c28");

        this.decor = new CigogneDecor(this);
        this.decor.creerFond();

        // Cigogne qui plane doucement au centre
        const oiseau = this.add.sprite(0, 0, "cigogne").play("voler");

        const titre = UI.text(this, 0, 0, C.titre, 11, C.couleurs.texte);
        const record = UI.text(this, 0, 0, "", 4.5, C.couleurs.texte);
        const bouton = UI.button(this, {
            width: UI.u(this, 40), height: UI.u(this, 12),
            label: "Commencer",
            color: C.couleurs.bouton,
            textColor: C.couleurs.texteClair,
            onClick: () => this.scene.start(GameScene.KEY)
        });

        // Mise en page recalculée à chaque rotation de l'écran
        UI.layout(this, (w, h) => {
            const taille = UI.u(this, C.tailleOiseauPct * 1.6);
            oiseau.setDisplaySize(taille, taille).setPosition(w / 2, h * 0.34);
            titre.setPosition(w / 2, h * 0.16)
                 .setFontSize(Math.round(UI.u(this, 11)) + "px");
            record.setPosition(w / 2, h * 0.52)
                  .setFontSize(Math.round(UI.u(this, 4.5)) + "px");
            bouton.redimensionner(UI.u(this, 40), UI.u(this, 12))
                  .setPosition(w / 2, h * 0.68);
        });

        // Petit vol stationnaire
        this.tweens.add({
            targets: oiseau,
            y: "+=" + UI.u(this, 3),
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
        });

        // Meilleur score : local d'abord, puis confirmation par le serveur
        await Arcade.Score.load();
        record.setText("Meilleur score : " + Arcade.Score.best);
    }
}
