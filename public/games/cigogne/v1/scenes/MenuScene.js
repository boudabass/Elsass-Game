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

        // ⭐ Chantier B (art. 704) : icônes plateforme persistantes
        // (Quitter haut-gauche / Plein écran haut-droite) — remplacent la
        // barre GameShell, visibles sur toutes les scènes.
        Arcade.UI.iconesPlateforme(this);

        // Fond du menu : ciel orange (crépuscule) — volontairement différent
        // du ciel bleu des autres scènes pour une vérification visuelle immédiate.
        this.cameras.main.setBackgroundColor("#f28c28");

        this.decor = new CigogneDecor(this);
        this.decor.creerFond();

        // Cigogne qui plane doucement au centre
        const oiseau = this.add.sprite(0, 0, "cigogne").play("voler");

        const titre = UI.text(this, 0, 0, C.titre, 11, C.couleurs.texte);
        const record = UI.text(this, 0, 0, "", 4.5, C.couleurs.texte);

        // ⭐ Menu réutilisable (core/ui/menuActions.js, décision John) : le
        // bloc d'actions (ici juste « Commencer », pas de tuile secondaire)
        // porte lui-même les couleurs du design system et se positionne —
        // plus de bouton construit/positionné à la main dans la scène.
        Arcade.UI.menuActions(this, {
            jouer: { label: "Commencer", onClick: () => this.scene.start(GameScene.KEY) },
            secondaires: [],
            reglages: null
        });

        // Mise en page recalculée à chaque rotation de l'écran
        UI.layout(this, (w, h) => {
            const taille = UI.u(this, C.tailleOiseauPct * 1.6);
            oiseau.setDisplaySize(taille, taille).setPosition(w / 2, h * 0.34);
            titre.setPosition(w / 2, h * 0.16)
                 .setFontSize(Math.round(UI.u(this, 11)) + "px");
            record.setPosition(w / 2, h * 0.52)
                  .setFontSize(Math.round(UI.u(this, 4.5)) + "px");
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
        record.setText(C.textes.meilleurScore.replace("{score}", Arcade.Score.best));
    }
}
