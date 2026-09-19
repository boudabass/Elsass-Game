/*
 * Visee.js — placement de la boule dans le demi-cercle de tir + ligne
 * d'aide à la visée (direction choisie via les boutons ◄/►).
 *
 * Extrait de GameScene.js le 19/09/2026 (revue qualité : GameScene.js
 * dépassait 1850 lignes) — DÉPLACEMENT DE CODE PUR, aucun changement de
 * comportement (mêmes formules, même ordre de dessin).
 *
 * Ne possède PAS la géométrie du demi-cercle (`scene.cercleX/cercleY/
 * cercleRayon`, calculée dans GameScene._recalculerGeometrie et lue ici
 * en lecture seule), ni les sprites `scene.boule`/`scene.ombreBoule`
 * (créés par GameScene._creerBouleEtOmbre, seulement déplacés/
 * redimensionnés ici), ni `scene.glisse` (câblage pointer de
 * GameScene.create()).
 */
class Visee {
    /** @param {Phaser.Scene} scene la GameScene propriétaire */
    constructor(scene) {
        this.scene = scene;
        this.g = null;
        this.fracX = 0;
        this.fracY = 0.5;
        this.angleDeg = 0;
        this.bouleX = 0;
        this.bouleY = 0;
    }

    /** Crée le Graphics dédié. Appelé une fois depuis GameScene.create(). */
    creer() {
        this.g = this.scene.add.graphics().setDepth(3);
    }

    /** Remet la visée à l'état par défaut (nouveau jet). */
    reset() {
        this.fracX = 0;
        this.fracY = 0.5;
        this.angleDeg = 0;
    }

    /** Recalcule bouleX/bouleY depuis la géométrie du cercle (resize). */
    majPosition() {
        const scene = this.scene;
        if (scene.cercleRayon === undefined) return;   // pas encore de géométrie
        this.bouleX = scene.cercleX + this.fracX * scene.cercleRayon;
        this.bouleY = scene.cercleY + this.fracY * scene.cercleRayon;
    }

    /**
     * Place la boule au point `p` (glisser libre en 2D, clampé au
     * DEMI-cercle de placement) : jamais au-dessus de la ligne de lancer
     * (dy < 0 interdit — le côté plat du demi-cercle), et jamais au-delà
     * du rayon (glisser au-delà colle au bord, comme un curseur).
     */
    poser(p) {
        const scene = this.scene;
        const dx = p.x - scene.cercleX;
        const dy = Math.max(0, p.y - scene.cercleY);
        const dist = Math.hypot(dx, dy);
        if (dist <= scene.cercleRayon) {
            this.fracX = dx / scene.cercleRayon;
            this.fracY = dy / scene.cercleRayon;
        } else if (dist > 0) {
            this.fracX = dx / dist;
            this.fracY = dy / dist;
        }
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

        // Demi-cercle de placement (zone où la boule peut être posée) :
        // seulement l'arc du BAS (0 → PI, sens horaire = vers le bas en
        // coordonnées écran), le côté plat coïncide avec la ligne de lancer
        // déjà dessinée par la piste (pas besoin de la retracer).
        this.g.lineStyle(UI.u(scene, 0.4), coulCercle, 0.5);
        this.g.beginPath();
        this.g.arc(scene.cercleX, scene.cercleY, scene.cercleRayon, 0, Math.PI, false);
        this.g.strokePath();

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
