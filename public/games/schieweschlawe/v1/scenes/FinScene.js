/*
 * FinScene — fin d'un niveau de Schieweschlawe (réussi ou raté).
 *
 * Réussi : « Niveau N réussi ! », lancers utilisés et proximité en
 * pastilles, record du niveau enregistré s'il est battu (le moins de
 * lancers, puis la meilleure proximité), niveau suivant débloqué.
 * Raté (3 lancers hors cible) : « Réessayer » redonne 3 lancers sur le
 * même niveau — rien n'est perdu (décision John 24/09).
 *
 * La sauvegarde n'est écrite QU'ICI, à la réussite : fermer le jeu en
 * plein niveau ne change rien à la progression.
 */
class FinScene extends Phaser.Scene {
    static KEY = "fin";

    constructor() {
        super(FinScene.KEY);
    }

    init(data) {
        this.niveau = (data && data.niveau) || 1;
        this.reussi = !!(data && data.reussi);
        this.lancers = (data && data.lancers) || 0;
        this.proximite = (data && data.proximite) || 0;
    }

    create() {
        const C = window.SchieweschlaweConfig;
        const T = C.textes;
        const UI = Arcade.UI;

        const fond = this.add.graphics().setDepth(0);
        UI.layout(this, (w, h) => {
            fond.clear();
            fond.fillStyle(Phaser.Display.Color.HexStringToColor(C.couleurs.ciel).color, 1);
            fond.fillRect(0, 0, w, h);
        });

        const menu = { icone: "🏠", label: T.menu, onClick: () => this.scene.start(MenuScene.KEY) };
        const niveaux = { icone: "🗺️", label: T.niveaux, onClick: () => this.scene.start(NiveauxScene.KEY) };
        const rejouer = (n) => () => this.scene.start(GameScene.KEY, { niveau: n });

        if (!this.reussi) {
            UI.menuPrincipal(this, {
                iconesPlateforme: false,
                surtitre: C.titre,
                titre: T.niveauRate,
                infos: [
                    T.infoRateNiveau.replace("{n}", this.niveau),
                    T.infoRateLancers.replace("{total}", C.niveaux.lancersParNiveau)
                ],
                jouer: { label: T.reessayer, onClick: rejouer(this.niveau) },
                secondaires: [niveaux, menu]
            });
            return;
        }

        const record = this._enregistrer();
        const dernier = this.niveau >= C.niveaux.total;
        const infos = [
            T.infoLancers.replace("{lancers}", NiveauxScene.texteLancers(this.lancers)),
            T.infoProximite.replace("{p}", this.proximite)
        ];
        if (record.nouveau) {
            infos.push(T.infoRecord);
        } else {
            infos.push(T.infoMeilleur
                .replace("{lancers}", NiveauxScene.texteLancers(record.meilleur.lancers))
                .replace("{p}", record.meilleur.proximite));
        }

        UI.menuPrincipal(this, {
            iconesPlateforme: false,
            surtitre: C.titre,
            titre: dernier && record.toutReussi ? T.jeuTermine
                : T.niveauReussi.replace("{n}", this.niveau),
            infos: infos,
            jouer: dernier
                ? { label: T.menu, onClick: menu.onClick }
                : { label: T.niveauSuivant, onClick: rejouer(this.niveau + 1) },
            secondaires: [
                { icone: "🔁", label: T.rejouer, onClick: rejouer(this.niveau) },
                niveaux
            ].concat(dernier ? [] : [menu])
        });
    }

    /**
     * Enregistre la réussite : meilleur résultat du niveau (moins de
     * lancers, puis meilleure proximité) et déblocage du suivant (jamais
     * de recul si on rejoue un ancien niveau). Save locale + serveur.
     */
    _enregistrer() {
        const C = window.SchieweschlaweConfig;
        const resultats = Object.assign({}, this.registry.get("resultats") || {});
        const cle = String(this.niveau);
        const avant = resultats[cle];
        const nouveau = { lancers: this.lancers, proximite: this.proximite };
        const mieux = !avant || nouveau.lancers < avant.lancers ||
            (nouveau.lancers === avant.lancers && nouveau.proximite > avant.proximite);
        if (mieux) resultats[cle] = nouveau;
        this.registry.set("resultats", resultats);

        const courant = this.registry.get("currentLevel") || 1;
        this.registry.set("currentLevel",
            Math.min(Math.max(courant, this.niveau + 1), C.niveaux.total + 1));

        Arcade.Save.saveLocal();
        Arcade.Save.saveCloud();
        return {
            nouveau: mieux,
            meilleur: resultats[cle],
            toutReussi: Object.keys(resultats).length >= C.niveaux.total
        };
    }
}
