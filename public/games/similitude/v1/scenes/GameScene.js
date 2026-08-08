/*
 * GameScene — la partie elle-même.
 *
 * SIM-1 (squelette + grille, spec 473 §9) : la grille 9×9 fixe, centrée, en
 * tailles % du plus petit côté, affiche le tirage initial de 30 items parmi
 * les 6 types, sans aucun alignement ≥ 3 au départ (garantie Grille.js).
 *
 * Le gameplay (sélection, déplacement vers case vide, détection des
 * alignements, disparition, spawn des 2 items sur coup raté, score) arrive en
 * SIM-2 ; le HUD (score / chrono / énergie) et la fin de partie en SIM-3.
 */
class GameScene extends Phaser.Scene {
    static KEY = "jeu";

    constructor() {
        super(GameScene.KEY);
    }

    create() {
        const C = window.SimilitudeConfig;
        const UI = Arcade.UI;

        // ⭐ Décision John 08/08 (art. 704 Chantier B) : les boutons Retour
        // et Plein écran ne sont affichés QUE sur le menu principal.

        this.cameras.main.setBackgroundColor(C.couleurs.fond);

        // Tirage initial : 30 items, garantie aucun alignement ≥ 3 (spec §4).
        this.grille = new Grille(C);
        this.grille.tirageInitial(C.itemsDepart);

        // --- Rendu de la grille ------------------------------------------
        // Un rectangle par case (fond visible de la grille 9×9), un sprite
        // par case remplie. Tout est repositionné/redimensionné au layout.
        this.fonds = [];
        this.sprites = [];

        for (let l = 0; l < C.grilleTaille; l++) {
            this.fonds[l] = [];
            this.sprites[l] = [];
            for (let c = 0; c < C.grilleTaille; c++) {
                const fond = this.add
                    .rectangle(0, 0, 0, 0, 0x2c4f3c, 1)
                    .setStrokeStyle(1, 0x3d6b52);
                this.fonds[l][c] = fond;

                const type = this.grille.get(l, c);
                // C.items[type] : la texture correspond à l'ordre des types
                // (0..5) défini dans config.js.
                this.sprites[l][c] = type === null
                    ? null
                    : this.add.image(0, 0, C.items[type].cle);
            }
        }

        UI.layout(this, (w, h) => this.redessiner(w, h));
    }

    /** Recentre / redimensionne la grille (rotation, plein écran, desktop). */
    redessiner(w, h) {
        const C = window.SimilitudeConfig;
        const UI = Arcade.UI;

        const tailleCase = UI.u(this, C.tailleCasePct);   // % du plus petit côté
        const cote = tailleCase * C.grilleTaille;
        const x0 = (w - cote) / 2;
        const y0 = (h - cote) / 2;

        for (let l = 0; l < C.grilleTaille; l++) {
            for (let c = 0; c < C.grilleTaille; c++) {
                const cx = x0 + c * tailleCase + tailleCase / 2;
                const cy = y0 + l * tailleCase + tailleCase / 2;

                this.fonds[l][c]
                    .setPosition(cx, cy)
                    .setSize(tailleCase - 2, tailleCase - 2);

                const spr = this.sprites[l][c];
                if (spr) {
                    spr.setPosition(cx, cy)
                       .setDisplaySize(tailleCase * 0.85, tailleCase * 0.85);
                }
            }
        }
    }
}
