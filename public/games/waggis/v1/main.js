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
 *
 * ⭐ MENU-2 (spec 709 §Données nécessaires) — contrat de save étendu :
 *  - le contrat passe en VERSION 5 avec data.activeCharacter (le
 *    personnage actif sélectionné, défaut "waggis" — sélection MENU-4) et
 *    data.bestScores (meilleur score PAR NIVEAU, map niveau→score — écran
 *    Niveaux MENU-3) ; migration 4→5 écrite (défauts : "waggis", {}) ;
 *  - data.wallet (pièces) et data.unlockedCharacters (skins débloqués)
 *    étaient déjà au contrat depuis la v3 (ETAPE-7) — la mécanique
 *    pièces/déblocage reste post-MVP (PRD 705) ;
 *  - le meilleur score PAR NIVEAU est enregistré à la VICTOIRE du niveau
 *    (OverScene mode victoire — seul point d'écriture de la save, 708 §9) :
 *    bestScores[niveau] = max(ancien, score de la victoire).
 *
 * ⭐ MENU-1 (spec 709, Décision 6 article 704) — squelette du menu :
 *  - MenuScene passe à 7 boutons (Jouer, Niveaux, Personnages, Boutique,
 *    Réglages, Classement, Quitter) — « Jouer » lance directement le
 *    prochain niveau non terminé (data.currentLevel) ; « Quitter » fait la
 *    même chose que le bouton retour de la barre du haut (Décision John
 *    07/08 : navigation standard, jeu en iframe → /games) ; les écrans
 *    intermédiaires arrivent avec leurs étapes (MENU-3/4/5) ;
 *
 * ⭐ MENU-3 (spec 709 §7 boutons — Décision 6, article 704) — écran Niveaux :
 *  - LevelsScene (nouvelle scène) est enregistrée ici et ouverte par le
 *    bouton « Niveaux » du menu : grille paginée de tous les niveaux
 *    (5 × 5 par page, ◀ / ▶), état par niveau (verrouillé / complété / en
 *    cours — déverrouillage strictement linéaire, terminer N débloque N+1)
 *    + meilleur score par niveau (data.bestScores, save v5) ;
 *  - cliquer un niveau DÉBLOQUÉ le lance : GameScene reçoit { niveau }
 *    (init) et le garde dans niveauSession — la relance après mort (708 §8)
 *    reprend le même niveau ; « Jouer » du menu et « Niveau suivant » de la
 *    victoire effacent niveauSession pour repartir de data.currentLevel ;
 *  - la victoire ne fait JAMAIS reculer currentLevel (OverScene :
 *    max(currentLevel, niveau + 1)) — rejouer un vieux niveau pour
 *    améliorer son meilleur score est permis (spec 709), sans régression.
 *
 * ⭐ MENU-4 (spec 709 §7 boutons — Décision 6, article 704) — écrans
 * Personnages + Boutique :
 *  - CharactersScene et ShopScene (nouvelles scènes) sont enregistrées ici
 *    et ouvertes par les boutons « Personnages » / « Boutique » du menu ;
 *  - les 3 personnages à l'achat (config.personnages, prix > 0 — Waggis
 *    gratuit de départ jamais à vendre) chargent leurs textures de marche :
 *    piétons p8city bleu / orange / rose (3 frames chacun, 8×8, même style
 *    que le rouge Waggis — aucun sprite de Waggis dans l'atelier, POINT
 *    OUVERT ASSETS conservé) ;
 *  - GameScene lit data.activeCharacter (save v5, sélection MENU-4) pour
 *    afficher le bon skin — cosmétique pur, aucun impact gameplay (709).
 *
 * ⭐ MENU-5 (spec 709 §7 boutons — Décision 6, article 704) — écrans
 * Réglages + Classement :
 *  - SettingsScene et ClassementScene (nouvelles scènes) sont enregistrées
 *    ici et ouvertes par les boutons « Réglages » / « Classement » du menu ;
 *  - « Réglages » : son on/off UNIQUEMENT (spec 709 — pas de vibration, pas
 *    de langue). Préférence LOCALE (soundPref.js, localStorage) — PAS dans
 *    la save cloud : préférence d'appareil et règle 708 §9 (la save
 *    n'intervient qu'à la victoire du niveau) — le contrat de save reste
 *    en v5, inchangé. Le mute est appliqué au SoundManager global ici, au
 *    BOOT (après le chargement de la save) : un son coupé le reste au
 *    lancement du jeu, avant même d'ouvrir Réglages ;
 *  - « Classement » : classement GÉNÉRAL entre joueurs (spec 709) via
 *    Arcade.Platform.score.leaderboard() (core/platform.js → GET
 *    /api/scores?gameId=X) — endpoint d'agrégation VÉRIFIÉ EXISTANT côté
 *    backend le 07/08 (src/app/api/scores/route.ts : TOP 100 par jeu, une
 *    ligne par joueur = meilleur score, tri décroissant, user_name de la
 *    session signée). RIEN créé côté backend : l'écran consomme l'existant ;
 *  - PlaceholderScene est SUPPRIMÉE : depuis MENU-5, les 7 boutons du menu
 *    ouvrent tous un vrai écran — plus aucun placeholder.
 */
(function () {
    "use strict";

    const C = window.WaggisConfig;

    Arcade.boot({
        key: C.key,
        backgroundColor: C.couleurs.ciel,
        scenes: [MenuScene, GameScene, OverScene, LevelsScene, CharactersScene, ShopScene, SettingsScene, ClassementScene],
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

            // MENU-4 (spec 709 — écrans Personnages/Boutique) : les 3
            // personnages À L'ACHAT au lancement (config.personnages, prix >
            // 0) — piétons p8city bleu / orange / rose, 3 frames de marche
            // chacun, même style que le Waggis rouge (assets atelier
            // vérifiés 07/08 : 8×8, 3 frames, cf. CharactersScene/ShopScene).
            scene.load.image("pieton_bleu_1", "assets/perso/p8city_pieton_bleu_1.png");
            scene.load.image("pieton_bleu_2", "assets/perso/p8city_pieton_bleu_2.png");
            scene.load.image("pieton_bleu_3", "assets/perso/p8city_pieton_bleu_3.png");
            scene.load.image("pieton_orange_1", "assets/perso/p8city_pieton_orange_1.png");
            scene.load.image("pieton_orange_2", "assets/perso/p8city_pieton_orange_2.png");
            scene.load.image("pieton_orange_3", "assets/perso/p8city_pieton_orange_3.png");
            scene.load.image("pieton_rose_1", "assets/perso/p8city_pieton_rose_1.png");
            scene.load.image("pieton_rose_2", "assets/perso/p8city_pieton_rose_2.png");
            scene.load.image("pieton_rose_3", "assets/perso/p8city_pieton_rose_3.png");

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

            // Fix post-D2 (t_2282d963, règle studio : tout asset
            // directionnel orienté dans le sens de circulation) : les
            // barques rogrpg (barque_v1/v2/v3) sont dessinées avec leur
            // LONGUEUR VERTICALE dans la texture (les extrémités relevées
            // en haut et en bas du sprite) alors qu'elles NAVIGUENT
            // HORIZONTALEMENT sur la bande d'eau — le même défaut que les
            // rails v3 (fix 06/08). On tourne les trois variantes de 90°
            // au chargement (comme rails_v3_h) : la longueur devient
            // horizontale, dans le sens du courant. L'orientation
            // gauche/droite (proue dans le sens de circulation) est
            // ensuite appliquée par LaneGenerator._textureBateau
            // (flipX selon def.direction). Les textures originales
            // restent chargées (repli / compatibilité).
            for (const [srcKey, dstKey] of [
                ["barque_v1", "barque_v1_h"],
                ["barque_v2", "barque_v2_h"],
                ["barque_v3", "barque_v3_h"]
            ]) {
                try {
                    const src = scene.textures.get(srcKey).getSourceImage();
                    const rot = document.createElement("canvas");
                    rot.width = src.height;
                    rot.height = src.width;
                    const ctx = rot.getContext("2d");
                    ctx.translate(rot.width / 2, rot.height / 2);
                    ctx.rotate(Math.PI / 2);
                    ctx.drawImage(src, -src.width / 2, -src.height / 2);
                    scene.textures.addCanvas(dstKey, rot);
                } catch (e) {
                    console.warn(`Rotation ${srcKey} impossible, original utilisé.`, e);
                }
            }

            // Contrat de save : version 5 (MENU-2, spec 709 §Données
            // nécessaires). v1 ({ parties }) → v2 (generatedRows, D2-1) → v3
            // (wallet + unlockedCharacters, ETAPE-7) → v4 (currentLevel,
            // D2-3) → v5 (activeCharacter + bestScores, MENU-2). Chaque
            // migration préserve les données existantes : on ne casse
            // jamais la partie d'un joueur.
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
                    },
                    // v4 → v5 (MENU-2, spec 709 §Données nécessaires) : on
                    // ajoute le personnage actif (défaut "waggis" — le seul
                    // débloqué au MVP, la sélection arrive MENU-4) et la
                    // map des meilleurs scores par niveau (vide par
                    // défaut : elle se remplit à chaque victoire, 708 §9).
                    4: function (data) {
                        return Object.assign({}, data, {
                            activeCharacter: "waggis",
                            bestScores: {}
                        });
                    }
                },
                gather: function () {
                    return {
                        parties: scene.registry.get("parties") || 0,
                        generatedRows: scene.registry.get("generatedRows") || {},
                        wallet: scene.registry.get("wallet") || 0,
                        unlockedCharacters: scene.registry.get("unlockedCharacters") || ["waggis"],
                        currentLevel: scene.registry.get("currentLevel") || 1,
                        activeCharacter: scene.registry.get("activeCharacter") || "waggis",
                        bestScores: scene.registry.get("bestScores") || {}
                    };
                },
                apply: function (data) {
                    scene.registry.set("parties", (data && data.parties) || 0);
                    const gr = (data && data.generatedRows) || {};
                    scene.registry.set("generatedRows", gr);
                    scene.registry.set("wallet", (data && typeof data.wallet === "number") ? data.wallet : 0);
                    const unlocked = (data && Array.isArray(data.unlockedCharacters) && data.unlockedCharacters.length)
                        ? data.unlockedCharacters
                        : ["waggis"];
                    scene.registry.set("unlockedCharacters", unlocked);
                    // D2-3 : niveau en cours (data.currentLevel, défaut 1).
                    scene.registry.set(
                        "currentLevel",
                        (data && typeof data.currentLevel === "number" && data.currentLevel >= 1)
                            ? data.currentLevel
                            : 1
                    );
                    // MENU-2 (spec 709) : personnage actif — le skin
                    // sélectionné doit être parmi les débloqués, sinon
                    // repli sur le Waggis (défaut, toujours débloqué).
                    const actif = (data && typeof data.activeCharacter === "string" && data.activeCharacter)
                        ? data.activeCharacter
                        : "waggis";
                    scene.registry.set(
                        "activeCharacter",
                        unlocked.indexOf(actif) >= 0 ? actif : "waggis"
                    );
                    // MENU-2 (spec 709) : meilleur score PAR NIVEAU — map
                    // niveau→score (clé = numéro de niveau, valeur = score
                    // en bonds avant). Nettoyée au chargement : seules les
                    // entrées niveau≥1 avec un score numérique ≥ 0 sont
                    // conservées (données corrompues ignorées).
                    const bests = {};
                    if (data && data.bestScores && typeof data.bestScores === "object") {
                        Object.keys(data.bestScores).forEach(function (cle) {
                            const niveau = Number(cle);
                            const score = Number(data.bestScores[cle]);
                            if (Number.isInteger(niveau) && niveau >= 1 &&
                                Number.isFinite(score) && score >= 0) {
                                bests[cle] = score;
                            }
                        });
                    }
                    scene.registry.set("bestScores", bests);
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

            // MENU-5 (spec 709 — écran Réglages) : la préférence son
            // (on/off, stockée LOCALEMENT — soundPref.js) est appliquée au
            // SoundManager global dès le boot : un son coupé le reste au
            // lancement du jeu, avant même d'ouvrir Réglages. Le mute
            // couvre bond, mort et signal du train (GameScene /
            // LaneGenerator — tous passent par scene.sound).
            WaggisSound.appliquer(scene);
        }
    });
})();
