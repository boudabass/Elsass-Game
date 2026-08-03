/*
 * core/score.js — meilleur score du joueur.
 *
 * Le serveur fait autorité : il ne conserve que le meilleur score par joueur
 * et par jeu, et renvoie la valeur retenue. On garde une copie dans le
 * navigateur pour que le menu affiche un chiffre même hors-ligne.
 */
(function () {
    "use strict";

    window.Arcade = window.Arcade || {};

    var key = null;

    function localKey() {
        return "arcade:best:" + key;
    }

    Arcade.Score = {
        /** Meilleur score connu (mis à jour par load() et submit()). */
        best: 0,

        /** @param {string} gameKey identifiant court du jeu ("cigogne") */
        configure: function (gameKey) {
            key = gameKey;
        },

        /** Lit le meilleur score local, puis le confronte au classement. */
        load: async function () {
            try {
                var raw = window.localStorage.getItem(localKey());
                if (raw !== null) this.best = Number(raw) || 0;
            } catch (e) { /* stockage indisponible */ }
            return this.best;
        },

        /**
         * Envoie un score en fin de partie.
         * @returns {Promise<boolean>} true si c'est un nouveau record
         */
        submit: async function (value) {
            var v = Math.round(value);
            var record = v > this.best;

            if (record) {
                this.best = v;
                try {
                    window.localStorage.setItem(localKey(), String(v));
                } catch (e) { /* stockage indisponible */ }
            }

            var serverBest = await Arcade.Platform.score.submit(v);
            // Le serveur peut connaître un meilleur score fait sur un autre
            // appareil : dans ce cas c'est lui qui a raison.
            if (typeof serverBest === "number" && serverBest > this.best) {
                this.best = serverBest;
                try {
                    window.localStorage.setItem(localKey(), String(serverBest));
                } catch (e) { /* stockage indisponible */ }
                record = false;
            }

            return record;
        }
    };
})();
