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
 *    — il est listé avec un cadenas et renvoie vers la Boutique (« 🔒
 *    Débloque-le en Boutique ») ; le déblocage se fait À LA BOUTIQUE
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
 * ⭐ REFONTE 08/08/2026 (spec 709 — révision 08/08, validée John) :
 *  - fond : dégradé de ciel (WaggisUI.ciel) au lieu de l'aplat ;
 *  - lignes : ombre portée + coins arrondis ; skin ACTIF = bordure/glow
 *    verte au lieu de l'aplat vert ; skin VERROUILLÉ = overlay
 *    semi-transparent + icône cadenas fine + texte « 🔒 Débloque-le en
 *    Boutique » (spec 709, remplace « À débloquer dans la Boutique ») ;
 *  - police ronde Azimut (marque, C.police.famille) sur tous les textes ;
 *  - transitions animées fade entre écrans (WaggisUI.aller).
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
        this.enTransition = false;

        // Données de la save v5 (appliquée au boot par Arcade.Save.apply).
        this.debloques = this.registry.get("unlockedCharacters") || ["waggis"];
        this.actif = this.registry.get("activeCharacter") || "waggis";

        // --- Fond : dégradé de ciel (spec 709 révision 08/08) --------------
        this.fond = this.add.graphics().setDepth(0);

        // --- Titre (police Azimut + relief) + pièces -----------------------
        const titre = this.add.text(0, 0, C.textes.personnages, {
            fontFamily: C.police.famille,
            color: "#ffffff",
            align: "center"
        })
            .setOrigin(0.5)
            .setDepth(20)
            .setStroke("#141210", 3)
            .setShadow(0, 3, "rgba(20, 18, 16, 0.3)", 3, false, true);
        const pieces = this.add.text(0, 0, "", {
            fontFamily: C.police.famille,
            color: C.couleurs.texte,
            align: "center"
        })
            .setOrigin(0.5)
            .setDepth(20)
            .setShadow(0, 2, "rgba(255, 255, 255, 0.7)", 2, false, true);
        this.piecesTexte = pieces;

        // --- Liste des skins -------------------------------------------------
        this._lignes = [];   // objets { ombre, fond, sprite, nom, etat, zone, cadenas? }

        // --- Retour au menu (bouton refondu) --------------------------------
        const retour = WaggisUI.bouton(this, {
            label: C.textes.retour,
            couleur: "#141210",
            onClick: () => WaggisUI.aller(this, MenuScene.KEY)
        });
        this.retour = retour;

        // Mise en page recalculée à chaque rotation : titre en haut, pièces,
        // liste centrée, retour en bas.
        UI.layout(this, (w, h) => {
            WaggisUI.ciel(this.fond, w, h);
            titre.setPosition(w / 2, h * 0.08)
                 .setFontSize(Math.round(UI.u(this, 9)) + "px");
            pieces.setPosition(w / 2, h * 0.155)
                  .setFontSize(Math.round(UI.u(this, 4)) + "px");
            retour.redimensionner(UI.u(this, 40), UI.u(this, 9))
                  .setPosition(w / 2, h * 0.91);
            this._dessinerListe();
        });
        this._majPieces();

        // Transition d'arrivée : fondu depuis le noir (spec 709).
        this.cameras.main.fadeIn(220, 0, 0, 0);
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
            l.ombre.destroy();
            l.fond.destroy();
            l.sprite.destroy();
            l.nom.destroy();
            l.etat.destroy();
            if (l.cadenas) l.cadenas.destroy();
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
     * Crée la ligne d'un skin — ⭐ REFONTE 08/08 (spec 709) : ombre portée
     * + coins arrondis ; skin ACTIF = bordure/glow verte (plus l'aplat
     * vert) ; skin VERROUILLÉ = overlay semi-transparent + cadenas fin +
     * « 🔒 Débloque-le en Boutique » ; sinon fond blanc + « Sélectionner ».
     * Zone tactile UNIQUEMENT sur les skins débloqués non actifs (spec 709 :
     * sélection depuis cet écran, un seul actif à la fois).
     */
    _creerLigne(id, perso, debloque, x, y, largeur, hauteur) {
        const C = this.C;
        const UI = Arcade.UI;
        const estActif = this.actif === id;
        const hex = (s) => Phaser.Display.Color.HexStringToColor(s).color;
        const r = hauteur * 0.18;

        // Ombre portée sous la ligne.
        const ombre = this.add.graphics();
        ombre.fillStyle(C.couleurs.ombrePortee, 0.22);
        ombre.fillRoundedRect(x - largeur / 2, y - hauteur / 2 + hauteur * 0.06,
            largeur, hauteur, r);

        // Corps de la ligne.
        const fond = this.add.graphics();
        fond.fillStyle(hex(C.couleurs.fondCarte), 1);
        fond.fillRoundedRect(x - largeur / 2, y - hauteur / 2, largeur, hauteur, r);

        let couleurEtat = C.couleurs.texte;
        let couleurSprite = null;   // null = alpha normal
        if (!debloque) {
            // VERROUILLÉ : overlay sombre semi-transparent (spec 709) par-
            // dessus le fond clair, sprite estompé.
            fond.fillStyle(C.couleurs.ombrePortee, 0.45);
            fond.fillRoundedRect(x - largeur / 2, y - hauteur / 2, largeur, hauteur, r);
            couleurSprite = 0.4;
        } else if (estActif) {
            // ACTIF : bordure/glow verte au lieu de l'aplat vert (spec 709).
            const liseret = hex(C.couleurs.liseretActif);
            fond.lineStyle(Math.max(2, Math.round(UI.u(this, 0.7))), liseret, 1);
            fond.strokeRoundedRect(x - largeur / 2, y - hauteur / 2, largeur, hauteur, r);
            fond.lineStyle(Math.max(4, Math.round(UI.u(this, 1.6))), liseret, 0.25);
            fond.strokeRoundedRect(x - largeur / 2 - UI.u(this, 0.4),
                y - hauteur / 2 - UI.u(this, 0.4),
                largeur + UI.u(this, 0.8), hauteur + UI.u(this, 0.8), r);
        }

        // Sprite du personnage : frame de repos (frames[0]), en hauteur de
        // ligne × 0,8 — le fond reste visible autour (vignette).
        const sprite = this.add
            .image(x - largeur / 2 + hauteur * 0.6, y, perso.frames[0])
            .setDisplaySize(hauteur * 0.8, hauteur * 0.8);
        if (couleurSprite !== null) sprite.setAlpha(couleurSprite);

        const nom = this.add
            .text(x - largeur / 2 + hauteur * 1.3, y - hauteur * 0.12, perso.nom, {
                fontFamily: C.police.famille,
                fontSize: Math.round(UI.u(this, 4)) + "px",
                color: !debloque ? "#ffffff" : "#141210",
                align: "left"
            })
            .setOrigin(0, 0.5);

        // État : « Actif » (skin courant) / « Sélectionner » (débloqué non
        // actif) / « 🔒 Débloque-le en Boutique » (à débloquer — non
        // interactif, spec 709 révision 08/08).
        let etatTexte = "";
        if (!debloque) {
            etatTexte = C.textes.verrouille + " " + C.textes.aDebloquer;
            couleurEtat = "#ffffff";
        } else if (estActif) {
            etatTexte = C.textes.actif;
            couleurEtat = C.couleurs.liseretActif;
        } else {
            etatTexte = C.textes.selectionner;
            couleurEtat = C.couleurs.bouton;
        }
        const etat = this.add
            .text(x + largeur / 2 - UI.u(this, 2), y, etatTexte, {
                fontFamily: C.police.famille,
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

        if (!debloque) {
            // Cadenas FIN par-dessus le sprite estompé (spec 709 révision
            // 08/08 : « icône cadenas plus fine »).
            const cadenas = this.add.graphics();
            WaggisUI.cadenas(cadenas, x - largeur / 2 + hauteur * 0.6, y,
                hauteur * 0.42, 0xffffff);
            this._lignes.push({ ombre, fond, sprite, nom, etat, cadenas, zone });
            return;
        }
        if (!estActif) {
            zone.on("pointerdown", () => fond.setAlpha(0.75));
            zone.on("pointerout", () => fond.setAlpha(1));
            zone.on("pointerup", () => {
                fond.setAlpha(1);
                this.selectionner(id);
            });
        }
        this._lignes.push({ ombre, fond, sprite, nom, etat, zone });
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
