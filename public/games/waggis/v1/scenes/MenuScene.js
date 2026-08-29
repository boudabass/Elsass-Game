/*
 * MenuScene — écran d'accueil de Waggis : titre, accroche, score en HUD,
 * un bouton « Jouer » pleine largeur, une rangée d'icônes secondaires et
 * Réglages en icône discrète.
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

        // Police ronde Azimut (marque, auto-hébergée — spec 709 révision
        // 08/08 : « police ronde/friendly type jeu mobile »). Injection du
        // @font-face puis attente COURTE : si la police n'arrive pas (hors
        // ligne), le menu se dessine en police de repli sans bloquer.
        await this._chargerPolice(C);

        // --- Fond : dégradé de ciel + silhouette de toits alsaciens --------
        // (spec 709 révision 08/08 : « dégradé de ciel au lieu de l'aplat
        // bleu uni ; léger décor possible — silhouette de toits alsaciens ».)
        this.fond = this.add.graphics().setDepth(0);
        this.toits = this.add.graphics().setDepth(1);

        // --- HUD (bandeau haut) -------------------------------------------
        // Score en HUD, pas au centre (spec 709 révision 08/08). Le record
        // est chargé en fin de create (Arcade.Score.load) — pillule
        // redimensionnée à ce moment.
        this.hudPillule = this.add.graphics().setDepth(10);
        this.record = this.add.text(0, 0, "", {
            fontFamily: C.police.famille,
            color: "#ffffff",
            align: "center"
        })
            .setOrigin(0.5)
            .setDepth(11)
            .setStroke("#141210", 3)
            .setShadow(0, 2, "rgba(20, 18, 16, 0.35)", 2, false, true);

        // --- Titre + accroche ----------------------------------------------
        // Titre avec RELIEF : contour rouge Waggis + ombre portée douce
        // (spec 709 révision 08/08 : « Titre Waggis avec un peu de relief »).
        this.titre = this.add.text(0, 0, C.titre, {
            fontFamily: C.police.famille,
            color: "#ffffff",
            align: "center"
        })
            .setOrigin(0.5)
            .setDepth(20)
            .setShadow(0, 4, "rgba(20, 18, 16, 0.3)", 4, false, true);

        this.accroche = this.add.text(0, 0, C.textes.accroche, {
            fontFamily: C.police.famille,
            color: "#ffffff",
            align: "center"
        })
            .setOrigin(0.5)
            .setDepth(20)
            .setStroke("#141210", 2)
            .setShadow(0, 2, "rgba(20, 18, 16, 0.3)", 2, false, true);

        // --- Illustration du Waggis (placeholder p8city rouge) --------------
        // « Un seul bouton principal Jouer, pleine largeur, avec
        // l'illustration du Waggis en fond/centre ». Ombre de sol sous le
        // personnage pour le poser sur le décor.
        this.solOmbre = this.add.graphics().setDepth(3);
        this.waggis = this.add.image(0, 0, "pieton_rouge_1").setDepth(4);

        // --- Bloc d'actions du menu (Jouer + grille + Réglages) -----------
        // ⭐ Menu réutilisable (core/ui/menuActions.js, décision John) : le
        // composant porte lui-même les couleurs du design system The
        // Elsassisch (plus de couleur/ombre en dur ici) et adapte la grille
        // au nombre de tuiles secondaires (4 -> 2×2, comme avant, mêmes
        // valeurs). Ligne 1 = Niveaux · Personnages, ligne 2 = Boutique ·
        // Classement (ordre inchangé, GATE menu 08/08).
        Arcade.UI.menuActions(this, {
            jouer: { label: C.textes.jouer, onClick: () => this.jouer() },
            secondaires: [
                { icone: "🗺️", label: C.textes.niveaux, onClick: () => this.aller(LevelsScene.KEY) },
                { icone: "🐤", label: C.textes.personnages, onClick: () => this.aller(CharactersScene.KEY) },
                { icone: "🛒", label: C.textes.boutique, onClick: () => this.aller(ShopScene.KEY) },
                { icone: "🏆", label: C.textes.classement, onClick: () => this.aller(ClassementScene.KEY) }
            ],
            reglages: { label: C.textes.reglages, onClick: () => this.aller(SettingsScene.KEY) },
            police: C.police.famille
        });

        // --- Mise en page (recalculée à chaque rotation) --------------------
        // La fonction est gardée pour être rejouée après le chargement du
        // meilleur score (la pillule HUD s'ajuste à la largeur du texte).
        this._miseEnPage = (w, h) => {
            const u = (n) => UI.u(this, n);

            // Dégradé de ciel + toits (fond).
            this._dessinerCiel(w, h);
            this._dessinerToits(w, h);

            // HUD : record en haut au centre, dans une pillule translucide.
            const recordY = h * 0.055;
            this.record
                .setFontSize(Math.round(u(4)) + "px")
                .setStroke("#141210", Math.max(2, Math.round(u(0.5))))
                .setPosition(w / 2, recordY);
            const pillW = this.record.width + u(6);
            const pillH = u(5.5);
            this.hudPillule.clear();
            this.hudPillule.fillStyle("rgba(255, 255, 255, 0.35)", 1);
            this.hudPillule.fillRoundedRect(
                w / 2 - pillW / 2, recordY - pillH / 2, pillW, pillH, pillH / 2
            );

            // Titre (avec relief) + accroche + personnage — layout
            // ADAPTATIF selon l'orientation (correction John 08/08) :
            //  - PAYSAGE (largeur > hauteur) : texte À GAUCHE, personnage
            //    collé au bord droit, les deux sur la MÊME LIGNE
            //    (comportement actuel, conservé) ;
            //  - PORTRAIT (hauteur > largeur) : EMPILÉS — titre, accroche,
            //    puis personnage, centrés horizontalement — le texte et le
            //    perso ne se superposent JAMAIS (règle John : tout est
            //    empilé, jamais superposé).
            const estPaysage = w > h;
            const tailleTitre = u(13.5);
            const hWaggis = u(21);

            if (estPaysage) {
                // PAYSAGE : le groupe de texte est aligné à gauche, le
                // personnage est collé au bord droit — les deux sur la
                // MÊME LIGNE, pour laisser le plus de place au texte.
                const centreLigne = h * 0.26;
                const margeGauche = u(5);
                this.titre
                    .setFontSize(Math.round(tailleTitre) + "px")
                    .setStroke(C.couleurs.bouton, Math.max(3, Math.round(tailleTitre * 0.07)))
                    .setShadow(0, Math.max(3, Math.round(tailleTitre * 0.05)),
                        "rgba(20, 18, 16, 0.3)", 4, false, true)
                    .setOrigin(0, 0.5)
                    .setPosition(margeGauche, centreLigne - u(6));
                this.accroche
                    .setFontSize(Math.round(u(4)) + "px")
                    .setOrigin(0, 0.5)
                    .setPosition(margeGauche, centreLigne + u(7.5));

                // Illustration du Waggis À DROITE, collée au bord droit,
                // sur la même ligne que le titre + accroche ; ombre de sol
                // sous ses pieds.
                const waggisY = centreLigne;
                const waggisX = w - u(2) - hWaggis / 2;
                this.waggis
                    .setScale(hWaggis / this.waggis.height)
                    .setPosition(waggisX, waggisY);
                this._dessinerSolOmbre(waggisX, waggisY + hWaggis / 2, hWaggis * 0.9);
            } else {
                // PORTRAIT : EMPILEMENT centré, sous le HUD (départ
                // h*0.14), espace u(5) entre chaque étage — le texte
                // (titre puis accroche) et le personnage occupent des
                // lignes distinctes, plus aucune superposition possible.
                const tailleAccroche = u(4);
                const espace = u(5);
                const hautBloc = h * 0.14;
                const yTitre = hautBloc + tailleTitre / 2;
                const yAccroche = yTitre + tailleTitre / 2 + espace + tailleAccroche / 2;
                const yWaggis = yAccroche + tailleAccroche / 2 + espace + hWaggis / 2;

                this.titre
                    .setFontSize(Math.round(tailleTitre) + "px")
                    .setStroke(C.couleurs.bouton, Math.max(3, Math.round(tailleTitre * 0.07)))
                    .setShadow(0, Math.max(3, Math.round(tailleTitre * 0.05)),
                        "rgba(20, 18, 16, 0.3)", 4, false, true)
                    .setOrigin(0.5)
                    .setPosition(w / 2, yTitre);
                this.accroche
                    .setFontSize(Math.round(tailleAccroche) + "px")
                    .setOrigin(0.5)
                    .setPosition(w / 2, yAccroche);

                // Personnage centré, sous l'accroche ; ombre de sol sous
                // ses pieds (même règle qu'en paysage).
                this.waggis
                    .setScale(hWaggis / this.waggis.height)
                    .setPosition(w / 2, yWaggis);
                this._dessinerSolOmbre(w / 2, yWaggis + hWaggis / 2, hWaggis * 0.9);
            }

            // Jouer + grille + Réglages : géré par Arcade.UI.menuActions
            // (core/ui/menuActions.js), abonné à son propre Arcade.UI.layout
            // — plus rien à positionner ici pour ce bloc.
        };

        UI.layout(this, this._miseEnPage);

        // Transition d'arrivée : fondu depuis le noir.
        this.cameras.main.fadeIn(220, 0, 0, 0);

        // Meilleur score : local d'abord, puis confirmation par le serveur.
        // (spec 709 révision 08/08 : « 🏆 Meilleur score : X » en HUD.)
        await Arcade.Score.load();
        this.record.setText(C.textes.meilleurScore.replace("{score}", Arcade.Score.best));
        this._miseEnPage(this.scale.width, this.scale.height);
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

    // --- Police ronde (Azimut, marque auto-hébergée) ------------------------

    /**
     * Injecte le @font-face d'Azimut (une seule fois par page) et attend
     * son chargement, avec une limite de temps : hors ligne ou police
     * indisponible, le menu se dessine quand même avec la pile de repli.
     */
    async _chargerPolice(C) {
        try {
            if (!document.fonts || window.__waggisPoliceInjected) return;
            window.__waggisPoliceInjected = true;
            const style = document.createElement("style");
            style.textContent =
                "@font-face{font-family:'Azimut';src:url('" + C.police.url +
                "') format('woff2');font-weight:400;font-style:normal;" +
                "font-display:swap;}";
            document.head.appendChild(style);
            await Promise.race([
                document.fonts.load('16px "Azimut"'),
                new Promise(function (res) { setTimeout(res, 1200); })
            ]);
        } catch (e) {
            // Repli silencieux sur la police système.
        }
    }

    // --- Boutons -------------------------------------------------------------
    // ⭐ Menu réutilisable (core/ui/menuActions.js, décision John) : Jouer,
    // la grille de tuiles secondaires et Réglages sont construits ET
    // positionnés par Arcade.UI.menuActions (create()) — couleurs du design
    // system résolues par Arcade.UI.boutonMenu (core/ui/menuBouton.js),
    // rendu par core/ui/button.js. Plus aucune couleur, ombre, ni mise en
    // page de bouton de menu codée dans cette scène.

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
        g.fillStyle(C.couleurs.solMenu, 1);
        g.fillRect(0, ySol, w, h - ySol);
        // Maisons à pignons (toits alsaciens), hauteurs variées.
        g.fillStyle(C.couleurs.toits, 0.85);
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
        g.fillStyle("rgba(20, 18, 16, 0.25)", 1);
        g.fillEllipse(x, y, largeur, largeur * 0.28);
    }
}
