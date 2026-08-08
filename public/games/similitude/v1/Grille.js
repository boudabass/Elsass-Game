/*
 * Grille.js — état de la grille, placement, détection d'alignements.
 *
 * LOGIQUE PURE : aucun appel Phaser, aucun accès au DOM. C'est ce qui permet
 * de tester les alignements et le tirage initial en headless, sans navigateur
 * (spec 473 §9). Le fichier est chargé dans le navigateur (window.Grille) ET
 * importable sous Node (module.exports) pour les tests.
 *
 * Les types d'items sont des entiers 0..(typesItems−1) ; la correspondance
 * type → texture vit dans config.js (tableau items, même ordre).
 */
(function (root, factory) {
    if (typeof module !== "undefined" && module.exports) {
        module.exports = factory();
    } else {
        root.Grille = factory();
    }
})(typeof window !== "undefined" ? window : this, function () {
    "use strict";

    class Grille {
        /**
         * @param {object} cfg — config du jeu (SimilitudeConfig) ou objet
         *   minimal {grilleTaille, typesItems}.
         */
        constructor(cfg) {
            cfg = cfg || {};
            this.taille = cfg.grilleTaille || 9;
            this.types = cfg.typesItems || 6;
            this.cases = this.creerGrilleVide();
        }

        /** Grille 9×9 de null (case vide). */
        creerGrilleVide() {
            const g = [];
            for (let l = 0; l < this.taille; l++) {
                g[l] = [];
                for (let c = 0; c < this.taille; c++) {
                    g[l][c] = null;
                }
            }
            return g;
        }

        /** Type (0..types−1) à la case (ligne, colonne), ou null si vide. */
        get(l, c) {
            return this.cases[l][c];
        }

        /** Pose un item. */
        set(l, c, type) {
            this.cases[l][c] = type;
        }

        /** Nombre d'items actuellement posés sur la grille. */
        compterItems() {
            let n = 0;
            for (let l = 0; l < this.taille; l++) {
                for (let c = 0; c < this.taille; c++) {
                    if (this.cases[l][c] !== null) n++;
                }
            }
            return n;
        }

        /**
         * true si poser `type` en (l, c) NE crée AUCUN alignement ≥ 3 en
         * ligne ou en colonne avec les items déjà posés. C'est la règle du
         * re-tirage : on n'autorise jamais un placement fautif.
         */
        peutPlacer(l, c, type) {
            // --- Ligne : items identiques contigus à gauche + à droite ----
            let n = 1;
            for (let x = c - 1; x >= 0 && this.cases[l][x] === type; x--) n++;
            for (let x = c + 1; x < this.taille && this.cases[l][x] === type; x++) n++;
            if (n >= 3) return false;

            // --- Colonne : idem vers le haut + le bas ---------------------
            n = 1;
            for (let y = l - 1; y >= 0 && this.cases[y][c] === type; y--) n++;
            for (let y = l + 1; y < this.taille && this.cases[y][c] === type; y++) n++;
            if (n >= 3) return false;

            return true;
        }

        /**
         * Tirage initial (spec §4) : `nbItems` items posés au hasard sur des
         * cases vides, tirés parmi les `types` types. GARANTIE : aucun
         * alignement ≥ 3 en ligne ou en colonne au départ — un item dont le
         * placement créerait un alignement est re-tiré (autre type, puis
         * autre case) jusqu'à ce que la grille soit propre.
         *
         * @returns {number} nombre d'items effectivement posés (= nbItems).
         */
        tirageInitial(nbItems) {
            const cibles = nbItems || this.taille * this.taille;
            let places = 0;
            let essais = 0;
            const essaisMax = cibles * 200;   // garde-fou (pratiquement jamais atteint)

            while (places < cibles && essais < essaisMax) {
                essais++;

                // Case vide tirée au hasard
                const vides = [];
                for (let l = 0; l < this.taille; l++) {
                    for (let c = 0; c < this.taille; c++) {
                        if (this.cases[l][c] === null) vides.push([l, c]);
                    }
                }
                if (!vides.length) break;    // grille saturée : on s'arrête

                const [l, c] = vides[Math.floor(Math.random() * vides.length)];

                // Type tiré au hasard ; re-tirage tant que le placement est fautif
                let type = Math.floor(Math.random() * this.types);
                let tentes = 0;
                while (!this.peutPlacer(l, c, type) && tentes < this.types) {
                    type = (type + 1) % this.types;   // on essaie un autre type
                    tentes++;
                }

                if (this.peutPlacer(l, c, type)) {
                    this.set(l, c, type);
                    places++;
                }
                // Sinon : la case est laissée vide, on en tirera une autre.
            }
            return places;
        }

        /**
         * Détecte TOUS les alignements ≥ 3 en ligne ou en colonne.
         *
         * @returns {Array<{type:number, ligne:number, colonne:number,
         *   longueur:number, horizontal:boolean}>} un élément par alignement.
         */
        detecterAlignements() {
            const resultats = [];

            // --- Lignes ----------------------------------------------------
            for (let l = 0; l < this.taille; l++) {
                let c = 0;
                while (c < this.taille) {
                    const type = this.cases[l][c];
                    if (type === null) { c++; continue; }
                    let fin = c + 1;
                    while (fin < this.taille && this.cases[l][fin] === type) fin++;
                    if (fin - c >= 3) {
                        resultats.push({
                            type: type, ligne: l, colonne: c,
                            longueur: fin - c, horizontal: true
                        });
                    }
                    c = fin;
                }
            }

            // --- Colonnes ----------------------------------------------------
            for (let c = 0; c < this.taille; c++) {
                let l = 0;
                while (l < this.taille) {
                    const type = this.cases[l][c];
                    if (type === null) { l++; continue; }
                    let fin = l + 1;
                    while (fin < this.taille && this.cases[fin][c] === type) fin++;
                    if (fin - l >= 3) {
                        resultats.push({
                            type: type, ligne: l, colonne: c,
                            longueur: fin - l, horizontal: false
                        });
                    }
                    l = fin;
                }
            }

            return resultats;
        }
    }

    return Grille;
});
