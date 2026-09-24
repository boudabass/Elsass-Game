/*
 * MenuScene — écran d'accueil de Similitude, façon Waggis (spec 728 §7).
 *
 * ⭐ REFONTE CHARTE 23/09/2026 (décision John) : en-tête, boutons et mise
 * en page portrait/paysage sont construits par Arcade.UI.menuPrincipal
 * (core/ui/menuPrincipal.js), comme dans tous les jeux — carte noire à
 * surtitre or, Azimut + Montserrat, « Jouer » rouge, tuiles crème. Record
 * et porte-monnaie deviennent des pastilles de l'en-tête. Les actions et
 * leur ordre décrits ci-dessous (SIM-7) sont inchangés ; ce qui y concerne
 * le style (Jouer vert, pillules HUD, titre à contour) est remplacé.
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
        // VISIBLES QUE SUR LE MENU PRINCIPAL. Textes depuis la config
        // (main.js → Arcade.boot), style commun du socle.
        Arcade.UI.iconesPlateforme(this);

        // --- Fond : dégradé (spec 728 §7 : « dégradé de fond ») -----------
        this.fond = this.add.graphics().setDepth(0);
        UI.layout(this, (w, h) => SimilitudeUI.ciel(this.fond, w, h));

        // --- Illustration (les 6 saveurs alsaciennes en emojis) -----------
        // Pas de sprite dédié (textures d'items encore manquantes, SIM-6
        // QA) : les 6 emojis des saveurs font l'illustration, en grille 3×2
        // comme des items du jeu.
        this.saveurs = C.menu.illustration.map((emoji) =>
            this.add.text(0, 0, emoji, { align: "center" })
                .setOrigin(0.5)
                .setDepth(4)
                .setShadow(0, 3, "rgba(20, 18, 16, 0.35)", 3, false, true)
        );

        // --- Menu (en-tête + Jouer + grille 2×2 + Réglages) ----------------
        const profil = () => window.SimilitudeProfil && window.SimilitudeProfil.profil;
        const texteRecord = () => C.textes.meilleurScore.replace("{score}", Arcade.Score.best);
        const texteWallet = () => C.textes.porteMonnaie.replace("{pieces}", profil() ? profil().wallet : 0);
        const menu = Arcade.UI.menuPrincipal(this, {
            titre: C.titre,
            accroche: C.textes.accroche,
            infos: [texteRecord(), texteWallet()],
            jouer: { label: C.textes.jouer, onClick: () => this.jouer() },
            secondaires: C.menu.secondaires.map((sec) => ({
                icone: sec.emoji,
                label: sec.texte,
                onClick: () => this.ouvrirSecondaire(sec.cle)
            })),
            reglages: { label: C.textes.reglages, onClick: () => this.aller(SettingsScene.KEY) },
            illustration: (cx, cy, hauteurMax) => {
                const hBloc = Math.min(UI.u(this, C.menu.illustrationU), hauteurMax * 0.8);
                this._positionnerSaveurs(cx, cy, hBloc);
            }
        });

        // Transition d'arrivée : fondu depuis le noir (spec 728 §7).
        this.cameras.main.fadeIn(220, 0, 0, 0);

        // Meilleur score : local d'abord, puis confirmation par le serveur.
        // Porte-monnaie : profil persistant chargé au boot (spec 728 §4).
        await Arcade.Score.load();
        if (!this.scene.isActive()) return;   // menu déjà quitté entre-temps
        menu.setInfo(0, texteRecord());
        menu.setInfo(1, texteWallet());
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

    /**
     * Dispose les 6 emojis des saveurs en grille 3×2 (comme des items du
     * jeu), centrée sur (cx, cy), dans un bloc de hauteur hBloc. Chaque
     * emoji fait ~34 % de la hauteur du bloc. Cachés s'il n'y a plus la
     * place (petit écran en paysage).
     */
    _positionnerSaveurs(cx, cy, hBloc) {
        const visible = hBloc >= Arcade.UI.u(this, 8);
        const taille = hBloc * 0.34;
        const pasX = taille * 1.15;
        const pasY = hBloc * 0.52;
        this.saveurs.forEach((t, i) => {
            const col = i % 3;
            const ligne = Math.floor(i / 3);
            const x = cx + (col - 1) * pasX;
            const y = cy + (ligne - 0.5) * pasY;
            t.setVisible(visible).setFontSize(Math.round(taille) + "px").setPosition(x, y);
        });
    }
}
