/*
 * MenuScene — écran d'accueil : titre, règle en une phrase, meilleur score,
 * bouton Jouer (spec 473 §8).
 */
class MenuScene extends Phaser.Scene {
    static KEY = "menu";

    constructor() {
        super(MenuScene.KEY);
    }

    async create() {
        const C = window.SimilitudeConfig;
        const UI = Arcade.UI;

        // Contrat de plateforme (chantier B, art. 704) : icônes persistantes
        // Quitter (haut-gauche) / Plein écran (haut-droite) — VISIBLES QUE SUR
        // LE MENU PRINCIPAL (décision John 08/08). La brique est déjà dans
        // core/ui.js : on la réutilise telle quelle, le style (couleur) vient
        // de la config via main.js → Arcade.boot → iconesPlateforme.style.
        Arcade.UI.iconesPlateforme(this);

        this.cameras.main.setBackgroundColor(C.couleurs.fond);

        const titre = UI.text(this, 0, 0, C.titre, 11, C.couleurs.texteClair);
        const regle = UI.text(this, 0, 0, C.textes.regle, 4, C.couleurs.texteClair);
        const record = UI.text(this, 0, 0, "", 4.5, C.couleurs.texteClair);

        // Composant bouton réutilisable (core/ui/button.js) — variante TEXTE
        // SIMPLE, VERT comme Jouer / Commencer (décision John 08/08).
        const jouer = Arcade.UI.bouton(this, {
            label: "Jouer",
            couleur: C.couleurs.boutonJouer,
            textColor: C.couleurs.texteClair,
            onClick: () => this.scene.start(GameScene.KEY)
        });

        // Mise en page recalculée à chaque rotation de l'écran
        UI.layout(this, (w, h) => {
            titre.setPosition(w / 2, h * 0.16)
                 .setFontSize(Math.round(UI.u(this, 11)) + "px");
            regle.setPosition(w / 2, h * 0.36)
                 .setFontSize(Math.round(UI.u(this, 4)) + "px")
                 .setWordWrapWidth(w * 0.8);
            record.setPosition(w / 2, h * 0.52)
                  .setFontSize(Math.round(UI.u(this, 4.5)) + "px");
            jouer.redimensionner(UI.u(this, 40), UI.u(this, 12))
                 .setPosition(w / 2, h * 0.68);
        });

        // Meilleur score : local d'abord, puis confirmation par le serveur
        await Arcade.Score.load();
        record.setText(C.textes.meilleurScore.replace("{score}", Arcade.Score.best));
    }
}
