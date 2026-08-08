/*
 * OverScene — fin de partie (spec 473 §6).
 *
 * SIM-1 : squelette — la scène existe, reçoit le score final. Le contenu
 * complet (motif « Temps écoulé » / « Plus d'énergie » / « Grille pleine »,
 * Arcade.Score.submit, « Nouveau record ! ») arrive en SIM-3.
 */
class OverScene extends Phaser.Scene {
    static KEY = "fin";

    constructor() {
        super(OverScene.KEY);
    }

    init(data) {
        this.scoreFinal = (data && data.score) || 0;
        // SIM-3 : (data && data.motif) — clé textes.finChrono / finEnergie /
        // finGrillePleine, affichée ici.
    }

    create() {
        const C = window.SimilitudeConfig;
        const UI = Arcade.UI;

        // ⭐ Décision John 08/08 (art. 704 Chantier B) : les boutons Retour
        // et Plein écran ne sont affichés QUE sur le menu principal.

        this.cameras.main.setBackgroundColor(C.couleurs.fond);

        const titre = UI.text(this, 0, 0, "Partie terminée", 9, C.couleurs.texteClair);
        const score = UI.text(this, 0, 0, "Score : " + this.scoreFinal, 6, C.couleurs.texteClair);

        const rejouer = Arcade.UI.bouton(this, {
            label: "Rejouer",
            couleur: C.couleurs.boutonJouer,
            textColor: C.couleurs.texteClair,
            onClick: () => this.scene.start(GameScene.KEY)
        });
        const menu = Arcade.UI.bouton(this, {
            label: "Menu",
            couleur: C.couleurs.bouton,
            textColor: C.couleurs.texteClair,
            onClick: () => this.scene.start(MenuScene.KEY)
        });

        UI.layout(this, (w, h) => {
            titre.setPosition(w / 2, h * 0.22).setFontSize(Math.round(UI.u(this, 9)) + "px");
            score.setPosition(w / 2, h * 0.38).setFontSize(Math.round(UI.u(this, 6)) + "px");
            rejouer.redimensionner(UI.u(this, 40), UI.u(this, 12)).setPosition(w / 2, h * 0.6);
            menu.redimensionner(UI.u(this, 40), UI.u(this, 10)).setPosition(w / 2, h * 0.76);
        });
    }
}
