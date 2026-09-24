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

        // Fond : le même dégradé que les autres écrans.
        this.fond = this.add.graphics().setDepth(0);
        UI.layout(this, (w, h) => SimilitudeUI.ciel(this.fond, w, h));

        // Refonte charte du 24/09 : même gabarit que le menu
        // (Arcade.UI.menuPrincipal, sans Quitter / Plein écran). Le motif
        // de fin sert d'accroche ; score, record et gain de pièces sont
        // des pastilles de l'en-tête (le gain apparaît après l'envoi du
        // score — pastille vide = masquée).
        const ecran = Arcade.UI.menuPrincipal(this, {
            iconesPlateforme: false,
            surtitre: C.titre,
            titre: C.textes.partieTerminee,
            accroche: C.textes[this.motifCle],
            infos: [
                C.textes.scoreFinal.replace("{score}", this.scoreFinal),
                C.textes.meilleurScore.replace("{score}", Arcade.Score.best),
                ""
            ],
            jouer: { label: C.textes.rejouer, onClick: () => this.scene.start(GameScene.KEY) },
            secondaires: [
                { icone: "🏠", label: C.textes.retourMenu, onClick: () => this.scene.start(MenuScene.KEY) }
            ]
        });

        // Le score final part au serveur (spec §2, §6). submit() renvoie
        // true si c'est un nouveau record (le serveur peut corriger : un
        // meilleur score fait sur un autre appareil a priorité).
        const estRecord = await Arcade.Score.submit(this.scoreFinal);
        const actif = this.scene.isActive();   // écran pas encore quitté ?
        if (actif) {
            ecran.setInfo(1, estRecord
                ? "🏆 " + C.textes.nouveauRecord
                : C.textes.meilleurScore.replace("{score}", Arcade.Score.best));
        }

        // Économie (spec 728 §4) : gain = 1 pièce par tranche de
        // pointsParPiece points (arrondi à l'inférieur) + primeRecordPieces
        // de prime si la partie bat le record personnel. Affiché sur
        // l'écran de fin, appliqué au profil persistant, puis save écrite
        // IMMÉDIATEMENT (local + cloud) : fin de partie = moment explicite
        // (spec 728 §2 — jamais d'autosave en cours de partie).
        const resGain = Profil.calculerGain(this.scoreFinal, estRecord, C);
        if (resGain.total > 0 && actif) {
            let texteGain = C.textes.gainPieces.replace("{pieces}", resGain.total);
            if (resGain.prime > 0) {
                texteGain += " · " + C.textes.gainPrime.replace("{pieces}", resGain.prime);
            }
            ecran.setInfo(2, texteGain);
        }

        const etat = window.SimilitudeProfil;
        if (etat && etat.profil) {
            Profil.appliquerGain(etat.profil, resGain);
            Arcade.Save.saveLocal();
            Arcade.Save.saveCloud();
        }
    }
}
