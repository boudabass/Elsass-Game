/*
 * main.js — point de départ de Waggis V2.
 * Décrit ce qu'il faut charger, puis laisse le socle démarrer le jeu.
 *
 * ÉTAPE 5 : le personnage (piéton p8city rouge, placeholder — aucun sprite
 * de Waggis dans l'atelier, vérifié 06/08, cf. GameScene) et le son du
 * bond (snd_jump_a de l'atelier, décision John 06/08 : réutiliser les MP3)
 * sont chargés en plus des textures des étapes 2-4.
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
            // Sols des bandes (zone sûre herbe / route asphalte + marquage).
            scene.load.image("herbe", "assets/sol/p8city_herbe.png");
            scene.load.image("herbe_fleurs_roses", "assets/sol/p8city_herbe_fleurs_roses.png");
            scene.load.image("herbe_fleurs_vertes", "assets/sol/p8city_herbe_fleurs_vertes.png");
            scene.load.image("route_pleine", "assets/sol/p8city_route_pleine.png");
            scene.load.image("route_ligne", "assets/sol/p8city_route_ligne_v2.png");

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

            // Contrat de save : version 1, aucune migration pour l'instant.
            // (Le concept V1 Frogger étant abandonné, la sauvegarde repart
            // sur la même clé avec le même format { parties } — compatible.)
            Arcade.Save.configure({
                key: C.key,
                version: 1,
                migrations: {},
                gather: function () {
                    return { parties: scene.registry.get("parties") || 0 };
                },
                apply: function (data) {
                    scene.registry.set("parties", (data && data.parties) || 0);
                }
            });

            await Arcade.Save.load();
            Arcade.Save.startAutosave();
        }
    });
})();
