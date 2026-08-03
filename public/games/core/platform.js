/*
 * core/platform.js — pont entre un jeu et l'arcade.
 *
 * C'est le SEUL fichier qui connaît les URL de l'API. Un jeu ne fait jamais
 * de fetch lui-même : il passe toujours par Arcade.Platform.
 *
 * L'identifiant du jeu vient de l'URL (?gid=12), injecté par la page /play.
 * C'est la source de vérité : jamais un nom codé en dur dans le jeu.
 */
(function () {
    "use strict";

    window.Arcade = window.Arcade || {};

    // --- Identifiant du jeu -------------------------------------------------
    var gameId = null;
    try {
        var raw = new URLSearchParams(window.location.search).get("gid");
        if (raw !== null && raw.trim() !== "" && !Number.isNaN(Number(raw))) {
            gameId = Number(raw);
        }
    } catch (e) {
        /* location indisponible : on continue en mode hors-ligne */
    }

    var online = gameId !== null;
    if (!online) {
        console.warn(
            "[Platform] Aucun ?gid= dans l'URL : mode hors-ligne. " +
            "Les scores et la sauvegarde cloud sont désactivés, " +
            "la sauvegarde locale continue de fonctionner."
        );
    }

    Arcade.Platform = {
        /** Identifiant numérique du jeu, ou null hors plateforme. */
        gameId: gameId,

        /** true si le jeu tourne bien dans l'arcade (donc API disponible). */
        online: online,

        // --- Scores ---------------------------------------------------------
        score: {
            /**
             * Envoie un score. Le serveur ne garde que le meilleur.
             * @returns {Promise<number|null>} le meilleur score du joueur
             */
            submit: async function (value) {
                if (!online) return null;
                try {
                    var res = await fetch("/api/scores", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ gameId: gameId, score: Math.round(value) })
                    });
                    if (!res.ok) throw new Error("HTTP " + res.status);
                    var json = await res.json();
                    return typeof json.best === "number" ? json.best : null;
                } catch (e) {
                    console.error("[Platform] Envoi du score impossible :", e);
                    return null;
                }
            },

            /** Classement du jeu (100 meilleurs). */
            leaderboard: async function () {
                if (!online) return [];
                try {
                    var res = await fetch("/api/scores?gameId=" + gameId);
                    if (!res.ok) throw new Error("HTTP " + res.status);
                    var json = await res.json();
                    return json.scores || [];
                } catch (e) {
                    console.error("[Platform] Classement indisponible :", e);
                    return [];
                }
            }
        },

        // --- Sauvegarde distante (utilisée par core/save.js) -----------------
        cloud: {
            read: async function () {
                if (!online) return null;
                try {
                    var res = await fetch("/api/storage?gameId=" + gameId);
                    if (!res.ok) throw new Error("HTTP " + res.status);
                    var json = await res.json();
                    return json.data || null;
                } catch (e) {
                    console.error("[Platform] Lecture de la sauvegarde impossible :", e);
                    return null;
                }
            },

            write: async function (blob) {
                if (!online) return false;
                try {
                    var res = await fetch("/api/storage", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ gameId: gameId, data: blob })
                    });
                    return res.ok;
                } catch (e) {
                    console.error("[Platform] Écriture de la sauvegarde impossible :", e);
                    return false;
                }
            },

            /**
             * Envoi de dernière seconde (onglet fermé, retour à l'accueil).
             * sendBeacon survit à la fermeture de la page, contrairement à fetch.
             */
            writeBeacon: function (blob) {
                if (!online || !navigator.sendBeacon) return false;
                try {
                    var body = new Blob(
                        [JSON.stringify({ gameId: gameId, data: blob })],
                        { type: "application/json" }
                    );
                    return navigator.sendBeacon("/api/storage", body);
                } catch (e) {
                    return false;
                }
            }
        },

        /** Masque le loader HTML affiché avant le démarrage de Phaser. */
        hideHtmlLoader: function () {
            var el = document.getElementById("boot-loader");
            if (el) el.remove();
        }
    };

    console.log("[Platform] Jeu #" + gameId + (online ? " (en ligne)" : " (hors ligne)"));
})();
