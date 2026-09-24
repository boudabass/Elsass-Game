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
 * ⭐ REFONTE CHARTE 24/09/2026 : en-tête, bouton retour et mise en page
 * passent par le gabarit commun core/ui/ecran.js (comme tous les écrans
 * secondaires de l'arcade) ; le bouton son est une tuile crème.
 *
 * ⭐ REFONTE 08/08/2026 (spec 709 — révision 08/08, validée John) :
 *  - fond : dégradé de ciel (WaggisUI.ciel) au lieu de l'aplat ;
 *  - boutons du composant partagé Arcade.UI.bouton (coins arrondis + ombre
 *    portée + dégradé léger + feedback clic) — plus de noir mat uniforme ;
 *  - police ronde Azimut (C.police.famille) ;
 *  - transitions animées fade entre écrans (WaggisUI.aller).
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
        this.enTransition = false;

        // ⭐ Décision John 08/08 (art. 704 Chantier B) : les boutons Retour
        // et Plein écran ne sont affichés QUE sur le menu principal — plus
        // d'icônes plateforme sur les autres scènes.

        // Fond : dégradé de ciel (spec 709 révision 08/08).
        this.fond = this.add.graphics().setDepth(0);
        UI.layout(this, (w, h) => WaggisUI.ciel(this.fond, w, h));

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
            retour: { label: C.textes.retour, onClick: () => WaggisUI.aller(this, MenuScene.KEY) },
            contenu: (zone) => {
                sonBtn.redimensionner(Math.min(zone.largeur, UI.u(this, 60)), UI.u(this, 12))
                    .setPosition(zone.cx, zone.y + UI.u(this, 6));
            }
        });

        // Transition d'arrivée : fondu depuis le noir (spec 709).
        this.cameras.main.fadeIn(220, 0, 0, 0);
    }

    /** Libellé du bouton selon l'état courant du son (Activé/Désactivé). */
    _majBoutonSon(btn) {
        if (!btn) return;
        const C = window.WaggisConfig;
        btn.label.setText(WaggisSound.lire() ? C.textes.sonOn : C.textes.sonOff);
        btn.refresh();   // re-mesure le libellé (taille ajustée au bouton)
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
