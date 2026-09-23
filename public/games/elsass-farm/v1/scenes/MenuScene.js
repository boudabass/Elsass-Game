/*
 * MenuScene — écran d'accueil d'Elsass Farm (proposition Bloc A, point 1).
 *
 * Moule commun à tous les jeux (Arcade.UI.menuPrincipal, refonte charte
 * du 23/09) : en-tête titre + accroche, bouton « Jouer » + icônes
 * plateforme (Retour / Plein écran — contrat de plateforme, visibles sur
 * le menu principal uniquement). Pas d'autres
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

        // Contrat de plateforme : Retour (haut-gauche) / Plein écran
        // (haut-droite) — textes depuis la config (main.js → boot).
        Arcade.UI.iconesPlateforme(this);

        // Fond plein écran (couleur du jeu, sans dégradé en Bloc A).
        this.cameras.main.setBackgroundColor(C.couleurs.fond);

        // Refonte charte 23/09 : en-tête + « Jouer » + mise en page
        // portrait/paysage construits par Arcade.UI.menuPrincipal, comme
        // dans tous les jeux.
        Arcade.UI.menuPrincipal(this, {
            titre: C.titre,
            accroche: C.textes.accroche,
            jouer: { label: C.textes.jouer, onClick: () => this.jouer() }
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
