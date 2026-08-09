/*
 * InventaireScene — l'Inventaire de Similitude (spec 728 §6 — SIM-8).
 *
 * La liste des 4 jokers (config.jokers) avec la quantité possédée et le
 * rappel de l'effet (textes.commentJokerEffet, spec 728 §3). C'est un
 * écran de CONSULTATION uniquement : les jokers s'utilisent EN PARTIE
 * (SIM-6, barre de jokers de GameScene) — rien ne s'utilise ici.
 *
 * Un joker à 0 reste VISIBLE, GRISÉ (alpha réduit sur toute la carte),
 * avec un renvoi cliquable « 🛒 Achète-le en Boutique » qui ouvre
 * ShopScene (même esprit que le « 🔒 Débloque-le en Boutique » de Waggis,
 * spec 709). Le renvoi est un VRAI bouton (LE composant partagé
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
        const largeur = u(72);
        const x = w / 2;

        C.jokers.forEach((j, i) => {
            const y = y0 + hLigne * (i + 0.5);
            const possede = profil ? (profil.inventaire[j.cle] || 0) : 0;
            this._creerLigne(j, possede, x, y, largeur, hLigne, u);
        });
    }

    /** Crée la ligne d'un joker (spec 728 §6 : quantité + rappel de
     * l'effet ; à zéro : grisé + renvoi vers la Boutique). */
    _creerLigne(j, possede, x, y, largeur, hauteur, u) {
        const C = this.C;
        const UI = Arcade.UI;
        const zero = possede <= 0;
        const r = hauteur * 0.2;

        // Ombre portée sous la ligne (VALEUR NUMÉRIQUE — WebGL, QA NC1).
        const ombre = this.add.graphics().setDepth(2);
        ombre.fillStyle(C.couleurs.ombrePortee, 0.25);
        ombre.fillRoundedRect(x - largeur / 2, y - hauteur / 2 + hauteur * 0.05,
            largeur, hauteur, r);

        const fond = this.add.graphics().setDepth(3);
        fond.fillStyle(0x141210, zero ? 0.45 : 0.85);
        fond.fillRoundedRect(x - largeur / 2, y - hauteur / 2, largeur, hauteur, r);

        // Icône emoji (grisée si quantité 0).
        const emoji = this.add.text(0, 0, j.emoji, {
            fontFamily: C.police.famille,
            align: "center"
        })
            .setOrigin(0.5)
            .setDepth(4)
            .setPosition(x - largeur / 2 + u(5), y)
            .setAlpha(zero ? 0.35 : 1);

        // Nom + effet en une phrase (rappel, spec 728 §6) — grisés si 0.
        const nom = this.add.text(0, 0, j.nom, {
            fontFamily: C.police.famille,
            color: "#ffffff",
            align: "left"
        })
            .setOrigin(0, 0.5)
            .setDepth(4)
            .setStroke("#141210", 2)
            .setPosition(x - largeur / 2 + u(9), y - hauteur * 0.16)
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
            .setPosition(x - largeur / 2 + u(9), y + hauteur * 0.14)
            .setWordWrapWidth(u(34), true)
            .setAlpha(zero ? 0.35 : 1);

        // Quantité possédée (droite) — « × N ».
        const quantite = this.add.text(0, 0, C.textes.quantite.replace("{n}", possede), {
            fontFamily: C.police.famille,
            color: zero ? "#8a8a8a" : C.couleurs.combo,
            align: "right"
        })
            .setOrigin(1, 0.5)
            .setDepth(4)
            .setPosition(x + largeur / 2 - u(3), y);

        // Renvoi vers la Boutique si quantité 0 (spec 728 §6 : « 🛒
        // Achète-le en Boutique », même esprit que le 🔒 de Waggis spec
        // 709). VRAI bouton cliquable → ShopScene. Ajustement anti-
        // débordement (pattern Waggis) : la largeur est élargie jusqu'à
        // ce que le libellé tienne, puis la police du libellé est réduite
        // si nécessaire (jamais de débordement, mobile-first).
        let renvoi = null;
        if (zero) {
            renvoi = Arcade.UI.bouton(this, {
                label: C.textes.renvoiBoutique,
                couleur: C.couleurs.boutonJouer,
                ombre: C.couleurs.ombreBouton,
                police: C.police.famille,
                onClick: () => SimilitudeUI.aller(this, ShopScene.KEY)
            });
            const hauteurBouton = hauteur * 0.42;
            let largeurBouton = u(17);
            renvoi.redimensionner(largeurBouton, hauteurBouton);
            while (renvoi.label.width > largeurBouton - u(2) &&
                   largeurBouton < u(40)) {
                largeurBouton += u(1);
                renvoi.redimensionner(largeurBouton, hauteurBouton);
            }
            // Si le libellé ne tient toujours pas à largeur max : police
            // réduite progressivement (recalculée à chaque rotation, le
            // layout recrée les lignes).
            let fs = hauteurBouton * 0.4;   // police initiale du composant
            while (renvoi.label.width > largeurBouton - u(2) && fs > u(1.6)) {
                fs -= 1;
                renvoi.label.setFontSize(Math.round(fs) + "px");
            }
            renvoi.setPosition(x + largeur / 2 - u(3) - largeurBouton / 2, y);
        }

        this._lignes.push({
            ombre, fond, emoji, nom, effet: effetT, quantite, renvoi
        });
    }
}
