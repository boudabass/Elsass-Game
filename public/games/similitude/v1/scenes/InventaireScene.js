/*
 * InventaireScene — l'Inventaire de Similitude (spec 728 §6 — SIM-8).
 *
 * La liste des 4 jokers (config.jokers) avec la quantité possédée et le
 * rappel de l'effet (textes.commentJokerEffet, spec 728 §3). C'est un
 * écran de CONSULTATION uniquement : les jokers s'utilisent EN PARTIE
 * (SIM-6, barre de jokers de GameScene) — rien ne s'utilise ici.
 *
 * Une LIGNE par joker, en TROIS COLONNES — MÊME mise en page que la
 * Boutique (GATE John 09/08) : à GAUCHE l'icône au-dessus de la quantité
 * possédée, au MILIEU le nom au-dessus de la description, à DROITE le
 * renvoi vers la Boutique.
 *
 * Un joker à 0 reste VISIBLE, GRISÉ (alpha réduit sur toute la carte),
 * avec un renvoi cliquable « 🛒 Achète-le / en Boutique » (2 lignes) qui
 * ouvre ShopScene (même esprit que le « 🔒 Débloque-le en Boutique » de
 * Waggis, spec 709). Le renvoi est un VRAI bouton (LE composant partagé
 * Arcade.UI.bouton — aucun bouton redessiné à la main, spec 728 §7).
 *
 * ⭐ Décision John 08/08 (art. 704 Chantier B) : PAS d'icônes Retour /
 * Plein écran ici — elles ne sont visibles QUE sur le menu principal.
 * Scène propre à Similitude (spec 728 §10 : rien dans core/).
 *
 * 100 % clic/tap (article 409), mobile-first (Arcade.UI.u), mise en page
 * recalculée à chaque rotation (Arcade.UI.layout), transitions en fondu
 * (SimilitudeUI.aller), police Azimut, fond dégradé.
 */
class InventaireScene extends Phaser.Scene {
    static KEY = "inventaire";

    constructor() {
        super(InventaireScene.KEY);
    }

    async create() {
        const C = window.SimilitudeConfig;
        const UI = Arcade.UI;
        this.C = C;
        this.enTransition = false;

        // Fond : dégradé (spec 728 §7).
        this.fond = this.add.graphics().setDepth(0);

        // Titre de l'écran (police Azimut + relief, pattern Waggis).
        const titre = this.add.text(0, 0, C.textes.inventaire, {
            fontFamily: C.police.famille,
            color: "#ffffff",
            align: "center"
        })
            .setOrigin(0.5)
            .setDepth(20)
            .setStroke("#141210", 3)
            .setShadow(0, 3, "rgba(20, 18, 16, 0.3)", 3, false, true);

        // Retour au menu (composant partagé Arcade.UI.bouton).
        const retour = Arcade.UI.bouton(this, {
            label: C.textes.retour,
            couleur: C.couleurs.boutonSecondaire,
            ombre: C.couleurs.ombreBouton,
            police: C.police.famille,
            onClick: () => SimilitudeUI.aller(this, MenuScene.KEY)
        });

        // --- Les 4 lignes jokers -------------------------------------------
        this._lignes = [];

        UI.layout(this, (w, h) => {
            SimilitudeUI.ciel(this.fond, w, h);

            const u = (n) => UI.u(this, n);
            const espace = u(C.menu.espaceU);

            titre.setPosition(w / 2, h * 0.07)
                 .setFontSize(Math.round(u(9)) + "px");

            // Retour ancré au sol (pattern CommentJouerScene / Classement).
            const hauteurRetour = u(9);
            const yRetour = h * 0.965 - hauteurRetour / 2;
            retour.redimensionner(u(40), hauteurRetour)
                  .setPosition(w / 2, yRetour);

            // Bande des lignes : du dessous du titre au-dessus du retour,
            // répartie en 4 lignes égales (une par joker) — la hauteur de
            // ligne est recalculée à chaque rotation (pattern tableau à
            // hauteur variable du Classement) : rien ne déborde.
            const hautBande = h * 0.13;
            const basBande = yRetour - hauteurRetour / 2 - espace;
            const hLigne = Math.max(u(8), (basBande - hautBande) / C.jokers.length);

            this._dessinerLignes(w, hautBande, hLigne, u);
        });

        // Transition d'arrivée : fondu depuis le noir (spec 728 §7).
        this.cameras.main.fadeIn(220, 0, 0, 0);
    }

    /**
     * (Re)dessine les 4 lignes jokers. Détruit les lignes de la passe
     * précédente (pattern ClassementScene — objets non réutilisés).
     */
    _dessinerLignes(w, y0, hLigne, u) {
        const C = this.C;
        this._lignes.forEach((l) => {
            l.ombre.destroy();
            l.fond.destroy();
            l.emoji.destroy();
            l.nom.destroy();
            l.effet.destroy();
            l.quantite.destroy();
            if (l.renvoi) l.renvoi.destroy();
        });
        this._lignes = [];

        const profil = window.SimilitudeProfil && window.SimilitudeProfil.profil;
        // ⭐ FIX GATE John 09/08 : largeur calculée sur la LARGEUR RÉELLE de
        // l'écran (w) et non sur u() (le plus petit côté), sinon les 3
        // colonnes se chevauchaient. Carte un peu plus basse que son pas
        // vertical : les lignes ne se touchent plus.
        const largeur = (w * C.inventaire.largeurLignePct) / 100;
        const hCarte = Math.max(u(6), hLigne - u(C.inventaire.espaceLigneU));
        const x = w / 2;

        C.jokers.forEach((j, i) => {
            const y = y0 + hLigne * (i + 0.5);
            const possede = profil ? (profil.inventaire[j.cle] || 0) : 0;
            this._creerLigne(j, possede, x, y, largeur, hCarte, u);
        });
    }

    /**
     * Crée la ligne d'un joker (spec 728 §6 — mise en page GATE John 09/08,
     * MÊMES 3 COLONNES que la Boutique) :
     *
     *   [ 🔨      ] [ Marteau         ] [ 🛒 Achète-le ]
     *   [ ×0      ] [ Supprime 1 item ] [  en Boutique ]
     *     colonne 1        colonne 2         colonne 3
     *
     * La colonne 3 n'existe QUE si la quantité est à zéro (la ligne est
     * alors grisée) — sinon le joker est simplement possédé.
     */
    _creerLigne(j, possede, x, y, largeur, hauteur, u) {
        const C = this.C;
        const inv = C.inventaire;
        const zero = possede <= 0;
        const r = hauteur * 0.2;

        // --- Géométrie des 3 colonnes -------------------------------------
        const marge = u(inv.margeLigneU);
        const espaceCol = u(inv.espaceColonneU);
        const lGauche = u(inv.colGaucheU);
        const lBouton = u(inv.colBoutonU);
        const gauche = x - largeur / 2;
        const droite = x + largeur / 2;
        const xGauche = gauche + marge + lGauche / 2;        // centre col. 1
        const xMilieu = gauche + marge + lGauche + espaceCol; // bord g. col. 2
        const xBouton = droite - marge - lBouton / 2;         // centre col. 3
        // Sans bouton (joker possédé), la colonne 2 récupère toute la place.
        const borneDroite = zero ? xBouton - lBouton / 2 - espaceCol
                                 : droite - marge;
        const wrapMilieu = Math.max(u(10), borneDroite - xMilieu);

        // Ombre portée sous la ligne (VALEUR NUMÉRIQUE — WebGL, QA NC1).
        const ombre = this.add.graphics().setDepth(2);
        ombre.fillStyle(C.couleurs.ombrePortee, 0.25);
        ombre.fillRoundedRect(x - largeur / 2, y - hauteur / 2 + hauteur * 0.05,
            largeur, hauteur, r);

        const fond = this.add.graphics().setDepth(3);
        fond.fillStyle(0x141210, zero ? 0.45 : 0.85);
        fond.fillRoundedRect(x - largeur / 2, y - hauteur / 2, largeur, hauteur, r);

        // --- Colonne 1 (gauche) : icône AU-DESSUS de la quantité ----------
        const emoji = this.add.text(0, 0, j.emoji, {
            fontFamily: C.police.famille,
            align: "center"
        })
            .setOrigin(0.5)
            .setDepth(4)
            .setFontSize(Math.round(u(inv.tailleIconeU)) + "px")
            .setPosition(xGauche, y - hauteur * 0.18)
            .setAlpha(zero ? 0.35 : 1);

        const quantite = this.add.text(0, 0,
            C.textes.quantite.replace("{n}", possede), {
                fontFamily: C.police.famille,
                color: zero ? "#8a8a8a" : C.couleurs.combo,
                align: "center"
            })
            .setOrigin(0.5)
            .setDepth(4)
            .setStroke("#141210", 2)
            .setFontSize(Math.round(u(inv.tailleQuantiteU)) + "px")
            .setPosition(xGauche, y + hauteur * 0.24);

        // --- Colonne 2 (milieu) : nom AU-DESSUS de la description ---------
        const nom = this.add.text(0, 0, j.nom, {
            fontFamily: C.police.famille,
            color: "#ffffff",
            align: "left"
        })
            .setOrigin(0, 0.5)
            .setDepth(4)
            .setStroke("#141210", 2)
            .setFontSize(Math.round(u(inv.tailleNomU)) + "px")
            .setPosition(xMilieu, y - hauteur * 0.18)
            .setWordWrapWidth(wrapMilieu, true)
            .setAlpha(zero ? 0.35 : 1);

        const e = C.effetsJokers;
        const effet = C.textes.commentJokerEffet[j.cle]
            .replace("{s}", e.sablierSecondes)
            .replace("{e}", e.foudreEnergie);
        const effetT = this.add.text(0, 0, effet, {
            fontFamily: C.police.famille,
            color: "#c9c2b4",
            align: "left"
        })
            .setOrigin(0, 0.5)
            .setDepth(4)
            .setFontSize(Math.round(u(inv.tailleEffetU)) + "px")
            .setPosition(xMilieu, y + hauteur * 0.22)
            .setWordWrapWidth(wrapMilieu, true)
            .setAlpha(zero ? 0.35 : 1);
        // Anti-débordement : le texte se réduit plutôt que de sortir de sa
        // colonne (plancher config.inventaire.policeMinU).
        this._ajusterTexte(nom, hauteur * 0.42, u);
        this._ajusterTexte(effetT, hauteur * 0.42, u);

        // --- Colonne 3 (droite) : renvoi Boutique, sur 2 lignes -----------
        // Seulement si la quantité est à zéro (spec 728 §6 : « 🛒 Achète-le
        // en Boutique », même esprit que le 🔒 de Waggis spec 709). VRAI
        // bouton cliquable → ShopScene, à 2 lignes (option `ligneHaut` du
        // composant partagé) : le libellé ne déborde plus de sa colonne.
        let renvoi = null;
        if (zero) {
            renvoi = Arcade.UI.bouton(this, {
                ligneHaut: C.textes.renvoiBoutiqueHaut,
                label: C.textes.renvoiBoutiqueBas,
                couleur: C.couleurs.boutonJouer,
                ombre: C.couleurs.ombreBouton,
                police: C.police.famille,
                onClick: () => SimilitudeUI.aller(this, ShopScene.KEY)
            });
            renvoi
                .redimensionner(lBouton, hauteur * inv.hauteurBoutonPct / 100)
                .setPosition(xBouton, y);
            // Filet de sécurité : si le libellé est trop large pour la
            // colonne (police système différente), il rétrécit.
            this._ajusterLargeur(renvoi.label, lBouton - u(2), u);
        }

        this._lignes.push({
            ombre, fond, emoji, nom, effet: effetT, quantite, renvoi
        });
    }

    /**
     * Anti-débordement VERTICAL (pattern ShopScene / CommentJouerScene) :
     * si le texte wrapé dépasse la hauteur allouée dans sa colonne, la
     * police est réduite jusqu'au plancher config.inventaire.policeMinU.
     */
    _ajusterTexte(texte, hauteurMax, u) {
        const plancher = u(this.C.inventaire.policeMinU);
        let fs = parseFloat(texte.style.fontSize);
        while (texte.height > hauteurMax && fs > plancher) {
            fs -= 0.5;
            texte.setFontSize(Math.round(fs) + "px");
        }
    }

    /** Idem, en LARGEUR (libellé d'un bouton dans une colonne étroite). */
    _ajusterLargeur(texte, largeurMax, u) {
        const plancher = u(this.C.inventaire.policeMinU);
        let fs = parseFloat(texte.style.fontSize);
        while (texte.width > largeurMax && fs > plancher) {
            fs -= 0.5;
            texte.setFontSize(Math.round(fs) + "px");
        }
    }
}
