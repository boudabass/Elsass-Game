/*
 * MenuScene — écran de choix du palier de difficulté (PRD 875 §10/12).
 *
 * Ajoutée le 04/09/2026 : John a tranché que la difficulté ne doit JAMAIS
 * changer les règles d'une partie (toujours 17 jets, 6 phases, barème
 * fixe) — seulement 3 leviers sur la PRÉCISION du tir (vitesse de
 * l'aiguille de la jauge, largeur de sa zone orange, longueur de la ligne
 * d'aide à la visée), choisis UNE FOIS ici pour toute la partie qui suit
 * (config.paliers, cf. GameScene). Pas de mode tutoriel séparé : une
 * partie reste une partie complète, quel que soit le palier choisi.
 */
class MenuScene extends Phaser.Scene {
    static KEY = "menu";

    constructor() {
        super(MenuScene.KEY);
    }

    create() {
        const C = window.QuillesSaintGallConfig;
        const UI = Arcade.UI;

        this.cameras.main.setBackgroundColor(C.couleurs.ciel);

        // Icônes plateforme (Quitter / Plein écran), comme tous les menus
        // de l'arcade — absentes des scènes de jeu (déjà pleines de
        // contrôles de tir).
        Arcade.UI.iconesPlateforme(this);

        const titre = UI.text(this, 0, 0, C.titre, 9, C.couleurs.texte);
        const sousTitre = UI.text(this, 0, 0, C.textes.menuSousTitre, 3.6, C.couleurs.texte);

        // Un bouton par palier (config.paliers, dans l'ordre facile →
        // normal → difficile) — aucune règle de partie n'en dépend,
        // uniquement la précision du tir (cf. GameScene).
        const cles = Object.keys(C.paliers);
        const boutons = cles.map((cle) => Arcade.UI.bouton(this, {
            label: C.paliers[cle].label,
            couleur: C.couleurs.bouton,
            textColor: C.couleurs.texte,
            hauteurU: 11,
            largeurU: 50,
            onClick: () => this.scene.start(GameScene.KEY, { palier: cle })
        }));

        UI.layout(this, (w, h) => {
            const u = (n) => UI.u(this, n);

            titre.setFontSize(Math.round(u(9)) + "px").setPosition(w / 2, h * 0.26);
            sousTitre.setFontSize(Math.round(u(3.6)) + "px")
                .setPosition(w / 2, h * 0.26 + titre.displayHeight / 2 + u(5));

            const espace = u(4);
            const hautBloc = h * 0.5;
            boutons.forEach((b, i) => {
                b.setPosition(w / 2, hautBloc + i * (b.hauteur() + espace));
            });
        });
    }
}
