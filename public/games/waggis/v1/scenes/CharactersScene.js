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
 * ⭐ REFONTE CHARTE 24/09/2026 : en-tête, retour et mise en page par le
 * gabarit commun core/ui/ecran.js ; lignes = cartes crème de la charte
 * (Arcade.UI.carte) — bord rouge = skin actif, fond « ligne » = verrouillé.
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

        // ⭐ Décision John 08/08 (art. 704 Chantier B) : les boutons Retour
        // et Plein écran ne sont affichés QUE sur le menu principal — plus
        // d'icônes plateforme sur les autres scènes.

        // Données de la save v5 (appliquée au boot par Arcade.Save.apply).
        this.debloques = this.registry.get("unlockedCharacters") || ["waggis"];
        this.actif = this.registry.get("activeCharacter") || "waggis";

        // --- Fond : dégradé de ciel (spec 709 révision 08/08) --------------
        this.fond = this.add.graphics().setDepth(0);
        UI.layout(this, (w, h) => WaggisUI.ciel(this.fond, w, h));

        // --- Liste des skins -------------------------------------------------
        this._lignes = [];   // objets { fond, sprite, conteneur, zone, cadenas? }

        // Refonte charte du 24/09 : en-tête (pièces en pastille), retour et
        // mise en page par le gabarit commun des écrans (core/ui/ecran.js) ;
        // la liste se range dans la zone qu'il fournit.
        Arcade.UI.ecran(this, {
            surtitre: C.titre,
            titre: C.textes.personnages,
            infos: [C.textes.pieces.replace("{pieces}", this.registry.get("wallet") || 0)],
            retour: { label: C.textes.retour, onClick: () => WaggisUI.aller(this, MenuScene.KEY) },
            contenu: (zone) => {
                this.zone = zone;
                this._dessinerListe();
            }
        });

        // Transition d'arrivée : fondu depuis le noir (spec 709).
        this.cameras.main.fadeIn(220, 0, 0, 0);
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
            l.conteneur.destroy();
            if (l.cadenas) l.cadenas.destroy();
            l.zone.destroy();
        });
        this._lignes = [];

        const ids = Object.keys(C.personnages);
        const zone = this.zone;
        const ligneH = UI.u(this, 12);
        const gap = UI.u(this, 1.4);
        // Largeur de liste = % de la LARGEUR RÉELLE (jamais u(), qui mesure
        // le plus petit côté), plafonnée pour ne pas s'étirer à l'infini
        // sur un écran très large (config.listes).
        const listeW = Math.min(zone.largeur, UI.u(this, C.listes.largeurMaxU));
        let y = zone.y + ligneH / 2;

        ids.forEach((id) => {
            const perso = C.personnages[id];
            const debloque = this.debloques.indexOf(id) >= 0;
            this._creerLigne(id, perso, debloque, zone.cx, y, listeW, ligneH);
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
        const T = Arcade.UI.tokens;

        // Carte de la charte (core/ui/ecran.js) : bord ROUGE = skin actif,
        // fond « ligne » = verrouillé.
        const fond = this.add.graphics();
        Arcade.UI.carte(fond, x - largeur / 2, y - hauteur / 2, largeur, hauteur,
            !debloque ? "verrou" : (estActif ? "selection" : "normal"));

        let couleurEtat = T.encre;
        const couleurSprite = debloque ? null : 0.4;   // null = alpha normal

        // Sprite du personnage : frame de repos (frames[0]), en hauteur de
        // ligne × 0,8 — le fond reste visible autour (vignette).
        const sprite = this.add
            .image(x - largeur / 2 + hauteur * 0.6, y, perso.frames[0])
            .setDisplaySize(hauteur * 0.8, hauteur * 0.8);
        if (couleurSprite !== null) sprite.setAlpha(couleurSprite);

        // ⭐ FIX 08/08 (correction John) : nom + statut dans un MÊME
        // conteneur, alignés l'un À CÔTÉ de l'autre (nom à gauche, statut
        // à droite du bloc texte) — jamais superposés (règle UI John :
        // tout est empilé, jamais superposé). Si les deux textes ne
        // tiennent pas côte à côte, la police de l'état (puis du nom) est
        // réduite jusqu'à ce qu'ils ne se touchent plus.
        const texteX = x - largeur / 2 + hauteur * 1.3;
        const texteY = y;
        const texteW = largeur - hauteur * 1.3 - UI.u(this, 2);
        const gap = UI.u(this, 1);

        const nom = this.add
            .text(0, 0, perso.nom, {
                fontFamily: C.police.famille,
                fontSize: Math.round(UI.u(this, 4)) + "px",
                color: !debloque ? C.couleurs.texteDiscret : T.encre,
                align: "left"
            })
            .setOrigin(0, 0.5);

        // État : « Actif » (skin courant) / « Sélectionner » (débloqué non
        // actif) / « 🔒 Débloque-le en Boutique » (à débloquer — non
        // interactif, spec 709 révision 08/08).
        let etatTexte = "";
        if (!debloque) {
            etatTexte = C.textes.verrouille + " " + C.textes.aDebloquer;
            couleurEtat = C.couleurs.texteDiscret;
        } else if (estActif) {
            etatTexte = C.textes.actif;
            couleurEtat = T.rouge;
        } else {
            etatTexte = C.textes.selectionner;
            couleurEtat = T.encre;
        }
        const etat = this.add
            .text(0, 0, etatTexte, {
                fontFamily: C.police.famille,
                fontSize: Math.round(UI.u(this, 3.4)) + "px",
                color: couleurEtat,
                align: "right"
            })
            .setOrigin(1, 0.5);

        // Ajustement anti-chevauchement : l'état tient dans la moitié
        // droite du bloc, le nom dans ce qui reste à gauche.
        // Libellé COURT avant toute réduction de police (même règle que la
        // Boutique, FIX 09/08) : un mot court à taille normale se lit.
        if (!debloque && etat.width > texteW * 0.5) {
            etat.setText(C.textes.verrouille + " " + C.textes.aDebloquerCourt);
        }
        let fsEtat = 3.4;
        while (etat.width > texteW * 0.5 && fsEtat > 2.4) {
            fsEtat -= 0.2;
            etat.setFontSize(Math.round(UI.u(this, fsEtat)) + "px");
        }
        let fsNom = 4;
        while (nom.width > texteW - etat.width - gap && fsNom > 3) {
            fsNom -= 0.2;
            nom.setFontSize(Math.round(UI.u(this, fsNom)) + "px");
        }
        etat.setPosition(texteW, 0);

        const conteneur = this.add.container(texteX, texteY);
        conteneur.add([nom, etat]);

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
                hauteur * 0.42, Arcade.UI.couleur(C.couleurs.texteDiscret).valeur);
            this._lignes.push({ fond, sprite, conteneur, cadenas, zone });
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
        this._lignes.push({ fond, sprite, conteneur, zone });
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
