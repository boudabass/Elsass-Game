/*
 * MenuScene — écran d'accueil de Similitude, façon Waggis (spec 728 §7).
 *
 * ⭐ SIM-7 (spec 728 §7, verrouillée) : le menu « titre + règle + Jouer »
 * fait place à une vraie page d'accueil de jeu mobile, calquée sur le menu
 * Waggis refondu (spec 709 révision 08/08). Ce qui change :
 *  - UN SEUL bouton principal « Jouer » PLEINE LARGEUR (vert charte
 *    #2E9E4F), avec l'illustration des 6 saveurs alsaciennes (emojis —
 *    pas de sprite dédié : les textures d'items manquent encore, SIM-6
 *    QA) collée au bord droit, sur la même ligne que le titre + accroche
 *    (texte à gauche — correction John 08/08). Il lance DIRECTEMENT
 *    GameScene (Similitude n'a ni niveaux ni personnages, spec 728 §7) ;
 *  - grille 2×2 des boutons secondaires SOUS « Jouer » : Boutique ·
 *    Inventaire · Classement · Comment jouer (les 2 cases Niveaux /
 *    Personnages de Waggis sont remplacées par Inventaire et Comment
 *    jouer — Similitude n'a ni niveaux ni personnages) — petits boutons
 *    sur DEUX LIGNES (icône en haut, texte BLANC en dessous, centré DANS
 *    le bouton), chacun ouvre son écran ; Boutique et Inventaire
 *    arrivent en SIM-8 (leurs scènes ne sont pas encore enregistrées :
 *    le clic affiche « Bientôt disponible ! », jamais de placeholder) ;
 *  - « Réglages » en VRAI bouton (⚙️ + libellé) placé EN BAS À DROITE,
 *    rouge charte (SettingsScene — son on/off uniquement, préférence
 *    LOCALE soundPref.js) ;
 *  - HUD haut : « 🏆 Meilleur score : X » et le porte-monnaie 🪙 (pillules
 *    translucides, spec 728 §7) ;
 *  - Retour / Plein écran : Arcade.UI.iconesPlateforme, sur le menu
 *    principal UNIQUEMENT (décision John 08/08 — retirés des scènes
 *    secondaires) ;
 *  - visuel : dégradé de fond vert charte, boutons à coins arrondis +
 *    ombre portée + dégradé léger + feedback au clic (LE composant
 *    partagé Arcade.UI.bouton, core/ui/button.js — AUCUN bouton
 *    redessiné à la main, AUCUN style dupliqué), police Azimut (marque,
 *    auto-hébergée public/fonts/azimut/), transitions en fondu entre les
 *    écrans (SimilitudeUI.aller). Espacements verticaux UNIFORMES
 *    (C.menu.espaceU), tout empilé, jamais superposé (règle John).
 *
 * Mobile-first : les tailles sont en PROPORTION du plus petit côté
 * (Arcade.UI.u), la mise en page est recalculée à chaque rotation
 * (Arcade.UI.layout).
 */
class MenuScene extends Phaser.Scene {
    static KEY = "menu";

    constructor() {
        super(MenuScene.KEY);
    }

    async create() {
        const C = window.SimilitudeConfig;
        const UI = Arcade.UI;

        this.enTransition = false;

        // ⭐ Contrat de plateforme (art. 704, décision John 08/08) : icônes
        // persistantes Quitter (haut-gauche) / Plein écran (haut-droite) —
        // VISIBLES QUE SUR LE MENU PRINCIPAL. Le style (couleur, ombre,
        // police) vient de la config via main.js → Arcade.boot →
        // iconesPlateforme.style.
        Arcade.UI.iconesPlateforme(this);

        // Police ronde Azimut (marque, auto-hébergée — spec 728 §7).
        // Injection du @font-face puis attente COURTE : si la police
        // n'arrive pas (hors ligne), le menu se dessine en police de repli.
        await SimilitudeUI.chargerPolice(this);

        // --- Fond : dégradé (spec 728 §7 : « dégradé de fond ») -----------
        this.fond = this.add.graphics().setDepth(0);

        // --- HUD (bandeau haut) -------------------------------------------
        // « 🏆 Meilleur score : X » + porte-monnaie 🪙 (spec 728 §7), en
        // pillules translucides ; le record est chargé en fin de create
        // (Arcade.Score.load) — pillules redimensionnées à ce moment.
        this.hudPillule = this.add.graphics().setDepth(10);
        this.record = this.add.text(0, 0, "", {
            fontFamily: C.police.famille,
            color: "#ffffff",
            align: "center"
        })
            .setOrigin(0.5)
            .setDepth(11)
            .setStroke("#141210", 3)
            .setShadow(0, 2, "rgba(20, 18, 16, 0.35)", 2, false, true);

        this.walletPillule = this.add.graphics().setDepth(10);
        this.wallet = this.add.text(0, 0, "", {
            fontFamily: C.police.famille,
            color: "#ffffff",
            align: "center"
        })
            .setOrigin(0.5)
            .setDepth(11)
            .setStroke("#141210", 3)
            .setShadow(0, 2, "rgba(20, 18, 16, 0.35)", 2, false, true);

        // --- Titre + accroche ----------------------------------------------
        // Titre avec RELIEF (contour sombre + ombre portée douce, pattern
        // Waggis spec 709 révision 08/08).
        this.titre = this.add.text(0, 0, C.titre, {
            fontFamily: C.police.famille,
            color: "#ffffff",
            align: "center"
        })
            .setOrigin(0.5)
            .setDepth(20)
            .setShadow(0, 4, "rgba(20, 18, 16, 0.3)", 4, false, true);

        this.accroche = this.add.text(0, 0, C.textes.accroche, {
            fontFamily: C.police.famille,
            color: "#ffffff",
            align: "center"
        })
            .setOrigin(0.5)
            .setDepth(20)
            .setStroke("#141210", 2)
            .setShadow(0, 2, "rgba(20, 18, 16, 0.3)", 2, false, true);

        // --- Illustration (les 6 saveurs alsaciennes en emojis) -----------
        // « avec une illustration à droite » (spec 728 §7). Pas de sprite
        // dédié (textures d'items encore manquantes, SIM-6 QA) : les 6
        // emojis des saveurs (config menu.illustration) font l'illustration,
        // disposés en grille 3×2 comme des items du jeu.
        this.saveurs = C.menu.illustration.map((emoji) =>
            this.add.text(0, 0, emoji, {
                fontFamily: C.police.famille,
                align: "center"
            })
                .setOrigin(0.5)
                .setDepth(4)
                .setShadow(0, 3, "rgba(20, 18, 16, 0.35)", 3, false, true)
        );

        // --- Bloc d'actions du menu (Jouer + grille + Réglages) -----------
        // ⭐ Menu réutilisable (core/ui/menuActions.js, décision John) : le
        // composant porte lui-même les couleurs du design system The
        // Elsassisch et adapte la grille au nombre de tuiles secondaires
        // (4 -> 2×2, comme avant — spec 728 §7 non touchée). Valeurs de
        // layout reprises de config.js menu.* (déjà identiques aux
        // défauts du composant, gardées explicites ici car déjà
        // externalisées côté config).
        const M = C.menu;
        Arcade.UI.menuActions(this, {
            jouer: { label: C.textes.jouer, onClick: () => this.jouer() },
            secondaires: M.secondaires.map((sec) => ({
                icone: sec.emoji,
                label: sec.texte,
                onClick: () => this.ouvrirSecondaire(sec.cle)
            })),
            reglages: { label: C.textes.reglages, onClick: () => this.aller(SettingsScene.KEY) },
            police: C.police.famille,
            largeurJouerPct: M.largeurJouerPct,
            hauteurJouerU: M.hauteurJouerU,
            hauteurSecondaireU: M.hauteurSecondaireU,
            largeurReglagesU: M.largeurReglagesU,
            espaceU: M.espaceU
        });

        // --- Mise en page (recalculée à chaque rotation) -------------------
        // Même empilement vertical UNIFORME que Waggis (spec 709 révision
        // 08/08) : le MÊME espace C.menu.espaceU (u(4.5)) partout, entre
        // TOUS les boutons, et une LIGNE VIDE (hauteur d'un bouton
        // secondaire) sous la grille — respiration avant le bas de l'écran.
        // L'empilement est ancré EN BAS (départ du sol) :
        //   [HUD : record + porte-monnaie]
        //   [titre + accroche + illustration — paysage : même ligne,
        //    portrait : empilés]
        //   [Jouer]
        //   u(4.5)
        //   [ligne 1 : Boutique · Inventaire]
        //   u(4.5)
        //   [ligne 2 : Classement · Comment jouer]
        //   u(4.5)
        //   [ligne VIDE u(10.5) — Réglages calé à droite dans cette ligne]
        this._miseEnPage = (w, h) => {
            const u = (n) => UI.u(this, n);
            const M = C.menu;

            // Dégradé de fond (spec 728 §7).
            SimilitudeUI.ciel(this.fond, w, h);

            // HUD : record + porte-monnaie, pillules translucides centrées.
            const yRecord = h * M.hudRecordY;
            this.record
                .setFontSize(Math.round(u(3.8)) + "px")
                .setStroke("#141210", Math.max(2, Math.round(u(0.5))))
                .setPosition(w / 2, yRecord);
            const pillW = this.record.width + u(6);
            const pillH = u(5);
            this.hudPillule.clear();
            this.hudPillule.fillStyle("rgba(255, 255, 255, 0.30)", 1);
            this.hudPillule.fillRoundedRect(
                w / 2 - pillW / 2, yRecord - pillH / 2, pillW, pillH, pillH / 2
            );

            // Porte-monnaie : pillule sous le record (empilé, jamais
            // superposé — règle John), même style.
            const yWallet = yRecord + pillH / 2 + u(1.2) + u(2.4);
            this.wallet
                .setFontSize(Math.round(u(3.4)) + "px")
                .setStroke("#141210", Math.max(2, Math.round(u(0.5))))
                .setPosition(w / 2, yWallet);
            const pillW2 = this.wallet.width + u(6);
            const pillH2 = u(4.8);
            this.walletPillule.clear();
            this.walletPillule.fillStyle("rgba(255, 255, 255, 0.30)", 1);
            this.walletPillule.fillRoundedRect(
                w / 2 - pillW2 / 2, yWallet - pillH2 / 2, pillW2, pillH2, pillH2 / 2
            );

            // Titre + accroche + illustration — layout ADAPTATIF selon
            // l'orientation (correction John 08/08) :
            //  - PAYSAGE (largeur > hauteur) : texte À GAUCHE, illustration
            //    collée au bord droit, les deux sur la MÊME LIGNE ;
            //  - PORTRAIT (hauteur > largeur) : EMPILÉS — titre, accroche,
            //    puis illustration, centrés horizontalement — jamais
            //    superposés (règle John).
            const estPaysage = w > h;
            const tailleTitre = u(M.tailleTitreU);
            const hIllu = u(M.illustrationU);

            if (estPaysage) {
                const centreLigne = h * M.titrePaysageY;
                const margeGauche = u(5);
                this.titre
                    .setFontSize(Math.round(tailleTitre) + "px")
                    .setStroke(C.couleurs.boutonSecondaire,
                        Math.max(3, Math.round(tailleTitre * 0.07)))
                    .setShadow(0, Math.max(3, Math.round(tailleTitre * 0.05)),
                        "rgba(20, 18, 16, 0.3)", 4, false, true)
                    .setOrigin(0, 0.5)
                    .setPosition(margeGauche, centreLigne - u(6));
                this.accroche
                    .setFontSize(Math.round(u(M.tailleAccrocheU)) + "px")
                    .setOrigin(0, 0.5)
                    .setPosition(margeGauche, centreLigne + u(7.5));
                // Illustration À DROITE, collée au bord droit, sur la même
                // ligne que le titre + accroche.
                const illuX = w - u(2) - this._largeurSaveurs(u) / 2;
                this._positionnerSaveurs(illuX, centreLigne, u);
            } else {
                // PORTRAIT : EMPILEMENT centré, sous le HUD (départ
                // h*0.14), espace u(5) entre chaque étage — le texte
                // (titre puis accroche) et l'illustration occupent des
                // lignes distinctes, plus aucune superposition possible.
                const tailleAccroche = u(M.tailleAccrocheU);
                const espace = u(5);
                const hautBloc = h * 0.14;
                const yTitre = hautBloc + tailleTitre / 2;
                const yAccroche = yTitre + tailleTitre / 2 + espace + tailleAccroche / 2;
                const yIllu = yAccroche + tailleAccroche / 2 + espace + hIllu / 2;

                this.titre
                    .setFontSize(Math.round(tailleTitre) + "px")
                    .setStroke(C.couleurs.boutonSecondaire,
                        Math.max(3, Math.round(tailleTitre * 0.07)))
                    .setShadow(0, Math.max(3, Math.round(tailleTitre * 0.05)),
                        "rgba(20, 18, 16, 0.3)", 4, false, true)
                    .setOrigin(0.5)
                    .setPosition(w / 2, yTitre);
                this.accroche
                    .setFontSize(Math.round(tailleAccroche) + "px")
                    .setOrigin(0.5)
                    .setPosition(w / 2, yAccroche);
                this._positionnerSaveurs(w / 2, yIllu, u);
            }

            // Jouer + grille + Réglages : géré par Arcade.UI.menuActions
            // (core/ui/menuActions.js), abonné à son propre Arcade.UI.layout
            // — plus rien à positionner ici pour ce bloc.
        };

        UI.layout(this, this._miseEnPage);

        // Transition d'arrivée : fondu depuis le noir (spec 728 §7).
        this.cameras.main.fadeIn(220, 0, 0, 0);

        // Meilleur score : local d'abord, puis confirmation par le serveur.
        // Porte-monnaie : profil persistant chargé au boot (spec 728 §4).
        await Arcade.Score.load();
        this.record.setText(C.textes.meilleurScore.replace("{score}", Arcade.Score.best));
        const profil = window.SimilitudeProfil && window.SimilitudeProfil.profil;
        this.wallet.setText(C.textes.porteMonnaie.replace("{pieces}", profil ? profil.wallet : 0));
        this._miseEnPage(this.scale.width, this.scale.height);
    }

    /**
     * « Jouer » (spec 728 §7) : lance DIRECTEMENT GameScene (Similitude
     * n'a ni niveaux ni personnages — pas d'écran intermédiaire).
     */
    jouer() {
        this.aller(GameScene.KEY, {});
    }

    /**
     * Ouvre un écran secondaire depuis la grille 2×2. Les 4 écrans sont
     * enregistrés dans main.js (Boutique/Inventaire = SIM-8 : ShopScene /
     * InventaireScene ; Classement / Comment jouer = SIM-7). Le garde-fou
     * scene.get() affiche « Bientôt disponible ! » si une clé n'est pas
     * encore enregistrée — jamais de placeholder qui plante.
     */
    ouvrirSecondaire(cle) {
        const C = window.SimilitudeConfig;
        const clesScenes = {
            boutique: "boutique",        // SIM-8 (ShopScene)
            inventaire: "inventaire",    // SIM-8 (InventaireScene)
            classement: ClassementScene.KEY,
            commentJouer: CommentJouerScene.KEY
        };
        const sceneKey = clesScenes[cle];
        if (!sceneKey || !this.scene.get(sceneKey)) {
            this._annoncer(C.textes.bientot);
            return;
        }
        this.aller(sceneKey, {});
    }

    /**
     * Petite annonce temporaire (ex. « Bientôt disponible ! » pour les
     * écrans de SIM-8) : texte centré qui apparaît puis s'efface en fondu.
     */
    _annoncer(texte) {
        const C = window.SimilitudeConfig;
        const t = this.add.text(0, 0, texte, {
            fontFamily: C.police.famille,
            color: "#ffffff",
            align: "center"
        })
            .setOrigin(0.5)
            .setDepth(100)
            .setStroke("#141210", 3)
            .setShadow(0, 3, "rgba(20, 18, 16, 0.3)", 3, false, true)
            .setPosition(this.scale.width / 2, this.scale.height * 0.5)
            .setFontSize(Math.round(Arcade.UI.u(this, 5)) + "px")
            .setAlpha(0);
        this.tweens.add({
            targets: t, alpha: 1, duration: 150, yoyo: true, hold: 900,
            onComplete: () => t.destroy()
        });
    }

    /**
     * Transition animée entre écrans (spec 728 §7 — transitions en
     * fondu) : fondu au noir puis démarrage de la scène cible. Garde-fou
     * enTransition (pattern Waggis).
     */
    aller(sceneKey, data) {
        SimilitudeUI.aller(this, sceneKey, data);
    }

    // --- Illustration (saveurs) ---------------------------------------------

    /** Largeur totale de la grille 3×2 d'emojis (pour le calage à droite). */
    _largeurSaveurs(u) {
        const C = window.SimilitudeConfig;
        const taille = u(C.menu.illustrationU) * 0.34;
        return taille * 3 + u(C.menu.espaceU) * 2;   // 3 colonnes + 2 espacements
    }

    /**
     * Dispose les 6 emojis des saveurs en grille 3×2 (comme des items du
     * jeu), centrée sur (cx, cy). Chaque emoji fait ~34 % de la hauteur
     * du bloc (2 lignes + espacement → bloc ~ illustrationU).
     */
    _positionnerSaveurs(cx, cy, u) {
        const C = window.SimilitudeConfig;
        const hBloc = u(C.menu.illustrationU);
        const taille = hBloc * 0.34;
        const pasX = taille * 1.15;
        const pasY = hBloc * 0.52;
        this.saveurs.forEach((t, i) => {
            const col = i % 3;
            const ligne = Math.floor(i / 3);
            const x = cx + (col - 1) * pasX;
            const y = cy + (ligne - 0.5) * pasY;
            t.setFontSize(Math.round(taille) + "px").setPosition(x, y);
        });
    }
}
