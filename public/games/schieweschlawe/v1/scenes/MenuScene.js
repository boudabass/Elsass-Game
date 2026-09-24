/*
 * MenuScene — accueil de Schieweschlawe : titre, progression, « Jouer »
 * (prochain niveau à réussir) et « Niveaux ».
 *
 * Tout l'écran est construit par Arcade.UI.menuPrincipal (charte The
 * Elsassisch) ; la scène ne fournit que son décor (nuit de la vallée) et le
 * disque enflammé en illustration.
 */
class MenuScene extends Phaser.Scene {
    static KEY = "menu";

    constructor() {
        super(MenuScene.KEY);
    }

    create() {
        const C = window.SchieweschlaweConfig;
        const T = C.textes;
        const UI = Arcade.UI;

        Arcade.UI.iconesPlateforme(this);

        const fond = this.add.graphics().setDepth(0);
        UI.layout(this, (w, h) => {
            fond.clear();
            fond.fillStyle(Phaser.Display.Color.HexStringToColor(C.couleurs.ciel).color, 1);
            fond.fillRect(0, 0, w, h);
        });

        // Illustration : le disque enflammé qui tourne doucement.
        const disque = this.add.image(0, 0, "disque").setDepth(3);
        this.tweens.add({ targets: disque, angle: 360, duration: 6000, repeat: -1 });

        const prochain = MenuScene.prochainNiveau(this.registry);
        const reussis = Object.keys(this.registry.get("resultats") || {}).length;

        UI.menuPrincipal(this, {
            titre: C.titre,
            accroche: T.accroche,
            infos: [T.progression.replace("{n}", reussis).replace("{total}", C.niveaux.total)],
            jouer: {
                label: T.jouerNiveau.replace("{n}", prochain),
                onClick: () => this.scene.start(GameScene.KEY, { niveau: prochain })
            },
            secondaires: [
                { icone: "🗺️", label: T.niveaux, onClick: () => this.scene.start(NiveauxScene.KEY) }
            ],
            illustration: (cx, cy, hauteurMax) => {
                const taille = Math.min(UI.u(this, 26), hauteurMax * 0.8);
                disque.setVisible(taille >= UI.u(this, 8))
                    .setDisplaySize(taille, taille)
                    .setPosition(cx, cy);
            }
        });
    }

    /** Prochain niveau à jouer : le premier non réussi (borné à 100). */
    static prochainNiveau(registry) {
        const C = window.SchieweschlaweConfig;
        return Math.min(registry.get("currentLevel") || 1, C.niveaux.total);
    }
}
