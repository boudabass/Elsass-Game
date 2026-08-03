/*
 * core/save.js — sauvegarde des parties.
 *
 * CONTRAT DE SAVE (à respecter par tous les jeux) :
 *  1. Toute sauvegarde porte un numéro de VERSION.
 *  2. Quand le format change, on incrémente la version ET on écrit une
 *     migration. On ne casse JAMAIS la partie d'un joueur.
 *  3. Deux copies : le navigateur (instantané, hors-ligne) et le serveur
 *     (suit le joueur d'un appareil à l'autre). En cas de désaccord, la plus
 *     RÉCENTE gagne.
 *
 * Format stocké : { v: 3, t: 1780000000000, data: { ...le jeu... } }
 *   v = version du format, t = date de la sauvegarde (ms)
 */
(function () {
    "use strict";

    window.Arcade = window.Arcade || {};

    var cfg = null;          // configuration fournie par le jeu
    var timer = null;        // minuterie de sauvegarde automatique
    var lastCloudAt = 0;     // dernier envoi serveur réussi

    var CLOUD_EVERY_MS = 5 * 60 * 1000; // 5 minutes

    function storageKey() {
        return "arcade:save:" + cfg.key;
    }

    /** Applique les migrations une par une jusqu'à la version courante. */
    function migrate(blob) {
        if (!blob || typeof blob !== "object") return null;
        var v = typeof blob.v === "number" ? blob.v : 1;
        var data = blob.data;

        while (v < cfg.version) {
            var step = cfg.migrations ? cfg.migrations[v] : null;
            if (typeof step !== "function") {
                console.warn(
                    "[Save] Pas de migration de la version " + v + " vers " + (v + 1) +
                    " : sauvegarde abandonnée (nouvelle partie)."
                );
                return null;
            }
            try {
                data = step(data);
                v++;
                console.log("[Save] Migration vers la version " + v + " effectuée.");
            } catch (e) {
                console.error("[Save] Migration " + v + " en échec :", e);
                return null;
            }
        }

        // Sauvegarde plus récente que le code (joueur revenu à une vieille
        // version du jeu) : on n'y touche pas, on refuse de la lire.
        if (v > cfg.version) {
            console.warn("[Save] Sauvegarde en version " + v + ", le jeu attend " + cfg.version + ". Ignorée.");
            return null;
        }

        return data;
    }

    function readLocal() {
        try {
            var raw = window.localStorage.getItem(storageKey());
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function snapshot() {
        return { v: cfg.version, t: Date.now(), data: cfg.gather() };
    }

    Arcade.Save = {
        /**
         * @param {object} o
         * @param {string}   o.key         identifiant court du jeu ("cigogne")
         * @param {number}   o.version     version du format (entier, commence à 1)
         * @param {object}   [o.migrations] { 1: (data)=>data, 2: (data)=>data }
         * @param {function} o.gather      renvoie l'objet à sauvegarder
         * @param {function} o.apply       reçoit l'objet chargé
         */
        configure: function (o) {
            cfg = Object.assign({ version: 1, migrations: {} }, o);
        },

        /** Charge la sauvegarde (locale + serveur, la plus récente gagne). */
        load: async function () {
            if (!cfg) throw new Error("[Save] configure() n'a pas été appelé.");

            var local = readLocal();
            var cloud = await Arcade.Platform.cloud.read();

            var chosen = null;
            var tLocal = local && typeof local.t === "number" ? local.t : -1;
            var tCloud = cloud && typeof cloud.t === "number" ? cloud.t : -1;

            if (tCloud > tLocal) {
                chosen = cloud;
                console.log("[Save] Sauvegarde serveur retenue (plus récente).");
            } else if (local) {
                chosen = local;
                console.log("[Save] Sauvegarde locale retenue.");
            }

            if (!chosen) {
                console.log("[Save] Aucune sauvegarde : nouvelle partie.");
                return false;
            }

            var data = migrate(chosen);
            if (data === null) return false;

            try {
                cfg.apply(data);
                return true;
            } catch (e) {
                console.error("[Save] Application de la sauvegarde en échec :", e);
                return false;
            }
        },

        /** Écrit immédiatement dans le navigateur (rapide, jamais bloquant). */
        saveLocal: function () {
            if (!cfg) return;
            try {
                window.localStorage.setItem(storageKey(), JSON.stringify(snapshot()));
            } catch (e) {
                console.warn("[Save] Écriture locale impossible :", e);
            }
        },

        /** Envoie au serveur (à ne pas appeler à chaque image). */
        saveCloud: async function () {
            if (!cfg) return false;
            var ok = await Arcade.Platform.cloud.write(snapshot());
            if (ok) lastCloudAt = Date.now();
            return ok;
        },

        /** Local + serveur si le délai est écoulé. */
        save: function () {
            this.saveLocal();
            if (Date.now() - lastCloudAt >= CLOUD_EVERY_MS) this.saveCloud();
        },

        /**
         * Démarre la sauvegarde automatique : local toutes les 30 s, serveur
         * toutes les 5 min, plus un envoi de secours quand le joueur quitte.
         */
        startAutosave: function () {
            if (timer) return;
            timer = window.setInterval(function () {
                Arcade.Save.save();
            }, 30 * 1000);

            // Le joueur ferme l'onglet ou repasse à l'accueil : dernier envoi.
            var flush = function () {
                Arcade.Save.saveLocal();
                Arcade.Platform.cloud.writeBeacon(snapshot());
            };
            document.addEventListener("visibilitychange", function () {
                if (document.visibilityState === "hidden") flush();
            });
            window.addEventListener("pagehide", flush);
        },

        /** Efface la sauvegarde locale (le serveur garde la sienne). */
        clearLocal: function () {
            try {
                window.localStorage.removeItem(storageKey());
            } catch (e) { /* rien à faire */ }
        }
    };
})();
