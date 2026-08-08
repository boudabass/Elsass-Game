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
 * ⭐ REFONTE 08/08/2026 (spec 709 — révision 08/08, validée John) :
 *  - fond : dégradé de ciel (WaggisUI.ciel) au lieu de l'aplat ;
 *  - lignes : ombre portée + coins arrondis (même langage visuel que les
 *    cartes des autres écrans) ; police ronde Azimut sur tous les textes ;
 *  - flèches de pagination redessinées, fines et arrondies (WaggisUI.
 *    fleche), ÉCARTÉES du texte « Page X / Y » — plus de recouvrement
 *    (même correctif que l'écran Niveaux) ;
 *  - transitions animées fade entre écrans (WaggisUI.aller).
 *
 * ⭐ FIX 08/08/2026 (corrections John) : même correctif que l'écran
 * Niveaux — la pagination (flèches ◀ / ▶ + « Page X / Y ») est EMPILÉE
 * à la suite du tableau au lieu d'être posée à une hauteur fixe (h*0.86)
 * sans lien avec lui : son Y est calculé depuis le bas de la dernière
 * ligne (zoneHaut h*0.14 + 10 × hauteur de ligne, mêmes constantes que
 * _dessinerListe) + une marge de 5.5u. Le bouton Retour est intégré au
 * même empilement, juste sous la pagination (yPagination + 11u : flèche
 * 9u + marge 2u + demi-bouton 4.5u) — plus aucune superposition.
 * Règle UI John : tout est empilé, jamais superposé.
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
        this.enTransition = false;

        // ⭐ Chantier B (art. 704) : icônes plateforme persistantes
        // (Quitter haut-gauche / Plein écran haut-droite) — remplacent la
        // barre GameShell, visibles sur toutes les scènes.
        Arcade.UI.iconesPlateforme(this);

        // Fond : dégradé de ciel (spec 709 révision 08/08).
        this.fond = this.add.graphics().setDepth(0);

        // Titre de l'écran (spec 709 : « Classement »), police Azimut.
        const titre = this.add.text(0, 0, C.textes.classement, {
            fontFamily: C.police.famille,
            color: "#ffffff",
            align: "center"
        })
            .setOrigin(0.5)
            .setDepth(20)
            .setStroke("#141210", 3)
            .setShadow(0, 3, "rgba(20, 18, 16, 0.3)", 3, false, true);

        // Ligne d'état : chargement, hors ligne, liste vide, ou page X/Y.
        const etat = UI.text(this, 0, 0, C.textes.classementChargement, 3.5, C.couleurs.texte);
        this.etat = etat;

        // Pagination (même pattern que LevelsScene : ◀ / ▶, 100 % clic/tap).
        // ⭐ REFONTE 08/08 : flèches fines et arrondies, écartées du texte.
        const prec = WaggisUI.fleche(this, "gauche", () => {
            if (this.page > 0) { this.page--; this._dessinerListe(); }
        });
        const suiv = WaggisUI.fleche(this, "droite", () => {
            if (this.page < this._nbPages() - 1) { this.page++; this._dessinerListe(); }
        });
        this.prec = prec;
        this.suiv = suiv;

        // Retour au menu (bouton refondu).
        const retour = WaggisUI.bouton(this, {
            label: C.textes.retour,
            couleur: "#141210",
            onClick: () => WaggisUI.aller(this, MenuScene.KEY)
        });

        // 10 entrées par page : rang + nom + score lisibles sur mobile.
        this.parPage = 10;
        this.page = 0;
        this.entrees = null;     // null = chargement en cours ; [] = chargé mais vide
        this._lignes = [];       // objets de rendu de la page courante

        UI.layout(this, (w, h) => {
            WaggisUI.ciel(this.fond, w, h);
            titre.setPosition(w / 2, h * 0.07)
                 .setFontSize(Math.round(UI.u(this, 9)) + "px");
            // ⭐ FIX 08/08 (corrections John) : la pagination est EMPILÉE
            // à la suite du tableau — son Y est calculé DEPUIS le bas de
            // la dernière ligne (mêmes constantes que _dessinerListe :
            // zoneHaut h*0.14, hauteur de ligne plafonnée à 6u) + une
            // marge de 5.5u, plus de hauteur fixe (h*0.86) qui flottait
            // sans lien avec le tableau. Le bouton Retour est intégré au
            // même empilement, juste sous la pagination : flèche 9u + marge
            // 2u + demi-bouton 4.5u = yPagination + 11u. Tout est empilé,
            // jamais superposé (règle UI John).
            const zoneHaut = h * 0.14;
            const hauteurLigne = Math.min((h * 0.80 - zoneHaut) / this.parPage, UI.u(this, 6));
            const basTable = zoneHaut + hauteurLigne * this.parPage;
            const yPagination = basTable + UI.u(this, 5.5);
            const yRetour = yPagination + UI.u(this, 11);
            etat.setPosition(w / 2, yPagination)
                .setFontSize(Math.round(UI.u(this, 3.5)) + "px");
            prec.redimensionner(UI.u(this, 9))
                .setPosition(w / 2 - UI.u(this, 19), yPagination);
            suiv.redimensionner(UI.u(this, 9))
                .setPosition(w / 2 + UI.u(this, 19), yPagination);
            retour.redimensionner(UI.u(this, 40), UI.u(this, 9))
                  .setPosition(w / 2, yRetour);
            this._dessinerListe();
        });

        // Transition d'arrivée : fondu depuis le noir (spec 709).
        this.cameras.main.fadeIn(220, 0, 0, 0);

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
     * (Re)dessine les lignes de la page courante — ⭐ REFONTE 08/08 : ombre
     * portée + coins arrondis (même langage que les cartes Niveaux/
     * Personnages). Détruit les lignes de la page précédente — objets
     * Phaser non réutilisés (pattern LevelsScene).
     */
    _dessinerListe() {
        this._lignes.forEach((l) => {
            l.ombre.destroy();
            l.fond.destroy();
            l.rang.destroy();
            l.nom.destroy();
            l.score.destroy();
        });
        this._lignes = [];
        this._majEtat();

        const C = this.C;
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
        const r = hauteurLigne * 0.22;

        for (let i = debut; i < fin; i++) {
            const e = entrees[i];
            const rel = i - debut;
            const y = zoneHaut + hauteurLigne * rel + hauteurLigne / 2;
            const x = w / 2;

            // Ombre portée sous la ligne.
            const ombre = this.add.graphics();
            ombre.fillStyle(C.couleurs.ombrePortee, 0.25);
            ombre.fillRoundedRect(x - largeur / 2, y - hauteurLigne / 2 + hauteurLigne * 0.05,
                largeur, hauteurLigne, r);

            const fond = this.add.graphics();
            fond.fillStyle(0x141210, 0.85);
            fond.fillRoundedRect(x - largeur / 2, y - hauteurLigne / 2,
                largeur, hauteurLigne, r);

            const taille = Math.round(UI.u(this, 3.2)) + "px";
            const rang = this.add
                .text(x - largeur / 2 + UI.u(this, 4), y, String(i + 1) + ".", {
                    fontFamily: C.police.famille,
                    fontSize: taille,
                    color: "#F2B93D",
                    align: "left"
                })
                .setOrigin(0, 0.5);
            const nom = this.add
                .text(x, y, this._nomAffiche(e.user_name), {
                    fontFamily: C.police.famille,
                    fontSize: taille,
                    color: "#ffffff",
                    align: "center"
                })
                .setOrigin(0.5);
            const score = this.add
                .text(x + largeur / 2 - UI.u(this, 4), y, String(e.score), {
                    fontFamily: C.police.famille,
                    fontSize: taille,
                    color: "#ffffff",
                    align: "right"
                })
                .setOrigin(1, 0.5);

            this._lignes.push({ ombre, fond, rang, nom, score });
        }
    }
}
