/*
 * NiveauxScene — les 100 niveaux de Schieweschlawe, une page par palier
 * (10 niveaux), flèches pour changer de palier.
 *
 * Chaque tuile (Arcade.UI.carte) montre (décision John 24/09) :
 *   - réussi    : bord or + meilleur résultat « 2 lancers · 87 % »
 *                 (le moins de lancers, puis la meilleure proximité) ;
 *   - à jouer   : carte rouge (LA prochaine action) ;
 *   - verrouillé: fond « ligne », cadenas — déblocage linéaire : il faut
 *                 réussir le niveau N pour ouvrir N+1.
 * Portrait : 2 colonnes × 5 lignes (tuiles larges, le résultat se lit) ;
 * paysage : 5 × 2.
 */
class NiveauxScene extends Phaser.Scene {
    static KEY = "niveaux";

    constructor() {
        super(NiveauxScene.KEY);
    }

    create() {
        const C = window.SchieweschlaweConfig;
        const T = C.textes;
        const UI = Arcade.UI;
        this.C = C;
        this.courant = this.registry.get("currentLevel") || 1;
        this.resultats = this.registry.get("resultats") || {};
        this.nbPages = C.niveaux.total / C.niveaux.parPalier;
        this.page = Math.ceil(MenuScene.prochainNiveau(this.registry) / C.niveaux.parPalier) - 1;
        this.tuiles = [];

        const fond = this.add.graphics().setDepth(0);
        UI.layout(this, (w, h) => {
            fond.clear();
            fond.fillStyle(Phaser.Display.Color.HexStringToColor(C.couleurs.ciel).color, 1);
            fond.fillRect(0, 0, w, h);
        });

        this.pageInfo = this.add.text(0, 0, "", {
            fontFamily: C.police.famille, fontStyle: "bold",
            color: Arcade.UI.tokens.creme, align: "center"
        }).setOrigin(0.5);
        this.prec = UI.fleche(this, "gauche", () => this._changerPage(-1));
        this.suiv = UI.fleche(this, "droite", () => this._changerPage(1));

        UI.ecran(this, {
            surtitre: C.titre,
            titre: T.niveaux,
            retour: { label: T.retourMenu, onClick: () => this.scene.start(MenuScene.KEY) },
            contenu: (zone) => {
                this.zone = zone;
                this._dessiner();
            }
        });
    }

    _changerPage(delta) {
        const p = this.page + delta;
        if (p < 0 || p >= this.nbPages) return;
        this.page = p;
        this._dessiner();
    }

    _dessiner() {
        const C = this.C;
        const UI = Arcade.UI;
        const u = (n) => UI.u(this, n);
        const z = this.zone;
        if (!z) return;

        // Pagination en bas de la zone.
        const yPage = z.y + z.hauteur - u(4.5);
        this.pageInfo.setText(C.textes.palier
            .replace("{p}", this.page + 1).replace("{total}", this.nbPages))
            .setFontSize(Math.round(u(3.5)) + "px")
            .setPosition(z.cx, yPage);
        this.prec.redimensionner(u(9)).setPosition(z.cx - u(21), yPage);
        this.suiv.redimensionner(u(9)).setPosition(z.cx + u(21), yPage);
        this.prec.setVisible(this.page > 0);
        this.suiv.setVisible(this.page < this.nbPages - 1);

        // Grille : 2 × 5 en portrait, 5 × 2 en paysage.
        this.tuiles.forEach((o) => o.destroy());
        this.tuiles = [];
        const hautGrille = z.y;
        const basGrille = yPage - u(8);
        const hDispo = basGrille - hautGrille;
        const cols = z.largeur >= hDispo ? 5 : 2;
        const lignes = C.niveaux.parPalier / cols;
        const gap = u(1.8);
        const lTuile = (z.largeur - (cols - 1) * gap) / cols;
        const hTuile = Math.min((hDispo - (lignes - 1) * gap) / lignes, lTuile, u(22));
        const x0 = z.cx - (cols * lTuile + (cols - 1) * gap) / 2;
        const y0 = hautGrille + (hDispo - (lignes * hTuile + (lignes - 1) * gap)) / 2;

        for (let i = 0; i < C.niveaux.parPalier; i++) {
            const n = this.page * C.niveaux.parPalier + i + 1;
            const x = x0 + (i % cols) * (lTuile + gap);
            const y = y0 + Math.floor(i / cols) * (hTuile + gap);
            this._tuile(n, x, y, lTuile, hTuile);
        }
    }

    _tuile(n, x, y, l, h) {
        const C = this.C;
        const T = C.textes;
        const UI = Arcade.UI;
        const tk = UI.tokens;
        const res = this.resultats[String(n)];
        const etat = res ? "reussi" : (n === this.courant ? "primaire" : "verrou");
        const ouvert = etat !== "verrou";

        const g = this.add.graphics();
        UI.carte(g, x, y, l, h, etat);
        const couleur = etat === "primaire" ? "#ffffff"
            : (etat === "verrou" ? C.couleurs.texteDiscret : tk.encre);

        const titre = this.add.text(x + l / 2, y + h * 0.36, T.niveauTuile.replace("{n}", n), {
            fontFamily: C.police.famille, fontStyle: "bold", color: couleur, align: "center"
        }).setOrigin(0.5);
        const detail = this.add.text(x + l / 2, y + h * 0.7,
            res ? NiveauxScene.texteResultat(res.lancers, res.proximite)
                : (etat === "primaire" ? T.aJouer : T.verrouille), {
                fontFamily: C.police.famille, color: couleur, align: "center"
            }).setOrigin(0.5);
        NiveauxScene._tenir(titre, l * 0.88, Math.min(UI.u(this, 3.8), h * 0.3), 11);
        NiveauxScene._tenir(detail, l * 0.88, Math.min(UI.u(this, 3), h * 0.24), 10);
        this.tuiles.push(g, titre, detail);

        if (!ouvert) return;
        const zone = this.add.rectangle(x + l / 2, y + h / 2, l, h, 0x000000, 0)
            .setInteractive({ useHandCursor: true });
        zone.on("pointerdown", () => g.setAlpha(0.75));
        zone.on("pointerout", () => g.setAlpha(1));
        zone.on("pointerup", () => {
            g.setAlpha(1);
            this.scene.start(GameScene.KEY, { niveau: n });
        });
        this.tuiles.push(zone);
    }

    /** « 2 lancers · 87 % » — partagé avec l'écran de fin. */
    static texteResultat(lancers, proximite) {
        const T = window.SchieweschlaweConfig.textes;
        return T.resultatTuile
            .replace("{lancers}", NiveauxScene.texteLancers(lancers))
            .replace("{p}", proximite);
    }

    static texteLancers(n) {
        const T = window.SchieweschlaweConfig.textes;
        return n === 1 ? T.lancer1 : T.lancerN.replace("{n}", n);
    }

    /** Police à taillePx, réduite jusqu'à tenir dans largeur (plancher minPx). */
    static _tenir(txt, largeur, taillePx, minPx) {
        let t = Math.round(taillePx);
        txt.setFontSize(t + "px");
        while (txt.width > largeur && t > minPx) {
            t -= 1;
            txt.setFontSize(t + "px");
        }
    }
}
