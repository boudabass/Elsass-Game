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
 *    EMPILÉE à la suite de la grille (position calculée depuis le bas
 *    du tableau, plus de hauteur fixe qui recouvrait la dernière ligne
 *    de tuiles) et le cadenas d'un niveau verrouillé est EMPILÉ sur la
 *    ligne du score (sous le chiffre, comme « ★ score » pour un niveau
 *    complété) — plus aucune superposition. Règle UI John : tout est
 *    empilé, jamais superposé.
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

        // ⭐ Chantier B (art. 704) : icônes plateforme persistantes
        // (Quitter haut-gauche / Plein écran haut-droite) — remplacent la
        // barre GameShell, visibles sur toutes les scènes.
        Arcade.UI.iconesPlateforme(this);

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
        // centrée, pagination EMPILÉE à la suite de la grille et retour en
        // bas. Le texte « Page X / Y » est centré et les flèches écartées
        // (± 19u). ⭐ FIX 08/08 (John) : la pagination n'est plus posée à une
        // hauteur fixe (h*0.8) qui recouvrait le bas du tableau — son Y est
        // calculé DEPUIS le bas de la grille (mêmes constantes que
        // _dessinerGrille), elle est donc toujours empilée à sa suite.
        UI.layout(this, (w, h) => {
            WaggisUI.ciel(this.fond, w, h);
            titre.setPosition(w / 2, h * 0.08)
                 .setFontSize(Math.round(UI.u(this, 9)) + "px");
            const basGrille = h * 0.17 + (5 * UI.u(this, 10.5) + 4 * UI.u(this, 1.5));
            const yPagination = basGrille + UI.u(this, 5.5);
            pageInfo.setPosition(w / 2, yPagination)
                    .setFontSize(Math.round(UI.u(this, 3.5)) + "px");
            prec.redimensionner(UI.u(this, 9))
                .setPosition(w / 2 - UI.u(this, 19), yPagination);
            suiv.redimensionner(UI.u(this, 9))
                .setPosition(w / 2 + UI.u(this, 19), yPagination);
            retour.redimensionner(UI.u(this, 40), UI.u(this, 9))
                  .setPosition(w / 2, h * 0.91);
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
     * (Re)dessine les tuiles de la page courante. Détruit les tuiles de la
     * page précédente — les objets Phaser ne sont pas réutilisés (le nombre
     * de tuiles par page est constant, 25).
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

        const UI = Arcade.UI;
        const w = this.scale.width;
        const h = this.scale.height;
        const cote = UI.u(this, 10.5);   // tuile carrée
        const gap = UI.u(this, 1.5);
        const cols = 5;
        const lignes = 5;
        const grilleW = cols * cote + (cols - 1) * gap;
        const grilleH = lignes * cote + (lignes - 1) * gap;
        const x0 = w / 2 - grilleW / 2 + cote / 2;
        const y0 = h * 0.17 + cote / 2;

        const debut = this.page * this.parPage;
        const fin = Math.min(debut + this.parPage, this.nbNiveaux);
        for (let i = debut; i < fin; i++) {
            const niveau = i + 1;
            const rel = i - debut;
            const col = rel % cols;
            const ligne = Math.floor(rel / cols);
            const x = x0 + col * (cote + gap);
            const y = y0 + ligne * (cote + gap);
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
