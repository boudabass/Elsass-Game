/*
 * SettingsScene — l'écran Réglages de Waggis (spec 709 §7 boutons).
 *
 * ⭐ MENU-5 (spec 709 — Décision 6, article 704) : « Réglages — uniquement
 * son on/off. Pas de vibration, pas de langue pour l'instant. »
 *
 * Un bouton bascule affiche l'état courant (« Son : Activé » /
 * « Son : Désactivé ») et le change au clic/tap :
 *  - la préférence est persistée LOCALEMENT (WaggisSound.ecrire — PAS la
 *    save cloud : préférence d'appareil, et la save n'intervient qu'à la
 *    victoire du niveau, règle 708 §9 — le contrat de save reste en v5) ;
 *  - le SoundManager global est muet / remis (scene.sound.mute via
 *    WaggisSound.appliquer) — couvre bond, mort et signal du train, joués
 *    depuis GameScene et LaneGenerator ;
 *  - la préférence est appliquée dès le BOOT (main.js, après le
 *    chargement de la save) : un son coupé le reste au lancement du jeu.
 *
 * Aucun autre réglage à l'écran (spec 709 : pas de vibration, pas de
 * langue) — un seul contrôle + le retour au menu.
 *
 * 100 % clic/tap (article 409), mobile-first (Arcade.UI.u), mise en page
 * recalculée à chaque rotation (Arcade.UI.layout). Scène propre à Waggis
 * (article 709 : pas dans core/ tant qu'un 2e jeu n'en a pas besoin).
 */
class SettingsScene extends Phaser.Scene {
    static KEY = "reglages";

    constructor() {
        super(SettingsScene.KEY);
    }

    create() {
        const C = window.WaggisConfig;
        const UI = Arcade.UI;

        this.cameras.main.setBackgroundColor(C.couleurs.ciel);

        const titre = UI.text(this, 0, 0, C.textes.reglages, 9, C.couleurs.texte);

        // Bouton bascule du son : le libellé porte l'état courant
        // (« Son : Activé » / « Son : Désactivé »), le clic bascule.
        const sonBtn = UI.button(this, {
            width: UI.u(this, 44), height: UI.u(this, 10),
            label: "",
            color: C.couleurs.bouton,
            textColor: C.couleurs.texteClair,
            onClick: () => this.basculerSon(sonBtn)
        });
        this._majBoutonSon(sonBtn);

        // Retour au menu (comportement standard des écrans du menu).
        const retour = UI.button(this, {
            width: UI.u(this, 40), height: UI.u(this, 9),
            label: C.textes.retour,
            color: "#141210",
            textColor: C.couleurs.texteClair,
            onClick: () => this.scene.start(MenuScene.KEY)
        });

        UI.layout(this, (w, h) => {
            titre.setPosition(w / 2, h * 0.2)
                 .setFontSize(Math.round(UI.u(this, 9)) + "px");
            sonBtn.redimensionner(UI.u(this, 44), UI.u(this, 10))
                  .setPosition(w / 2, h * 0.42);
            retour.redimensionner(UI.u(this, 40), UI.u(this, 9))
                  .setPosition(w / 2, h * 0.6);
        });
    }

    /** Libellé du bouton selon l'état courant du son (Activé/Désactivé). */
    _majBoutonSon(btn) {
        if (!btn) return;
        const C = window.WaggisConfig;
        btn.label.setText(WaggisSound.lire() ? C.textes.sonOn : C.textes.sonOff);
    }

    /**
     * Bascule le son (on ↔ off) : persiste la préférence locale et
     * applique le mute au SoundManager global. Le libellé du bouton suit.
     */
    basculerSon(btn) {
        const on = !WaggisSound.lire();
        WaggisSound.ecrire(on);
        WaggisSound.appliquer(this);
        this._majBoutonSon(btn);
    }
}
