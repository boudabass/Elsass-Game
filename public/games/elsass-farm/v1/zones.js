/*
 * zones.js — chargement/lecture de zones.json (zones + portails,
 * 100 % data-driven — proposition Bloc A, point 2).
 *
 * zones.json (dans v1/, PAS dans core/) décrit chaque zone Tiled :
 *   {
 *     "zones": [
 *       { "id": "ferme",
 *         "tiled": "assets/maps/ferme-test.json",   // export Tiled
 *         "apparition": { "x": 14, "y": 16 },        // tuile d'arrivée
 *         "portails": [
 *           { "id": "...", "type": "simple",
 *             "tuile": { "x": 5, "y": 0 },
 *             "cible": { "zone": "maison-rdc", "apparition": { "x": 6, "y": 8 } } },
 *           { "id": "...", "type": "choix",
 *             "tuile": { "x": 11, "y": 2 },
 *             "choix": [ { "label": "...", "cible": {...} },
 *                        { "label": "...", "cible": null } ] }
 *         ],
 *         "lit": { "x": 2, "y": 2 } }                // point de sommeil (optionnel)
 *     ]
 *   }
 *
 * Les portails ne sont PAS posés dans Tiled : ils vivent ici (point 2).
 * Remplacer le chemin "tiled" suffit pour changer de carte (cartes de test
 * provisoires, dessinées par John plus tard).
 */
window.FarmZones = {
    KEY: "farm-zones",

    /** Charge zones.json (à appeler dans le preload du boot). */
    charger: function (scene) {
        scene.load.json(this.KEY, "zones.json");
    },

    /** Données brutes de zones.json (depuis le cache Phaser). */
    donnees: function (scene) {
        return scene.cache.json.get(this.KEY) || { zones: [] };
    },

    /**
     * Zone par id — repli sur la PREMIÈRE zone déclarée si l'id est
     * inconnu (garde-fou : une sauvegarde peut référencer une zone qui
     * n'existe plus dans zones.json).
     */
    zone: function (scene, id) {
        const zones = this.donnees(scene).zones || [];
        const trouvee = zones.find((z) => z.id === id);
        return trouvee || zones[0] || null;
    },

    /** Portails de la zone (liste vide si aucun). */
    portails: function (scene, zoneId) {
        const z = this.zone(scene, zoneId);
        return (z && z.portails) || [];
    },

    /** Tuile du lit de la zone (sommeil, point 6) ou null. */
    lit: function (scene, zoneId) {
        const z = this.zone(scene, zoneId);
        return (z && z.lit) || null;
    }
};
