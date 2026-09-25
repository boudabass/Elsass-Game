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
 * ⭐ REFONTE CHARTE 24/09/2026 : en-tête, retour et mise en page par le
 * gabarit commun core/ui/ecran.js ; lignes = cartes crème de la charte
 * (Arcade.UI.carte), bord or quand le personnage est déjà débloqué.
 *
 * ⭐ REFONTE 08/08/2026 (spec 709 — révision 08/08, validée John) :
 *  - fond : dégradé de ciel (WaggisUI.ciel) au lieu de l'aplat ;
 *  - lignes : ombre portée + coins arrondis ; article DÉJÀ DÉBLOQUÉ =
 *    bordure/glow verte au lieu de l'aplat vert ; article ACHETABLE =
 *    bordure rouge Waggis discrète ; police ronde Azimut sur tous les
 *    textes ; transitions animées fade entre écrans (WaggisUI.aller).
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
        this.enTransition = false;

        // ⭐ Décision John 08/08 (art. 704 Chantier B) : les boutons Retour
        // et Plein écran ne sont affichés QUE sur le menu principal — plus
        // d'icônes plateforme sur les autres scènes.

        // Données de la save v5 (appliquée au boot par Arcade.Save.apply).
        this.debloques = this.registry.get("unlockedCharacters") || ["waggis"];

        // --- Fond : dégradé de ciel (spec 709 révision 08/08) --------------
        this.fond = this.add.graphics().setDepth(0);
        UI.layout(this, (w, h) => WaggisUI.ciel(this.fond, w, h));

        // --- Articles à vendre -----------------------------------------------
        this._articles = [];   // objets { fond, sprite, conteneur, zone }

        // Refonte charte du 24/09 : en-tête (pièces en pastille), retour et
        // mise en page par le gabarit commun des écrans (core/ui/ecran.js) ;
        // la liste se range dans la zone qu'il fournit.
        this.ecran = Arcade.UI.ecran(this, {
            surtitre: C.titre,
            titre: C.textes.boutique,
            infos: [this._textePieces()],
            retour: { label: C.textes.retour, onClick: () => WaggisUI.aller(this, MenuScene.KEY) },
            contenu: (zone) => {
                this.zone = zone;
                this._dessinerArticles();
            }
        });

        // Transition d'arrivée : fondu depuis le noir (spec 709).
        this.cameras.main.fadeIn(220, 0, 0, 0);
    }

    /** Texte des pièces (data.wallet), affiché en pastille d'en-tête. */
    _textePieces() {
        const wallet = this.registry.get("wallet") || 0;
        return this.C.textes.pieces.replace("{pieces}", wallet);
    }

    /** Rafraîchit la pastille des pièces (après un achat). */
    _majPieces() {
        this.ecran.setInfo(0, this._textePieces());
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
            a.conteneur.destroy();
            a.zone.destroy();
        });
        this._articles = [];

        // Les articles = les personnages à PRIX > 0 (le Waggis gratuit
        // n'est jamais à vendre : débloqué d'office, spec 709).
        const aVendre = Object.keys(C.personnages).filter(
            (id) => (C.personnages[id].prix || 0) > 0
        );
        const zone = this.zone;
        const ligneH = UI.u(this, 12);
        const gap = UI.u(this, 1.4);
        // Largeur de liste = % de la LARGEUR RÉELLE (jamais u(), qui mesure
        // le plus petit côté), plafonnée pour ne pas s'étirer à l'infini
        // sur un écran très large (config.listes).
        const listeW = Math.min(zone.largeur, UI.u(this, C.listes.largeurMaxU));
        let y = zone.y + ligneH / 2;

        aVendre.forEach((id) => {
            const perso = C.personnages[id];
            const debloque = this.debloques.indexOf(id) >= 0;
            this._creerArticle(id, perso, debloque, zone.cx, y, listeW, ligneH);
            y += ligneH + gap;
        });
    }

    /**
     * Crée la ligne d'un article — ⭐ REFONTE 08/08 (spec 709) : ombre
     * portée + coins arrondis ; DÉJÀ DÉBLOQUÉ = bordure/glow verte (plus
     * l'aplat vert) ; ACHETABLE = bordure rouge Waggis discrète ; sinon
     * fond blanc simple. Sprite, nom, prix (« N pièces ») et action
     * (Acheter / Pas assez de pièces / Déjà débloqué). Zone tactile active
     * UNIQUEMENT quand l'achat est possible.
     */
    _creerArticle(id, perso, debloque, x, y, largeur, hauteur) {
        const C = this.C;
        const UI = Arcade.UI;
        const wallet = this.registry.get("wallet") || 0;
        const assez = wallet >= perso.prix;
        const T = Arcade.UI.tokens;

        // Carte de la charte (core/ui/ecran.js) : bord OR = déjà débloqué.
        const fond = this.add.graphics();
        Arcade.UI.carte(fond, x - largeur / 2, y - hauteur / 2, largeur, hauteur,
            debloque ? "reussi" : "normal");

        // Sprite du personnage : frame de repos (frames[0]).
        const sprite = this.add
            .image(x - largeur / 2 + hauteur * 0.6, y, perso.frames[0])
            .setDisplaySize(hauteur * 0.8, hauteur * 0.8);

        // ⭐ FIX 08/08 (correction John) : nom + prix + action dans un MÊME
        // conteneur — nom et prix EMPILÉS verticalement à gauche, action
        // alignée à droite du bloc texte, jamais superposés (règle UI
        // John : tout est empilé, jamais superposé). Si les textes ne
        // tiennent pas côte à côte, la police de l'action (puis du nom)
        // est réduite jusqu'à ce qu'ils ne se touchent plus.
        const texteX = x - largeur / 2 + hauteur * 1.3;
        const texteW = largeur - hauteur * 1.3 - UI.u(this, 2);
        const gap = UI.u(this, 1);

        const nom = this.add
            .text(0, -hauteur * 0.16, perso.nom, {
                fontFamily: C.police.famille,
                fontStyle: "bold",
                fontSize: Math.round(UI.u(this, 4)) + "px",
                color: T.encre,
                align: "left"
            })
            .setOrigin(0, 0.5);

        const prix = this.add
            .text(0, hauteur * 0.18, C.textes.prixPieces.replace("{prix}", perso.prix), {
                fontFamily: C.police.famille,
                fontSize: Math.round(UI.u(this, 3.2)) + "px",
                color: C.couleurs.texteDiscret,
                align: "left"
            })
            .setOrigin(0, 0.5);

        // Action : « Acheter » (assez de pièces) / prix grisé « Pas assez
        // de pièces » / « Déjà débloqué » (plus rien à acheter).
        let actionTexte = "";
        let actionCourt = "";
        let actionCouleur = T.rouge;
        let actionnable = false;
        if (debloque) {
            actionTexte = C.textes.dejaDebloque;
            actionCourt = C.textes.dejaDebloqueCourt;
            actionCouleur = C.couleurs.texteDiscret;
        } else if (assez) {
            actionTexte = C.textes.acheter;
            actionCourt = C.textes.acheter;
            actionnable = true;
        } else {
            actionTexte = C.textes.pasAssezPieces;
            actionCourt = C.textes.pasAssezPiecesCourt;
            actionCouleur = C.couleurs.texteDiscret;
        }
        const action = this.add
            .text(0, 0, actionTexte, {
                fontFamily: C.police.famille,
                fontSize: Math.round(UI.u(this, 3.4)) + "px",
                color: actionCouleur,
                align: "right"
            })
            .setOrigin(1, 0.5);

        // ⭐ FIX 09/08 : d'ABORD le libellé COURT, ENSUITE seulement la
        // réduction de police. « Pas assez de pièces » sur un mobile
        // portrait finissait rétréci à ~11 px ; « Trop cher » tient à
        // taille normale et se lit. La police ne rétrécit plus qu'en
        // dernier recours (écran vraiment minuscule).
        if (action.width > texteW * 0.5 && actionCourt !== actionTexte) {
            action.setText(actionCourt);
        }
        // Jamais sous le plancher de lisibilité de l'arcade (13 px, critique
        // du 25/09) : ces planchers étaient en u() et pouvaient tomber à
        // ~9 px sur un petit téléphone.
        let fsAction = 3.4;
        while (action.width > texteW * 0.5 && fsAction > 2.4) {
            fsAction -= 0.2;
            action.setFontSize(Math.round(Math.max(Arcade.UI.policeMinPx, UI.u(this, fsAction))) + "px");
        }
        let fsNom = 4;
        while (nom.width > texteW - action.width - gap && fsNom > 3) {
            fsNom -= 0.2;
            nom.setFontSize(Math.round(Math.max(Arcade.UI.policeMinPx, UI.u(this, fsNom))) + "px");
        }
        action.setPosition(texteW, 0);

        const conteneur = this.add.container(texteX, y);
        conteneur.add([nom, prix, action]);

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
        this._articles.push({ fond, sprite, conteneur, zone });
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
