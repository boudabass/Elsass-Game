/*
 * CharactersScene — l'écran Personnages de Waggis : liste des skins avec
 * leur état (débloqué / à débloquer) et sélection du skin actif.
 *
 * ⭐ MENU-4 (spec 709 §7 boutons — Décision 6, article 704) :
 *  - « Personnages » : liste de TOUS les skins (config.personnages) avec
 *    pour chacun :
 *      · état : débloqué (dans data.unlockedCharacters) ou à débloquer ;
 *      · le skin ACTIF (data.activeCharacter, save v5) est marqué « Actif » ;
 *  - UN SEUL SKIN ACTIF À LA FOIS (spec 709) : sélection depuis CET écran —
 *    taper un skin débloqué le rend actif (data.activeCharacter), le
 *    précédent redevient inactif (une seule entrée dans la save) ;
 *  - un skin NON débloqué n'a AUCUNE interaction (aucune sélection possible)
 *    — il est listé avec un cadenas et renvoie vers la Boutique (« À
 *    débloquer dans la Boutique ») ; le déblocage se fait À LA BOUTIQUE
 *    (ShopScene), pas ici (spec 709 : la Boutique vend, Personnages
 *    sélectionne) ;
 *  - COSMÉTIQUE PUR : sélectionner un skin ne change AUCUNE mécanique de
 *    jeu (aucun bonus/malus) — seul le sprite du joueur change (GameScene
 *    lit data.activeCharacter, spec 709) ;
 *  - la sélection est PERSISTÉE immédiatement (Arcade.Save.saveLocal() +
 *    saveCloud()) : c'est une action explicite du joueur, elle doit
 *    survivre à un rechargement — contrairement à la progression de niveau
 *    (708 §9, écriture à la victoire uniquement), l'achat/sélection d'un
 *    skin n'est pas liée à une partie en cours.
 *
 * Mobile-first : tailles en % du plus petit côté (Arcade.UI.u), mise en
 * page recalculée à chaque rotation (Arcade.UI.layout), 100 % clic/tap
 * (article 409). Scène propre à Waggis (article 709 : pas dans core/ tant
 * qu'un 2e jeu n'en a pas besoin).
 */
class CharactersScene extends Phaser.Scene {
    static KEY = "personnages";

    constructor() {
        super(CharactersScene.KEY);
    }

    create() {
        const C = window.WaggisConfig;
        const UI = Arcade.UI;
        this.C = C;

        this.cameras.main.setBackgroundColor(C.couleurs.ciel);

        // Données de la save v5 (appliquée au boot par Arcade.Save.apply).
        this.debloques = this.registry.get("unlockedCharacters") || ["waggis"];
        this.actif = this.registry.get("activeCharacter") || "waggis";

        // --- Titre + pièces (contexte : la Boutique débloque) ---------------
        const titre = UI.text(this, 0, 0, C.textes.personnages, 9, C.couleurs.texte);
        const pieces = UI.text(this, 0, 0, "", 4, C.couleurs.texte);
        this.piecesTexte = pieces;

        // --- Liste des skins -------------------------------------------------
        this._lignes = [];   // objets { fond, sprite, nom, action, zone }

        // --- Retour au menu ---------------------------------------------------
        const retour = UI.button(this, {
            width: UI.u(this, 40), height: UI.u(this, 9),
            label: C.textes.retour,
            color: "#141210",
            textColor: C.couleurs.texteClair,
            onClick: () => this.scene.start(MenuScene.KEY)
        });
        this.retour = retour;

        // Mise en page recalculée à chaque rotation : titre en haut, pièces,
        // liste centrée, retour en bas.
        UI.layout(this, (w, h) => {
            titre.setPosition(w / 2, h * 0.08)
                 .setFontSize(Math.round(UI.u(this, 9)) + "px");
            pieces.setPosition(w / 2, h * 0.155)
                  .setFontSize(Math.round(UI.u(this, 4)) + "px");
            retour.redimensionner(UI.u(this, 40), UI.u(this, 9))
                  .setPosition(w / 2, h * 0.91);
            this._dessinerListe();
        });
        this._majPieces();
    }

    /** Rafraîchit le texte des pièces (data.wallet). */
    _majPieces() {
        const wallet = this.registry.get("wallet") || 0;
        if (this.piecesTexte) {
            this.piecesTexte.setText(
                this.C.textes.pieces.replace("{pieces}", wallet)
            );
        }
    }

    /**
     * (Re)dessine la liste des skins. Détruit les lignes de la passe
     * précédente — les objets Phaser ne sont pas réutilisés.
     */
    _dessinerListe() {
        const C = this.C;
        const UI = Arcade.UI;
        this._lignes.forEach((l) => {
            l.fond.destroy();
            l.sprite.destroy();
            l.nom.destroy();
            l.etat.destroy();
            l.zone.destroy();
        });
        this._lignes = [];

        const ids = Object.keys(C.personnages);
        const w = this.scale.width;
        const h = this.scale.height;
        const ligneH = UI.u(this, 12);
        const gap = UI.u(this, 1.4);
        const listeW = UI.u(this, 76);
        const total = ids.length * ligneH + (ids.length - 1) * gap;
        let y = h * 0.21 + ligneH / 2;

        ids.forEach((id) => {
            const perso = C.personnages[id];
            const debloque = this.debloques.indexOf(id) >= 0;
            this._creerLigne(id, perso, debloque, w / 2, y, listeW, ligneH);
            y += ligneH + gap;
        });
    }

    /**
     * Crée la ligne d'un skin : fond arrondi, sprite (repos = frames[0]),
     * nom + état (Actif / Sélectionner / cadenas à débloquer). Zone tactile
     * UNIQUEMENT sur les skins débloqués non actifs (spec 709 : sélection
     * depuis cet écran, un seul actif à la fois).
     */
    _creerLigne(id, perso, debloque, x, y, largeur, hauteur) {
        const C = this.C;
        const UI = Arcade.UI;
        const estActif = this.actif === id;

        const fond = this.add.graphics();
        fond.fillStyle(Phaser.Display.Color.HexStringToColor(
            estActif ? C.couleurs.complete : "#ffffff"
        ).color, 1);
        fond.fillRoundedRect(x - largeur / 2, y - hauteur / 2, largeur, hauteur, hauteur * 0.18);
        if (!debloque) {
            // Skin à débloquer : fond grisé (état verrouillé).
            fond.clear();
            fond.fillStyle(Phaser.Display.Color.HexStringToColor(C.couleurs.verrouille).color, 1);
            fond.fillRoundedRect(x - largeur / 2, y - hauteur / 2, largeur, hauteur, hauteur * 0.18);
        }

        // Sprite du personnage : frame de repos (frames[0]), en hauteur de
        // ligne × 0,8 — le fond blanc/gris reste visible autour (vignette).
        const sprite = this.add
            .image(x - largeur / 2 + hauteur * 0.6, y, perso.frames[0])
            .setDisplaySize(hauteur * 0.8, hauteur * 0.8);

        const nom = this.add
            .text(x - largeur / 2 + hauteur * 1.3, y - hauteur * 0.12, perso.nom, {
                fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
                fontSize: Math.round(UI.u(this, 4)) + "px",
                color: "#141210",
                align: "left"
            })
            .setOrigin(0, 0.5);

        // État : « Actif » (skin courant) / « Sélectionner » (débloqué non
        // actif) / cadenas + renvoi Boutique (à débloquer — non interactif).
        let etatTexte = "";
        let couleurEtat = "#141210";
        if (!debloque) {
            etatTexte = C.textes.verrouille + " " + C.textes.aDebloquer;
            couleurEtat = "#5a5a5a";
        } else if (estActif) {
            etatTexte = C.textes.actif;
            couleurEtat = C.couleurs.complete;
        } else {
            etatTexte = C.textes.selectionner;
            couleurEtat = C.couleurs.bouton;
        }
        const etat = this.add
            .text(x + largeur / 2 - UI.u(this, 2), y, etatTexte, {
                fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
                fontSize: Math.round(UI.u(this, 3.4)) + "px",
                color: couleurEtat,
                align: "right"
            })
            .setOrigin(1, 0.5);

        // Zone tactile : VRAIE sur les skins débloqués NON actifs — sélection
        // (spec 709). Un skin déjà actif ou à débloquer ne réagit à rien.
        const zone = this.add
            .rectangle(x, y, largeur, hauteur, 0x000000, 0)
            .setInteractive({ useHandCursor: true });
        if (debloque && !estActif) {
            zone.on("pointerdown", () => fond.setAlpha(0.75));
            zone.on("pointerout", () => fond.setAlpha(1));
            zone.on("pointerup", () => {
                fond.setAlpha(1);
                this.selectionner(id);
            });
        }
        this._lignes.push({ fond, sprite, nom, etat, zone });
    }

    /**
     * Sélectionne le skin comme ACTIF (spec 709 : un seul skin actif à la
     * fois, sélection depuis l'écran Personnages). Le skin doit être
     * débloqué (sinon aucune interaction en amont). Cosmétique pur : la
     * sélection ne touche à aucune mécanique de jeu. Persistée immédiatement
     * (saveLocal + saveCloud) — une action explicite du joueur ne se perd
     * pas au rechargement.
     */
    selectionner(id) {
        const debloques = this.registry.get("unlockedCharacters") || ["waggis"];
        if (debloques.indexOf(id) < 0) return;   // jamais (aucune zone tactile)
        this.registry.set("activeCharacter", id);
        this.actif = id;
        // Persistance immédiate (cf. en-tête) : local + cloud.
        Arcade.Save.saveLocal();
        try {
            Arcade.Save.saveCloud();
        } catch (e) {
            console.warn("[CharactersScene] Sauvegarde cloud impossible :", e);
        }
        this._dessinerListe();
    }
}
