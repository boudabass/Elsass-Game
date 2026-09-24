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
 * ⭐ FIX 08/08/2026 (corrections John — même règle que l'écran Niveaux,
 * commit 6e6b5a1) : le TABLEAU a une hauteur VARIABLE (plus de hauteur
 * fixe ni de plafond) : la hauteur de ligne est recalculée pour que le
 * tableau occupe TOUTE la hauteur disponible entre le titre et le bloc
 * du bas. Pagination (flèches ◀ / ▶ + « Page X / Y ») et bouton retour
 * EMPILÉS, ancrés EN BAS de l'écran : le retour posé sur le sol (ySol
 * h*0.965), la pagination au-dessus, même espace u(4.5) qu'entre les
 * étages du menu principal. Règle UI John : tout est empilé, jamais
 * superposé.
 *
 * ⭐ REFONTE CHARTE 24/09/2026 : tout l'écran (chargement, pagination,
 * tableau, en-tête, retour) est désormais la brique partagée
 * Arcade.UI.ecranClassement (core/ui/classement.js) — Similitude avait
 * une copie de cette scène, les deux jeux utilisent maintenant la même.
 * Les règles décrites ci-dessus (hauteur variable, pagination adaptative)
 * y sont conservées.
 */
class ClassementScene extends Phaser.Scene {
    static KEY = "classement";

    constructor() {
        super(ClassementScene.KEY);
    }

    create() {
        const C = window.WaggisConfig;
        this.enTransition = false;

        // Fond : dégradé de ciel (spec 709 révision 08/08).
        this.fond = this.add.graphics().setDepth(0);
        Arcade.UI.layout(this, (w, h) => WaggisUI.ciel(this.fond, w, h));

        Arcade.UI.ecranClassement(this, {
            surtitre: C.titre,
            titre: C.textes.classement,
            retour: { label: C.textes.retour, onClick: () => WaggisUI.aller(this, MenuScene.KEY) },
            textes: {
                chargement: C.textes.classementChargement,
                horsLigne: C.textes.classementHorsLigne,
                vide: C.textes.classementVide,
                pageInfo: C.textes.pageInfo
            },
            parPageMax: C.listes.entreesParPageMax,
            parPageMin: C.listes.entreesParPageMin,
            policeMinPx: C.listes.policeMinPx,
            largeurMaxU: C.listes.largeurMaxU
        });

        // Transition d'arrivée : fondu depuis le noir (spec 709).
        this.cameras.main.fadeIn(220, 0, 0, 0);
    }
}
