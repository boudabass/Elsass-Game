/*
 * OverScene — fin de partie : score, record, rejouer / retour au menu.
 *
 * ÉTAPE 1 : le score vaut 0 (aucun bond possible sans terrain). La mécanique
 * arrive avec les étapes suivantes : score = nombre de bonds vers l'avant
 * réussis (le score ne recule jamais, il suit la position la plus avancée).
 *
 * ⭐ D2-3 (spec 708 §8/§9/§10) — deux modes :
 *  - MORT (fin de partie) : « Rejouer » relance le MÊME niveau avec le MÊME
 *    generatedRows (le monde de la session reste dans le registry — rien
 *    n'est réinventé, 708 §8), aucun système de vies. AUCUNE écriture de
 *    save (708 §9 : pas de sauvegarde en cours de partie) ;
 *  - VICTOIRE (fin de niveau, 708 §10) : la save EST écrite ICI, et
 *    uniquement ici — currentLevel passe au niveau suivant (pas de
 *    régression : fermer l'app après la victoire garde la progression) et
 *    generatedRows est celui du niveau gagné. « Niveau suivant » lance le
 *    niveau suivant avec un monde NEUF (régénéré à zéro).
 * Une fermeture en cours de niveau ne sauvegarde donc rien : au prochain
 * lancement le joueur reste sur son niveau (currentLevel inchangé), généré
 * à nouveau depuis zéro (708 §9).
 *
 * ⭐ MENU-2 (spec 709 §Données nécessaires) : la VICTOIRE enregistre aussi
 * le meilleur score PAR NIVEAU dans la save — data.bestScores, map
 * niveau→score (max conservé, jamais de recul — CDC 706 §Score). Le score
 * d'une victoire au niveau N est comparé à bestScores[N] et n'écrase que
 * s'il est supérieur. data.activeCharacter (personnage actif) est porté
 * par la save depuis la v5 (défaut "waggis", sélection MENU-4).
 */
class OverScene extends Phaser.Scene {
    static KEY = "fin";

    constructor() {
        super(OverScene.KEY);
    }

    init(data) {
        this.scoreFinal = (data && data.score) || 0;
        this.victoire = !!(data && data.victoire);
        this.niveau = (data && data.niveau) || 1;
    }

    async create() {
        const C = window.WaggisConfig;
        const UI = Arcade.UI;

        // ⭐ Décision John 08/08 (art. 704 Chantier B) : les boutons Retour
        // et Plein écran ne sont affichés QUE sur le menu principal — plus
        // d'icônes plateforme sur les autres scènes.
        // Fond : le même dégradé de ciel que les autres écrans.
        this.fond = this.add.graphics().setDepth(0);
        UI.layout(this, (w, h) => WaggisUI.ciel(this.fond, w, h));

        // D2-3 : titre selon le mode — victoire (fin de niveau, 708 §10) ou
        // mort (fin de partie).
        const titreTexte = this.victoire
            ? C.textes.niveauReussi.replace("{niveau}", this.niveau)
            : C.textes.fin;

        // D2-3 : bouton principal selon le mode — victoire → « Niveau
        // suivant » (monde NEUF : currentLevel a déjà été avancé par la
        // save ci-dessous, le niveau suivant se génère à zéro) ; mort →
        // « Rejouer » (le MÊME monde reste dans le registry, 708 §8).
        // ⭐ MENU-3 : « Niveau suivant » efface niveauSession (le niveau
        // éventuellement lancé depuis l'écran Niveaux) — la partie repart
        // du niveau en cours (data.currentLevel, spec 709).
        const action = this.victoire
            ? {
                label: C.textes.niveauSuivant,
                onClick: () => {
                    this.registry.set("niveauSession", null);
                    this.registry.set("generatedRows", null);
                    // Data EXPLICITE {} (piège Phaser : sans data,
                    // settings.data garde celle du démarrage précédent —
                    // l'écran Niveaux passerait son niveau rejoué).
                    this.scene.start(GameScene.KEY, {});
                }
            }
            : {
                label: C.textes.rejouer,
                onClick: () => this.scene.start(GameScene.KEY, {})
            };

        // Refonte charte du 24/09 : même gabarit que le menu
        // (Arcade.UI.menuPrincipal, sans Quitter / Plein écran) — score et
        // record en pastilles de l'en-tête.
        const ecran = Arcade.UI.menuPrincipal(this, {
            iconesPlateforme: false,
            surtitre: C.titre,
            titre: titreTexte,
            infos: [
                C.textes.score.replace("{score}", this.scoreFinal),
                C.textes.meilleurScore.replace("{score}", Arcade.Score.best)
            ],
            jouer: action,
            secondaires: [
                { icone: "🏠", label: C.textes.menu, onClick: () => this.scene.start(MenuScene.KEY) }
            ]
        });

        // Comptage des parties (statistique, en mémoire — elle ne se
        // persiste qu'à la victoire, avec la save ci-dessous).
        this.registry.set("parties", (this.registry.get("parties") || 0) + 1);

        // D2-3 (spec 708 §9) : la save n'intervient QU'À LA VICTOIRE du
        // niveau. Victoire → currentLevel = niveau suivant (pas de
        // régression : fermer l'app après la victoire garde la progression)
        // et generatedRows = monde du niveau gagné (spec 708 §7). Mort →
        // AUCUNE écriture : une fermeture en cours de niveau laisse le
        // joueur sur son niveau (currentLevel inchangé), régénéré à zéro
        // au prochain lancement.
        if (this.victoire) {
            // MENU-2 (spec 709 §Données nécessaires) : meilleur score PAR
            // NIVEAU — bestScores est une map niveau→score (clé = numéro
            // de niveau). Enregistré à la VICTOIRE (seul point d'écriture
            // de la save, 708 §9) : on ne conserve que le meilleur score
            // de chaque niveau (jamais de recul, CDC 706 §Score).
            const bests = this.registry.get("bestScores") || {};
            const cle = String(this.niveau);
            const precedent = (typeof bests[cle] === "number") ? bests[cle] : 0;
            if (this.scoreFinal > precedent) {
                bests[cle] = this.scoreFinal;
                this.registry.set("bestScores", bests);
            }
            // MENU-3 (spec 709) : PAS DE RÉGRESSION — l'écran Niveaux
            // permet de rejouer un niveau déjà complété ; la victoire d'un
            // ancien niveau ne doit JAMAIS faire reculer currentLevel.
            const courant = this.registry.get("currentLevel") || 1;
            this.registry.set("currentLevel", Math.max(courant, this.niveau + 1));
            Arcade.Save.saveLocal();
            try {
                await Arcade.Save.saveCloud();
            } catch (e) {
                // Cloud indisponible (hors-ligne, session absente) : la
                // sauvegarde locale reste la copie de référence.
                console.warn("[OverScene] Sauvegarde cloud impossible :", e);
            }
        }

        // Envoi du score : le serveur ne garde que le meilleur
        const nouveauRecord = await Arcade.Score.submit(this.scoreFinal);
        if (!this.scene.isActive()) return;   // écran déjà quitté entre-temps
        ecran.setInfo(1, nouveauRecord
            ? "🏆 " + C.textes.nouveauRecord
            : C.textes.meilleurScore.replace("{score}", Arcade.Score.best));
    }
}
