/*
 * main.js — point de départ de Waggis V2.
 * Décrit ce qu'il faut charger, puis laisse le socle démarrer le jeu.
 *
 * ÉTAPE 5 : le personnage (piéton p8city rouge, placeholder — aucun sprite
 * de Waggis dans l'atelier, vérifié 06/08, cf. GameScene) et le son du
 * bond (snd_jump_a de l'atelier, décision John 06/08 : réutiliser les MP3)
 * sont chargés en plus des textures des étapes 2-4.
 *
 * D2-1 (Décisions 2/3/4, spec 708 §7) : le contrat de save (cf.
 * core/save.js) passe en VERSION 2. Le format v1 ({ parties }) est
 * conservé et migré : data.generatedRows (le monde procédural généré,
 * indexé par position — chaque ligne = { index, type, obstacles[],
 * vitesse }) est ajouté. Le monde ne se régénère jamais : il est
 * persisté versionné dans la save ({v, t, data}) et relu tel quel au
 * retour en arrière. L'écriture à la victoire du niveau (spec 708 §9)
 * sera câblée à l'étape D2-3 (fin de niveau).
 *
 * ETAPE-7 (CDC 706 §Score/save) : le contrat passe en VERSION 3 avec
 * data.wallet (pièces, monnaie de déblocage) et data.unlockedCharacters
 * (skins débloqués — décision John 06/08 : personnages historiques
 * d'origine alsacienne, liste précise post-MVP). La MÉCANIQUE
 * pièces/déblocage est post-MVP (scope PRD 705) : le contrat est prêt,
 * les valeurs restent à leurs défauts (wallet 0, seul "waggis" débloqué
 * — le perso de départ est gratuit, comme le poulet de Crossy Road).
 * Le meilleur score, lui, est géré par core/score.js (local + cloud) :
 * boot.js configure la clé, MenuScene affiche Arcade.Score.best après
 * Arcade.Score.load(), OverScene soumet Arcade.Score.submit(score) en
 * fin de partie — rien à ajouter côté save pour le score.
 *
 * ⭐ D2-3 (spec 708 §1/§7/§9/§10) — niveaux finis + save à la victoire :
 *  - la CONFIG PAR NIVEAU est chargée ici depuis levels.json (lignes(niveau)
 *    = 42 + niveau, types autorisés, densité, vitesse, max consécutifs) et
 *    exposée sur WaggisConfig.levels — LaneGenerator la consulte (repli
 *    sur les défauts de config.js si le fichier ne charge pas) ;
 *  - le contrat de save passe en VERSION 4 avec data.currentLevel (le
 *    niveau en cours, CDC 706 §Score/save ; migration 3→4 : défaut 1) ;
 *  - la save n'intervient QU'À LA VICTOIRE du niveau (708 §9) :
 *    startAutosave() est SUPPRIMÉ (plus d'écriture en cours de partie, ni
 *    de flush à la fermeture de l'onglet) — OverScene (mode victoire)
 *    écrit currentLevel = niveau suivant + generatedRows du niveau gagné ;
 *    une fermeture en cours de niveau ne sauvegarde rien : au relancement,
 *    le joueur reste sur son niveau, régénéré à zéro.
 */
(function () {
    "use strict";

    const C = window.WaggisConfig;

    Arcade.boot({
        key: C.key,
        backgroundColor: C.couleurs.ciel,
        scenes: [MenuScene, GameScene, OverScene],
        firstScene: MenuScene.KEY,

        // Chargement : sols, véhicules, flottants, train et décor des bandes
        // générées.
        preload: function (scene) {
            // D2-3 (spec 708 §1/§3/§5/§6) : config par niveau (lignes(niveau)
            // = 42 + niveau, types autorisés, densité, vitesse, max
            // consécutifs) — consultée par LaneGenerator via
            // WaggisConfig.levels (voir create()).
            scene.load.json("levels", "levels.json");

            // Sols des bandes (zone sûre herbe / route asphalte + marquage).
            scene.load.image("herbe", "assets/sol/p8city_herbe.png");
            scene.load.image("herbe_fleurs_roses", "assets/sol/p8city_herbe_fleurs_roses.png");
            scene.load.image("herbe_fleurs_vertes", "assets/sol/p8city_herbe_fleurs_vertes.png");
            scene.load.image("route_pleine", "assets/sol/p8city_route_pleine.png");
            scene.load.image("route_ligne", "assets/sol/p8city_route_ligne_v2.png");

            // D2-2 (spec 708 §3) : terre (tampon du train) et pave (piste
            // d'atterrissage) — textures atelier town_terre_centre* et
            // p8city_pave*, tuilées.
            scene.load.image("terre", "assets/sol/town_terre_centre_v3.png");
            scene.load.image("terre_v2", "assets/sol/town_terre_centre.png");
            scene.load.image("piste", "assets/sol/p8city_pave.png");
            scene.load.image("piste_v2", "assets/sol/p8city_pave_v2.png");
            scene.load.image("piste_v3", "assets/sol/p8city_pave_v3.png");

            // Eau des bandes eau (4 variantes de texture, tuilées).
            scene.load.image("eau", "assets/eau/p8city_eau.png");
            scene.load.image("eau_v2", "assets/eau/p8city_eau_v2.png");
            scene.load.image("eau_v3", "assets/eau/p8city_eau_v3.png");
            scene.load.image("eau_v4", "assets/eau/p8city_eau_v4.png");

            // Flottants des bandes eau : nénuphars rogrpg (simple, double,
            // fleur). Note atelier : aucun rondin dans le catalogue actuel
            // (vérifié 06/08), les nénuphars font les flottants.
            scene.load.image("nenuphar_simple", "assets/eau/rogrpg_nenuphar_simple.png");
            scene.load.image("nenuphar_double", "assets/eau/rogrpg_nenuphar_double.png");
            scene.load.image("nenuphar_fleur", "assets/eau/rogrpg_nenuphar_fleur.png");

            // Voies ferrées des bandes rails (3 variantes, tuilées — le lit
            // de ballast opaque est dessiné sous la texture ajourée).
            scene.load.image("rails_v1", "assets/sol/rogrpg_rails_horizontal_v1.png");
            scene.load.image("rails_v2", "assets/sol/rogrpg_rails_horizontal_v2.png");
            scene.load.image("rails_v3", "assets/sol/rogrpg_rails_horizontal_v3.png");

            // Train des bandes rails : POINT OUVERT ASSETS — aucun sprite de
            // train/locomotive dans l'atelier (vérifié 06/08 : fichiers +
            // CATALOGUE.md + catalogue.json, seuls rogrpg_wagonnet_* =
            // wagonnets de mine). Le train est donc un convoi de wagonnets
            // rogrpg (charbon = « loco », + wagons chargés), placeholder
            // documenté à remplacer quand l'atelier aura un vrai sprite de
            // train. Aucun pack externe proposé (CDC 706 §Assets).
            scene.load.image("wagonnet_charbon", "assets/vehicule/rogrpg_wagonnet_charbon_profil.png");
            scene.load.image("wagonnet_vide", "assets/vehicule/rogrpg_wagonnet_vide_profil.png");
            scene.load.image("wagonnet_terre", "assets/vehicule/rogrpg_wagonnet_terre_profil.png");
            scene.load.image("wagonnet_pierres", "assets/vehicule/rogrpg_wagonnet_pierres_profil.png");
            scene.load.image("wagonnet_or", "assets/vehicule/rogrpg_wagonnet_or_profil.png");

            // Signal sonore du train : snd_error_a réutilisé (décision John
            // 06/08 — pas de sons dédiés, réutiliser les 40 MP3 de l'atelier).
            scene.load.audio("snd_error", "assets/son/snd_error_a.mp3");

            // Son du bond du personnage (étape 5) : snd_jump_a de l'atelier.
            scene.load.audio("snd_jump", "assets/son/snd_jump_a.mp3");

            // Sons de la mort (étape 6) : snd_hurt_a (véhicule/train) et
            // snd_fall_a (chute à l'eau), MP3 de l'atelier (décision John
            // 06/08 — réutiliser les sons, pas de dédiés).
            scene.load.audio("snd_hurt", "assets/son/snd_hurt.mp3");
            scene.load.audio("snd_fall", "assets/son/snd_fall.mp3");

            // Personnage (étape 5) : piéton p8city rouge, 3 frames de marche.
            // Placeholder — aucun sprite de Waggis dans l'atelier (vérifié
            // 06/08) ; POINT OUVERT ASSETS à remplacer par le vrai Waggis.
            scene.load.image("pieton_rouge_1", "assets/perso/p8city_pieton_rouge_1.png");
            scene.load.image("pieton_rouge_2", "assets/perso/p8city_pieton_rouge_2.png");
            scene.load.image("pieton_rouge_3", "assets/perso/p8city_pieton_rouge_3.png");

            // Véhicules des bandes route (vue de dessus, sens de circulation).
            scene.load.image("voiture_rouge_droite", "assets/vehicule/p8city_voiture_rouge_dessus_droite.png");
            scene.load.image("voiture_rouge_gauche", "assets/vehicule/p8city_voiture_rouge_dessus_gauche.png");
            scene.load.image("voiture_verte_droite", "assets/vehicule/p8city_voiture_verte_dessus_droite.png");
            scene.load.image("voiture_verte_gauche", "assets/vehicule/p8city_voiture_verte_dessus_gauche.png");
            scene.load.image("voiture_rose_droite", "assets/vehicule/p8city_voiture_rose_dessus_droite.png");
            scene.load.image("voiture_rose_gauche", "assets/vehicule/p8city_voiture_rose_dessus_gauche.png");

            // D2-2 (spec 708 §5 — « tous types mélangés ») : taxi et bus
            // vus de côté (p8city), en plus des voitures vue de dessus.
            scene.load.image("taxi_jaune_cote", "assets/vehicule/p8city_taxi_jaune_cote.png");
            scene.load.image("taxi_jaune_cote_v2", "assets/vehicule/p8city_taxi_jaune_cote_v2.png");
            scene.load.image("bus_jaune_1", "assets/vehicule/p8city_bus_jaune_1.png");

            // D2-2 (spec 708 §3) — bateaux de l'eau (barques rogrpg, vue de
            // dessus) : véhicules qui REMPLACENT les plantes en fin de jeu.
            scene.load.image("barque_v1", "assets/vehicule/rogrpg_barque_v1.png");
            scene.load.image("barque_v2", "assets/vehicule/rogrpg_barque_v2.png");
            scene.load.image("barque_v3", "assets/vehicule/rogrpg_barque_v3.png");

            // D2-2 (spec 708 §3) — véhicules volants de la piste
            // d'atterrissage (avions et hélicos battle, atelier) : même
            // comportement qu'un véhicule de route (spec 708 §5).
            scene.load.image("avion_rouge", "assets/vehicule/battle_avion_rouge.png");
            scene.load.image("avion_vert", "assets/vehicule/battle_avion_vert.png");
            scene.load.image("avion_bleu", "assets/vehicule/battle_avion_bleu.png");
            scene.load.image("helico_rouge", "assets/vehicule/battle_helico_rouge.png");
            scene.load.image("helico_vert", "assets/vehicule/battle_helico_vert.png");

            // Décor des zones sûres (prairie et rangées de vigne).
            scene.load.image("buisson_vert", "assets/decor/p8city_buisson_vert.png");
            scene.load.image("arbre_vert", "assets/decor/p8city_arbre_vert.png");
            scene.load.image("arbre_vert_v2", "assets/decor/p8city_arbre_vert_v2.png");
            scene.load.image("arbre_vert_v3", "assets/decor/p8city_arbre_vert_v3.png");
            scene.load.image("arbre_vert_v4", "assets/decor/p8city_arbre_vert_v4.png");
            scene.load.image("arbre_orange", "assets/decor/p8city_arbre_orange.png");
            scene.load.image("arbre_orange_v2", "assets/decor/p8city_arbre_orange_v2.png");
            scene.load.image("arbre_orange_v3", "assets/decor/p8city_arbre_orange_v3.png");
        },

        // Une fois tout chargé : sauvegarde.
        create: async function (scene) {
            // Rails v3 (rogrpg_rails_horizontal_v3.png) : les barres
            // métalliques y sont dessinées VERTICALEMENT — incohérent avec
            // le train qui traverse horizontalement (gauche → droite).
            // Décision John 06/08 (CDC 706 §Assets) : tourner de 90° au
            // rendu. Les variantes v1/v2 sont déjà horizontales (vérifié
            // pixel par pixel le 06/08), seule v3 est tournée ici. La
            // copie atelier du PNG reste intacte : la rotation est faite
            // en mémoire au chargement.
            try {
                const src = scene.textures.get("rails_v3").getSourceImage();
                const rot = document.createElement("canvas");
                rot.width = src.height;
                rot.height = src.width;
                const ctx = rot.getContext("2d");
                ctx.translate(rot.width / 2, rot.height / 2);
                ctx.rotate(Math.PI / 2);
                ctx.drawImage(src, -src.width / 2, -src.height / 2);
                scene.textures.addCanvas("rails_v3_h", rot);
            } catch (e) {
                // Repli : la texture d'origine (cas où canvas serait
                // indisponible) — les rails restent verticaux, mais le
                // jeu ne casse pas.
                console.warn("Rotation rails_v3 impossible, original utilisé.", e);
            }

            // Contrat de save : version 4 (D2-3, spec 708 §1/§7/§9/§10).
            // v1 ({ parties }) → v2 (generatedRows, D2-1) → v3
            // (wallet + unlockedCharacters, ETAPE-7) → v4 (currentLevel,
            // D2-3). Chaque migration préserve les données existantes :
            // on ne casse jamais la partie d'un joueur.
            Arcade.Save.configure({
                key: C.key,
                version: C.save.version,
                migrations: {
                    // v1 → v2 : on reprend les données existantes et on
                    // ajoute le monde généré (vide par défaut : aucune
                    // partie en cours à la migration).
                    1: function (data) {
                        return Object.assign({}, data, { generatedRows: {} });
                    },
                    // v2 → v3 : on ajoute le contrat pièces/déblocage à
                    // ses valeurs par défaut — 0 pièce, seul le Waggis
                    // débloqué (le perso de départ est gratuit, PRD 705).
                    // La mécanique pièces/déblocage arrive post-MVP : le
                    // contrat est prêt, les valeurs ne bougeront qu'à ce
                    // moment-là (et la version avec elles).
                    2: function (data) {
                        return Object.assign({}, data, {
                            wallet: 0,
                            unlockedCharacters: ["waggis"]
                        });
                    },
                    // v3 → v4 (D2-3) : on ajoute le niveau en cours à sa
                    // valeur par défaut — niveau 1. La save n'intervient
                    // qu'à la victoire (spec 708 §9) : currentLevel ne
                    // progressera qu'à la prochaine victoire.
                    3: function (data) {
                        return Object.assign({}, data, { currentLevel: 1 });
                    }
                },
                gather: function () {
                    return {
                        parties: scene.registry.get("parties") || 0,
                        generatedRows: scene.registry.get("generatedRows") || {},
                        wallet: scene.registry.get("wallet") || 0,
                        unlockedCharacters: scene.registry.get("unlockedCharacters") || ["waggis"],
                        currentLevel: scene.registry.get("currentLevel") || 1
                    };
                },
                apply: function (data) {
                    scene.registry.set("parties", (data && data.parties) || 0);
                    const gr = (data && data.generatedRows) || {};
                    scene.registry.set("generatedRows", gr);
                    scene.registry.set("wallet", (data && typeof data.wallet === "number") ? data.wallet : 0);
                    scene.registry.set(
                        "unlockedCharacters",
                        (data && Array.isArray(data.unlockedCharacters) && data.unlockedCharacters.length)
                            ? data.unlockedCharacters
                            : ["waggis"]
                    );
                    // D2-3 : niveau en cours (data.currentLevel, défaut 1).
                    scene.registry.set(
                        "currentLevel",
                        (data && typeof data.currentLevel === "number" && data.currentLevel >= 1)
                            ? data.currentLevel
                            : 1
                    );
                }
            });

            // D2-3 (spec 708 §1/§3/§5/§6) : config par niveau chargée
            // depuis levels.json (lignes(niveau) = 42 + niveau, types
            // autorisés, densité, vitesse, max consécutifs) — consultée
            // par LaneGenerator. Repli silencieux sur les défauts de
            // config.js (valeurs identiques) si le fichier ne charge pas.
            window.WaggisConfig.levels = scene.cache.json.get("levels") || null;

            await Arcade.Save.load();
            // D2-3 (spec 708 §9) : PAS de sauvegarde automatique — la save
            // n'intervient QU'À LA VICTOIRE du niveau (OverScene mode
            // victoire). Une fermeture en cours de partie ne doit rien
            // écrire : le joueur reste sur son niveau, régénéré à zéro au
            // prochain lancement.
        }
    });
})();
