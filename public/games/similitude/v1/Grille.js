/*
 * Grille.js — état de la grille, placement, détection d'alignements,
 * sélection, déplacement, résolution, spawn et score (spec 473 §2, §3, §5).
 *
 * LOGIQUE PURE : aucun appel Phaser, aucun accès au DOM. C'est ce qui permet
 * de tester le cœur de jeu en headless, sans navigateur (spec 473 §9). Le
 * fichier est chargé dans le navigateur (window.Grille) ET importable sous
 * Node (module.exports) pour les tests.
 *
 * Les types d'items sont des entiers 0..(typesItems−1) ; la correspondance
 * type → texture vit dans config.js (tableau items, même ordre).
 *
 * AUCUNE valeur chiffrée ici : la grille (taille, types), le barème
 * (points/énergie/temps), l'énergie et le chrono de départ, le coût d'un
 * déplacement — tout vient du constructeur (config.js en pratique, spec
 * §10). La seule exception est le seuil « 3 alignés ou plus », qui EST la
 * règle du jeu (spec §2) et pas un réglage d'équilibrage.
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
         *   minimal {grilleTaille, typesItems, bareme, energieDepart,
         *   tempsDepart, energieDeplacement}.
         */
        constructor(cfg) {
            cfg = cfg || {};
            this.taille = cfg.grilleTaille || 9;
            this.types = cfg.typesItems || 6;
            // Barème {points(n), energie(n), temps(n)} — fourni par config.js.
            this.bareme = cfg.bareme || null;
            // Coût d'un déplacement en ⚡ (spec §3) — prélevé AU DÉPLACEMENT.
            this.energieDeplacement = cfg.energieDeplacement || 0;
            this.cases = this.creerGrilleVide();
            // Item sélectionné : {l, c} ou null (spec §3).
            this.selection = null;
            // État de la partie (spec §4, §5) — lu par le HUD en SIM-3.
            this.score = 0;
            this.energie = cfg.energieDepart !== undefined ? cfg.energieDepart : 0;
            this.temps = cfg.tempsDepart !== undefined ? cfg.tempsDepart : 0;
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

        /**
         * Sélection (spec §3) — clic/tap sur un item :
         *   - pas de sélection → l'item devient sélectionné ;
         *   - re-clic sur le même item → désélection ;
         *   - clic sur un AUTRE item → la sélection se déplace sur lui
         *     (jamais d'échange de deux items) ;
         *   - clic sur une case vide → ignoré.
         *
         * AUCUN coût : le ⚡ n'est prélevé qu'au déplacement.
         *
         * @returns {{selection: object|null, changement: string}}
         *   changement : "selection" | "deselection" | "vide".
         */
        selectionner(l, c) {
            if (this.get(l, c) === null) {
                return { selection: this.selection, changement: "vide" };
            }
            if (this.selection && this.selection.l === l && this.selection.c === c) {
                this.selection = null;
                return { selection: null, changement: "deselection" };
            }
            this.selection = { l: l, c: c };
            return { selection: { l: l, c: c }, changement: "selection" };
        }

        /**
         * Déplacement (spec §3) : l'item (l1, c1) va vers la case vide
         * (l2, c2) — n'importe quelle case vide, sans contrainte de distance
         * ni de chemin (pas de pathfinding). Coût : energieDeplacement ⚡,
         * prélevé AU DÉPLACEMENT, jamais à la sélection. Le tour est joué :
         * la sélection s'efface.
         *
         * @returns {{ok: boolean, raison?: string, energie?: number}}
         */
        deplacer(l1, c1, l2, c2) {
            if (this.get(l1, c1) === null) return { ok: false, raison: "origine-vide" };
            if (this.get(l2, c2) !== null) return { ok: false, raison: "cible-occupee" };
            if (this.energie < this.energieDeplacement) return { ok: false, raison: "plus-energie" };
            this.set(l2, c2, this.get(l1, c1));
            this.set(l1, c1, null);
            this.energie -= this.energieDeplacement;
            this.selection = null;
            return { ok: true, energie: this.energie };
        }

        /**
         * Résolution (spec §3, §5) : scan complet de la grille ; tous les
         * alignements ≥ 3 (ligne ou colonne uniquement, pas de diagonale,
         * pas d'amas) disparaissent SIMULTANÉMENT. Pas de gravité : les
         * cases libérées restent vides.
         *
         * Un item au croisement d'une ligne et d'une colonne valides fait
         * disparaître les deux alignements mais n'est retiré qu'UNE seule
         * fois (union des positions) — il n'est compté qu'une fois.
         *
         * Score (spec §5) : chaque alignement de longueur n rapporte
         * bareme.points(n) pts, bareme.energie(n) ⚡ et bareme.temps(n) s
         * (valeurs de config.js, jamais en dur ici). Combo (2 alignements ou
         * plus dans le même coup) : le total du coup est doublé — score,
         * énergie et temps.
         *
         * @returns {object} {alignements, retires, gains, combo, aucun}
         *   — aucun: true si RIEN n'a sauté (⇒ le tour se termine par un
         *     spawn de nouveaux items, spec §3).
         */
        resoudre() {
            const alignements = this.detecterAlignements();
            if (!alignements.length) {
                return {
                    alignements: [], retires: [],
                    gains: { score: 0, energie: 0, temps: 0 },
                    combo: false, aucun: true
                };
            }

            // Positions à vider — union de tous les alignements : chaque
            // item n'est retiré qu'UNE seule fois, même au croisement
            // ligne/colonne (spec §3).
            const aRetirer = new Set();
            alignements.forEach((a) => {
                if (a.horizontal) {
                    for (let x = a.colonne; x < a.colonne + a.longueur; x++) {
                        aRetirer.add(a.ligne + "," + x);
                    }
                } else {
                    for (let y = a.ligne; y < a.ligne + a.longueur; y++) {
                        aRetirer.add(y + "," + a.colonne);
                    }
                }
            });

            const retires = [];
            aRetirer.forEach((cle) => {
                const [l, c] = cle.split(",").map(Number);
                this.set(l, c, null);
                retires.push({ l: l, c: c });
            });

            // Gains — barème de config.js (spec §5), jamais en dur ici.
            let score = 0, energie = 0, temps = 0;
            if (this.bareme) {
                alignements.forEach((a) => {
                    score += this.bareme.points(a.longueur);
                    energie += this.bareme.energie(a.longueur);
                    temps += this.bareme.temps(a.longueur);
                });
            }

            // Combo (spec §5) : 2 alignements ou plus dans le même coup.
            const combo = alignements.length >= 2;
            if (combo) { score *= 2; energie *= 2; temps *= 2; }

            this.score += score;
            this.energie += energie;
            this.temps += temps;

            return {
                alignements: alignements,
                retires: retires,
                gains: { score: score, energie: energie, temps: temps },
                combo: combo,
                aucun: false
            };
        }

        /**
         * Spawn (spec §3) : après un coup raté, `nbItems` nouveaux items
         * apparaissent sur des cases vides tirées au hasard (types tirés au
         * hasard aussi).
         *
         * @returns {Array<{l:number, c:number, type:number}>} les items
         *   posés (moins que demandé si la grille est saturée).
         */
        spawner(nbItems) {
            const poses = [];
            for (let i = 0; i < nbItems; i++) {
                const vides = [];
                for (let l = 0; l < this.taille; l++) {
                    for (let c = 0; c < this.taille; c++) {
                        if (this.cases[l][c] === null) vides.push([l, c]);
                    }
                }
                if (!vides.length) break;    // grille saturée : on s'arrête
                const p = vides[Math.floor(Math.random() * vides.length)];
                const type = Math.floor(Math.random() * this.types);
                this.set(p[0], p[1], type);
                poses.push({ l: p[0], c: p[1], type: type });
            }
            return poses;
        }
    }

    return Grille;
});
