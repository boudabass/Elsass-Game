/*
 * GameScene — LE monde d'Elsass Farm (proposition Bloc A, point 1).
 *
 * Une seule scène de monde qui change de zone par redémarrage :
 *   this.scene.restart({ zone, apparition }) → init(data) réinjecte la
 *   donnée (mécanisme Phaser natif). L'état du jeu (horloge, sols,
 *   position) vit dans window.FarmEtat (objet HORS scène) : le restart ne
 *   perd rien, et la sauvegarde se fait au passage de portail.
 *
 * Contenu du Bloc A :
 *   - zone Tiled courante (tilemapTiledJSON), caméra qui suit le joueur,
 *     bornée à la map, zoom de base + boutons zoom +/− (toujours visibles) ;
 *   - grille = la tilemap (worldToTileXY / tileToWorldXY) ; clic/tap →
 *     tuile ciblée ; zone d'action Chebyshev (rayonAction) sinon
 *     déplacement BFS suivi en Arcade Physics (la collision avec la couche
 *     "obstacles" reste la garde-fou) ;
 *   - portails data-driven (zones.json) : simple → restart direct, à choix →
 *     popup de confirmation (Arcade.UI.bouton, une option par choix) ;
 *   - machine à états sol (sol.js), rendu par tuile labourée + emoji de
 *     pousse (graphisme simple, aucun asset de culture en Bloc A) ;
 *   - horloge jour/nuit + saisons (horloge.js), HUD heure/saison/jour,
 *     teinte plein écran par plage horaire ;
 *   - sommeil : interaction sur le lit (zones.json) → popup → voile de
 *     nuit → tick quotidien → réveil à heureReveil du jour+1 → save forcée ;
 *   - barre d'outils (Arcade.UI.barreIcones, 5 slots).
 */
class GameScene extends Phaser.Scene {
    static KEY = "jeu";

    constructor() {
        super(GameScene.KEY);
    }

    init(data) {
        const C = window.FarmConfig;
        const E = window.FarmEtat;
        data = data || {};

        // Zone courante : donnée du restart (portail), sinon position
        // sauvegardée, sinon première zone de zones.json (garde-fou
        // FarmZones.zone). La zone est validée au preload (this.zone).
        const idDemandee = data.zone || (E.position && E.position.zone) || null;
        const zone = FarmZones.zone(this, idDemandee);
        this.zoneId = zone ? zone.id : null;
        this.zone = zone;

        // Point d'apparition : donnée du restart, sinon position
        // sauvegardée (si elle est dans CETTE zone), sinon apparition par
        // défaut de la zone.
        this.apparition = data.apparition || null;
        if (!this.apparition && E.position && E.position.zone === this.zoneId &&
                typeof E.position.x === "number" && typeof E.position.y === "number") {
            this.apparition = { x: E.position.x, y: E.position.y };
        }
    }

    preload() {
        // zones.json est déjà dans le cache (chargé au boot par main.js).
        this.zone = FarmZones.zone(this, this.zoneId);
        if (!this.zone) {
            console.error("[Farm] Aucune zone dans zones.json.");
            return;
        }
        this.zoneId = this.zone.id;
        this.load.tilemapTiledJSON("carte", this.zone.tiled);

        // Tilesets partagés de l'arcade (public/games/assets/tilesets/,
        // consigne 704) : les textures DOIVENT exister dans le
        // TextureManager avant create() — addTilesetImage référence la
        // texture par clé = nom du tileset dans la carte Tiled. Même
        // chemin que l'image référencée dans les .json Tiled.
        this.load.image("sol_16px", "/games/assets/tilesets/sol_16px.png");
        this.load.image("batiment_16px", "/games/assets/tilesets/batiment_16px.png");
        this.load.image("decor_16px", "/games/assets/tilesets/decor_16px.png");
    }

    create() {
        const C = window.FarmConfig;
        const E = window.FarmEtat;
        this.C = C;
        this.E = E;

        // --- Tilemap Tiled : la grille (point 3) ---------------------------
        this.map = this.make.tilemap({ key: "carte" });
        const tsSol = this.map.addTilesetImage("sol_16px");
        const tsBat = this.map.addTilesetImage("batiment_16px");
        const tsDec = this.map.addTilesetImage("decor_16px");
        const tsListe = [tsSol, tsBat, tsDec].filter(Boolean);

        // Convention de calques (point 2) : "sol" (fond), "obstacles"
        // (bloquante), "decors" (rendue au-dessus du joueur).
        const coucheSol = this.map.createLayer("sol", tsListe)
            .setDepth(C.profondeurs.sol);
        this.coucheSol = coucheSol;
        this.map.createLayer("obstacles", tsListe)
            .setDepth(C.profondeurs.obstacles)
            .setCollisionByProperty({ passable: false });
        const coucheDecors = this.map.createLayer("decors", tsListe)
            .setDepth(C.profondeurs.decors);
        this.coucheDecors = coucheDecors;

        // --- Joueur (graphisme simple : emoji — pas d'asset en Bloc A) -----
        // API Phaser 4.2.1 : Tilemap expose tileWidth/tileHeight (camelCase) —
        // map.tilewidth (minuscule) est undefined → NaN partout (fix 2e QA).
        const tuile = this.map.tileWidth;
        const p = this.apparition || this.zone.apparition || { x: 1, y: 1 };
        // API Phaser 4.2.1 : Tilemap.tileToWorldXY(tileX, tileY, point,
        // camera, layer) — le dernier argument est la COUCHE (nom, index ou
        // TilemapLayer), pas un décalage de tuile. On passe la couche "sol"
        // et on centre sur la tuile manuellement (coin + demi-tuile).
        const posDepart = this._tileCentre(p.x, p.y);
        this.joueur = this.add.text(posDepart.x, posDepart.y, "🧑‍🌾", {
            fontFamily: C.police.famille,
            fontSize: Math.round(tuile * 1.1) + "px",
            align: "center"
        })
            .setOrigin(0.5)
            .setDepth(C.profondeurs.joueur);
        this.physics.add.existing(this.joueur);
        const body = this.joueur.body;
        body.setSize(tuile * 0.7, tuile * 0.7);
        this.physics.add.collider(this.joueur, this.map.getLayer("obstacles").tilemapLayer);

        this.tuileJoueur = { x: p.x, y: p.y };
        E.position = { zone: this.zoneId, x: p.x, y: p.y };

        // --- Caméra : suit le joueur, bornée à la map, zoom de base -------
        this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
        this.cameras.main.startFollow(this.joueur, true, 0.12, 0.12);
        this.cameras.main.setZoom(C.camera.zoomDefaut);

        // --- Sols : rendu initial (tuile labourée + emojis de pousse) -----
        this._emojis = {};
        this._labourees = {};
        this._rendreSols();

        // --- HUD + barre d'outils + zoom -----------------------------------
        this._creerHUD();

        // --- Clic / tap (point 3) ------------------------------------------
        this.chemin = [];
        this.input.on("pointerdown", (pointeur) => this._clic(pointeur));

        // --- Horloge : état initial de l'affichage --------------------------
        this.derniereHeure = null;
        this.nuit = null;
        this._rafraichirHorloge(true);
    }

    /**
     * Centre (px) de la tuile (x, y) dans le monde. API Phaser 4.2.1 :
     * Tilemap.tileToWorldXY(tileX, tileY, point, camera, layer) — la couche
     * doit être passée explicitement (5e argument ; la méthode de la
     * TilemapLayer délègue avec elle-même), la caméra par défaut suffit.
     * Le point retourné est le COIN de la tuile : on centre en ajoutant
     * une demi-tuile (l'ancien (null, 0.5, 0.5) de Phaser 3 n'existe plus).
     */
    _tileCentre(x, y) {
        const pos = this.coucheSol.tileToWorldXY(x, y, null, null);
        return {
            x: pos.x + this.map.tileWidth / 2,
            y: pos.y + this.map.tileHeight / 2
        };
    }

    update(time, delta) {
        const E = this.E;
        // Compteur unique t, cumulé avec le facteur (1 s réelle = 60 s jeu).
        E.horloge.t += delta * this.C.horloge.facteur;
        this._rafraichirHorloge(false);
        this._suivreChemin();
    }

    // ======================================================================
    // Clic : zone d'action Chebyshev ou déplacement BFS (point 3)
    // ======================================================================
    _clic(pointeur) {
        const C = this.C;
        if (this.popup) return;   // popup ouvert : le clic ne traverse pas

        // Clic sur un bouton (zoom) : le bouton a posé le marqueur.
        if (Arcade.UI._clicPlateforme) {
            Arcade.UI._clicPlateforme = false;
            return;
        }

        const tx = Math.floor(pointeur.worldX / this.map.tileWidth);
        const ty = Math.floor(pointeur.worldY / this.map.tileHeight);
        if (tx < 0 || ty < 0 || tx >= this.map.width || ty >= this.map.height) return;
        const cible = { x: tx, y: ty };

        // Zone d'action Chebyshev : distance = max(|dx|, |dy|) en tuiles.
        const dist = Math.max(
            Math.abs(tx - this.tuileJoueur.x),
            Math.abs(ty - this.tuileJoueur.y)
        );
        if (dist <= C.grille.rayonAction) {
            this._action(cible);
            return;
        }

        // Sinon : déplacement BFS vers la tuile cliquée.
        const chemin = this._bfs(this.tuileJoueur, cible);
        if (chemin) this.chemin = chemin;
    }

    /** Action immédiate sur une case dans la zone d'action (point 5). */
    _action(cible) {
        const C = this.C;
        const E = this.E;

        // Sommeil : interaction sur le lit (déclaré dans zones.json).
        const lit = FarmZones.lit(this, this.zoneId);
        if (lit && lit.x === cible.x && lit.y === cible.y) {
            this._proposerSommeil();
            return;
        }

        // Les actions sol ne s'appliquent pas aux murs (non passables).
        const tuile = this.map.getTileAt(cible.x, cible.y, true, "sol");
        if (tuile && tuile.properties && tuile.properties.passable === false) return;

        const outil = this.barre.actif();
        if (!outil) return;

        const c = FarmSol.case(E, this.zoneId, cible.x, cible.y);
        if (outil === "pelle") {
            if (!c) FarmSol.labourer(E, this.zoneId, cible.x, cible.y);
        } else if (outil === "graines") {
            if (c && c.etat === "labouree") {
                FarmSol.planter(E, this.zoneId, cible.x, cible.y, C,
                    FarmHorloge.jour(E.horloge.t));
            }
        } else if (outil === "arrosoir") {
            if (c && c.etat === "plantee" && !c.arrosee) {
                FarmSol.arroser(E, this.zoneId, cible.x, cible.y);
            }
        } else if (outil === "main") {
            if (c && c.etat === "prete") {
                FarmSol.recolter(E, this.zoneId, cible.x, cible.y, C);
            }
        }
        this._rendreSols();
    }

    // ======================================================================
    // Déplacement : BFS + suivi du chemin en Arcade Physics (point 3)
    // ======================================================================

    /**
     * Plus court chemin (BFS 4-directions) entre deux tuiles, sur la
     * grille passable (les tuiles non passables = murs). Retourne la liste
     * des tuiles à parcourir (sans la tuile de départ), ou null si la
     * cible est inaccessible.
     */
    _bfs(depart, cible) {
        const map = this.map;
        const W = map.width;
        const H = map.height;
        const passable = (x, y) => {
            if (x < 0 || y < 0 || x >= W || y >= H) return false;
            const t = map.getTileAt(x, y, true, "obstacles");
            if (t && t.properties && t.properties.passable === false) return false;
            return true;
        };
        if (!passable(cible.x, cible.y)) return null;

        const cle = (x, y) => x + "," + y;
        const pred = new Map();
        const vu = new Set([cle(depart.x, depart.y)]);
        const file = [{ x: depart.x, y: depart.y }];

        while (file.length) {
            const cur = file.shift();
            if (cur.x === cible.x && cur.y === cible.y) {
                const chemin = [];
                let c = cur;
                while (c.x !== depart.x || c.y !== depart.y) {
                    chemin.unshift(c);
                    c = pred.get(cle(c.x, c.y));
                }
                return chemin;
            }
            const voisins = [
                { x: cur.x + 1, y: cur.y }, { x: cur.x - 1, y: cur.y },
                { x: cur.x, y: cur.y + 1 }, { x: cur.x, y: cur.y - 1 }
            ];
            for (const v of voisins) {
                const k = cle(v.x, v.y);
                if (!vu.has(k) && passable(v.x, v.y)) {
                    vu.add(k);
                    pred.set(k, cur);
                    file.push(v);
                }
            }
        }
        return null;
    }

    /** Suit le chemin tuile par tuile (velocity Arcade, vitesse en tuiles/s). */
    _suivreChemin() {
        if (!this.chemin || !this.chemin.length) return;
        const C = this.C;
        const tuile = this.map.tileWidth;
        const cible = this.chemin[0];
        const pos = this._tileCentre(cible.x, cible.y);
        const dx = pos.x - this.joueur.x;
        const dy = pos.y - this.joueur.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 2) {
            // Tuile atteinte : on passe à la suivante.
            this.joueur.body.setVelocity(0, 0);
            this.joueur.setPosition(pos.x, pos.y);
            this.chemin.shift();
            this.tuileJoueur = { x: cible.x, y: cible.y };
            this.E.position = { zone: this.zoneId, x: cible.x, y: cible.y };
            if (!this.chemin.length) this._arrive();
        } else {
            const vitesse = C.grille.vitesseTuilesParSeconde * tuile;
            this.joueur.body.setVelocity(
                (dx / dist) * vitesse,
                (dy / dist) * vitesse
            );
        }
    }

    /** Arrivée à destination : portail éventuel sur la tuile (point 2). */
    _arrive() {
        const portails = FarmZones.portails(this, this.zoneId);
        const p = portails.find((p) =>
            p.tuile.x === this.tuileJoueur.x && p.tuile.y === this.tuileJoueur.y);
        if (p) this._activerPortail(p);
    }

    // ======================================================================
    // Portails (point 2) : simple → restart direct ; choix → popup
    // ======================================================================
    _activerPortail(p) {
        if (p.type === "simple") {
            this._sauvegarder();
            this.scene.restart({ zone: p.cible.zone, apparition: p.cible.apparition });
        } else if (p.type === "choix") {
            this._popupChoix(p);
        }
    }

    /** Save au passage de portail (point 2 : gather/apply existants). */
    _sauvegarder() {
        Arcade.Save.saveLocal();
        Arcade.Save.saveCloud();
    }

    _popupChoix(p) {
        if (this.popup) return;
        const C = this.C;
        const fond = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.55)
            .setOrigin(0).setScrollFactor(0).setDepth(C.profondeurs.popup);
        const titre = this.add.text(0, 0, C.textes.ouAller, {
            fontFamily: C.police.famille,
            color: "#ffffff",
            align: "center"
        })
            .setOrigin(0.5).setScrollFactor(0).setDepth(C.profondeurs.popup + 1)
            .setStroke(C.couleurs.contour, 3);

        const boutons = p.choix.map((ch) => Arcade.UI.bouton(this, {
            label: ch.label,
            couleur: ch.cible ? C.couleurs.boutonJouer : C.couleurs.boutonSecondaire,
            ombre: C.couleurs.ombreBouton,
            police: C.police.famille,
            onClick: () => {
                this._fermerPopup();
                if (ch.cible) {
                    this._sauvegarder();
                    this.scene.restart({ zone: ch.cible.zone, apparition: ch.cible.apparition });
                }
            }
        }));

        Arcade.UI.layout(this, (w, h) => {
            fond.setSize(w, h);
            titre.setFontSize(Math.round(Arcade.UI.u(this, 5)) + "px")
                .setPosition(w / 2, h * 0.32);
            const bh = Arcade.UI.u(this, 10);
            const bw = w * 0.6;
            boutons.forEach((b, i) => {
                b.redimensionner(bw, bh)
                    .setPosition(w / 2, h * 0.45 + i * (bh + Arcade.UI.u(this, 2)));
            });
        });

        this.popup = { fond: fond, titre: titre, boutons: boutons };
    }

    _fermerPopup() {
        if (!this.popup) return;
        this.popup.fond.destroy();
        this.popup.titre.destroy();
        this.popup.boutons.forEach((b) => b.destroy());
        this.popup = null;
    }

    // ======================================================================
    // Sommeil (point 6) : lit → popup → voile de nuit → tick → réveil
    // ======================================================================
    _proposerSommeil() {
        if (this.popup) return;
        const C = this.C;
        const fond = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.55)
            .setOrigin(0).setScrollFactor(0).setDepth(C.profondeurs.popup);
        const titre = this.add.text(0, 0, C.textes.dormir, {
            fontFamily: C.police.famille,
            color: "#ffffff",
            align: "center"
        })
            .setOrigin(0.5).setScrollFactor(0).setDepth(C.profondeurs.popup + 1)
            .setStroke(C.couleurs.contour, 3);

        const oui = Arcade.UI.bouton(this, {
            label: C.textes.dormirOui,
            couleur: C.couleurs.boutonJouer,
            ombre: C.couleurs.ombreBouton,
            police: C.police.famille,
            onClick: () => {
                this._fermerPopup();
                this._dormir();
            }
        });
        const non = Arcade.UI.bouton(this, {
            label: C.textes.dormirNon,
            couleur: C.couleurs.boutonSecondaire,
            ombre: C.couleurs.ombreBouton,
            police: C.police.famille,
            onClick: () => this._fermerPopup()
        });

        Arcade.UI.layout(this, (w, h) => {
            fond.setSize(w, h);
            titre.setFontSize(Math.round(Arcade.UI.u(this, 5)) + "px")
                .setPosition(w / 2, h * 0.35);
            const bh = Arcade.UI.u(this, 10);
            const bw = w * 0.6;
            oui.redimensionner(bw, bh).setPosition(w / 2, h * 0.5);
            non.redimensionner(bw, bh)
                .setPosition(w / 2, h * 0.5 + bh + Arcade.UI.u(this, 2));
        });

        this.popup = { fond: fond, titre: titre, boutons: [oui, non] };
    }

    _dormir() {
        const C = this.C;
        const E = this.E;

        // Voile de nuit (fondu) — recalculé à la rotation.
        if (!this.voile) {
            this.voile = this.add.rectangle(0, 0, 10, 10, 0x000000, 0)
                .setOrigin(0).setScrollFactor(0).setDepth(C.profondeurs.nuit + 1);
            Arcade.UI.layout(this, (w, h) => this.voile.setSize(w, h));
        }

        const tAvant = E.horloge.t;
        const tApres = FarmHorloge.versReveil(tAvant, C);

        this.tweens.add({
            targets: this.voile,
            alpha: 0.92,
            duration: 600,
            onComplete: () => {
                // Tick quotidien : pousse, reset arrosage, changement de saison.
                FarmSol.tickNuit(E, C, tAvant, tApres);
                E.horloge.t = tApres;
                this._rendreSols();
                this._rafraichirHorloge(true);
                // Réveil : le voile se lève.
                this.tweens.add({ targets: this.voile, alpha: 0, duration: 800 });
                // Save FORCÉE au réveil (point de non-retour du jour, point 6).
                Arcade.Save.saveLocal();
                Arcade.Save.saveCloud();
            }
        });
    }

    // ======================================================================
    // HUD : horloge (heure/saison/jour), barre d'outils, zoom +/−
    // ======================================================================
    _creerHUD() {
        const C = this.C;

        // Horloge (haut, centré).
        this.hudHorloge = this.add.text(0, 0, "", {
            fontFamily: C.police.famille,
            color: C.couleurs.texte,
            align: "center"
        })
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(C.profondeurs.hud)
            .setStroke(C.couleurs.contour, 3);

        // Barre d'outils (bas, 5 slots — point 3). Le clic sur une icône ne
        // traverse pas vers la grille (stopPropagation du composant).
        this.barre = Arcade.UI.barreIcones(this, {
            items: [
                { cle: "pelle", icone: "⛏️" },
                { cle: "arrosoir", icone: "🚿" },
                { cle: "main", icone: "✋" },
                { cle: "graines", icone: C.sol.graineTest },
                { cle: "libre", icone: "❔" }
            ],
            couleurFond: C.couleurs.boutonSecondaire,
            couleurBordure: "#3d6b52",
            couleurActif: C.barreOutils.eclatCouleur,
            grisAlpha: C.barreOutils.grisAlpha,
            police: C.police.famille,
            profondeur: C.profondeurs.hud,
            onClic: (cle) => this._choisirOutil(cle)
        });

        // Boutons zoom +/− (toujours visibles — point 3). marqueurClic :
        // le clic sur un bouton ne déclenche pas le déplacement (_clic).
        this.zoomPlus = Arcade.UI.bouton(this, {
            label: "+",
            couleur: C.couleurs.boutonSecondaire,
            ombre: C.couleurs.ombreBouton,
            police: C.police.famille,
            marqueurClic: true,
            onClick: () => this._zoom(C.zoom.pas)
        });
        this.zoomMoins = Arcade.UI.bouton(this, {
            label: "−",
            couleur: C.couleurs.boutonSecondaire,
            ombre: C.couleurs.ombreBouton,
            police: C.police.famille,
            marqueurClic: true,
            onClick: () => this._zoom(-C.zoom.pas)
        });

        // Mise en page recalculée à chaque rotation.
        Arcade.UI.layout(this, (w, h) => {
            const u = (n) => Arcade.UI.u(this, n);
            this.hudHorloge
                .setFontSize(Math.round(u(C.hud.tailleTexteU)) + "px")
                .setPosition(w / 2, u(C.hud.margeU));

            const cote = u(C.barreOutils.tailleIconeU);
            this.barre.placer({
                x: w / 2,
                y: h - cote / 2 - u(C.barreOutils.margeU),
                cote: cote,
                tailleIcone: u(C.barreOutils.tailleEmojiU),
                tailleBadge: u(C.barreOutils.tailleQuantiteU)
            });

            const zb = u(C.zoom.tailleBoutonU);
            const xZoom = w - u(C.zoom.margeU) - zb / 2;
            this.zoomPlus.redimensionner(zb, zb).setPosition(xZoom, h * 0.42);
            this.zoomMoins.redimensionner(zb, zb)
                .setPosition(xZoom, h * 0.42 + zb + u(1));
        });
    }

    /** Sélection d'un outil (toggle ; le slot libre désarme). */
    _choisirOutil(cle) {
        if (cle === "libre") {
            this.barre.setActif(null);
            return;
        }
        const actif = this.barre.actif() === cle ? null : cle;
        this.barre.setActif(actif);
    }

    /** Zoom caméra, borné (config.camera.zoomMin/Max). */
    _zoom(pas) {
        const C = this.C;
        const z = Phaser.Math.Clamp(
            this.cameras.main.zoom + pas,
            C.camera.zoomMin,
            C.camera.zoomMax
        );
        this.cameras.main.setZoom(z);
    }

    // ======================================================================
    // Horloge : HUD + teinte jour/nuit, rafraîchis au changement d'heure
    // ======================================================================
    _rafraichirHorloge(force) {
        const C = this.C;
        const E = this.E;
        const h = FarmHorloge.heure(E.horloge.t);
        if (!force && h === this.derniereHeure) return;
        this.derniereHeure = h;

        this.hudHorloge.setText(
            C.textes.hudHorloge
                .replace("{jour}", FarmHorloge.jour(E.horloge.t))
                .replace("{saison}", FarmHorloge.saisonNom(E.horloge.t, C))
                .replace("{heure}", h)
        );

        // Teinte jour/nuit : overlay plein écran coloré par plage horaire.
        const teinte = this._teinte(h);
        if (!this.nuit) {
            this.nuit = this.add.rectangle(0, 0, 10, 10, 0x000000, 0)
                .setOrigin(0).setScrollFactor(0).setDepth(C.profondeurs.nuit);
            Arcade.UI.layout(this, (w, hh) => this.nuit.setSize(w, hh));
        }
        this.nuit.setFillStyle(
            parseInt(teinte.couleur.slice(1), 16),
            teinte.alpha
        );
    }

    /** Teinte de la plage horaire courante (dernière dont debut <= heure). */
    _teinte(heure) {
        const teintes = this.C.horloge.teintes;
        let courante = teintes[teintes.length - 1];
        for (const t of teintes) {
            if (heure >= t.debut) courante = t;
        }
        return courante;
    }

    // ======================================================================
    // Rendu des sols (point 5) : tuile labourée + emoji de pousse
    // ======================================================================
    _rendreSols() {
        const C = this.C;
        const E = this.E;
        const zone = E.sols[this.zoneId] || {};

        // Détruit les emojis de pousse précédents.
        for (const k in this._emojis) {
            this._emojis[k].destroy();
            delete this._emojis[k];
        }

        // Cases actives de CETTE zone (labourée / plantée / prête).
        const actives = {};
        for (const k in zone) {
            const c = zone[k];
            if (c.etat !== "labouree" && c.etat !== "plantee" && c.etat !== "prete") continue;
            actives[k] = true;
            const [x, y] = k.split(",").map(Number);
            this.map.putTileAt(C.sol.tuileLaboureeId + 1, x, y, true, "sol");

            let emoji = null;
            if (c.etat === "plantee") emoji = "🌱";
            else if (c.etat === "prete") emoji = C.sol.graineTest;
            if (emoji) {
                const pos = this._tileCentre(x, y);
                this._emojis[k] = this.add.text(pos.x, pos.y, emoji, {
                    fontFamily: C.police.famille,
                    fontSize: Math.round(this.map.tileWidth * 0.85) + "px",
                    align: "center"
                })
                    .setOrigin(0.5)
                    .setDepth(C.profondeurs.pousse);
            }
        }

        // Les cases qui ne sont plus actives (ex. récoltée → vide) reviennent
        // à la tuile d'origine (herbe).
        for (const k in this._labourees) {
            if (!actives[k]) {
                const [x, y] = k.split(",").map(Number);
                this.map.putTileAt(C.sol.tuileHerbeId + 1, x, y, true, "sol");
            }
        }
        this._labourees = actives;
    }
}
