/*
 * SettingsScene — l'écran Réglages de Similitude (spec 728 §7).
 *
 * ⭐ SIM-7 (spec 728 §7) : « Réglages (son on/off uniquement, préférence
 * LOCALE hors save cloud, pattern soundPref.js de Waggis) en bouton en bas
 * à droite, rouge charte. » — l'écran lui-même est calqué sur SettingsScene
 * de Waggis (spec 709 §7 boutons) :
 *
 * Un bouton bascule affiche l'état courant (« Son : Activé » /
 * « Son : Désactivé ») et le change au clic/tap :
 *  - la préférence est persistée LOCALEMENT (SimilitudeSound.ecrire — PAS
 *    la save cloud : préférence d'appareil, la save n'intervient qu'aux
 *    moments explicites, spec 728 §2 — le contrat de save v1 reste
 *    inchangé) ;
 *  - le SoundManager global est muet / remis (scene.sound.mute via
 *    SimilitudeSound.appliquer) — couvre TOUS les sons du jeu (Similitude
 *    n'en joue encore aucun, le réglage est prêt pour les futurs sons) ;
 *  - la préférence est appliquée dès le BOOT (main.js, après le
 *    chargement de la save) : un son coupé le reste au lancement du jeu.
 *
 * Tous les boutons utilisent LE composant partagé Arcade.UI.bouton
 * (core/ui/button.js) — aucun bouton redessiné à la main, aucun style
 * dupliqué (spec 728 §7). Visuel façon Waggis : dégradé de fond,
 * coins arrondis + ombre portée + feedback clic, police Azimut,
 * transitions en fondu (SimilitudeUI.aller).
 *
 * ⭐ Décision John 08/08 (art. 704 Chantier B) : PAS d'icônes Retour /
 * Plein écran ici — elles ne sont visibles QUE sur le menu principal.
 *
 * Aucun autre réglage à l'écran (spec 728 §7 : son on/off uniquement — pas
 * de vibration, pas de langue) — un seul contrôle + le retour au menu.
 *
 * 100 % clic/tap (article 409), mobile-first (Arcade.UI.u), mise en page
 * recalculée à chaque rotation (Arcade.UI.layout).
 */
class SettingsScene extends Phaser.Scene {
    static KEY = "reglages";

    constructor() {
        super(SettingsScene.KEY);
    }

    create() {
        const C = window.SimilitudeConfig;
        const UI = Arcade.UI;
        this.enTransition = false;

        // Fond : dégradé (spec 728 §7).
        this.fond = this.add.graphics().setDepth(0);
        UI.layout(this, (w, h) => SimilitudeUI.ciel(this.fond, w, h));

        // Bouton bascule du son : le libellé porte l'état courant
        // (« Son : Activé » / « Son : Désactivé »), le clic bascule.
        const sonBtn = Arcade.UI.boutonMenu(this, {
            variante: "secondaire",
            label: "",
            onClick: () => this.basculerSon(sonBtn)
        });
        this._majBoutonSon(sonBtn);

        // Refonte charte du 24/09 : en-tête, retour et mise en page par le
        // gabarit commun des écrans (core/ui/ecran.js).
        Arcade.UI.ecran(this, {
            surtitre: C.titre,
            titre: C.textes.reglages,
            retour: { label: C.textes.retour, onClick: () => this.aller(MenuScene.KEY) },
            contenu: (zone) => {
                sonBtn.redimensionner(Math.min(zone.largeur, UI.u(this, 60)), UI.u(this, 12))
                    .setPosition(zone.cx, zone.y + UI.u(this, 6));
            }
        });

        // Transition d'arrivée : fondu depuis le noir (spec 728 §7).
        this.cameras.main.fadeIn(220, 0, 0, 0);
    }

    /** Libellé du bouton selon l'état courant du son (Activé/Désactivé). */
    _majBoutonSon(btn) {
        if (!btn || !btn.label) return;
        const C = window.SimilitudeConfig;
        btn.label.setText(SimilitudeSound.lire() ? C.textes.sonOn : C.textes.sonOff);
        btn.refresh();   // re-mesure le libellé (taille ajustée au bouton)
    }

    /**
     * Bascule le son (on ↔ off) : persiste la préférence locale et
     * applique le mute au SoundManager global. Le libellé du bouton suit.
     */
    basculerSon(btn) {
        const on = !SimilitudeSound.lire();
        SimilitudeSound.ecrire(on);
        SimilitudeSound.appliquer(this);
        this._majBoutonSon(btn);
    }

    /** Transition animée (fondu) vers un autre écran. */
    aller(sceneKey, data) {
        SimilitudeUI.aller(this, sceneKey, data);
    }
}
