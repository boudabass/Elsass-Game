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

        // « Jouer » : LE composant bouton partagé (core/ui/button.js),
        // variante texte simple, VERT charte, pleine largeur.
        this.boutonJouer = Arcade.UI.bouton(this, {
            label: C.textes.jouer,
            couleur: C.couleurs.boutonJouer,
            ombre: C.couleurs.ombreBouton,
            police: C.police.famille,
            onClick: () => this.jouer()
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

            const largeurJouer = w * (C.menu.largeurJouerPct / 100);
            const hauteurJouer = u(C.menu.hauteurJouerU);
            this.boutonJouer
                .redimensionner(largeurJouer, hauteurJouer)
                .setPosition(w / 2, h * 0.78);
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
