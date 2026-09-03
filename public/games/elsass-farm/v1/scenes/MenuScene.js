/*
 * MenuScene — écran d'accueil d'Elsass Farm (proposition Bloc A, point 1).
 *
 * Moule Waggis/Similitude : titre + accroche + bouton « Jouer » pleine
 * largeur (VERT charte) + icônes plateforme (Retour / Plein écran — contrat
 * de plateforme, visibles sur le menu principal uniquement). Pas d'autres
 * écrans en Bloc A (pas d'OverScene — la partie est sans fin ; pas de
 * SettingsScene — Bloc B et suivants).
 *
 * Mobile-first : tailles en % du plus petit côté (Arcade.UI.u), largeurs en
 * % de la largeur d'écran, mise en page recalculée à chaque rotation.
 */
class MenuScene extends Phaser.Scene {
    static KEY = "menu";

    constructor() {
        super(MenuScene.KEY);
    }

    create() {
        const C = window.FarmConfig;
        const UI = Arcade.UI;

        // Contrat de plateforme : Retour (haut-gauche) / Plein écran
        // (haut-droite) — style depuis la config (main.js → boot).
        Arcade.UI.iconesPlateforme(this);

        // Fond plein écran (couleur charte, sans dégradé en Bloc A).
        this.fond = this.add.rectangle(0, 0, 10, 10,
            parseInt(C.couleurs.fond.slice(1), 16))
            .setOrigin(0)
            .setDepth(0);

        // Titre avec relief (contour sombre + ombre, pattern Waggis).
        this.titre = this.add.text(0, 0, C.titre, {
            fontFamily: C.police.famille,
            color: "#ffffff",
            align: "center"
        })
            .setOrigin(0.5)
            .setDepth(10)
            .setStroke(C.couleurs.contour, 4)
            .setShadow(0, 4, "rgba(20, 18, 16, 0.3)", 4, false, true);

        this.accroche = this.add.text(0, 0, C.textes.accroche, {
            fontFamily: C.police.famille,
            color: "#ffffff",
            align: "center"
        })
            .setOrigin(0.5)
            .setDepth(10)
            .setStroke(C.couleurs.contour, 2)
            .setShadow(0, 2, "rgba(20, 18, 16, 0.3)", 2, false, true);

        // ⭐ Menu réutilisable (core/ui/menuActions.js, décision John) : le
        // bloc d'actions (ici juste « Jouer », pas de tuile secondaire)
        // porte lui-même les couleurs du design system et se positionne —
        // plus de bouton construit/positionné à la main dans la scène.
        // C.menu.largeurJouerPct/hauteurJouerU sont déjà les valeurs par
        // défaut du composant (80 / 11.5) : pas besoin de les repasser.
        Arcade.UI.menuActions(this, {
            jouer: { label: C.textes.jouer, onClick: () => this.jouer() },
            secondaires: [],
            reglages: null,
            police: C.police.famille
        });

        // Mise en page recalculée à chaque rotation / redimensionnement.
        UI.layout(this, (w, h) => {
            this.fond.setSize(w, h);
            const u = (n) => UI.u(this, n);

            this.titre
                .setFontSize(Math.round(u(C.menu.tailleTitreU)) + "px")
                .setPosition(w / 2, h * C.menu.titreY);
            this.accroche
                .setFontSize(Math.round(u(C.menu.tailleAccrocheU)) + "px")
                .setPosition(w / 2, h * C.menu.titreY + u(C.menu.tailleTitreU) * 0.85);
        });

        this.cameras.main.fadeIn(220, 0, 0, 0);
    }

    /** « Jouer » : lance directement GameScene (pas d'écran intermédiaire). */
    jouer() {
        this.cameras.main.fadeOut(220, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => {
            this.scene.start(GameScene.KEY, {});
        });
    }
}
