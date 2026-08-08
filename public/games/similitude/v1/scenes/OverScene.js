/*
 * OverScene — fin de partie (spec 473 §6).
 *
 * SIM-1 : squelette — la scène existe, reçoit le score final.
 * SIM-3 : contenu complet — le motif (« Temps écoulé » / « Plus d'énergie »
 * / « Grille pleine ») arrive de GameScene via init(data.motif) (clé
 * textes.finChrono / finEnergie / finGrillePleine), le score part au serveur
 * via Arcade.Score.submit(), « Nouveau record ! » s'affiche le cas échéant,
 * boutons Rejouer et Menu. AUCUNE sauvegarde de partie (session unique,
 * spec §2) : seul le score part au serveur.
 */
class OverScene extends Phaser.Scene {
    static KEY = "fin";

    constructor() {
        super(OverScene.KEY);
    }

    init(data) {
        this.scoreFinal = (data && data.score) || 0;
        // Clé du motif de fin (spec §6) : "finChrono" | "finEnergie" |
        // "finGrillePleine" — le libellé vit dans config.js (textes).
        this.motifCle = (data && data.motif) || "finChrono";
    }

    async create() {
        const C = window.SimilitudeConfig;
        const UI = Arcade.UI;

        // ⭐ Décision John 08/08 (art. 704 Chantier B) : les boutons Retour
        // et Plein écran ne sont affichés QUE sur le menu principal.

        this.cameras.main.setBackgroundColor(C.couleurs.fond);

        const titre = UI.text(this, 0, 0, C.textes.partieTerminee, 9, C.couleurs.texteClair);
        const motif = UI.text(this, 0, 0, C.textes[this.motifCle], 6, C.couleurs.combo);
        const score = UI.text(this, 0, 0, C.textes.scoreFinal.replace("{score}", this.scoreFinal), 6, C.couleurs.texteClair);
        // « Nouveau record ! » — rempli après Arcade.Score.submit (spec §6).
        const record = UI.text(this, 0, 0, "", 5, C.couleurs.combo);

        const rejouer = Arcade.UI.bouton(this, {
            label: "Rejouer",
            couleur: C.couleurs.boutonJouer,
            textColor: C.couleurs.texteClair,
            onClick: () => this.scene.start(GameScene.KEY)
        });
        const menu = Arcade.UI.bouton(this, {
            label: "Menu",
            couleur: C.couleurs.bouton,
            textColor: C.couleurs.texteClair,
            onClick: () => this.scene.start(MenuScene.KEY)
        });

        UI.layout(this, (w, h) => {
            titre.setPosition(w / 2, h * 0.14).setFontSize(Math.round(UI.u(this, 9)) + "px");
            motif.setPosition(w / 2, h * 0.30).setFontSize(Math.round(UI.u(this, 6)) + "px");
            score.setPosition(w / 2, h * 0.44).setFontSize(Math.round(UI.u(this, 6)) + "px");
            record.setPosition(w / 2, h * 0.56).setFontSize(Math.round(UI.u(this, 5)) + "px");
            rejouer.redimensionner(UI.u(this, 40), UI.u(this, 12)).setPosition(w / 2, h * 0.70);
            menu.redimensionner(UI.u(this, 40), UI.u(this, 10)).setPosition(w / 2, h * 0.84);
        });

        // Le score final part au serveur (spec §2, §6). submit() renvoie
        // true si c'est un nouveau record (le serveur peut corriger : un
        // meilleur score fait sur un autre appareil a priorité).
        const estRecord = await Arcade.Score.submit(this.scoreFinal);
        if (estRecord) record.setText(C.textes.nouveauRecord);
    }
}
