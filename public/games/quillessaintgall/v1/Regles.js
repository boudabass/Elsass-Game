/*
 * Regles.js — règles et score d'un jet de Quilles Saint-Gall : valeur en
 * points selon le type du jet (plein, figure, ordre imposé), quille tombée
 * ou non, ordre de chute des phases D/E, cible et ricochet, index de la
 * quille prépondérante du jet.
 *
 * Extrait de GameScene.js le 07/11/2026 (GameScene.js dépassait 1500 lignes)
 * — DÉPLACEMENT DE CODE PUR, aucun changement de comportement (mêmes
 * formules, même ordre des opérations).
 *
 * Ne possède PAS l'état de la partie : `scene.jetConfig`, `scene.quilles`,
 * `scene.ordreChute`, `scene.quillesTombeesCount` sont posés par GameScene
 * (_demarrerJet) et par Quilles.js (_toucherQuille), et lus ici en lecture
 * seule. Aucun appel Phaser, sauf `getData` sur les quilles pour lire
 * leur état (« debout », « absente »).
 */

class Regles {
    /** @param {Phaser.Scene} scene la GameScene propriétaire */
    constructor(scene) {
        this.scene = scene;
    }

    /**
     * Calcule le résultat du jet qui vient de se terminer, selon son
     * type (cf. config.jets) : { annule, points }. `annule` ne peut être
     * vrai que pour un jet à ordre imposé (D/E) — cf. _calculerOrdreJet.
     */
    _calculerScoreJet() {
        const scene = this.scene;
        const jc = scene.jetConfig;
        if (jc.type === "plein") {
            // Jet 4 (phase B) : 2 bois/quille SI la prépondérante (idx8,
            // cf. config.js) est tombée, sinon 1 bois/quille (texte
            // fédéral) — jets 1-3 n'ont pas de `prependerante` et gardent
            // le barème flat `pointsParQuille`.
            if (jc.prependerante !== undefined) {
                const prependeranteEstTombee = this._quilleEstTombee(jc.prependerante);
                const parQuille = prependeranteEstTombee ? jc.pointsSiPrependerante : jc.pointsSinon;
                return { annule: false, points: scene.quillesTombeesCount * parQuille };
            }
            return { annule: false, points: scene.quillesTombeesCount * jc.pointsParQuille };
        }
        if (jc.type === "figure") {
            const prependeranteEstTombee = this._quilleEstTombee(jc.figure.prependerante);
            const parQuille = prependeranteEstTombee ? jc.pointsSiPrependerante : jc.pointsSinon;
            return { annule: false, points: scene.quillesTombeesCount * parQuille };
        }
        return this._calculerOrdreJet(jc);
    }

    _quilleEstTombee(index) {
        const scene = this.scene;
        const q = scene.quilles[index];
        return !!q && !q.getData("debout") && !q.getData("absente");
    }

    /**
     * Ordre imposé (phases D/E, règlement fédéral, persistance des
     * quilles tombées cf. _demarrerJet) : la figure est posée une seule
     * fois pour toute la phase, ce jet ne vise qu'UNE quille cible
     * (jc.cible, les autres quilles ENCORE debout de la figure restent
     * des obstacles), avec sa propre valeur en points (jc.points).
     *   - la cible tombe SEULE → points = jc.points, elle reste tombée
     *     pour la suite de la phase (cf. _jetTermine) ;
     *   - EXCEPTION fédérale (jc.ricochetAutorise, jets 12/16
     *     uniquement) : la cible ET la TOUTE DERNIÈRE quille de la phase
     *     tombent ENSEMBLE (ricochet), rien d'autre → pas une faute, les
     *     2 jets sont validés d'un coup (cf. _jetTermine, avance de 2) ;
     *   - aucune quille requise ne tombe → PAS une faute (art. 877
     *     art. 10), jet compté 0 point, on passe au jet suivant ;
     *   - tout autre cas (mauvaise quille, 2+ quilles requises
     *     simultanément hors ricochet) → violation : les quilles requises
     *     du jet se relèvent, réédition SANS LIMITE de reprises.
     */
    _calculerOrdreJet(jc) {
        const scene = this.scene;
        const chutes = scene.ordreChute.filter((c) => jc.figure.indices.includes(c.index));
        const indicesChus = chutes.map((c) => c.index);

        if (jc.ricochetAutorise) {
            const derniere = this._dernierCiblePhase(jc.phase);
            const estRicochet = indicesChus.length === 2 &&
                indicesChus.includes(jc.cible) && indicesChus.includes(derniere.cible);
            if (estRicochet) {
                return { annule: false, points: jc.points, ricochet: true,
                    pointsSupplementaires: derniere.points };
            }
        }

        // Aucune quille de la figure n'est tombée : cible non atteinte
        // SANS violation (art. 877 art. 10) → 0 point, jet suivant.
        if (indicesChus.length === 0) return { annule: true, violation: false };

        // La cible tombe seule → jet conforme, points normaux.
        if (indicesChus.length === 1 && indicesChus[0] === jc.cible) return { annule: false, points: jc.points };

        // Tout autre cas (mauvaise quille, 2+ quilles requises ensemble
        // hors ricochet) → violation : les quilles requises se relèvent,
        // réédition sans limite.
        return { annule: true, violation: true };
    }

    /** Cible + points du DERNIER jet de la phase D ou E (exception de
     * ricochet, cf. _calculerOrdreJet / _jetTermine). */
    _dernierCiblePhase(phase) {
        const C = window.QuillesSaintGallConfig;
        const jetsPhase = C.jets.filter((j) => j.phase === phase);
        const dernier = jetsPhase[jetsPhase.length - 1];
        return { cible: dernier.cible, points: dernier.points };
    }

    /**
     * Indice (0-8) de la quille prépondérante du jet en cours, ou
     * `undefined` si ce jet n'en a pas (phases D/E : `cible` joue un rôle
     * équivalent mais n'est pas une « prépondérante », cf. config.jets).
     * Lu directement depuis `config.jets` — CHAQUE jet a son propre indice,
     * indépendant des autres (pas de quille physique fixe/spéciale, cf.
     * en-tête de config.js).
     */
    _indexPrependeranteDuJet() {
        const scene = this.scene;
        const jc = scene.jetConfig;
        if (!jc) return undefined;
        if (jc.type === "figure") return jc.figure.prependerante;
        if (jc.type === "plein") return jc.prependerante;
        return undefined;
    }

    /**
     * Quille « à viser » du jet en cours (rouge à l'écran, cf.
     * Quilles._appliquerEtatQuille) : la prépondérante (phases A à C), ou la
     * cible (phases D/E, ordre imposé). Sert à l'AFFICHAGE seulement : le
     * score passe toujours par _indexPrependeranteDuJet et _calculerOrdreJet.
     */
    _indexQuilleAViser() {
        const jc = this.scene.jetConfig;
        if (jc && jc.type === "ordre") return jc.cible;
        return this._indexPrependeranteDuJet();
    }
}
