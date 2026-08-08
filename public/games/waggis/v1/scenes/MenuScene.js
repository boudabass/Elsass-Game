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
 *    sprite de Waggis dans l'atelier, cf. GameScene) en fond/centre. Il
 *    lance DIRECTEMENT le prochain niveau non terminé — data.currentLevel
 *    (save v5, appliquée au boot par Arcade.Save.apply), comportement
 *    inchangé (spec 709) ;
 *  - rangée d'icônes secondaires CÔTE À CÔTE sous « Jouer » (plus rien
 *    d'empilé) : Niveaux / Personnages / Boutique / Classement — petits
 *    boutons ronds, chacun ouvre son écran (LevelsScene MENU-3,
 *    CharactersScene + ShopScene MENU-4, ClassementScene MENU-5) ;
 *  - « Réglages » en icône discrète (⚙️) dans le coin haut-droit, hors de
 *    la rangée principale (SettingsScene MENU-5 — son on/off) ;
 *  - score affiché en HUD (bandeau en haut), plus au centre de l'écran —
 *    le centre est libéré pour l'illustration du personnage ;
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

        // --- Bouton principal « Jouer » (pleine largeur) -------------------
        this.boutonJouer = this._creerBouton({
            label: C.textes.jouer,
            couleur: C.couleurs.bouton,
            onClick: () => this.jouer()
        });

        // --- Rangée d'icônes secondaires (côte à côte, spec 709) -----------
        // Niveaux / Personnages / Boutique / Classement : petits boutons
        // ronds, libellé sous chaque icône. Réglages est VOLONTAIREMENT
        // absent de la rangée (icône discrète en coin, plus bas).
        this.icones = [
            {
                emoji: "🗺️",
                label: C.textes.niveaux,
                onClick: () => this.aller(LevelsScene.KEY)
            },
            {
                emoji: "🐤",
                label: C.textes.personnages,
                onClick: () => this.aller(CharactersScene.KEY)
            },
            {
                emoji: "🛒",
                label: C.textes.boutique,
                onClick: () => this.aller(ShopScene.KEY)
            },
            {
                emoji: "🏆",
                label: C.textes.classement,
                onClick: () => this.aller(ClassementScene.KEY)
            }
        ].map((ic) => ({
            bouton: this._creerBoutonIcone({
                emoji: ic.emoji,
                onClick: ic.onClick
            }),
            label: this.add.text(0, 0, ic.label, {
                fontFamily: C.police.famille,
                color: "#141210",
                align: "center"
            })
                .setOrigin(0.5)
                .setDepth(40)
                .setStroke("#ffffff", 2)
        }));

        // --- ⚙️ Réglages : icône discrète dans un coin (spec 709) ----------
        // Hors de la rangée principale. Zone tactile un peu plus grande que
        // le dessin (cible confortable, visuel discret).
        this.boutonReglages = this._creerBoutonIcone({
            emoji: "⚙️",
            discret: true,
            onClick: () => this.aller(SettingsScene.KEY)
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

            // ⚙️ Réglages, coin haut-droit (aligné sur la pillule du score).
            this.boutonReglages.setPosition(w - u(7.5), recordY);

            // Titre (avec relief) + accroche.
            const tailleTitre = u(13.5);
            this.titre
                .setFontSize(Math.round(tailleTitre) + "px")
                .setStroke(C.couleurs.bouton, Math.max(3, Math.round(tailleTitre * 0.07)))
                .setShadow(0, Math.max(3, Math.round(tailleTitre * 0.05)),
                    "rgba(20, 18, 16, 0.3)", 4, false, true)
                .setPosition(w / 2, h * 0.165);
            this.accroche
                .setFontSize(Math.round(u(4)) + "px")
                .setPosition(w / 2, h * 0.245);

            // Illustration du Waggis au centre (hauteur proportionnelle),
            // ombre de sol sous ses pieds.
            const hWaggis = u(21);
            const waggisY = h * 0.41;
            this.waggis
                .setScale(hWaggis / this.waggis.height)
                .setPosition(w / 2, waggisY);
            this._dessinerSolOmbre(w / 2, waggisY + hWaggis / 2, hWaggis * 0.9);

            // « Jouer » pleine largeur (80 % de la largeur d'écran).
            this.boutonJouer
                .redimensionner(w * 0.8, u(11.5))
                .setPosition(w / 2, h * 0.635);

            // Rangée d'icônes côte à côte, centrée, libellé sous chaque.
            const d = u(13);
            const pas = d + u(4.5);
            const total = pas * (this.icones.length - 1) + d;
            const yIcones = h * 0.8;
            this.icones.forEach((ic, i) => {
                const x = w / 2 - total / 2 + pas * i + d / 2;
                ic.bouton.redimensionner(d, d).setPosition(x, yIcones);
                ic.label
                    .setFontSize(Math.round(u(2.6)) + "px")
                    .setPosition(x, yIcones + d / 2 + u(3.1));
            });
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

    /**
     * Bouton rectangulaire (bouton principal) — spec 709 révision 08/08 :
     * coins arrondis + ombre portée + dégradé léger + feedback au clic
     * (scale-down à l'appui, micro-rebond au relâchement).
     * @param {object} o {label, couleur, onClick}
     */
    _creerBouton(o) {
        const C = window.WaggisConfig;
        const ombre = this.add.graphics().setDepth(49);
        const corps = this.add.graphics().setDepth(50);
        const label = this.add.text(0, 0, o.label, {
            fontFamily: C.police.famille,
            color: "#ffffff",
            align: "center"
        }).setOrigin(0.5).setDepth(51);
        const zone = this.add.rectangle(0, 0, 10, 10, 0x000000, 0)
            .setInteractive({ useHandCursor: true })
            .setDepth(52);

        // Feedback au clic : scale-down à l'appui…
        zone.on("pointerdown", () => this._enfoncer([ombre, corps, label, zone]));
        // …et micro-rebond (Back.Out) au relâchement / sortie.
        const relacher = () => this._relacher([ombre, corps, label, zone]);
        zone.on("pointerout", relacher);
        zone.on("pointerup", () => {
            relacher();
            if (typeof o.onClick === "function") o.onClick();
        });

        let x = 0, y = 0, largeur = 10, hauteur = 10;
        const dessiner = () => {
            const r = hauteur * 0.3;
            ombre.clear();
            ombre.fillStyle(C.couleurs.ombreBouton, 1);
            ombre.fillRoundedRect(x - largeur / 2, y - hauteur / 2 + hauteur * 0.07,
                largeur, hauteur, r);
            corps.clear();
            corps.fillStyle(o.couleur || C.couleurs.bouton, 1);
            corps.fillRoundedRect(x - largeur / 2, y - hauteur / 2, largeur, hauteur, r);
            // Dégradé léger : voile clair sur la moitié haute (spec 709 —
            // « dégradé léger au lieu du noir mat uniforme »).
            corps.fillStyle(0xffffff, 0.16);
            corps.fillRoundedRect(x - largeur / 2, y - hauteur / 2,
                largeur, hauteur * 0.52, r);
            label.setFontSize(Math.round(hauteur * 0.4) + "px");
            label.setPosition(x, y);
            zone.setPosition(x, y).setSize(largeur, hauteur);
            if (zone.input && zone.input.hitArea) {
                zone.input.hitArea.setSize(largeur, hauteur);
            }
        };

        return {
            setPosition: function (nx, ny) { x = nx; y = ny; dessiner(); return this; },
            redimensionner: function (nw, nh) { largeur = nw; hauteur = nh; dessiner(); return this; },
            setDepth: function (d) {
                ombre.setDepth(d); corps.setDepth(d + 1);
                label.setDepth(d + 2); zone.setDepth(d + 3);
                return this;
            },
            destroy: function () {
                ombre.destroy(); corps.destroy(); label.destroy(); zone.destroy();
            }
        };
    }

    /**
     * Bouton rond d'icône (rangée secondaire + ⚙️ Réglages) : fond blanc,
     * liseré rouge Waggis, ombre portée, même feedback au clic. La zone
     * tactile couvre au moins ~9,5 % du petit côté (cible confortable),
     * même quand le dessin est discret (Réglages).
     * @param {object} o {emoji, discret, onClick}
     */
    _creerBoutonIcone(o) {
        const C = window.WaggisConfig;
        const UI = Arcade.UI;
        const ombre = this.add.graphics().setDepth(49);
        const corps = this.add.graphics().setDepth(50);
        const emoji = this.add.text(0, 0, o.emoji, {
            fontFamily: C.police.famille,
            align: "center"
        }).setOrigin(0.5).setDepth(51);
        const zone = this.add.rectangle(0, 0, 10, 10, 0x000000, 0)
            .setInteractive({ useHandCursor: true })
            .setDepth(52);

        zone.on("pointerdown", () => this._enfoncer([ombre, corps, emoji, zone]));
        const relacher = () => this._relacher([ombre, corps, emoji, zone]);
        zone.on("pointerout", relacher);
        zone.on("pointerup", () => {
            relacher();
            if (typeof o.onClick === "function") o.onClick();
        });

        let x = 0, y = 0, diametre = 10;
        const dessiner = () => {
            const r = diametre / 2;
            ombre.clear();
            ombre.fillStyle(C.couleurs.ombreBouton, 1);
            ombre.fillCircle(x, y + diametre * 0.06, r);
            corps.clear();
            corps.fillStyle(C.couleurs.iconeFond, 1);
            corps.fillCircle(x, y, r);
            corps.lineStyle(Math.max(2, Math.round(UI.u(this, 0.5))), C.couleurs.bouton, 1);
            corps.strokeCircle(x, y, r - 1);
            emoji.setFontSize(Math.round(diametre * 0.5) + "px");
            emoji.setPosition(x, y);
            // Zone tactile : au moins ~9,5 % du petit côté (cible
            // confortable) — le visuel peut rester discret (⚙️ Réglages).
            const z = Math.max(diametre, UI.u(this, o.discret ? 10 : 9.5));
            zone.setPosition(x, y).setSize(z, z);
            if (zone.input && zone.input.hitArea) {
                zone.input.hitArea.setSize(z, z);
            }
        };

        return {
            setPosition: function (nx, ny) { x = nx; y = ny; dessiner(); return this; },
            redimensionner: function (d) { diametre = d; dessiner(); return this; },
            setDepth: function (d) {
                ombre.setDepth(d); corps.setDepth(d + 1);
                emoji.setDepth(d + 2); zone.setDepth(d + 3);
                return this;
            },
            destroy: function () {
                ombre.destroy(); corps.destroy(); emoji.destroy(); zone.destroy();
            }
        };
    }

    /** Appui : le bouton se compresse légèrement (scale-down). */
    _enfoncer(cibles) {
        this.tweens.add({
            targets: cibles, scale: 0.95, duration: 70, ease: "Linear"
        });
    }

    /** Relâchement : retour à la taille normale avec un micro-rebond. */
    _relacher(cibles) {
        this.tweens.add({
            targets: cibles, scale: 1, duration: 170, ease: "Back.Out"
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
