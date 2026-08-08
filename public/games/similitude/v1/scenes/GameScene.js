/*
 * GameScene — la partie elle-même.
 *
 * SIM-1 (squelette + grille, spec 473 §9) : la grille 9×9 fixe, centrée, en
 * tailles % du plus petit côté, affiche le tirage initial de 30 items parmi
 * les 6 types, sans aucun alignement ≥ 3 au départ (garantie Grille.js).
 *
 * SIM-2 (cœur de jeu, spec 473 §2, §3, §5, §8) : le gameplay complet est
 * câblé, clic/tap uniquement (spec §2, jamais de glisser-déposer) :
 *   - clic 1 sur un item → sélection (surbrillance + léger agrandissement) ;
 *     re-clic → désélection ; clic sur un AUTRE item → la sélection se
 *     déplace (jamais d'échange) ;
 *   - clic 2 sur une case vide → déplacement (translation ~150 ms), coût de
 *     energieDeplacement ⚡ prélevé AU DÉPLACEMENT, jamais à la sélection ;
 *   - résolution : tous les alignements ≥ 3 disparaissent simultanément
 *     (fondu + réduction) ; gains affichés en texte flottant à l'endroit de
 *     la fusion (spec §8) ;
 *   - suite du tour : alignement sauté → AUCUN nouvel item (récompense) ;
 *     rien sauté → itemsParCoupRate nouveaux items sur cases vides (spawn).
 *
 * Toute la règle vit dans Grille.js (logique pure) ; cette scène ne fait que
 * traduire les clics en appels Grille et animer le résultat. Le HUD
 * (score / chrono / énergie persistants) et la fin de partie arrivent en
 * SIM-3.
 */
class GameScene extends Phaser.Scene {
    static KEY = "jeu";

    constructor() {
        super(GameScene.KEY);
    }

    create() {
        const C = window.SimilitudeConfig;
        const UI = Arcade.UI;

        // ⭐ Décision John 08/08 (art. 704 Chantier B) : les boutons Retour
        // et Plein écran ne sont affichés QUE sur le menu principal.

        this.cameras.main.setBackgroundColor(C.couleurs.fond);

        // Tirage initial : 30 items, garantie aucun alignement ≥ 3 (spec §4).
        this.grille = new Grille(C);
        this.grille.tirageInitial(C.itemsDepart);

        // --- Rendu de la grille ------------------------------------------
        // Un rectangle par case (fond visible de la grille 9×9), un sprite
        // par case remplie. Tout est repositionné/redimensionné au layout.
        this.fonds = [];
        this.sprites = [];
        this.anime = false;         // verrou pendant les animations (mouvement / résolution)
        this.tailleCase = 0;
        this.x0 = 0; this.y0 = 0;   // coin haut-gauche de la grille (recalculé au layout)

        // Couleurs depuis config.js (spec §10 — rien en dur).
        const coulCase = this._hex(C.couleurs.caseFond);
        const coulBord = this._hex(C.couleurs.caseBordure);

        for (let l = 0; l < C.grilleTaille; l++) {
            this.fonds[l] = [];
            this.sprites[l] = [];
            for (let c = 0; c < C.grilleTaille; c++) {
                const fond = this.add
                    .rectangle(0, 0, 0, 0, coulCase, 1)
                    .setStrokeStyle(1, coulBord);
                this.fonds[l][c] = fond;
                this.sprites[l][c] = this._creerSprite(l, c);
            }
        }

        // Clic / tap uniquement (spec §2 : jamais de glisser-déposer).
        this.input.on("pointerdown", (pointeur) => this._clic(pointeur));

        UI.layout(this, (w, h) => this.redessiner(w, h));
    }

    /** "#2c4f3c" → 0x2c4f3c (les couleurs vivent dans config.js). */
    _hex(s) {
        return parseInt(s.slice(1), 16);
    }

    /** Sprite de l'item en (l, c), ou null si la case est vide. */
    _creerSprite(l, c) {
        const C = window.SimilitudeConfig;
        const type = this.grille.get(l, c);
        if (type === null) return null;
        // C.items[type] : la texture correspond à l'ordre des types (0..5)
        // défini dans config.js.
        return this.add.image(0, 0, C.items[type].cle);
    }

    /** Recentre / redimensionne la grille (rotation, plein écran, desktop). */
    redessiner(w, h) {
        const C = window.SimilitudeConfig;
        const UI = Arcade.UI;

        this.largeur = w;
        this.hauteur = h;
        this.tailleCase = UI.u(this, C.tailleCasePct);   // % du plus petit côté
        const cote = this.tailleCase * C.grilleTaille;
        this.x0 = (w - cote) / 2;
        this.y0 = (h - cote) / 2;

        const marge = UI.u(this, C.margeCasePct);

        for (let l = 0; l < C.grilleTaille; l++) {
            for (let c = 0; c < C.grilleTaille; c++) {
                const cx = this.x0 + c * this.tailleCase + this.tailleCase / 2;
                const cy = this.y0 + l * this.tailleCase + this.tailleCase / 2;

                this.fonds[l][c]
                    .setPosition(cx, cy)
                    .setSize(this.tailleCase - marge, this.tailleCase - marge);

                const spr = this.sprites[l][c];
                if (spr) {
                    spr.setPosition(cx, cy);
                    this._tailleSprite(spr, l, c);
                }
            }
        }
    }

    /** Taille (et surbrillance éventuelle) de l'item (l, c). */
    _tailleSprite(spr, l, c) {
        const C = window.SimilitudeConfig;
        const sel = this.grille.selection;
        const estSelectionne = sel && sel.l === l && sel.c === c;
        const facteur = estSelectionne
            ? 1 + C.selectionAgrandissementPct / 100
            : 1;
        const cote = this.tailleCase * (C.tailleItemPct / 100) * facteur;
        spr.setDisplaySize(cote, cote);
        if (estSelectionne) spr.setTint(this._hex(C.couleurs.surbrillance));
        else spr.clearTint();
    }

    /** Case cliquée : sélection (item) ou déplacement (case vide, spec §3). */
    _clic(pointeur) {
        const C = window.SimilitudeConfig;
        if (this.anime) return;   // on ignore les clics pendant les animations

        const c = Math.floor((pointeur.x - this.x0) / this.tailleCase);
        const l = Math.floor((pointeur.y - this.y0) / this.tailleCase);
        if (l < 0 || c < 0 || l >= C.grilleTaille || c >= C.grilleTaille) return;

        if (this.grille.get(l, c) === null) this._deplacerVers(l, c);
        else this._selectionner(l, c);
    }

    /** Clic 1 sur un item : sélection / désélection / déplacement de sélection. */
    _selectionner(l, c) {
        const avant = this.grille.selection;
        this.grille.selectionner(l, c);
        if (avant) this._tailleSprite(this.sprites[avant.l][avant.c], avant.l, avant.c);
        const apres = this.grille.selection;
        if (apres) this._tailleSprite(this.sprites[apres.l][apres.c], apres.l, apres.c);
    }

    /** Clic 2 sur une case vide : déplacement animé, puis résolution. */
    _deplacerVers(l, c) {
        const C = window.SimilitudeConfig;
        const sel = this.grille.selection;
        if (!sel || this.anime) return;

        const r = this.grille.deplacer(sel.l, sel.c, l, c);
        if (!r.ok) return;   // plus d'énergie : la partie s'arrêtera (fin en SIM-3)

        const spr = this.sprites[sel.l][sel.c];
        this.sprites[l][c] = spr;          // le sprite suit l'item dans la grille
        this.sprites[sel.l][sel.c] = null;
        spr.clearTint();                   // la sélection est consommée par le déplacement

        const cx = this.x0 + c * this.tailleCase + this.tailleCase / 2;
        const cy = this.y0 + l * this.tailleCase + this.tailleCase / 2;

        // Animation de translation (~150 ms, spec §3 / §8).
        this.anime = true;
        this.tweens.add({
            targets: spr,
            x: cx, y: cy,
            duration: C.dureeDeplacementMs,
            ease: "Sine.easeOut",
            onComplete: () => this._apresDeplacement()
        });
    }

    /** Résolution + suite du tour (spawn si rien n'a sauté, spec §3). */
    _apresDeplacement() {
        const C = window.SimilitudeConfig;
        const res = this.grille.resoudre();

        if (res.aucun) {
            // Coup raté : 2 nouveaux items sur des cases vides tirées au
            // hasard (spec §3).
            const poses = this.grille.spawner(C.itemsParCoupRate);
            poses.forEach((p) => {
                this.sprites[p.l][p.c] = this._creerSprite(p.l, p.c);
            });
            this.redessiner(this.largeur, this.hauteur);
            this.anime = false;
            return;
        }

        // Alignement(s) : disparition SIMULTANÉE (fondu + réduction, spec §8).
        const disparus = [];
        res.retires.forEach((p) => {
            const spr = this.sprites[p.l][p.c];
            if (spr) {
                this.sprites[p.l][p.c] = null;
                disparus.push(spr);
            }
        });

        this._afficherGains(res);

        if (!disparus.length) { this.anime = false; return; }

        this.tweens.add({
            targets: disparus,
            alpha: 0, scaleX: 0, scaleY: 0,
            duration: C.dureeDisparitionMs,
            ease: "Sine.easeIn",
            onComplete: () => {
                disparus.forEach((s) => s.destroy());
                this.anime = false;
            }
        });
    }

    /** Texte flottant des gains à l'endroit de la fusion (spec §8). */
    _afficherGains(res) {
        const C = window.SimilitudeConfig;
        const UI = Arcade.UI;
        const cote = this.tailleCase;
        const facteur = res.combo ? 2 : 1;   // combo : total doublé (spec §5)
        const tailleTexte = UI.u(this, C.tailleTexteGainPct);

        // Un texte par alignement, à l'endroit de la fusion.
        res.alignements.forEach((a) => {
            const l = a.horizontal ? a.ligne : a.ligne + (a.longueur - 1) / 2;
            const c = a.horizontal ? a.colonne + (a.longueur - 1) / 2 : a.colonne;
            const pts = C.bareme.points(a.longueur) * facteur;
            const en = C.bareme.energie(a.longueur) * facteur;
            const tm = C.bareme.temps(a.longueur) * facteur;

            const x = this.x0 + c * cote + cote / 2;
            const y = this.y0 + l * cote + cote / 2;
            const txt = this.add.text(x, y, `+${pts} pts · +${en} ⚡ · +${tm} s`, {
                fontFamily: "system-ui, sans-serif",
                fontSize: `${Math.round(tailleTexte)}px`,
                color: C.couleurs.texteClair,
                stroke: C.couleurs.texteContour,
                strokeThickness: Math.max(1, Math.round(tailleTexte * 0.12))
            }).setOrigin(0.5);

            this.tweens.add({
                targets: txt,
                y: y - cote,
                alpha: 0,
                duration: C.dureeTexteGainMs,
                ease: "Sine.easeOut",
                onComplete: () => txt.destroy()
            });
        });

        // Bannière « Combo ×2 » au-dessus de la grille (spec §5, §8).
        if (res.combo) {
            const x = this.x0 + cote * C.grilleTaille / 2;
            const y = this.y0 - cote;
            const txt = this.add.text(x, y, "Combo ×2 !", {
                fontFamily: "system-ui, sans-serif",
                fontSize: `${Math.round(tailleTexte * 1.8)}px`,
                color: C.couleurs.combo,
                stroke: C.couleurs.texteContour,
                strokeThickness: Math.max(1, Math.round(tailleTexte * 0.2))
            }).setOrigin(0.5);

            this.tweens.add({
                targets: txt,
                y: y - cote,
                alpha: 0,
                duration: C.dureeTexteGainMs,
                ease: "Sine.easeOut",
                onComplete: () => txt.destroy()
            });
        }
    }
}
