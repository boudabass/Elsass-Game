/*
 * sol.js — machine à états sol/pousse/récolte d'Elsass Farm (proposition
 * Bloc A, point 5 — OPTION B recommandée).
 *
 * 4 états explicites + attributs par case :
 *   "vide" (absent de l'état) → "labouree" → "plantee" → "prete" → "vide"
 *   attributs : etapes (0..seuil), arrosee (booléen journalier), jourPlante
 *
 * Transitions (proposition) :
 *   vide → labouree  : clic action avec la pelle
 *   labouree → plantee : clic action avec les graines (pose jourPlante)
 *   plantee → etapes+1 : tick quotidien au réveil SI arrosee (non arrosée :
 *                        ne pousse pas, ne meurt pas)
 *   plantee → prete  : quand etapes >= seuil (config.sol.etapesPousse)
 *   prete → vide (via état transitoire "récoltée") : clic action avec la main
 *   plantee/prete → vide : changement de saison détruit les cultures
 *                          non récoltées
 *   arrosage : clic action avec l'arrosoir (case plantée non arrosée) ;
 *              reset arrosee à chaque réveil
 *
 * Données persistées : data.sols = { "zone": { "x,y": {etat, jourPlante,
 * etapes, arrosee} } } — uniquement les cases non vides, indexées par zone.
 */
window.FarmSol = {
    /** Clé d'une case dans data.sols : "x,y". */
    cle: function (x, y) {
        return x + "," + y;
    },

    /** État d'une case (null si vide / jamais touchée). */
    case: function (etat, zone, x, y) {
        const z = etat.sols[zone];
        return (z && z[this.cle(x, y)]) || null;
    },

    /** Pose (ou supprime, si etat === "vide") une case dans l'état. */
    poser: function (etat, zone, x, y, c) {
        if (!etat.sols[zone]) etat.sols[zone] = {};
        const k = this.cle(x, y);
        if (c.etat === "vide") {
            delete etat.sols[zone][k];
        } else {
            etat.sols[zone][k] = c;
        }
        // Une zone sans aucune case cultivée disparaît de l'état
        // (data.sols ne garde que les cases non vides, proposition point 5).
        if (Object.keys(etat.sols[zone]).length === 0) delete etat.sols[zone];
    },

    /** vide → labouree (pelle). Retourne true si l'action a eu lieu. */
    labourer: function (etat, zone, x, y) {
        if (this.case(etat, zone, x, y)) return false;
        this.poser(etat, zone, x, y,
            { etat: "labouree", jourPlante: 0, etapes: 0, arrosee: false });
        return true;
    },

    /** labouree → plantee (graines ; pose jourPlante = jour courant). */
    planter: function (etat, zone, x, y, C, jour) {
        const c = this.case(etat, zone, x, y);
        if (!c || c.etat !== "labouree") return false;
        c.etat = "plantee";
        c.jourPlante = jour;
        c.etapes = 0;
        c.arrosee = false;
        return true;
    },

    /** plantee non arrosée → arrosee (arrosoir). */
    arroser: function (etat, zone, x, y) {
        const c = this.case(etat, zone, x, y);
        if (!c || c.etat !== "plantee" || c.arrosee) return false;
        c.arrosee = true;
        return true;
    },

    /** prete → vide (via état transitoire "récoltée" ; inventaire = Bloc C). */
    recolter: function (etat, zone, x, y, C) {
        const c = this.case(etat, zone, x, y);
        if (!c || c.etat !== "prete") return false;
        // L'ajout d'inventaire se branchera ici au Bloc C (proposition point 5).
        this.poser(etat, zone, x, y, { etat: "vide" });
        return true;
    },

    /**
     * Tick quotidien, exécuté au réveil (sommeil, point 6) quand t passe
     * de tAvant à tApres : pousse des cultures arrosées (une étape par
     * jour), reset de l'arrosage, destruction des cultures non récoltées
     * au changement de saison.
     */
    tickNuit: function (etat, C, tAvant, tApres) {
        const jourAvant = FarmHorloge.jour(tAvant);
        const jourApres = FarmHorloge.jour(tApres);
        const saisonAvant = FarmHorloge.saison(tAvant);
        const saisonApres = FarmHorloge.saison(tApres);
        const jours = Math.max(1, jourApres - jourAvant);

        for (const zone in etat.sols) {
            const z = etat.sols[zone];
            for (const k in z) {
                const c = z[k];
                if (c.etat !== "plantee" && c.etat !== "prete") continue;

                // Changement de saison : détruit les cultures non récoltées.
                if (saisonApres !== saisonAvant) {
                    delete z[k];
                    continue;
                }
                if (c.etat === "plantee") {
                    if (c.arrosee) {
                        c.etapes = Math.min(c.etapes + jours, 100);
                        if (c.etapes >= C.sol.etapesPousse) c.etat = "prete";
                    }
                    // Reset de l'arrosage à chaque réveil.
                    c.arrosee = false;
                }
            }
            if (Object.keys(z).length === 0) delete etat.sols[zone];
        }
    }
};
