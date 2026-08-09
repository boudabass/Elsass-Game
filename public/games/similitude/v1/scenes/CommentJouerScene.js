/*
 * CommentJouerScene — l'écran « Comment jouer » de Similitude (spec 728 §7).
 *
 * ⭐ SIM-7 (spec 728 §7) : « Comment jouer = un écran de règles court et
 * illustré (la boucle en 3 images, les 3 causes de fin, les 4 jokers). Un
 * puzzle sans notice se fait abandonner en 20 secondes. »
 *
 * Contenu (tout vient de config.js — rien en dur, spec §10) :
 *  - LA BOUCLE EN 3 GESTES (spec 473 §2/§3) : 3 cartes illustrées d'un
 *    emoji chiffré — sélectionner un item, le déplacer sur une case vide,
 *    aligner 3 identiques ou plus ;
 *  - LES 3 CAUSES DE FIN (spec 473 §6) : temps écoulé, plus d'énergie,
 *    grille pleine (textes.finChrono / finEnergie / finGrillePleine) ;
 *  - LES 4 JOKERS (spec 728 §3) : une carte par joker (emoji + nom +
 *    effet en une phrase, valeurs de config.effetsJokers).
 *
 * MISE EN PAGE ADAPTATIVE (règle John : tout est empilé, jamais superposé ;
 * même pattern que le tableau à hauteur variable du Classement) : le titre
 * en haut, le bouton Retour ancré au sol, et la BANDE entre les deux
 * répartie en 3 blocs égaux (boucle / causes de fin / jokers) — la hauteur
 * des cartes est recalculée à chaque rotation pour occuper TOUTE la bande
 * sans jamais déborder sur le Retour.
 *
 * Visuel façon Waggis : dégradé de fond, cartes à coins arrondis + ombre
 * portée, police Azimut, transitions en fondu (SimilitudeUI.aller).
 * TOUS les boutons (ici : Retour) utilisent LE composant partagé
 * Arcade.UI.bouton — aucun bouton redessiné à la main (spec 728 §7).
 *
 * ⭐ Décision John 08/08 (art. 704 Chantier B) : PAS d'icônes Retour /
 * Plein écran ici — elles ne sont visibles QUE sur le menu principal.
 *
 * 100 % clic/tap (article 409), mobile-first (Arcade.UI.u), mise en page
 * recalculée à chaque rotation (Arcade.UI.layout).
 */
class CommentJouerScene extends Phaser.Scene {
    static KEY = "commentJouer";

    constructor() {
        super(CommentJouerScene.KEY);
    }

    async create() {
        const C = window.SimilitudeConfig;
        const UI = Arcade.UI;
        this.enTransition = false;

        // Fond : dégradé (spec 728 §7).
        this.fond = this.add.graphics().setDepth(0);

        // Titre (police Azimut + relief, pattern Waggis).
        const titre = this.add.text(0, 0, C.textes.commentJouer, {
            fontFamily: C.police.famille,
            color: "#ffffff",
            align: "center"
        })
            .setOrigin(0.5)
            .setDepth(20)
            .setStroke("#141210", 3)
            .setShadow(0, 3, "rgba(20, 18, 16, 0.3)", 3, false, true);

        // --- Sections (titres) ---------------------------------------------
        this.titreBoucle = this._titreSection(C.textes.commentTitreBoucle);
        this.titreFin = this._titreSection(C.textes.commentTitreFin);
        const titreJokers = this._titreSection(C.textes.commentTitreJokers);
        const introJokers = this._texte(C.textes.commentJokersIntro, 2.8);

        // --- La boucle en 3 gestes : 3 cartes (emoji + libellé) ------------
        // spec 728 §7 : « la boucle en 3 images » — une carte illustrée par
        // geste, emoji chiffré (config commentBoucleEmojis) + libellé court
        // (config commentBoucle, spec 473 §2/§3).
        this.boucle = [];
        for (let i = 0; i < 3; i++) {
            this.boucle.push({
                emoji: this._texte(C.textes.commentBoucleEmojis[i], 4.5),
                label: this._texte(C.textes.commentBoucle[i], 2.9),
                ombre: this.add.graphics().setDepth(2),
                fond: this.add.graphics().setDepth(3)
            });
        }

        // --- Les 3 causes de fin : 3 cartes (emoji + libellé) --------------
        // spec 473 §6 : finChrono / finEnergie / finGrillePleine.
        this.fins = [];
        const clesFin = ["finChrono", "finEnergie", "finGrillePleine"];
        for (let i = 0; i < 3; i++) {
            this.fins.push({
                emoji: this._texte(C.textes.commentFinEmojis[i], 4.5),
                label: this._texte(C.textes[clesFin[i]], 2.9),
                ombre: this.add.graphics().setDepth(2),
                fond: this.add.graphics().setDepth(3)
            });
        }

        // --- Les 4 jokers : 4 cartes (emoji + nom + effet) -----------------
        // spec 728 §3 : emoji + nom (config jokers), effet en une phrase
        // (config commentJokerEffet — valeurs de effetsJokers, rien en dur).
        this.jokers = [];
        C.jokers.forEach((j) => {
            const e = C.effetsJokers;
            const effet = C.textes.commentJokerEffet[j.cle]
                .replace("{s}", e.sablierSecondes)
                .replace("{e}", e.foudreEnergie);
            this.jokers.push({
                emoji: this._texte(j.emoji, 4.5),
                nom: this._texte(j.nom, 2.9),
                effet: this._texte(effet, 2.4),
                ombre: this.add.graphics().setDepth(2),
                fond: this.add.graphics().setDepth(3)
            });
        });

        // --- Retour au menu (composant partagé Arcade.UI.bouton) ----------
        const retour = Arcade.UI.bouton(this, {
            label: C.textes.retour,
            couleur: C.couleurs.boutonSecondaire,
            ombre: C.couleurs.ombreBouton,
            police: C.police.famille,
            onClick: () => SimilitudeUI.aller(this, MenuScene.KEY)
        });

        UI.layout(this, (w, h) => {
            SimilitudeUI.ciel(this.fond, w, h);

            const u = (n) => UI.u(this, n);
            const espace = u(C.menu.espaceU);

            titre.setPosition(w / 2, h * 0.06)
                 .setFontSize(Math.round(u(8.5)) + "px");

            // --- Retour, ancré en bas (sol) --------------------------------
            const hauteurRetour = u(9);
            const yRetour = h * 0.965 - hauteurRetour / 2;
            retour.redimensionner(u(40), hauteurRetour)
                  .setPosition(w / 2, yRetour);

            // --- Bande de contenu : du dessous du titre au-dessus du ------
            // Retour, répartie en 3 blocs égaux (boucle / fins / jokers) —
            // chaque bloc occupe TOUTE sa hauteur (pattern tableau à
            // hauteur variable du Classement) : rien ne déborde jamais sur
            // le Retour (règle John : empilé, jamais superposé).
            const hautBande = h * 0.12;
            const basBande = yRetour - hauteurRetour / 2 - espace;
            const blocH = Math.max(u(6), (basBande - hautBande) / 3);

            this._placerBlocBoucle(w, hautBande, blocH, u);
            this._placerBlocFins(w, hautBande + blocH, blocH, u);
            this._placerBlocJokers(w, hautBande + 2 * blocH, blocH, u,
                titreJokers, introJokers);
        });

        // Transition d'arrivée : fondu depuis le noir (spec 728 §7).
        this.cameras.main.fadeIn(220, 0, 0, 0);
    }

    // --- Blocs (mise en page adaptative) -------------------------------------

    /** Bloc « La boucle en 3 gestes » : titre + 3 cartes empilées. */
    _placerBlocBoucle(w, y0, blocH, u) {
        const C = window.SimilitudeConfig;
        const tailleTitre = u(3.2);
        this.titreBoucle
            .setPosition(w / 2, y0 + tailleTitre / 2)
            .setFontSize(Math.round(tailleTitre) + "px");
        const hCarte = Math.max(u(4.5), (blocH - tailleTitre - u(1)) / 3);
        const lcarte = u(30);
        for (let i = 0; i < 3; i++) {
            const y = y0 + tailleTitre + u(1) + hCarte * (i + 0.5);
            this._dessinerCarte(this.boucle[i], w / 2, y, lcarte, hCarte);
            this.boucle[i].emoji
                .setFontSize(Math.round(u(4)) + "px")
                .setPosition(w / 2 - lcarte / 2 + u(4), y);
            this.boucle[i].label
                .setFontSize(Math.round(u(2.7)) + "px")
                .setPosition(w / 2 + u(2), y)
                .setWordWrapWidth(lcarte - u(10), true);
        }
    }

    /** Bloc « La partie se termine quand… » : titre + 3 cartes empilées. */
    _placerBlocFins(w, y0, blocH, u) {
        const C = window.SimilitudeConfig;
        const tailleTitre = u(3.2);
        this.titreFin
            .setPosition(w / 2, y0 + tailleTitre / 2)
            .setFontSize(Math.round(tailleTitre) + "px");
        const hCarte = Math.max(u(4.5), (blocH - tailleTitre - u(1)) / 3);
        const lcarte = u(30);
        for (let i = 0; i < 3; i++) {
            const y = y0 + tailleTitre + u(1) + hCarte * (i + 0.5);
            this._dessinerCarte(this.fins[i], w / 2, y, lcarte, hCarte);
            this.fins[i].emoji
                .setFontSize(Math.round(u(4)) + "px")
                .setPosition(w / 2 - lcarte / 2 + u(4), y);
            this.fins[i].label
                .setFontSize(Math.round(u(2.7)) + "px")
                .setPosition(w / 2 + u(2), y)
                .setWordWrapWidth(lcarte - u(10), true);
        }
    }

    /** Bloc « Les 4 jokers » : titre + intro + grille 2×2. */
    _placerBlocJokers(w, y0, blocH, u, titreJokers, introJokers) {
        const C = window.SimilitudeConfig;
        const espace = u(C.menu.espaceU);
        const tailleTitre = u(3.2);
        titreJokers
            .setPosition(w / 2, y0 + tailleTitre / 2)
            .setFontSize(Math.round(tailleTitre) + "px");
        // Intro + grille 2×2 dans le reste du bloc : l'intro prend une
        // ligne (u(2.8)), la grille occupe tout le reste.
        const yIntro = y0 + tailleTitre + u(0.8);
        introJokers
            .setFontSize(Math.round(u(2.5)) + "px")
            .setPosition(w / 2, yIntro)
            .setWordWrapWidth(w * 0.82, true)
            .setAlign("center");
        const hJoker = Math.max(u(4.5),
            (blocH - tailleTitre - u(0.8) - u(3.4)) / 2 - espace * 0.6);
        const lJoker = u(31);
        const x0 = w / 2 - lJoker / 2 - espace / 2;
        const x1 = w / 2 + espace / 2;
        const y0c = yIntro + u(1.7) + hJoker / 2;
        const y1c = y0c + hJoker + espace * 0.6;
        this.jokers.forEach((j, i) => {
            const x = i % 2 === 0 ? x0 : x1;
            const y = i < 2 ? y0c : y1c;
            this._dessinerCarte(j, x, y, lJoker, hJoker);
            j.emoji
                .setFontSize(Math.round(u(4.2)) + "px")
                .setPosition(x - lJoker / 2 + u(4.5), y);
            j.nom
                .setFontSize(Math.round(u(2.6)) + "px")
                .setPosition(x + u(1), y - hJoker * 0.16)
                .setWordWrapWidth(lJoker - u(12), true);
            j.effet
                .setFontSize(Math.round(u(2.2)) + "px")
                .setPosition(x + u(1), y + hJoker * 0.18)
                .setWordWrapWidth(lJoker - u(12), true);
        });
    }

    /** Titre de section (texte blanc avec relief, police Azimut). */
    _titreSection(texte) {
        const C = window.SimilitudeConfig;
        return this.add.text(0, 0, texte, {
            fontFamily: C.police.famille,
            color: "#ffffff",
            align: "center"
        })
            .setOrigin(0.5)
            .setDepth(20)
            .setStroke("#141210", 2)
            .setShadow(0, 2, "rgba(20, 18, 16, 0.3)", 2, false, true);
    }

    /** Texte simple (police Azimut, blanc, contour). */
    _texte(contenu, tailleU) {
        const C = window.SimilitudeConfig;
        return this.add.text(0, 0, contenu, {
            fontFamily: C.police.famille,
            color: "#ffffff",
            align: "left"
        })
            .setOrigin(0, 0.5)
            .setDepth(20)
            .setStroke("#141210", Math.max(1.5, Math.round(Arcade.UI.u(this, tailleU) * 0.08)));
    }

    /**
     * Carte : ombre portée + fond arrondi (même langage visuel que les
     * lignes du classement et les cartes Waggis). Valeurs NUMÉRIQUES pour
     * les Graphics (renderer WebGL — QA 08/08 NC1).
     */
    _dessinerCarte(carte, x, y, l, h) {
        const C = window.SimilitudeConfig;
        const r = h * 0.25;
        carte.ombre.clear();
        carte.ombre.fillStyle(C.couleurs.ombrePortee, 0.25);
        carte.ombre.fillRoundedRect(x - l / 2, y - h / 2 + h * 0.05, l, h, r);
        carte.fond.clear();
        carte.fond.fillStyle(0x141210, 0.85);
        carte.fond.fillRoundedRect(x - l / 2, y - h / 2, l, h, r);
    }
}
