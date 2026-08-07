/*
 * PlaceholderScene — écran provisoire des boutons du menu pas encore
 * implémentés.
 *
 * ⭐ MENU-1 (spec 709) : les boutons Personnages, Boutique, Réglages et
 * Classement ouvraient cet écran générique en attendant leur vraie étape.
 * Depuis MENU-4, seuls Réglages et Classement l'utilisent encore (leur
 * vraie étape arrive MENU-5) ; l'écran Niveaux a sa propre scène depuis
 * MENU-3 (LevelsScene), Personnages et Boutique depuis MENU-4
 * (CharactersScene / ShopScene). Scène propre à Waggis (article 709 : pas
 * dans core/ tant qu'un 2e jeu n'en a pas besoin).
 *
 * Scène générique : reçoit le titre de l'écran via
 * scene.start(PlaceholderScene.KEY, { titre }), affiche « à venir » et un
 * bouton Retour vers le menu. 100 % clic/tap, mobile-first (Arcade.UI).
 */
class PlaceholderScene extends Phaser.Scene {
    static KEY = "placeholder";

    constructor() {
        super(PlaceholderScene.KEY);
    }

    init(data) {
        this.titre = (data && data.titre) || "";
    }

    create() {
        const C = window.WaggisConfig;
        const UI = Arcade.UI;

        this.cameras.main.setBackgroundColor(C.couleurs.ciel);

        const titre = UI.text(this, 0, 0, this.titre, 9, C.couleurs.texte);
        const aVenir = UI.text(this, 0, 0, C.textes.placeholder, 4.5, C.couleurs.texte);
        const retour = UI.button(this, {
            width: UI.u(this, 40), height: UI.u(this, 10),
            label: C.textes.retour,
            color: "#141210",
            textColor: C.couleurs.texteClair,
            onClick: () => this.scene.start(MenuScene.KEY)
        });

        UI.layout(this, (w, h) => {
            titre.setPosition(w / 2, h * 0.3).setFontSize(Math.round(UI.u(this, 9)) + "px");
            aVenir.setPosition(w / 2, h * 0.42).setFontSize(Math.round(UI.u(this, 4.5)) + "px");
            retour.redimensionner(UI.u(this, 40), UI.u(this, 10)).setPosition(w / 2, h * 0.6);
        });
    }
}
