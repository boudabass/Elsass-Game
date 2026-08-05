/*
 * config.js — tous les réglages de Cigogne au même endroit.
 *
 * Les valeurs sont exprimées en PROPORTION de l'écran, jamais en pixels :
 * le jeu se comporte donc exactement pareil sur un téléphone en portrait et
 * sur un grand écran de PC.
 */
window.CigogneConfig = {
    key: "cigogne",
    titre: "Cigogne",

    // --- Textes (libellés français) -----------------------------------------
    // {score} est un emplacement : la valeur du score est insérée au moment
    // de l'affichage (voir MenuScene / OverScene).
    textes: {
        meilleurScore: "Meilleur score : {score}",
        nouveauRecord: "Nouveau record !"
    },

    // --- Vol ---------------------------------------------------------------
    // Gravité exprimée en hauteurs d'écran par seconde au carré.
    gravitePar_h: 3.2,
    // Impulsion du battement d'ailes (vers le haut, donc négative).
    battementPar_h: -0.85,
    // Inclinaison maximale du sprite, en degrés.
    inclinaisonMax: 60,

    // --- Obstacles (maisons alsaciennes) ------------------------------------
    // Une maison est bâtie en BLOCS de colombage. Sa largeur est toujours un
    // nombre entier de blocs : la texture n'est donc jamais coupée en plein
    // milieu d'une croix de Saint-André.
    ouverturePct: 30,        // hauteur du passage, en % de la hauteur d'écran
    blocPct: 6,              // côté d'un bloc, en % du plus petit côté de l'écran
    blocsMin: 1,             // largeur mini d'une maison, en blocs
    blocsMax: 4,             // largeur maxi d'une maison, en blocs
    hauteurToitBloc: 0.75,   // épaisseur de l'avant-toit, en blocs
    debordToitBloc: 0.15,    // débord du toit de chaque côté, en blocs
    vitessePar_w: 0.38,      // défilement : 38 % de la largeur d'écran / seconde
    ecartPar_w: 0.46,        // trou entre deux maisons (bord à bord), en largeurs d'écran
    margeHautPct: 12,        // zone interdite en haut, en % de la hauteur
    margeBasPct: 12,         // zone interdite au-dessus du sol

    // --- Cigogne ------------------------------------------------------------
    tailleOiseauPct: 9,      // en % du plus petit côté
    hitboxRatio: 0.55,       // la zone de collision est plus petite que l'image
    positionXPct: 28,        // position horizontale, en % de la largeur

    solPct: 8,               // hauteur du sol, en % de la hauteur d'écran

    // --- Couleurs -----------------------------------------------------------
    couleurs: {
        ciel: "#87ceeb",
        facade: 0xf0e6d2,    // crème du colombage
        poutre: 0x5c3a21,    // bois foncé
        toit: 0xb5533c,      // tuiles
        toitBord: 0x7a3a28,  // avant-toit
        herbe: 0x6aa84f,
        terre: 0x8b6b4a,
        texte: "#141210",
        texteClair: "#ffffff",
        bouton: "#E31B23",
        // Encadré du record sur l'écran de fin : orange, texte noir à
        // l'intérieur (lisible sur le fond bleu ciel).
        encadreRecord: "#F2B93D"
    }
};
