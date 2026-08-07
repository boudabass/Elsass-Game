/*
 * ClassementScene — l'écran Classement de Waggis (spec 709 §7 boutons).
 *
 * ⭐ MENU-5 (spec 709 — Décision 6, article 704) : « Classement —
 * classement général, comparant les joueurs entre eux (pas seulement le
 * meilleur score personnel) — s'appuie sur la soumission cloud déjà
 * prévue dans score.js ». §Données nécessaires : « Classement général —
 * nécessite un endpoint/table coté backend pour agréger les scores de
 * tous les joueurs (à vérifier si déjà supporté par l'infra actuelle ou à
 * créer). »
 *
 * VÉRIFICATION BACKEND (MENU-5, 07/08/2026) : l'endpoint d'agrégation
 * EXISTE — GET /api/scores?gameId=X (src/app/api/scores/route.ts) renvoie
 * le TOP 100 des scores du jeu : une ligne par joueur (son MEILLEUR score,
 * UPSERT côté POST), triée par score décroissant, avec le nom affiché
 * (user_name, issu de la session signée — jamais envoyé par le client).
 * Le socle l'expose déjà aux jeux : Arcade.Platform.score.leaderboard()
 * (core/platform.js). RIEN à créer côté backend : l'écran consomme
 * l'existant (le point « à vérifier » de la spec est résolu : supporté).
 *
 * Affichage (100 % clic/tap, article 409 — aucune autre gestuelle) :
 * liste paginée de 10 entrées par page (◀ / ▶), chaque ligne = rang +
 * nom du joueur + score. Hors plateforme (pas de ?gid= dans l'URL),
 * leaderboard() renvoie [] : message « indisponible hors ligne ». Liste
 * vide côté serveur : message d'invite à jouer. « Retour » ramène au
 * menu.
 *
 * Scène propre à Waggis (article 709 : pas dans core/ tant qu'un 2e jeu
 * n'en a pas besoin), mobile-first (Arcade.UI.u), mise en page recalculée
 * à chaque rotation (Arcade.UI.layout).
 */
class ClassementScene extends Phaser.Scene {
    static KEY = "classement";

    constructor() {
        super(ClassementScene.KEY);
    }

    async create() {
        const C = window.WaggisConfig;
        const UI = Arcade.UI;
        this.C = C;

        this.cameras.main.setBackgroundColor(C.couleurs.ciel);

        // Titre de l'écran (spec 709 : « Classement »).
        const titre = UI.text(this, 0, 0, C.textes.classement, 9, C.couleurs.texte);

        // Ligne d'état : chargement, hors ligne, liste vide, ou page X/Y.
        const etat = UI.text(this, 0, 0, C.textes.classementChargement, 3.5, C.couleurs.texte);
        this.etat = etat;

        // Pagination (même pattern que LevelsScene : ◀ / ▶, 100 % clic/tap).
        const prec = UI.button(this, {
            width: UI.u(this, 12), height: UI.u(this, 8),
            label: C.textes.pagePrecedente,
            color: "#141210",
            textColor: C.couleurs.texteClair,
            onClick: () => {
                if (this.page > 0) { this.page--; this._dessinerListe(); }
            }
        });
        const suiv = UI.button(this, {
            width: UI.u(this, 12), height: UI.u(this, 8),
            label: C.textes.pageSuivante,
            color: "#141210",
            textColor: C.couleurs.texteClair,
            onClick: () => {
                if (this.page < this._nbPages() - 1) { this.page++; this._dessinerListe(); }
            }
        });
        this.prec = prec;
        this.suiv = suiv;

        // Retour au menu (comportement standard des écrans du menu).
        const retour = UI.button(this, {
            width: UI.u(this, 40), height: UI.u(this, 9),
            label: C.textes.retour,
            color: "#141210",
            textColor: C.couleurs.texteClair,
            onClick: () => this.scene.start(MenuScene.KEY)
        });

        // 10 entrées par page : rang + nom + score lisibles sur mobile.
        this.parPage = 10;
        this.page = 0;
        this.entrees = null;     // null = chargement en cours ; [] = chargé mais vide
        this._lignes = [];       // objets de rendu de la page courante

        UI.layout(this, (w, h) => {
            titre.setPosition(w / 2, h * 0.07)
                 .setFontSize(Math.round(UI.u(this, 9)) + "px");
            etat.setPosition(w / 2, h * 0.86)
                .setFontSize(Math.round(UI.u(this, 3.5)) + "px");
            prec.redimensionner(UI.u(this, 12), UI.u(this, 8))
                .setPosition(w / 2 - UI.u(this, 10), h * 0.86);
            suiv.redimensionner(UI.u(this, 12), UI.u(this, 8))
                .setPosition(w / 2 + UI.u(this, 10), h * 0.86);
            retour.redimensionner(UI.u(this, 40), UI.u(this, 9))
                  .setPosition(w / 2, h * 0.94);
            this._dessinerListe();
        });

        // Chargement du classement général (cloud) : l'endpoint
        // d'agrégation du socle (Arcade.Platform.score.leaderboard, GET
        // /api/scores?gameId=X — TOP 100 par joueur, vérifié existant
        // 07/08). Renvoie [] hors ligne ou en erreur (géré ci-dessous).
        this.entrees = await Arcade.Platform.score.leaderboard();
        this._majEtat();
        this._dessinerListe();
    }

    /** Nombre de pages (au moins 1 — la liste est vide au pire). */
    _nbPages() {
        return Math.max(1, Math.ceil((this.entrees || []).length / this.parPage));
    }

    /** Message de la ligne d'état selon la situation (chargement / hors
     * ligne / liste vide / page X de Y). */
    _majEtat() {
        if (!this.etat) return;
        const C = this.C;
        if (this.entrees === null) {
            this.etat.setText(C.textes.classementChargement);
        } else if (!Arcade.Platform.online) {
            this.etat.setText(C.textes.classementHorsLigne);
        } else if (this.entrees.length === 0) {
            this.etat.setText(C.textes.classementVide);
        } else {
            this.etat.setText(
                C.textes.pageInfo
                    .replace("{page}", String(this.page + 1))
                    .replace("{total}", String(this._nbPages()))
            );
        }
    }

    /** Nom affiché, tronqué si trop long (place limitée sur mobile). */
    _nomAffiche(nom) {
        var n = String(nom || "?");
        return n.length > 16 ? n.slice(0, 15) + "…" : n;
    }

    /**
     * (Re)dessine les lignes de la page courante. Détruit les lignes de la
     * page précédente — objets Phaser non réutilisés (pattern LevelsScene).
     */
    _dessinerListe() {
        this._lignes.forEach((l) => {
            l.fond.destroy();
            l.rang.destroy();
            l.nom.destroy();
            l.score.destroy();
        });
        this._lignes = [];
        this._majEtat();

        const UI = Arcade.UI;
        const w = this.scale.width;
        const h = this.scale.height;
        const entrees = this.entrees || [];   // null (chargement) = page vide

        const debut = this.page * this.parPage;
        const fin = Math.min(debut + this.parPage, entrees.length);

        // Hauteur d'une ligne : la zone 0.14 → 0.80 est découpée en 10
        // lignes (défaut), moins si la page en contient moins.
        const zoneHaut = h * 0.14;
        const zoneBas = h * 0.80;
        const hauteurLigne = Math.min((zoneBas - zoneHaut) / this.parPage, UI.u(this, 6));
        const largeur = UI.u(this, 46);

        for (let i = debut; i < fin; i++) {
            const e = entrees[i];
            const rel = i - debut;
            const y = zoneHaut + hauteurLigne * rel + hauteurLigne / 2;
            const x = w / 2;

            const fond = this.add.graphics();
            fond.fillStyle(0x141210, 0.85);
            fond.fillRoundedRect(x - largeur / 2, y - hauteurLigne / 2, largeur, hauteurLigne, hauteurLigne * 0.22);

            const taille = Math.round(UI.u(this, 3.2)) + "px";
            const rang = this.add
                .text(x - largeur / 2 + UI.u(this, 4), y, String(i + 1) + ".", {
                    fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
                    fontSize: taille,
                    color: "#F2B93D",
                    align: "left"
                })
                .setOrigin(0, 0.5);
            const nom = this.add
                .text(x, y, this._nomAffiche(e.user_name), {
                    fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
                    fontSize: taille,
                    color: "#ffffff",
                    align: "center"
                })
                .setOrigin(0.5);
            const score = this.add
                .text(x + largeur / 2 - UI.u(this, 4), y, String(e.score), {
                    fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
                    fontSize: taille,
                    color: "#ffffff",
                    align: "right"
                })
                .setOrigin(1, 0.5);

            this._lignes.push({ fond, rang, nom, score });
        }
    }
}
