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
            const cj = C.commentJouer;

            titre.setPosition(w / 2, h * cj.titreY)
                 .setFontSize(Math.round(u(cj.titreTailleU)) + "px");

            // --- Retour, ancré en bas (sol) --------------------------------
            const hauteurRetour = u(cj.retourHauteurU);
            const yRetour = h * cj.solY - hauteurRetour / 2;
            retour.redimensionner(u(cj.retourLargeurU), hauteurRetour)
                  .setPosition(w / 2, yRetour);

            // --- Bande de contenu : du dessous du titre au-dessus du ------
            // Retour, répartie en 3 blocs égaux (boucle / fins / jokers) —
            // chaque bloc occupe TOUTE sa hauteur (pattern tableau à
            // hauteur variable du Classement) : rien ne déborde jamais sur
            // le Retour (règle John : empilé, jamais superposé).
            const hautBande = h * cj.bandeHautY;
            const basBande = yRetour - hauteurRetour / 2 - espace;
            const blocH = Math.max(u(cj.blocMinU), (basBande - hautBande) / 3);

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
        const cj = C.commentJouer;
        const tailleTitre = this._placerTitreSection(this.titreBoucle, w, y0, u);
        // ⭐ FIX SIM-FIX-CJ (GATE John 09/08) : la largeur des cartes se
        // calcule depuis la LARGEUR RÉELLEMENT DISPONIBLE de l'écran (w),
        // plus jamais depuis u() (le plus petit côté) — sur mobile une
        // carte u(30) ne faisait que ~30 % de l'écran et le texte wrapé
        // débordait par-dessus les cartes voisines.
        const lcarte = (w * cj.largeurCartePct) / 100;
        const marge = u(cj.margeCarteU);
        const zoneEmoji = u(cj.tailleEmojiU);
        // Largeur RÉSERVÉE à l'emoji : un emoji est rendu plus large que sa
        // taille de police (SIM-FIX-CJ2) — sans ce facteur le libellé venait
        // se coller à l'emoji.
        const largeEmoji = zoneEmoji * cj.largeurEmojiFacteur;
        const espaceCarte = u(cj.espaceCartesU);
        // 3 cartes empilées + 2 espacements entre elles + 1 espacement avant
        // et 1 après : le bloc ne déborde JAMAIS sur le titre suivant.
        const hCarte = Math.max(u(cj.hauteurCarteMinU),
            (blocH - tailleTitre - 4 * espaceCarte) / 3);
        for (let i = 0; i < 3; i++) {
            const y = y0 + tailleTitre + espaceCarte +
                i * (hCarte + espaceCarte) + hCarte / 2;
            this._dessinerCarte(this.boucle[i], w / 2, y, lcarte, hCarte);
            // Emoji à gauche DANS la carte (jamais hors conteneur).
            this.boucle[i].emoji
                .setFontSize(Math.round(zoneEmoji) + "px")
                .setPosition(w / 2 - lcarte / 2 + marge, y);
            // Libellé à droite de l'emoji, wrap DANS la largeur restante
            // du conteneur (le texte ne déborde plus sur les autres
            // éléments — GATE John 09/08).
            const xLabel = w / 2 - lcarte / 2 + marge + largeEmoji +
                u(cj.espaceEmojiLabelU);
            this.boucle[i].label
                .setFontSize(Math.round(u(cj.tailleLabelU)) + "px")
                .setPosition(xLabel, y)
                .setWordWrapWidth(
                    lcarte - 2 * marge - largeEmoji - u(cj.espaceEmojiLabelU),
                    true);
            this._ajusterTexte(this.boucle[i].label, hCarte, u);
        }
    }

    /** Bloc « La partie se termine quand… » : titre + 3 cartes empilées. */
    _placerBlocFins(w, y0, blocH, u) {
        const C = window.SimilitudeConfig;
        const cj = C.commentJouer;
        const tailleTitre = this._placerTitreSection(this.titreFin, w, y0, u);
        const lcarte = (w * cj.largeurCartePct) / 100;
        const marge = u(cj.margeCarteU);
        const zoneEmoji = u(cj.tailleEmojiU);
        const largeEmoji = zoneEmoji * cj.largeurEmojiFacteur;
        const espaceCarte = u(cj.espaceCartesU);
        const hCarte = Math.max(u(cj.hauteurCarteMinU),
            (blocH - tailleTitre - 4 * espaceCarte) / 3);
        for (let i = 0; i < 3; i++) {
            const y = y0 + tailleTitre + espaceCarte +
                i * (hCarte + espaceCarte) + hCarte / 2;
            this._dessinerCarte(this.fins[i], w / 2, y, lcarte, hCarte);
            this.fins[i].emoji
                .setFontSize(Math.round(zoneEmoji) + "px")
                .setPosition(w / 2 - lcarte / 2 + marge, y);
            const xLabel = w / 2 - lcarte / 2 + marge + largeEmoji +
                u(cj.espaceEmojiLabelU);
            this.fins[i].label
                .setFontSize(Math.round(u(cj.tailleLabelU)) + "px")
                .setPosition(xLabel, y)
                .setWordWrapWidth(
                    lcarte - 2 * marge - largeEmoji - u(cj.espaceEmojiLabelU),
                    true);
            this._ajusterTexte(this.fins[i].label, hCarte, u);
        }
    }

    /** Bloc « Les 4 jokers » : titre + intro + grille 2×2. */
    _placerBlocJokers(w, y0, blocH, u, titreJokers, introJokers) {
        const C = window.SimilitudeConfig;
        const cj = C.commentJouer;
        const espace = u(C.menu.espaceU);
        const tailleTitre = this._placerTitreSection(titreJokers, w, y0, u);
        // Intro sur TOUTE la largeur disponible (wrap configuré — jamais
        // de débordement sur les cartes), puis grille 2×2 dans le reste.
        const lcarte = (w * cj.largeurCartePct) / 100;
        const marge = u(cj.margeCarteU);
        const zoneEmoji = u(cj.tailleEmojiJokerU);
        const largeEmoji = zoneEmoji * cj.largeurEmojiFacteur;
        const espaceCarte = u(cj.espaceCartesU);
        // ⭐ FIX SIM-FIX-CJ2 : l'intro est CENTRÉE (origine 0.5) — elle
        // héritait de l'origine gauche de _texte() et partait donc du
        // milieu vers la droite, en débordant de l'écran. Sa position est
        // calculée APRÈS le wrap, avec la hauteur mesurée, pour ne jamais
        // remonter sur le titre de section.
        introJokers
            .setOrigin(0.5)
            .setAlign("center")
            .setFontSize(Math.round(u(cj.tailleIntroU)) + "px")
            .setWordWrapWidth(lcarte, true);
        const yIntro = y0 + tailleTitre + espaceCarte + introJokers.height / 2;
        introJokers.setPosition(w / 2, yIntro);
        // Grille 2×2 : chaque carte = (largeurDispo − espace) / 2 — la
        // paire occupe exactement la largeur des cartes du haut. Centrage
        // CORRIGÉ (SIM-FIX-CJ) : l'ancien x1 = w/2 + espace/2 rapprochait
        // la carte droite de lJoker/2 → les deux cartes se chevauchaient.
        const lJoker = (lcarte - espace) / 2;
        const x0 = w / 2 - lJoker / 2 - espace / 2;
        const x1 = w / 2 + lJoker / 2 + espace / 2;
        // 2 rangées empilées + 1 espacement régulier, dans la hauteur qui
        // reste sous l'intro (hauteur MESURÉE de l'intro wrapée — rien
        // n'est superposé, règle John 08/08).
        const y0Grille = yIntro + introJokers.height / 2 + espaceCarte;
        const reste = y0 + blocH - y0Grille;
        const hJoker = Math.max(u(cj.hauteurCarteMinU),
            (reste - 2 * espaceCarte) / 2);
        const y0c = y0Grille + hJoker / 2;
        const y1c = y0c + hJoker + espaceCarte;
        this.jokers.forEach((j, i) => {
            const x = i % 2 === 0 ? x0 : x1;
            const y = i < 2 ? y0c : y1c;
            this._dessinerCarte(j, x, y, lJoker, hJoker);
            // Emoji à gauche DANS la carte ; nom et effet à sa droite,
            // wrap dans la largeur restante du conteneur (SIM-FIX-CJ).
            j.emoji
                .setFontSize(Math.round(zoneEmoji) + "px")
                .setPosition(x - lJoker / 2 + marge, y);
            const xTexte = x - lJoker / 2 + marge + largeEmoji +
                u(cj.espaceEmojiLabelU);
            const wrapTexte = lJoker - 2 * marge - largeEmoji -
                u(cj.espaceEmojiLabelU);
            j.nom
                .setFontSize(Math.round(u(cj.tailleNomJokerU)) + "px")
                .setPosition(xTexte, y - hJoker * 0.16)
                .setWordWrapWidth(wrapTexte, true);
            j.effet
                .setFontSize(Math.round(u(cj.tailleEffetJokerU)) + "px")
                .setPosition(xTexte, y + hJoker * 0.18)
                .setWordWrapWidth(wrapTexte, true);
            this._ajusterTexte(j.nom, hJoker * 0.44, u);
            this._ajusterTexte(j.effet, hJoker * 0.44, u);
        });
    }

    /**
     * Place un titre de section en haut de son bloc et renvoie la hauteur
     * RÉELLEMENT occupée (police + interligne). L'ancien code réservait la
     * seule taille de police : le texte, plus haut que ça, mordait sur la
     * carte du dessus (SIM-FIX-CJ2, GATE John 09/08).
     */
    _placerTitreSection(titre, w, y0, u) {
        const cj = window.SimilitudeConfig.commentJouer;
        titre.setFontSize(Math.round(u(cj.tailleSectionU)) + "px");
        const hauteur = titre.height;
        titre.setPosition(w / 2, y0 + hauteur / 2);
        return hauteur;
    }

    /**
     * Ajustement anti-débordement (pattern InventaireScene) : si le texte
     * wrapé dépasse la hauteur allouée dans sa carte, la police est
     * réduite progressivement (plancher config.policeMinU) — le texte ne
     * déborde JAMAIS par-dessus l'élément suivant.
     */
    _ajusterTexte(texte, hauteurMax, u) {
        const cj = window.SimilitudeConfig.commentJouer;
        const margeSecu = 2 * u(cj.margeTexteU);
        let fs = parseFloat(texte.style.fontSize);
        const plancher = u(cj.policeMinU);
        while (texte.height > hauteurMax - margeSecu && fs > plancher) {
            fs -= 0.5;
            texte.setFontSize(Math.round(fs) + "px");
        }
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
