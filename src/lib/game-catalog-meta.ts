/*
 * Métadonnées de présentation du catalogue (catégorie, couleur d'accent,
 * initiale) — statiques, pas en base : il n'y a que 4 jeux, ajoutés
 * manuellement par John via /admin, et rien ne les lit dynamiquement.
 * Une vraie colonne DB n'aurait de sens que si ces valeurs devenaient
 * éditables depuis /admin, ce qui n'est pas demandé.
 *
 * Clé = nom du jeu tel qu'enregistré dans la table `game` (colonne `name`).
 * Pas de note/avis : supprimé du design (aucun vrai système de notation).
 */
export interface GameCatalogMeta {
    categorie: string;
    couleur: string; // classe Tailwind bg-*, cf. tailwind.config.ts theme.colors.elsass
    initiale: string;
}

export const CATEGORIES = [
    "Tous",
    "Réflexes",
    "Course & évitement",
    "Mémoire",
    "Gestion",
] as const;

const DEFAUT: GameCatalogMeta = {
    categorie: "Réflexes",
    couleur: "bg-elsass-ink",
    initiale: "?",
};

const META_PAR_NOM: Record<string, GameCatalogMeta> = {
    Cigogne: { categorie: "Réflexes", couleur: "bg-elsass-red", initiale: "C" },
    Waggis: { categorie: "Course & évitement", couleur: "bg-elsass-gold", initiale: "W" },
    Similitude: { categorie: "Mémoire", couleur: "bg-elsass-black", initiale: "S" },
    "Elsass Farm": { categorie: "Gestion", couleur: "bg-elsass-ink", initiale: "F" },
};

export function getGameCatalogMeta(name: string): GameCatalogMeta {
    return META_PAR_NOM[name] ?? { ...DEFAUT, initiale: name.charAt(0).toUpperCase() || "?" };
}
