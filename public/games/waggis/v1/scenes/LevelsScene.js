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

        this.cameras.main.setBackgroundColor(C.couleurs.ciel);

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

        // --- Titre ----------------------------------------------------------
        const titre = UI.text(this, 0, 0, C.textes.niveaux, 9, C.couleurs.texte);

        // --- Pagination (100 % clic/tap, article 409) ----------------------
        const pageInfo = UI.text(this, 0, 0, "", 3.5, C.couleurs.texte);
        this.pageInfo = pageInfo;
        const prec = UI.button(this, {
            width: UI.u(this, 12), height: UI.u(this, 8),
            label: C.textes.pagePrecedente,
            color: "#141210",
            textColor: C.couleurs.texteClair,
            onClick: () => {
                if (this.page > 0) { this.page--; this._dessinerGrille(); }
            }
        });
        const suiv = UI.button(this, {
            width: UI.u(this, 12), height: UI.u(this, 8),
            label: C.textes.pageSuivante,
            color: "#141210",
            textColor: C.couleurs.texteClair,
            onClick: () => {
                if (this.page < this._nbPages() - 1) { this.page++; this._dessinerGrille(); }
            }
        });

        // --- Retour au menu -------------------------------------------------
        const retour = UI.button(this, {
            width: UI.u(this, 40), height: UI.u(this, 9),
            label: C.textes.retour,
            color: "#141210",
            textColor: C.couleurs.texteClair,
            onClick: () => this.scene.start(MenuScene.KEY)
        });

        // Mise en page recalculée à chaque rotation : titre en haut, grille
        // centrée, pagination et retour en bas.
        UI.layout(this, (w, h) => {
            titre.setPosition(w / 2, h * 0.08)
                 .setFontSize(Math.round(UI.u(this, 9)) + "px");
            pageInfo.setPosition(w / 2, h * 0.8)
                    .setFontSize(Math.round(UI.u(this, 3.5)) + "px");
            prec.redimensionner(UI.u(this, 12), UI.u(this, 8))
                .setPosition(w / 2 - UI.u(this, 10), h * 0.8);
            suiv.redimensionner(UI.u(this, 12), UI.u(this, 8))
                .setPosition(w / 2 + UI.u(this, 10), h * 0.8);
            retour.redimensionner(UI.u(this, 40), UI.u(this, 9))
                  .setPosition(w / 2, h * 0.91);
            this._dessinerGrille();
        });
        this._majPageInfo();
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
            t.fond.destroy();
            t.numero.destroy();
            t.score.destroy();
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
     * Crée la tuile d'un niveau : fond coloré selon l'état, numéro,
     * meilleur score (« ★ score ») ou cadenas si verrouillé. Zone tactile
     * uniquement sur les niveaux débloqués (verrouillage linéaire, spec 709).
     */
    _creerTuile(niveau, x, y, cote) {
        const C = this.C;
        const UI = Arcade.UI;
        const etat = this._etatNiveau(niveau);
        const couleur = etat === "verrouille"
            ? C.couleurs.verrouille
            : (etat === "encours" ? C.couleurs.bouton : C.couleurs.complete);

        const fond = this.add.graphics();
        fond.fillStyle(Phaser.Display.Color.HexStringToColor(couleur).color, 1);
        fond.fillRoundedRect(x - cote / 2, y - cote / 2, cote, cote, cote * 0.18);

        const numero = this.add
            .text(x, y - cote * 0.12, String(niveau), {
                fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
                fontSize: Math.round(UI.u(this, 5)) + "px",
                color: "#ffffff",
                align: "center"
            })
            .setOrigin(0.5);

        const score = this.add
            .text(x, y + cote * 0.18, "", {
                fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
                fontSize: Math.round(UI.u(this, 2.8)) + "px",
                color: "#ffffff",
                align: "center"
            })
            .setOrigin(0.5);

        if (etat === "verrouille") {
            score.setText(C.textes.verrouille);
        } else {
            const s = this.bestScores[String(niveau)];
            if (typeof s === "number") score.setText("★ " + s);
        }

        // Zone tactile : VRAIE sur les tuiles débloquées uniquement —
        // un niveau verrouillé ne réagit à rien (spec 709).
        const zone = this.add
            .rectangle(x, y, cote, cote, 0x000000, 0)
            .setInteractive({ useHandCursor: true });
        if (etat !== "verrouille") {
            zone.on("pointerdown", () => fond.setAlpha(0.75));
            zone.on("pointerout", () => fond.setAlpha(1));
            zone.on("pointerup", () => {
                fond.setAlpha(1);
                this.jouerNiveau(niveau);
            });
        }
        this._tuiles.push({ fond, numero, score, zone });
    }

    /**
     * Lance un niveau débloqué (spec 709 : « Jouer » passe par le niveau
     * courant, l'écran Niveaux permet de rejouer un niveau complété pour
     * améliorer son meilleur score). Le monde repart à zéro (708 §9) ;
     * GameScene lit { niveau } (init) puis le garde dans niveauSession pour
     * la relance après mort (Rejouer — même niveau, même monde, 708 §8).
     */
    jouerNiveau(niveau) {
        this.registry.set("generatedRows", null);
        this.scene.start(GameScene.KEY, { niveau: niveau });
    }
}
