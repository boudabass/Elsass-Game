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
        // Gain de fin de partie (spec 728 §4) : 1 pièce par tranche de
        // 100 points + 10 pièces de prime si la partie bat le record —
        // rempli après Arcade.Score.submit, c'est le moment où le joueur
        // comprend l'économie.
        const gain = UI.text(this, 0, 0, "", 6, C.couleurs.combo);
        const prime = UI.text(this, 0, 0, "", 4, C.couleurs.texteClair);
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
            motif.setPosition(w / 2, h * 0.28).setFontSize(Math.round(UI.u(this, 6)) + "px");
            score.setPosition(w / 2, h * 0.40).setFontSize(Math.round(UI.u(this, 6)) + "px");
            gain.setPosition(w / 2, h * 0.50).setFontSize(Math.round(UI.u(this, 6)) + "px");
            prime.setPosition(w / 2, h * 0.56).setFontSize(Math.round(UI.u(this, 4)) + "px");
            record.setPosition(w / 2, h * 0.63).setFontSize(Math.round(UI.u(this, 5)) + "px");
            rejouer.redimensionner(UI.u(this, 40), UI.u(this, 12)).setPosition(w / 2, h * 0.74);
            menu.redimensionner(UI.u(this, 40), UI.u(this, 10)).setPosition(w / 2, h * 0.86);
        });

        // Le score final part au serveur (spec §2, §6). submit() renvoie
        // true si c'est un nouveau record (le serveur peut corriger : un
        // meilleur score fait sur un autre appareil a priorité).
        const estRecord = await Arcade.Score.submit(this.scoreFinal);
        if (estRecord) record.setText(C.textes.nouveauRecord);

        // Économie (spec 728 §4) : gain = 1 pièce par tranche de
        // pointsParPiece points (arrondi à l'inférieur) + primeRecordPieces
        // de prime si la partie bat le record personnel. Affiché sur
        // l'écran de fin, appliqué au profil persistant, puis save écrite
        // IMMÉDIATEMENT (local + cloud) : fin de partie = moment explicite
        // (spec 728 §2 — jamais d'autosave en cours de partie).
        const resGain = Profil.calculerGain(this.scoreFinal, estRecord, C);
        if (resGain.total > 0) {
            gain.setText(C.textes.gainPieces.replace("{pieces}", resGain.total));
            if (resGain.prime > 0) {
                prime.setText(C.textes.gainPrime.replace("{pieces}", resGain.prime));
            }
        }

        const etat = window.SimilitudeProfil;
        if (etat && etat.profil) {
            Profil.appliquerGain(etat.profil, resGain);
            Arcade.Save.saveLocal();
            Arcade.Save.saveCloud();
        }
    }
}
