/*
 * Profil.js — profil persistant de Similitude (spec 728 §8).
 *
 * LOGIQUE PURE : aucun appel Phaser, aucun accès au DOM ni au stockage.
 * C'est ce qui permet de tester le contrat de save en headless, sans
 * navigateur (même principe que Grille.js, spec 473 §9). Le fichier est
 * chargé dans le navigateur (window.Profil) ET importable sous Node
 * (module.exports) pour les tests.
 *
 * Le PROFIL se sauvegarde (pièces + inventaire de jokers), jamais le
 * déroulé d'une partie (ni grille, ni score en cours, ni chrono —
 * spec 728 §2, §8). Le câblage vers core/save.js se fait dans main.js.
 *
 * Contrat de save v1 (spec 728 §8) :
 *   data: {
 *     wallet: 0,                       // pièces (entier ≥ 0)
 *     inventaire: {                    // quantité par joker (entiers ≥ 0)
 *       marteau: 0, melange: 0, sablier: 0, foudre: 0
 *     }
 *   }
 * apply() assainit : entiers ≥ 0, joker inconnu ignoré. La liste des
 * jokers connus vient de la config (C.jokers) — tout joker absent de
 * cette liste est ignoré à la lecture.
 *
 * AUCUNE valeur chiffrée ici : les seuils de l'économie (points par
 * pièce, prime de record) viennent de C.economie (spec 728 §4, §10).
 */
(function (root, factory) {
    if (typeof module !== "undefined" && module.exports) {
        module.exports = factory();
    } else {
        root.Profil = factory();
    }
})(typeof window !== "undefined" ? window : this, function () {
    "use strict";

    /** Profil neuf : zéro pièce, zéro joker de chaque type. */
    function creer(cfg) {
        var inventaire = {};
        (cfg && cfg.jokers || []).forEach(function (j) {
            inventaire[j.cle] = 0;
        });
        return { wallet: 0, inventaire: inventaire };
    }

    /** Entier ≥ 0 (tronque les décimaux, ignore les valeurs invalides). */
    function entierPositif(v) {
        if (typeof v !== "number" || !isFinite(v)) return 0;
        return Math.max(0, Math.floor(v));
    }

    /**
     * Assainit un objet de sauvegarde (contrat spec 728 §8) :
     *  - wallet : entier ≥ 0 ;
     *  - inventaire : entier ≥ 0 par joker ;
     *  - joker inconnu (absent de cfg.jokers) : ignoré ;
     *  - toute valeur manquante ou invalide → 0.
     *
     * @param {*} data  objet data d'une sauvegarde (peut être n'importe quoi)
     * @param {object} cfg  config du jeu (liste des jokers connus : cfg.jokers)
     * @returns {object} un profil TOUJOURS propre, prêt à l'emploi
     */
    function assainir(data, cfg) {
        var profil = creer(cfg);
        if (!data || typeof data !== "object") return profil;

        profil.wallet = entierPositif(data.wallet);

        var inventaire = (data.inventaire && typeof data.inventaire === "object")
            ? data.inventaire : {};
        (cfg && cfg.jokers || []).forEach(function (j) {
            profil.inventaire[j.cle] = entierPositif(inventaire[j.cle]);
        });

        return profil;
    }

    /**
     * Gain de fin de partie (spec 728 §4) :
     *   1 pièce par tranche de pointsParPiece points (arrondi à l'inférieur),
     *   + primeRecordPieces de prime si la partie bat le record personnel.
     *
     * @param {number} score        score final de la partie
     * @param {boolean} estRecord   true si la partie bat le record personnel
     * @param {object} cfg          config du jeu (C.economie)
     * @returns {{pieces:number, prime:number, total:number}}
     */
    function calculerGain(score, estRecord, cfg) {
        var e = (cfg && cfg.economie) || {};
        var pointsParPiece = e.pointsParPiece || 0;
        var pieces = pointsParPiece > 0
            ? Math.floor(Math.max(0, score) / pointsParPiece)
            : 0;
        var prime = estRecord ? (e.primeRecordPieces || 0) : 0;
        return { pieces: pieces, prime: prime, total: pieces + prime };
    }

    /**
     * Ajoute un gain au porte-monnaie du profil (mutations en place).
     * @param {object} profil  profil courant (celui de main.js)
     * @param {{total:number}} gain  gain calculé par calculerGain()
     */
    function appliquerGain(profil, gain) {
        if (!profil || !gain) return;
        var montant = entierPositif(gain.total);
        profil.wallet = entierPositif(profil.wallet) + montant;
    }

    /**
     * Achat d'un joker en boutique (spec 728 §5 — SIM-8).
     *
     * LOGIQUE PURE : ne fait que vérifier et muter le profil — l'écriture
     * de la save (local + cloud) appartient à la scène (action explicite
     * du joueur, spec 728 §2/§5). Rachetable à l'infini : aucun plafond.
     *
     * JAMAIS d'achat qui échoue en silence : le retour indique la raison.
     *
     * @param {object} profil  profil courant (wallet + inventaire)
     * @param {string} cle     clé du joker (marteau | melange | sablier |
     *                         foudre — config.jokers)
     * @param {object} cfg     config du jeu (C.boutique.prix)
     * @returns {{ok:boolean, raison?:string}}
     *   {ok:true}                      achat effectué (wallet déduit,
     *                                  inventaire incrémenté)
     *   {ok:false, raison:"inconnu"}   joker inconnu / pas de prix
     *   {ok:false, raison:"pas_assez"} pièces insuffisantes (rien ne bouge)
     */
    function acheter(profil, cle, cfg) {
        if (!profil || typeof profil !== "object") {
            return { ok: false, raison: "inconnu" };
        }
        var prixTable = (cfg && cfg.boutique && cfg.boutique.prix) || {};
        var connu = (cfg && cfg.jokers || []).some(function (j) {
            return j.cle === cle;
        });
        var prix = entierPositif(prixTable[cle]);
        if (!connu || prix <= 0) return { ok: false, raison: "inconnu" };

        var wallet = entierPositif(profil.wallet);
        if (wallet < prix) return { ok: false, raison: "pas_assez" };

        profil.wallet = wallet - prix;
        profil.inventaire[cle] = entierPositif(profil.inventaire[cle]) + 1;
        return { ok: true };
    }

    return {
        creer: creer,
        assainir: assainir,
        calculerGain: calculerGain,
        appliquerGain: appliquerGain,
        acheter: acheter
    };
});
