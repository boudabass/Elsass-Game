/*
 * core/ui/classement.js — L'écran Classement de l'arcade + LA flèche de
 * pagination (refonte charte, 24/09/2026).
 *
 * Waggis et Similitude avaient chacun leur ClassementScene, copies l'une
 * de l'autre (même chargement, même pagination, même tableau), et chacun
 * sa flèche de pagination (bouton rond dessiné à la main dans Waggis,
 * bouton texte « ◀ » dans Similitude). Deux jeux, même besoin : la brique
 * vit ici (règle du projet : core/ dès que deux jeux l'utilisent).
 *
 *   Arcade.UI.fleche(scene, "gauche" | "droite", onClick)
 *     Bouton rond de pagination aux couleurs des cartes (crème, bord
 *     « ligne », chevron encre fin et arrondi). API : setPosition(x, y),
 *     redimensionner(diametre), setVisible(v), setDepth(d), destroy().
 *
 *   Arcade.UI.ecranClassement(scene, {
 *       surtitre: "Waggis", titre: "Classement",
 *       retour: { label, onClick },
 *       textes: { chargement, horsLigne, vide, pageInfo },  // pageInfo :
 *                                                          // "{page}/{total}"
 *       parPageMax: 10, parPageMin: 5,  // entrées par page (défauts)
 *       policeMinPx: 13                 // lisibilité : sous ce seuil, on
 *   })                                  // affiche MOINS d'entrées par page
 *
 * Construit sur Arcade.UI.ecran (en-tête, retour, zone de contenu).
 * Dans la zone : le tableau en haut (une carte par entrée : rang rouge,
 * nom, score), la pagination « ◀ Page X / Y ▶ » en bas. Le nombre
 * d'entrées par page suit la hauteur disponible (FIX Waggis 09/08 : sur
 * écran écrasé, on réduit le NOMBRE d'entrées, pas leur taille), la page
 * courante est réajustée à la rotation pour garder la place du joueur.
 * Données : Arcade.Platform.score.leaderboard() ([] hors ligne).
 */
(function () {
    "use strict";

    window.Arcade = window.Arcade || {};
    Arcade.UI = Arcade.UI || {};

    Arcade.UI.fleche = function (scene, sens, onClick) {
        var UI = Arcade.UI;
        var T = UI.tokens;
        var ombre = scene.add.graphics().setDepth(49);
        var corps = scene.add.graphics().setDepth(50);
        var chevron = scene.add.graphics().setDepth(51);
        var zone = scene.add.rectangle(0, 0, 10, 10, 0x000000, 0)
            .setInteractive({ useHandCursor: true })
            .setDepth(52);

        // Même feedback que core/ui/button.js : appui à 0,96, tween
        // précédent tué avant d'en lancer un autre.
        var animer = function (echelle, duree, ease) {
            [ombre, corps, chevron, zone].forEach(function (c) {
                scene.tweens.killTweensOf(c);
                scene.tweens.add({ targets: c, scale: echelle, duration: duree, ease: ease });
            });
        };
        zone.on("pointerdown", function () { animer(0.96, 70, "Linear"); });
        zone.on("pointerout", function () { animer(1, 170, "Back.Out"); });
        zone.on("pointerup", function () {
            animer(1, 170, "Back.Out");
            if (typeof onClick === "function") onClick();
        });

        var x = 0, y = 0, diametre = 10;
        var dessiner = function () {
            var r = diametre / 2;
            var teinteOmbre = UI.couleur(T.ombreDouce);
            // Dessin centré sur (0,0) local + objet posé au centre : le
            // scale de l'appui garde le centre.
            ombre.clear();
            ombre.fillStyle(teinteOmbre.valeur, teinteOmbre.alpha);
            ombre.fillCircle(0, diametre * 0.06, r);
            ombre.setPosition(x, y);
            corps.clear();
            corps.fillStyle(UI.couleur(T.creme).valeur, 1);
            corps.fillCircle(0, 0, r);
            corps.lineStyle(Math.max(1, Math.round(diametre * 0.03)), UI.couleur(T.ligne).valeur, 1);
            corps.strokeCircle(0, 0, r - 1);
            corps.setPosition(x, y);
            chevron.clear();
            chevron.lineStyle(Math.max(2, Math.round(diametre * 0.09)), UI.couleur(T.encre).valeur, 1);
            chevron.beginPath();
            var s = sens === "gauche" ? 1 : -1;
            chevron.moveTo(s * r * 0.32, -r * 0.35);
            chevron.lineTo(-s * r * 0.16, 0);
            chevron.lineTo(s * r * 0.32, r * 0.35);
            chevron.strokePath();
            chevron.setPosition(x, y);
            // Zone tactile : au moins ~9,5 % du petit côté, et jamais sous
            // la cible tactile de l'arcade (44 px).
            var z = Math.max(UI.cibleMinPx, diametre, UI.u(scene, 9.5));
            zone.setPosition(x, y).setSize(z, z);
            if (zone.input && zone.input.hitArea) zone.input.hitArea.setSize(z, z);
        };

        return {
            setPosition: function (nx, ny) { x = nx; y = ny; dessiner(); return this; },
            redimensionner: function (d) { diametre = d; dessiner(); return this; },
            setVisible: function (v) {
                [ombre, corps, chevron, zone].forEach(function (c) { c.setVisible(v); });
                return this;
            },
            setDepth: function (d) {
                ombre.setDepth(d); corps.setDepth(d + 1);
                chevron.setDepth(d + 2); zone.setDepth(d + 3);
                return this;
            },
            destroy: function () {
                ombre.destroy(); corps.destroy(); chevron.destroy(); zone.destroy();
            }
        };
    };

    Arcade.UI.ecranClassement = function (scene, o) {
        var UI = Arcade.UI;
        var T = UI.tokens;
        var P = UI.polices;
        var textes = o.textes || {};
        var parPageMax = o.parPageMax || 10;
        var parPageMin = o.parPageMin || 5;
        var policeMinPx = o.policeMinPx || 13;
        var u = function (v) { return UI.u(scene, v); };

        var parPage = parPageMax;
        var page = 0;
        var entrees = null;      // null = chargement ; [] = chargé mais vide
        var lignes = [];         // objets de rendu de la page courante
        var table = null;        // géométrie, recalculée à chaque rotation

        var nbPages = function () {
            return Math.max(1, Math.ceil((entrees || []).length / parPage));
        };

        var etat = scene.add.text(0, 0, textes.chargement || "", {
            fontFamily: P.texte, fontStyle: "bold", color: T.encre, align: "center"
        }).setOrigin(0.5);

        var prec = null, suiv = null;   // flèches, créées plus bas

        var majEtat = function () {
            // Flèches seulement quand il y a des pages à parcourir : sinon
            // le message (chargement, hors ligne, liste vide) prend toute
            // la largeur au lieu de passer sous les flèches.
            var avecPages = !!(entrees && entrees.length && Arcade.Platform.online);
            if (prec) { prec.setVisible(avecPages); suiv.setVisible(avecPages); }
            if (entrees === null) {
                etat.setText(textes.chargement || "");
            } else if (!Arcade.Platform.online) {
                etat.setText(textes.horsLigne || "");
            } else if (entrees.length === 0) {
                etat.setText(textes.vide || "");
            } else {
                etat.setText((textes.pageInfo || "{page} / {total}")
                    .replace("{page}", String(page + 1))
                    .replace("{total}", String(nbPages())));
            }
        };

        var nomAffiche = function (nom) {
            var n = String(nom || "?");
            return n.length > 16 ? n.slice(0, 15) + "…" : n;
        };

        var dessinerListe = function () {
            lignes.forEach(function (l) { l.forEach(function (obj) { obj.destroy(); }); });
            lignes = [];
            majEtat();
            if (!table) return;
            var liste = entrees || [];
            var debut = page * parPage;
            var fin = Math.min(debut + parPage, liste.length);
            var hCarte = table.hauteurLigne * 0.86;   // petit espace entre deux cartes
            var taille = Math.round(Math.min(u(3.2), hCarte * 0.45)) + "px";
            var gauche = table.x - table.largeur / 2;
            for (var i = debut; i < fin; i++) {
                var e = liste[i];
                var y = table.y0 + table.hauteurLigne * (i - debut);
                var fond = scene.add.graphics();
                UI.carte(fond, gauche, y - hCarte / 2, table.largeur, hCarte, "normal");
                var rang = scene.add.text(gauche + u(4), y, String(i + 1) + ".", {
                    fontFamily: P.texte, fontStyle: "bold", fontSize: taille, color: T.rouge
                }).setOrigin(0, 0.5);
                var nom = scene.add.text(table.x, y, nomAffiche(e.user_name), {
                    fontFamily: P.texte, fontSize: taille, color: T.encre
                }).setOrigin(0.5);
                var score = scene.add.text(gauche + table.largeur - u(4), y, String(e.score), {
                    fontFamily: P.texte, fontStyle: "bold", fontSize: taille, color: T.encre
                }).setOrigin(1, 0.5);
                lignes.push([fond, rang, nom, score]);
            }
        };

        prec = UI.fleche(scene, "gauche", function () {
            if (page > 0) { page--; dessinerListe(); }
        });
        suiv = UI.fleche(scene, "droite", function () {
            if (page < nbPages() - 1) { page++; dessinerListe(); }
        });

        majEtat();

        UI.ecran(scene, {
            surtitre: o.surtitre,
            titre: o.titre,
            retour: o.retour,
            contenu: function (zone) {
                var espace = u(3);
                var yPagination = zone.y + zone.hauteur - u(4.5);
                etat.setPosition(zone.cx, yPagination).setFontSize(Math.round(u(3.5)) + "px")
                    .setWordWrapWidth(zone.largeur, true);
                prec.redimensionner(u(9)).setPosition(zone.cx - u(19), yPagination);
                suiv.redimensionner(u(9)).setPosition(zone.cx + u(19), yPagination);

                var hautTable = zone.y;
                var hauteurDispo = yPagination - u(4.5) - espace - hautTable;

                // Entrées par page selon la hauteur : on en retire tant
                // que c'est la HAUTEUR qui bride la police sous le seuil
                // de lisibilité (et seulement dans ce cas). La page est
                // réajustée pour garder la première entrée affichée.
                var avant = parPage;
                var premiere = avant * page;
                var cible = Math.min(u(3.2), policeMinPx);
                var n = parPageMax;
                while (n > parPageMin && (hauteurDispo / n) * 0.45 < cible) n -= 1;
                parPage = n;
                if (parPage !== avant) {
                    page = Math.max(0, Math.min(Math.floor(premiere / parPage), nbPages() - 1));
                }

                var hauteurLigne = Math.max(1, hauteurDispo / parPage);
                table = {
                    hauteurLigne: hauteurLigne,
                    x: zone.cx,
                    largeur: Math.min(zone.largeur, u(o.largeurMaxU || 110)),
                    y0: hautTable + hauteurLigne / 2
                };
                dessinerListe();
            }
        });

        // Chargement du classement général (TOP 100 par joueur) — [] hors
        // ligne ou en erreur.
        Arcade.Platform.score.leaderboard().then(function (res) {
            if (!scene.sys || !scene.scene.isActive()) return;   // écran quitté
            entrees = res || [];
            dessinerListe();
        });
    };
})();
