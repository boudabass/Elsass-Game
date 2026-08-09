/*
 * ShopScene — la Boutique de Similitude (spec 728 §5 — SIM-8).
 *
 * Vend UNIQUEMENT les 4 jokers (config.jokers), à l'unité, rachetables à
 * l'infini. Prix de départ dans config.js (boutique.prix) : Marteau 30 🪙,
 * Mélange 40 🪙, Sablier 60 🪙, Foudre 60 🪙 — John rééquilibrera après
 * test (spec 728 §10 : toutes les valeurs chiffrées vivent dans config.js).
 *
 * Une CARTE par joker : icône (emoji), nom, effet en une phrase (réutilise
 * textes.commentJokerEffet, spec 728 §3), prix, quantité déjà possédée,
 * bouton Acheter (LE composant partagé Arcade.UI.bouton — aucun bouton
 * redessiné à la main, spec 728 §7).
 *
 * ACHAT (spec 728 §5) : wallet déduit, inventaire incrémenté, save écrite
 * IMMÉDIATEMENT (Arcade.Save.saveLocal() + saveCloud()) — c'est une action
 * explicite du joueur, elle ne doit pas se perdre au rechargement (même
 * pattern que la Boutique Waggis, spec 709). JAMAIS d'achat qui échoue en
 * silence : si les pièces manquent, le bouton est ÉTEINT (grisé) et le clic
 * affiche « Pas assez de pièces ».
 *
 * Porte-monnaie affiché en PERMANENCE en haut de l'écran (pillule 🪙,
 * même pattern que le HUD du menu).
 *
 * ⭐ Décision John 08/08 (art. 704 Chantier B) : PAS d'icônes Retour /
 * Plein écran ici — elles ne sont visibles QUE sur le menu principal.
 * Scène propre à Similitude (spec 728 §10 : rien dans core/).
 *
 * 100 % clic/tap (article 409), mobile-first (Arcade.UI.u), mise en page
 * recalculée à chaque rotation (Arcade.UI.layout), transitions en fondu
 * (SimilitudeUI.aller), police Azimut, fond dégradé.
 */
class ShopScene extends Phaser.Scene {
    static KEY = "boutique";

    constructor() {
        super(ShopScene.KEY);
    }

    async create() {
        const C = window.SimilitudeConfig;
        const UI = Arcade.UI;
        this.C = C;
        this.enTransition = false;

        // Fond : dégradé (spec 728 §7).
        this.fond = this.add.graphics().setDepth(0);

        // Titre de l'écran (police Azimut + relief, pattern Waggis).
        const titre = this.add.text(0, 0, C.textes.boutique, {
            fontFamily: C.police.famille,
            color: "#ffffff",
            align: "center"
        })
            .setOrigin(0.5)
            .setDepth(20)
            .setStroke("#141210", 3)
            .setShadow(0, 3, "rgba(20, 18, 16, 0.3)", 3, false, true);

        // Porte-monnaie (spec 728 §5 : « affiché en permanence en haut de
        // l'écran ») — pillule translucide, même pattern que le HUD du menu.
        this.walletPillule = this.add.graphics().setDepth(10);
        this.wallet = this.add.text(0, 0, "", {
            fontFamily: C.police.famille,
            color: "#ffffff",
            align: "center"
        })
            .setOrigin(0.5)
            .setDepth(11)
            .setStroke("#141210", 3)
            .setShadow(0, 2, "rgba(20, 18, 16, 0.35)", 2, false, true);

        // Retour au menu (composant partagé Arcade.UI.bouton).
        const retour = Arcade.UI.bouton(this, {
            label: C.textes.retour,
            couleur: C.couleurs.boutonSecondaire,
            ombre: C.couleurs.ombreBouton,
            police: C.police.famille,
            onClick: () => SimilitudeUI.aller(this, MenuScene.KEY)
        });
        this.retour = retour;

        // --- Les 4 cartes jokers -------------------------------------------
        // Chaque carte = une ligne : icône emoji + nom + effet (empilés à
        // gauche), prix + quantité possédée (à droite), bouton Acheter
        // (à l'extrême droite). Objets recréés à chaque layout (pattern
        // ClassementScene — objets Phaser non réutilisés).
        this._lignes = [];

        UI.layout(this, (w, h) => {
            SimilitudeUI.ciel(this.fond, w, h);

            const u = (n) => UI.u(this, n);
            const espace = u(C.menu.espaceU);

            titre.setPosition(w / 2, h * 0.07)
                 .setFontSize(Math.round(u(9)) + "px");

            // Porte-monnaie sous le titre, centré (pillule translucide).
            this._majPorteMonnaie();

            // Retour ancré au sol (pattern CommentJouerScene / Classement).
            const hauteurRetour = u(9);
            const yRetour = h * 0.965 - hauteurRetour / 2;
            retour.redimensionner(u(40), hauteurRetour)
                  .setPosition(w / 2, yRetour);

            // Bande des cartes : du dessous du porte-monnaie au-dessus du
            // retour, répartie en 4 lignes égales (une par joker) — la
            // hauteur de ligne est recalculée à chaque rotation (pattern
            // tableau à hauteur variable du Classement).
            const hautBande = h * 0.20;
            const basBande = yRetour - hauteurRetour / 2 - espace;
            const hLigne = Math.max(u(8), (basBande - hautBande) / C.jokers.length);

            this._dessinerCartes(w, hautBande, hLigne, u);
        });

        // Transition d'arrivée : fondu depuis le noir (spec 728 §7).
        this.cameras.main.fadeIn(220, 0, 0, 0);
    }

    /** Porte-monnaie lu depuis le profil persistant (window.SimilitudeProfil). */
    _majPorteMonnaie() {
        const C = this.C;
        const UI = Arcade.UI;
        const profil = window.SimilitudeProfil && window.SimilitudeProfil.profil;
        const pieces = profil ? profil.wallet : 0;
        if (!this.wallet) return;
        this.wallet.setText(C.textes.porteMonnaie.replace("{pieces}", pieces));
        const y = this.scale.height * 0.14;
        this.wallet
            .setFontSize(Math.round(UI.u(this, 3.4)) + "px")
            .setStroke("#141210", Math.max(2, Math.round(UI.u(this, 0.5))))
            .setPosition(this.scale.width / 2, y);
        const pillW = this.wallet.width + UI.u(this, 6);
        const pillH = UI.u(this, 4.8);
        this.walletPillule.clear();
        this.walletPillule.fillStyle("rgba(255, 255, 255, 0.30)", 1);
        this.walletPillule.fillRoundedRect(
            this.scale.width / 2 - pillW / 2, y - pillH / 2, pillW, pillH, pillH / 2
        );
    }

    /**
     * (Re)dessine les 4 cartes jokers. Détruit les lignes de la passe
     * précédente (pattern ClassementScene — objets non réutilisés).
     */
    _dessinerCartes(w, y0, hLigne, u) {
        const C = this.C;
        this._lignes.forEach((l) => {
            l.ombre.destroy();
            l.fond.destroy();
            l.emoji.destroy();
            l.nom.destroy();
            l.effet.destroy();
            l.prix.destroy();
            l.possede.destroy();
            l.bouton.destroy();
        });
        this._lignes = [];

        const profil = window.SimilitudeProfil && window.SimilitudeProfil.profil;
        const largeur = u(72);
        const x = w / 2;

        C.jokers.forEach((j, i) => {
            const y = y0 + hLigne * (i + 0.5);
            const possede = profil ? (profil.inventaire[j.cle] || 0) : 0;
            const prix = (C.boutique && C.boutique.prix[j.cle]) || 0;
            this._creerCarte(j, possede, prix, x, y, largeur, hLigne, u);
        });
    }

    /** Crée la carte d'un joker (spec 728 §5 : icône, nom, effet, prix,
     * quantité possédée, bouton Acheter). */
    _creerCarte(j, possede, prix, x, y, largeur, hauteur, u) {
        const C = this.C;
        const UI = Arcade.UI;
        const profil = window.SimilitudeProfil && window.SimilitudeProfil.profil;
        const r = hauteur * 0.2;

        // Ombre portée sous la ligne (VALEUR NUMÉRIQUE — WebGL, QA NC1).
        const ombre = this.add.graphics().setDepth(2);
        ombre.fillStyle(C.couleurs.ombrePortee, 0.25);
        ombre.fillRoundedRect(x - largeur / 2, y - hauteur / 2 + hauteur * 0.05,
            largeur, hauteur, r);

        const fond = this.add.graphics().setDepth(3);
        fond.fillStyle(0x141210, 0.85);
        fond.fillRoundedRect(x - largeur / 2, y - hauteur / 2, largeur, hauteur, r);

        // Icône : l'emoji du joker (pas de texture dédiée, spec 728 §3).
        const emoji = this.add.text(0, 0, j.emoji, {
            fontFamily: C.police.famille,
            align: "center"
        })
            .setOrigin(0.5)
            .setDepth(4)
            .setPosition(x - largeur / 2 + u(5), y);

        // Nom (blanc, relief) + effet en une phrase (spec 728 §3).
        const nom = this.add.text(0, 0, j.nom, {
            fontFamily: C.police.famille,
            color: "#ffffff",
            align: "left"
        })
            .setOrigin(0, 0.5)
            .setDepth(4)
            .setStroke("#141210", 2)
            .setPosition(x - largeur / 2 + u(9), y - hauteur * 0.16);

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
            .setWordWrapWidth(u(34), true);

        // Prix + quantité déjà possédée (bloc droit, aligné à droite).
        const prixT = this.add.text(0, 0, C.textes.prixJoker.replace("{prix}", prix), {
            fontFamily: C.police.famille,
            color: C.couleurs.combo,
            align: "right"
        })
            .setOrigin(1, 0.5)
            .setDepth(4)
            .setPosition(x + largeur / 2 - u(21), y - hauteur * 0.16);

        const possedeT = this.add.text(0, 0, C.textes.possede.replace("{n}", possede), {
            fontFamily: C.police.famille,
            color: "#ffffff",
            align: "right"
        })
            .setOrigin(1, 0.5)
            .setDepth(4)
            .setPosition(x + largeur / 2 - u(21), y + hauteur * 0.14);

        // Bouton Acheter (composant partagé Arcade.UI.bouton — spec 728 §7).
        // ÉTEINT (grisé) si les pièces manquent : le clic affiche alors
        // « Pas assez de pièces » — jamais un achat qui échoue en silence
        // (spec 728 §5).
        const bouton = Arcade.UI.bouton(this, {
            label: C.textes.acheter,
            couleur: C.couleurs.boutonJouer,
            ombre: C.couleurs.ombreBouton,
            police: C.police.famille,
            onClick: () => this._acheter(j.cle)
        });
        const assez = profil && profil.wallet >= prix;
        bouton.redimensionner(u(17), u(6.5)).setPosition(x + largeur / 2 - u(10), y);
        if (!assez) bouton.setAlpha(0.4);   // bouton éteint (spec 728 §5)

        this._lignes.push({
            ombre, fond, emoji, nom,
            effet: effetT, prix: prixT, possede: possedeT, bouton
        });
    }

    /**
     * Achat d'un joker (spec 728 §5) : la LOGIQUE PURE (Profil.acheter)
     * vérifie les pièces et mute le profil ; si l'achat aboutit, la save
     * est écrite IMMÉDIATEMENT (local + cloud) et tout l'écran est
     * rafraîchi. Si les pièces manquent : message « Pas assez de pièces ».
     */
    _acheter(cle) {
        const C = this.C;
        const profil = window.SimilitudeProfil && window.SimilitudeProfil.profil;
        if (!profil) return;

        const res = Profil.acheter(profil, cle, C);
        if (!res.ok) {
            this._annoncer(C.textes.pasAssezPieces);
            return;
        }

        // Action explicite du joueur : save immédiate local + cloud
        // (spec 728 §2, §5 — jamais d'autosave en cours de partie).
        Arcade.Save.saveLocal();
        Arcade.Save.saveCloud();

        this._annoncer(C.textes.achete);
        this._majPorteMonnaie();
        this._redessiner();
    }

    /** Redessine les cartes (quantités, états des boutons) après un achat. */
    _redessiner() {
        const UI = Arcade.UI;
        const u = (n) => UI.u(this, n);
        const w = this.scale.width;
        const h = this.scale.height;
        const C = this.C;
        const espace = u(C.menu.espaceU);
        const hauteurRetour = u(9);
        const yRetour = h * 0.965 - hauteurRetour / 2;
        const hautBande = h * 0.20;
        const basBande = yRetour - hauteurRetour / 2 - espace;
        const hLigne = Math.max(u(8), (basBande - hautBande) / C.jokers.length);
        this._dessinerCartes(w, hautBande, hLigne, u);
    }

    /** Petite annonce temporaire (pattern MenuScene._annoncer). */
    _annoncer(texte) {
        const C = this.C;
        const t = this.add.text(0, 0, texte, {
            fontFamily: C.police.famille,
            color: "#ffffff",
            align: "center"
        })
            .setOrigin(0.5)
            .setDepth(100)
            .setStroke("#141210", 3)
            .setShadow(0, 3, "rgba(20, 18, 16, 0.3)", 3, false, true)
            .setPosition(this.scale.width / 2, this.scale.height * 0.5)
            .setFontSize(Math.round(Arcade.UI.u(this, 5)) + "px")
            .setAlpha(0);
        this.tweens.add({
            targets: t, alpha: 1, duration: 150, yoyo: true, hold: 900,
            onComplete: () => t.destroy()
        });
    }
}
