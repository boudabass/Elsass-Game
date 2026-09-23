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
 *
 * Refonte charte du 23/09/2026 : l'écran est construit par
 * Arcade.UI.menuPrincipal (core/ui/menuPrincipal.js), comme dans tous les
 * jeux. Les 3 paliers sont les tuiles du menu (une rangée de 3), chacune
 * lance directement la partie.
 */
class MenuScene extends Phaser.Scene {
    static KEY = "menu";

    constructor() {
        super(MenuScene.KEY);
    }

    create() {
        const C = window.QuillesSaintGallConfig;

        this.cameras.main.setBackgroundColor(C.couleurs.ciel);

        // Icônes plateforme (Quitter / Plein écran), comme tous les menus
        // de l'arcade — absentes des scènes de jeu (déjà pleines de
        // contrôles de tir).
        Arcade.UI.iconesPlateforme(this);

        // Illustration : le losange des 9 quilles vu du dessus, aux
        // couleurs du panneau lumineux du jeu (jaune = debout, rouge = la
        // prépondérante, ici celle du centre).
        const losange = this.add.graphics().setDepth(4);

        // Un bouton par palier (config.paliers, dans l'ordre facile →
        // normal → difficile) — aucune règle de partie n'en dépend,
        // uniquement la précision du tir (cf. GameScene). Le meilleur
        // score est déjà chargé au boot (main.js).
        Arcade.UI.menuPrincipal(this, {
            titre: C.titre,
            accroche: C.textes.menuSousTitre,
            infos: [C.textes.meilleurScore.replace("{score}", Arcade.Score.best)],
            secondaires: Object.keys(C.paliers).map((cle) => ({
                icone: C.paliers[cle].icone,
                label: C.paliers[cle].label,
                onClick: () => this.scene.start(GameScene.KEY, { palier: cle })
            })),
            illustration: (cx, cy, hauteurMax) => {
                const taille = Math.min(Arcade.UI.u(this, 34), hauteurMax * 0.8);
                this._dessinerLosange(losange, cx, cy, taille);
            }
        });
    }

    /**
     * 9 quilles en losange (rangées de 1, 2, 3, 2, 1) dans un carré de côté
     * `taille` centré sur (cx, cy). Rien sous 8 % du plus petit côté : la
     * place manque (téléphone en paysage).
     */
    _dessinerLosange(g, cx, cy, taille) {
        const C = window.QuillesSaintGallConfig;
        const couleur = (css) => Arcade.UI.couleur(css).valeur;
        g.clear();
        if (taille < Arcade.UI.u(this, 8)) return;
        // Encombrement : 2 pas + 2 rayons en largeur, 4 demi-pas (×1,15)
        // + 2 rayons en hauteur = 2,9 pas — le losange tient dans `taille`.
        const pas = taille / 2.9;
        const rayon = pas * 0.3;
        const rangees = [1, 2, 3, 2, 1];
        rangees.forEach((n, ligne) => {
            for (let i = 0; i < n; i++) {
                const x = cx + (i - (n - 1) / 2) * pas;
                const y = cy + (ligne - 2) * pas * 0.5 * 1.15;
                const centre = ligne === 2 && i === 1;
                g.fillStyle(couleur(centre ? C.couleurs.quillePreponderante : C.couleurs.quilleEnPlace), 1);
                g.fillCircle(x, y, rayon);
                g.lineStyle(Math.max(1, rayon * 0.18), couleur(C.couleurs.quilleContour), 1);
                g.strokeCircle(x, y, rayon);
            }
        });
    }
}
