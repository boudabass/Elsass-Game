/*
 * BandesLaterales.js — bandes latérales physiques de la piste (PRD 875
 * §12, 09/09/2026). 2 bandes longeant la piste de part et d'autre (de la
 * fosse jusqu'à la zone de lancer). Corps immobiles (murs) pour le
 * rebond de la boule et des quilles ; la boule peut rebondir dessus
 * (collision solide) mais tout contact boule↔bande rend le jet FAUTIF
 * (réédition sans limite, cf. GameScene._jetTermine, qui consomme
 * `toucheBande`). Une quille debout qui touche une bande est considérée
 * comme renversée.
 *
 * Extrait de GameScene.js le 19/09/2026 (revue qualité : GameScene.js
 * dépassait 1850 lignes) — DÉPLACEMENT DE CODE PUR, aucun changement de
 * comportement (mêmes formules, même ordre de dessin sur le Graphics
 * partagé, même ordre d'enregistrement des colliders).
 */
class BandesLaterales {
    /** @param {Phaser.Scene} scene la GameScene propriétaire */
    constructor(scene) {
        this.scene = scene;
        this.groupe = null;
        this.gauche = null;
        this.droite = null;
        // PRD 875 §12 : flag persistant jusqu'à l'arrêt complet de la
        // boule, consommé UNIQUEMENT par GameScene._jetTermine (remplace
        // l'ancien this.bouleToucheBande, accès direct, pas de proxy).
        this.toucheBande = false;
    }

    /** Crée les 2 corps physiques. Appelé une fois depuis GameScene.create(). */
    creer() {
        this.groupe = this.scene.physics.add.group();
        this.gauche = this._creerBande();
        this.droite = this._creerBande();
    }

    /**
     * Zone avec corps physique (PRD 875 §12) : plus simple qu'un sprite
     * pour un corps rectangulaire invisible — body.setSize() en pixels
     * monde, sans interférence d'échelle de texture.
     */
    _creerBande() {
        const scene = this.scene;
        const bande = scene.add.zone(0, 0, 1, 1);
        scene.physics.add.existing(bande, false);
        bande.setDepth(3);
        // `groupe.add()` réinitialise immovable/allowGravity aux défauts
        // Phaser (false/true, confirmé le 19/09/2026) — les régler APRÈS
        // l'ajout au groupe, pas avant, sinon la bande redevient un corps
        // mobile soumis à la gravité (silencieusement, sans erreur).
        this.groupe.add(bande);
        bande.body.setImmovable(true);
        bande.body.setAllowGravity(false);
        return bande;
    }

    /**
     * Colliders boule↔bandes et quilles↔bandes. Appelé depuis
     * GameScene._creerColliders(), juste après le collider quille↔quille
     * (même ordre relatif d'enregistrement qu'avant l'extraction).
     * `scene._corrigerRebondMur` reste dans GameScene (générique, partagé
     * avec boule↔quille/quille↔quille) — rappelé ici en collideCallback.
     */
    creerColliders() {
        const scene = this.scene;
        // Boule ↔ bandes latérales (PRD 875 §12) : la boule rebondit
        // (collision solide), le contact est détecté pour faute. Un seul
        // collider pour les 2 bandes (this.groupe), même idiome que
        // boule↔quillesGroup dans GameScene._creerColliders.
        scene.physics.add.collider(
            scene.boule, this.groupe,
            (boule, bande) => scene._corrigerRebondMur(boule, bande),
            (boule, bande) => this.processCollisionBoule(boule, bande),
            this
        );
        // Quilles ↔ bandes (PRD 875 §12) : une quille debout qui touche
        // une bande est considérée comme renversée.
        scene.physics.add.collider(
            scene.quillesGroup, this.groupe,
            (quille, bande) => scene._corrigerRebondMur(quille, bande),
            (quille, bande) => this.processCollisionQuille(quille, bande),
            this
        );
    }

    /**
     * Contact boule↔bande latérale (PRD 875 §12) : marque le flag
     * persistant qui rendra le jet fautif (GameScene._jetTermine).
     */
    processCollisionBoule(boule, bande) {
        this.toucheBande = true;
        return true;
    }

    /**
     * Contact quille↔bande latérale (PRD 875 §12) : une quille restée
     * DEBOUT après contact avec une bande est considérée comme RENVERSÉE
     * (compter ses points normalement selon le jet en cours). S'il s'agit
     * déjà d'une quille tombée, on laisse le rebond physique
     * (scene._corrigerRebondMur) sans changer son état. Direction de
     * chute = normale de contact (quille - bande), même convention que
     * _corrigerRebondMur — la quille tombe en s'écartant de la bande,
     * pas toujours vers le bas.
     */
    processCollisionQuille(quille, bande) {
        const scene = this.scene;
        if (quille.getData("debout")) {
            scene._toucherQuille(quille, quille.x - bande.x, quille.y - bande.y);
            scene._rendreQuilleMobile(quille);
        }
        return true;
    }

    /** Positionne les 2 bandes (resize) : rectangles longeant la piste de
     * part et d'autre, de la fosse (y=0) jusqu'à la zone de lancer. */
    positionner() {
        const scene = this.scene;
        const C = window.QuillesSaintGallConfig;
        const largeurPx = scene.pxParCm * C.bande.largeurCm;
        const hauteur = scene.ligneLancerY;

        // Bande gauche (entre le bord de la piste et le vide à gauche)
        const xGauche = scene.pisteOffsetX - largeurPx / 2;
        this.gauche.setPosition(xGauche, hauteur / 2);
        this.gauche.body.setSize(largeurPx, hauteur);

        // Bande droite (entre le bord droit de la piste et le panneau d'info)
        const xDroite = scene.pisteOffsetX + scene.pisteLargeur + largeurPx / 2;
        this.droite.setPosition(xDroite, hauteur / 2);
        this.droite.body.setSize(largeurPx, hauteur);
    }

    /**
     * Dessine les 2 rectangles SUR `graphics` (le Graphics partagé de la
     * piste, `scene.sol`) — appelée au même endroit exact dans
     * GameScene._dessinerDecor (juste après le tracé de la piste, avant
     * le panneau d'info) pour préserver l'empilement visuel (même
     * Graphics, même depth=1, l'ordre d'appel fait l'empilement). La
     * bande droite peut partiellement passer sous le panneau d'info
     * (semi-transparent) — effet de profondeur acceptable.
     */
    dessiner(graphics) {
        const scene = this.scene;
        const C = window.QuillesSaintGallConfig;
        const UI = Arcade.UI;
        const largeurPx = scene.pxParCm * C.bande.largeurCm;
        const ox = scene.pisteOffsetX, wp = scene.pisteLargeur, hauteur = scene.ligneLancerY;
        // cBord = C.couleurs.pisteBord (PAS C.bande.couleurBord, resté
        // sans usage depuis toujours — même couleur de bord que la
        // piste, pour la continuité visuelle).
        const cBord = Phaser.Display.Color.HexStringToColor(C.couleurs.pisteBord).color;

        graphics.fillStyle(Phaser.Display.Color.HexStringToColor(C.bande.couleur).color, 1);
        graphics.fillRect(ox - largeurPx, 0, largeurPx, hauteur);
        graphics.fillRect(ox + wp, 0, largeurPx, hauteur);
        graphics.lineStyle(Math.max(1, UI.u(scene, 0.2)), cBord, 0.9);
        graphics.strokeRect(ox - largeurPx, 0, largeurPx, hauteur);
        graphics.strokeRect(ox + wp, 0, largeurPx, hauteur);
    }

    /** Bord extérieur réel (sortie de piste) — utilisé par GameScene._suivreBoule. */
    estHorsBornes(x) {
        const scene = this.scene;
        const C = window.QuillesSaintGallConfig;
        const largeurPx = scene.pxParCm * C.bande.largeurCm;
        return x < scene.pisteOffsetX - largeurPx - 20 ||
            x > scene.pisteOffsetX + scene.pisteLargeur + largeurPx + 20;
    }
}
