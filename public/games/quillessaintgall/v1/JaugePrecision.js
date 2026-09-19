/*
 * JaugePrecision.js — jauge de précision du tir (étape 2 du lancer, entre
 * le placement et le lancement) : une aiguille balaie une barre, il faut
 * l'arrêter (clic/tap) dans la zone orange pour un tir conforme, sinon le
 * tir dévie (cf. GameScene._lancer, qui consomme `deviation`).
 *
 * Extrait de GameScene.js le 19/09/2026 (revue qualité : GameScene.js
 * dépassait 1850 lignes) — DÉPLACEMENT DE CODE PUR, aucun changement de
 * comportement (mêmes formules, même timing de redessin).
 *
 * La largeur de la zone orange dépend de la force choisie (plus la force
 * est haute, plus elle se réduit) ET du palier de difficulté
 * (`scene.palierConf.zoneOrangeMultiplicateur`) ; la vitesse de balayage
 * de l'aiguille dépend aussi du palier
 * (`scene.palierConf.vitesseBalayageMultiplicateur`) — cf. PRD 875 §10/12.
 */
class JaugePrecision {
    /** @param {Phaser.Scene} scene la GameScene propriétaire */
    constructor(scene) {
        this.scene = scene;
        this.g = null;
        this.temps = 0;
        this.needle = 0.5;
        this.zoneCentre = 0.5;
        this.deviation = 0;
        this.zoneOrangeLargeurPctActuelle = window.QuillesSaintGallConfig.jauge.zoneOrangeLargeurMaxPct;
    }

    /** Crée le Graphics dédié. Appelé une fois depuis GameScene.create(). */
    creer() {
        this.g = this.scene.add.graphics().setDepth(22);
    }

    /**
     * Démarre un nouveau tir : remet l'aiguille à zéro, recalcule la
     * largeur de la zone orange (force + palier) et tire son centre au
     * hasard. N'appelle PAS dessiner() — comme avant l'extraction, le
     * premier rendu de la barre n'arrive qu'à la frame suivante via
     * avancer(dt) (cf. GameScene._demarrerJauge).
     */
    demarrer() {
        const scene = this.scene;
        const C = window.QuillesSaintGallConfig;
        this.temps = 0;
        this.needle = 0.5;

        // Largeur de la zone orange pour CE tir, interpolée depuis la force
        // choisie (demande John, 30/08 : plus la force est haute, plus le
        // tir peut être dévié — la zone orange se réduit). Figée ici, ne
        // change plus pendant la jauge même si on pouvait toucher -/+.
        const t = (scene.force - C.force.min) / (C.force.max - C.force.min);
        const largeurSelonForce = C.jauge.zoneOrangeLargeurMaxPct +
            t * (C.jauge.zoneOrangeLargeurMinPct - C.jauge.zoneOrangeLargeurMaxPct);
        // Palier de difficulté (§10/12, choisi dans MenuScene) : multiplicateur
        // appliqué PAR-DESSUS le calcul selon la force ci-dessus, avec un
        // plancher absolu pour rester jouable même à force 100% en difficile.
        this.zoneOrangeLargeurPctActuelle = Math.max(
            C.jauge.largeurMinAbsoluePct,
            largeurSelonForce * scene.palierConf.zoneOrangeMultiplicateur);

        const demiOrange = this.zoneOrangeLargeurPctActuelle / 200;
        this.zoneCentre = demiOrange + Math.random() * (1 - 2 * demiOrange);
        this.deviation = 0;
    }

    /** Avance l'aiguille d'un pas de temps `dt` (secondes). */
    avancer(dt) {
        const scene = this.scene;
        const C = window.QuillesSaintGallConfig;
        this.temps += dt;
        // Palier de difficulté : multiplicateur sur la vitesse de balayage
        // de l'aiguille (§10/12, choisi dans MenuScene).
        const vitesse = C.jauge.vitesseBalayagePar_s * scene.palierConf.vitesseBalayageMultiplicateur;
        this.needle = 0.5 + 0.5 *
            Math.sin(2 * Math.PI * vitesse * this.temps);
        this.dessiner();
    }

    /**
     * Arrête l'aiguille : calcule la déviation (0 si dans la zone orange,
     * sinon une fraction de 0 à 1). Retourne `true` si le tir est
     * conforme (déviation nulle).
     */
    arreter() {
        const demiOrange = this.zoneOrangeLargeurPctActuelle / 200;
        const d = Math.abs(this.needle - this.zoneCentre);
        if (d <= demiOrange) {
            this.deviation = 0;
        } else {
            this.deviation = Phaser.Math.Clamp(
                (d - demiOrange) / (1 - demiOrange), 0, 1);
        }
        this.dessiner();
        return this.deviation === 0;
    }

    dessiner() {
        const scene = this.scene;
        const C = window.QuillesSaintGallConfig;
        const UI = Arcade.UI;
        // Centrée sur la PISTE (pas tout l'écran) — même raison que
        // GameScene._positionnerTextes (demande John 31/08). `pisteOffsetX` :
        // décalage de la piste quand une bande vide se forme à sa gauche.
        const wp = scene.pisteLargeur;
        const ox = scene.pisteOffsetX;

        this.g.clear();
        if (scene.etat !== "jauge" && scene.etat !== "feedback") return;

        const largeur = (C.jauge.largeurPct / 100) * wp;
        const hauteur = UI.u(scene, C.jauge.hauteurU);
        const x = ox + (wp - largeur) / 2;
        const y = scene.ligneLancerY - hauteur - UI.u(scene, 2);

        const cFond = Phaser.Display.Color.HexStringToColor(C.couleurs.jaugeFond).color;
        const cBarre = Phaser.Display.Color.HexStringToColor(C.couleurs.jaugeBarre).color;
        const cOrange = Phaser.Display.Color.HexStringToColor(C.couleurs.jaugeZoneOrange).color;
        const cAiguille = Phaser.Display.Color.HexStringToColor(C.couleurs.jaugeAiguille).color;

        this.g.fillStyle(cFond, 1);
        this.g.fillRoundedRect(x, y, largeur, hauteur, hauteur * 0.3);
        this.g.fillStyle(cBarre, 0.35);
        this.g.fillRoundedRect(x, y, largeur, hauteur, hauteur * 0.3);

        const oW = (this.zoneOrangeLargeurPctActuelle / 100) * largeur;
        const oC = x + this.zoneCentre * largeur;
        this.g.fillStyle(cOrange, 0.9);
        this.g.fillRoundedRect(oC - oW / 2, y, oW, hauteur, hauteur * 0.3);

        const nX = x + this.needle * largeur;
        this.g.lineStyle(Math.max(1, UI.u(scene, 0.4)), cAiguille, 1);
        this.g.lineBetween(nX, y - hauteur * 0.2, nX, y + hauteur * 1.2);
    }
}
