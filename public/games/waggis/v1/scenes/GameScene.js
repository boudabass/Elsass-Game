/*
 * GameScene — la partie elle-même.
 *
 * ÉTAPE 4 : le terrain est complet côté génération. LaneGenerator génère
 * les bandes horizontales (zone sûre prairie/vigne, route avec véhicules
 * latéraux, eau avec nénuphars qui dérivent, rails avec un train rapide
 * prévenu par un signal sonore/visuel avant chaque passage) ; véhicules,
 * nénuphars et trains bougent en continu, les bandes sorties en bas sont
 * recyclées en haut (pooling). Le personnage et les contrôles (swipe /
 * boutons visibles, 100 % clic-tap, article 409) arrivent à l'étape
 * suivante, la mort (étape collisions : véhicule, chute à l'eau, train via
 * bande.estMortelAuPoint, menace anti-attente) remplacera le bouton
 * provisoire ci-dessous.
 *
 * Le bouton « Terminer (provisoire) » reste nécessaire tant qu'il n'y a pas
 * de conditions de mort : sans lui, aucune partie ne peut se finir et la
 * chaîne menu → jeu → fin n'est plus testable. Il est relégué en haut à
 * droite (petit) pour ne pas masquer le terrain, et disparaîtra à l'étape
 * collisions. Aucun contrôle V1 (tap par case) n'est conservé.
 */
class GameScene extends Phaser.Scene {
    static KEY = "jeu";

    constructor() {
        super(GameScene.KEY);
    }

    create() {
        const C = window.WaggisConfig;
        const UI = Arcade.UI;

        this.cameras.main.setBackgroundColor(C.couleurs.ciel);

        // --- Terrain généré (étape 2) ---------------------------------------
        this.lanes = new LaneGenerator(this);
        this.lanes.genererInitiales(0);
        UI.layout(this, () => this.lanes.redimensionner());

        // --- Bouton provisoire (retiré quand la mort arrive, étape 4) -------
        const finir = UI.button(this, {
            width: UI.u(this, 24), height: UI.u(this, 8),
            label: C.textes.finirProvisoire,
            color: C.couleurs.bouton,
            textColor: C.couleurs.texteClair,
            onClick: () => this.terminer()
        });
        UI.layout(this, (w, h) => {
            finir.redimensionner(UI.u(this, 24), UI.u(this, 8))
                 .setPosition(w - UI.u(this, 13), UI.u(this, 6));
        });
    }

    /**
     * Fait tourner le monde : les véhicules roulent, les bandes recyclées
     * sont ré-ensemencées.
     */
    update(time, delta) {
        if (this.lanes) this.lanes.update(time, delta);
    }

    /**
     * Fin de partie provisoire des étapes 1-2 : score 0 tant qu'il n'y a
     * pas de bonds. Remplacé aux étapes suivantes par les conditions de mort
     * (collision véhicule, chute à l'eau, train, menace anti-attente).
     */
    terminer() {
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => {
            this.scene.start(OverScene.KEY, { score: 0 });
        });
    }
}
