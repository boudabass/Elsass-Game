/*
 * LevelsScene — l'écran Niveaux de Waggis : grille paginée de tous les
 * niveaux avec état + meilleur score par niveau.
 *
 * ⭐ MENU-3 (spec 709 §7 boutons — Décision 6, article 704) :
 *  - « Niveaux » : grille/liste de TOUS les niveaux, avec pour chacun :
 *      · état : verrouillé / complété / en cours ;
 *      · meilleur score du niveau (data.bestScores de la save v5, map
 *        niveau→score écrite à la victoire par OverScene) ;
 *  - DÉVERROUILLAGE STRICTEMENT LINÉAIRE : il faut terminer le niveau N
 *    pour débloquer N+1 (spec 709). Un niveau est donc :
 *      · complété  si  niveau < data.currentLevel ;
 *      · en cours   si  niveau == data.currentLevel (le prochain à jouer) ;
 *      · verrouillé si  niveau > data.currentLevel.
 *    Seuls les niveaux débloqués (complétés ou en cours) sont cliquables ;
 *    un niveau verrouillé n'a AUCUNE interaction (tuile grise, cadenas) ;
 *  - cliquer un niveau débloqué le LANCE DIRECTEMENT (rejouer un niveau
 *    complété est permis — c'est ce qui permet d'améliorer son meilleur
 *    score) : GameScene démarre avec { niveau } (init), la relance après
 *    mort (Rejouer) reprend le même niveau via niveauSession (708 §8) ;
 *  - grille paginée mobile-first : 5 × 5 = 25 niveaux par page, boutons
 *    ◀ / ▶ pour changer de page (100 % clic/tap, article 409 — aucune
 *    autre gestuelle), « Retour » ramène au menu.
 *
 * ⭐ REFONTE 08/08/2026 (spec 709 — révision 08/08, validée John) :
 *  - fond : dégradé de ciel (WaggisUI.ciel) au lieu de l'aplat ;
 *  - cartes niveaux : ombre portée + coins arrondis ; état verrouillé =
 *    overlay semi-transparent + icône cadenas fine (plus le gris uni) ;
 *    état complété = bordure/glow verte au lieu de l'aplat vert ;
 *  - flèches de pagination redessinées, fines et arrondies (WaggisUI.
 *    fleche), ÉCARTÉES du texte « Page X / Y » — le texte n'est plus
 *    recouvert par les flèches (bug signalé John) ;
 *  - ⭐ FIX 08/08 (corrections John) : la barre de pagination est
 *    EMPILÉE à la suite de la grille et le cadenas d'un niveau verrouillé
 *    est EMPILÉ sur la ligne du score (sous le chiffre, comme « ★ score »
 *    pour un niveau complété) — plus aucune superposition ;
 *  - ⭐ FIX 08/08 (correction John — cet écran) : la GRILLE a une
 *    hauteur VARIABLE (plus de hauteur fixe) : la taille des tuiles est
 *    recalculée pour que le tableau occupe TOUTE la hauteur disponible
 *    entre le titre et le bloc du bas — pagination et bouton retour
 *    EMPILÉS, ancrés EN BAS de l'écran (le retour posé sur le sol, la
 *    pagination au-dessus, même espace u(4.5) qu'entre les étages du
 *    menu principal). Sur un écran portrait, la grille occupe la
 *    largeur (bornée par la largeur, jamais de débordement). Règle UI
 *    John : tout est empilé, jamais superposé.
 *  - transitions animées fade entre écrans (WaggisUI.aller).
 *
 * Le nombre de niveaux affichés = le repère de levels.json (niveauMaxRepere
 * = 100, 708 §1), étendu si la progression a dépassé le repère — le niveau
 * en cours est toujours visible.
 *
 * Scène propre à Waggis (article 709 : pas dans core/ tant qu'un 2e jeu
 * n'en a pas besoin), 100 % clic/tap, tailles en % du plus petit côté
 * (Arcade.UI.u), mise en page recalculée à chaque rotation (Arcade.UI.layout).
 */
class LevelsScene extends Phaser.Scene {
    static KEY = "niveaux";

    constructor() {
        super(LevelsScene.KEY);
    }

    create() {
        const C = window.WaggisConfig;
        const UI = Arcade.UI;
        this.C = C;
        this.enTransition = false;

        // ⭐ Décision John 08/08 (art. 704 Chantier B) : les boutons Retour
        // et Plein écran ne sont affichés QUE sur le menu principal — plus
        // d'icônes plateforme sur les autres scènes.

        // Données de la save v5 (appliquée au boot par Arcade.Save.apply) :
        // data.currentLevel (niveau le plus avancé débloqué) et
        // data.bestScores (meilleur score PAR NIVEAU, map niveau→score).
        this.currentLevel = this.registry.get("currentLevel") || 1;
        this.bestScores = this.registry.get("bestScores") || {};

        // Tous les niveaux du jeu : le repère de levels.json (100, 708 §1),
        // étendu si la progression a dépassé le repère — le niveau en cours
        // doit toujours être dans la grille.
        const maxRepere = (C.levels && typeof C.levels.niveauMaxRepere === "number")
            ? C.levels.niveauMaxRepere
            : 100;
        this.nbNiveaux = Math.max(maxRepere, this.currentLevel);
        this.parPage = 25;        // grille 5 × 5
        this.page = 0;
        this._tuiles = [];

        // --- Fond : dégradé de ciel (spec 709 révision 08/08) --------------
        this.fond = this.add.graphics().setDepth(0);

        // --- Titre (police Azimut + relief) --------------------------------
        const titre = this.add.text(0, 0, C.textes.niveaux, {
            fontFamily: C.police.famille,
            color: "#ffffff",
            align: "center"
        })
            .setOrigin(0.5)
            .setDepth(20)
            .setStroke("#141210", 3)
            .setShadow(0, 3, "rgba(20, 18, 16, 0.3)", 3, false, true);

        // --- Pagination (100 % clic/tap, article 409) ----------------------
        // ⭐ REFONTE 08/08 : flèches fines et arrondies (chevron Graphics),
        // ÉCARTÉES du texte « Page X / Y » — plus de recouvrement (bug
        // John). Le texte reste centré, les flèches en dehors de sa zone.
        const pageInfo = UI.text(this, 0, 0, "", 3.5, C.couleurs.texte);
        this.pageInfo = pageInfo;
        const prec = WaggisUI.fleche(this, "gauche", () => {
            if (this.page > 0) { this.page--; this._dessinerGrille(); }
        });
        const suiv = WaggisUI.fleche(this, "droite", () => {
            if (this.page < this._nbPages() - 1) { this.page++; this._dessinerGrille(); }
        });

        // --- Retour au menu (bouton refondu : ombre + arrondis + dégradé) --
        const retour = WaggisUI.bouton(this, {
            label: C.textes.retour,
            couleur: "#141210",
            onClick: () => WaggisUI.aller(this, MenuScene.KEY)
        });

        // Mise en page recalculée à chaque rotation : titre en haut, grille
        // à hauteur VARIABLE dans l'espace restant, pagination + retour
        // EMPILÉS, ancrés EN BAS (correction John 08/08). Le texte
        // « Page X / Y » reste centré et les flèches écartées (± 19u).
        // ⭐ FIX 08/08 (John) : plus aucune hauteur fixe — le bloc du bas
        // est ancré au sol (retour posé sur le sol, pagination empilée
        // au-dessus, même espace u(4.5) qu'entre les étages du menu) et la
        // GRILLE occupe toute la hauteur disponible entre le titre et ce
        // bloc (taille des tuiles recalculée par _calculerGrille, plus de
        // cote fixe u(10.5)).
        UI.layout(this, (w, h) => {
            WaggisUI.ciel(this.fond, w, h);
            titre.setPosition(w / 2, h * 0.08)
                 .setFontSize(Math.round(UI.u(this, 9)) + "px");

            const u = (n) => UI.u(this, n);
            const espace = u(4.5);          // même espace qu'entre les étages du menu
            const ySol = h * 0.965;         // ancrage bas (pattern MenuScene)
            const hauteurRetour = u(9);
            const yRetour = ySol - hauteurRetour / 2;
            // Pagination EMPILÉE au-dessus du retour : les flèches font
            // u(9) de diamètre, leur centre est donc à u(4.5) (demi-flèche)
            // + u(4.5) (espace) au-dessus du haut du bouton retour.
            const yPagination = yRetour - hauteurRetour / 2 - espace - u(4.5);

            pageInfo.setPosition(w / 2, yPagination)
                    .setFontSize(Math.round(u(3.5)) + "px");
            prec.redimensionner(u(9))
                .setPosition(w / 2 - u(19), yPagination);
            suiv.redimensionner(u(9))
                .setPosition(w / 2 + u(19), yPagination);
            retour.redimensionner(u(40), hauteurRetour)
                  .setPosition(w / 2, yRetour);

            // Bande de la grille : du dessous du titre (centre h*0.08 +
            // demi-titre u(4.5) + espace) au-dessus de la pagination (haut
            // des flèches − espace). La géométrie (taille des tuiles) est
            // recalculée ici, à chaque rotation.
            const hautGrille = h * 0.08 + u(4.5) + espace;
            const basGrille = yPagination - u(4.5) - espace;
            this._grille = this._calculerGrille(w, h, hautGrille, basGrille);
            this._dessinerGrille();
        });
        this._majPageInfo();

        // Transition d'arrivée : fondu depuis le noir (spec 709).
        this.cameras.main.fadeIn(220, 0, 0, 0);
    }

    /** Nombre de pages de la grille (au moins 1). */
    _nbPages() {
        return Math.max(1, Math.ceil(this.nbNiveaux / this.parPage));
    }

    /** État d'un niveau : complété / en cours / verrouillé (spec 709). */
    _etatNiveau(niveau) {
        if (niveau < this.currentLevel) return "complete";
        if (niveau === this.currentLevel) return "encours";
        return "verrouille";
    }

    /** Rafraîchit le texte « Page X / Y » (contenu, pas position). */
    _majPageInfo() {
        if (this.pageInfo) {
            this.pageInfo.setText(
                this.C.textes.pageInfo
                    .replace("{page}", String(this.page + 1))
                    .replace("{total}", String(this._nbPages()))
            );
        }
    }

    /**
     * ⭐ FIX 08/08 (correction John) : géométrie de la grille à hauteur
     * VARIABLE. La taille d'une tuile est recalculée pour que le tableau
     * (5 × 5 = 25 tuiles, spec 709) occupe TOUTE la hauteur disponible
     * entre le titre et le bloc du bas (pagination + retour) — plus de
     * cote fixe u(10.5). La tuile est aussi bornée par la largeur (min
     * des deux) : sur un écran portrait la grille occupe alors la largeur
     * de l'écran, sans jamais déborder. La grille est centrée dans sa
     * bande (horizontalement et verticalement).
     * @returns {{cote:number, gap:number, x0:number, y0:number}} centre
     *          de la PREMIÈRE tuile (haut-gauche de la grille)
     */
    _calculerGrille(w, h, hautGrille, basGrille) {
        const UI = Arcade.UI;
        const cols = 5;
        const lignes = 5;
        const gap = UI.u(this, 1.5);
        // Tuile la plus grande qui tient dans la hauteur de la bande…
        const coteH = (basGrille - hautGrille - (lignes - 1) * gap) / lignes;
        // …et dans la largeur de l'écran.
        const coteW = (w - (cols - 1) * gap) / cols;
        const cote = Math.max(1, Math.min(coteH, coteW));
        const grilleW = cols * cote + (cols - 1) * gap;
        const grilleH = lignes * cote + (lignes - 1) * gap;
        return {
            cote: cote,
            gap: gap,
            x0: w / 2 - grilleW / 2 + cote / 2,
            y0: (hautGrille + basGrille) / 2 - grilleH / 2 + cote / 2
        };
    }

    /**
     * (Re)dessine les tuiles de la page courante. Détruit les tuiles de la
     * page précédente — les objets Phaser ne sont pas réutilisés (le nombre
     * de tuiles par page est constant, 25). ⭐ FIX 08/08 (John) : la
     * géométrie (taille des tuiles, position) vient de _calculerGrille,
     * rejouée à chaque rotation — le tableau suit la hauteur disponible.
     */
    _dessinerGrille() {
        this._tuiles.forEach((t) => {
            t.ombre.destroy();
            t.fond.destroy();
            t.numero.destroy();
            t.score.destroy();
            if (t.cadenas) t.cadenas.destroy();
            t.zone.destroy();
        });
        this._tuiles = [];

        const g = this._grille;
        if (!g) return;
        const cote = g.cote;
        const gap = g.gap;
        const cols = 5;

        const debut = this.page * this.parPage;
        const fin = Math.min(debut + this.parPage, this.nbNiveaux);
        for (let i = debut; i < fin; i++) {
            const niveau = i + 1;
            const rel = i - debut;
            const col = rel % cols;
            const ligne = Math.floor(rel / cols);
            const x = g.x0 + col * (cote + gap);
            const y = g.y0 + ligne * (cote + gap);
            this._creerTuile(niveau, x, y, cote);
        }
        this._majPageInfo();
    }

    /**
     * Crée la tuile d'un niveau — ⭐ REFONTE 08/08 (spec 709) :
     *  - ombre portée + coins arrondis sur TOUTES les tuiles ;
     *  - complété : fond blanc + BORDURE/GLOW verte (plus l'aplat vert) ;
     *  - en cours : fond rouge Waggis (accent) + bordure/glow claire ;
     *  - verrouillé : fond clair + OVERLAY semi-transparent + cadenas FIN
     *    (WaggisUI.cadenas) au lieu du gris uni ; ⭐ FIX 08/08 (John) : le
     *    cadenas est EMPILÉ sur la ligne du score (sous le chiffre, comme
     *    « ★ score » pour un niveau complété) — plus de superposition au
     *    centre de la carte ;
     *  - numéro, meilleur score (« ★ score ») ou rien si verrouillé. Zone
     *    tactile uniquement sur les niveaux débloqués (verrouillage
     *    linéaire, spec 709).
     */
    _creerTuile(niveau, x, y, cote) {
        const C = this.C;
        const UI = Arcade.UI;
        const etat = this._etatNiveau(niveau);

        const hex = (s) => Phaser.Display.Color.HexStringToColor(s).color;
        const r = cote * 0.18;

        // Ombre portée (sous la tuile, décalée vers le bas).
        const ombre = this.add.graphics();
        ombre.fillStyle(C.couleurs.ombrePortee, 0.25);
        ombre.fillRoundedRect(x - cote / 2, y - cote / 2 + cote * 0.06, cote, cote, r);

        // Corps de la tuile selon l'état.
        const fond = this.add.graphics();
        let couleurNumero = "#ffffff";
        if (etat === "verrouille") {
            // Fond clair + overlay sombre semi-transparent (spec 709).
            fond.fillStyle(hex(C.couleurs.fondCarte), 1);
            fond.fillRoundedRect(x - cote / 2, y - cote / 2, cote, cote, r);
            fond.fillStyle(C.couleurs.ombrePortee, 0.45);
            fond.fillRoundedRect(x - cote / 2, y - cote / 2, cote, cote, r);
        } else if (etat === "encours") {
            // Niveau à jouer : accent rouge Waggis + bordure claire.
            fond.fillStyle(hex(C.couleurs.bouton), 1);
            fond.fillRoundedRect(x - cote / 2, y - cote / 2, cote, cote, r);
            fond.lineStyle(Math.max(2, Math.round(UI.u(this, 0.7))), 0xffffff, 0.9);
            fond.strokeRoundedRect(x - cote / 2, y - cote / 2, cote, cote, r);
        } else {
            // Complété : fond clair + BORDURE/GLOW verte (plus l'aplat vert).
            fond.fillStyle(hex(C.couleurs.fondCarte), 1);
            fond.fillRoundedRect(x - cote / 2, y - cote / 2, cote, cote, r);
            const liseret = hex(C.couleurs.liseretActif);
            fond.lineStyle(Math.max(2, Math.round(UI.u(this, 0.7))), liseret, 1);
            fond.strokeRoundedRect(x - cote / 2, y - cote / 2, cote, cote, r);
            // Glow : second trait plus épais, très translucide.
            fond.lineStyle(Math.max(4, Math.round(UI.u(this, 1.6))), liseret, 0.25);
            fond.strokeRoundedRect(x - cote / 2 - UI.u(this, 0.4),
                y - cote / 2 - UI.u(this, 0.4), cote + UI.u(this, 0.8), cote + UI.u(this, 0.8), r);
            couleurNumero = "#141210";
        }

        const numero = this.add
            .text(x, y - cote * 0.12, String(niveau), {
                fontFamily: C.police.famille,
                fontSize: Math.round(UI.u(this, 5)) + "px",
                color: couleurNumero,
                align: "center"
            })
            .setOrigin(0.5);

        const score = this.add
            .text(x, y + cote * 0.18, "", {
                fontFamily: C.police.famille,
                fontSize: Math.round(UI.u(this, 2.8)) + "px",
                color: etat === "complete" ? hex(C.couleurs.liseretActif) : "#ffffff",
                align: "center"
            })
            .setOrigin(0.5);

        // Zone tactile : VRAIE sur les tuiles débloquées uniquement — un
        // niveau verrouillé ne réagit à rien (spec 709). Créée dans tous les
        // cas (détruite à la réécriture), interactive seulement si débloqué.
        const zone = this.add
            .rectangle(x, y, cote, cote, 0x000000, 0)
            .setInteractive({ useHandCursor: true });

        if (etat === "verrouille") {
            // ⭐ FIX 08/08 (corrections John) : le cadenas FINE est EMPILÉ
            // dans la mise en page de la carte — posé sur la ligne du score
            // (y + cote*0.18), exactement là où « ★ score » s'aligne sous le
            // chiffre pour un niveau complété. Plus de superposition au
            // centre (l'ancienne position y + cote*0.08). Taille ajustée
            // (cote*0.32) pour tenir dans l'emplacement, sous le numéro.
            const cadenas = this.add.graphics();
            WaggisUI.cadenas(cadenas, x, y + cote * 0.18, cote * 0.32, 0xffffff);
            this._tuiles.push({ ombre, fond, numero, score, cadenas, zone });
            return;
        } else {
            const s = this.bestScores[String(niveau)];
            if (typeof s === "number") score.setText("★ " + s);
        }

        zone.on("pointerdown", () => fond.setAlpha(0.75));
        zone.on("pointerout", () => fond.setAlpha(1));
        zone.on("pointerup", () => {
            fond.setAlpha(1);
            this.jouerNiveau(niveau);
        });
        this._tuiles.push({ ombre, fond, numero, score, zone });
    }

    /**
     * Lance un niveau débloqué (spec 709 : « Jouer » passe par le niveau
     * courant, l'écran Niveaux permet de rejouer un niveau complété pour
     * améliorer son meilleur score). Le monde repart à zéro (708 §9) ;
     * GameScene lit { niveau } (init) puis le garde dans niveauSession pour
     * la relance après mort (Rejouer — même niveau, même monde, 708 §8).
     * ⭐ REFONTE 08/08 : transition animée (fade) vers le jeu.
     */
    jouerNiveau(niveau) {
        this.registry.set("generatedRows", null);
        WaggisUI.aller(this, GameScene.KEY, { niveau: niveau });
    }
}
