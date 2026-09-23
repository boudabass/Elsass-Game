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
 * ⭐ REFONTE CHARTE 24/09/2026 : tout l'écran est désormais la brique
 * partagée Arcade.UI.ecranClassement (core/ui/classement.js), la même que
 * Waggis — cette scène en était une copie. Elle ne fournit plus que ses
 * textes et son fond.
 */
class ClassementScene extends Phaser.Scene {
    static KEY = "classement";

    constructor() {
        super(ClassementScene.KEY);
    }

    create() {
        const C = window.SimilitudeConfig;
        this.enTransition = false;

        // Fond : dégradé (spec 728 §7).
        this.fond = this.add.graphics().setDepth(0);
        Arcade.UI.layout(this, (w, h) => SimilitudeUI.ciel(this.fond, w, h));

        Arcade.UI.ecranClassement(this, {
            surtitre: C.titre,
            titre: C.textes.classement,
            retour: { label: C.textes.retour, onClick: () => SimilitudeUI.aller(this, MenuScene.KEY) },
            textes: {
                chargement: C.textes.classementChargement,
                horsLigne: C.textes.classementHorsLigne,
                vide: C.textes.classementVide,
                pageInfo: C.textes.pageInfo
            }
        });

        // Transition d'arrivée : fondu depuis le noir (spec 728 §7).
        this.cameras.main.fadeIn(220, 0, 0, 0);
    }
}
