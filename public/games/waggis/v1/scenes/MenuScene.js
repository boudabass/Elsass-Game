/*
 * MenuScene — écran d'accueil de Waggis : titre, meilleur score, 7 boutons.
 *
 * ⭐ MENU-1 (spec 709, article verrouillée — Décision 6, article 704) :
 *  - les 7 boutons du menu : Jouer, Niveaux, Personnages, Boutique,
 *    Réglages, Classement, Quitter (spec 709 §7 boutons) ;
 *  - « Jouer » lance DIRECTEMENT le prochain niveau non terminé — c'est
 *    data.currentLevel (save v4, appliquée au boot par Arcade.Save.apply),
 *    pas de passage par l'écran Niveaux (spec 709) ;
 *  - « Quitter » fait la même chose que le bouton retour de la barre du
 *    haut (DÉCISION JOHN 07/08/2026, articles 704/709) : retour de
 *    navigation standard — le jeu tourne en iframe, le retour ramène à la
 *    page de l'arcade (/games) ;
 *  - « Niveaux » ouvre l'écran Niveaux (LevelsScene, MENU-3 — grille de
 *    tous les niveaux, état + meilleur score, verrouillage linéaire) ;
 *  - « Personnages » ouvre l'écran Personnages (CharactersScene, MENU-4 —
 *    liste des skins débloqués/à débloquer, un seul actif à la fois) ;
 *  - « Boutique » ouvre l'écran Boutique (ShopScene, MENU-4 — les 3
 *    personnages à l'achat avec les pièces de data.wallet) ;
 *  - « Réglages » ouvre l'écran Réglages (SettingsScene, MENU-5 — son
 *    on/off uniquement, spec 709) ;
 *  - « Classement » ouvre l'écran Classement (ClassementScene, MENU-5 —
 *    classement général entre joueurs, cloud, leaderboard du socle).
 *
 * Mobile-first : les tailles sont en PROPORTION du plus petit côté (Arcade.UI.u),
 * la mise en page est recalculée à chaque rotation (Arcade.UI.layout).
 */
class MenuScene extends Phaser.Scene {
    static KEY = "menu";

    constructor() {
        super(MenuScene.KEY);
    }

    async create() {
        const C = window.WaggisConfig;
        const UI = Arcade.UI;

        this.cameras.main.setBackgroundColor(C.couleurs.ciel);

        const titre = UI.text(this, 0, 0, C.titre, 11, C.couleurs.texte);
        const record = UI.text(this, 0, 0, "", 4.5, C.couleurs.texte);

        // --- Les 7 boutons (spec 709) --------------------------------------
        // « Jouer » : bouton principal (rouge Waggis). « Quitter » : même
        // comportement que le bouton retour de la barre du haut (Décision
        // John 07/08 — navigation standard, jeu en iframe). Ordre imposé
        // par la spec : Jouer, Niveaux, Personnages, Boutique, Réglages,
        // Classement, Quitter.
        const definitions = [
            {
                label: C.textes.jouer,
                couleur: C.couleurs.bouton,
                onClick: () => this.jouer()
            },
            {
                label: C.textes.niveaux,
                onClick: () => this.scene.start(LevelsScene.KEY)
            },
            {
                label: C.textes.personnages,
                onClick: () => this.scene.start(CharactersScene.KEY)
            },
            {
                label: C.textes.boutique,
                onClick: () => this.scene.start(ShopScene.KEY)
            },
            {
                label: C.textes.reglages,
                onClick: () => this.scene.start(SettingsScene.KEY)
            },
            {
                label: C.textes.classement,
                onClick: () => this.scene.start(ClassementScene.KEY)
            },
            {
                label: C.textes.quitter,
                onClick: () => this.quitter()
            }
        ];

        const boutons = definitions.map((d) =>
            UI.button(this, {
                width: UI.u(this, 44), height: UI.u(this, 9),
                label: d.label,
                color: d.couleur || "#141210",
                textColor: C.couleurs.texteClair,
                onClick: d.onClick
            })
        );

        // Mise en page recalculée à chaque rotation de l'écran : titre et
        // record en haut, la colonne des 7 boutons centrée dans le reste.
        UI.layout(this, (w, h) => {
            titre.setPosition(w / 2, h * 0.09)
                 .setFontSize(Math.round(UI.u(this, 11)) + "px");
            record.setPosition(w / 2, h * 0.175)
                  .setFontSize(Math.round(UI.u(this, 4.5)) + "px");

            // Colonne de boutons : hauteur 9 % du plus petit côté, espace
            // vertical de 1,4 % entre deux boutons (jamais collés, cibles
            // tactiles distinctes). Le bloc entier est centré.
            const hauteur = UI.u(this, 9);
            const pas = UI.u(this, 10.4);
            const total = pas * (boutons.length - 1) + hauteur;
            let y = h * 0.24;
            boutons.forEach((b) => {
                b.redimensionner(UI.u(this, 44), hauteur).setPosition(w / 2, y);
                y += pas;
            });
        });

        // Meilleur score : local d'abord, puis confirmation par le serveur.
        await Arcade.Score.load();
        record.setText(C.textes.meilleurScore.replace("{score}", Arcade.Score.best));
    }

    /**
     * « Jouer » (spec 709) : lance DIRECTEMENT le prochain niveau non
     * terminé — data.currentLevel (save v5, appliquée au boot), pas de
     * passage par l'écran Niveaux. Le monde repart à zéro (spec 708 §9 :
     * au relancement, le niveau est régénéré) ; GameScene relit
     * currentLevel du registry. ⭐ MENU-3 : la session éventuelle (niveau
     * lancé depuis l'écran Niveaux, niveauSession) est effacée pour
     * repartir du niveau en cours. Data EXPLICITE {} au start (piège
     * Phaser : sans data, settings.data garde celle du démarrage
     * précédent — l'écran Niveaux passerait son niveau).
     */
    jouer() {
        this.registry.set("niveauSession", null);
        this.registry.set("generatedRows", null);
        this.scene.start(GameScene.KEY, {});
    }

    /**
     * « Quitter » — DÉCISION JOHN (07/08/2026, articles 704/709) : même
     * comportement que le bouton « Retour » de la barre du haut de la
     * coquille arcade (GameShell, lien vers /games) — retour de navigation
     * standard. Le jeu tourne en iframe : la navigation s'applique à la
     * fenêtre PARENTE (celle qui porte la barre du haut). Ouvert hors
     * iframe (test direct), window.parent === window : même résultat.
     * Repli sur la fenêtre courante si la parente est inaccessible
     * (cross-origin).
     */
    quitter() {
        try {
            if (window.parent && window.parent !== window) {
                window.parent.location.href = "/games";
            } else {
                window.location.href = "/games";
            }
        } catch (e) {
            window.location.href = "/games";
        }
    }
}
