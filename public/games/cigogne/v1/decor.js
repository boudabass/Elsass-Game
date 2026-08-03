/*
 * decor.js — décor alsacien de Cigogne.
 *
 * Aucune image n'est téléchargée pour le décor : les textures (colombage,
 * tuiles, sol) sont DESSINÉES au démarrage puis mises en mémoire par Phaser.
 * C'est instantané et ça pèse zéro octet à charger.
 */
class CigogneDecor {
    /** Appelé une seule fois pendant le chargement. */
    static genererTextures(scene) {
        const C = window.CigogneConfig;
        const g = scene.make.graphics({ add: false });

        // --- Façade à colombage (motif répété de 64 x 64) ---
        g.fillStyle(C.couleurs.facade, 1);
        g.fillRect(0, 0, 64, 64);
        g.lineStyle(7, C.couleurs.poutre, 1);
        g.strokeRect(3, 3, 58, 58);   // cadre en bois
        g.beginPath();                 // croix de Saint-André
        g.moveTo(4, 4); g.lineTo(60, 60);
        g.moveTo(60, 4); g.lineTo(4, 60);
        g.strokePath();
        g.generateTexture("facade", 64, 64);
        g.clear();

        // --- Avant-toit (128 x 32) ---
        g.fillStyle(C.couleurs.toit, 1);
        g.fillRect(0, 0, 128, 24);
        g.fillStyle(C.couleurs.toitBord, 1);
        g.fillRect(0, 24, 128, 8);
        g.generateTexture("toit", 128, 32);
        g.clear();

        // --- Sol : herbe puis terre (64 x 64) ---
        g.fillStyle(C.couleurs.herbe, 1);
        g.fillRect(0, 0, 64, 16);
        g.fillStyle(C.couleurs.terre, 1);
        g.fillRect(0, 16, 64, 48);
        g.fillStyle(C.couleurs.herbe, 1);
        for (let i = 0; i < 64; i += 16) g.fillRect(i, 14, 8, 6); // touffes
        g.generateTexture("sol", 64, 64);

        g.destroy();
    }

    constructor(scene) {
        this.scene = scene;
        this.sol = null;
    }

    /** Bande de sol en bas de l'écran, qui défile pendant la partie. */
    creerFond() {
        const C = window.CigogneConfig;
        const scene = this.scene;

        this.sol = scene.add
            .tileSprite(0, 0, 10, 10, "sol")
            .setOrigin(0, 0)
            .setDepth(10);

        Arcade.UI.layout(scene, (w, h) => {
            const hauteur = h * (C.solPct / 100);
            this.sol.setSize(w, hauteur).setPosition(0, h - hauteur);
        });

        return this.sol;
    }

    /** Hauteur du sol (le niveau où la cigogne s'écrase). */
    niveauSol() {
        const C = window.CigogneConfig;
        return this.scene.scale.height * (1 - C.solPct / 100);
    }

    /** Fait défiler le sol à la même vitesse que les maisons. */
    defiler(vitesse, deltaMs) {
        if (this.sol) this.sol.tilePositionX += (vitesse * deltaMs) / 1000;
    }
}
