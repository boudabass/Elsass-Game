/*
 * MenuScene — écran d'accueil : titre, meilleur score, bouton Commencer.
 *
 * Refonte charte du 23/09/2026 : tout l'écran (en-tête, bouton, mise en
 * page portrait/paysage) est construit par Arcade.UI.menuPrincipal
 * (core/ui/menuPrincipal.js). La scène ne fournit que son décor et la
 * cigogne en illustration.
 */
class MenuScene extends Phaser.Scene {
    static KEY = "menu";

    constructor() {
        super(MenuScene.KEY);
    }

    async create() {
        const C = window.CigogneConfig;
        const UI = Arcade.UI;

        // Icônes plateforme persistantes (Quitter / Plein écran).
        Arcade.UI.iconesPlateforme(this);

        // Fond du menu : ciel orange (crépuscule) — volontairement différent
        // du ciel bleu des autres scènes pour une vérification visuelle immédiate.
        this.cameras.main.setBackgroundColor("#f28c28");

        this.decor = new CigogneDecor(this);
        this.decor.creerFond();

        // Cigogne qui plane doucement, dans la place laissée par le menu.
        const oiseau = this.add.sprite(0, 0, "cigogne").play("voler").setDepth(5);
        this.tweens.add({
            targets: oiseau,
            angle: { from: -4, to: 4 },
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
        });

        const menu = Arcade.UI.menuPrincipal(this, {
            titre: C.titre,
            accroche: C.textes.accroche,
            infos: [C.textes.meilleurScore.replace("{score}", Arcade.Score.best)],
            jouer: { label: C.textes.jouer, onClick: () => this.scene.start(GameScene.KEY) },
            illustration: (cx, cy, hauteurMax) => {
                const taille = Math.min(UI.u(this, C.tailleOiseauPct * 4), hauteurMax * 0.8);
                oiseau.setVisible(taille >= UI.u(this, 6))
                    .setDisplaySize(taille, taille)
                    .setPosition(cx, cy);
            }
        });

        // Meilleur score : local d'abord, puis confirmation par le serveur
        await Arcade.Score.load();
        if (!this.scene.isActive()) return;   // menu déjà quitté entre-temps
        menu.setInfo(0, C.textes.meilleurScore.replace("{score}", Arcade.Score.best));
    }
}
