/*
 * ShopScene — l'écran Boutique de Waggis : achat des personnages avec les
 * pièces (data.wallet).
 *
 * ⭐ MENU-4 (spec 709 §7 boutons — Décision 6, article 704) :
 *  - « Boutique » : au MVP, ne vend QUE des personnages (spec 709 — pas
 *    d'autres types d'objets) ;
 *  - 3 PERSONNAGES DISPONIBLES À L'ACHAT AU LANCEMENT, en plus du Waggis
 *    de départ (gratuit, débloqué d'office — jamais affiché à la vente) ;
 *  - achat AVEC LES PIÈCES collectées en jeu (data.wallet, save v5) : un
 *    achat déduit le prix du wallet et ajoute le personnage à
 *    data.unlockedCharacters (le skin devient sélectionnable dans l'écran
 *    Personnages, CharactersScene) ;
 *  - chaque personnage à vendre affiche : sprite, nom, prix ; le bouton
 *    d'achat est actif si le joueur a assez de pièces, sinon le prix est
 *    grisé « Pas assez de pièces » ; un personnage déjà débloqué affiche
 *    « Déjà débloqué » (plus d'achat possible) ;
 *  - COSMÉTIQUE PUR : acheter un personnage ne change AUCUNE mécanique de
 *    jeu (aucun bonus/malus — spec 709) ;
 *  - l'ACHAT est PERSISTÉ immédiatement (Arcade.Save.saveLocal() +
 *    saveCloud()) : payer des pièces est une action explicite du joueur,
 *    elle ne doit pas se perdre au rechargement (contrairement à la
 *    progression de niveau, 708 §9, écrite à la victoire uniquement).
 *
 * Mobile-first : tailles en % du plus petit côté (Arcade.UI.u), mise en
 * page recalculée à chaque rotation (Arcade.UI.layout), 100 % clic/tap
 * (article 409). Scène propre à Waggis (article 709 : pas dans core/ tant
 * qu'un 2e jeu n'en a pas besoin).
 */
class ShopScene extends Phaser.Scene {
    static KEY = "boutique";

    constructor() {
        super(ShopScene.KEY);
    }

    create() {
        const C = window.WaggisConfig;
        const UI = Arcade.UI;
        this.C = C;

        this.cameras.main.setBackgroundColor(C.couleurs.ciel);

        // Données de la save v5 (appliquée au boot par Arcade.Save.apply).
        this.debloques = this.registry.get("unlockedCharacters") || ["waggis"];

        // --- Titre + pièces ------------------------------------------------
        const titre = UI.text(this, 0, 0, C.textes.boutique, 9, C.couleurs.texte);
        const pieces = UI.text(this, 0, 0, "", 4, C.couleurs.texte);
        this.piecesTexte = pieces;

        // --- Articles à vendre -----------------------------------------------
        this._articles = [];   // objets { fond, sprite, nom, prix, action, zone }

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
        // liste des articles centrée, retour en bas.
        UI.layout(this, (w, h) => {
            titre.setPosition(w / 2, h * 0.08)
                 .setFontSize(Math.round(UI.u(this, 9)) + "px");
            pieces.setPosition(w / 2, h * 0.155)
                  .setFontSize(Math.round(UI.u(this, 4)) + "px");
            retour.redimensionner(UI.u(this, 40), UI.u(this, 9))
                  .setPosition(w / 2, h * 0.91);
            this._dessinerArticles();
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
     * (Re)dessine la liste des articles. Détruit les articles de la passe
     * précédente — les objets Phaser ne sont pas réutilisés.
     */
    _dessinerArticles() {
        const C = this.C;
        const UI = Arcade.UI;
        this._articles.forEach((a) => {
            a.fond.destroy();
            a.sprite.destroy();
            a.nom.destroy();
            a.prix.destroy();
            a.action.destroy();
            a.zone.destroy();
        });
        this._articles = [];

        // Les articles = les personnages à PRIX > 0 (le Waggis gratuit
        // n'est jamais à vendre : débloqué d'office, spec 709).
        const aVendre = Object.keys(C.personnages).filter(
            (id) => (C.personnages[id].prix || 0) > 0
        );
        const w = this.scale.width;
        const h = this.scale.height;
        const ligneH = UI.u(this, 12);
        const gap = UI.u(this, 1.4);
        const listeW = UI.u(this, 76);
        const total = aVendre.length * ligneH + (aVendre.length - 1) * gap;
        let y = h * 0.21 + ligneH / 2;

        aVendre.forEach((id) => {
            const perso = C.personnages[id];
            const debloque = this.debloques.indexOf(id) >= 0;
            this._creerArticle(id, perso, debloque, w / 2, y, listeW, ligneH);
            y += ligneH + gap;
        });
    }

    /**
     * Crée la ligne d'un article : fond arrondi, sprite (repos = frames[0]),
     * nom, prix (« N pièces ») et action (Acheter / Pas assez de pièces /
     * Déjà débloqué). Zone tactile active UNIQUEMENT quand l'achat est
     * possible (débloqué → aucune interaction).
     */
    _creerArticle(id, perso, debloque, x, y, largeur, hauteur) {
        const C = this.C;
        const UI = Arcade.UI;
        const wallet = this.registry.get("wallet") || 0;
        const assez = wallet >= perso.prix;

        const fond = this.add.graphics();
        fond.fillStyle(Phaser.Display.Color.HexStringToColor(
            debloque ? C.couleurs.complete : "#ffffff"
        ).color, 1);
        fond.fillRoundedRect(x - largeur / 2, y - hauteur / 2, largeur, hauteur, hauteur * 0.18);

        // Sprite du personnage : frame de repos (frames[0]).
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

        const prix = this.add
            .text(x - largeur / 2 + hauteur * 1.3, y + hauteur * 0.14,
                perso.prix + " pièces", {
                    fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
                    fontSize: Math.round(UI.u(this, 3.2)) + "px",
                    color: "#5a5a5a",
                    align: "left"
                })
            .setOrigin(0, 0.5);

        // Action : bouton « Acheter » (assez de pièces) / prix grisé
        // « Pas assez de pièces » / « Déjà débloqué » (plus rien à acheter).
        let actionTexte = "";
        let actionCouleur = C.couleurs.bouton;
        let actionnable = false;
        if (debloque) {
            actionTexte = C.textes.dejaDebloque;
            actionCouleur = C.couleurs.verrouille;
        } else if (assez) {
            actionTexte = C.textes.acheter;
            actionnable = true;
        } else {
            actionTexte = C.textes.pasAssezPieces;
            actionCouleur = C.couleurs.verrouille;
        }
        const action = this.add
            .text(x + largeur / 2 - UI.u(this, 2), y, actionTexte, {
                fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
                fontSize: Math.round(UI.u(this, 3.4)) + "px",
                color: actionCouleur,
                align: "right"
            })
            .setOrigin(1, 0.5);

        // Zone tactile : VRAIE uniquement si l'achat est possible.
        const zone = this.add
            .rectangle(x, y, largeur, hauteur, 0x000000, 0)
            .setInteractive({ useHandCursor: true });
        if (actionnable) {
            zone.on("pointerdown", () => fond.setAlpha(0.75));
            zone.on("pointerout", () => fond.setAlpha(1));
            zone.on("pointerup", () => {
                fond.setAlpha(1);
                this.acheter(id);
            });
        }
        this._articles.push({ fond, sprite, nom, prix, action, zone });
    }

    /**
     * Achète un personnage : déduit le prix du wallet (data.wallet) et
     * ajoute le personnage à data.unlockedCharacters. Cosmétique pur (aucun
     * impact gameplay, spec 709). Persisté immédiatement (saveLocal +
     * saveCloud) — cf. en-tête.
     */
    acheter(id) {
        const C = this.C;
        const perso = C.personnages[id];
        if (!perso || !(perso.prix > 0)) return;          // jamais à vendre
        if (this.debloques.indexOf(id) >= 0) return;      // déjà débloqué
        const wallet = this.registry.get("wallet") || 0;
        if (wallet < perso.prix) return;                  // pas assez de pièces

        this.registry.set("wallet", wallet - perso.prix);
        const debloques = this.registry.get("unlockedCharacters") || ["waggis"];
        debloques.push(id);
        this.registry.set("unlockedCharacters", debloques);
        this.debloques = debloques;

        // Persistance immédiate (cf. en-tête) : local + cloud.
        Arcade.Save.saveLocal();
        try {
            Arcade.Save.saveCloud();
        } catch (e) {
            console.warn("[ShopScene] Sauvegarde cloud impossible :", e);
        }

        this._majPieces();
        this._dessinerArticles();
    }
}
