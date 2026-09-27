/*
 * Visee.js — placement de la boule sur la planche de tir + ligne d'aide à
 * la visée (direction choisie via les boutons ◄/►).
 *
 * Extrait de GameScene.js le 19/09/2026 (revue qualité : GameScene.js
 * dépassait 1850 lignes) — DÉPLACEMENT DE CODE PUR, aucun changement de
 * comportement (mêmes formules, même ordre de dessin).
 *
 * 27/09/2026 (demande John, article 780 : « la boule doit être déposée sur
 * la planche avant de toucher la piste ») : le demi-cercle de placement
 * libre est remplacé par la PLANCHE DE TIR. La boule ne peut plus être
 * posée que dessus — un peu de jeu à gauche/droite (largeur de planche −
 * diamètre de boule) et sur toute sa longueur. La visée passe donc
 * presque entièrement par la rotation ◄/►.
 *
 * Ne possède PAS la géométrie de la planche (`scene.planche`, calculée
 * dans GameScene._recalculerGeometrie et lue ici en lecture seule), ni les
 * sprites `scene.boule`/`scene.ombreBoule` (créés par
 * GameScene._creerBouleEtOmbre, seulement déplacés/redimensionnés ici), ni
 * `scene.glisse` (câblage pointer de GameScene.create()).
 */
class Visee {
    /** @param {Phaser.Scene} scene la GameScene propriétaire */
    constructor(scene) {
        this.scene = scene;
        this.g = null;
        // Position de la boule sur la planche, indépendante de la taille
        // d'écran (rejouée au resize) : fracX ∈ [-1, 1] (bord gauche →
        // bord droit du jeu latéral), fracY ∈ [0, 1] (haut → bas de la
        // planche).
        this.fracX = 0;
        this.fracY = 1;
        this.angleDeg = 0;
        this.bouleX = 0;
        this.bouleY = 0;
    }

    /** Crée le Graphics dédié. Appelé une fois depuis GameScene.create(). */
    creer() {
        this.g = this.scene.add.graphics().setDepth(3);
    }

    /** Remet la visée à l'état par défaut (nouveau jet) : boule au bas de
     * la planche, au centre, visée tout droit. */
    reset() {
        this.fracX = 0;
        this.fracY = 1;
        this.angleDeg = 0;
    }

    /**
     * Course de la boule sur la planche, en pixels : `jeuX` = décalage
     * latéral max de part et d'autre du centre (la boule reste ENTIÈREMENT
     * sur la planche), `haut`/`bas` = positions extrêmes de son centre.
     */
    _course() {
        const scene = this.scene;
        const C = window.QuillesSaintGallConfig;
        const pl = scene.planche;
        const rayon = scene.pxParCm * (C.boule.diametreCm / 2);
        return {
            jeuX: Math.max(0, pl.largeur / 2 - rayon),
            haut: pl.haut + rayon,
            bas: Math.max(pl.haut + rayon, pl.bas - rayon)
        };
    }

    /** Recalcule bouleX/bouleY depuis la géométrie de la planche (resize). */
    majPosition() {
        const scene = this.scene;
        if (scene.planche === undefined) return;   // pas encore de géométrie
        const c = this._course();
        this.bouleX = scene.planche.cx + this.fracX * c.jeuX;
        this.bouleY = c.haut + this.fracY * (c.bas - c.haut);
    }

    /**
     * Place la boule au point `p` (glisser libre en 2D), ramenée sur la
     * planche : glisser au-delà d'un bord colle la boule à ce bord, comme
     * un curseur.
     */
    poser(p) {
        const scene = this.scene;
        const c = this._course();
        this.fracX = c.jeuX > 0
            ? Phaser.Math.Clamp((p.x - scene.planche.cx) / c.jeuX, -1, 1)
            : 0;
        this.fracY = c.bas > c.haut
            ? Phaser.Math.Clamp((p.y - c.haut) / (c.bas - c.haut), 0, 1)
            : 0;
        this.majPosition();
        this.positionnerBoule();
        this.dessiner();
    }

    /** Déplace/redimensionne les sprites scene.boule/scene.ombreBoule sur bouleX/bouleY. */
    positionnerBoule() {
        const scene = this.scene;
        const C = window.QuillesSaintGallConfig;
        // Rayon RÉEL (diamètre en cm × scene.pxParCm), demande John 31/08 —
        // même échelle que la piste/les quilles, remplace l'ancien % du
        // plus petit côté de l'écran (UI.u).
        const rayon = scene.pxParCm * (C.boule.diametreCm / 2);
        scene.boule.setDisplaySize(rayon * 2, rayon * 2);
        scene.boule.setPosition(this.bouleX, this.bouleY);
        scene.boule.body.setVelocity(0, 0);
        scene.boule.body.updateFromGameObject();
        scene.ombreBoule.setPosition(this.bouleX, this.bouleY);
        scene.ombreBoule.setRadius(rayon * 0.42);
        scene.ombreBoule.setVisible(true);
    }

    /** Tourne la direction de visée d'un cran (`sens` = -1 ou +1). */
    pivoter(sens) {
        const scene = this.scene;
        if (scene.etat !== "placement") return;
        const C = window.QuillesSaintGallConfig;
        this.angleDeg = Phaser.Math.Clamp(
            this.angleDeg + sens * C.recul.rotationStepDeg,
            -C.recul.rotationMaxDeg, C.recul.rotationMaxDeg);
        this.dessiner();
    }

    dessiner() {
        const scene = this.scene;
        const C = window.QuillesSaintGallConfig;
        const UI = Arcade.UI;
        const coulCercle = Phaser.Display.Color.HexStringToColor(C.couleurs.cercle).color;
        const coul = Phaser.Display.Color.HexStringToColor(C.couleurs.trajectoire).color;

        this.g.clear();
        if (scene.etat !== "placement") return;

        // Contour de la planche (zone où la boule peut être posée), en
        // surbrillance pendant le placement seulement.
        const pl = scene.planche;
        this.g.lineStyle(UI.u(scene, 0.4), coulCercle, 0.7);
        this.g.strokeRect(pl.cx - pl.largeur / 2, pl.haut, pl.largeur, pl.bas - pl.haut);

        // Ligne de visée : direction choisie via les boutons ◄/►, depuis la
        // position actuelle de la boule (angle 0 = tout droit vers le haut).
        const angleRad = Phaser.Math.DegToRad(this.angleDeg);
        const dirX = Math.sin(angleRad), dirY = -Math.cos(angleRad);
        // Palier de difficulté : longueur de la ligne d'aide à la visée
        // (§10/12, choisi dans MenuScene) — fraction de la piste en
        // facile/normal, OU un petit trait FIXE de la taille de la boule
        // en difficile (demande John 04/09 : sans aucune ligne on ne voit
        // plus du tout la rotation choisie — il faut un repère minimal,
        // pas une fraction qui deviendrait invisible).
        const aide = scene.palierConf.aideVisee;
        const longueur = aide.tailleBoule
            ? scene.pxParCm * C.boule.diametreCm
            : this.bouleY * aide.pctPiste;
        // Le trait part du BORD du repère rond (pas du centre de la
        // boule) : en difficile, un trait de la taille de la boule tracé
        // depuis le centre restait entièrement caché sous ce repère (plus
        // grand que le trait lui-même) — invisible en pratique, alors que
        // le but est justement de voir la rotation choisie.
        const rayonRepere = UI.u(scene, 3);
        this.g.lineStyle(UI.u(scene, 0.5), coul, 0.9);
        if (longueur > 0) {
            this.g.lineBetween(
                this.bouleX + dirX * rayonRepere, this.bouleY + dirY * rayonRepere,
                this.bouleX + dirX * (rayonRepere + longueur), this.bouleY + dirY * (rayonRepere + longueur));
        }
        this.g.strokeCircle(this.bouleX, this.bouleY, rayonRepere);
    }
}
