/*
 * OverScene — fin de partie : score, record, rejouer / retour au menu.
 *
 * Refonte charte du 24/09/2026 : même gabarit que le menu
 * (Arcade.UI.menuPrincipal, sans Quitter / Plein écran) — en-tête avec le
 * score et le record en pastilles, « Rejouer » rouge, « Menu » en tuile.
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

        this.decor = new CigogneDecor(this);
        this.decor.creerFond();

        const ecran = Arcade.UI.menuPrincipal(this, {
            iconesPlateforme: false,
            surtitre: C.titre,
            titre: C.textes.perdu,
            infos: [
                C.textes.score.replace("{score}", this.scoreFinal),
                C.textes.meilleurScore.replace("{score}", Arcade.Score.best)
            ],
            jouer: { label: C.textes.rejouer, onClick: () => this.scene.start(GameScene.KEY) },
            secondaires: [
                { icone: "🏠", label: C.textes.menu, onClick: () => this.scene.start(MenuScene.KEY) }
            ]
        });

        // Comptage des parties (sauvegardé en local et sur le serveur)
        this.registry.set("parties", (this.registry.get("parties") || 0) + 1);
        Arcade.Save.save();

        // Envoi du score : le serveur ne garde que le meilleur
        const nouveauRecord = await Arcade.Score.submit(this.scoreFinal);
        if (!this.scene.isActive()) return;   // écran déjà quitté entre-temps
        ecran.setInfo(1, nouveauRecord
            ? "🏆 " + C.textes.nouveauRecord
            : C.textes.meilleurScore.replace("{score}", Arcade.Score.best));
    }
}
