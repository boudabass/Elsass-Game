/*
 * MenuScene — écran d'accueil de Waggis : titre, accroche, score en HUD,
 * un bouton « Jouer » pleine largeur, une rangée d'icônes secondaires et
 * Réglages en icône discrète.
 *
 * ⭐ REFONTE CHARTE 23/09/2026 (décision John) : en-tête, boutons et mise
 * en page portrait/paysage sont désormais construits par
 * Arcade.UI.menuPrincipal (core/ui/menuPrincipal.js), comme dans tous les
 * jeux — carte noire à surtitre or, Azimut + Montserrat, « Jouer » rouge,
 * tuiles crème. Le score passe dans une pastille de l'en-tête. La scène
 * garde son décor (ciel, toits) et le Waggis en illustration. Le récit
 * ci-dessous (08/08) reste valable pour les actions et leur ordre ; ce qui
 * y concerne le style (titre à contour rouge, pillule HUD, police chargée
 * ici) est remplacé.
 *
 * ⭐ REFONTE 08/08/2026 (spec 709 — « ⚠️ RÉVISION 08/08/2026 », validée
 * John le 08/08) : le menu « 7 boutons empilés » fait place à une vraie
 * page d'accueil de jeu mobile. Ce qui change :
 *  - UN SEUL bouton principal « Jouer » PLEINE LARGEUR, avec l'illustration
 *    du Waggis (placeholder p8city rouge, POINT OUVERT ASSETS — aucun
 *    sprite de Waggis dans l'atelier, cf. GameScene) collée au bord droit,
 *    sur la même ligne que le titre + accroche (texte à gauche — correction
 *    John 08/08). Il lance DIRECTEMENT le prochain niveau non terminé —
 *    data.currentLevel
 *    (save v5, appliquée au boot par Arcade.Save.apply), comportement
 *    inchangé (spec 709) ;
 *  - grille 2×2 des boutons secondaires SOUS « Jouer » (correction John
 *    08/08, test GATE menu) : ligne 1 = Niveaux · Personnages, ligne 2 =
 *    Boutique · Classement — petits boutons sur DEUX LIGNES (icône en
 *    haut, texte BLANC en dessous, centré DANS le bouton), chacun ouvre
 *    son écran (LevelsScene MENU-3, CharactersScene + ShopScene MENU-4,
 *    ClassementScene MENU-5) ; espacements verticaux UNIFORMES entre
 *    tous les boutons — le même espace u(4.5) qu'entre les 2 lignes de
 *    la grille — plus UNE LIGNE VIDE (hauteur d'un bouton secondaire)
 *    sous la grille, respiration avant le bas de l'écran (correction
 *    John 08/08) ;
 *  - « Réglages » en VRAI bouton (⚙️ + libellé) placé EN BAS À DROITE
 *    (correction John 08/08 — plus une icône discrète en coin haut-droit),
 *    même présentation 2 lignes (SettingsScene MENU-5 — son on/off) ;
 *  - score affiché en HUD (bandeau en haut), plus au centre de l'écran —
 *    le titre + accroche passent À GAUCHE, le personnage est collé au bord
 *    droit, les deux sur la MÊME LIGNE en PAYSAGE ; en PORTRAIT, texte et
 *    personnage sont EMPILÉS (jamais superposés — correction John 08/08) ;
 *  - PAS de « Quitter » ni de « Plein écran » dans ce menu : chantier
 *    séparé (article 704 « Chantier B » — icônes haut-gauche/haut-droit
 *    persistantes sur toutes les scènes, remplacement de la barre
 *    GameShell) ;
 *  - visuel : dégradé de ciel au lieu de l'aplat (silhouette de toits
 *    alsaciens en bas), accent rouge Waggis, boutons à coins arrondis +
 *    ombre portée + dégradé léger + feedback au clic (scale-down puis
 *    micro-rebond), police ronde/friendly (Azimut — police de marque The
 *    Elsassisch, auto-hébergée public/fonts/azimut/), titre avec relief
 *    (contour + ombre), transitions animées (fade) entre les écrans.
 *
 * Mobile-first : les tailles sont en PROPORTION du plus petit côté
 * (Arcade.UI.u), la mise en page est recalculée à chaque rotation
 * (Arcade.UI.layout).
 */
class MenuScene extends Phaser.Scene {
    static KEY = "menu";

    constructor() {
        super(MenuScene.KEY);
    }

    async create() {
        const C = window.WaggisConfig;
        const UI = Arcade.UI;

        this.enTransition = false;

        // ⭐ Chantier B (art. 704) : icônes plateforme persistantes
        // (Quitter haut-gauche / Plein écran haut-droite) — remplacent la
        // barre GameShell, visibles sur toutes les scènes.
        Arcade.UI.iconesPlateforme(this);

        // --- Fond : dégradé de ciel + silhouette de toits alsaciens --------
        this.fond = this.add.graphics().setDepth(0);
        this.toits = this.add.graphics().setDepth(1);
        UI.layout(this, (w, h) => {
            this._dessinerCiel(w, h);
            this._dessinerToits(w, h);
        });

        // --- Illustration du Waggis (placeholder p8city rouge) --------------
        // Ombre de sol sous le personnage pour le poser sur le décor.
        this.solOmbre = this.add.graphics().setDepth(3);
        this.waggis = this.add.image(0, 0, "pieton_rouge_1").setDepth(4);

        // --- Menu (en-tête + Jouer + grille 2×2 + Réglages) ----------------
        // Ordre des tuiles inchangé (GATE menu 08/08) : Niveaux ·
        // Personnages, puis Boutique · Classement.
        const menu = Arcade.UI.menuPrincipal(this, {
            titre: C.titre,
            accroche: C.textes.accroche,
            infos: [C.textes.meilleurScore.replace("{score}", Arcade.Score.best)],
            jouer: { label: C.textes.jouer, onClick: () => this.jouer() },
            secondaires: [
                { icone: "🗺️", label: C.textes.niveaux, onClick: () => this.aller(LevelsScene.KEY) },
                { icone: "🐤", label: C.textes.personnages, onClick: () => this.aller(CharactersScene.KEY) },
                { icone: "🛒", label: C.textes.boutique, onClick: () => this.aller(ShopScene.KEY) },
                { icone: "🏆", label: C.textes.classement, onClick: () => this.aller(ClassementScene.KEY) }
            ],
            reglages: { label: C.textes.reglages, onClick: () => this.aller(SettingsScene.KEY) },
            illustration: (cx, cy, hauteurMax) => {
                const hWaggis = Math.min(UI.u(this, 21), hauteurMax * 0.75);
                const visible = hWaggis >= UI.u(this, 8);
                this.waggis.setVisible(visible)
                    .setScale(hWaggis / this.waggis.height)
                    .setPosition(cx, cy - hWaggis * 0.1);
                this.solOmbre.setVisible(visible);
                this._dessinerSolOmbre(cx, cy + hWaggis * 0.4, hWaggis * 0.9);
            }
        });

        // Transition d'arrivée : fondu depuis le noir.
        this.cameras.main.fadeIn(220, 0, 0, 0);

        // Meilleur score : local d'abord, puis confirmation par le serveur.
        await Arcade.Score.load();
        if (!this.scene.isActive()) return;   // menu déjà quitté entre-temps
        menu.setInfo(0, C.textes.meilleurScore.replace("{score}", Arcade.Score.best));
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
        this.aller(GameScene.KEY, {});
    }

    /**
     * Transition animée entre écrans (spec 709 révision 08/08 : « transitions
     * animées entre écrans (fade/slide) au lieu du switch instantané ») :
     * fondu au noir puis démarrage de la scène cible. Le garde-fou
     * enTransition ignore les clics redondants pendant le fondu.
     */
    aller(sceneKey, data) {
        if (this.enTransition) return;
        this.enTransition = true;
        this.cameras.main.fadeOut(180, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => {
            this.scene.start(sceneKey, data || {});
        });
    }

    // --- Décor de fond --------------------------------------------------------

    /**
     * Dégradé de ciel (spec 709 révision 08/08) : bandes horizontales
     * interpolées entre cielHaut (en haut) et cielBas (en bas). Redessiné
     * à chaque layout (rotation, plein écran).
     */
    _dessinerCiel(w, h) {
        const C = window.WaggisConfig;
        const g = this.fond;
        g.clear();
        const haut = Phaser.Display.Color.HexStringToColor(C.couleurs.cielHaut);
        const bas = Phaser.Display.Color.HexStringToColor(C.couleurs.cielBas);
        const bandes = 24;
        for (let i = 0; i < bandes; i++) {
            const t = i / (bandes - 1);
            const r = Math.round(haut.red + (bas.red - haut.red) * t);
            const v = Math.round(haut.green + (bas.green - haut.green) * t);
            const b = Math.round(haut.blue + (bas.blue - haut.blue) * t);
            const y = (h * i) / bandes;
            g.fillStyle(Phaser.Display.Color.GetColor(r, v, b), 1);
            g.fillRect(0, y, w, h / bandes + 1);
        }
    }

    /**
     * Silhouette de toits alsaciens + bande de sol (spec 709 révision
     * 08/08 : « léger décor possible — silhouette de toits alsaciens ») :
     * bande d'herbe en bas d'écran, maisons à pignons en teinte rouge
     * Waggis assombrie. Décor STATIQUE (pas de parallax : le menu ne
     * défile pas), redessiné à chaque layout.
     */
    _dessinerToits(w, h) {
        const C = window.WaggisConfig;
        const g = this.toits;
        g.clear();
        const ySol = h * 0.965;
        // Bande de sol (herbe).
        // Couleurs converties (Arcade.UI.couleur) : une chaîne "#…" passée
        // telle quelle à fillStyle s'affiche en NOIR (bug corrigé le 23/09).
        g.fillStyle(Arcade.UI.couleur(C.couleurs.solMenu).valeur, 1);
        g.fillRect(0, ySol, w, h - ySol);
        // Maisons à pignons (toits alsaciens), hauteurs variées.
        g.fillStyle(Arcade.UI.couleur(C.couleurs.toits).valeur, 0.85);
        const n = 10;
        const l = w / n;
        const hauteurMax = h * 0.05;
        for (let i = 0; i < n; i++) {
            const hh = hauteurMax * (0.55 + 0.45 * ((i * 7) % 5) / 4);
            const x0 = i * l;
            // Façade.
            g.fillRect(x0 + l * 0.14, ySol - hh * 0.5, l * 0.72, hh * 0.5);
            // Pignon.
            g.fillTriangle(
                x0 + l * 0.06, ySol - hh * 0.5,
                x0 + l * 0.94, ySol - hh * 0.5,
                x0 + l * 0.5, ySol - hh
            );
        }
    }

    /** Ombre de sol (ellipse) sous l'illustration du Waggis. */
    _dessinerSolOmbre(x, y, largeur) {
        const g = this.solOmbre;
        g.clear();
        g.fillStyle(Arcade.UI.couleur(Arcade.UI.tokens.noir).valeur, 0.25);
        g.fillEllipse(x, y, largeur, largeur * 0.28);
    }
}
