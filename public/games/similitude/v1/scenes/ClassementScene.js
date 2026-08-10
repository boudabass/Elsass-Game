/*
 * ClassementScene — l'écran Classement de Similitude (spec 728 §7).
 *
 * ⭐ SIM-7 (spec 728 §7) : « Classement : Arcade.Platform.score.leaderboard,
 * endpoint d'agrégation déjà existant (GET /api/scores?gameId=), pagination
 * 10/page — recopier le pattern de ClassementScene de Waggis. »
 *
 * VÉRIFICATION BACKEND (MENU-5 Waggis, 07/08/2026) : l'endpoint
 * d'agrégation EXISTE — GET /api/scores?gameId=X (src/app/api/scores/
 * route.ts) renvoie le TOP 100 des scores du jeu : une ligne par joueur
 * (son MEILLEUR score, UPSERT côté POST), triée par score décroissant,
 * avec le nom affiché (user_name, issu de la session signée — jamais
 * envoyé par le client). Le socle l'expose déjà aux jeux :
 * Arcade.Platform.score.leaderboard() (core/platform.js). RIEN à créer
 * côté backend : l'écran consomme l'existant.
 *
 * Affichage (100 % clic/tap, article 409) : liste paginée de 10 entrées
 * par page (◀ / ▶), chaque ligne = rang + nom du joueur + score. Hors
 * plateforme (pas de ?gid= dans l'URL), leaderboard() renvoie [] :
 * message « indisponible hors ligne ». Liste vide côté serveur : message
 * d'invite à jouer. « Retour » ramène au menu.
 *
 * ⭐ REFONTE 08/08 (pattern Waggis) : fond dégradé, lignes avec ombre
 * portée + coins arrondis, police Azimut, transitions animées fade.
 * ⭐ FIX 08/08 (corrections John — même règle que l'écran Niveaux Waggis,
 * commit 6e6b5a1) : le TABLEAU a une hauteur VARIABLE : la hauteur de
 * ligne est recalculée pour que le tableau occupe TOUTE la hauteur
 * disponible entre le titre et le bloc du bas. Pagination (◀ / ▶ +
 * « Page X / Y ») et bouton retour EMPILÉS, ancrés EN BAS de l'écran :
 * le retour posé sur le sol (ySol h*0.965), la pagination au-dessus,
 * même espace u(4.5) qu'entre les étages du menu principal. Règle UI
 * John : tout est empilé, jamais superposé.
 *
 * TOUS les boutons utilisent LE composant partagé Arcade.UI.bouton
 * (core/ui/button.js) — aucun bouton redessiné à la main (spec 728 §7).
 *
 * Scène propre à Similitude (spec 728 §10 : rien dans core/), mobile-first
 * (Arcade.UI.u), mise en page recalculée à chaque rotation
 * (Arcade.UI.layout).
 */
class ClassementScene extends Phaser.Scene {
    static KEY = "classement";

    constructor() {
        super(ClassementScene.KEY);
    }

    async create() {
        const C = window.SimilitudeConfig;
        const UI = Arcade.UI;
        this.C = C;
        this.enTransition = false;

        // ⭐ Décision John 08/08 (art. 704 Chantier B) : les boutons Retour
        // et Plein écran ne sont affichés QUE sur le menu principal — plus
        // d'icônes plateforme sur les autres scènes.

        // Fond : dégradé (spec 728 §7).
        this.fond = this.add.graphics().setDepth(0);

        // Titre de l'écran, police Azimut.
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
        const etat = this.add.text(0, 0, C.textes.classementChargement, {
            fontFamily: C.police.famille,
            color: "#ffffff",
            align: "center"
        })
            .setOrigin(0.5)
            .setDepth(20)
            .setStroke("#141210", 2)
            .setShadow(0, 2, "rgba(20, 18, 16, 0.3)", 2, false, true);
        this.etat = etat;

        // Pagination (même pattern que Waggis ClassementScene : ◀ / ▶,
        // 100 % clic/tap) — composant partagé Arcade.UI.bouton (variante
        // TEXTE SIMPLE : le chevron est le libellé).
        const prec = Arcade.UI.bouton(this, {
            label: C.textes.pagePrecedente,
            couleur: C.couleurs.boutonSecondaire,
            ombre: C.couleurs.ombreBouton,
            police: C.police.famille,
            onClick: () => {
                if (this.page > 0) { this.page--; this._dessinerListe(); }
            }
        });
        const suiv = Arcade.UI.bouton(this, {
            label: C.textes.pageSuivante,
            couleur: C.couleurs.boutonSecondaire,
            ombre: C.couleurs.ombreBouton,
            police: C.police.famille,
            onClick: () => {
                if (this.page < this._nbPages() - 1) { this.page++; this._dessinerListe(); }
            }
        });
        this.prec = prec;
        this.suiv = suiv;

        // Retour au menu.
        const retour = Arcade.UI.bouton(this, {
            label: C.textes.retour,
            couleur: C.couleurs.boutonSecondaire,
            ombre: C.couleurs.ombreBouton,
            police: C.police.famille,
            onClick: () => SimilitudeUI.aller(this, MenuScene.KEY)
        });

        // 10 entrées par page : rang + nom + score lisibles sur mobile.
        this.parPage = 10;
        this.page = 0;
        this.entrees = null;     // null = chargement en cours ; [] = chargé mais vide
        this._lignes = [];       // objets de rendu de la page courante

        UI.layout(this, (w, h) => {
            SimilitudeUI.ciel(this.fond, w, h);
            titre.setPosition(w / 2, h * 0.07)
                 .setFontSize(Math.round(UI.u(this, 9)) + "px");

            // ⭐ FIX 08/08 (pattern Waggis, corrections John) : plus aucune
            // hauteur fixe — le bloc du bas est ancré au sol (retour posé
            // sur le sol, pagination empilée au-dessus, même espace u(4.5)
            // qu'entre les étages du menu principal) et le TABLEAU occupe
            // toute la hauteur disponible entre le titre et ce bloc
            // (hauteur de ligne recalculée par _calculerTable).
            const u = (n) => UI.u(this, n);
            const espace = u(C.menu.espaceU);
            const ySol = h * 0.965;
            const hauteurRetour = u(9);
            const yRetour = ySol - hauteurRetour / 2;
            // Pagination EMPILÉE au-dessus du retour : les boutons font
            // u(9) de haut, leur centre est donc à u(4.5) (demi-bouton)
            // + u(4.5) (espace) au-dessus du haut du bouton retour.
            const yPagination = yRetour - hauteurRetour / 2 - espace - u(4.5);

            etat.setPosition(w / 2, yPagination)
                .setFontSize(Math.round(u(3.2)) + "px");
            prec.redimensionner(u(9), u(9))
                .setPosition(w / 2 - u(19), yPagination);
            suiv.redimensionner(u(9), u(9))
                .setPosition(w / 2 + u(19), yPagination);
            retour.redimensionner(u(40), hauteurRetour)
                  .setPosition(w / 2, yRetour);

            // Bande du tableau : du dessous du titre (centre h*0.07 +
            // demi-titre u(4.5) + espace) au-dessus de la pagination (haut
            // des boutons − espace). La géométrie (hauteur de ligne) est
            // recalculée ici, à chaque rotation.
            const hautTable = h * 0.07 + u(4.5) + espace;
            const basTable = yPagination - u(4.5) - espace;
            this._table = this._calculerTable(w, h, hautTable, basTable);
            this._dessinerListe();
        });

        // Transition d'arrivée : fondu depuis le noir (spec 728 §7).
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
     * ⭐ FIX 08/08 (pattern Waggis, correction John) : géométrie du tableau
     * à hauteur VARIABLE. La hauteur d'une ligne est recalculée pour que le
     * tableau (10 entrées par page) occupe TOUTE la hauteur disponible
     * entre le titre et le bloc du bas (pagination + retour). Les lignes
     * partent du haut de la bande, chacune garde la même hauteur.
     * @returns {{hauteurLigne:number, x:number, largeur:number, y0:number}}
     *          centre de la PREMIÈRE ligne (haut du tableau)
     */
    _calculerTable(w, h, hautTable, basTable) {
        const UI = Arcade.UI;
        const hauteurLigne = Math.max(1, (basTable - hautTable) / this.parPage);
        return {
            hauteurLigne: hauteurLigne,
            x: w / 2,
            largeur: UI.u(this, 46),
            y0: hautTable + hauteurLigne / 2
        };
    }

    /**
     * (Re)dessine les lignes de la page courante — ombre portée + coins
     * arrondis (même langage visuel que les cartes Waggis). Détruit les
     * lignes de la page précédente — objets Phaser non réutilisés
     * (pattern Waggis ClassementScene).
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
        const entrees = this.entrees || [];   // null (chargement) = page vide
        const t = this._table;                // géométrie recalculée à chaque rotation
        if (!t) return;

        const debut = this.page * this.parPage;
        const fin = Math.min(debut + this.parPage, entrees.length);

        const hauteurLigne = t.hauteurLigne;
        const largeur = t.largeur;
        const r = hauteurLigne * 0.22;

        for (let i = debut; i < fin; i++) {
            const e = entrees[i];
            const rel = i - debut;
            const y = t.y0 + hauteurLigne * rel;
            const x = t.x;

            // Ombre portée sous la ligne (VALEUR NUMÉRIQUE — renderer
            // WebGL, QA 08/08 NC1).
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
                    color: C.couleurs.combo,   // orange (accent Similitude)
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
