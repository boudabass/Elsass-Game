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
 * traduire les clics en appels Grille et animer le résultat.
 *
 * SIM-3 (énergie, chrono, fin de partie — spec 473 §6, §8) :
 *   - HUD Phaser via Arcade.UI (u = % du plus petit côté, PAS d'overlay
 *     DOM) : Score (gauche), ⏱ chrono (centre), ⚡ énergie (droite), mis à
 *     jour en jeu ;
 *   - le chrono décompte chaque seconde (120 s au départ, non plafonné — les
 *     gains s'ajoutent) ; le premier épuisé entre chrono et énergie termine
 *     la partie (spec §2) ;
 *   - 3 causes de fin → même écran OverScene avec le motif : « Temps
 *     écoulé » (chrono à 0), « Plus d'énergie » (énergie à 0, déclenché
 *     APRÈS la résolution du dernier coup pour laisser les points tomber),
 *     « Grille pleine » (aucune case vide) ;
 *   - AUCUNE sauvegarde : core/save.js n'est pas câblé (session unique,
 *     spec §2) ; seul le score part au serveur via OverScene →
 *     Arcade.Score.submit.
 *
 * SIM-4 (polish, spec 473 §8) : états d'alerte du HUD — le chrono passe
 *   en rouge et pulse sous chronoAlerteS s, l'énergie idem sous
 *   energieAlerte ⚡ (valeurs dans config.js). La pulsation s'arrête et la
 *   couleur normale revient si le joueur repasse au-dessus du seuil (gains
 *   de temps / d'énergie). Les animations de sélection, translation,
 *   disparition et textes flottants étaient déjà en place (SIM-2).
 *
 * SIM-6 (jokers en partie, spec 728 §3) : la barre de jokers en bas de
 *   l'écran (une icône par joker + sa quantité, grisée à zéro), copiée de
 *   l'inventaire du profil au début de partie (jokers achetés emportés,
 *   SIM-8). Clic sur une icône = arme (l'icône s'éclaire) ; les 3 jokers à
 *   effet immédiat (Mélange / Sablier / Foudre) s'appliquent au clic, le
 *   Marteau attend le clic suivant sur un item ; re-clic = désarme, rien
 *   n'est consommé. Un joker n'est décompté qu'au moment où son effet
 *   s'applique réellement. Utiliser un joker ne coûte jamais d'énergie et
 *   ne compte pas comme un déplacement. RÈGLE D'OR : aucun joker ne
 *   rapporte jamais de point (la résolution du Mélange se fait à 0 gain).
 *   Un alignement de 5+ offre 1 joker aléatoire, ajouté immédiatement à la
 *   barre. Les EFFETS vivent dans Grille.js (logique pure, testée en
 *   headless) ; cette scène ne fait que traduire les clics et animer.
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

        // Barre de jokers (spec 728 §3) : au début de partie, elle reprend
        // l'inventaire du profil persistant (les jokers achetés en boutique
        // — SIM-8 — sont « emportés au début de la partie suivante ») ; les
        // jokers gagnés EN PARTIE (alignement 5+) s'y ajoutent ensuite sans
        // toucher à l'inventaire.
        const etatProfil = window.SimilitudeProfil;
        if (etatProfil && etatProfil.profil) {
            this.grille.initialiserJokers(etatProfil.profil.inventaire);
        }
        this._creerBarreJokers();

        // --- Rendu de la grille ------------------------------------------
        // Un rectangle par case (fond visible de la grille 9×9), un sprite
        // par case remplie. Tout est repositionné/redimensionné au layout.
        this.fonds = [];
        this.sprites = [];
        this.anime = false;         // verrou pendant les animations (mouvement / résolution)
        this.finAttente = null;     // fin de partie différée (chrono à 0 pendant une animation)
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
                    .setStrokeStyle(1, coulBord)
                    .setDepth(C.profondeurs.fondsCase);
                this.fonds[l][c] = fond;
                this.sprites[l][c] = this._creerSprite(l, c);
            }
        }

        // --- HUD Phaser (spec §8) ----------------------------------------
        // Score (gauche), ⏱ chrono (centre), ⚡ énergie (droite) — textes
        // Arcade.UI, tailles en % du plus petit côté, PAS d'overlay DOM.
        // Couche HUD (SIM-FIX-DEPTH) : au-dessus de la grille en toutes
        // circonstances — y compris les items apparus en cours de partie.
        this.hudScore = UI.text(this, 0, 0, "", C.hudTailleTextePct, C.couleurs.texteClair)
            .setDepth(C.profondeurs.hud);
        this.hudChrono = UI.text(this, 0, 0, "", C.hudTailleTextePct, C.couleurs.texteClair)
            .setDepth(C.profondeurs.hud);
        this.hudEnergie = UI.text(this, 0, 0, "", C.hudTailleTextePct, C.couleurs.texteClair)
            .setDepth(C.profondeurs.hud);
        this._majHUD();   // valeurs de départ : 0 pt, 120 s, 25 ⚡ (spec §4)

        // Chrono : 1 décompte par seconde (spec §4 — 120 s, non plafonné).
        // Le premier épuisé entre chrono et énergie termine la partie (§2).
        this.chronoTimer = this.time.addEvent({
            delay: 1000,
            loop: true,
            callback: () => this._tickChrono()
        });

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
        // défini dans config.js. La profondeur est posée ICI (pas seulement
        // dans create()) : tout sprite créé après coup (spawn, déplacement,
        // mélange) repart sur sa couche, sinon le bug de l'ordre d'affichage
        // reviendrait (SIM-FIX-DEPTH, art. 704).
        return this.add.image(0, 0, C.items[type].cle)
            .setDepth(C.profondeurs.items);
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

        // HUD : une ligne en haut de l'écran — Score à gauche, ⏱ au centre,
        // ⚡ à droite (spec §8). Tailles en % du plus petit côté.
        const tailleTexte = UI.u(this, C.hudTailleTextePct) + "px";
        const yHud = UI.u(this, C.hudMargePct) + UI.u(this, C.hudTailleTextePct) / 2;

        this.hudScore.setFontSize(tailleTexte);
        this.hudChrono.setFontSize(tailleTexte);
        this.hudEnergie.setFontSize(tailleTexte);

        this.hudScore.setOrigin(0, 0.5).setPosition(UI.u(this, C.hudMargePct), yHud);
        this.hudChrono.setOrigin(0.5, 0.5).setPosition(w / 2, yHud);
        this.hudEnergie.setOrigin(1, 0.5).setPosition(w - UI.u(this, C.hudMargePct), yHud);

        // Barre de jokers (spec 728 §3) : en bas de l'écran, centrée.
        if (this.barreJokers) {
            const B = C.barreJokers;
            const tailleIcone = UI.u(this, B.tailleIconePct);
            const marge = UI.u(this, B.margePct);
            const yBarre = h - marge - tailleIcone / 2;
            const espace = tailleIcone + marge;
            const x0Barre = w / 2 - (C.jokers.length - 1) * espace / 2;

            C.jokers.forEach((j, i) => {
                const ic = this.barreJokers[j.cle];
                const x = x0Barre + i * espace;
                ic.fond.setPosition(x, yBarre).setSize(tailleIcone, tailleIcone);
                ic.emoji.setPosition(x, yBarre - tailleIcone * 0.06)
                    .setFontSize(Math.round(UI.u(this, B.tailleEmojiPct)) + "px");
                ic.quantite.setPosition(x, yBarre + tailleIcone * 0.32)
                    .setFontSize(Math.round(UI.u(this, B.tailleQuantitePct)) + "px");
                ic.zone.setPosition(x, yBarre).setSize(tailleIcone, tailleIcone);
            });
        }
    }

    /** Rafraîchit les trois valeurs du HUD depuis l'état de la grille. */
    _majHUD() {
        const C = window.SimilitudeConfig;
        this.hudScore.setText(C.textes.hudScore.replace("{score}", this.grille.score));
        this.hudChrono.setText(C.textes.hudChrono.replace("{s}", Math.ceil(this.grille.temps)));
        this.hudEnergie.setText(C.textes.hudEnergie.replace("{e}", this.grille.energie));
        this._majAlertesHUD();
    }

    /**
     * États d'alerte du HUD (spec 473 §8, SIM-4) : le chrono passe en rouge
     * et pulse sous chronoAlerteS s ; l'énergie idem sous energieAlerte ⚡.
     * Si le joueur repasse au-dessus du seuil (gains de temps / d'énergie),
     * la couleur normale revient et la pulsation s'arrête.
     */
    _majAlertesHUD() {
        const C = window.SimilitudeConfig;
        this._setAlerte("alerteChrono", this.hudChrono,
            this.grille.temps < C.chronoAlerteS);
        this._setAlerte("alerteEnergie", this.hudEnergie,
            this.grille.energie < C.energieAlerte);
    }

    /**
     * Applique (ou retire) l'état d'alerte d'un texte du HUD : couleur
     * rouge + pulsation (scale yoyo répété). Le tween est conservé dans
     * this[cle] pour pouvoir être arrêté proprement à la sortie d'alerte.
     */
    _setAlerte(cle, texte, enAlerte) {
        const C = window.SimilitudeConfig;
        const tween = this[cle];

        if (enAlerte && !tween) {
            texte.setColor(C.couleurs.alerte);
            this[cle] = this.tweens.add({
                targets: texte,
                scaleX: 1 + C.amplitudePulseAlertePct / 100,
                scaleY: 1 + C.amplitudePulseAlertePct / 100,
                duration: C.dureePulseAlerteMs,
                yoyo: true,
                repeat: -1,
                ease: "Sine.easeInOut"
            });
        } else if (!enAlerte && tween) {
            tween.stop();
            this[cle] = null;
            texte.setColor(C.couleurs.texteClair);
            texte.setScale(1);
        }
    }

    /** Un décompte de chrono par seconde ; à 0 → fin « Temps écoulé ». */
    _tickChrono() {
        if (this.finAttente) return;
        this.grille.temps -= 1;
        if (this.grille.temps <= 0) {
            this.grille.temps = 0;
            this._majHUD();
            // On laisse le coup en cours (animation) se terminer pour que le
            // joueur voie ses derniers points tomber (spec §6), puis on finit.
            if (this.anime) this.finAttente = "finChrono";
            else this._finir("finChrono");
            return;
        }
        this._majHUD();
    }

    /**
     * Fin de partie (spec §6) : la scène OverScene reçoit le score final et
     * le motif (clé textes.finChrono / finEnergie / finGrillePleine).
     * AUCUNE sauvegarde : session unique (spec §2).
     */
    _finir(motif) {
        if (this.finAttente === "fini") return;
        this.finAttente = "fini";   // garde-fou : on ne finit qu'une fois
        if (this.chronoTimer) this.chronoTimer.remove(false);
        this.scene.start(OverScene.KEY, { score: this.grille.score, motif: motif });
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
        // SIM-FIX-DEPTH : l'item sélectionné (agrandi) monte à 2 tant qu'il
        // est sélectionné, et redescend à 1 à la désélection — sinon il est
        // rogné par les fonds des cases créées après lui.
        spr.setDepth(estSelectionne ? C.profondeurs.itemSelectionne : C.profondeurs.items);
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

        // Marteau armé (spec 728 §3) : le clic suivant sur un item l'applique
        // (suppression, 0 point, 0 ⚡) ; un clic dans le vide ne coûte rien et
        // ne déplace pas (le marteau reste armé).
        if (this.grille.jokerArme === "marteau") {
            this._appliquerMarteau(l, c);
            return;
        }

        if (this.grille.get(l, c) === null) this._deplacerVers(l, c);
        else this._selectionner(l, c);
    }

    /**
     * Marteau (spec 728 §3) : supprime l'item cliqué. Ne coûte pas d'énergie,
     * ne rapporte AUCUN point, ne compte pas comme un déplacement. Le joker
     * n'est décompté que si un item est réellement retiré (clic dans le vide :
     * rien ne se passe, le marteau reste armé).
     */
    _appliquerMarteau(l, c) {
        const C = window.SimilitudeConfig;
        const r = this.grille.appliquerMarteau(l, c);
        if (!r.ok) return;   // case vide : rien consommé, marteau toujours armé

        const spr = this.sprites[l][c];
        this.sprites[l][c] = null;

        this._consommerInventaire("marteau");
        this._majBarreJokers();
        this._majHUD();

        if (!spr) { this._verifierFin(); return; }

        // Disparition de l'item supprimé (fondu + réduction, spec §8).
        this.anime = true;
        this.tweens.add({
            targets: spr,
            alpha: 0, scaleX: 0, scaleY: 0,
            duration: C.dureeDisparitionMs,
            ease: "Sine.easeIn",
            onComplete: () => {
                spr.destroy();
                this.anime = false;
                this._verifierFin();
            }
        });
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
        if (!r.ok) {
            // Plus d'énergie : la partie s'arrête (spec §6 — « Plus
            // d'énergie », après la résolution du dernier coup déjà joué).
            if (r.raison === "plus-energie" && this.finAttente !== "fini") {
                this._finir("finEnergie");
            }
            return;
        }

        this._majHUD();   // le coût du déplacement a fait baisser l'énergie

        const spr = this.sprites[sel.l][sel.c];
        this.sprites[l][c] = spr;          // le sprite suit l'item dans la grille
        this.sprites[sel.l][sel.c] = null;
        spr.clearTint();                   // la sélection est consommée par le déplacement
        spr.setDepth(C.profondeurs.items); // … et l'item redescend de la couche 2 (SIM-FIX-DEPTH)

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
        this._majHUD();   // gains appliqués : score, énergie, temps à jour

        if (res.aucun) {
            // Coup raté : 2 nouveaux items sur des cases vides tirées au
            // hasard (spec §3).
            const poses = this.grille.spawner(C.itemsParCoupRate);
            poses.forEach((p) => {
                this.sprites[p.l][p.c] = this._creerSprite(p.l, p.c);
            });
            this.redessiner(this.largeur, this.hauteur);
            this.anime = false;
            this._verifierFin();
            return;
        }

        // Alignement(s) : disparition SIMULTANÉE (fondu + réduction, spec §8).
        this._afficherGains(res);

        // Joker offert par un alignement de 5+ (spec 728 §3) : ajouté
        // immédiatement à la barre de jokers de la partie en cours.
        if (res.jokerGagne) {
            this._majBarreJokers();
            this._annoncerJoker(res.jokerGagne);
        }

        this._disparaitrePositions(res.retires);
    }

    /**
     * Fait disparaître les sprites des positions données (fondu + réduction
     * simultanés, spec §8). Verrouille les clics pendant l'animation puis
     * vérifie la fin de partie (spec §6).
     */
    _disparaitrePositions(positions) {
        const C = window.SimilitudeConfig;
        const disparus = [];
        positions.forEach((p) => {
            const spr = this.sprites[p.l][p.c];
            if (spr) {
                this.sprites[p.l][p.c] = null;
                disparus.push(spr);
            }
        });

        if (!disparus.length) { this.anime = false; this._verifierFin(); return; }

        this.anime = true;
        this.tweens.add({
            targets: disparus,
            alpha: 0, scaleX: 0, scaleY: 0,
            duration: C.dureeDisparitionMs,
            ease: "Sine.easeIn",
            onComplete: () => {
                disparus.forEach((s) => s.destroy());
                this.anime = false;
                this._verifierFin();
            }
        });
    }

    /**
     * Fin de tour : on vérifie si la partie doit s'arrêter (spec §6).
     *  - chrono déjà à 0 pendant l'animation → « Temps écoulé » (différé) ;
     *  - aucune case vide → « Grille pleine » ;
     *  - énergie à 0 → « Plus d'énergie » (le joueur a vu ses points tomber).
     */
    _verifierFin() {
        if (this.finAttente === "fini") return;
        if (this.finAttente) {          // « Temps écoulé » différé pendant l'animation
            this._finir(this.finAttente);
            return;
        }
        if (this.grille.estPleine()) { this._finir("finGrillePleine"); return; }
        if (this.grille.energie <= 0) { this._finir("finEnergie"); return; }
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
            }).setOrigin(0.5)
              .setDepth(C.profondeurs.textesFlottants);

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
            }).setOrigin(0.5)
              .setDepth(C.profondeurs.textesFlottants);

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

    // =====================================================================
    // Barre de jokers (spec 728 §3, SIM-6) — affichage + clics. Les EFFETS
    // vivent dans Grille.js (logique pure, testée en headless) ; ici on ne
    // fait que traduire les clics en appels Grille et animer le résultat.
    // =====================================================================

    /**
     * Barre de jokers en bas de l'écran : une icône par joker (emoji) avec
     * sa quantité, grisée à zéro. Clic sur une icône = arme (l'icône
     * s'éclaire) ; re-clic = désarme (rien n'est consommé) ; les jokers à
     * effet immédiat (Mélange / Sablier / Foudre) s'appliquent au clic, le
     * Marteau attend le clic suivant sur un item. Clic/tap uniquement,
     * tailles en % du plus petit côté (config barreJokers).
     */
    _creerBarreJokers() {
        const C = window.SimilitudeConfig;
        this.barreJokers = {};

        C.jokers.forEach((j) => {
            const fond = this.add.rectangle(0, 0, 0, 0, this._hex(C.couleurs.caseFond), 1)
                .setStrokeStyle(1, this._hex(C.couleurs.caseBordure))
                .setDepth(C.profondeurs.hud);
            const emoji = this.add.text(0, 0, j.emoji, {
                fontFamily: "system-ui, sans-serif",
                fontSize: "0px"
            }).setOrigin(0.5)
              .setDepth(C.profondeurs.hud);
            const quantite = this.add.text(0, 0, "0", {
                fontFamily: "system-ui, sans-serif",
                fontSize: "0px",
                color: C.couleurs.texteClair
            }).setOrigin(0.5)
              .setDepth(C.profondeurs.hud);
            // Couche HUD pour la zone aussi : la barre capte les clics AVANT
            // la grille (les objets les plus hauts sont testés en premier).
            const zone = this.add.zone(0, 0, 1, 1).setInteractive({ useHandCursor: true })
                .setDepth(C.profondeurs.hud);
            zone.on("pointerdown", (pointeur, localX, localY, event) => {
                event.stopPropagation();   // le clic ne doit pas atteindre la grille
                this._clicJoker(j.cle);
            });

            this.barreJokers[j.cle] = { j: j, fond: fond, emoji: emoji, quantite: quantite, zone: zone };
        });

        this._majBarreJokers();
    }

    /** Rafraîchit la barre : quantités, grisée à zéro, icône armée éclairée. */
    _majBarreJokers() {
        const C = window.SimilitudeConfig;
        const B = C.barreJokers;
        const arme = this.grille.jokerArme;

        Object.keys(this.barreJokers).forEach((cle) => {
            const ic = this.barreJokers[cle];
            const q = this.grille.quantiteJoker(cle);
            ic.quantite.setText(String(q));

            const estArme = arme === cle;
            ic.fond.setFillStyle(estArme ? this._hex(B.eclatCouleur) : this._hex(C.couleurs.caseFond), 1);
            const alpha = (q <= 0 && !estArme) ? B.grisAlpha : 1;
            ic.fond.setAlpha(alpha);
            ic.emoji.setAlpha(alpha);
            ic.quantite.setAlpha(alpha);
        });
    }

    /**
     * Clic sur une icône de joker (spec 728 §3) : arme / désarme, ou
     * applique immédiatement pour les jokers à effet immédiat.
     */
    _clicJoker(cle) {
        if (this.anime) return;   // pas de joker pendant une animation
        const r = this.grille.armerJoker(cle);
        if (!r.ok) return;        // quantité 0 : icône grisée, rien ne se passe
        if (!r.applique) {
            this._majBarreJokers();   // Marteau armé / désarmé : éclairage
            return;
        }
        this._appliquerEffetJoker(cle, r);
    }

    /**
     * Effet immédiat d'un joker (Mélange / Sablier / Foudre) : application
     * sur la grille, synchro de l'inventaire persistant (l'utilisation d'un
     * joker est un moment explicite de save, spec 728 §2), animations.
     */
    _appliquerEffetJoker(cle, r) {
        const C = window.SimilitudeConfig;

        this._consommerInventaire(cle);
        this._majBarreJokers();
        this._majHUD();

        if (cle === "sablier") {
            this._texteFlottantCentre("+" + C.effetsJokers.sablierSecondes + " s ⏳", C.couleurs.texteClair);
        } else if (cle === "foudre") {
            this._texteFlottantCentre("+" + C.effetsJokers.foudreEnergie + " ⚡", C.couleurs.texteClair);
        } else if (cle === "melange") {
            // Les alignements formés par le mélange sont résolus mais
            // rapportent 0 (règle d'or, spec 728 §3) : les items sautent,
            // rien n'est gagné.
            this._texteFlottantCentre("🌀 Mélange !", C.couleurs.combo);
            this._disparaitrePositions(r.retires);
        }
    }

    /**
     * Utilisation d'un joker = moment explicite de save (spec 728 §2) :
     * l'inventaire persistant du profil est décompté si le joker consommé
     * EN VENAIT (acheté, emporté au début de partie) — jamais pour un joker
     * gagné EN PARTIE (alignement 5+), qui n'a jamais touché à l'inventaire.
     */
    _consommerInventaire(cle) {
        const etat = window.SimilitudeProfil;
        if (!etat || !etat.profil) return;
        const inv = etat.profil.inventaire;
        if (typeof inv[cle] === "number" && inv[cle] > 0) {
            inv[cle] -= 1;
            Arcade.Save.saveLocal();
            Arcade.Save.saveCloud();
        }
    }

    /** Annonce visuelle d'un joker gagné en partie (spec 728 §3). */
    _annoncerJoker(cle) {
        const C = window.SimilitudeConfig;
        const UI = Arcade.UI;
        const j = C.jokers.find((x) => x.cle === cle);
        const ic = this.barreJokers[cle];
        const taille = UI.u(this, C.tailleTexteGainPct);

        const txt = this.add.text(ic.fond.x, ic.fond.y - ic.fond.displayHeight / 2 - UI.u(this, 3), "+1 " + (j ? j.emoji : cle), {
            fontFamily: "system-ui, sans-serif",
            fontSize: `${Math.round(taille)}px`,
            color: C.couleurs.combo,
            stroke: C.couleurs.texteContour,
            strokeThickness: Math.max(1, Math.round(taille * 0.12))
        }).setOrigin(0.5)
          .setDepth(C.profondeurs.textesFlottants);

        this.tweens.add({
            targets: txt,
            y: txt.y - UI.u(this, 4),
            alpha: 0,
            duration: C.dureeTexteGainMs,
            ease: "Sine.easeOut",
            onComplete: () => txt.destroy()
        });
    }

    /** Texte flottant au centre de l'écran (retours des jokers). */
    _texteFlottantCentre(texte, couleur) {
        const C = window.SimilitudeConfig;
        const UI = Arcade.UI;
        const taille = UI.u(this, C.tailleTexteGainPct) * 1.6;

        const txt = this.add.text(this.largeur / 2, this.hauteur * 0.35, texte, {
            fontFamily: "system-ui, sans-serif",
            fontSize: `${Math.round(taille)}px`,
            color: couleur,
            stroke: C.couleurs.texteContour,
            strokeThickness: Math.max(1, Math.round(taille * 0.12))
        }).setOrigin(0.5)
          .setDepth(C.profondeurs.textesFlottants);

        this.tweens.add({
            targets: txt,
            y: txt.y - UI.u(this, 6),
            alpha: 0,
            duration: C.dureeTexteGainMs,
            ease: "Sine.easeOut",
            onComplete: () => txt.destroy()
        });
    }
}
